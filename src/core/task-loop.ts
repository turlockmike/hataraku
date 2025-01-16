import chalk from 'chalk';
import { MessageParser, ToolResponse, Tool } from '../lib/types';
import { AVAILABLE_TOOLS } from '../lib/tools';
import { CliToolExecutor } from '../lib/tools/CliToolExecutor';
import { McpClient } from '../lib/mcp/McpClient';
import { formatToolResponse } from '../utils/format';
import { ApiHandler } from '../api';
import { Anthropic } from '@anthropic-ai/sdk';
import * as os from 'os';
import * as path from 'path';
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

                // Get response from API
                const mcpTools = [];
                const availableServers = this.mcpClient.getAvailableServers();
                if (availableServers.length > 0) {
                    mcpTools.push('\nMCP SERVERS\n');
                    mcpTools.push('\nThe Model Context Protocol (MCP) enables communication between the system and locally running MCP servers that provide additional tools and resources to extend your capabilities.\n');
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
                    initialPrompt || ''
                ];

                const systemPrompt = systemPromptParts.join('\n');
                const messages = this.history.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

                // We may see multiple "thinking..." messages since the AI can only execute one tool at a time,
                // requiring multiple API calls to complete a task
                console.log(chalk.yellow('thinking...'));
                const stream = this.apiHandler.createMessage(systemPrompt, messages);
                let response = '';
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
                    }
                }

                // Parse tool use from response
                const toolUse = this.messageParser.parseToolUse(response);
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
                            result = mcpResult.content.map(item => item.text).join('\n');
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
                    default: {
                        error = true;
                        result = `Unknown tool: ${toolUse.name}`;
                    }
                }

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
                console.error(chalk.red('Error in task loop:'), error);
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
            messages: this.history
        };

        await this.taskHistory.saveTask(entry);
    }

    private async getEnvironmentDetails(): Promise<string> {
        let details = '';

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
        details += `\n\n# Current Time\n${formatter.format(now)} (${timeZone}, UTC${timeZoneOffsetStr})`;

        // Add current working directory files
        const cwd = process.cwd();
        details += `\n\n# Current Working Directory (${cwd}) Files\n`;
        const isDesktop = path.resolve(cwd) === path.join(os.homedir(), 'Desktop');
        
        if (isDesktop) {
            details += '(Desktop files not shown automatically. Use list_files to explore if needed.)';
        } else {
            const [files, didHitLimit] = await listFiles(cwd, true, 200);
            details += files.join('\n');
            if (didHitLimit) {
                details += '\n(File list truncated due to size limit)';
            }
        }

        return `<environment_details>${details.trim()}</environment_details>`;
    }
}