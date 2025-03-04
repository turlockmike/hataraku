import { z } from "zod"

type SchemaConstraints = {
	type: string
	constraints: Record<string, any>
	properties?: Record<string, SchemaConstraints>
	enumValues?: string[]
}

export function analyzeSchema(schema: z.ZodType<any>): SchemaConstraints {
	const def = (schema as any)._def

	switch (def.typeName) {
		case "ZodObject": {
			const properties: Record<string, SchemaConstraints> = {}
			const shape = def.shape() as Record<string, z.ZodType<any>>
			for (const [key, value] of Object.entries(shape)) {
				properties[key] = analyzeSchema(value)
			}
			return {
				type: "object",
				constraints: {},
				properties,
			}
		}

		case "ZodString":
			const stringConstraints: Record<string, any> = {}
			if (def.checks) {
				for (const check of def.checks) {
					switch (check.kind) {
						case "min":
							stringConstraints.minLength = check.value
							break
						case "max":
							stringConstraints.maxLength = check.value
							break
						case "email":
							stringConstraints.isEmail = true
							break
						case "url":
							stringConstraints.isUrl = true
							break
					}
				}
			}
			return {
				type: "string",
				constraints: stringConstraints,
			}

		case "ZodNumber":
			const numberConstraints: Record<string, any> = {}
			if (def.checks) {
				for (const check of def.checks) {
					switch (check.kind) {
						case "min":
							numberConstraints.min = check.value
							break
						case "max":
							numberConstraints.max = check.value
							break
						case "int":
							numberConstraints.isInteger = true
							break
					}
				}
			}
			return {
				type: "number",
				constraints: numberConstraints,
			}

		case "ZodEnum":
			return {
				type: "enum",
				constraints: {},
				enumValues: def.values,
			}

		case "ZodBoolean":
			return {
				type: "boolean",
				constraints: {},
			}

		case "ZodArray":
			const elementConstraints = analyzeSchema(def.type)
			const arrayConstraints: Record<string, any> = {}
			if (def.minLength) {
				arrayConstraints.minLength = def.minLength.value
			}
			if (def.maxLength) {
				arrayConstraints.maxLength = def.maxLength.value
			}
			return {
				type: "array",
				constraints: arrayConstraints,
				properties: { element: elementConstraints },
			}

		default:
			return {
				type: "unknown",
				constraints: {},
			}
	}
}

export function generateSchemaBasedPrompts(
	inputSchema: z.ZodType<any>,
	outputSchema: z.ZodType<any>
): {
	testCaseGeneration: string
	edgeCaseGeneration: string
	boundaryTestGeneration: string
} {
	const inputAnalysis = analyzeSchema(inputSchema)
	const outputAnalysis = analyzeSchema(outputSchema)

	const testCasePrompt = generateTestCasePrompt(inputAnalysis, outputAnalysis)
	const edgeCasePrompt = generateEdgeCasePrompt(inputAnalysis, outputAnalysis)
	const boundaryTestPrompt = generateBoundaryTestPrompt(inputAnalysis, outputAnalysis)

	return {
		testCaseGeneration: testCasePrompt,
		edgeCaseGeneration: edgeCasePrompt,
		boundaryTestGeneration: boundaryTestPrompt,
	}
}

function generateTestCasePrompt(input: SchemaConstraints, output: SchemaConstraints): string {
	const constraints = extractConstraints(input)
	const scenarios = generateTestScenarios(input, output)

	return `
Generate a valid test case considering these constraints:
${constraints.join("\n")}

Consider the following scenarios:
${scenarios.join("\n")}

Ensure the generated test case:
1. Follows all schema constraints
2. Represents realistic data
3. Tests meaningful business scenarios
`.trim()
}

function generateEdgeCasePrompt(input: SchemaConstraints, output: SchemaConstraints): string {
	const constraints = extractConstraints(input)
	const edgeCases = generateEdgeCaseScenarios(input)

	return `
Generate edge cases that test the following constraints:
${constraints.join("\n")}

Focus on these edge scenarios:
${edgeCases.join("\n")}

Ensure to test:
1. Minimum and maximum values where applicable
2. Special characters and formats
3. Empty or minimal valid values
4. Maximum allowed values
`.trim()
}

function generateBoundaryTestPrompt(input: SchemaConstraints, output: SchemaConstraints): string {
	const boundaries = extractBoundaries(input)

	return `
Generate boundary tests for these constraints:
${boundaries.join("\n")}

For each boundary:
1. Test exactly at the boundary
2. Test just below the boundary
3. Test just above the boundary
`.trim()
}

function extractConstraints(schema: SchemaConstraints, prefix = ""): string[] {
	const constraints: string[] = []

	if (schema.type === "object" && schema.properties) {
		for (const [key, value] of Object.entries(schema.properties)) {
			const fieldPath = prefix ? `${prefix}.${key}` : key
			constraints.push(...extractConstraints(value, fieldPath))
		}
	} else {
		const fieldDesc = prefix ? `Field '${prefix}' (${schema.type})` : `${schema.type} value`

		if (schema.type === "string") {
			if (schema.constraints.minLength !== undefined) {
				constraints.push(`${fieldDesc} must be at least ${schema.constraints.minLength} characters`)
			}
			if (schema.constraints.maxLength !== undefined) {
				constraints.push(`${fieldDesc} must be at most ${schema.constraints.maxLength} characters`)
			}
			if (schema.constraints.isEmail) {
				constraints.push(`${fieldDesc} must be a valid email address`)
			}
			if (schema.constraints.isUrl) {
				constraints.push(`${fieldDesc} must be a valid URL`)
			}
		} else if (schema.type === "number") {
			if (schema.constraints.min !== undefined) {
				constraints.push(`${fieldDesc} must be at least ${schema.constraints.min}`)
			}
			if (schema.constraints.max !== undefined) {
				constraints.push(`${fieldDesc} must be at most ${schema.constraints.max}`)
			}
			if (schema.constraints.isInteger) {
				constraints.push(`${fieldDesc} must be an integer`)
			}
		} else if (schema.type === "enum") {
			if (schema.enumValues) {
				constraints.push(`${fieldDesc} must be one of: ${schema.enumValues.join(", ")}`)
			}
		}
	}

	return constraints
}

function extractBoundaries(schema: SchemaConstraints, prefix = ""): string[] {
	const boundaries: string[] = []

	if (schema.type === "object" && schema.properties) {
		for (const [key, value] of Object.entries(schema.properties)) {
			const fieldPath = prefix ? `${prefix}.${key}` : key
			boundaries.push(...extractBoundaries(value, fieldPath))
		}
	} else {
		const fieldDesc = prefix ? `Field '${prefix}'` : "Value"

		if (
			schema.type === "string" &&
			(schema.constraints.minLength !== undefined || schema.constraints.maxLength !== undefined)
		) {
			boundaries.push(
				`${fieldDesc} length boundaries: ` +
					`${schema.constraints.minLength ?? "no min"} to ${
						schema.constraints.maxLength ?? "no max"
					} characters`
			)
		} else if (
			schema.type === "number" &&
			(schema.constraints.min !== undefined || schema.constraints.max !== undefined)
		) {
			boundaries.push(
				`${fieldDesc} value boundaries: ` +
					`${schema.constraints.min ?? "no min"} to ${schema.constraints.max ?? "no max"}`
			)
		}
	}

	return boundaries
}

function generateTestScenarios(input: SchemaConstraints, output: SchemaConstraints): string[] {
	const scenarios: string[] = []

	// Add scenarios based on input schema
	if (input.type === "object" && input.properties) {
		for (const [key, value] of Object.entries(input.properties)) {
			if (value.type === "string" && value.constraints.isEmail) {
				scenarios.push(`Test various email formats for '${key}'`)
			}
			if (value.type === "enum") {
				scenarios.push(`Test all possible values for '${key}': ${value.enumValues?.join(", ")}`)
			}
			if (
				value.type === "number" &&
				(value.constraints.min !== undefined || value.constraints.max !== undefined)
			) {
				scenarios.push(`Test numeric range for '${key}'`)
			}
		}
	}

	// Add scenarios based on output schema
	if (output.type === "object" && output.properties) {
		if (output.properties.success) {
			scenarios.push("Test both successful and failed operations")
		}
		if (output.properties.error) {
			scenarios.push("Test various error conditions")
		}
	}

	return scenarios
}

function generateEdgeCaseScenarios(schema: SchemaConstraints): string[] {
	const scenarios: string[] = []

	if (schema.type === "object" && schema.properties) {
		for (const [key, value] of Object.entries(schema.properties)) {
			if (value.type === "string") {
				scenarios.push(`Test '${key}' with:
- Empty string (if allowed)
- Maximum length string
- Special characters
${value.constraints.isEmail ? "- Edge case email formats" : ""}`)
			} else if (value.type === "number") {
				scenarios.push(`Test '${key}' with:
- Minimum allowed value
- Maximum allowed value
- Zero
${value.constraints.isInteger ? "- Decimal values (should fail)" : ""}`)
			}
		}
	}

	return scenarios
}
