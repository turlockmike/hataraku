import { Tool } from 'ai';
import { z } from 'zod';
import { McpClient } from '../../lib/mcp/McpClient';

let mcpClient: McpClient | null = null;

export const useMcpTool: Tool = {
  description: "Use a tool provided by a connected MCP server. Each MCP server can provide multiple tools with different capabilities.",
  parameters: z.object({
    server_name: z.string().describe('The name of the MCP server providing the tool'),
    tool_name: z.string().describe('The name of the tool to execute'),
    arguments: z.string().optional().describe('A JSON string containing the tool\'s input parameters')
  }),
  execute: async ({ server_name, tool_name, arguments: args }) => {
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
      const content = mcpResult.content.map(item => {
        if (item.type === 'text') {
          return {
            type: 'text',
            text: item.text
          };
        }
        // For now, we'll convert other types to text representation
        return {
          type: 'text',
          text: `[${item.type} content]`
        };
      });

      return {
        isError: mcpResult.isError,
        content
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error executing MCP tool: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
};