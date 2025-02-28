# Hataraku Documentation

Welcome to the Hataraku documentation. This guide will help you get started with using Hataraku to build AI-powered development tools and autonomous coding agents.

## Getting Started

- [Quickstart Guide](./quickstart.md) - Get up and running quickly
- [Installation](../README.md#installation) - How to install Hataraku
- [Basic Examples](../examples/README.md) - Simple examples to get started

## Core Concepts

- [API Reference](./api-reference.md) - Comprehensive API documentation
- [Agent Documentation](./agent.md) - Learn about the Agent system
- [Types Documentation](./types.md) - Understanding core types
- [Providers](./providers.md) - Working with different AI providers
- [Tools System](./tools.md) - Extending AI capabilities with tools
- [Workflows](./workflow-proposal.md) - Building multi-step AI workflows
- [Architecture](./architecture.md) - System design and patterns

## CLI

- [CLI Commands](./cli-commands.md) - Command-line interface documentation
- [Configuration](./configuration.md) - Configuring the CLI and SDK

## Advanced Topics

- [Model Context Protocol](./mcp.md) - Working with MCP
- [Troubleshooting](./troubleshooting.md) - Solving common issues

## Development

- [Contributing](../CONTRIBUTING.md) - How to contribute to Hataraku
- [SDK Proposal](./sdk-proposal.md) - SDK design and roadmap

## API Categories

### Agent API

The Agent API provides a high-level interface for interacting with AI models:

```typescript
import { Agent, createAgent } from 'hataraku';

const agent = createAgent({
  name: 'CodeAgent',
  description: 'Helps with coding tasks',
  role: 'You are a helpful coding assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet'
});

const result = await agent.task('Write a function to sort an array');
```

[Learn more about the Agent API](./agent.md)

### Task API

The Task API allows for simple, one-off interactions with AI models:

```typescript
import { Task, createTask } from 'hataraku';

const task = createTask({
  description: 'Generate a JSON schema',
  model: 'openrouter/anthropic/claude-3.7-sonnet'
});

const result = await task.execute();
```

[Learn more about the Task API](./api-reference.md#task)

### Provider API

The Provider API enables integration with various AI model providers:

```typescript
import { createAnthropicProvider } from 'hataraku';

const provider = createAnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const task = createTask({
  description: 'Generate code',
  model: provider.getModel('claude-3-sonnet')
});
```

[Learn more about the Provider API](./providers.md)

### Tools API

The Tools API extends AI capabilities with external functionality:

```typescript
import { Agent, createAgent } from 'hataraku';

const agent = createAgent({
  name: 'MathAgent',
  description: 'Helps with math',
  role: 'Math assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: {
    calculator: {
      description: 'Performs calculations',
      execute: (input) => eval(input)
    }
  }
});
```

[Learn more about the Tools API](./tools.md)

### Workflow API

The Workflow API orchestrates complex multi-step operations:

```typescript
import { Workflow } from 'hataraku';

const workflow = new Workflow({
  name: 'CodeGenerator',
  description: 'Generates and tests code'
});

workflow.addStep({
  name: 'GenerateCode',
  task: 'Write a function to sort an array'
});

workflow.addStep({
  name: 'GenerateTests',
  task: 'Write tests for the sorting function',
  depends: ['GenerateCode']
});

const results = await workflow.execute();
```

[Learn more about the Workflow API](./workflow-proposal.md)

## Additional Resources

- [GitHub Repository](https://github.com/turlockmike/hataraku)
- [npm Package](https://www.npmjs.com/package/hataraku)
- [Changelog](../CHANGELOG.md)
- [License](../LICENSE)

## Feedback and Support

If you have any questions, feedback, or encounter issues, please [open an issue](https://github.com/turlockmike/hataraku/issues) on the GitHub repository. 