import { createAgent, createBedrockModel } from 'hataraku'
import { LanguageModelV1 } from 'ai'

// Common agent roles
export const ROLES = {
  MATH: 'You are a mathematical computation agent that performs precise calculations. Always use the provided tools for calculations.',
  GREETER: 'You are a friendly greeter that generates warm and welcoming greetings.',
  ANALYST: 'You are a data analyst that processes and analyzes information carefully and methodically.',
  WORKFLOW: 'You are a workflow orchestrator that coordinates and executes multi-step processes efficiently.',
  POET: 'You are a creative poet that writes engaging and metaphorical poems.',
  CALCULATOR: 'You are a calculator that performs mathematical operations and converts numbers to words.',
  ASSISTANT: 'You are a helpful assistant that answers questions clearly and concisely.',
}

// Common agent descriptions
export const DESCRIPTIONS = {
  MATH: 'An agent that performs mathematical operations',
  GREETER: 'An agent that generates greetings',
  ANALYST: 'An agent that analyzes data and provides insights',
  WORKFLOW: 'An agent that manages complex workflows',
  POET: 'An agent that writes creative poems',
  CALCULATOR: 'An agent that performs calculations and number conversions',
  ASSISTANT: 'An agent that provides helpful responses to questions',
}

/**
 * Creates a base agent with the specified configuration.
 *
 * @param {object} config - The configuration object for the agent.
 * @param {string} config.name - The name of the agent.
 * @param {string} config.description - The description of the agent.
 * @param {string} config.role - The role of the agent.
 * @param {Record<string, any>} [config.tools] - Optional tools for the agent.
 * @param {LanguageModelV1 | Promise<LanguageModelV1>} [config.model] - Optional language model for the agent.
 * @param {string} [config.profile] - Optional profile for the agent.
 * @returns {any} The created agent.
 * @example
 * const agent = createBaseAgent({
 *   name: 'MathAgent',
 *   description: 'An agent that performs mathematical operations',
 *   role: ROLES.MATH,
 *   tools: { calculator: new CalculatorTool() }
 * });
 */
export function createBaseAgent(config: {
  name: string
  description: string
  role: string
  tools?: Record<string, any>
  model?: LanguageModelV1 | Promise<LanguageModelV1>
  profile?: string
}) {
  return createAgent({
    name: config.name,
    description: config.description,
    role: config.role,
    model: config.model || createBedrockModel(config.profile),
    tools: config.tools,
  })
}
