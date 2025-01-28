import { UnifiedTool } from '../types';
import { McpClient } from '../mcp/McpClient';

export interface AccessMcpResourceInput {
    server_name: string;
    uri: string;
}

export interface AccessMcpResourceOutput {
    success: boolean;
    message: string;
    content?: string;
    error?: string;
}

let mcpClient: McpClient | null = null;

export const accessMcpResourceTool: UnifiedTool<AccessMcpResourceInput, AccessMcpResourceOutput> = {
    name: 'access_mcp_resource',
    description: 'Request to access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.',
    parameters: {
        server_name: {
            required: true,
            description: 'The name of the MCP server providing the resource'
        },
        uri: {
            required: true,
            description: 'The URI identifying the specific resource to access'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            server_name: {
                type: 'string',
                description: 'The name of the MCP server providing the resource'
            },
            uri: {
                type: 'string',
                description: 'The URI identifying the specific resource to access'
            }
        },
        required: ['server_name', 'uri'],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the resource access was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            content: {
                type: 'string',
                description: 'The resource content if successfully accessed'
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
    async execute({ server_name, uri }: AccessMcpResourceInput, cwd: string): Promise<AccessMcpResourceOutput> {
        try {
            // Initialize MCP client if not already done
            if (!mcpClient) {
                mcpClient = new McpClient();
                await mcpClient.initializeServers();
            }

            // Access the resource
            const mcpResult = await mcpClient.readResource(server_name, uri);

            // Combine all text content
            const content = mcpResult.contents.map(item => item.text).join('\n');

            return {
                success: true,
                message: 'Resource accessed successfully',
                content
            };
        } catch (error) {
            return {
                success: false,
                message: `Error accessing MCP resource: ${error.message}`,
                error: error.message
            };
        }
    }
};