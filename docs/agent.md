# Agent Documentation

## Overview

The Agent component is a powerful abstraction for AI-powered task execution that provides a flexible and type-safe way to interact with language models. It supports various interaction patterns including streaming responses, schema validation, and tool integration.

## Key Features

- Typed task execution with schema validation
- Streaming support for real-time responses
- Tool integration capabilities
- Conversation thread management
- Configurable model settings
- Factory pattern for easy instantiation

## API Reference

### AgentConfig

Configuration interface for creating an Agent instance.

```typescript
interface AgentConfig {
  name: string;              // Name of the agent
  description: string;       // Description of the agent's purpose
  role: string;             // System instructions for the agent
  model: LanguageModelV1;   // Language model to use
  tools?: ToolSet;          // Optional set of tools the agent can use
  callSettings?: CallSettings; // Optional model call settings
}
```

### TaskInput

Generic interface for task input configuration.

```typescript
interface TaskInput<T = unknown> {
  thread?: Thread;           // Optional conversation thread
  schema?: z.ZodType<T>;    // Optional Zod schema for response validation
  stream?: boolean;         // Enable streaming response
}
```

### StreamingTaskResult

Interface for streaming task results.

```typescript
interface StreamingTaskResult {
  stream: AsyncGenerator<string>;
}
```

### Agent Class

The main class for handling AI interactions and task execution.

#### Constructor

```typescript
constructor(config: AgentConfig)
```

#### Methods

##### task

Executes a task with the agent. Supports multiple overloads:

```typescript
// Basic text response
task(task: string, input?: TaskInput): Promise<string>

// Streaming response
task(task: string, input?: TaskInput & { stream: true }): Promise<AsyncIterableStream<string>>

// Schema-validated response
task<T>(task: string, input?: TaskInput<T> & { schema: z.ZodType<T> }): Promise<T>
```

### createAgent

Factory function to create a new Agent instance.

```typescript
function createAgent(config: AgentConfig): Agent
```

## Usage Examples

### Basic Usage

```typescript
import { Agent, createAgent } from './core/agent';

// Create an agent using the factory function
const agent = createAgent({
  name: 'MyAgent',
  description: 'A helpful assistant for various tasks',
  role: 'You are a helpful assistant that provides clear and concise responses',
  model: 'gpt-4',
});

// Execute a simple task
const response = await agent.task('What is the capital of France?');
```

### Streaming Response

```typescript
// Get a streaming response
const stream = await agent.task('Explain quantum computing', { 
  stream: true 
});

for await (const chunk of stream) {
  console.log(chunk); // Process each chunk of the response
}
```

### Schema Validation

```typescript
import { z } from 'zod';

// Define a schema for the response
const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email()
});

// Get a validated response
const person = await agent.task('Generate a person's information', {
  schema: PersonSchema
});
// person will be typed as { name: string; age: number; email: string }
```

### Using Tools

```typescript
const agent = createAgent({
  name: 'ToolAgent',
  description: 'An agent that can use tools',
  role: 'Assistant with tool access',
  model: 'gpt-4',
  tools: {
    calculator: {
      description: 'Performs calculations',
      execute: (input: string) => eval(input)
    }
  }
});

const result = await agent.task('Calculate 2 + 2');
```

### Thread Management

```typescript
import { Thread } from './core/thread/thread';

// Create a thread for conversation context
const thread = new Thread();

// Use the thread in multiple interactions
const response1 = await agent.task('What is your name?', { thread });
const response2 = await agent.task('What did I just ask you?', { thread });
```

## Configuration Options

The `CallSettings` interface provides various options to customize the model's behavior:

```typescript
interface CallSettings {
  maxTokens?: number;           // Maximum tokens in the response
  temperature?: number;         // Response randomness (0-1)
  topP?: number;               // Nucleus sampling parameter
  topK?: number;               // Top-k sampling parameter
  presencePenalty?: number;    // Penalty for token presence
  frequencyPenalty?: number;   // Penalty for token frequency
  stopSequences?: string[];    // Sequences to stop generation
  seed?: number;               // Random seed for reproducibility
  maxRetries?: number;         // Maximum retry attempts
  abortSignal?: AbortSignal;   // Signal to abort the request
  headers?: Record<string, string | undefined>; // Custom headers
  maxSteps?: number;           // Maximum number of steps
  toolChoice?: 'auto' | 'none' | 'required'; // Tool usage preference
}
```

## Important Notes

1. The agent validates the configuration during instantiation and will throw an error if the name is empty.
2. When using tools with schema validation, the agent performs a two-step process:
   - First generates a text response
   - Then generates a schema-validated object
3. Default values:
   - `maxSteps`: 5
   - `maxRetries`: 4
4. Streaming responses and schema validation cannot be used simultaneously.
5. Tool integration requires proper error handling and may impact response time due to the two-step process.

## Best Practices

1. Always provide clear and specific roles and descriptions for your agents
2. Use schema validation when expecting structured responses
3. Implement proper error handling, especially when using tools
4. Consider using threads for maintaining conversation context
5. Configure appropriate timeouts and retry settings for production use