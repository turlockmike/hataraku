import { LanguageModelV1 } from 'ai';
import { createAgent } from '../agent';
import { getEnvironmentInfo, getAgentRules } from '../prompts';
import { TaskHistory } from '../TaskHistory';
import { ALL_TOOLS } from '../tools';

export function createCLIAgent(model: LanguageModelV1 | Promise<LanguageModelV1>) {
  return createAgent({
    name: 'CLI Agent',
    description: 'A helpful CLI agent that can answer questions and perform tasks',
    role: `
${getAgentRules()}
${getEnvironmentInfo()}`,
    model,
    taskHistory: new TaskHistory(),
    tools: ALL_TOOLS,
    callSettings: {
    }
  });
} 