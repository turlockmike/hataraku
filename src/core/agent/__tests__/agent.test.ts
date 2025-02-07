import { Agent } from ".."
import { AgentConfig, TaskInput } from "../types/config"
import { Thread } from "../../thread/thread"
import { z } from "zod"
import { MockProvider, MockTool } from "../../../lib/testing"
import { ModelProvider } from "../../../api"
import { HatarakuTool, AgentStep } from "../../../lib/types"
import os from "os"
import process from "node:process"
import { createAsyncStream } from "../../../utils/async"
import { AttemptCompletionTool } from "../../../lib/tools/attempt-completion"

describe("Agent", () => {
	let mockProvider: MockProvider
	let mockTool: MockTool
	let mockToolWithInit: MockTool
	let validConfigWithProvider: AgentConfig
	let validConfigWithModelConfig: AgentConfig
	let mathAddTool: HatarakuTool
	let multiplyTool: HatarakuTool

	beforeEach(() => {
		mockProvider = new MockProvider()
		mockTool = MockTool.createBasic("mock_tool")
		mockToolWithInit = MockTool.createBasic("mock_tool_init")
		mockToolWithInit.setInitialize(async () => {
			/* mock initialization */
		})

		// Initialize math add tool
		mathAddTool = {
			name: "math_add",
			description: "Add two numbers together",
			inputSchema: {
				type: "object",
				properties: {
					a: { type: "number", description: "The first number to add" },
					b: { type: "number", description: "The second number to add" },
				},
				required: ["a", "b"],
				additionalProperties: false,
			},
			execute: async (params: { a: number; b: number }) => {
				return {
					content: [
						{
							type: "text",
							text: `The result is ${params.a + params.b}`,
						},
					],
				}
			},
		}

		// Initialize multiply tool
		multiplyTool = {
			name: "multiply",
			description: "Multiply two numbers",
			inputSchema: {
				type: "object",
				properties: {
					a: { type: "number", description: "The first number" },
					b: { type: "number", description: "The second number" },
				},
				required: ["a", "b"],
				additionalProperties: false,
			},
			execute: async (params: { a: number; b: number }) => {
				return {
					content: [
						{
							type: "text",
							text: `The result is ${params.a * params.b}`,
						},
					],
				}
			},
		}

		validConfigWithProvider = {
			name: "test-agent",
			model: mockProvider as ModelProvider,
			tools: [mockTool, mockToolWithInit, mathAddTool, multiplyTool],
			role: "You are Hataraku, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
			customInstructions: "You should always speak and think in the English language.",
		}

		validConfigWithModelConfig = {
			name: "test-agent",
			model: {
				apiProvider: "anthropic",
				apiModelId: "claude-3-5-sonnet-20241022",
			},
			tools: [mockTool, mockToolWithInit, mathAddTool, multiplyTool],
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
			agent.initialize()
			expect(agent.getLoadedTools()).toContain("mock_tool")
			expect(agent.getLoadedTools()).toContain("mock_tool_init")
			expect(mockToolWithInit.getInitializeCallCount()).toBe(1)
		})

		it("should initialize successfully with ModelConfiguration", async () => {
			const agent = new Agent(validConfigWithModelConfig)
			agent.initialize()
			expect(agent.getLoadedTools()).toContain("mock_tool")
			expect(agent.getLoadedTools()).toContain("mock_tool_init")
			expect(mockToolWithInit.getInitializeCallCount()).toBe(1)
		})

		it("should only initialize once", async () => {
			const agent = new Agent(validConfigWithProvider)
			agent.initialize()
			agent.initialize()
			expect(agent.getLoadedTools()).toContain("mock_tool")
			expect(mockToolWithInit.getInitializeCallCount()).toBe(1)
		})
	})

	describe("task", () => {
		beforeEach(() => {
			// Mock the cwd and the os.homedir() for snapshot testing
			jest.spyOn(os, "homedir").mockReturnValue("/test/home")
			jest.spyOn(process, "cwd").mockReturnValue("/test/cwd")
			jest.spyOn(os, "platform").mockReturnValue("linux")
		})

		afterEach(() => {
			jest.restoreAllMocks()
		})

		it("should include role and custom instructions in system prompt", async () => {
			mockProvider.clearResponses().mockResponse("<attempt_completion>test response</attempt_completion>")
			const agent = new Agent(validConfigWithProvider)
			agent.initialize()

			await agent.task(validTaskInput)
			const call = mockProvider.getCall(0)!
			expect(call).toBeTruthy()

			// Verify system prompt content
			expect(call.systemPrompt).toMatchSnapshot()
		})

		it("should execute task successfully", async () => {
			mockProvider.clearResponses().mockResponse("<attempt_completion>test response</attempt_completion>")
			const agent = new Agent(validConfigWithProvider)

			const { content } = await agent.task(validTaskInput)
			expect(content).toBe("test response")
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
			mockProvider.clearResponses().mockResponse("<attempt_completion>test response</attempt_completion>")
			const agent = new Agent(validConfigWithProvider)
			agent.initialize()

			const streamingInput: TaskInput & { stream: true } = {
				role: "user",
				content: "test task",
				stream: true,
			}

			const result = await agent.task(streamingInput)
			expect(result.stream).toBeDefined()

			// Consume the stream to prevent timeout
			const chunks: string[] = []
			for await (const chunk of result.stream) {
				chunks.push(chunk)
			}

			const content = await result.content
			const metadata = await result.metadata
			expect(content).toBe("test response")
			expect(chunks.join("")).toBe("test response")

			expect(metadata).toEqual({
				errors: undefined,
				taskId: expect.any(String),
				input: expect.any(String),
				toolCalls: [
					{
						name: "attempt_completion",
						params: {
							content: expect.any(String),
						},
					},
				],
				usage: {
					cacheReads: 0,
					cacheWrites: 0,
					cost: 0,
					tokensIn: 0,
					tokensOut: 54,
				},
			})
		})

		it("should handle task with thread context", async () => {
			mockProvider.clearResponses().mockResponse("<attempt_completion>test response</attempt_completion>")
			const agent = new Agent(validConfigWithProvider)
			const thread = new Thread()
			thread.addContext("test", "test", { metadata: "test" })

			agent.initialize()
			const { content } = await agent.task({ ...validTaskInput, thread })
			expect(content).toBe("test response")

			const call = mockProvider.getCall(0)!
			expect(call.messages).toHaveLength(2) // Context message + task message
			expect(call.messages[0].content).toContain("test") // Context included
		})

		it("should handle task with output schema", async () => {
			mockProvider.clearResponses().mockResponse('<attempt_completion>{"foo": "bar"}</attempt_completion>')
			const agent = new Agent(validConfigWithProvider)
			const outputSchema = z.object({
				foo: z.string(),
			})

			agent.initialize()
			const { content } = await agent.task({ ...validTaskInput, outputSchema })
			expect(content).toEqual({ foo: "bar" })
		})

		it("should throw error for invalid output schema", async () => {
			mockProvider.clearResponses().mockResponse("some response without attempt_completion tag")
			const agent = new Agent(validConfigWithProvider)
			agent.initialize()
			await expect(agent.task(validTaskInput)).rejects.toThrow("No attempt_completion tag found in response")
		})

		it("should handle model errors", async () => {
			mockProvider.clearResponses().mockError("Model error")
			const agent = new Agent(validConfigWithProvider)

			await expect(agent.task(validTaskInput)).rejects.toThrow("No attempt_completion tag found in response")
		})

		it("if no tools are found, it should throw an error", async () => {
			mockProvider.clearResponses().mockResponse("<not_a_tool><content>not a tool</content></not_a_tool>")

			const agent = new Agent(validConfigWithProvider)
			agent.initialize()

			await expect(agent.task(validTaskInput)).rejects.toThrow("Tool 'not_a_tool' not found")
		})

		it("should include schema validation instructions in system prompt when output schema is provided", async () => {
			mockProvider
				.clearResponses()
				.mockResponse('<attempt_completion>{"result":"test value"}</attempt_completion>')
			const agent = new Agent(validConfigWithProvider)
			const outputSchema = z.object({
				result: z.string(),
			})

			const { content } = await agent.task({ ...validTaskInput, outputSchema })
			expect(content).toEqual({ result: "test value" })

			const call = mockProvider.getCall(0)!
			expect(call.systemPrompt).toContain("Schema Validation and Output Formatting")
			expect(call.systemPrompt).toContain("Your response must be valid JSON that matches the schema exactly")
			expect(call.systemPrompt).toContain(
				"Do not include any additional text, explanations, or formatting around the JSON"
			)
			expect(call.systemPrompt).toContain("Ensure all required fields specified in the schema are present")
			expect(call.systemPrompt).toContain("Only include fields that are defined in the schema")
			expect(call.systemPrompt).toContain("Use the correct data types for each field as specified in the schema")
			expect(call.systemPrompt).toContain(
				"For streaming responses, each chunk must be valid JSON that matches the schema"
			)
			expect(call.systemPrompt).toContain(
				"You will be given a task in a <task></task> tag. You will also be optionally given an output schema in a <output_schema></output_schema> tag."
			)
			expect(call.systemPrompt).toContain(
				"When calling attempt_completion, ensure the result is valid JSON that matches the schema"
			)
		})

		it("should include tool list in system prompt", async () => {
			mockProvider.clearResponses().mockResponse("<attempt_completion>test response</attempt_completion>")
			const agent = new Agent(validConfigWithProvider)
			agent.initialize()

			await (
				await agent.task(validTaskInput)
			).content
			const call = mockProvider.getCall(0)!

			// Verify tool list content
			expect(call.systemPrompt).toContain("TOOL_LIST")
			expect(call.systemPrompt).toContain("mock_tool") // From mockTool
			expect(call.systemPrompt).toContain("mock_tool_init") // From mockToolWithInit
			expect(call.systemPrompt).toContain("attempt_completion") // From attemptCompletionTool
		})

		it("should stream content between result tags immediately using a native async buffer", async () => {
			const agent = new Agent(validConfigWithProvider)
			agent.initialize()

			// Mock a single response that will be split into chunks by the provider
			mockProvider
				.clearResponses()
				.mockResponse(
					"<thinking>Processing your request...</thinking><attempt_completion>Here is the streamed content</attempt_completion>"
				)

			const streamingInput: TaskInput & { stream: true } = {
				role: "user",
				content: "test streaming task",
				stream: true,
			}

			// Execute streaming task (synchronous)
			const result = await agent.task(streamingInput)
			expect(result.stream).toBeDefined()

			// Verify the streaming content (asynchronous)
			const receivedChunks: string[] = []
			for await (const chunk of result.stream) {
				receivedChunks.push(chunk)
			}

			expect(receivedChunks.join("")).toBe("Here is the streamed content")

			// Also verify the final content
			const content = await result.content
			expect(content).toBe("Here is the streamed content")

			// Verify we got chunks for streaming
			expect(receivedChunks.length).toBeGreaterThanOrEqual(1)

			// Verify the correct message was sent
			const call = mockProvider.getCall(0)!
			expect(call.messages[0].content).toEqual("<task>test streaming task</task>")
		})

		it("should throw error when trying to use output schema with streaming", async () => {
			const agent = new Agent(validConfigWithProvider)
			agent.initialize()

			const streamingInput = {
				role: "user",
				content: "test task",
				stream: true as const,
				outputSchema: z.object({ result: z.string() }),
			} as TaskInput<{ result: string }> & { stream: true }

			const promise = agent.task(streamingInput)
			await expect(promise).rejects.toThrow("Output schemas are not supported with streaming responses")
		})

		it("with a slightly more complex schema", async () => {
			mockProvider.clearResponses().mockResponse('<attempt_completion>{"foo": 123}</attempt_completion>')
			const agent = new Agent(validConfigWithProvider)
			const outputSchema = z.object({
				foo: z.number(),
			})

			agent.initialize()
			const { content } = await agent.task({ ...validTaskInput, outputSchema })
			expect(content).toEqual({ foo: 123 })

			const call = mockProvider.getCall(0)!
			expect(call.messages[0].content).toEqual(
				'<task>test task</task><output_schema>{"foo": z.number()}</output_schema>'
			)
		})

		describe("thread management", () => {
			it("should create a new thread for each task by default", async () => {
				mockProvider
					.clearResponses()
					.mockResponse("<attempt_completion>response 1</attempt_completion>")
					.mockResponse("<attempt_completion>response 2</attempt_completion>")

				const agent = new Agent(validConfigWithProvider)
				agent.initialize()

				// Execute two tasks
				await agent.task(validTaskInput)
				await agent.task(validTaskInput)

				// Each task should have created a new thread (no message history)
				const firstCall = mockProvider.getCall(0)!
				const secondCall = mockProvider.getCall(1)!
				expect(firstCall.messages).toHaveLength(1)
				expect(secondCall.messages).toHaveLength(1)
			})

			it("should allow reusing a thread across multiple tasks", async () => {
				mockProvider
					.clearResponses()
					.mockResponse("<attempt_completion>response 1</attempt_completion>")
					.mockResponse("<attempt_completion>response 2</attempt_completion>")

				const agent = new Agent(validConfigWithProvider)
				agent.initialize()

				// Create a custom thread
				const thread = new Thread()

				// Execute two tasks with the same thread
				const { content: content1 } = await agent.task({ ...validTaskInput, thread })
				expect(thread.getMessages()).toHaveLength(2)
				expect(thread.getMessages()[0].content).toEqual("<task>test task</task>")
				expect(thread.getMessages()[1].content).toEqual("response 1")

				// Execute second task with the same thread
				const { content: content2 } = await agent.task({ ...validTaskInput, thread })
				expect(thread.getMessages()).toHaveLength(4)
				expect(thread.getMessages()[0].content).toEqual("<task>test task</task>")
				expect(thread.getMessages()[1].content).toEqual("response 1")
				expect(thread.getMessages()[2].content).toEqual("<task>test task</task>")
				expect(thread.getMessages()[3].content).toEqual("response 2")

				// Second task should include history from first task
				const firstCall = mockProvider.getCall(0)!
				const secondCall = mockProvider.getCall(1)!
				expect(secondCall.messages).toHaveLength(3)
				expect(secondCall.messages[0].content).toEqual("<task>test task</task>")
				expect(secondCall.messages[1].content).toEqual("response 1")
				expect(secondCall.messages[2].content).toEqual("<task>test task</task>")
			})

			it("should preserve context between tasks using the same thread", async () => {
				mockProvider
					.clearResponses()
					.mockResponse("<attempt_completion>response 1</attempt_completion>")
					.mockResponse("<attempt_completion>response 2</attempt_completion>")

				const agent = new Agent(validConfigWithProvider)
				agent.initialize()

				const thread = new Thread()
				thread.addContext("testKey", { value: "test" })

				// Execute tasks with the thread
				await agent.task({ ...validTaskInput, thread })
				await agent.task({ ...validTaskInput, thread })

				// Both calls should include the context
				const firstCall = mockProvider.getCall(0)!
				const secondCall = mockProvider.getCall(1)!
				expect(firstCall.messages[0].content).toContain("testKey")
				expect(secondCall.messages[0].content).toContain("testKey")
			})

			it("should not modify the original thread when creating a default thread", async () => {
				mockProvider.clearResponses().mockResponse("<attempt_completion>test response</attempt_completion>")

				const agent = new Agent(validConfigWithProvider)
				agent.initialize()

				// Execute task without a thread
				const { content } = await agent.task(validTaskInput)

				// Create a new thread and verify it's empty
				const newThread = new Thread()
				expect(newThread.getMessages()).toHaveLength(0)
				expect(Array.from(newThread.getAllContexts().entries())).toHaveLength(0)
			})
		})

		it("should execute math_add tool and include result in response", async () => {
			mockProvider.clearResponses().mockResponse(`
				<thinking>Let me calculate that for you</thinking>
				<math_add><a>5</a><b>3</b></math_add>
				<attempt_completion>The result is 8</attempt_completion>
			`)

			const agent = new Agent(validConfigWithProvider)
			// agent.initialize();

			const { content, metadata } = await agent.task(validTaskInput)

			// Verify the final content
			expect(content).toBe("The result is 8")

			// Verify tool execution
			expect(metadata.toolCalls).toHaveLength(3)
			expect(metadata.toolCalls[0].name).toEqual("thinking")
			expect(metadata.toolCalls[1]).toMatchObject({
				name: "math_add",
				params: { a: "5", b: "3" },
				result: [
					{
						text: "The result is 8",
						type: "text",
					},
				],
			})
			expect(metadata.toolCalls[2].name).toEqual("attempt_completion")
		})

		it("should handle math_add tool with string to number conversion", async () => {
			mockProvider.clearResponses().mockResponse(`
				<thinking>Processing calculation</thinking>
				<math_add><a>10.5</a><b>2.3</b></math_add>
				<attempt_completion>The result is 12.8</attempt_completion>
			`)

			const agent = new Agent(validConfigWithProvider)
			agent.initialize()

			const { content, metadata } = await agent.task(validTaskInput)

			// Verify tool execution with floating point numbers
			expect(metadata.toolCalls[1]).toMatchObject({
				name: "math_add",
				params: { a: "10.5", b: "2.3" },
				result: [
					{
						text: "The result is 12.8",
						type: "text",
					},
				],
			})
		})

		it("should handle math_add tool errors gracefully", async () => {
			mockProvider.clearResponses().mockResponse(`
				<thinking>Attempting calculation</thinking>
				<math_add><a>invalid</a><b>3</b></math_add>
				<attempt_completion>Failed to calculate</attempt_completion>
			`)

			const agent = new Agent(validConfigWithProvider)
			agent.initialize()

			const { content, metadata } = await agent.task(validTaskInput)

			// Verify that the tool call was recorded but resulted in an error
			expect(metadata.toolCalls[1]).toMatchObject({
				name: "math_add",
				params: { a: "invalid", b: "3" },
				result: expect.any(Error),
			})
		})

		it("should handle streaming content in chunks", async () => {
			// Mock a response that will be streamed in chunks
			mockProvider
				.clearResponses()
				.mockStreamingResponse([
					"<thinking>Processing",
					" your request...</thinking>",
					"<attempt_completion>Streamed ",
					"result</attempt_completion>",
				])

			const agent = new Agent(validConfigWithProvider)
			agent.initialize()

			// Create streaming task input
			const taskInput = {
				role: "user" as const,
				content: "test task",
				stream: true as const,
			}

			// Execute task with streaming
			const result = await agent.task(taskInput)
			expect(result.stream).toBeDefined()

			// Collect the streamed chunks
			const streamedChunks: string[] = []
			for await (const chunk of result.stream) {
				streamedChunks.push(chunk)
			}

			// Get the final content and metadata
			const content = await result.content
			const metadata = await result.metadata

			// Verify the content
			expect(content).toBe("Streamed result")

			// Verify the streamed chunks
			expect(streamedChunks).toEqual(["Streamed ", "result"])

			// Verify metadata
			expect(metadata.toolCalls).toHaveLength(2)
			expect(metadata.toolCalls[0]).toMatchObject({
				name: "thinking",
				params: { content: "Processing your request..." },
			})
			expect(metadata.toolCalls[1]).toMatchObject({
				name: "attempt_completion",
				params: { content: "Streamed result" },
			})
		})

		it("should properly add tool results to thread history", async () => {
			mockProvider
				.clearResponses()
				.mockResponse("<multiply><a>5</a><b>3</b></multiply>")
				.mockResponse("<attempt_completion>The result is fifteen</attempt_completion>")

			const agent = new Agent({
				name: "test-agent",
				model: mockProvider,
				tools: [multiplyTool],
				role: "test role",
			})

			const thread = new Thread()
			const res = await agent.task({
				role: "user",
				content: "multiply 5 and 3",
				thread,
			})

			expect(res.content).toBe("The result is fifteen")

			// Verify the message sequence
			const calls = mockProvider.getCalls()
			expect(calls).toHaveLength(2)

			// First call - initial request
			expect(calls[0].messages).toHaveLength(1)
			expect(calls[0].messages[0]).toMatchObject({
				role: "user",
				content: "<task>multiply 5 and 3</task>",
			})

			// Second call - after tool execution
			expect(calls[1].messages).toHaveLength(2)
			expect(calls[1].messages[0]).toMatchObject({
				role: "user",
				content: "<task>multiply 5 and 3</task>",
			})
			expect(calls[1].messages[1]).toMatchObject({
				role: "assistant",
				content: "<multiply><a>5</a><b>3</b></multiply><tool_result>15</tool_result>",
			})
		})
	})

	describe("runStep", () => {
		let agent: Agent
		let mockProvider: MockProvider
		let mathAddTool: HatarakuTool

		beforeEach(() => {
			mockProvider = new MockProvider()
			mathAddTool = {
				name: "math_add",
				description: "Add two numbers together",
				inputSchema: {
					type: "object",
					properties: {
						a: { type: "number", description: "First number" },
						b: { type: "number", description: "Second number" },
					},
					required: ["a", "b"],
					additionalProperties: false,
				},
				execute: async (params: { a: number; b: number }) => {
					return {
						content: [
							{
								type: "text",
								text: `The result is ${params.a + params.b}`,
							},
						],
					}
				},
			}

			agent = new Agent({
				name: "test-agent",
				model: mockProvider,
				tools: [mathAddTool],
				role: "test role",
			})
			agent.initialize()
		})

		it("should process a simple thinking tag", async () => {
			mockProvider.clearResponses().mockResponse("<thinking>Processing request</thinking>")
			const modelStream = mockProvider.createMessage("", [])
			const tools = [mathAddTool]

			const step = await (agent as any).runStep(modelStream, tools)
			expect(step.thinking).toEqual([])
			expect(step.toolCalls).toHaveLength(1)
			expect(step.toolCalls[0]).toMatchObject({
				name: "thinking",
				content: "Processing request",
			})
		})

		it("should process a math_add tool call with result", async () => {
			mockProvider.clearResponses().mockResponse(`
				<thinking>Let me calculate that</thinking>
				<math_add><a>5</a><b>3</b></math_add>
			`)
			const modelStream = mockProvider.createMessage("", [])
			const tools = [mathAddTool]

			const step = await (agent as any).runStep(modelStream, tools)
			expect(step.toolCalls).toHaveLength(2)
			expect(step.toolCalls[0]).toMatchObject({
				name: "thinking",
				content: "Let me calculate that",
			})
			expect(step.toolCalls[1]).toMatchObject({
				name: "math_add",
				params: { a: "5", b: "3" },
				result: [
					{
						type: "text",
						text: "The result is 8",
					},
				],
			})
		})

		it("should handle attempt_completion and set completion", async () => {
			mockProvider.clearResponses().mockResponse(`
				<thinking>Processing</thinking>
				<attempt_completion>Final result</attempt_completion>
			`)
			const modelStream = mockProvider.createMessage("", [])
			const tools = [mathAddTool]

			const step = await (agent as any).runStep(modelStream, tools)
			expect(step.toolCalls).toHaveLength(2)
			expect(step.completion).toBe("Final result")
		})

		it("should accumulate usage metrics", async () => {
			// The response length will be used as outputTokens
			const response = "<thinking>test</thinking>"
			mockProvider.clearResponses().mockResponse(response)
			const modelStream = mockProvider.createMessage("", [])
			const tools = [mathAddTool]

			const step = await (agent as any).runStep(modelStream, tools)
			expect(step.metadata).toMatchObject({
				tokensIn: 0,
				tokensOut: response.length,
				cost: 0,
			})
		})

		it("should handle streaming content in chunks", async () => {
			// Create a stream to capture attempt_completion output
			const outputStream = createAsyncStream<string>()
			const attemptCompletionTool = new AttemptCompletionTool(outputStream)

			// Mock a response that will be streamed in chunks
			mockProvider
				.clearResponses()
				.mockStreamingResponse([
					"<thinking>Processing",
					" your request...</thinking>",
					"<attempt_completion>Streamed ",
					"result</attempt_completion>",
				])
			const modelStream = mockProvider.createMessage("", [])
			const tools = [mathAddTool, attemptCompletionTool]

			// Start processing the step
			const stepPromise = agent.runStep(modelStream, tools)

			// Collect the streamed chunks
			const streamedChunks: string[] = []
			for await (const chunk of outputStream) {
				streamedChunks.push(chunk)
			}

			const step = await stepPromise

			// Verify the step results
			expect(step.toolCalls).toHaveLength(2)
			expect(step.toolCalls[0]).toMatchObject({
				name: "thinking",
				content: "Processing your request...",
			})
			expect(step.completion).toBe("Streamed result")

			// Verify the streamed chunks
			expect(streamedChunks).toEqual(["Streamed ", "result"])
		})

		it("should handle streaming with interleaved tool calls", async () => {
			mockProvider
				.clearResponses()
				.mockStreamingResponse([
					"<thinking>First ",
					"step</thinking>",
					"<math_add><a>5</a><b>3</b></math_add>",
					"<thinking>Got ",
					"result</thinking>",
					"<attempt_completion>Final ",
					"answer</attempt_completion>",
				])
			const modelStream = mockProvider.createMessage("", [])
			const tools = [mathAddTool]

			const step = await (agent as any).runStep(modelStream, tools)
			expect(step.toolCalls).toHaveLength(4)
			expect(step.toolCalls[0]).toMatchObject({
				name: "thinking",
				content: "First step",
			})
			expect(step.toolCalls[1]).toMatchObject({
				name: "math_add",
				params: { a: "5", b: "3" },
				result: [
					{
						type: "text",
						text: "The result is 8",
					},
				],
			})
			expect(step.toolCalls[2]).toMatchObject({
				name: "thinking",
				content: "Got result",
			})
			expect(step.completion).toBe("Final answer")
		})
	})

	describe("runTask", () => {
		let agent: Agent
		let mockProvider: MockProvider
		let mathAddTool: HatarakuTool

		beforeEach(() => {
			mockProvider = new MockProvider()
			mathAddTool = {
				name: "math_add",
				description: "Add two numbers together",
				inputSchema: {
					type: "object",
					properties: {
						a: { type: "number", description: "First number" },
						b: { type: "number", description: "Second number" },
					},
					required: ["a", "b"],
					additionalProperties: false,
				},
				execute: async (params: { a: number; b: number }) => {
					return {
						content: [
							{
								type: "text",
								text: `The result is ${params.a + params.b}`,
							},
						],
					}
				},
			}

			agent = new Agent({
				name: "test-agent",
				model: mockProvider,
				tools: [mathAddTool],
				role: "test role",
			})
			agent.initialize()
		})

		it("should execute a basic task and yield steps", async () => {
			mockProvider.clearResponses().mockResponse(`
				<thinking>Processing</thinking>
				<attempt_completion>Final result</attempt_completion>
			`)

			const taskInput = { role: "user" as const, content: "test task" }
			const generator = agent.runTask(taskInput)

			const steps: AgentStep[] = []
			for await (const step of generator) {
				steps.push(step)
			}

			expect(steps).toHaveLength(1)
			expect(steps[0].toolCalls).toHaveLength(2)
			expect(steps[0].completion).toBe("Final result")
		})

		it("should handle multiple tool calls before completion", async () => {
			mockProvider.clearResponses().mockResponse(`
					<thinking>First step</thinking>
					<math_add><a>5</a><b>3</b></math_add>
				`).mockResponse(`
					<thinking>Got result</thinking>
					<attempt_completion>The result is 8</attempt_completion>
				`)

			const taskInput = { role: "user" as const, content: "test task" }
			const generator = agent.runTask(taskInput)

			const steps: AgentStep[] = []
			for await (const step of generator) {
				steps.push(step)
			}

			expect(steps).toHaveLength(2)
			expect(steps[0].toolCalls[1]).toMatchObject({
				name: "math_add",
				params: { a: "5", b: "3" },
				result: [
					{
						type: "text",
						text: "The result is 8",
					},
				],
			})
			expect(steps[1].completion).toBe("The result is 8")
		})

		it("should handle errors in tool execution", async () => {
			mockProvider.clearResponses().mockResponse(`
					<thinking>Processing</thinking>
					<math_add><a>invalid</a><b>3</b></math_add>
				`).mockResponse(`
					<thinking>Error occurred</thinking>
					<attempt_completion>Failed to calculate</attempt_completion>
				`)

			const taskInput = { role: "user" as const, content: "test task" }
			const generator = agent.runTask(taskInput)

			const steps: AgentStep[] = []
			for await (const step of generator) {
				steps.push(step)
			}

			expect(steps).toHaveLength(2)
			expect(steps[0].toolCalls[1].result).toBeInstanceOf(Error)
			expect(steps[1].completion).toBe("Failed to calculate")
		})

		it("should preserve thread context between steps", async () => {
			mockProvider.clearResponses().mockResponse(`
					<thinking>First step</thinking>
					<math_add><a>5</a><b>3</b></math_add>
				`).mockResponse(`
					<thinking>Got result</thinking>
					<attempt_completion>The result is 8</attempt_completion>
				`)

			const thread = new Thread()
			thread.addContext("test", "test context")
			const taskInput = { role: "user" as const, content: "test task", thread }
			const generator = agent.runTask(taskInput)

			const steps: AgentStep[] = []
			for await (const step of generator) {
				steps.push(step)
			}

			expect(thread.getMessages()).toHaveLength(3) // Initial context + 2 steps * 2 messages each + 1 tool call
			expect(thread.getMessages()).toEqual([
			  {
			    "content": "<task>test task</task>",
			    "role": "user",
			    "timestamp": expect.any(Date),
			  },
			  {
			    "content": "<math_add><a>5</a><b>3</b></math_add><tool_result>8</tool_result>",
			    "role": "assistant",
			    "timestamp": expect.any(Date),
			  },
			  {
			    "content": "The result is 8",
			    "role": "assistant",
			    "timestamp": expect.any(Date),
			  },
			])
			const context = thread.getAllContexts().get("test")
			expect(context?.value).toBe("test context")
		})

		it("should validate output against schema", async () => {
			mockProvider.clearResponses().mockResponse(`
				<thinking>Processing</thinking>
				<attempt_completion>{"result": "test"}</attempt_completion>
			`)

			const taskInput = {
				role: "user" as const,
				content: "test task",
				outputSchema: z.object({ result: z.string() }),
			}
			const generator = agent.runTask(taskInput)

			const steps: AgentStep[] = []
			for await (const step of generator) {
				steps.push(step)
				if (step.completion) {
					const result = JSON.parse(step.completion)
					expect(result).toEqual({ result: "test" })
				}
			}
		})

		it("should throw error for invalid schema output", async () => {
			mockProvider.clearResponses().mockResponse(`
				<thinking>Processing</thinking>
				<attempt_completion>{"wrong": "format"}</attempt_completion>
			`)

			const taskInput = {
				role: "user" as const,
				content: "test task",
				outputSchema: z.object({ result: z.string() }),
			}
			const generator = agent.runTask(taskInput)

			const steps: AgentStep[] = []
			await expect(async () => {
				for await (const step of generator) {
					steps.push(step)
				}
			}).rejects.toThrow()
		})

		it("should handle streaming content in chunks", async () => {
			// Mock a response that will be streamed in chunks across multiple steps
			mockProvider
				.clearResponses()
				.mockStreamingResponse([
					"<thinking>First step",
					" processing...</thinking>",
					"<math_add><a>5</a><b>3</b></math_add>",
					"<thinking>Got result: 8</thinking>",
				])
				.mockStreamingResponse([
					"<thinking>Second step",
					" calculating...</thinking>",
					"<math_add><a>8</a><b>2</b></math_add>",
					"<attempt_completion>Final answer: ",
					"10</attempt_completion>",
				])

			const taskInput = {
				role: "user" as const,
				content: "test task",
				stream: true as const,
			}

			// Create output stream to capture attempt_completion chunks
			const outputStream = createAsyncStream<string>()

			// Create and initialize agent
			const agent = new Agent({
				name: "test-agent",
				model: mockProvider,
				tools: [mathAddTool],
				role: "test role",
			})
			agent.initialize()

			// Execute task with runTask and collect steps
			const generator = agent.runTask(taskInput, outputStream)
			const steps: AgentStep[] = []

			// Collect streamed chunks in parallel with steps
			const streamedChunks: string[] = []
			const streamPromise = (async () => {
				for await (const chunk of outputStream) {
					streamedChunks.push(chunk)
				}
			})()

			// Collect steps
			for await (const step of generator) {
				steps.push(step)
			}

			// Wait for stream to complete
			await streamPromise

			// Verify the steps
			expect(steps).toHaveLength(2)

			// First step
			expect(steps[0].toolCalls).toHaveLength(3)
			expect(steps[0].toolCalls[0]).toMatchObject({
				name: "thinking",
				content: "First step processing...",
			})
			expect(steps[0].toolCalls[1]).toMatchObject({
				name: "math_add",
				params: { a: "5", b: "3" },
			})
			expect(steps[0].toolCalls[2]).toMatchObject({
				name: "thinking",
				content: "Got result: 8",
			})
			expect(steps[0].completion).toBeUndefined()

			// Second step
			expect(steps[1].toolCalls).toHaveLength(3)
			expect(steps[1].toolCalls[0]).toMatchObject({
				name: "thinking",
				content: "Second step calculating...",
			})
			expect(steps[1].toolCalls[1]).toMatchObject({
				name: "math_add",
				params: { a: "8", b: "2" },
			})
			expect(steps[1].toolCalls[2]).toMatchObject({
				name: "attempt_completion",
				content: "Final answer: 10",
			})
			expect(steps[1].completion).toBe("Final answer: 10")

			// Verify the streamed chunks
			expect(streamedChunks).toEqual(["Final answer: ", "10"])
		})

		it("should handle streaming with multiple steps", async () => {
			mockProvider
				.clearResponses()
				.mockStreamingResponse([
					"<thinking>First ",
					"calculation...</thinking>",
					"<math_add><a>5</a><b>3</b></math_add>",
				])
				.mockStreamingResponse([
					"<thinking>Second ",
					"calculation...</thinking>",
					"<math_add><a>8</a><b>2</b></math_add>",
					"<attempt_completion>Final result: ",
					"10</attempt_completion>",
				])

			const taskInput = { role: "user" as const, content: "test task" }
			const generator = agent.runTask(taskInput)

			const steps: AgentStep[] = []
			for await (const step of generator) {
				steps.push(step)
			}

			expect(steps).toHaveLength(2)
			// First step
			expect(steps[0].toolCalls).toHaveLength(2)
			expect(steps[0].toolCalls[0]).toMatchObject({
				name: "thinking",
				content: "First calculation...",
			})
			expect(steps[0].toolCalls[1]).toMatchObject({
				name: "math_add",
				params: { a: "5", b: "3" },
			})

			// Second step
			expect(steps[1].toolCalls).toHaveLength(3)
			expect(steps[1].toolCalls[0]).toMatchObject({
				name: "thinking",
				content: "Second calculation...",
			})
			expect(steps[1].toolCalls[1]).toMatchObject({
				name: "math_add",
				params: { a: "8", b: "2" },
			})
			expect(steps[1].completion).toBe("Final result: 10")
		})
	})
})
