import { Agent } from "../agent"
import { LanguageModelV1 } from "ai"
import { createBedrockModel } from "../providers/bedrock"

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
 * @returns {Agent} The created agent.
 */
export function createBaseAgent(config: {
	name: string
	description: string
	role: string
	tools?: Record<string, any>
	model?: LanguageModelV1 | Promise<LanguageModelV1>
	profile?: string
	verbose?: boolean
}): Agent {
	return new Agent({
		name: config.name,
		description: config.description,
		role: config.role,
		model: config.model || createBedrockModel(config.profile),
		tools: config.tools,
		verbose: config.verbose,
	})
}
