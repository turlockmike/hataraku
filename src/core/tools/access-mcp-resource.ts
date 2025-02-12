import { Tool } from 'ai';
import { z } from 'zod';
import { McpClient } from '../../lib/mcp/McpClient';

let mcpClient: McpClient | null = null;

export const accessMcpResourceTool: Tool = {
  description: "Access a resource provided by a connected MCP server. Resources represent data sources that can be used as context, such as files, API responses, or system information.",
  parameters: z.object({
    server_name: z.string().describe('The name of the MCP server providing the resource'),
    uri: z.string().describe('The URI identifying the specific resource to access')
  }),
  execute: async ({ server_name, uri }) => {
    try {
      // Initialize MCP client if not already done
      if (!mcpClient) {
        mcpClient = new McpClient();
        await mcpClient.initializeServers();
      }

      // Access the resource
      const mcpResult = await mcpClient.readResource(server_name, uri);

      // Combine all text content
      const textContent = mcpResult.contents
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');

      // Handle non-text content types
      const otherContent = mcpResult.contents
        .filter(item => item.type !== 'text')
        .map(item => `[${item.type} content]`)
        .join('\n');

      const content = [textContent, otherContent].filter(Boolean).join('\n');

      return {
        content: [{
          type: "text",
          text: content || 'No content available'
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error accessing MCP resource: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
};