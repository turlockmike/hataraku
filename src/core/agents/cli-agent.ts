import { Agent, AgentConfig } from '../agent';
import { ALL_TOOLS } from '../tools';
import { getEnvironmentInfo, getAgentRules } from '../prompts';

export function createCLIAgent(model: any, apiKey?: string): Agent {
    const environmentInfo = getEnvironmentInfo();
    const rules = getAgentRules();
    
    const config: AgentConfig = {
        name: 'Hataraku CLI Agent',
        description: 'A helpful AI assistant that can perform various tasks and answer questions',
        role: `You are a helpful AI assistant that can perform various tasks and answer questions.
              You should be friendly but professional, and provide clear and concise responses.
              When working with code, you should follow best practices and provide explanations.
              You have access to various tools for working with files, executing commands, and more.
              Use these tools when appropriate to help accomplish tasks.

              ${environmentInfo}
              ${rules}`,
        model,
        tools: ALL_TOOLS,
        callSettings: {
            temperature: 0.7,
            maxTokens: 2000,
        }
    };

    return new Agent(config);
} 