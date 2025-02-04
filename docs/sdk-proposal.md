# Hataraku SDK Proposal

## Overview

Hataraku is a powerful framework that serves three main purposes:
1. A headless agentic client for running AI-powered tasks and automation
2. An MCP (Multi-Context Protocol) server for creating and managing agents
3. An SDK framework for building and running your own agents

It offers a clean, intuitive API for creating agents, defining custom tools, managing tasks, and handling the complete lifecycle of AI interactions.

## SDK Core Concepts

### Agents

Agents are the primary actors in the Hataraku ecosystem. They can be configured with specific capabilities, tools, and behaviors, and can be run either through the headless client or as part of your own application using the SDK.

### Tools

Tools are the building blocks that agents use to interact with the world. They can be anything from API calls to database operations to complex business logic. Supports Zod for parameter validation.

### Default Tools

The SDK comes with a comprehensive set of built-in tools organized by category:

#### File System
- `read_file`: Read contents of a file
- `write_to_file`: Write or append content to a file
- `apply_diff`: Apply code changes with diff support
- `list_files`: List files in a directory
- `search_and_replace`: Pattern-based text replacement
- `search_files`: Search for files using patterns or content

#### CLI
- `execute_shell`: Run shell commands with configurable options

#### MCP (Multi-Context Protocol)
- `use_mcp_tool`: Execute tools from connected MCP servers
- `access_mcp_resource`: Access resources from MCP servers
- `get_mcp_prompts`: Retrieve prompts from MCP servers


#### Browser
- `fetch`: Make HTTP requests with Playwright support
- `show_image`: Display images in supported environments

#### Audio/Visual
- `play_audio`: Play audio files with configurable options

#### Utilities
- `attempt_completion`: Try to complete a task with retries
- `websearch`: Perform web searches (requires Tavily integration)
- `notifications`: Send system notifications (macOS)
- `prompt_user`: Request input from the user

### Threads

Threads maintain conversation history and context between task executions. They enable agents to persist state and share context across multiple interactions.

### Tasks

Tasks represent units of work that agents can perform. They can be one-off commands or part of larger workflows.

## SDK API Design

### Creating an Agent

```typescript
import { Agent, AgentConfig } from 'hataraku';
import { MCPClient } from 'hataraku/mcp';
import { DefaultTools } from 'hataraku/tools';

const mcpClient = MCPClient.fromConfig(path.join(__dirname, 'servers.json'));

// Optional: Configure the agent
const config: AgentConfig = {
  name: 'CodeAssistant', 
  model: {
    name: 'claude-3', // optional, defaults to 'claude-3'
    provider: 'anthropic', // optional, defaults to 'anthropic'
    apiKey: process.env.ANTHROPIC_API_KEY, // optional, defaults to process.env.ANTHROPIC_API_KEY
  }, 
  instructions: `You are an expert coding assistant that helps users write, review, and debug code.`,
  tools: [
    ...mcpClient.listTools(),
    ...DefaultTools,
  ],
  taskConfig: {
    maxAttempts: 3, // Max number of model attempts for a task before erroring out
    maxTimeout: 60, // Max number of seconds for a full task
    maxRequests: 10, // Max number of model requests for a task
    maxTools: 10, // Max number of tool calls for a task
    contextSize: 1000000, // Max number of tokens for a task
    parallelism: 3, // Max number of tools to use in parallel, defaults to 1 no parallelism, Infinity for unlimited
  },
  otelConfig: {
    serviceName: 'code-assistant',
    enabled: true,
    sampling: {
      type: 'ratio',
      probability: 0.5,
    },
    export: {
      type: 'otlp',
      endpoint: 'https://otel-collector.example.com/v1/traces',
      headers: {
        Authorization: 'Bearer YOUR_TOKEN_HERE',
      },
    },
  },
};

// Create the agent
const agent = new Agent(config);

// Optionally start the agent. This will load any MCP servers and tools to preload any dependencies.
await agent.initialize();
```

### Defining Custom Tools

```typescript
import { Tool, ToolContext } from 'hataraku';
import { z } from 'zod';

// Define a custom tool for code analysis
const codeAnalysisTool = new Tool({
  name: 'analyze_code',
  description: 'Analyze code for potential issues and improvements',
  // Zod schema for parameter validation
  inputSchema: z.object({
    filePath: z.string(),
    language: z.string(),
    lintRules: z.array(z.string()).optional()
  }),
  outputSchema: z.object({
    issues: z.array(z.object({
      type: z.enum(['error', 'warning', 'suggestion']),
      line: z.number(),
      message: z.string(),
      fix: z.string().optional()
    })),
    metrics: z.object({
      complexity: z.number(),
      maintainability: z.number(),
      testCoverage: z.number().optional()
    })
  }),
  async execute(context: ToolContext) {
    const { filePath, language, lintRules } = context.params;
    // Implementation of code analysis logic
    const analysis = await analyzeCode(filePath, language, lintRules);
    return {
      issues: analysis.issues,
      metrics: analysis.metrics
    }
  }
});
```

### Running Tasks

```typescript
// Create a persistent thread for the agent
const codeThread = new Thread();

// Simple code review
const result = await agent.task({
  role: 'user',
  content: 'Review the code in src/main.ts for potential improvements',
  thread: codeThread,
});

// Streaming output
const result = await agent.task({
  role: 'user',
  content: 'Help me debug the error in src/utils/parser.ts',
  thread: codeThread,
  stream: true,
});

for await (const chunk of result) {
  console.log(chunk);
}
```

### Getting structured output with tasks

```typescript
const result = await agent.task({
  role: 'user',
  content: 'Analyze the code quality metrics for src/utils/parser.ts',
  thread: codeThread,
  outputSchema: z.object({
    issues: z.array(z.object({
      type: z.enum(['error', 'warning', 'suggestion']),
      line: z.number(),
      message: z.string(),
      fix: z.string().optional()
    })),
    metrics: z.object({
      complexity: z.number(),
      maintainability: z.number(),
      testCoverage: z.number().optional()
    })
  }), // Automatically parses the output into the schema.
});

console.log(result);
// {
//   issues: [
//     { type: 'warning', line: 23, message: 'Unused variable', fix: 'Remove unused variable' }
//   ],
//   metrics: {
//     complexity: 12,
//     maintainability: 85,
//     testCoverage: 76.5
//   }
// }
```

### Adding Context to Tasks

Tasks can be enriched with additional context to help the agent make better decisions. Context can be added in several ways:

```typescript
// Add context
const thread = new Thread();
thread.addContext({
  key: 'project_info',
  content: {
    language: 'typescript',
    framework: 'react',
    testRunner: 'jest'
  }
});

thread.addFileContext({
  name: 'tsconfig.json',
  content: configBuffer,
  type: 'application/json'
});

// Add context directly in the task
const result = await agent.task({
  role: 'user',
  content: 'Review the code in src/components/Button.tsx',
  thread: thread,
  context: {
    priority: 'high',
    accessibility: true,
    platform: 'web'
  }
});

// Add files as context
const result = await agent.task({
  role: 'user',
  content: 'Debug the failing test',
  thread: thread,
  context: [new FileContext({
    name: 'test.log',
    content: logBuffer,
    type: 'text/plain'
  }), 
  new FileContext({
    name: 'screenshot.png',
    content: screenshotBuffer,
    type: 'image/png'
  })]
});
```

## Running as an MCP Server

Hataraku can be run as an MCP server to provide agent capabilities to other applications:

```typescript
import { MCPServer, MCPServerConfig } from 'hataraku/mcp';

const config: MCPServerConfig = {
  port: 3000,
  host: 'localhost',
  agents: {
    codeAssistant: {
      // Agent config as shown above
    },
    documentationWriter: {
      // Another agent config
    }
  },
  auth: {
    type: 'apiKey',
    keys: ['your-api-key']
  }
};

const server = new MCPServer(config);
await server.start();
```

## Additional Features

- [x] Parallel tool execution
- [x] Tool chaining (output of one tool as input to another)
- [x] MCP Resources, Prompts, Tools, Sampling, and roots
- [x] Headless operation mode
- [x] Extensive CLI support
- [x] OpenTelemetry integration
- [x] Streaming responses
- [x] Structured output validation
- [x] Context management
- [x] File handling and code analysis
- [x] Custom tool development

## Logging, Debugging, and Observability

Aside from otel configuration, you can also hook into events to log and debug the agent.

```typescript
agent.on('tool_call', (toolCall) => {
  console.log(`Tool call: ${toolCall.name}`);
});

agent.on('tool_result', (toolResult) => {
  console.log(`Tool result: ${toolResult.name}`);
});

agent.on('task_start', (task) => {
  console.log(`Task started: ${task.id}`);
});

agent.on('task_end', (task) => {
  console.log(`Task ended: ${task.id}`);
});

agent.on('task_error', (task, error) => {
  console.error(`Task error: ${task.id}`, error);
});
```


Context is preserved throughout the thread's lifetime and can be accessed by the agent and its tools during task execution. This enables more informed decision-making and maintains consistency across multiple interactions.



# Additional Features

- [ ] Can run tools in parallel
- [ ] Tool chaining to support the output of one tool being the input of another tool.
- [ ] Supports MCP Resources, Prompts, Tools, Sampling, and roots.


# CLI

The Hataraku CLI provides comprehensive commands for running agents headlessly and managing MCP servers:

## Commands

### Running Agents Headlessly

```bash
# Task Execution
hataraku task run 'prompt'                                     # Run a task with the default agent
hataraku task run --agent <agent-id> 'prompt'                 # Run with specific agent
hataraku task run --schedule "every day at 9am" 'prompt'      # Schedule task execution
hataraku task run --tools *,my_custom_tool.ts                 # Run with specific tools
hataraku task run --files *.ts,*.pdf                          # Include files as context
hataraku task run --context '{"key": "value"}'                # Add custom context
hataraku task run --disable-mcp                               # Disable MCP server connections
hataraku task run --disable-parallelization                   # Disable tool parallelization
hataraku task run --watcher *.ts                              # Watch files and rerun on changes
hataraku task run --max-parallelism 3                        # Set tool parallelism level

# Task Management
hataraku task list                                            # List running tasks
hataraku task show <task-id>                                  # Show task details
hataraku task logs <task-id> [--follow]                       # Show task output
hataraku task cancel <task-id>                                # Cancel scheduled task
```

# Templates

Hataraku comes with a set of templates for common agentic tasks.

```bash
hataraku template list
hataraku template use <template-name>
```

### MCP Server Management

```bash
# Server Operations
hataraku mcp serve                                            # Start MCP server
hataraku mcp serve --config mcp.config.json                   # Start with config file
hataraku mcp serve --port 3000                                # Start on specific port

# Interactive Agent Management
hataraku mcp agent create                                     # Start interactive agent creation wizard
                                                             # - Configure model and provider
                                                             # - Set instructions and capabilities
                                                             # - Select and configure tools
                                                             # - Set task limits and parallelism
                                                             # - Configure observability

hataraku mcp agent update <name>                              # Start interactive agent update wizard
                                                             # - Modify existing configuration
                                                             # - Add/remove tools
                                                             # - Update instructions
                                                             # - Adjust resource limits

hataraku mcp agent list                                       # List available agents
hataraku mcp agent info <name>                                # Show detailed agent configuration
hataraku mcp agent delete <name>                              # Remove agent (with confirmation)
hataraku mcp agent export <name>                              # Export agent config to file
hataraku mcp agent import <file>                              # Import agent from config file

# Interactive Tool Management
hataraku mcp tool create                                      # Start interactive tool creation wizard
                                                             # - Define tool interface with Zod
                                                             # - Configure execution settings
                                                             # - Set up authentication
                                                             # - Add documentation
                                                             # - Test tool functionality

hataraku mcp tool update <name>                               # Start interactive tool update wizard
                                                             # - Modify tool configuration
                                                             # - Update schemas
                                                             # - Adjust settings

hataraku mcp tool list                                        # List available tools
hataraku mcp tool info <name>                                 # Show detailed tool configuration
hataraku mcp tool delete <name>                               # Remove tool (with confirmation)
hataraku mcp tool export <name>                               # Export tool config to file
hataraku mcp tool import <file>                               # Import tool from config file

# Resource Management
hataraku mcp resource list                                    # List MCP resources
hataraku mcp resource add <path>                              # Add resource
hataraku mcp resource remove <name>                           # Remove resource

# Configuration
hataraku config set <key> <value>                            # Set config option
hataraku config get <key>                                     # Get config value
hataraku config list                                          # Show all config

Note: The --schedule parameter accepts natural language timing expressions like:
- "every Monday at 2pm"
- "daily at midnight"
- "in 2 hours"
- "tomorrow at 3pm"
- "every 15 minutes"
- "next Friday at noon"
```
