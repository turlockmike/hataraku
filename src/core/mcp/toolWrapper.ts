import type { ToolSet } from 'ai';
import type { McpConfig } from './config';

const { McpClient } = require('./McpClient');
const { isMcpConfig } = require('./config');
const { McpConfigError, McpToolError } = require('./errors');
const fs = require('fs/promises');

interface McpToolOptions {
  /** Optional path to config file, defaults to ~/.hataraku/mcp_settings.json */
  configPath?: string;
  /** Optional config object to use instead of loading from file */
  config?: McpConfig;
  /** Optional callback for tool execution monitoring */
  onToolCall?: (serverName: string, toolName: string, args: any, result: Promise<any>) => void;
}

/**
 * Creates a set of tools from MCP servers that can be passed to an Agent
 */
export async function getMcpTools(options?: McpToolOptions): Promise<ToolSet> {
  const client = new McpClient();
  
  // If config provided, validate and use it directly
  if (options?.config) {
    if (!isMcpConfig(options.config)) {
      throw new McpConfigError('Invalid config object provided');
    }
    await client.loadConfig(options.config);
  } 
  // If configPath provided, load and validate from that path
  else if (options?.configPath) {
    let configContent: string;
    try {
      configContent = await fs.readFile(options.configPath, 'utf-8');
    } catch (error) {
      throw new McpConfigError(`Failed to read config file: ${options.configPath}`, error as Error);
    }

    let config: unknown;
    try {
      config = JSON.parse(configContent);
    } catch (error) {
      throw new McpConfigError('Failed to parse config file as JSON', error as Error);
    }
    
    if (!isMcpConfig(config)) {
      throw new McpConfigError('Invalid config file format');
    }
    
    await client.loadConfigFromPath(options.configPath);
  }
  // Otherwise use default path
  else {
    await client.initializeServers();
  }

  const toolset: ToolSet = {};
  const servers = client.getAvailableServers();
  
  for (const serverName of servers) {
    const { tools } = await client.getServerTools(serverName);
    const serverConfig = options?.config?.mcpServers[serverName];
    
    for (const tool of tools) {
      // Skip if tool is in disabled list
      if (serverConfig?.disabledTools?.includes(tool.name)) {
        continue;
      }

      const qualifiedName = `${serverName}_${tool.name}`;
      
      toolset[qualifiedName] = {
        description: tool.description,
        parameters: tool.inputSchema,
        execute: async (args: any) => {
          try {
            const resultPromise = client.callTool(serverName, tool.name, args);

            if (options?.onToolCall) {
              options.onToolCall(serverName, tool.name, args, resultPromise);
            }

            return await resultPromise;
          } catch (error) {
            throw new McpToolError(serverName, tool.name, error as Error);
          }
        },
      };
    }
  }

  return toolset;
}

// For CommonJS compatibility
module.exports = {
  getMcpTools,
};

// For TypeScript/ES modules
export default {
  getMcpTools,
};