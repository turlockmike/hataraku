import { z } from "zod"
import { Agent } from "../agent"
import { TestCaseGenerator, TestGeneratorOptions } from "./types"
import { zodToJsonSchema } from "zod-to-json-schema"
import { analyzeSchema } from "./schema-analyzer"

type GeneratedTestCase<TOutput> = {
	input: Record<string, any>
	expected_output: TOutput
	metadata?: {
		description: string
		tags: string[]
		priority: "low" | "medium" | "high"
		category: string
	}
}

/**
 * Represents the result of a test case, including whether it was successful
 * and details about any constraint violations or failures
 */
export type TestCaseResult<TOutput> = {
	success: boolean
	output: TOutput
	failure_reason?: string
	violated_constraints?: Array<{
		path: string[]
		constraint: string
		value: any
	}>
}

/**
 * LLM-based test case generator that uses an AI agent to generate test cases
 */
export class LLMTestCaseGenerator<TInput, TOutput> implements TestCaseGenerator<TInput, TOutput> {
	private readonly originalInputSchema: z.ZodType<TInput>
	private readonly originalConstraints: any
	private readonly relaxedInputSchema: z.ZodType<any>
	private readonly testCaseSchema: z.ZodType<any>

	constructor(
		inputSchema: z.ZodType<TInput>,
		public readonly outputSchema: z.ZodType<TOutput>,
		private readonly agent: Agent,
		private readonly options: TestGeneratorOptions<TInput, TOutput> = {}
	) {
		this.originalInputSchema = inputSchema
		this.originalConstraints = analyzeSchema(inputSchema)
		this.relaxedInputSchema = this.createRelaxedInputSchema()
		this.testCaseSchema = this.createTestCaseSchema()

		// Initialize default prompts if not provided
		this.options = {
			...options,
			prompts: {
				testCaseGeneration: "Generate test cases for this task.",
				edgeCaseGeneration: "Generate edge cases that test the boundaries and unusual inputs for this task.",
				boundaryTestGeneration:
					"Generate boundary tests that focus on the limits of valid inputs for this task.",
				...options.prompts,
			},
		}
	}

	// Implement the required inputSchema getter from TestCaseGenerator interface
	get inputSchema(): z.ZodType<TInput> {
		return this.originalInputSchema
	}

	/**
	 * Create a permissive schema for test case generation
	 */
	private createTestCaseSchema() {
		// Define the test case result schema
		const testCaseResultSchema = z.object({
			success: z.boolean(),
			output: this.outputSchema,
			failure_reason: z.string().optional(),
			violated_constraints: z
				.array(
					z.object({
						path: z.array(z.string()),
						constraint: z.string(),
						value: z.any(),
					})
				)
				.optional(),
		})

		// Create a schema that accepts either a string (to be parsed) or an array of test cases
		return z.object({
			test_cases: z.union([
				z.string().transform((str) => JSON.parse(str)),
				z.array(
					z.object({
						input: z.union([this.relaxedInputSchema, z.any()]),
						expected_output: testCaseResultSchema,
						metadata: z
							.object({
								description: z.string(),
								tags: z.array(z.string()),
								priority: z.enum(["low", "medium", "high"]),
								category: z.string(),
							})
							.optional(),
					})
				),
			]),
		})
	}

	/**
	 * Create a relaxed version of the input schema that matches the shape
	 * but removes constraints to allow for constraint violation testing
	 */
	private createRelaxedInputSchema(): z.ZodType<any> {
		// Helper function to recursively relax schema constraints
		const relaxSchema = (schema: z.ZodType<any>): z.ZodType<any> => {
			const def = (schema as any)._def

			// Handle primitive types directly
			if (def.typeName === "ZodString" || def.typeName === "ZodNumber" || def.typeName === "ZodBoolean") {
				return schema
			}

			switch (def.typeName) {
				case "ZodObject": {
					const shape = def.shape()
					const relaxedShape: Record<string, z.ZodType<any>> = {}

					for (const [key, value] of Object.entries(shape)) {
						relaxedShape[key] = relaxSchema(value as z.ZodType<any>)
					}

					return z.object(relaxedShape)
				}

				case "ZodEnum":
					// Allow any string value, not just enum values
					return z.string()

				case "ZodArray": {
					const relaxedElement = relaxSchema(def.type)
					// Remove array length constraints
					return z.array(relaxedElement)
				}

				case "ZodOptional":
					return relaxSchema(def.innerType).optional()

				case "ZodNullable":
					return relaxSchema(def.innerType).nullable()

				case "ZodUnion":
					// For unions, we'll create a union of relaxed types
					return z.union(def.options.map((option: z.ZodType<any>) => relaxSchema(option)))

				case "ZodIntersection":
					// For intersections, relax both sides
					return z.intersection(relaxSchema(def.left), relaxSchema(def.right))

				case "ZodRecord":
					// For records, relax the value type
					return z.record(relaxSchema(def.valueType))

				case "ZodTuple":
					// For tuples, relax each item
					return z.tuple(def.items.map((item: z.ZodType<any>) => relaxSchema(item)))

				default:
					// For any other type, use a generic any type
					return z.any()
			}
		}

		return relaxSchema(this.originalInputSchema)
	}

	/**
	 * Process test cases to identify constraint violations and wrap outputs in a result structure
	 */
	private processTestCases(testCases: GeneratedTestCase<TOutput>[]): Array<{
		input: TInput
		expected_output: TestCaseResult<TOutput>
	}> {
		return testCases.map((testCase) => {
			const violatedConstraints =
				typeof testCase.input === "object" ? this.findConstraintViolations(testCase.input, []) : []

			// Create the wrapped result
			const result: TestCaseResult<TOutput> = {
				success: violatedConstraints.length === 0,
				output: testCase.expected_output,
			}

			// Add violation information if constraints were violated
			if (violatedConstraints.length > 0) {
				result.violated_constraints = violatedConstraints
				result.failure_reason = `Input violates ${
					violatedConstraints.length
				} constraint(s): ${violatedConstraints.map((v) => `${v.path.join(".")} (${v.constraint})`).join(", ")}`
			}

			return {
				input: testCase.input as TInput,
				expected_output: result,
			}
		})
	}

	/**
	 * Generate test cases in a single LLM call for better efficiency
	 */
	async generateTestCases(options: {
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
	> {
		const prompt = this.buildBatchPrompt(
			this.options.prompts?.testCaseGeneration || "Generate test cases for this task.",
			options.count,
			options.templates
		)

		try {
			const response = await this.agent.task(prompt, { schema: this.testCaseSchema })
			const processedTestCases = this.processTestCases(response.test_cases as GeneratedTestCase<TOutput>[])

			// Apply custom validation if provided
			if (this.options.validation) {
				for (const testCase of processedTestCases) {
					if (this.options.validation.validateInput) {
						const isValid = await this.options.validation.validateInput(testCase.input)
						if (!isValid) {
							throw new Error("Generated input failed custom validation")
						}
					}

					if (this.options.validation.validateOutput) {
						// For validation, we need to pass the actual output (not the wrapper)
						// The output is nested inside the TestCaseResult.output property
						const actualOutput = testCase.expected_output.output

						const isValid = await this.options.validation.validateOutput(testCase.input, actualOutput)
						if (!isValid) {
							throw new Error("Generated output failed custom validation")
						}
					}
				}
			}

			return processedTestCases
		} catch (error) {
			console.error("Error generating test cases:", error)
			throw error
		}
	}

	/**
	 * Find all constraint violations in the input data
	 */
	private findConstraintViolations(
		data: any,
		path: string[]
	): Array<{ path: string[]; constraint: string; value: any }> {
		const violations: Array<{ path: string[]; constraint: string; value: any }> = []

		const checkConstraints = (value: any, constraints: any, currentPath: string[]) => {
			if (constraints.type === "object" && constraints.properties) {
				for (const [key, propConstraints] of Object.entries(constraints.properties)) {
					if (value[key] !== undefined) {
						checkConstraints(value[key], propConstraints, [...currentPath, key])
					}
				}
			} else {
				// Check specific constraints based on type
				switch (constraints.type) {
					case "string":
						if (
							constraints.constraints.minLength !== undefined &&
							value.length < constraints.constraints.minLength
						) {
							violations.push({
								path: currentPath,
								constraint: `minLength: ${constraints.constraints.minLength}`,
								value,
							})
						}
						if (constraints.constraints.isEmail && !value.includes("@")) {
							violations.push({
								path: currentPath,
								constraint: "isEmail",
								value,
							})
						}
						break

					case "number":
						if (constraints.constraints.min !== undefined && value < constraints.constraints.min) {
							violations.push({
								path: currentPath,
								constraint: `min: ${constraints.constraints.min}`,
								value,
							})
						}
						if (constraints.constraints.max !== undefined && value > constraints.constraints.max) {
							violations.push({
								path: currentPath,
								constraint: `max: ${constraints.constraints.max}`,
								value,
							})
						}
						if (constraints.constraints.isInteger && !Number.isInteger(value)) {
							violations.push({
								path: currentPath,
								constraint: "isInteger",
								value,
							})
						}
						break

					case "enum":
						if (constraints.enumValues && !constraints.enumValues.includes(value)) {
							violations.push({
								path: currentPath,
								constraint: `enum: ${constraints.enumValues.join(", ")}`,
								value,
							})
						}
						break
				}
			}
		}

		checkConstraints(data, this.originalConstraints, path)
		return violations
	}

	/**
	 * Generate edge cases in a single call
	 */
	async generateEdgeCases(): Promise<
		Array<{
			input: TInput
			expected_output: TestCaseResult<TOutput>
		}>
	> {
		const prompt = this.buildBatchPrompt(
			this.options.prompts?.edgeCaseGeneration || "Generate edge cases for this task.",
			3 // Default number of edge cases
		)

		try {
			const response = await this.agent.task(prompt, { schema: this.testCaseSchema })
			const processedTestCases = this.processTestCases(response.test_cases as GeneratedTestCase<TOutput>[])

			// Apply custom validation if provided
			if (this.options.validation) {
				for (const testCase of processedTestCases) {
					if (this.options.validation.validateInput) {
						const isValid = await this.options.validation.validateInput(testCase.input)
						if (!isValid) {
							throw new Error("Generated input failed custom validation")
						}
					}

					if (this.options.validation.validateOutput) {
						const isValid = await this.options.validation.validateOutput(
							testCase.input,
							testCase.expected_output.output
						)
						if (!isValid) {
							throw new Error("Generated output failed custom validation")
						}
					}
				}
			}

			return processedTestCases
		} catch (error) {
			console.error("Error generating edge cases:", error)
			throw error
		}
	}

	/**
	 * Generate boundary tests in a single call
	 */
	async generateBoundaryTests(): Promise<
		Array<{
			input: TInput
			expected_output: TestCaseResult<TOutput>
		}>
	> {
		const prompt = this.buildBatchPrompt(
			this.options.prompts?.boundaryTestGeneration || "Generate boundary tests for this task.",
			3 // Default number of boundary tests
		)

		try {
			const response = await this.agent.task(prompt, { schema: this.testCaseSchema })
			const processedTestCases = this.processTestCases(response.test_cases as GeneratedTestCase<TOutput>[])

			// Apply custom validation if provided
			if (this.options.validation) {
				for (const testCase of processedTestCases) {
					if (this.options.validation.validateInput) {
						const isValid = await this.options.validation.validateInput(testCase.input)
						if (!isValid) {
							throw new Error("Generated input failed custom validation")
						}
					}

					if (this.options.validation.validateOutput) {
						const isValid = await this.options.validation.validateOutput(
							testCase.input,
							testCase.expected_output.output
						)
						if (!isValid) {
							throw new Error("Generated output failed custom validation")
						}
					}
				}
			}

			return processedTestCases
		} catch (error) {
			console.error("Error generating boundary tests:", error)
			throw error
		}
	}

	/**
	 * Build a prompt for generating multiple test cases
	 */
	private buildBatchPrompt(
		basePrompt: string,
		count: number,
		templates?: {
			inputTemplates?: Partial<TInput>[]
			outputTemplates?: Partial<TOutput>[]
		}
	): string {
		const schemas = this.getSchemaInfo()
		const templatesInfo = templates
			? `\nUse these templates as inspiration:\n${JSON.stringify(templates, null, 2)}`
			: ""

		// Add information about constraints that can be violated
		const constraintsInfo = `
Note: You can generate test cases that violate these constraints. The violations will be tracked in the metadata.
Some examples of constraint violations you might want to include:
- Values outside of min/max ranges
- Strings shorter or longer than length limits
- Invalid email formats
- Values not in enum sets
- Non-integer numbers where integers are required

Please generate a mix of valid test cases and test cases that intentionally violate different constraints.`

		// Add information about the new output structure
		const outputStructureInfo = `
For each test case, the expected_output should be structured as follows:
{
  "success": boolean,  // Whether the test case should pass (true) or fail (false)
  "output": TOutput,   // The actual output value that matches the output schema
  "failure_reason": string,  // Optional. A description of why the test should fail (if success is false)
  "violated_constraints": [  // Optional. List of constraints that are violated (if any)
    {
      "path": string[],      // Path to the field with the violation
      "constraint": string,  // Description of the constraint
      "value": any           // The value that violates the constraint
    }
  ]
}

For valid test cases, set "success" to true and provide the expected output.
For test cases that should fail due to constraint violations, set "success" to false and include details about the violations.`

		return `${basePrompt}

Please generate ${count} test cases that follow this structure:

<input_schema>
${schemas.input}
</input_schema>

<output_schema>
${schemas.output}
</output_schema>

${constraintsInfo}
${outputStructureInfo}${templatesInfo}

Each test case should:
* Follow the basic structure of the input and output schemas
* Include both valid cases and cases that violate constraints
* Be realistic and cover different scenarios
* Include edge cases and boundary conditions where appropriate`
	}

	private getSchemaInfo(): { input: string; output: string } {
		// Convert Zod schemas to JSON schema format for better readability
		const inputJsonSchema = zodToJsonSchema(this.inputSchema, {
			target: "jsonSchema7",
			definitionPath: "definitions",
		})

		const outputJsonSchema = zodToJsonSchema(this.outputSchema, {
			target: "jsonSchema7",
			definitionPath: "definitions",
		})

		return {
			input: JSON.stringify(inputJsonSchema, null, 2),
			output: JSON.stringify(outputJsonSchema, null, 2),
		}
	}
}
