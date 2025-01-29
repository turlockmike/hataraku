# Extend Agent Framework Proposal

## Overview

The Extend Agent Framework provides a powerful, flexible framework for building AI-powered agents and automation tools. It offers a clean, intuitive API for creating agents, defining custom tools, managing tasks, and handling the complete lifecycle of AI interactions.

## SDK Core Concepts

### Agents

Agents are the primary actors in the Extend ecosystem. They can be configured with specific capabilities, tools, and behaviors.

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

## CLI Configuration

The CLI provides a configurable runner for the SDK with these key settings:

```typescript
interface HatarakuConfig {
  defaultProvider: 'anthropic' | 'openai' | 'local';
  defaultModel: string;
  maxTimeout: number; // in seconds
  maxRetries: number;
  // Enables MCP server integrations
}
```

## SDK API Design

### Creating an Agent

```typescript
import { Agent, AgentConfig } from 'hataraku';
import { MCPClient } from 'hataraku/mcp';
import { DefaultTools } from 'hataraku/tools';

const mcpClient = MCPClient.fromConfig(path.join(__dirname, 'servers.json'));

// Optional: Configure the agent
const config: AgentConfig = {
  name: 'ClaimsProcessor', 
  model: {
    name: 'claude-3', // optional, defaults to 'claude-3'
    provider: 'anthropic', // optional, defaults to 'anthropic'
    apiKey: process.env.ANTHROPIC_API_KEY, // optional, defaults to process.env.ANTHROPIC_API_KEY
  }, 
  instructions: `You are an expert in processing warranty claims and detecting potential fraud patterns.`,
  tools: [
    ...mcpClient.listTools(),
    ...DefaultTools,
  ],
  maxAttempts: 3, // Max number of attempts for a task
  maxTimeout: 60, // Max number of seconds for a task
  maxRetries: 3, // Max number of retries for a task
  maxRequests: 10, // Max number of requests for a task
  maxTools: 10, // Max number of tool calls for a task
  contextSize: 1000000, // Max number of tokens for a task
  parallelism: 10, // Max number of tools to use in parallel, defaults to 1 no parallelism, Infinity for unlimited

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

// Define a custom tool for warranty validation
const warrantyValidationTool = new Tool({
  name: 'validate_warranty',
  description: 'Validate warranty eligibility and coverage',
  // Zod schema for parameter validation
  inputSchema: z.object({
    orderId: z.string(),
    productSku: z.string(),
    purchaseDate: z.coerce.date().optional()
  }),
  outputSchema: z.object({
    eligible: z.boolean(),
    planSku: z.string(),
    expirationDate: z.coerce.date(),
    coverages: z.array(z.string())
  }),
  async execute(context: ToolContext) {
    const { orderId, productSku, purchaseDate } = context.params;
    // Implementation of warranty validation logic
    const res = await extendApi.getWarranty(orderId, productSku, purchaseDate);
    return {
      eligible: res.eligible,
      planSku: res.planSku,
      expirationDate: res.expirationDate,
      coverages: res.coverages
    }
  }
});
```
### Running Tasks

```typescript

// Create a persistent thread for the agent.

const claimThread = new Thread();

// Simple claim processing
const result = await agent.task({
  role: 'user',
  content: 'Process warranty claim for order #12345',
  thread: claimThread,
});
```

### Getting structured output with tasks

```typescript
const result = await agent.task({
  role: 'user',
  content: 'Process warranty claim for order #12345',
  thread: claimThread,
  outputSchema: z.object({
    eligible: z.boolean(),
    planSku: z.string(),
    expirationDate: z.coerce.date(),
    coverages: z.array(z.string())
  }), // Automatically parses the output into the schema.
});

console.log(result);
// {
//   eligible: true,
//   planSku: '12345',
//   expirationDate: '2025-01-01',
//   coverages: ['coverage1', 'coverage2']
// }
```

### Adding Context to Tasks

Tasks can be enriched with additional context to help the agent make better decisions. Context can be added in several ways:

```typescript
// Add context through thread memory
const thread = new Thread();
thread.addMemory({
  key: 'customer_info',
  content: {
    id: '12345',
    tier: 'premium',
    purchaseHistory: ['SKU123', 'SKU456']
  }
});

// Add context directly in the task
const result = await agent.task({
  role: 'user',
  content: 'Process warranty claim for order #12345',
  thread: thread,
  context: {
    priority: 'high',
    previousClaims: 2,
    productCategory: 'electronics'
  }
});

// Add files as context
const result = await agent.task({
  role: 'user',
  content: 'Review this warranty claim',
  thread: thread,
  files: [
    {
      name: 'receipt.pdf',
      content: receiptBuffer,
      type: 'application/pdf'
    },
    {
      name: 'damage_photo.jpg',
      content: photoBuffer,
      type: 'image/jpeg'
    }
  ]
});

// Combine multiple context types
const result = await agent.task({
  role: 'user',
  content: 'Evaluate this warranty claim',
  thread: thread,
  context: {
    priority: 'high',
    customerHistory: customerData
  },
  files: [attachmentBuffer],
  metadata: {
    source: 'customer_portal',
    timestamp: new Date()
  }
});
```

Context is preserved throughout the thread's lifetime and can be accessed by the agent and its tools during task execution. This enables more informed decision-making and maintains consistency across multiple interactions.



# Additional Features

- [ ] Can run tools in parallel
- [ ] Tool chaining to support the output of one tool being the input of another tool.
- [ ] Supports MCP Resources, Prompts, Tools, Sampling, and roots.


# CLI

## Commands

### `hataraku 'prompt'`

Runs a task with the given prompt.

#### Options

### Task Commands
```bash
# Task Execution (with optional agent and schedule)
hataraku task run 'prompt'                                     # Immediate execution, uses default agent, 1 time.
hataraku task run --agent <agent-id> 'prompt'                 # Execute with specific agent
hataraku task run --schedule "every day at 9am" 'prompt'      # Scheduled execution
hataraku task run --help                                      # Show configuration options for running tasks
hataraku task run --tools *,my_custom_tool.ts                 # Run with specific tools
hataraku task run --files *.txt,*.pdf,*.jpg,*.png              # Run with specific files as context
hataraku task run --context '{"key": "value"}'                 # Run with specific context
hataraku task run --disable-mcp                              # Disable MCP server
hataraku task run --disable-parallelization                     # Disable parallelization
hataraku task run --watcher *.ts                              # Watch for changes in the given files and rerun the task
hataraku task run --no-sound                                    # Disable sound when the task is complete
hataraku task run --no-notifications                            # Disable notifications when the task is complete

# Configuration
hataraku config --help                                        # Show configuration options
hataraku config --set <key> <value>                          # Set a configuration option
hataraku config --get <key>                                  # Get a configuration option

# Agent Management
hataraku agent list                                        # List all agents
hataraku agent show <agent-name>                             # Show agent details
hataraku agent logs <agent-name> [--follow]                  # Show agent output
hataraku agent create <agent-name>                         # Create a new agent interactively, including tools and instructions
hataraku agent delete <agent-name>                         # Delete an agent
hataraku agent update <agent-name>                         # Update an agent with new instructions or tools interactively
# Task Management
hataraku task list                                        # List all currently running tasks
hataraku task show <task-id>                             # Show task details
hataraku task logs <task-id> [--follow]                  # Show task output
hataraku task cancel <task-id>                           # Cancel scheduled task

# MCP Management
hataraku mcp list                                        # List all MCP servers
hataraku mcp show <mcp-name>                             # Show MCP server details
hataraku mcp logs <mcp-name> [--follow]                  # Show MCP server output
hataraku mcp add <mcp-name>                         # Add a new MCP server interactively. 
hataraku mcp delete <mcp-name>                         # Delete an MCP server
hataraku mcp config                                # returns location of the mcp config file

# Hataraku as an MCP Server. Allows you to run Hataraku as an MCP server to create tasks and tools.
hataraku mcp serve --help                              # Show configuration options for running an MCP server

```

Note: The --schedule parameter accepts natural language timing expressions like:
- "every Monday at 2pm"
- "daily at midnight"
- "in 2 hours"
- "tomorrow at 3pm"
- "every 15 minutes"
- "next Friday at noon"
