# Hataraku MCP Server Documentation

## Overview
The Hataraku MCP server exposes Hataraku tasks as MCP tools, allowing other applications to leverage Hataraku's task execution capabilities through the Model Context Protocol.

## Server Setup Guide

### Installation
1. Install dependencies:
```bash
npm install @modelcontextprotocol/sdk
```

2. Import the server:
```typescript
import { HatarakuMcpServer } from './core/mcp/server/hatarakuMcpServer';
```

### Configuration
The server uses the following default configuration:
```typescript
{
  name: 'hataraku-mcp-server',
  version: '1.0.0',
  capabilities: {
    tools: {}
  }
}
```

### Starting the Server
```typescript
const server = new HatarakuMcpServer();
await server.start();
```

## Available Tools
The server automatically discovers and exposes all tasks defined in `src/core/tasks/` as MCP tools. Currently available tools:

### Code Analysis Tool
- Name: `Analyze Code`
- Description: Analyze code for complexity and issues
- Input Schema:
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "Code to analyze"
    },
    "stream": {
      "type": "boolean",
      "description": "Enable streaming output",
      "optional": true
    }
  }
}
```

### Bug Analysis Tool
- Name: `Debug Issue`
- Description: Analyze bug reports and provide solutions
- Input Schema:
```json
{
  "type": "object",
  "properties": {
    "description": {
      "type": "string",
      "description": "Bug description"
    },
    "stackTrace": {
      "type": "string",
      "description": "Stack trace if available",
      "optional": true
    },
    "reproduction": {
      "type": "string",
      "description": "Steps to reproduce",
      "optional": true
    },
    "stream": {
      "type": "boolean",
      "description": "Enable streaming output",
      "optional": true
    }
  }
}
```

### PR Review Tool
- Name: `Review Pull Request`
- Description: Review code changes and provide feedback
- Input Schema:
```json
{
  "type": "object",
  "properties": {
    "diff": {
      "type": "string",
      "description": "PR diff content"
    },
    "description": {
      "type": "string",
      "description": "PR description"
    },
    "stream": {
      "type": "boolean",
      "description": "Enable streaming output",
      "optional": true
    }
  }
}
```

### Refactoring Plan Tool
- Name: `Plan Refactoring`
- Description: Create a structured plan for code refactoring
- Input Schema:
```json
{
  "type": "object",
  "properties": {
    "code": {
      "type": "string",
      "description": "Code to refactor"
    },
    "goals": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Refactoring goals"
    },
    "stream": {
      "type": "boolean",
      "description": "Enable streaming output",
      "optional": true
    }
  }
}
```

## Integration Guide

### Connecting to the Server
```typescript
import { McpClient } from '@modelcontextprotocol/sdk/client';

const client = new McpClient();
await client.connect('stdio'); // or other transport
```

### Using Tools
```typescript
// List available tools
const tools = await client.listTools();

// Execute a tool
const result = await client.callTool('Analyze Code', {
  code: 'function example() { return true; }'
});
```

### Error Handling
The server uses standard MCP error codes:
- `MethodNotFound`: Tool not found
- `InvalidRequest`: Invalid tool arguments or execution error
- `ExecutionError`: Task execution failed

Example error handling:
```typescript
try {
  await client.callTool('NonexistentTool', {});
} catch (error) {
  if (error instanceof McpError) {
    console.error(`MCP Error: ${error.code} - ${error.message}`);
  }
}
```

### Streaming Support
All tools support streaming output by setting the `stream` parameter:
```typescript
const result = await client.callTool('Analyze Code', {
  code: 'function example() { return true; }',
  stream: true
});

for await (const chunk of result.content[0].stream) {
  console.log(chunk);
}
```

## Future Enhancements
1. Task Filtering
   - Allow configuring which tasks are exposed as tools
   - Support task versioning

2. Advanced Configuration
   - Custom task discovery paths
   - Tool-specific settings

3. Monitoring & Metrics
   - Task execution statistics
   - Performance monitoring
   - Usage analytics