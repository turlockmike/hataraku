# Hataraku

An autonomous coding agent and SDK for building AI-powered development tools. The name "Hataraku" (働く) means "to work" in Japanese, reflecting its dual nature as both a worker (CLI tool) and a framework for building workers (SDK).

## Features

### 🤖 CLI Tool
- Create and edit files with diff view and linting support
- Execute terminal commands with real-time output monitoring
- Launch and control browsers for testing and debugging
- Support for multiple AI providers (OpenRouter, Anthropic, OpenAI, etc.)
- Built-in tools for file operations, code analysis, and more

### 🛠️ SDK Framework
Build your own AI-powered development tools with a clean, intuitive API:

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

### 🔌 Extensible with MCP
Add new capabilities through the Model Context Protocol:
- Create custom tools that integrate with your workflow
- Access external APIs and services
- Share tools across your organization
- Built-in MCP servers for common operations

## Installation

```bash
# Install CLI tool
npm install -g hataraku

# Install SDK for development
npm install @hataraku/sdk
```

## Quick Start

### CLI Usage
```bash
# Run a task
hataraku "create a react component that..."

# With specific provider
hataraku --provider anthropic "optimize this function..."
```

### SDK Usage
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

## Documentation

- [CLI Documentation](./docs/cli.md)
- [SDK Reference](./docs/sdk.md)
- [MCP Guide](./docs/mcp.md)
- [Examples](./examples/)

## Contributing

1. Clone the repository:
```bash
git clone https://github.com/turlockmike/hataraku.git
```

2. Install dependencies:
```bash
npm install
```

3. Run in development:
```bash
npm run dev
```

## License

[Apache 2.0](./LICENSE)
