import { UnifiedTool } from '../types';
import { McpClient } from '../mcp/McpClient';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getUseMcpToolDescription } from '../../core/prompts/tools';

export interface UseMcpToolInput {
    server_name: string;
    tool_name: string;
    arguments?: string; // JSON string of tool arguments
}

export interface UseMcpToolOutput {
    success: boolean;
    message: string;
    content?: string;
    error?: string;
}

let mcpClient: McpClient | null = null;

export const useMcpTool: UnifiedTool<UseMcpToolInput, UseMcpToolOutput> = {
    name: 'use_mcp_tool',
    description: getUseMcpToolDescription(),
    parameters: {
        server_name: {
            required: true,
            description: 'The name of the MCP server providing the tool'
        },
        tool_name: {
            required: true,
            description: 'The name of the tool to execute'
        },
        arguments: {
            required: false,
            description: 'A JSON string containing the tool\'s input parameters'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            server_name: {
                type: 'string',
                description: 'The name of the MCP server providing the tool'
            },
            tool_name: {
                type: 'string',
                description: 'The name of the tool to execute'
            },
            arguments: {
                type: 'string',
                description: 'A JSON string containing the tool\'s input parameters, following the tool\'s input schema'
            }
        },
        required: ['server_name', 'tool_name'],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the MCP tool execution was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            content: {
                type: 'string',
                description: 'The tool execution result content'
            },
            error: {
                type: 'string',
                description: 'Error message if the operation failed'
            }
        },
        required: ['success', 'message'],
        additionalProperties: false
    },
    // Implementation
    async execute({ server_name, tool_name, arguments: args }: UseMcpToolInput, cwd: string): Promise<UseMcpToolOutput> {
        try {
            // Initialize MCP client if not already done
            if (!mcpClient) {
                mcpClient = new McpClient();
                await mcpClient.initializeServers();
            }

            // Parse arguments if provided
            const parsedArgs = args ? JSON.parse(args) : {};

            // Call the MCP tool
            const mcpResult = await mcpClient.callTool(
                server_name,
                tool_name,
                parsedArgs
            );

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
                        const filePath = path.join(cwd, fileName);
                        await fs.writeFile(filePath, Buffer.from(item.data, 'base64'));
                        return `Image saved to: ${filePath}`;
                    })
            );

            const allContent = [textContent, ...imageResults].filter(Boolean).join('\n');

            return {
                success: !mcpResult.isError,
                message: mcpResult.isError ? 'MCP tool execution failed' : 'MCP tool executed successfully',
                content: allContent,
                ...(mcpResult.isError && { error: textContent })
            };
        } catch (error) {
            return {
                success: false,
                message: `Error executing MCP tool: ${error.message}`,
                error: error.message
            };
        }
    }
};