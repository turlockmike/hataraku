import chalk from 'chalk';
import { MessageParser, ToolResponse, Tool } from '../lib/types';
import { AVAILABLE_TOOLS } from '../lib/tools';
import type { ModelInfo } from '../shared/api';
import { CliToolExecutor } from '../lib/tools/CliToolExecutor';
import { McpClient } from '../lib/mcp/McpClient';
import { formatToolResponse } from '../utils/format';
import { ApiHandler } from '../api';
import { Anthropic } from '@anthropic-ai/sdk';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { listFiles } from '../services/glob/list-files';
import { TaskHistory, HistoryEntry } from './TaskHistory';

interface TaskLoopOptions {
    apiHandler: ApiHandler;
    toolExecutor: CliToolExecutor;
    mcpClient: McpClient;
    messageParser: MessageParser;
    initialPrompt?: string;
    maxAttempts?: number;
}

interface TaskMessage {
    role: 'assistant' | 'user';
    content: string;
}

export class TaskLoop {
    private consecutiveMistakeCount: number = 0;
    private history: TaskMessage[] = [];
    private taskHistory: TaskHistory;
    private taskId: string;
    private debugInfo: {
        requests: Array<{
            timestamp: number;
            systemPrompt: string;
            messages: Array<{
                role: 'assistant' | 'user';
                content: string;
            }>;
        }>;
        responses: Array<{
            timestamp: number;
            content: string;
            usage?: {
                tokensIn: number;
                tokensOut: number;
                cost: number;
            };
            model?: {
                id: string;
                info: ModelInfo;
            };
        }>;
        toolUsage: Array<{
            timestamp: number;
            tool: string;
            params: Record<string, string>;
            result: string;
            error: boolean;
        }>;
    } = {
        requests: [],
        responses: [],
        toolUsage: []
    };
    private getToolDocs(): string {
        return AVAILABLE_TOOLS.map(tool => {
            const params = Object.entries(tool.parameters)
                .map(([name, param]) =>
                    `- ${name}: (${param.required ? 'required' : 'optional'}) ${param.description}`
                )
                .join('\n');
            return `## ${tool.name}\nDescription: ${tool.description}\nParameters:\n${params}`;
        }).join('\n\n');
    }
    private tokensIn: number = 0;
    private tokensOut: number = 0;
    private cacheWrites: number = 0;
    private cacheReads: number = 0;
    private totalCost: number = 0;

    constructor(
        private apiHandler: ApiHandler,
        private toolExecutor: CliToolExecutor,
        private mcpClient: McpClient,
        private messageParser: MessageParser,
        private maxAttempts: number = 3
    ) {
        this.taskHistory = new TaskHistory();
        this.taskId = Date.now().toString();
    }

    async run(initialPrompt?: string): Promise<void> {
        // Initialize MCP servers before starting
        await this.mcpClient.initializeServers();

        if (initialPrompt) {
            this.history.push({ role: 'user', content: initialPrompt });
        }

        while (true) {
            try {
                // Get environment details
                const environmentDetails = await this.getEnvironmentDetails();

                // Get MCP tools and servers
                const mcpTools = [];
                const availableServers = this.mcpClient.getAvailableServers();
                if (availableServers.length > 0) {
                    mcpTools.push('\nMCP SERVERS\n');
                    mcpTools.push('\nThe Model Context Protocol (MCP) enables communication between the system and locally running MCP servers that provide additional tools and resources to extend your capabilities.\n');
                    mcpTools.push('\nMCP server settings are stored in ~/.cline/cline_mcp_settings.json\n');
                    mcpTools.push('\n# Connected MCP Servers\n');
                    mcpTools.push('\nWhen a server is connected, you can use the server\'s tools via the `use_mcp_tool` tool, and access the server\'s resources via the `access_mcp_resource` tool.\n');
                    mcpTools.push(`\nCurrently connected servers: ${availableServers.join(', ')}\n`);
                    
                    const serverTools = await this.mcpClient.getServerTools();
                    if (serverTools.length > 0) {
                        mcpTools.push(...serverTools);
                    }
                }

                const systemPromptParts = [
                    'You are Cline, a highly skilled software engineer.',
                    '',
                    'TOOLS',
                    '',
                    'You have access to the following tools that must be used with XML tags. Each parameter must be wrapped in its own XML tags, like this:',
                    '',
                    '<tool_name>',
                    '<param1>value1</param1>',
                    '<param2>value2</param2>',
                    '</tool_name>',
                    '',
                    this.getToolDocs(),
                    '',
                    ...mcpTools,
                    '',
                    'RULES',
                    '',
                    '1. YOU MUST use exactly one tool in each response. If this is the final response, you must use the `attempt_completion` tool.',
                    '2. Wait for tool execution results before proceeding',
                    '3. Handle errors appropriately',
                    '4. Document your changes',
                    '',
                    'TASK',
                    '',
                    initialPrompt || '',
                    '',
                    environmentDetails
                ];

                const systemPrompt = systemPromptParts.join('\n');
                const messages = this.history.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

                // We may see multiple "thinking..." messages since the AI can only execute one tool at a time,
                // requiring multiple API calls to complete a task
                console.log(chalk.yellow('thinking...'));

                // Log and save request debug info
                this.debugInfo.requests.push({
                    timestamp: Date.now(),
                    systemPrompt,
                    messages
                });
                await this.saveTaskHistory(initialPrompt || '');

                const stream = this.apiHandler.createMessage(systemPrompt, messages);
                let response = '';
                let currentUsage = {
                    tokensIn: 0,
                    tokensOut: 0,
                    cost: 0
                };
                for await (const chunk of stream) {
                    if (chunk.type === 'text' && chunk.text) {
                        response += chunk.text;
                    } else if (chunk.type === 'usage') {
                        this.tokensIn += chunk.inputTokens || 0;
                        this.tokensOut += chunk.outputTokens || 0;
                        this.cacheWrites += chunk.cacheWriteTokens || 0;
                        this.cacheReads += chunk.cacheReadTokens || 0;
                        if (chunk.totalCost) {
                            this.totalCost = chunk.totalCost;
                        }
                        currentUsage = {
                            tokensIn: chunk.inputTokens || 0,
                            tokensOut: chunk.outputTokens || 0,
                            cost: chunk.totalCost || 0
                        };
                    }
                }

                // Get model info from API handler
                const model = this.apiHandler.getModel();

                // Log and save response debug info
                this.debugInfo.responses.push({
                    timestamp: Date.now(),
                    content: response,
                    usage: currentUsage,
                    model: {
                        id: model.id,
                        info: model.info
                    }
                });
                await this.saveTaskHistory(initialPrompt || '');

                // Helper function to strip tool usage XML
                const stripToolUsage = (text: string): string => {
                    // Remove any XML tags and their content if they match our tool format
                    const cleanText = text.replace(/<(thinking|[a-z_]+)>[\s\S]*?<\/\1>/g, '');
                    // Remove any remaining XML-style tags for safety
                    return cleanText.replace(/<[^>]*>/g, '').trim();
                };

                // Parse tool use from response
                const toolUse = this.messageParser.parseToolUse(response);

                // Output assistant's message to console, excluding tool usage
                const cleanMessage = stripToolUsage(response);
                if (cleanMessage) {
                    console.log(chalk.blue(cleanMessage));
                }
                if (!toolUse) {
                    this.consecutiveMistakeCount++;
                    if (this.consecutiveMistakeCount >= this.maxAttempts) {
                        console.error(chalk.red('Failed to complete task after maximum attempts'));
                        await this.saveTaskHistory(initialPrompt || '');
                        process.exit(1);
                    }
                    continue;
                }

                let error = false;
                let result: ToolResponse = '';

                // Execute the appropriate tool
                switch (toolUse.name) {
                    case 'write_to_file': {
                        [error, result] = await this.toolExecutor.writeFile(
                            toolUse.params.path,
                            toolUse.params.content,
                            parseInt(toolUse.params.line_count)
                        );
                        break;
                    }
                    case 'read_file': {
                        [error, result] = await this.toolExecutor.readFile(toolUse.params.path);
                        break;
                    }
                    case 'list_files': {
                        [error, result] = await this.toolExecutor.listFiles(
                            toolUse.params.path,
                            toolUse.params.recursive === 'true'
                        );
                        break;
                    }
                    case 'search_files': {
                        [error, result] = await this.toolExecutor.searchFiles(
                            toolUse.params.path,
                            toolUse.params.regex,
                            toolUse.params.file_pattern
                        );
                        break;
                    }
                    case 'execute_command': {
                        [error, result] = await this.toolExecutor.executeCommand(toolUse.params.command);
                        break;
                    }
                    case 'attempt_completion': {
                        // Display final result and usage information
                        console.log(chalk.green(toolUse.params.result));
                        console.log(chalk.yellow(`\nUsage:`));
                        console.log(chalk.yellow(`Tokens: ${this.tokensIn} in, ${this.tokensOut} out`));
                        console.log(chalk.yellow(`Cost: $${this.totalCost.toFixed(6)}`));
                        
                        if (toolUse.params.command) {
                            [error, result] = await this.toolExecutor.executeCommand(toolUse.params.command);
                        }
                        // Save history before exiting
                        await this.saveTaskHistory(initialPrompt || '');
                        process.exit(0);
                    }
                    case 'list_code_definition_names': {
                        [error, result] = await this.toolExecutor.listCodeDefinitions(toolUse.params.path);
                        break;
                    }
                    case 'use_mcp_tool': {
                        try {
                            const mcpResult = await this.mcpClient.callTool(
                                toolUse.params.server_name,
                                toolUse.params.tool_name,
                                JSON.parse(toolUse.params.arguments || '{}')
                            );
                            error = mcpResult.isError === true;
                            
                            // Handle different content types from MCP tools
                            const textContent = mcpResult.content
                                .filter((item): item is { type: 'text'; text: string } => item.type === 'text')
                                .map(item => item.text)
                                .join('\n');

                            // Handle image content by saving to file
                            const imageResults = await Promise.all(
                                mcpResult.content
                                    .filter((item): item is { type: 'image'; data: string; mimeType: string } => item.type === 'image')
                                    .map(async (item, index) => {
                                        const ext = item.mimeType.split('/')[1] || 'png';
                                        const fileName = `mcp-image-${Date.now()}-${index}.${ext}`;
                                        const filePath = path.join(process.cwd(), fileName);
                                        await fs.writeFile(filePath, Buffer.from(item.data, 'base64'));
                                        return `Image saved to: ${filePath}`;
                                    })
                            );

                            result = [textContent, ...imageResults].filter(Boolean).join('\n');
                        } catch (err) {
                            error = true;
                            result = `Error executing MCP tool: ${err.message}`;
                        }
                        break;
                    }
                    case 'access_mcp_resource': {
                        try {
                            const mcpResult = await this.mcpClient.readResource(
                                toolUse.params.server_name,
                                toolUse.params.uri
                            );
                            error = false;
                            result = mcpResult.contents.map(item => item.text).join('\n');
                        } catch (err) {
                            error = true;
                            result = `Error accessing MCP resource: ${err.message}`;
                        }
                        break;
                    }
                    case 'wait_for_user': {
                        try {
                            // Display prompt and wait for user input
                            console.log(chalk.yellow(toolUse.params.prompt));
                            const readline = require('readline').createInterface({
                                input: process.stdin,
                                output: process.stdout
                            });
                            
                            const userInput = await new Promise<string>((resolve) => {
                                readline.question('> ', (answer: string) => {
                                    readline.close();
                                    resolve(answer);
                                });
                            });
                            
                            error = false;
                            result = `User input: ${userInput}`;
                        } catch (err) {
                            error = true;
                            result = `Error waiting for user input: ${err.message}`;
                        }
                        break;
                    }
                    default: {
                        error = true;
                        result = `Unknown tool: ${toolUse.name}`;
                    }
                }

                // Log and save tool usage
                this.debugInfo.toolUsage.push({
                    timestamp: Date.now(),
                    tool: toolUse.name,
                    params: toolUse.params,
                    result: formatToolResponse(result),
                    error
                });
                await this.saveTaskHistory(initialPrompt || '');

                // Reset mistake count on successful tool use
                if (!error) {
                    this.consecutiveMistakeCount = 0;
                }

                // Add result to history
                this.history.push(
                    { role: 'assistant', content: response },
                    { role: 'user', content: `[${toolUse.name}] Result: ${formatToolResponse(result)}` }
                );

                // Only log errors
                if (error) {
                    console.error(chalk.red(`Error: ${result}`));
                }

            } catch (error) {
                const model = this.apiHandler.getModel();
                console.error(chalk.red('Error in task loop:'), error);
                console.error(chalk.yellow('\nDebug Information:'));
                console.error(chalk.yellow(`Model: ${model.id}`));
                await this.saveTaskHistory(initialPrompt || '');
                process.exit(1);
            }
        }
    }

    private async saveTaskHistory(task: string): Promise<void> {
        const entry: HistoryEntry = {
            taskId: this.taskId,
            timestamp: Date.now(),
            task,
            tokensIn: this.tokensIn,
            tokensOut: this.tokensOut,
            cacheWrites: this.cacheWrites,
            cacheReads: this.cacheReads,
            totalCost: this.totalCost,
            messages: this.history,
            debug: this.debugInfo,
            model: this.apiHandler.getModel().id
        };

        await this.taskHistory.saveTask(entry);
    }

    private async getEnvironmentDetails(): Promise<string> {
        // Add current time information with timezone
        const now = new Date();
        const formatter = new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true
        });
        const timeZone = formatter.resolvedOptions().timeZone;
        const timeZoneOffset = -now.getTimezoneOffset() / 60;
        const timeZoneOffsetStr = `${timeZoneOffset >= 0 ? '+' : ''}${timeZoneOffset}:00`;

        const details = [
            '# Current Time',
            `${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`,
            '',
            '# Current Working Directory',
            process.cwd()
        ].join('\n');

        return `<environment_details>${details}</environment_details>`;
    }
}