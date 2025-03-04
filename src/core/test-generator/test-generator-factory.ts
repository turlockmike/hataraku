import { z } from "zod"
import { LLMTestCaseGenerator } from "./llm-test-generator"
import { TestGeneratorOptions } from "./types"
import { createDefaultTestGeneratorAgent, createDefaultApiTestGeneratorAgent } from "./default-agents"

/**
 * Creates a new LLMTestCaseGenerator with the specified schemas and options
 *
 * @param inputSchema The Zod schema for the input
 * @param outputSchema The Zod schema for the expected output
 * @param options Optional configuration for the test generator
 * @returns A new LLMTestCaseGenerator instance
 */
export function createTestGenerator<TInput, TOutput>(
	inputSchema: z.ZodType<TInput>,
	outputSchema: z.ZodType<TOutput>,
	options?: TestGeneratorOptions<TInput, TOutput>
): LLMTestCaseGenerator<TInput, TOutput> {
	const agent = createDefaultTestGeneratorAgent()
	return new LLMTestCaseGenerator(inputSchema, outputSchema, agent, options)
}

/**
 * Creates a new LLMTestCaseGenerator specifically for testing APIs
 *
 * @param config Configuration for the API test generator
 * @returns A new LLMTestCaseGenerator instance configured for API testing
 */
export function createApiTestGenerator<TInput, TOutput>(config: {
	requestSchema: z.ZodType<TInput>
	responseSchema: z.ZodType<TOutput>
	endpoint: string
	method: string
	generatorOptions?: TestGeneratorOptions<TInput, TOutput>
}): LLMTestCaseGenerator<TInput, TOutput> {
	// Use the API test generator agent for API-specific test generation
	const apiAgent = createDefaultApiTestGeneratorAgent()

	// Enhance the generator options with API-specific context
	const enhancedOptions: TestGeneratorOptions<TInput, TOutput> = {
		...config.generatorOptions,
		prompts: {
			testCaseGeneration: buildApiTestCasePrompt(config.endpoint, config.method),
			edgeCaseGeneration: buildApiEdgeCasePrompt(config.endpoint, config.method),
			boundaryTestGeneration: buildApiBoundaryTestPrompt(config.endpoint, config.method),
			...config.generatorOptions?.prompts,
		},
	}

	return new LLMTestCaseGenerator(config.requestSchema, config.responseSchema, apiAgent, enhancedOptions)
}

/**
 * Build a prompt for generating API test cases
 */
function buildApiTestCasePrompt(endpoint: string, method: string): string {
	return `Generate test cases for the ${method} ${endpoint} API endpoint.
Consider:
1. Valid request payloads
2. Invalid request formats
3. Missing required fields
4. Authentication scenarios
5. Authorization levels
6. Rate limiting cases
7. Concurrent request handling`
}

/**
 * Build a prompt for generating API edge cases
 */
function buildApiEdgeCasePrompt(endpoint: string, method: string): string {
	return `Generate edge cases for the ${method} ${endpoint} API endpoint.
Focus on:
1. Extreme payload sizes
2. Special characters in inputs
3. Malformed requests
4. Network conditions
5. Timeout scenarios
6. Resource limitations
7. Security edge cases`
}

/**
 * Build a prompt for generating API boundary tests
 */
function buildApiBoundaryTestPrompt(endpoint: string, method: string): string {
	return `Generate boundary tests for the ${method} ${endpoint} API endpoint.
Test:
1. Maximum/minimum field values
2. Request size limits
3. Rate limit boundaries
4. Pagination boundaries
5. Timeout thresholds
6. Resource quota limits
7. Authentication token expiration`
}
