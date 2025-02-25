import { createAgent } from '../../core/agent';
import { createBedrockModel } from '../../core/providers/bedrock';
import { LanguageModelV1 } from 'ai';

// Common agent roles
export const ROLES = {
  MATH: 'You are a mathematical computation agent that performs precise calculations. Always use the provided tools for calculations.',
  GREETER: 'You are a friendly greeter that generates warm and welcoming greetings.',
  ANALYST: 'You are a data analyst that processes and analyzes information carefully and methodically.',
  WORKFLOW: 'You are a workflow orchestrator that coordinates and executes multi-step processes efficiently.',
  POET: 'You are a creative poet that writes engaging and metaphorical poems.',
  CALCULATOR: 'You are a calculator that performs mathematical operations and converts numbers to words.',
  ASSISTANT: 'You are a helpful assistant that answers questions clearly and concisely.'
};

// Common agent descriptions
export const DESCRIPTIONS = {
  MATH: 'An agent that performs mathematical operations',
  GREETER: 'An agent that generates greetings',
  ANALYST: 'An agent that analyzes data and provides insights',
  WORKFLOW: 'An agent that manages complex workflows',
  POET: 'An agent that writes creative poems',
  CALCULATOR: 'An agent that performs calculations and number conversions',
  ASSISTANT: 'An agent that provides helpful responses to questions'
};

// Base agent configuration
export function createBaseAgent(config: {
  name: string;
  description: string;
  role: string;
  tools?: Record<string, any>;
  model?: LanguageModelV1 | Promise<LanguageModelV1>;
  profile?: string;
}) {
  return createAgent({
    name: config.name,
    description: config.description,
    role: config.role,
    model: config.model || createBedrockModel(config.profile),
    tools: config.tools
  });
} 