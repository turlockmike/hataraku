import { z } from "zod"
import { LanguageModelV1, LanguageModelV1CallOptions, LanguageModelV1StreamPart } from "ai"
import { createDefaultTestGeneratorAgent, createDefaultApiTestGeneratorAgent } from "../default-agents"
import { Agent } from "../../agent"
import { createTestGenerator, createApiTestGenerator } from "../test-generator-factory"

// Mock the default API test generator agent
jest.mock("../default-agents", () => ({
	createDefaultTestGeneratorAgent: jest.fn(),
	createDefaultApiTestGeneratorAgent: jest.fn(),
}))

// Mock AI model for testing
class MockLanguageModel implements LanguageModelV1 {
	specificationVersion = "v1" as const
	provider = "test"
	modelId = "test-model"
	defaultObjectGenerationMode = "json" as const

	async doGenerate(options: LanguageModelV1CallOptions) {
		return {
			text: JSON.stringify({
				test_cases: [
					{
						input: { test: "value" },
						expected_output: {
							success: true,
							output: { result: "success" },
						},
					},
				],
			}),
			finishReason: "stop" as const,
			usage: { promptTokens: 10, completionTokens: 20 },
			rawCall: { rawPrompt: null, rawSettings: {} },
		}
	}

	async doStream(options: LanguageModelV1CallOptions) {
		return {
			stream: new ReadableStream<LanguageModelV1StreamPart>(),
			rawCall: { rawPrompt: null, rawSettings: {} },
		}
	}
}

describe("Test Generator Factory Functions", () => {
	const inputSchema = z.object({
		test: z.string(),
	})

	const outputSchema = z.object({
		result: z.string(),
	})

	const mockModel = new MockLanguageModel()
	const mockAgent = new Agent({
		name: "Test Agent",
		description: "Test agent for testing",
		role: "test",
		model: mockModel,
	})

	// Mock the task method
	mockAgent.task = jest.fn().mockResolvedValue({
		test_cases: [
			{
				input: { test: "value" },
				expected_output: {
					success: true,
					output: { result: "success" },
				},
			},
		],
	})

	beforeEach(() => {
		// Reset mocks before each test
		jest.clearAllMocks()
		// Set up the mock implementations
		;(createDefaultTestGeneratorAgent as jest.Mock).mockReturnValue(mockAgent)
		;(createDefaultApiTestGeneratorAgent as jest.Mock).mockReturnValue(mockAgent)
	})

	describe("createTestGenerator", () => {
		it("should create a basic test generator", async () => {
			const generator = createTestGenerator(inputSchema, outputSchema)

			const testCases = await generator.generateTestCases({
				count: 1,
			})

			expect(testCases).toBeDefined()
			expect(testCases.length).toBeGreaterThan(0)
			expect(testCases[0].input).toBeDefined()
			expect(testCases[0].expected_output).toBeDefined()
			expect(mockAgent.task).toHaveBeenCalled()
		})
	})

	describe("createApiTestGenerator", () => {
		it("should create an API test generator with enhanced prompts", async () => {
			const generator = createApiTestGenerator({
				requestSchema: inputSchema,
				responseSchema: outputSchema,
				endpoint: "/test",
				method: "POST",
				generatorOptions: {
					prompts: {
						testCaseGeneration: "Generate API test cases",
					},
				},
			})

			const testCases = await generator.generateTestCases({
				count: 1,
			})

			expect(testCases).toBeDefined()
			expect(testCases.length).toBeGreaterThan(0)
			expect(testCases[0].input).toBeDefined()
			expect(testCases[0].expected_output).toBeDefined()
			expect(createDefaultApiTestGeneratorAgent).toHaveBeenCalled()
			expect(mockAgent.task).toHaveBeenCalled()
		}, 10000) // Increase timeout to 10 seconds
	})
})
