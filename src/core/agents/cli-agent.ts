import { LanguageModelV1 } from 'ai';
import { createAgent } from '../agent';
import { getEnvironmentInfo, getAgentRules } from '../prompts';
import { TaskHistory } from '../TaskHistory';
import { ALL_TOOLS } from '../tools';
import { getMcpTools } from '../mcp/toolWrapper';
import { ToolManager } from '../../config/ToolManager';

export async function createCLIAgent(model: LanguageModelV1 | Promise<LanguageModelV1>) {
  // Initialize tools
  const tools = { ...ALL_TOOLS };
  
  try {
    // Get MCP tools from tool manager
    const toolManager = new ToolManager();
    await toolManager.initializeDefaults();
    
    // Get tool configurations
    const toolConfigs = await toolManager.listTools();
    
    // Load MCP tools for each configuration
    for (const toolConfig of toolConfigs) {
      try {
        const resolvedConfig = await toolManager.getResolvedToolConfig(toolConfig);
        
        // Convert to the format expected by getMcpTools
        const mcpConfig = {
          mcpServers: {}
        };
        
        for (const server of resolvedConfig.mcpServers) {
          mcpConfig.mcpServers[server.name] = {
            command: server.command,
            args: server.args || [],
            env: server.env || {},
            disabledTools: server.disabledTools
          };
        }
        
        // Get MCP tools for this configuration
        const { tools: mcpTools } = await getMcpTools({ config: mcpConfig });
        
        // Add MCP tools to the agent's tools
        Object.assign(tools, mcpTools);
      } catch (error) {
        console.warn(`Warning: Failed to load MCP tools for configuration '${toolConfig}':`, error);
      }
    }
  } catch (error) {
    console.warn('Warning: Failed to load MCP tools:', error);
  }
  
  // Create and return the agent
  return createAgent({
    name: 'CLI Agent',
    description: 'A helpful CLI agent that can answer questions and perform tasks',
    role: `
${getAgentRules()}
${getEnvironmentInfo()}`,
    model,
    taskHistory: new TaskHistory(),
    tools,
    callSettings: {
    }
  });
} 