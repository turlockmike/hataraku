import { z } from "zod"
import { TestCaseResult } from "./llm-test-generator"

export interface TestGeneratorOptions<TInput, TOutput> {
	prompts?: {
		testCaseGeneration?: string
		edgeCaseGeneration?: string
		boundaryTestGeneration?: string
	}
	validation?: {
		validateInput?: (input: TInput) => Promise<boolean>
		validateOutput?: (input: TInput, output: TOutput) => Promise<boolean>
	}
}

export interface TestCaseGenerator<TInput, TOutput> {
	readonly inputSchema: z.ZodType<TInput>
	readonly outputSchema: z.ZodType<TOutput>

	generateTestCases(options: {
		count: number
		seed?: string
		templates?: {
			inputTemplates?: Partial<TInput>[]
			outputTemplates?: Partial<TOutput>[]
		}
	}): Promise<
		Array<{
			input: TInput
			expected_output: TestCaseResult<TOutput>
		}>
	>

	generateEdgeCases(): Promise<
		Array<{
			input: TInput
			expected_output: TestCaseResult<TOutput>
		}>
	>

	generateBoundaryTests(): Promise<
		Array<{
			input: TInput
			expected_output: TestCaseResult<TOutput>
		}>
	>
}
