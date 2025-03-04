import { z } from "zod"

export const TestCaseMetadataSchema = z.object({
	description: z.string(),
	tags: z.array(z.string()),
	priority: z.enum(["low", "medium", "high"]),
	category: z.string(),
	generated_at: z.coerce.date(),
})

export type TestCaseMetadata = z.infer<typeof TestCaseMetadataSchema>

export interface TestCaseGenerator<TInput, TOutput> {
	inputSchema: z.ZodType<TInput>
	outputSchema: z.ZodType<TOutput>

	generateTestCases(options: {
		count: number
		seed?: string
		templates?: {
			inputTemplates?: Partial<TInput>[]
			outputTemplates?: Partial<TOutput>[]
		}
	}): Promise<
		Array<{
			metadata: TestCaseMetadata
			input: TInput
			expected_output: TOutput
		}>
	>

	generateEdgeCases(): Promise<
		Array<{
			input: TInput
			expected_output: TOutput
		}>
	>

	generateBoundaryTests(): Promise<
		Array<{
			input: TInput
			expected_output: TOutput
		}>
	>
}

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
