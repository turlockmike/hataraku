# Hataraku

An autonomous coding agent for building AI-powered development tools. The name "Hataraku" (働く) means "to work" in Japanese.

## Installation

```bash
# Install globally via npm
npm install -g hataraku

# Or run directly with npx
npx hataraku
```

## Environment Setup

Before using Hataraku, make sure to set your API key for your chosen provider:

```bash
# For OpenRouter (default)
export OPENROUTER_API_KEY=your_api_key_here

# Or for Anthropic
export ANTHROPIC_API_KEY=your_api_key_here

# Or for OpenAI
export OPENAI_API_KEY=your_api_key_here
```

## Quick Start

```bash
# Run a task
hataraku "create a react component that..."

# Interactive Mode (prompts for tasks)
hataraku -i

# With specific provider and model
hataraku --provider anthropic --model claude-3 "optimize this function..."

# List recent task history
hataraku --list-history

# Run without sound effects
hataraku --no-sound "create a test file"
```

## CLI Options

- `-p, --provider <provider>` - API provider to use (openrouter, anthropic, openai) [default: openrouter]
- `-m, --model <model>` - Model ID for the provider [default: anthropic/claude-3.5-sonnet]
- `-k, --api-key <key>` - API key for the provider (can also use environment variables)
- `-a, --max-attempts <number>` - Maximum number of consecutive mistakes before exiting [default: 3]
- `-l, --list-history` - List recent tasks from history
- `-i, --interactive` - Run in interactive mode, prompting for tasks
- `--no-sound` - Disable sound effects
- `-v, --version` - Output the version number
- `-h, --help` - Display help information

## Features

- Create and edit files with diff view and linting support
- Execute terminal commands with real-time output monitoring
- Launch and control browsers for testing and debugging
- Support for multiple AI providers (OpenRouter, Anthropic, OpenAI, etc.)
- Built-in tools for file operations, code analysis, and more
- Interactive mode with follow-up task suggestions
- Task history tracking and review
- Sound effects for task completion (can be disabled)

## Documentation

- [CLI Documentation](./docs/cli.md)
- [Examples](./examples/)

## Task History

Tasks are automatically saved in `~/.config/hataraku/tasks/` and include:
- Task ID and timestamp
- Input/output tokens
- Cost information
- Full conversation history

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details on how to get started.

## License

[Apache 2.0](./LICENSE)
