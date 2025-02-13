# MCP (Model Context Protocol) Integration

The MCP integration allows Hataraku to communicate with external tools through the Model Context Protocol. This enables agents to use various tools like Jira, GitHub, and other MCP-compatible services.

## Configuration

MCP tools can be configured in three ways:

1. Default Configuration (JSON)
```json
// ~/.hataraku/mcp_settings.json
{
  "mcpServers": {
    "extend-cli": {
      "command": "ec",
      "args": ["mcp"],
      "env": {
        "HOME": "${HOME}"
      }
    }
  }
}
```

2. Custom Configuration File
```typescript
const tools = await getMcpTools({
  configPath: '/path/to/my/mcp_settings.json'
});
```

3. Inline Configuration
```typescript
const tools = await getMcpTools({
  config: {
    mcpServers: {
      'extend-cli': {
        command: 'ec',
        args: ['mcp'],
        env: {
          HOME: process.env.HOME,
        },
        disabledTools: ['jira_update_ticket'], // Optionally disable specific tools
      },
    },
  },
});
```

## Environment Variables

Configuration values can include environment variable references using ${VAR_NAME} syntax:

```json
{
  "mcpServers": {
    "jira": {
      "command": "jira-cli",
      "args": ["mcp"],
      "env": {
        "JIRA_API_KEY": "${JIRA_API_KEY}",
        "JIRA_HOST": "${JIRA_HOST}"
      }
    }
  }
}
```

## Usage Examples

### Basic Usage
```typescript
import { getMcpTools } from '@hataraku/core';

// Get MCP tools using default config
const tools = await getMcpTools();

// Create an agent with MCP tools
const agent = createAgent({
  name: 'MCP-enabled Agent',
  description: 'An agent that can use MCP tools',
  role: 'You are a helpful assistant that can use various tools.',
  model: model,
  tools: tools,
});
```

### Jira Integration Example
```typescript
import { getMcpTools } from '@hataraku/core';

async function main() {
  // Configure MCP tools
  const tools = await getMcpTools({
    config: {
      mcpServers: {
        'extend-cli': {
          command: 'ec',
          args: ['mcp'],
          env: {
            HOME: process.env.HOME,
          },
        },
      },
    },
  });

  // Get Jira ticket
  const ticketId = 'EX-14';
  const result = await tools['extend-cli_jira_get_ticket'].execute(
    { ticketId },
    { toolCallId: 'test-call', messages: [] }
  );

  console.log('Ticket Details:', result);
}
```

### Tool Execution Monitoring
```typescript
const tools = await getMcpTools({
  config: {
    mcpServers: {
      'extend-cli': {
        command: 'ec',
        args: ['mcp'],
      },
    },
  },
  onToolCall: (serverName, toolName, args, resultPromise) => {
    console.log(`Executing ${serverName}/${toolName} with args:`, args);
    resultPromise.then(
      result => console.log(`Tool execution succeeded:`, result),
      error => console.error(`Tool execution failed:`, error)
    );
  },
});
```

## Error Handling

The MCP integration includes robust error handling:

1. Configuration Errors
```typescript
try {
  await getMcpTools({ configPath: '/invalid/path' });
} catch (error) {
  if (error instanceof McpConfigError) {
    console.error('Configuration error:', error.message);
    if (error.originalError) {
      console.error('Original error:', error.originalError);
    }
  }
}
```

2. Tool Execution Errors
```typescript
try {
  await tools['extend-cli_jira_get_ticket'].execute(
    { ticketId: 'INVALID-1' },
    { toolCallId: 'test-call', messages: [] }
  );
} catch (error) {
  if (error instanceof McpToolError) {
    console.error(
      `Error executing ${error.serverName}/${error.toolName}:`,
      error.originalError
    );
  }
}
```

## Troubleshooting

Common issues and solutions:

1. Tool Not Found
- Ensure the MCP server is installed and running
- Check the command and args in your configuration
- Verify the tool name matches what's provided by the server

2. Configuration Errors
- Validate your JSON configuration syntax
- Ensure all required environment variables are set
- Check file permissions for config files

3. Tool Execution Errors
- Verify the tool's required arguments
- Check server-specific authentication (e.g., Jira API tokens)
- Look for error details in the McpToolError