import { z } from 'zod';

/**
 * Schema for individual MCP server configuration
 * Defines the structure for a single tool set (MCP server)
 */
export const ToolSetConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string().min(1), z.string().min(1)).optional(), // Ensure non-empty strings for both keys and values
  enabledTools: z.array(z.string()).optional(),
  disabledTools: z.array(z.string()).optional()
});

/**
 * Schema for a collection of tool configurations
 * Defines the structure for a tool configuration file
 */
export const ToolsConfigSchema = z.object({
  mcpServers: z.array(ToolSetConfigSchema)
});

// TypeScript types
export type ToolSetConfig = z.infer<typeof ToolSetConfigSchema>;
export type ToolsConfig = z.infer<typeof ToolsConfigSchema>;

/**
 * Default AI tools configuration
 * Includes OpenAI tools with API key from environment
 */
export const DEFAULT_AI_TOOLS: ToolsConfig = {
  mcpServers: [
    {
      name: "openai",
      command: "node",
      args: ["/usr/local/lib/node_modules/@hataraku/openai-server/dist/index.js"],
      env: {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      },
      disabledTools: [
        "image_generation",
        "audio_transcription"
      ]
    }
  ]
};

/**
 * Default development tools configuration
 * Includes GitHub tools with token from environment
 */
export const DEFAULT_DEV_TOOLS: ToolsConfig = {
  mcpServers: [
    {
      name: "github",
      command: "node",
      args: ["/usr/local/lib/node_modules/@hataraku/github-server/dist/index.js"],
      env: {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  ]
}; 