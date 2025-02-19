# Hataraku

A flexible and powerful TypeScript library for building AI-powered task automation and agent workflows. Supports multiple AI providers including OpenRouter, Anthropic (Claude), Mistral AI, and AWS Bedrock.

## Features

- 🤖 Easy agent creation and configuration
- 🔄 Task creation with schema validation
- 📊 Streaming and non-streaming execution modes
- ⚡ TypeScript-first development
- 🔌 Multiple AI provider support
- 🔗 Task chaining for complex workflows

## Installation

```bash
npm install hataraku
```

### Prerequisites

- Node.js
- One or more API keys depending on your chosen providers:
  - OPENROUTER_API_KEY for OpenRouter
  - Additional keys for Bedrock, Anthropic, or Mistral AI if using those providers

## Setup

1. Install the package and its peer dependencies:
   ```bash
   npm install hataraku
   ```

2. Configure your environment variables:
   ```bash
   export OPENROUTER_API_KEY="your-api-key"
   # Add other provider keys as needed
   ```

3. Ensure your Node.js environment is properly configured

## Usage

### Creating an Agent

```typescript
import { createAgent } from 'hataraku';

const agent = createAgent({
  name: 'MyAgent',
  description: 'Custom agent description',
  provider: 'openrouter'
});
```

### Creating and Running Tasks

```typescript
import { createTask } from 'hataraku';
import { z } from 'zod';

// Create a task with schema validation
const task = createTask({
  name: 'validated-task',
  schema: z.object({ name: z.string() }),
  execute: async (input) => `Processing ${input.name}`
});

// Run task (non-streaming)
const result = await task.run({ input: 'your input' });

// Run task (streaming)
const streamingResult = await task.run({ input: 'your input' }, { stream: true });
for await (const chunk of streamingResult) {
  console.log(chunk);
}
```

## API Documentation

### `createAgent(config)`

Creates a new agent instance with specified configuration.

```typescript
import { createAgent } from 'hataraku';

const agent = createAgent({
  name: 'MyAgent',
  description: 'Custom agent description',
  provider: 'openrouter'
});
```

### `createTask(config)`

Creates a new task with optional schema validation.

```typescript
import { createTask } from 'hataraku';
import { z } from 'zod';

const task = createTask({
  name: 'validated-task',
  schema: z.object({ name: z.string() }),
  execute: async (input) => `Processing ${input.name}`
});
```

### `Task.run(input, options)`

Executes a task with given input, supporting both streaming and non-streaming modes.

```typescript
// Non-streaming execution
const result = await task.run({ input: 'your input' });

// Streaming execution
const streamingResult = await task.run({ input: 'your input' }, { stream: true });
for await (const chunk of streamingResult) {
  console.log(chunk);
}
```

## Contributing

We welcome contributions to Hataraku! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) for details on:

1. Setting up the development environment
2. Running tests
3. Code style guidelines
4. Pull request process

### Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Run tests:
   ```bash
   npm test
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Report issues on GitHub
- Join our community discussions
- Check out the [documentation](./docs) for detailed guides

## Version

Current version: 0.5.2