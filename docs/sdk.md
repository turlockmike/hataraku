# Hataraku SDK (Proposed)

🛠️ Build your own AI-powered development tools with a clean, intuitive API.

## Installation

```bash
npm install @hataraku/sdk
```

## Quick Start

```typescript
import { Agent, AgentConfig } from '@hataraku/sdk';

const agent = new Agent({
  name: 'CodeReviewer',
  provider: 'anthropic',
  model: 'claude-3',
  role: 'Expert code reviewer focusing on security and performance',
  capabilities: ['read_files', 'analyze_code', 'create_pr']
});

await agent.runTask({
  instruction: 'Review this PR for security issues',
  context: {
    prNumber: 123,
    repository: 'org/repo'
  }
});
```

## Features

### 🔌 Extensible with MCP
Add new capabilities through the Model Context Protocol:
- Create custom tools that integrate with your workflow
- Access external APIs and services
- Share tools across your organization
- Built-in MCP servers for common operations

### Custom Tools Example

```typescript
import { Agent, Tool } from '@hataraku/sdk';

// Create custom tools
const gitTool = new Tool({
  name: 'create_branch',
  description: 'Create a new git branch',
  parameters: {
    name: { type: 'string', required: true },
    baseBranch: { type: 'string', default: 'main' }
  },
  async execute(context) {
    // Implementation
  }
});

// Configure agent
const agent = new Agent({
  name: 'GitAutomation',
  tools: [gitTool]
});

// Run tasks
await agent.runTask('create a feature branch for ticket ABC-123');
```

Note: This SDK is currently in proposal stage and the API may change. 