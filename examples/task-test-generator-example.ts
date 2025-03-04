import { z } from "zod"
import { createTask } from "hataraku"
import { createTaskTestGenerator } from "hataraku"
import { createBaseAgent } from "./agents/base.js"

// Define schemas
const inputSchema = z.object({
	query: z.string().min(1).describe("The search query"),
	filters: z
		.object({
			category: z.string().optional().describe("Optional category filter"),
			minPrice: z.number().optional().describe("Minimum price filter"),
			maxPrice: z.number().optional().describe("Maximum price filter"),
			inStock: z.boolean().optional().describe("Filter for in-stock items only"),
		})
		.optional(),
})

const outputSchema = z.object({
	results: z
		.array(
			z.object({
				id: z.string(),
				title: z.string(),
				price: z.number(),
				category: z.string(),
				inStock: z.boolean(),
				rating: z.number().min(0).max(5),
				description: z.string(),
			})
		)
		.min(1)
		.max(10),
	totalResults: z.number().int().positive(),
	page: z.number().int().min(1),
	pageSize: z.number().int().min(1).max(50),
})

// Define the type for our test cases
type SearchTaskInput = z.infer<typeof inputSchema>
type SearchTaskOutput = z.infer<typeof outputSchema>
type TestCaseSample = {
	description: string
	metadata: {
		description: string
		tags: string[]
		priority: "high" | "medium" | "low"
		category: string
		generated_at: Date
	}
	input: SearchTaskInput
	expected_output: SearchTaskOutput
}

// Sample test cases to guide test generation
const sampleTestCases: TestCaseSample[] = [
	{
		description: "Basic search with category filter",
		metadata: {
			description: "Search for electronics with price range",
			tags: ["category-filter", "price-filter"],
			priority: "high",
			category: "filters",
			generated_at: new Date(),
		},
		input: {
			query: "laptop",
			filters: {
				category: "electronics",
				minPrice: 500,
				maxPrice: 2000,
			},
		},
		expected_output: {
			results: [
				{
					id: "laptop-1",
					title: "High-Performance Laptop",
					price: 1299.99,
					category: "electronics",
					inStock: true,
					rating: 4.5,
					description: "Powerful laptop for professional use",
				},
			],
			totalResults: 1,
			page: 1,
			pageSize: 10,
		},
	},
]

// Create an agent
const agent = createBaseAgent({
	name: "Search Agent",
	description: "An agent that performs product searches",
	role: "You are a helpful assistant that searches for products based on user queries.",
})

// Create a task with output schema
const searchTask = createTask({
	name: "Product Search",
	description: "Search for products based on a query and optional filters",
	agent,
	inputSchema,
	outputSchema,
	task: (input) => `
		Search for products matching the query: "${input.query}"
		${input.filters ? `Apply the following filters: ${JSON.stringify(input.filters)}` : ""}
		
		Return a list of relevant products with their details.
	`,
})

// Create a task test generator
const testGenerator = createTaskTestGenerator({ agent })

// Generate test cases with samples
async function generateTestCases() {
	try {
		console.log("Generating test cases for the Product Search task...")

		// Generate test cases using sample test cases as templates
		const testCases = await testGenerator.generateTestCasesForTask(searchTask, {
			count: 3,
			samples: sampleTestCases,
		})

		// Log test cases
		console.log("\nGenerated test cases:")
		console.log(JSON.stringify(testCases, null, 2))

		return testCases
	} catch (error) {
		console.error("Error generating test cases:", error)
		throw error
	}
}

// Run the example if this file is being run directly
if (require.main === module) {
	generateTestCases()
		.then(() => console.log("Example completed successfully"))
		.catch((error) => {
			console.error("Example failed:", error)
			process.exit(1)
		})
}

export { generateTestCases, searchTask, agent, testGenerator }
