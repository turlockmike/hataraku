import chalk from 'chalk';
import { MessageParser, ToolResponse } from '../lib/types';
import { AVAILABLE_TOOLS, getToolDocs } from '../lib/tools';
import type { ModelInfo } from '../shared/api';
import { CliToolExecutor } from '../lib/tools/CliToolExecutor';
import { McpClient } from '../lib/mcp/McpClient';
import { formatToolResponse } from '../utils/format';
import { ApiHandler } from '../api';
import * as path from 'path';
import * as fs from 'fs/promises';
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
            requestTime?: number;
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
        private maxAttempts: number = 3,
        private isInteractive: boolean = false,
        private cwd: string = process.cwd()
    ) {
        this.taskHistory = new TaskHistory();
        this.taskId = Date.now().toString();
    }

    async run(initialPrompt?: string): Promise<void> {
        // Initialize MCP servers before starting
        await this.mcpClient.initializeServers();

        // Get MCP server states for debug info

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
                    'You are the worlds most powerful AI, an expert at everything. Your goal is to help the user with their tasks.',
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
                    getToolDocs(),
                    '',
                    ...mcpTools,
                    '',
                    'RULES',
                    '',
                    '1. For simple questions or calculations, respond ONLY with attempt_completion containing the direct answer as the result.',
                    '2. DO NOT overly explain your process or thinking - focus on the answer.',
                    '4. Wait for tool execution results before proceeding.',
                    '5. Handle errors appropriately.',
                    '6. Be concise - one line responses are preferred for simple answers.',
                    '7. YOU MUST use exactly one tool in each response.',
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

                console.log(chalk.yellow('thinking...'));

                // Log and save request debug info
                const requestStartTime = Date.now();
                this.debugInfo.requests.push({
                    timestamp: requestStartTime,
                    systemPrompt,
                    messages,
                    requestTime: 0 // Will be updated after response
                });
                await this.saveTaskHistory(initialPrompt || '');

                const stream = this.apiHandler.createMessage(systemPrompt, messages);
                let response = '';
                let currentUsage = {
                    tokensIn: 0,
                    tokensOut: 0,
                    cost: 0
                };
                let requestEndTime: number;
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

                // Calculate request time
                requestEndTime = Date.now();
                const lastRequest = this.debugInfo.requests[this.debugInfo.requests.length - 1];
                if (lastRequest) {
                    lastRequest.requestTime = requestEndTime - requestStartTime;
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
                        // process.exit(1);
                        throw new Error('Failed to complete task after maximum attempts');
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
                        
                        if (toolUse.params.command) {
                            [error, result] = await this.toolExecutor.executeCommand(toolUse.params.command);
                        }
                        
                        // Save history
                        await this.saveTaskHistory(initialPrompt || '');
                        
                        // Only exit if not in interactive mode
                        if (!this.isInteractive) {
                            console.log(chalk.yellow(`\nUsage:`));
                            console.log(chalk.yellow(`Tokens: ${this.tokensIn} in, ${this.tokensOut} out`));
                            console.log(chalk.yellow(`Cost: $${this.totalCost.toFixed(6)}`));
                            process.exit(0);
                        } else {
                            // Reset history for next task in interactive mode
                            this.history = [];
                            this.tokensIn = 0;
                            this.tokensOut = 0;
                            this.totalCost = 0;
                            this.taskId = Date.now().toString();
                            console.log(''); // Add blank line between tasks
                            return; // Exit the while loop iteration
                        }
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
                                        const filePath = path.join(this.cwd, fileName);
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
                        [error, result] = await this.toolExecutor.waitForUser(toolUse.params.prompt);
                        break;
                    }
                    case 'show_image': {
                        [error, result] = await this.toolExecutor.showImage(toolUse.params.path);
                        break;
                    }
                    case 'play_audio': {
                        [error, result] = await this.toolExecutor.playAudio(toolUse.params.path);
                        break;
                    }
                    case 'fetch': {
                        [error, result] = await this.toolExecutor.fetch(
                            toolUse.params.url,
                            {
                                usePlaywright: toolUse.params.usePlaywright === 'true',
                                headers: toolUse.params.headers,
                                method: toolUse.params.method,
                                body: toolUse.params.body
                            }
                        );
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
            this.cwd
        ].join('\n');

        return `<environment_details>${details}</environment_details>`;
    }
}