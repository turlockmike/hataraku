# Tools System Documentation

Hataraku provides a powerful tools system that allows AI agents to interact with external systems and perform specialized tasks beyond basic text generation.

## Overview

Tools enable AI models to:
- Access external data and services
- Perform specialized calculations
- Execute system commands
- Process structured data
- And much more

## Tool Configuration

Hataraku stores tool configurations in JSON files following the XDG Base Directory Specification:

```
$XDG_CONFIG_HOME/hataraku/tools/     # (~/.config/hataraku/tools/)
├── ai-tools.json
├── dev-tools.json
└── [name].json
```

### Tool Configuration Format

Tools can define external MCP servers with environment variables:

```json
{
  "mcpServers": [
    {
      "name": "github",
      "command": "node",
      "args": ["./dist/github-server.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  ]
}
```

### Environment Variable Interpolation

Environment variables in tool configurations are interpolated at runtime. For example, `${GITHUB_TOKEN}` will be replaced with the value of the `GITHUB_TOKEN` environment variable.

## Built-in Tools

Hataraku includes several built-in tools that you can use out of the box. These tools are available through the special `"hataraku"` tool identifier:

```typescript
const agent = createAgent({
  // ... other config
  tools: ["hataraku"] // Includes all built-in tools
});
```

The special `"hataraku"` tool includes:

- `search-files`: Search for files
- `write-file`: Write content to files
- `read-file`: Read file contents
- `list-files`: List directory contents
- `play-audio`: Play audio files
- `search-and-replace`: Search and replace in files
- `show-image`: Display images
- `apply-diff`: Apply patches to files
- `execute-command`: Run shell commands
- `fetch`: Make HTTP requests
- `insert-content`: Insert content into files
- `list-code-definitions`: List code symbols and definitions

### Calculator Tool

Enables the AI to perform mathematical calculations:

```typescript
import { Agent, createAgent } from 'hataraku';

const agent = createAgent({
  name: 'MathAgent',
  description: 'Helps with math problems',
  role: 'Math assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: {
    calculator: {
      description: 'Performs mathematical calculations',
      execute: (input: string) => eval(input)
    }
  }
});

const result = await agent.task('Calculate the compound interest for $1000 at 5% for 3 years');
```

### Web Search Tool

Allows the AI to search the web for current information:

```typescript
import { Agent, createAgent, webSearchTool } from 'hataraku';

const agent = createAgent({
  name: 'ResearchAgent',
  description: 'Helps with research',
  role: 'Research assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: {
    webSearch: webSearchTool({
      apiKey: process.env.SEARCH_API_KEY
    })
  }
});

const result = await agent.task('Find the latest news about AI regulation');
```

### File System Tool

Enables the AI to read and write files:

```typescript
import { Agent, createAgent, fileSystemTools } from 'hataraku';

const agent = createAgent({
  name: 'FileAgent',
  description: 'Helps with file operations',
  role: 'File system assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: {
    ...fileSystemTools({
      basePath: './data', // Restrict to this directory for safety
      allowWrite: true
    })
  }
});

const result = await agent.task('Read the contents of config.json and update the version number');
```

### Code Analysis Tools

Tools for parsing, analyzing, and transforming code:

```typescript
import { Agent, createAgent, codeTools } from 'hataraku';

const agent = createAgent({
  name: 'CodeAgent',
  description: 'Helps with coding',
  role: 'Coding assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: {
    ...codeTools()
  }
});

const result = await agent.task('Analyze this JavaScript function and suggest improvements: function add(a, b) { return a + b }');
```

### Database Tools

Connect to databases and perform queries:

```typescript
import { Agent, createAgent, createDatabaseTool } from 'hataraku';

const agent = createAgent({
  name: 'DBAgent',
  description: 'Helps with database queries',
  role: 'Database assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: {
    query: createDatabaseTool({
      connectionString: process.env.DB_CONNECTION_STRING,
      // Additional database configuration
    })
  }
});

const result = await agent.task('Find all users who registered in the last month');
```

## Creating Custom Tools

You can create custom tools to extend the capabilities of your AI agents.

### Basic Custom Tool

```typescript
import { Agent, createAgent, Tool } from 'hataraku';

// Define a custom weather tool
const weatherTool: Tool = {
  name: 'getWeather',
  description: 'Gets weather information for a location',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The location to get weather for (city, country)'
      }
    },
    required: ['location']
  },
  execute: async ({ location }) => {
    // Implementation to fetch weather data from an API
    const response = await fetch(`https://weather-api.example.com?location=${encodeURIComponent(location)}`);
    const data = await response.json();
    return {
      temperature: data.temperature,
      conditions: data.conditions,
      forecast: data.forecast
    };
  }
};

// Use the custom tool
const agent = createAgent({
  name: 'WeatherAgent',
  description: 'Provides weather information',
  role: 'Weather assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: {
    getWeather: weatherTool
  }
});

const result = await agent.task('What is the weather like in New York?');
```

### Tools with Multiple Parameters

```typescript
import { Agent, createAgent, Tool } from 'hataraku';

// Define a booking tool
const bookingTool: Tool = {
  name: 'bookAppointment',
  description: 'Books an appointment on a specific date and time',
  parameters: {
    type: 'object',
    properties: {
      service: {
        type: 'string',
        description: 'The type of service (e.g., "haircut", "massage", "consultation")'
      },
      date: {
        type: 'string',
        description: 'The date for the appointment (YYYY-MM-DD)'
      },
      time: {
        type: 'string',
        description: 'The time for the appointment (HH:MM)'
      },
      name: {
        type: 'string',
        description: 'Customer name'
      },
      email: {
        type: 'string',
        description: 'Customer email'
      }
    },
    required: ['service', 'date', 'time', 'name', 'email']
  },
  execute: async ({ service, date, time, name, email }) => {
    // Implementation to book an appointment
    const response = await fetch('https://booking-api.example.com/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service, date, time, name, email })
    });
    
    const data = await response.json();
    return {
      success: data.success,
      appointmentId: data.appointmentId,
      message: data.message
    };
  }
};
```

### Tool with Stream Response

```typescript
import { Agent, createAgent, Tool, createStreamResponse } from 'hataraku';

// Define a streaming news tool
const streamingNewsTool: Tool = {
  name: 'getLatestNews',
  description: 'Gets latest news articles in real-time',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'News topic (e.g., "technology", "sports", "politics")'
      },
      count: {
        type: 'number',
        description: 'Number of articles to retrieve'
      }
    },
    required: ['topic']
  },
  execute: async ({ topic, count = 5 }) => {
    // Create a streaming response
    return createStreamResponse(async (emit) => {
      // Simulate fetching news in chunks
      const topics = ['Latest headlines', 'Breaking news', 'Updates', 'In-depth analysis', 'Expert opinions'];
      
      for (let i = 0; i < count; i++) {
        // In a real implementation, this would fetch from an API
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await emit({
          title: `${topics[i % topics.length]}: ${topic} news item ${i+1}`,
          summary: `This is a summary of the latest ${topic} news...`,
          timestamp: new Date().toISOString()
        });
      }
    });
  }
};
```

## Tool Composition

You can compose multiple tools together to create more powerful capabilities:

```typescript
import { Agent, createAgent, fileSystemTools, webSearchTool } from 'hataraku';

// Create a research agent with multiple tools
const researchAgent = createAgent({
  name: 'ResearchAgent',
  description: 'Helps with research and document creation',
  role: 'Research assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: {
    ...fileSystemTools({ basePath: './research', allowWrite: true }),
    webSearch: webSearchTool({ apiKey: process.env.SEARCH_API_KEY }),
    summarize: {
      description: 'Summarizes a long text',
      execute: async (text: string) => {
        // Implement summarization logic
        const summary = text.split('.').slice(0, 3).join('.') + '.';
        return summary;
      }
    }
  }
});

const result = await researchAgent.task(
  'Research the latest developments in quantum computing, summarize the findings, and save the summary to a file'
);
```

## Tool Context and State

Tools can maintain context and state between invocations:

```typescript
import { Agent, createAgent, Tool } from 'hataraku';

// Create a stateful shopping cart tool
const createCartTool = () => {
  // Private state
  const cart: {item: string, quantity: number}[] = [];
  
  // Return multiple tools that share state
  return {
    addToCart: {
      name: 'addToCart',
      description: 'Adds an item to the shopping cart',
      parameters: {
        type: 'object',
        properties: {
          item: {
            type: 'string',
            description: 'The item to add'
          },
          quantity: {
            type: 'number',
            description: 'The quantity to add'
          }
        },
        required: ['item', 'quantity']
      },
      execute: ({ item, quantity }) => {
        cart.push({ item, quantity });
        return { success: true, message: `Added ${quantity} ${item}(s) to cart` };
      }
    },
    
    viewCart: {
      name: 'viewCart',
      description: 'Views the current shopping cart',
      parameters: {
        type: 'object',
        properties: {}
      },
      execute: () => {
        return { 
          items: cart,
          total: cart.length 
        };
      }
    },
    
    clearCart: {
      name: 'clearCart',
      description: 'Clears the shopping cart',
      parameters: {
        type: 'object',
        properties: {}
      },
      execute: () => {
        const count = cart.length;
        cart.length = 0;
        return { success: true, message: `Cleared ${count} items from cart` };
      }
    }
  };
};

// Use the stateful cart tools
const agent = createAgent({
  name: 'ShoppingAgent',
  description: 'Helps with shopping',
  role: 'Shopping assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: createCartTool()
});

const result = await agent.task('Add 2 apples and 3 bananas to my cart, then show me what\'s in my cart');
```

## MCP Servers

Hataraku supports the Model Context Protocol (MCP) for advanced tool integrations. You can configure external MCP servers in your tool configuration files:

```typescript
import { Agent, createAgent, MCPToolProvider } from 'hataraku';

// Create an MCP tool provider
const mcpTools = new MCPToolProvider({
  servers: [
    {
      name: "github",
      command: "node",
      args: ["./dist/github-server.js"],
      env: {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN
      }
    }
  ]
});

// Use the MCP tools in an agent
const agent = createAgent({
  name: 'GitHubAgent',
  description: 'Helps with GitHub operations',
  role: 'GitHub assistant',
  model: 'openrouter/anthropic/claude-3.7-sonnet',
  tools: mcpTools.getTools()
});
```

## Best Practices

1. **Clear Descriptions**: Provide clear, detailed descriptions for your tools to help the AI understand when and how to use them.

2. **Error Handling**: Implement robust error handling in your tool executions:

```typescript
execute: async (params) => {
  try {
    // Tool implementation
    return { success: true, data: result };
  } catch (error) {
    console.error('Tool execution error:', error);
    return { 
      success: false, 
      error: error.message || 'Unknown error',
      details: error
    };
  }
}
```

3. **Parameter Validation**: Define clear parameter schemas and validate inputs:

```typescript
import { z } from 'zod';

// Define a schema for tool parameters
const LocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number()
});

// Validate in the execute function
execute: async (params) => {
  try {
    const validatedParams = LocationSchema.parse(params);
    // Proceed with validated parameters
  } catch (error) {
    return { success: false, error: 'Invalid parameters' };
  }
}
```

4. **Rate Limiting**: Implement rate limiting for tools that call external APIs:

```typescript
const createRateLimitedTool = (tool, limitPerMinute) => {
  const timestamps = [];
  
  return {
    ...tool,
    execute: async (params) => {
      const now = Date.now();
      timestamps.push(now);
      
      // Remove timestamps older than 1 minute
      const oneMinuteAgo = now - 60000;
      const recentCalls = timestamps.filter(t => t > oneMinuteAgo);
      
      if (recentCalls.length > limitPerMinute) {
        return { success: false, error: 'Rate limit exceeded' };
      }
      
      return tool.execute(params);
    }
  };
};
```

5. **Security Considerations**: Be careful with tools that have access to sensitive operations like file system or database access. Always restrict permissions and validate inputs thoroughly.

6. **Documentation**: Document your tools well, especially custom ones, so other developers can understand how to use them. 