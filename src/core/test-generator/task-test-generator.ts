import { z } from "zod"
import { Agent } from "../agent"
import { Task, TaskConfig } from "../task"
import { TestGeneratorOptions } from "./types"
import { LLMTestCaseGenerator, TestCaseResult } from "./llm-test-generator"
import { LanguageModelV1 } from "ai"
import { createDefaultTaskTestGeneratorAgent } from "./default-agents"
/**
 * Options for generating task test cases
 */
export interface TaskTestGeneratorOptions<TInput, TOutput> extends TestGeneratorOptions<TInput, TOutput> {
	/**
	 * Output schema for the task
	 * Required for test case generation if the task doesn't have an output schema
	 */
	outputSchema?: z.ZodType<TOutput>

	/**
	 * Sample test cases to use as templates for generating more test cases
	 * These will be used to guide the generation of similar test cases
	 */
	samples?: Array<{
		input: TInput
		expected_output: TOutput
		description?: string // Optional description of what this sample test case demonstrates
	}>

	/**
	 * Number of test cases to generate
	 * @default 5
	 */
	count?: number
}

/**
 * Helper for generating test cases for tasks based on task metadata and schema
 */
export class TaskTestGenerator {
	/**
	 * Creates a new TaskTestGenerator
	 *
	 * @param agent The agent to use for test generation
	 */
	constructor(private readonly agent: Agent) {}

	/**
	 * Generate test cases for a task based on its metadata and schema
	 *
	 * @param task The task to generate test cases for
	 * @param options Options for test case generation
	 * @returns Generated test cases
	 */
	async generateTestCasesForTask<TInput, TOutput>(
		task: Task<TInput, TOutput>,
		options: TaskTestGeneratorOptions<TInput, TOutput> = {}
	): Promise<
		Array<{
			input: TInput
			expected_output: TestCaseResult<TOutput>
		}>
	> {
		const inputSchema = task.inputSchema
		const outputSchema = task.outputSchema || options.outputSchema

		if (!outputSchema) {
			throw new Error(
				"Output schema is required for test case generation. Either provide it in options or use a task with an output schema."
			)
		}

		// Create a test case generator
		const generator = new LLMTestCaseGenerator<TInput, TOutput>(
			inputSchema,
			outputSchema,
			this.agent,
			this.enhanceOptionsWithTaskMetadata(task, options)
		)

		// Generate test cases
		return generator.generateTestCases({
			count: options.count ?? 5,
			templates: options.samples
				? {
						inputTemplates: options.samples.map((s) => s.input),
						outputTemplates: options.samples.map((s) => s.expected_output),
				  }
				: undefined,
		})
	}

	/**
	 * Generate test cases for a task configuration
	 *
	 * @param taskConfig The task configuration to generate test cases for
	 * @param options Options for test case generation
	 * @returns Generated test cases
	 */
	async generateTestCasesForTaskConfig<TInput, TOutput>(
		taskConfig: TaskConfig<TInput, TOutput>,
		options: TaskTestGeneratorOptions<TInput, TOutput>
	): Promise<
		Array<{
			input: TInput
			expected_output: TestCaseResult<TOutput>
		}>
	> {
		// Create a temporary task instance
		const task = new Task<TInput, TOutput>({
			...taskConfig,
			// Use the output schema from taskConfig if available, otherwise from options
			outputSchema: taskConfig.outputSchema || options.outputSchema,
		})

		return this.generateTestCasesForTask(task, options)
	}

	/**
	 * Enhance test generator options with task metadata
	 */
	private enhanceOptionsWithTaskMetadata<TInput, TOutput>(
		task: Task<TInput, TOutput>,
		options: TaskTestGeneratorOptions<TInput, TOutput>
	): TestGeneratorOptions<TInput, TOutput> {
		const { name, description } = task.getInfo()
		const role = (task as any).agent?.role || "Unknown role"

		// Format sample test cases if provided
		const samplesPrompt = options.samples ? this.formatSamplesPrompt(options.samples) : ""

		// Create enhanced options with task-specific prompts
		return {
			...options,
			prompts: {
				testCaseGeneration: this.buildTaskTestCasePrompt(
					name,
					description,
					role,
					samplesPrompt,
					options.prompts?.testCaseGeneration
				),
				edgeCaseGeneration: this.buildTaskEdgeCasePrompt(
					name,
					description,
					role,
					samplesPrompt,
					options.prompts?.edgeCaseGeneration
				),
				boundaryTestGeneration: this.buildTaskBoundaryTestPrompt(
					name,
					description,
					role,
					samplesPrompt,
					options.prompts?.boundaryTestGeneration
				),
			},
		}
	}

	/**
	 * Format sample test cases into a prompt section
	 */
	private formatSamplesPrompt<TInput, TOutput>(
		samples: Array<{
			input: TInput
			expected_output: TOutput
			description?: string
		}>
	): string {
		if (!samples.length) {
			return ""
		}

		const formattedSamples = samples
			.map((sample, index) => {
				const description = sample.description ? `Description: ${sample.description}\n` : ""

				// Format the expected output to match our new structure
				const wrappedOutput = {
					success: true, // Assume samples are successful test cases
					output: sample.expected_output,
				}

				return `Sample Test Case ${index + 1}:
${description}Input:
${JSON.stringify(sample.input, null, 2)}

Expected Output:
${JSON.stringify(wrappedOutput, null, 2)}
`
			})
			.join("\n\n")

		return `
Sample Test Cases:
The following test cases are provided as examples. Generate additional test cases that follow similar patterns and cover different scenarios.

${formattedSamples}
`
	}

	/**
	 * Build a prompt for generating test cases based on task metadata
	 */
	private buildTaskTestCasePrompt(
		taskName: string,
		taskDescription: string,
		agentRole: string,
		samplesPrompt: string,
		customPrompt?: string
	): string {
		return `
You are generating test cases for a task with the following metadata:
- Task Name: ${taskName}
- Task Description: ${taskDescription}
- Agent Role: ${agentRole}

${samplesPrompt}

${customPrompt || "Generate realistic and diverse test cases that cover various scenarios for this task."}

Each test case should include:
1. A descriptive metadata section with tags relevant to the test case
2. Valid input that follows the input schema
3. Expected output that follows the output schema and correctly represents what the task should produce for the given input

For the expected output, include:
- Whether the test case should succeed (success: true) or fail (success: false)
- The actual output value that matches the output schema
- If the test case should fail, include a failure reason explaining why

Make sure the test cases are realistic, diverse, and cover different aspects of the task functionality.
Include both successful test cases and test cases that should fail due to various reasons.
`.trim()
	}

	/**
	 * Build a prompt for generating edge cases based on task metadata
	 */
	private buildTaskEdgeCasePrompt(
		taskName: string,
		taskDescription: string,
		agentRole: string,
		samplesPrompt: string,
		customPrompt?: string
	): string {
		return `
You are generating edge cases for a task with the following metadata:
- Task Name: ${taskName}
- Task Description: ${taskDescription}
- Agent Role: ${agentRole}

${samplesPrompt}

${customPrompt || "Generate edge cases that test the boundaries and unusual inputs for this task."}

Focus on inputs that:
- Contain minimal or maximal values
- Include unusual combinations of values
- Test error handling and edge conditions
- Challenge the task's assumptions

Each edge case should include:
1. Valid or intentionally invalid input
2. Expected output with:
   - success: true/false indicating if the test should pass or fail
   - output: the actual output value that matches the output schema
   - failure_reason: if success is false, explain why the test should fail
`.trim()
	}

	/**
	 * Build a prompt for generating boundary tests based on task metadata
	 */
	private buildTaskBoundaryTestPrompt(
		taskName: string,
		taskDescription: string,
		agentRole: string,
		samplesPrompt: string,
		customPrompt?: string
	): string {
		return `
You are generating boundary tests for a task with the following metadata:
- Task Name: ${taskName}
- Task Description: ${taskDescription}
- Agent Role: ${agentRole}

${samplesPrompt}

${customPrompt || "Generate boundary tests that focus on the limits of valid inputs for this task."}

Focus on inputs that:
- Test exactly at the boundaries of valid input ranges
- Test just inside and just outside valid boundaries
- Verify behavior at transition points
- Test minimum and maximum allowed values

Each boundary test should include:
1. Input at or near boundaries of valid ranges
2. Expected output with:
   - success: true/false indicating if the test should pass or fail
   - output: the actual output value that matches the output schema
   - failure_reason: if success is false, explain why the test should fail
`.trim()
	}
}

/**
 * Create a new TaskTestGenerator
 *
 * @param agent The agent to use for test generation
 * @returns A new TaskTestGenerator instance
 */
export function createTaskTestGenerator(
	options?:
		| {
				agent: Agent
		  }
		| {
				model?: LanguageModelV1 | Promise<LanguageModelV1>
		  }
): TaskTestGenerator {
	if (options && "agent" in options) {
		return new TaskTestGenerator(options.agent)
	}
	let agent: Agent
	if (options && "model" in options) {
		// Create a default task test generator agent
		agent = createDefaultTaskTestGeneratorAgent(options?.model)
	} else {
		// Create a default task test generator agent
		agent = createDefaultTaskTestGeneratorAgent()
	}
	return new TaskTestGenerator(agent)
}
