# Task Test Generator

The Task Test Generator is a powerful tool for generating test cases for tasks based on their metadata and schema. It leverages the LLM to create realistic and diverse test cases, edge cases, and boundary tests.

## Features

- Generate test cases based on task metadata (name, description, agent role)
- Create edge cases that test unusual inputs
- Generate boundary tests that focus on the limits of valid inputs
- Customize test case generation with templates and options
- Validate generated test cases against schemas

## Installation

The Task Test Generator is included in the Hataraku package:

```bash
npm install hataraku
```

## Usage

### Basic Usage

```typescript
import { createAgent, createTask, createTaskTestGenerator } from 'hataraku';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';

// Create an agent
const agent = createAgent({
  name: "Example Agent",
  description: "An example agent",
  role: "You are a helpful assistant.",
  model: anthropic("claude-3-haiku-20240307")
});

// Define schemas
const inputSchema = z.object({
  text: z.string().min(1)
});

const outputSchema = z.object({
  summary: z.string(),
  wordCount: z.number().int().positive()
});

// Create a task with output schema
const summarizeTask = createTask({
  name: "Text Summarizer",
  description: "Summarize the provided text",
  agent,
  inputSchema,
  outputSchema, // Include output schema in the task
  task: (input) => `Summarize the following text: "${input.text}"`
});

// Create a task test generator
const testGenerator = createTaskTestGenerator(agent);

// Generate test cases - no need to provide outputSchema in options
const testCases = await testGenerator.generateTestCasesForTask(summarizeTask, {
  testCaseCount: 3
});

console.log("Generated test cases:", testCases);

// For tasks without output schema, provide it in options
const taskWithoutSchema = createTask({
  name: "Simple Summarizer",
  description: "Summarize text without schema validation",
  agent,
  inputSchema,
  task: (input) => `Summarize: "${input.text}"`
});

const testCasesWithSchema = await testGenerator.generateTestCasesForTask(taskWithoutSchema, {
  outputSchema, // Required for tasks without output schema
  testCaseCount: 2
});
```

### Advanced Options

The Task Test Generator supports various options for customizing test case generation:

```typescript
const testCases = await testGenerator.generateTestCasesForTask(task, {
  // Output schema (required only if task doesn't have one)
  outputSchema, // Optional if task has output schema
  
  // Number of test cases to generate
  testCaseCount: 5, // Default: 5
  
  // Edge case options
  includeEdgeCases: true, // Default: true
  edgeCaseCount: 3, // Default: 3
  
  // Boundary test options
  includeBoundaryTests: true, // Default: true
  boundaryTestCount: 3, // Default: 3
  
  // Custom prompts
  prompts: {
    testCaseGeneration: "Generate test cases focusing on...",
    edgeCaseGeneration: "Generate edge cases focusing on...",
    boundaryTestGeneration: "Generate boundary tests focusing on..."
  },
  
  // Custom validation
  validation: {
    validateInput: async (input) => {
      // Custom validation logic
      return true;
    },
    validateOutput: async (input, output) => {
      // Custom validation logic
      return true;
    }
  }
});
```

### Generating Test Cases for Task Configs

You can also generate test cases for task configurations without creating a task instance:

```typescript
// With output schema in options
const testCases = await testGenerator.generateTestCasesForTaskConfig({
  name: "Text Summarizer",
  description: "Summarize the provided text",
  agent,
  inputSchema,
  task: (input) => `Summarize the following text: "${input.text}"`
}, {
  outputSchema, // Required if not in taskConfig
  testCaseCount: 3
});

// With output schema in task config
const testCasesWithSchema = await testGenerator.generateTestCasesForTaskConfig({
  name: "Text Summarizer",
  description: "Summarize the provided text",
  agent,
  inputSchema,
  outputSchema, // Include in task config
  task: (input) => `Summarize the following text: "${input.text}"`
}, {
  testCaseCount: 3 // No need for outputSchema in options
});
```

## Test Case Structure

The generated test cases have the following structure:

```typescript
interface TaskTestCaseResult<TInput, TOutput> {
  // Regular test cases
  testCases: Array<{
    metadata: {
      description: string;
      tags: string[];
      priority: "low" | "medium" | "high";
      category: string;
      generated_at: Date;
    };
    input: TInput;
    expected_output: TOutput;
  }>;
  
  // Edge cases (if requested)
  edgeCases?: Array<{
    metadata: { /* same as above */ };
    input: TInput;
    expected_output: TOutput;
  }>;
  
  // Boundary tests (if requested)
  boundaryTests?: Array<{
    metadata: { /* same as above */ };
    input: TInput;
    expected_output: TOutput;
  }>;
}
```

## Best Practices

1. **Provide detailed task descriptions**: The more information you provide in the task name, description, and agent role, the better the generated test cases will be.

2. **Use descriptive schema definitions**: Add `.describe()` to your Zod schema fields to provide context for the test generator.

3. **Start with a small number of test cases**: Generate a few test cases first to verify the quality before generating larger sets.

4. **Customize prompts for specific needs**: Use the `prompts` option to guide the test generator towards specific types of test cases.

5. **Add custom validation**: Use the `validation` option to add domain-specific validation logic for the generated test cases.

### Using Sample Test Cases

You can provide sample test cases to guide the test generation process. These samples will be used as templates to generate similar test cases:

```typescript
import { createAgent, createTask, createTaskTestGenerator } from 'hataraku';
import { z } from 'zod';

// Define schemas
const inputSchema = z.object({
  query: z.string()
});

const outputSchema = z.object({
  results: z.array(z.string())
});

// Create sample test cases
const sampleTestCases = [
  {
    description: "Basic search example",
    metadata: {
      description: "Simple search with exact match",
      tags: ["basic", "exact-match"],
      priority: "high",
      category: "basic",
      generated_at: new Date()
    },
    input: {
      query: "example"
    },
    expected_output: {
      results: ["Example result"]
    }
  },
  {
    description: "Advanced search example",
    metadata: {
      description: "Search with special characters",
      tags: ["advanced", "special-chars"],
      priority: "medium",
      category: "advanced",
      generated_at: new Date()
    },
    input: {
      query: "example*"
    },
    expected_output: {
      results: ["Example 1", "Example 2"]
    }
  }
];

// Create a task
const searchTask = createTask({
  name: "Search",
  description: "Search for items",
  agent,
  inputSchema,
  outputSchema,
  task: (input) => `Search for: ${input.query}`
});

// Create a test generator
const testGenerator = createTaskTestGenerator(agent);

// Generate test cases using samples
const testCases = await testGenerator.generateTestCasesForTask(searchTask, {
  testCaseCount: 3,
  samples: sampleTestCases // Provide sample test cases
});
```

The sample test cases will be included in the prompt to the LLM, helping it understand:
1. The expected format and structure of test cases
2. The types of scenarios to test
3. The level of detail needed in metadata
4. The relationship between inputs and expected outputs

Each sample test case can include:
- `description`: A description of what the test case demonstrates
- `metadata`: Metadata about the test case (description, tags, priority, etc.)
- `input`: A sample input that follows the input schema
- `expected_output`: The expected output for the input
- `description` (optional): Additional description of what this sample demonstrates

The test generator will use these samples to:
1. Generate test cases that follow similar patterns
2. Create variations of the sample scenarios
3. Maintain consistent metadata structure
4. Ensure generated test cases are realistic and useful

### Advanced Sample Usage

You can use samples to guide specific types of test cases:

```typescript
// Generate test cases with different priorities
const testCases = await testGenerator.generateTestCasesForTask(searchTask, {
  testCaseCount: 5,
  samples: [
    {
      description: "High priority test case",
      metadata: {
        description: "Critical functionality test",
        tags: ["critical"],
        priority: "high",
        category: "core",
        generated_at: new Date()
      },
      input: { /* ... */ },
      expected_output: { /* ... */ }
    },
    {
      description: "Edge case example",
      metadata: {
        description: "Testing boundary conditions",
        tags: ["edge-case"],
        priority: "medium",
        category: "edge",
        generated_at: new Date()
      },
      input: { /* ... */ },
      expected_output: { /* ... */ }
    }
  ]
});

// Use different samples for different test types
const testCases = await testGenerator.generateTestCasesForTask(searchTask, {
  testCaseCount: 3,
  edgeCaseCount: 2,
  boundaryTestCount: 2,
  samples: {
    regular: [ /* regular test case samples */ ],
    edge: [ /* edge case samples */ ],
    boundary: [ /* boundary test samples */ ]
  }
});
```

### Best Practices for Sample Test Cases

1. **Provide Diverse Samples**: Include samples that demonstrate different aspects of your task:
   - Different input combinations
   - Various edge cases
   - Different metadata patterns
   - Different levels of complexity

2. **Include Clear Descriptions**: Each sample should have clear descriptions that explain:
   - What the test case is testing
   - Why it's important
   - What makes it unique or interesting

3. **Use Meaningful Metadata**: Include metadata that helps categorize and understand the test cases:
   - Descriptive tags
   - Appropriate priority levels
   - Relevant categories
   - Generated dates for tracking

4. **Follow Schema Strictly**: Ensure all sample inputs and outputs strictly follow their schemas:
   - Valid input values
   - Complete output structures
   - Correct data types
   - Required fields

5. **Start Simple**: Begin with simple, clear samples before adding more complex ones:
   - Basic functionality first
   - Add edge cases gradually
   - Include boundary tests last
   - Build complexity incrementally 