import { z } from 'zod';

/**
 * Configuration for an MCP server
 */
export interface McpServerConfig {
  /** Command to run the server */
  command: string;
  /** Arguments to pass to the command */
  args: string[];
  /** Environment variables to set when running the server */
  env?: Record<string, string>;
  /** List of tool names to disable from this server */
  disabledTools?: string[];
}

/**
 * Complete MCP configuration
 */
export interface McpConfig {
  /** Map of server names to their configurations */
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * Zod schema for validating MCP server configuration
 */
export const McpServerConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()),
  env: z.record(z.string()).optional(),
  disabledTools: z.array(z.string()).optional(),
});

/**
 * Zod schema for validating complete MCP configuration
 */
export const McpConfigSchema = z.object({
  mcpServers: z.record(McpServerConfigSchema),
});

/**
 * Type guard to check if a value is a valid MCP configuration
 */
export function isMcpConfig(value: unknown): value is McpConfig {
  return McpConfigSchema.safeParse(value).success;
} 