import { z } from "zod"
import { Agent } from "../../agent"
import { Task } from "../../task"
import { TaskTestGenerator, createTaskTestGenerator } from "../task-test-generator"
import { TestCaseResult } from "../llm-test-generator"

// Mock the LLMTestCaseGenerator
jest.mock("../llm-test-generator", () => {
	return {
		LLMTestCaseGenerator: jest.fn().mockImplementation(() => {
			return {
				generateTestCases: jest.fn().mockResolvedValue([
					{
						metadata: {
							description: "Test case 1",
							tags: ["test"],
							priority: "medium",
							category: "general",
							generated_at: new Date(),
						},
						input: { value: "test input" },
						expected_output: {
							success: true,
							output: { result: "test output" },
						},
					},
				]),
				generateEdgeCases: jest.fn().mockResolvedValue([
					{
						input: { value: "edge input" },
						expected_output: {
							success: true,
							output: { result: "edge output" },
						},
					},
				]),
				generateBoundaryTests: jest.fn().mockResolvedValue([
					{
						input: { value: "boundary input" },
						expected_output: {
							success: true,
							output: { result: "boundary output" },
						},
					},
				]),
			}
		}),
		TestCaseResult: jest.fn(),
	}
})

// Mock agent
const mockAgent = {
	name: "Test Agent",
	description: "Test agent for testing",
	role: "Test role",
	task: jest.fn(),
} as unknown as Agent

// Test schemas
const inputSchema = z.object({
	value: z.string(),
})

const outputSchema = z.object({
	result: z.string(),
})

// Sample task without output schema
const taskWithoutOutputSchema = new Task({
	name: "Test Task",
	description: "A task for testing",
	agent: mockAgent,
	inputSchema,
	task: (input) => `Test task prompt with input: ${JSON.stringify(input)}`,
})

// Sample task with output schema
const taskWithOutputSchema = new Task({
	name: "Test Task With Schema",
	description: "A task for testing with output schema",
	agent: mockAgent,
	inputSchema,
	outputSchema,
	task: (input) => `Test task prompt with input: ${JSON.stringify(input)}`,
})

describe("TaskTestGenerator", () => {
	let generator: TaskTestGenerator

	beforeEach(() => {
		jest.clearAllMocks()
		generator = createTaskTestGenerator({
			agent: mockAgent,
		})
	})

	describe("generateTestCasesForTask", () => {
		it("should generate test cases for a task without output schema when provided in options", async () => {
			const result = await generator.generateTestCasesForTask(taskWithoutOutputSchema, {
				outputSchema,
				count: 1,
			})

			expect(result).toHaveLength(1)
			expect(result[0].input).toEqual({ value: "test input" })
			expect(result[0].expected_output.output).toEqual({ result: "test output" })
		})

		it("should generate test cases for a task with output schema without requiring it in options", async () => {
			const result = await generator.generateTestCasesForTask(taskWithOutputSchema, {
				count: 1,
			})

			expect(result).toHaveLength(1)
			expect(result[0].input).toEqual({ value: "test input" })
			expect(result[0].expected_output.output).toEqual({ result: "test output" })
		})

		it("should throw an error if no output schema is available", async () => {
			await expect(
				generator.generateTestCasesForTask(taskWithoutOutputSchema, {
					count: 1,
				})
			).rejects.toThrow("Output schema is required")
		})
	})

	describe("generateTestCasesForTaskConfig", () => {
		it("should generate test cases for a task config without output schema when provided in options", async () => {
			const result = await generator.generateTestCasesForTaskConfig(
				{
					name: "Test Task Config",
					description: "A task config for testing",
					agent: mockAgent,
					inputSchema,
					task: (input) => `Test task config prompt with input: ${JSON.stringify(input)}`,
				},
				{
					outputSchema,
					count: 1,
				}
			)

			expect(result).toHaveLength(1)
			expect(result[0].input).toEqual({ value: "test input" })
			expect(result[0].expected_output.output).toEqual({ result: "test output" })
		})

		it("should generate test cases for a task config with output schema", async () => {
			const result = await generator.generateTestCasesForTaskConfig(
				{
					name: "Test Task Config With Schema",
					description: "A task config for testing with output schema",
					agent: mockAgent,
					inputSchema,
					outputSchema,
					task: (input) => `Test task config prompt with input: ${JSON.stringify(input)}`,
				},
				{
					count: 1,
				}
			)

			expect(result).toHaveLength(1)
			expect(result[0].input).toEqual({ value: "test input" })
			expect(result[0].expected_output.output).toEqual({ result: "test output" })
		})
	})
})
