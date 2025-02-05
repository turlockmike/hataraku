import { Agent } from ".."
import { AgentConfig, TaskInput, Thread } from "../types/config"
import { z } from "zod"
import { MockProvider, MockTool } from "../../../lib/testing"
import { ModelProvider } from "../../../api"
import { Readable } from 'stream'

describe("Agent", () => {
	let mockProvider: MockProvider
	let mockTool: MockTool
	let mockToolWithInit: MockTool
	let validConfigWithProvider: AgentConfig
	let validConfigWithModelConfig: AgentConfig

	beforeEach(() => {
		mockProvider = new MockProvider()
		mockTool = MockTool.createBasic("mock_tool")
		mockToolWithInit = MockTool.createBasic("mock_tool_init")
		mockToolWithInit.setInitialize(async () => {
			/* mock initialization */
		})

		validConfigWithProvider = {
			name: "test-agent",
			model: mockProvider as ModelProvider,
			tools: [mockTool, mockToolWithInit],
			role: "You are Hataraku, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
			customInstructions: "You should always speak and think in the English language.",
		}

		validConfigWithModelConfig = {
			name: "test-agent",
			model: {
				apiProvider: "anthropic",
				apiModelId: "claude-3-5-sonnet-20241022",
			},
			tools: [mockTool, mockToolWithInit],
			role: "You are Hataraku, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
			customInstructions: "You should always speak and think in the English language.",
		}
	})

	const validTaskInput: TaskInput & { stream?: false } = {
		role: "user",
		content: "test task",
		stream: false,
	}

	describe("constructor", () => {
		it("should create an instance with ModelProvider", () => {
			const agent = new Agent(validConfigWithProvider)
			expect(agent).toBeInstanceOf(Agent)
			expect(agent.getConfig()).toEqual(validConfigWithProvider)
			expect(agent.getModelProvider()).toBe(mockProvider)
		})

		it("should create an instance with ModelConfiguration", () => {
			const agent = new Agent(validConfigWithModelConfig)
			expect(agent).toBeInstanceOf(Agent)
			expect(agent.getConfig()).toEqual(validConfigWithModelConfig)
			expect(agent.getModelProvider()).toBeDefined()
		})

		it("should throw error with invalid config", () => {
			const invalidConfig = {
				model: {
					apiProvider: "invalid-provider",
				},
			}

			expect(() => new Agent(invalidConfig as any)).toThrow("Invalid agent configuration")
		})
	})

	describe("initialize", () => {
		it("should initialize successfully with ModelProvider", async () => {
			const agent = new Agent(validConfigWithProvider)
			await agent.initialize()
			expect(agent.getLoadedTools()).toContain("mock_tool")
			expect(agent.getLoadedTools()).toContain("mock_tool_init")
			expect(mockToolWithInit.getInitializeCallCount()).toBe(1)
		})

		it("should initialize successfully with ModelConfiguration", async () => {
			const agent = new Agent(validConfigWithModelConfig)
			await agent.initialize()
			expect(agent.getLoadedTools()).toContain("mock_tool")
			expect(agent.getLoadedTools()).toContain("mock_tool_init")
			expect(mockToolWithInit.getInitializeCallCount()).toBe(1)
		})

		it("should only initialize once", async () => {
			const agent = new Agent(validConfigWithProvider)
			await agent.initialize()
			await agent.initialize()
			expect(agent.getLoadedTools()).toContain("mock_tool")
			expect(mockToolWithInit.getInitializeCallCount()).toBe(1)
		})
	})

	describe("task", () => {
		it("should include role and custom instructions in system prompt", async () => {
			mockProvider.clearResponses().mockResponse("<attempt_completion><result>test response</result></attempt_completion>")
			const agent = new Agent(validConfigWithProvider)
			await agent.initialize()

			await agent.task(validTaskInput)
			const call = mockProvider.getCall(0)!
			expect(call).toBeTruthy()

			// Verify system prompt content
			expect(call.systemPrompt).toMatchSnapshot()
		})

		it("should execute task successfully", async () => {
			mockProvider.clearResponses().mockResponse("<attempt_completion><result>test response</result></attempt_completion>")
			mockTool.mockResponse({ result: "tool success" })

			const agent = new Agent(validConfigWithProvider)
			await agent.initialize()

			const result = await agent.task(validTaskInput)
			expect(result).toBe("test response")
			expect(mockProvider.getCallCount()).toBe(1)

			const call = mockProvider.getCall(0)!
			expect(call.systemPrompt).not.toContain("test task")
			expect(call.messages).toHaveLength(1)
			expect(call.messages[0]).toEqual({
				role: "user",
				content: "<task>test task</task>",
			})
		})

		it("should handle streaming task", async () => {
			mockProvider.clearResponses().mockResponse("<attempt_completion><result>test response</result></attempt_completion>")
			const agent = new Agent(validConfigWithProvider)
			await agent.initialize()

			const streamingInput: TaskInput & { stream: true } = {
				role: "user",
				content: "test task",
				stream: true,
			}

			const result = await agent.task(streamingInput)
			expect(result).toBeDefined()
			expect(result[Symbol.asyncIterator]).toBeDefined()
		})

		it("should handle task with thread context", async () => {
			mockProvider.clearResponses().mockResponse("<attempt_completion><result>test response</result></attempt_completion>")
			const agent = new Agent(validConfigWithProvider)
			const thread = new Thread()
			thread.addContext({ key: "test", content: { value: "test" } })

			await agent.initialize()
			const result = await agent.task({ ...validTaskInput, thread })
			expect(result).toBe("test response")

			const call = mockProvider.getCall(0)!
			expect(call.messages).toHaveLength(2) // Context message + task message
			expect(call.messages[0].content).toContain("test") // Context included
		})

		it("should handle task with output schema", async () => {
			mockProvider.clearResponses().mockResponse('<attempt_completion><result>{"result": "test"}</result></attempt_completion>')
			const agent = new Agent(validConfigWithProvider)
			const outputSchema = z.object({
				result: z.string(),
			})

			await agent.initialize()
			const result = await agent.task({ ...validTaskInput, outputSchema })
			expect(result).toEqual({ result: "test" })
		})

		it("should throw error for invalid output schema", async () => {
			mockProvider.clearResponses().mockResponse("<attempt_completion><result>invalid json</result></attempt_completion>")
			const agent = new Agent(validConfigWithProvider)
			const outputSchema = z.object({
				result: z.string(),
			})

			await agent.initialize()
			await expect(agent.task({ ...validTaskInput, outputSchema })).rejects.toThrow(
				"Failed to parse response with schema"
			)
		})

		it("should handle model errors", async () => {
			mockProvider.clearResponses().mockError("Model error")
			const agent = new Agent(validConfigWithProvider)
			await agent.initialize()

			await expect(agent.task(validTaskInput)).rejects.toThrow("Model error")
		})

		it("should handle tool errors", async () => {
			mockProvider.clearResponses().mockResponse("<attempt_completion><result>test response</result></attempt_completion>")
			mockTool.mockError(new Error("Tool error"))

			const agent = new Agent(validConfigWithProvider)
			await agent.initialize()

			const result = await agent.task(validTaskInput)
			expect(result).toBe("test response")
			expect(mockTool.getCallCount()).toBe(0)
		})

		it("should include schema validation instructions in system prompt when output schema is provided", async () => {
			mockProvider.clearResponses().mockResponse('<attempt_completion><result>{"result": "test"}</result></attempt_completion>')
			const agent = new Agent(validConfigWithProvider)
			const outputSchema = z.object({
				result: z.string(),
			})

			await agent.initialize()
			const result = await agent.task({ ...validTaskInput, outputSchema })
			expect(result).toEqual({ result: "test" })
			
			const call = mockProvider.getCall(0)!
			expect(call.systemPrompt).toContain("Schema Validation and Output Formatting")
			expect(call.systemPrompt).toContain("Your response must be valid JSON that matches the schema exactly")
			expect(call.systemPrompt).toContain("Do not include any additional text, explanations, or formatting around the JSON")
			expect(call.systemPrompt).toContain("Ensure all required fields specified in the schema are present")
			expect(call.systemPrompt).toContain("Only include fields that are defined in the schema")
			expect(call.systemPrompt).toContain("Use the correct data types for each field as specified in the schema")
			expect(call.systemPrompt).toContain("For streaming responses, each chunk must be valid JSON that matches the schema")
			expect(call.systemPrompt).toContain('You will be given a task in a <task></task> tag. You will also be optionally given an output schema in a <output_schema></output_schema> tag.')
			expect(call.systemPrompt).toContain("When calling attempt_completion, ensure the result is valid JSON that matches the schema")
			expect(call.messages[0].content).toEqual('<task>test task</task><output_schema>{"result": z.string()}</output_schema>')
		})

		it("should include tool list in system prompt", async () => {
			mockProvider.clearResponses().mockResponse('<attempt_completion><result>test response</result></attempt_completion>')
			const agent = new Agent(validConfigWithProvider)
			await agent.initialize()

			await agent.task(validTaskInput)
			const call = mockProvider.getCall(0)!
			
			// Verify tool list content
			expect(call.systemPrompt).toContain("TOOL_LIST")
			expect(call.systemPrompt).toContain("mock_tool") // From mockTool
			expect(call.systemPrompt).toContain("mock_tool_init") // From mockToolWithInit
			expect(call.systemPrompt).toContain("attempt_completion") // From attemptCompletionTool
		})

		it("should stream content between result tags immediately using a native async buffer", async () => {
			const agent = new Agent(validConfigWithProvider)
			await agent.initialize()

			// Mock a single response that will be split into chunks by the provider
			mockProvider.clearResponses()
				.mockResponse("<thinking>Processing your request...</thinking><attempt_completion><result>Here is the streamed content that will be split into chunks automatically by the mock provider</result></attempt_completion>");

			const streamingInput: TaskInput & { stream: true } = {
				role: "user",
				content: "test streaming task",
				stream: true
			}

			// Execute streaming task
			const streamResult = await agent.task(streamingInput)

			// Collect the streamed results
			const receivedChunks: string[] = []
			for await (const chunk of streamResult) {
				receivedChunks.push(chunk as string)
			}

			// Verify we get enough chunks to demonstrate streaming
			expect(receivedChunks.length).toBeGreaterThanOrEqual(10);

			// Combine chunks and verify the complete content
			const fullContent = receivedChunks.join('');
			expect(fullContent).toBe(
				"Here is the streamed content that will be split into chunks automatically by the mock provider"
			);

			// Verify no closing tags are included
			expect(fullContent).not.toContain('</result>');
			expect(fullContent).not.toContain('</attempt_completion>');

			// Verify the correct message was sent
			const call = mockProvider.getCall(0)!
			expect(call.messages[0].content).toEqual('<task>test streaming task</task>')
		})

		it("should throw error when trying to use output schema with streaming", async () => {
			const agent = new Agent(validConfigWithProvider)
			await agent.initialize()

			const streamingInput: TaskInput & { stream: true } = {
				role: "user",
				content: "test task",
				stream: true,
				outputSchema: z.object({ result: z.string() })
			}

			await expect(agent.task(streamingInput)).rejects.toThrow(
				"Output schemas are not supported with streaming responses"
			)
		})

		it('with a slightly more complex schema', async () => {
			mockProvider.clearResponses().mockResponse('<attempt_completion><result>{"foo": 123}</result></attempt_completion>')
			const agent = new Agent(validConfigWithProvider)
			const outputSchema = z.object({
				foo: z.number(),
			})

			await agent.initialize()
			const result = await agent.task({ ...validTaskInput, outputSchema })
			expect(result).toEqual({ foo: 123 })

			const call = mockProvider.getCall(0)!
			expect(call.messages[0].content).toEqual('<task>test task</task><output_schema>{"foo": z.number()}</output_schema>')
		})
	})
})
