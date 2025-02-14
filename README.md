# Hataraku

An autonomous coding agent for building AI-powered development tools. The name "Hataraku" (働く) means "to work" in Japanese.

## Installation

```bash
# Install globally via npm
npm install -g hataraku

# Or run directly with npx
npx hataraku
```

## Environment Setup

Before using Hataraku, make sure to set your API key for your chosen provider:

```bash
# For OpenRouter (default)
export OPENROUTER_API_KEY=your_api_key_here

# Or for Anthropic
export ANTHROPIC_API_KEY=your_api_key_here

# Or for OpenAI
export OPENAI_API_KEY=your_api_key_here
```

## Quick Start

```bash
# Run a task
hataraku "create a react component that..."

# Interactive Mode (prompts for tasks)
hataraku -i

# With specific provider and model
hataraku --provider anthropic --model claude-3 "optimize this function..."

# List recent task history
hataraku --list-history

# Run without sound effects
hataraku --no-sound "create a test file"
```

## CLI Options

- `-p, --provider <provider>` - API provider to use (openrouter, anthropic, openai) [default: openrouter]
- `-m, --model <model>` - Model ID for the provider [default: anthropic/claude-3.5-sonnet]
- `-k, --api-key <key>` - API key for the provider (can also use environment variables)
- `-a, --max-attempts <number>` - Maximum number of consecutive mistakes before exiting [default: 3]
- `-l, --list-history` - List recent tasks from history
- `-i, --interactive` - Run in interactive mode, prompting for tasks
- `--no-sound` - Disable sound effects
- `-v, --version` - Output the version number
- `-h, --help` - Display help information

## Features

- Create and edit files with diff view and linting support
- Execute terminal commands with real-time output monitoring
- Launch and control browsers for testing and debugging
- Support for multiple AI providers (OpenRouter, Anthropic, OpenAI, etc.)
- Built-in tools for file operations, code analysis, and more
- Interactive mode with follow-up task suggestions
- Task history tracking and review
- Sound effects for task completion (can be disabled)

## SDK

Hataraku provides a powerful SDK for building AI-powered development tools and workflows. The SDK includes:

### Core Components

- **Tool**: Define reusable machine executable tools with input/output schemas
- **Agent**: Create autonomous agents with specific roles and capabilities
- **Task**: Define reusable tasks with input/output schemas
- **Workflow**: Build complex workflows with conditional branching and parallel execution

### AI Model Integration

Hataraku integrates with multiple AI providers through the `ai` SDK:

```typescript
import { createBedrockProvider } from 'hataraku/providers/bedrock';
import { LanguageModelV1 } from 'ai';

// Initialize Bedrock provider
const bedrock = await createBedrockProvider();
const model = bedrock('anthropic.claude-3-sonnet-20240229-v1:0');

// Or use OpenAI
import { OpenAI } from 'openai';
const openai = new OpenAI();
const model = openai.chat;

// Or use Anthropic directly
import Anthropic from '@anthropic-ai/sdk';
const anthropic = new Anthropic();
const model = anthropic.messages;
```

### Task Creation Example

```typescript
import { createAgent, createTask } from 'hataraku';
import { z } from 'zod';

// Create an agent
const agent = createAgent({
  name: 'CodeReviewer',
  description: 'Reviews code for best practices and issues',
  role: 'You are an expert code reviewer...',
  model: model,
  tools: {
    // Add custom tools if needed
    analyzeComplexity: async (code: string) => { /* ... */ }
  }
});

// Create a task with schema validation
const reviewTask = createTask({
  name: 'CodeReview',
  description: 'Performs detailed code review',
  agent: agent,
  schema: z.object({
    issues: z.array(z.string()),
    suggestions: z.array(z.string())
  }),
  task: (input) => `Review the following code:\n${input}`
});

// Execute with streaming
const stream = await reviewTask.execute(codeString, { stream: true });
for await (const chunk of stream) {
  console.log(chunk);
}
```

### Workflow Examples

Build complex workflows with conditional logic and parallel execution:

```typescript
import { createWorkflow } from 'hataraku';

const refactoringWorkflow = createWorkflow({
  name: 'CodeRefactoring',
  description: 'Analyzes and refactors code',
  async builder(workflow) {
    // Analyze code complexity
    const analysis = await workflow.task('analyze', analyzeTask, codeInput);
    
    // Conditional branching based on complexity
    await workflow.when(
      (results) => results.analysis.complexity > 20,
      async (builder) => {
        // Complex code path
        const plan = await builder.task('plan', planningTask, analysis);
        const chunks = await builder.task('chunk', chunkingTask, plan);
        
        // Run refactoring tasks in parallel
        const results = await builder.parallel([
          { name: 'chunk1', task: refactorTask, input: chunks[0] },
          { name: 'chunk2', task: refactorTask, input: chunks[1] },
        ]);
        
        return builder.success(results);
      }
    );
    
    // Simple refactoring path
    const refactored = await workflow.task('refactor', simpleRefactorTask, analysis);
    return workflow.success(refactored);
  }
});

// Execute workflow with schema validation
const result = await refactoringWorkflow.execute(input, {
  schema: RefactoringResultSchema
});
```

### Features

- Type-safe task definitions with Zod schema validation
- Support for streaming responses
- Built-in error handling and retry logic
- Extensible tool system for custom capabilities
- Support for multiple AI providers
- Workflow orchestration with:
  - Conditional branching
  - Parallel execution
  - Error handling
  - Progress tracking
  - Schema validation

## MCP (Model Context Protocol)

Hataraku can be run as an MCP server, exposing its capabilities through a standardized protocol:

```typescript
import { HatarakuMcpServer } from 'hataraku';

// Create and start MCP server
const server = new HatarakuMcpServer(model);
await server.start();
```

### Built-in MCP Tools

1. **Code Analysis**
   - Analyzes code complexity and issues
   - Provides improvement suggestions
   - Identifies technical debt

2. **Bug Analysis**
   - Analyzes bug reports and stack traces
   - Provides root cause analysis
   - Suggests fixes and prevention

3. **PR Review**
   - Reviews code changes
   - Provides structured feedback
   - Identifies potential risks

4. **Refactoring Planning**
   - Creates structured refactoring plans
   - Breaks down changes into steps
   - Assesses risks and effort

### Usage

```bash
# Run with stdio transport (default)
npm run hataraku-mcp

```

## Documentation

- [CLI Documentation](./docs/cli.md)
- [Examples](./examples/)

## Task History

Tasks are automatically saved in `~/.hataraku/logs` and include:
- Task ID and timestamp
- Input/output tokens
- Cost information
- Full conversation history

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on how to get started.

## License

[Apache 2.0](./LICENSE)
