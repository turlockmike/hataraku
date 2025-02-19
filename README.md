# Hataraku

An autonomous coding agent and SDK for building AI-powered development tools. The name "Hataraku" (働く) means "to work" in Japanese.

[![npm version](https://badge.fury.io/js/hataraku.svg)](https://badge.fury.io/js/hataraku)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Description

Hataraku is a powerful toolkit that enables the creation of AI-powered development tools and autonomous coding agents. It provides a flexible SDK and CLI for building intelligent development workflows, code analysis, and automation tasks.

## Key Features

- 🤖 Autonomous coding agent capabilities
- 🛠️ Extensible SDK for building AI-powered tools
- 📦 Support for multiple AI providers (OpenRouter, Claude, Amazon Bedrock)
- 🔄 Workflow automation and parallel task execution
- 📊 Schema validation and structured tasks
- 🧰 Built-in tool integration system
- 🔗 Model Context Protocol (MCP) support

## Installation

```bash
# Using npm
npm install hataraku

# Using yarn
yarn add hataraku

# Using pnpm
pnpm add hataraku
```

## Quick Start

### Basic Usage

```typescript
import { Task } from 'hataraku';

// Create a simple task
const task = new Task({
  description: "Write a hello world function",
  model: "openrouter/anthropic/claude-3-opus"
});

// Execute the task
const result = await task.execute();
```

### Using the CLI

```bash
# Install globally
npm install -g hataraku

# Run the CLI
hataraku
```

## API Overview

Hataraku provides several core components:

- `Task`: Create and execute AI-powered tasks
- `Agent`: Build autonomous coding agents
- `Workflow`: Orchestrate complex multi-step operations
- `Tools`: Integrate custom capabilities and external services

For detailed API documentation, see the [Types Documentation](docs/types.md).

## Documentation

- [Agent Documentation](docs/agent.md) - Learn about autonomous agents
- [CLI Commands](docs/cli-commands.md) - Available CLI commands and options
- [MCP Integration](docs/mcp.md) - Model Context Protocol integration
- [Types Reference](docs/types.md) - Complete type definitions
- [Workflow Guide](docs/workflow-proposal.md) - Building complex workflows

## Examples

The package includes various examples demonstrating different features:

- Basic task execution
- Streaming responses
- Schema validation
- Multi-step workflows
- Tool integration
- Thread management

Run examples using:

```bash
npm run example:basic
npm run example:stream
npm run example:workflow
# See package.json for more examples
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/turlockmike/hataraku/issues)
- Documentation: See the [docs](./docs) directory for detailed guides