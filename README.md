# Hataraku

An autonomous coding agent and SDK for building AI-powered  tools. The name "Hataraku" (働く) means "to work" in Japanese.

[![npm version](https://badge.fury.io/js/hataraku.svg)](https://badge.fury.io/js/hataraku)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Description

Hataraku is a powerful toolkit that enables the creation of AI-powered development tools and autonomous coding agents. It provides a flexible SDK and CLI for building intelligent development workflows, code analysis, and automation tasks.

## Key Features

- 🤖 Autonomous coding agent capabilities
- 🛠️ Extensible SDK for building AI-powered tools
- 📦 Support for multiple AI providers (OpenRouter, Claude, Amazon Bedrock)
- 🔄 Workflow automation and parallel task execution
- 📊 Schema validation and structured tasks
- 🧰 Built-in tool integration system
- 🔗 Model Context Protocol (MCP) support
- 🔄 Extends the powerful AI SDK from Vercel.
- 🧪 Test case generation for tasks based on metadata and schema

## Installation

```bash
# Using npm
npm install -g hataraku

# Using yarn
yarn global add hataraku

# Using pnpm
pnpm global add hataraku
```

## Quick Start

### SDK Usage

```typescript
// Import the SDK
import { createAgent, createTask, createTaskTestGenerator } from 'hataraku';
import { z } from 'zod';

// Import provider creation functions
import { createOpenRouterModel, createAnthropicModel } from 'hataraku';

// Set up credentials (alternatively, use environment variables)
// - OPENROUTER_API_KEY for OpenRouter
// - ANTHROPIC_API_KEY for direct Anthropic access
// - BEDROCK_ACCESS_KEY_ID and BEDROCK_SECRET_ACCESS_KEY for Amazon Bedrock

// Create an agent using Claude via OpenRouter
// You can pass API key directly or use environment variable
const model = await createOpenRouterModel('anthropic/claude-3-opus-20240229', process.env.OPENROUTER_API_KEY);
const agent = createAgent({
  name: 'MyAgent',
  description: 'A helpful assistant',
  role: 'You are a helpful assistant that provides accurate information.',
  model: model
});

// Run a one-off task
const result = await agent.task('Create a hello world function');

// Create a simple reusable task with schema validation
const task = createTask({
  name: 'HelloWorld',
  description: 'Say Hello to the user',
  agent: agent,
  inputSchema: z.object({ name: z.string() }),
  task: ({name}) => `Say hello to ${name} in a friendly manner`
});

// Execute the task
const result = await task.run({name: 'Hataraku'});
console.log(result);
```

### Test Case Generation

Hataraku includes a powerful test case generator that can create test cases for your tasks based on their metadata and schema:

```typescript
import { createAgent, createTask, createTaskTestGenerator } from 'hataraku';
import { z } from 'zod';
import { anthropic } from '@ai-sdk/anthropic';

// Define schemas
const inputSchema = z.object({
  query: z.string().min(1).describe("The search query"),
  filters: z.object({
    category: z.string().optional().describe("Optional category filter"),
    minPrice: z.number().optional().describe("Minimum price filter"),
    maxPrice: z.number().optional().describe("Maximum price filter")
  }).optional()
});

const outputSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    title: z.string(),
    price: z.number(),
    category: z.string()
  })).min(1).max(10),
  totalResults: z.number().int().positive()
});

// Create an agent
const agent = createAgent({
  name: "Search Agent",
  description: "An agent that performs product searches",
  role: "You are a helpful assistant that searches for products based on user queries.",
  model: anthropic("claude-3-haiku-20240307")
});

// Create a task with output schema
const searchTask = createTask({
  name: "Product Search",
  description: "Search for products based on a query and optional filters",
  agent,
  inputSchema,
  outputSchema, // Include output schema in the task
  task: (input) => `
    Search for products matching the query: "${input.query}"
    ${input.filters ? `Apply the following filters: ${JSON.stringify(input.filters)}` : ""}
    
    Return a list of relevant products with their details.
  `
});

// Create a task test generator
const testGenerator = createTaskTestGenerator(agent);

// Generate test cases - no need to provide outputSchema in options
// since it's already defined in the task
const testCases = await testGenerator.generateTestCasesForTask(searchTask, {
  testCaseCount: 3,
  edgeCaseCount: 2,
  boundaryTestCount: 2
});

console.log("Generated test cases:", testCases);

// For tasks without output schema, provide it in options
const simpleTask = createTask({
  name: "Simple Search",
  description: "Basic search without schema validation",
  agent,
  inputSchema,
  task: (input) => `Perform a search for: ${input.query}`
});

const testCasesWithSchema = await testGenerator.generateTestCasesForTask(simpleTask, {
  outputSchema, // Required for tasks without output schema
  testCaseCount: 2
});
```

The test generator creates:
- Regular test cases that cover common scenarios
- Edge cases that test unusual inputs
- Boundary tests that focus on the limits of valid inputs

Each test case includes:
- Metadata (description, tags, priority, etc.)
- Valid input that follows the input schema
- Expected output that follows the output schema

### CLI Usage

First, install the CLI globally:

```bash
npm install -g hataraku
```

Initialize a new project:

```bash
hataraku init my-project
cd my-project
```

Run a task using the CLI:

```bash
# Run a predefined task
hataraku task run hello-world

# Run with custom input
hataraku task run hello-world --input '{"prompt": "Write a function that calculates factorial"}'

# Run with streaming output
hataraku task run hello-world --stream
```

Configure providers and explore available commands:

```bash
# Configure a provider
hataraku provider configure openrouter

# List all available commands
hataraku --help
```

## API Overview

Hataraku provides several core components:

- `Task`: Create and execute AI-powered tasks
- `Agent`: Build autonomous coding agents
- `Workflow`: Orchestrate complex multi-step operations
- `Tools`: Integrate custom capabilities and external services

For detailed API documentation, see the [Types Documentation](docs/types.md).

## Documentation

- [Agent Documentation](docs/agent.md) - Learn about autonomous agents
- [CLI Reference](docs/cli.md) - Available CLI commands and options
- [API Reference](docs/api-reference.md) - Complete API reference
- [Configuration Guide](docs/configuration.md) - Configuration options
- [Providers](docs/providers.md) - Supported AI providers
- [Tools](docs/tools.md) - Built-in tools and extensions
- [Architecture](docs/architecture.md) - System architecture
- [Troubleshooting](docs/troubleshooting.md) - Solving common issues

## Examples

The package includes various examples in the `/examples` directory demonstrating different features:

- Basic task execution
- Streaming responses
- Schema validation
- Multi-step workflows
- Tool integration
- Thread management

These examples are available for reference in the repository and can be examined to understand different use cases and implementation patterns.

See the [examples README](examples/README.md) for more details.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/turlockmike/hataraku/issues)
- Documentation: See the [docs](./docs) directory for detailed guides

