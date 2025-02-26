# Architecture Documentation

This document provides an overview of Hataraku's architecture, design patterns, and core components.

## System Architecture

Hataraku is structured as a modular toolkit for building AI-powered development tools and autonomous coding agents. The architecture follows these core principles:

1. **Modularity**: Components are designed to be used independently or together
2. **Extensibility**: Easy to extend with custom tools, providers, and workflows
3. **Type Safety**: Leverages TypeScript for strong typing and IDE support
4. **Provider Abstraction**: Unified interface across multiple AI providers

## High-Level Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                        User Applications                       │
└───────────────┬───────────────────────────────┬───────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────┐     ┌───────────────────────────┐
│           CLI             │     │           SDK             │
└───────────────┬───────────┘     └───────────┬───────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────────────────────────────────────────┐
│                        Core Components                         │
├───────────────┬───────────────┬───────────────┬───────────────┤
│    Agents     │     Tasks     │   Workflows   │    Threads    │
└───────┬───────┴───────┬───────┴───────┬───────┴───────┬───────┘
        │               │               │               │
        ▼               ▼               ▼               ▼
┌───────────────────────────────────────────────────────────────┐
│                       Provider Interface                       │
├───────────────┬───────────────┬───────────────┬───────────────┤
│  OpenRouter   │   Anthropic   │    Bedrock    │    OpenAI     │
└───────────────┴───────────────┴───────────────┴───────────────┘
```

## Core Components

### 1. Agent

The `Agent` class serves as the primary interface for interacting with AI models. It orchestrates the execution of tasks and manages tool interactions.

**Key Responsibilities:**
- Task execution
- Tool coordination
- Response processing
- Schema validation
- Thread management

**Design Pattern:** Facade - provides a simplified interface to the complex subsystem of language model interactions.

### 2. Task

The `Task` class represents a single unit of work for an AI model to complete. Tasks are the fundamental building blocks for AI interactions.

**Key Responsibilities:**
- Describing the work to be done
- Configuring model parameters
- Handling execution modes (streaming, schema validation)
- Processing results

**Design Pattern:** Command - encapsulates a request as an object, allowing for parameterization and queueing of requests.

### 3. Workflow

The `Workflow` system orchestrates multi-step operations, managing the flow of data between steps and handling dependencies.

**Key Responsibilities:**
- Step sequencing
- Parallel execution
- Data passing between steps
- Error handling and recovery

**Design Pattern:** Pipeline - allows processing pieces of data through a series of computational steps.

### 4. Thread

The `Thread` class manages conversation history for context-aware AI interactions.

**Key Responsibilities:**
- Storing conversation history
- Managing context window limits
- Providing context for follow-up tasks

**Design Pattern:** Memento - captures and restores the internal state of an object without violating encapsulation.

### 5. Provider Interface

The provider interface abstracts away the specific details of different AI model providers, allowing for seamless switching between providers.

**Key Responsibilities:**
- Unified interface for all providers
- Model configuration
- Request/response handling
- Error normalization

**Design Pattern:** Adapter - allows incompatible interfaces to work together through a wrapper.

## Data Flow

```
┌───────────┐      ┌───────────┐      ┌───────────┐      ┌───────────┐
│  User     │      │  Agent    │      │  Provider │      │  Model    │
│  Code     │ ─────► Interface │ ─────► Interface │ ─────► API       │
└───────────┘      └─────┬─────┘      └───────────┘      └─────┬─────┘
                         │                                     │
                         │                                     │
                         ▼                                     ▼
                   ┌───────────┐                        ┌───────────┐
                   │  Tools    │                        │  Response │
                   │  System   │                        │  Handling │
                   └───────────┘                        └───────────┘
```

1. **Request Flow**: 
   - User code creates an Agent or Task
   - Configured with a model, tools, and schema
   - Request processed through provider interface
   - Provider forwards to appropriate model API

2. **Response Flow**:
   - Model API returns response
   - Provider normalizes response format
   - Response processed (validation, streaming)
   - Tools executed if applicable
   - Final result returned to user code

## Key Design Patterns

### Factory Pattern

Used for creating instances of Agents, Tasks, and Providers:

```typescript
// Agent factory
export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
}

// Task factory
export function createTask(config: TaskConfig): Task {
  return new Task(config);
}

// Provider factory
export function createAnthropicProvider(config: AnthropicConfig): ProviderV1 {
  return new AnthropicProvider(config);
}
```

### Strategy Pattern

Used for selecting different model providers:

```typescript
interface ProviderV1 {
  getModel(modelId: string): LanguageModelV1;
}

class AnthropicProvider implements ProviderV1 {
  getModel(modelId: string): LanguageModelV1 {
    // Implementation specific to Anthropic
  }
}

class BedrockProvider implements ProviderV1 {
  getModel(modelId: string): LanguageModelV1 {
    // Implementation specific to Bedrock
  }
}
```

### Decorator Pattern

Used for enhancing tools with additional functionality:

```typescript
function withLogging(tool: Tool): Tool {
  return {
    ...tool,
    execute: async (params) => {
      console.log('Tool execution started:', tool.name, params);
      const result = await tool.execute(params);
      console.log('Tool execution completed:', tool.name, result);
      return result;
    }
  };
}
```

### Observer Pattern

Used for streaming responses:

```typescript
// Model execution with streaming
async execute(prompt: string, options?: CallOptions): Promise<AsyncIterableStream<string>> {
  const stream = await this.api.completions.create({
    prompt,
    stream: true,
    // other options
  });
  
  // Observers can consume the stream
  return stream;
}
```

## Directory Structure

Hataraku's codebase is organized as follows:

```
src/
├── cli/                  # Command line interface
├── core/                 # Core components
│   ├── agent.ts          # Agent implementation
│   ├── task.ts           # Task implementation
│   ├── workflow/         # Workflow system
│   ├── thread/           # Thread management
│   ├── tools/            # Tool implementations
│   ├── providers/        # Provider implementations
│   └── mcp/              # Model Context Protocol
├── config/               # Configuration handling
├── utils/                # Utility functions
├── services/             # External service integrations
├── types.ts              # Common type definitions
└── cli.ts                # CLI entry point
```

## Extensibility Points

Hataraku is designed to be extended in various ways:

1. **Custom Tools**: Create new tools by implementing the Tool interface
2. **Custom Providers**: Create providers for new AI services
3. **Custom Workflows**: Build custom workflows by extending the Workflow class
4. **Schema Extensions**: Define specialized schemas for domain-specific tasks
5. **MCP Extensions**: Extend the Model Context Protocol with custom capabilities

## Performance Considerations

Hataraku implements several strategies for optimizing performance:

1. **Lazy Loading**: Components are loaded only when needed
2. **Streaming**: Large responses are streamed instead of waiting for complete response
3. **Caching**: Results are cached where appropriate
4. **Parallel Execution**: Tasks can be executed in parallel
5. **Connection Pooling**: Provider connections are reused when possible

## Security Considerations

Security is a priority in Hataraku's design:

1. **Input Validation**: All user inputs are validated
2. **API Key Management**: Secure handling of API keys
3. **Permissions**: Tools with system access have customizable permission boundaries
4. **Error Handling**: Errors are handled gracefully without exposing sensitive information
5. **Rate Limiting**: Prevents abuse of external APIs 