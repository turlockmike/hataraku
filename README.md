# Hataraku

An autonomous coding agent and SDK for building AI-powered tools. The name "Hataraku" (働く) means "to work" in
Japanese.

[![npm version](https://badge.fury.io/js/hataraku.svg)](https://badge.fury.io/js/hataraku)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Description

Hataraku is a powerful toolkit that enables the creation of AI-powered development tools and autonomous coding agents.
It provides a flexible SDK and CLI for building intelligent development workflows, code analysis, and automation tasks.

## Key Features

- 🤖 Autonomous coding agent capabilities
- 🛠️ Extensible SDK for building AI-powered tools
- 📦 Support for multiple AI providers (OpenRouter, Claude, Amazon Bedrock)
- 🧠 AWS Bedrock Knowledge Base integration for RAG applications
- 🔄 Workflow automation and parallel task execution
- 📊 Schema validation and structured tasks
- 🧰 Built-in tool integration system
- 🔗 Model Context Protocol (MCP) support
- 🔄 Extends the powerful AI SDK from Vercel.

## Installation

```bash
# Using npm
npm install -g hataraku

# Using yarn
yarn global add hataraku

# Using pnpm
pnpm global add hataraku
```

## Quick Start

### SDK Usage

```typescript
// Import the SDK
import { createAgent, createTask } from 'hataraku'
import { z } from 'zod'

// Bring in any ai-sdk provider https://sdk.vercel.ai/providers/ai-sdk-providers
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

// Create an agent using Claude via OpenRouter
// You can pass API key directly or use environment variable
const openrouter = createOpenRouter({
  apiKey: 'YOUR_OPENROUTER_API_KEY',
})
const model = openrouter.chatModel('anthropic/claude-3.5-sonnet')

const agent = createAgent({
  name: 'MyAgent',
  description: 'A helpful assistant',
  role: 'You are a helpful assistant that provides accurate information.',
  model: model,
})

// Run a one-off task
const result = await agent.task('Create a hello world function')

// Create a simple reusable task with schema validation
const task = createTask({
  name: 'HelloWorld',
  description: 'Say Hello to the user',
  agent: agent,
  inputSchema: z.object({ name: z.string() }),
  task: ({ name }) => `Say hello to ${name} in a friendly manner`,
})

// Execute the task
const result = await task.run({ name: 'Hataraku' })
console.log(result)
```

### CLI Usage

First, install the CLI globally:

```bash
npm install -g hataraku
```

Initialize a new project:

```bash
hataraku init my-project
cd my-project
```

Run a task using the CLI:

```bash
# Run a predefined task
hataraku task run hello-world

# Run with custom input
hataraku task run hello-world --input '{"prompt": "Write a function that calculates factorial"}'

# Run with streaming output
hataraku task run hello-world --stream
```

Configure providers and explore available commands:

```bash
# Configure a provider
hataraku provider configure openrouter

# List all available commands
hataraku --help
```

### Enhancing Output with Glow

Hataraku's output can be enhanced using [Glow](https://github.com/charmbracelet/glow), a terminal-based markdown viewer
that makes the output more readable and visually appealing.

#### Installing Glow

```bash
# macOS
brew install glow

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install glow

# Windows with Chocolatey
choco install glow
```

#### Using Glow with Hataraku

Create a function in your shell configuration file (`.bashrc`, `.zshrc`, etc.):

```bash
# Alias for Hataraku
alias h="hataraku"

# Function to pipe Hataraku output to Glow
hd() {
  hataraku "$@" | glow -
}
```

Now you can use the `hd` command to run Hataraku with enhanced output:

For more details, see the [Glow Integration Guide](docs/glow-guide.md).

## API Overview

Hataraku provides several core components:

- `Task`: Create and execute AI-powered tasks
- `Agent`: Build autonomous coding agents
- `Workflow`: Orchestrate complex multi-step operations
- `Tools`: Integrate custom capabilities and external services

For detailed API documentation, see the [Types Documentation](docs/types.md).

## Documentation

- [Agent Documentation](docs/agent.md) - Learn about autonomous agents
- [CLI Reference](docs/cli.md) - Available CLI commands and options
- [API Reference](docs/api-reference.md) - Complete API reference
- [Configuration Guide](docs/configuration.md) - Configuration options
- [Providers](docs/providers.md) - Supported AI providers
- [Knowledge Base](docs/knowledge-base.md) - AWS Bedrock Knowledge Base integration
- [Tools](docs/tools.md) - Built-in tools and extensions
- [Architecture](docs/architecture.md) - System architecture
- [Troubleshooting](docs/troubleshooting.md) - Solving common issues
- [Glow Integration](docs/glow-guide.md) - Using Glow to enhance Hataraku output

## Examples

The package includes various examples in the `/examples` directory demonstrating different features:

- Basic task execution
- Streaming responses
- Schema validation
- Multi-step workflows
- Tool integration
- Thread management

These examples are available for reference in the repository and can be examined to understand different use cases and
implementation patterns.

See the [examples README](examples/README.md) for more details.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- GitHub Issues: [Report bugs or request features](https://github.com/turlockmike/hataraku/issues)
- Documentation: See the [docs](./docs) directory for detailed guides
