# API Reference

## Core Components

Hataraku provides several main components for building AI-powered development tools.

### Agent

The `Agent` class is the primary interface for interacting with AI models.

```typescript
import { Agent, createAgent } from 'hataraku';

// Create an agent
const agent = createAgent({
  name: 'MyAgent',
  description: 'A helpful coding assistant',
  role: 'You are a coding assistant that helps with TypeScript',
  model: 'openrouter/anthropic/claude-3.7-sonnet'
});

// Execute a task
const result = await agent.task('What is TypeScript?');
```

#### Agent Configuration

```typescript
interface AgentConfig {
  name: string;              // Name of the agent
  description: string;       // Description of the agent's purpose
  role: string;              // System instructions for the agent
  model: string | LanguageModelV1; // Language model to use
  tools?: ToolSet;           // Optional set of tools
  callSettings?: CallSettings; // Optional model call settings
}
```

#### Methods

- `task(task: string, input?: TaskInput): Promise<string>` - Execute a task and get a text response
- `task(task: string, input?: TaskInput & { stream: true }): Promise<AsyncIterableStream<string>>` - Get a streaming response
- `task<T>(task: string, input?: TaskInput<T> & { schema: z.ZodType<T> }): Promise<T>` - Get a schema-validated response

### Task

The `Task` class represents a single unit of work for an AI model.

```typescript
import { Task, createTask } from 'hataraku';

// Create a task
const task = createTask({
  name: 'Explain TypeScript',
  description: 'Explain what TypeScript is',
  agent: agent // An agent instance created earlier
});

// Execute the task
const result = await task.run();
```

#### Task Configuration

```typescript
interface TaskConfig<TInput = string, TOutput = unknown> {
  name: string;             // Name of the task
  description: string;      // Task description
  agent: Agent;             // Agent to execute the task
  inputSchema?: z.ZodType<TInput>;   // Optional schema for input validation
  outputSchema?: z.ZodType<TOutput>; // Optional schema for output validation
  task: string | ((input: TInput) => string); // Task prompt or prompt generator function
}
```

#### Methods

- `run(input: TInput): Promise<TOutput>` - Execute the task with the given input
- `run(input: TInput, options: { stream: true, thread?: Thread }): Promise<AsyncIterableStream<string>>` - Get a streaming response
- `getInfo(): { name: string; description: string }` - Get information about the task

### Workflow

The `Workflow` system allows you to orchestrate complex multi-step operations.

```typescript
import { Workflow } from 'hataraku';

// Create a workflow
const workflow = new Workflow({
  name: 'Document Analysis',
  description: 'Analyzes and summarizes a document',
});

// Add steps to the workflow
workflow.addStep({
  name: 'Extract Text',
  task: 'Extract the main points from this document',
  // Additional configuration...
});

workflow.addStep({
  name: 'Summarize',
  task: 'Create a summary of the extracted points',
  // Additional configuration...
});

// Execute the workflow
const results = await workflow.execute({
  input: { document: 'Document content...' }
});
```

### Thread

The `Thread` class manages conversation history for context-aware interactions.

```typescript
import { Thread } from 'hataraku';

// Create a new thread
const thread = new Thread();

// Add messages to the thread
thread.addUserMessage('Hello, I need help with TypeScript');
thread.addAssistantMessage('I can help with TypeScript. What specific question do you have?');

// Use the thread with an agent
const response = await agent.task('How do I define interfaces?', { thread });
```

## Tools Integration

Hataraku provides a powerful tool integration system.

### Built-in Tools

```typescript
import { Agent } from 'hataraku';

const agent = new Agent({
  // ...configuration
  tools: {
    calculator: {
      description: 'Performs mathematical calculations',
      execute: (input: string) => eval(input)
    },
    // Other tools...
  }
});
```

### Creating Custom Tools

```typescript
import { Tool } from 'hataraku';

// Define a custom tool
const fetchWeather: Tool = {
  name: 'fetchWeather',
  description: 'Fetches weather information for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The location to get weather for'
      }
    },
    required: ['location']
  },
  execute: async ({ location }) => {
    // Implementation to fetch weather data
    return { temperature: 72, condition: 'sunny' };
  }
};

// Use the custom tool
const agent = new Agent({
  // ...configuration
  tools: {
    fetchWeather
  }
});
```

## Model Providers

Hataraku supports multiple AI providers through a unified interface.

### OpenRouter

```typescript
import { Task } from 'hataraku';

const task = new Task({
  description: 'Explain quantum computing',
  model: 'openrouter/anthropic/claude-3.7-sonnet'
});
```

### Anthropic

```typescript
import { Task, createAnthropicProvider } from 'hataraku';

const provider = createAnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const task = new Task({
  description: 'Explain quantum computing',
  model: provider.getModel('claude-3-sonnet')
});
```

### Amazon Bedrock

```typescript
import { Task, createBedrockProvider, createBedrockModel } from 'hataraku';

// Create a Bedrock provider with default AWS profile
const bedrockModel = await createBedrockModel('default', 'us.anthropic.claude-3-7-sonnet-20250219-v1:0');

// Use the model with a task
const task = new Task({
  name: 'Explain Quantum Computing',
  description: 'Explain quantum computing concepts',
  agent: createAgent({
    name: 'Bedrock Agent',
    description: 'Agent powered by AWS Bedrock',
    role: 'You are a helpful assistant',
    model: bedrockModel
  })
});

// Execute the task
const result = await task.run('What is quantum entanglement?');
```

### OpenAI

```typescript
import { Task, createOpenAIProvider } from 'hataraku';

const provider = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY
});

const task = new Task({
  description: 'Explain quantum computing',
  model: provider.getModel('gpt-4')
});
```

## Advanced Features

### Schema Validation with Zod

```typescript
import { z } from 'zod';
import { Task } from 'hataraku';

// Define a schema for the response
const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
  skills: z.array(z.string())
});

// Create a task with schema validation
const task = new Task({
  description: 'Generate a profile for a software developer',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  schema: PersonSchema
});

// Execute the task
const person = await task.execute();
// person is typed as { name: string; age: number; skills: string[] }
```

### Streaming Responses

```typescript
import { Task } from 'hataraku';

// Create a streaming task
const task = new Task({
  description: 'Write a long essay about AI',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  stream: true
});

// Execute and process the streaming response
const stream = await task.execute();
for await (const chunk of stream) {
  console.log(chunk); // Process each chunk of the response
}
```

### Model Context Protocol (MCP)

```typescript
import { Task } from 'hataraku';
import { MCPToolProvider } from 'hataraku';

// Create an MCP tool provider
const mcpTools = new MCPToolProvider({
  // MCP configuration
});

// Use MCP tools in a task
const task = new Task({
  description: 'Help me troubleshoot this code',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: mcpTools.getTools()
});
``` 