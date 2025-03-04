import { z } from "zod"
import { createApiTestGenerator } from "hataraku"

async function main() {
	// Define schemas for a user registration API
	const userSchema = z.object({
		name: z.string().min(1).max(100),
		age: z.number().min(0).max(150),
		email: z.string().email(),
		preferences: z.object({
			theme: z.enum(["light", "dark"]),
			notifications: z.boolean(),
		}),
	})

	const userResponseSchema = z.object({
		success: z.boolean(),
		data: z.object({
			userId: z.string(),
		}),
		error: z.string().optional(),
	})

	// Create an API test generator (will use default API test generator agent)
	const generator = createApiTestGenerator({
		requestSchema: userSchema,
		responseSchema: userResponseSchema,
		endpoint: "/api/users/register",
		method: "POST",
		generatorOptions: {
			prompts: {
				// Custom prompts will be merged with default API test prompts
				testCaseGeneration: `
Consider additional scenarios:
1. User preferences combinations
2. Age verification rules
3. Email format validation
4. Theme selection validation
				`.trim(),
			},
		},
	})

	console.log("Generating test cases...")

	// Generate standard test cases (limiting to 2 for demonstration)
	console.log("Building prompt for test case generation...")
	const testCases = await generator.generateTestCases({
		count: 2,
		templates: {
			// Ensure some test cases use dark theme
			inputTemplates: [
				{
					preferences: {
						theme: "dark",
						notifications: true,
					},
				},
			],
		},
	})

	if (!testCases) {
		console.error("No test cases were generated!")
		console.error("Response was:", testCases)
		throw new Error("No test cases were generated")
	}

	console.log("\nGenerated Test Cases:")
	console.log(JSON.stringify(testCases, null, 2))

	// Generate edge cases
	console.log("\nGenerating edge cases...")
	const edgeCases = await generator.generateEdgeCases()

	if (!edgeCases) {
		console.error("No edge cases were generated!")
		console.error("Response was:", edgeCases)
		throw new Error("No edge cases were generated")
	}

	console.log("\nGenerated Edge Cases:")
	console.log(JSON.stringify(edgeCases, null, 2))

	// Generate boundary tests
	console.log("\nGenerating boundary tests...")
	const boundaryTests = await generator.generateBoundaryTests()

	if (!boundaryTests) {
		console.error("No boundary tests were generated!")
		console.error("Response was:", boundaryTests)
		throw new Error("No boundary tests were generated")
	}

	console.log("\nGenerated Boundary Tests:")
	console.log(JSON.stringify(boundaryTests, null, 2))
}

main().catch(console.error)
