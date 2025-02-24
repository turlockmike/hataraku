# Hataraku Quick Start Guide

This guide will help you get started with Hataraku, an autonomous coding agent and SDK.

## Installation

```bash
# Install Hataraku globally
npm install -g hataraku

# Or use with npx without installing
npx hataraku
```

## First Run

When you first run Hataraku, it will ask you to set up a profile:

```bash
hataraku
```

Follow the prompts to configure your default profile with:
- Provider (OpenRouter, Anthropic, Bedrock)
- Model (Claude, GPT-4, etc.)
- Default settings for streaming, sound, and interactive mode

## Basic Usage

```bash
# Ask Hataraku to perform a task
hataraku "create a hello world app in React"

# Use interactive mode (-i) for multiple tasks
hataraku -i

# Disable streaming responses
hataraku --no-stream "write a test for this function"

# Disable sound effects
hataraku --no-sound "explain this code"
```

## Using Profiles

Profiles let you save different configurations:

```bash
# Create a new profile
hataraku profile create

# List all profiles
hataraku profile list

# Show profile details
hataraku profile show coding

# Activate a profile
hataraku profile activate coding

# Use a specific profile without activating it
hataraku --profile coding "refactor this code"
```

## Using Tasks

Tasks are saved operations that can be reused:

```bash
# List available tasks
hataraku task list

# Show task details
hataraku task show code-review

# Run a task (will prompt for inputs)
hataraku task run code-review
```

## Configuration Files

Hataraku stores configuration in:
- `~/.config/hataraku/` (Linux/macOS)
- `%APPDATA%\hataraku\` (Windows)

Important files:
- `profiles.json`: Profile settings
- `agents/*.json`: Agent configurations
- `tasks/*.json`: Task definitions
- `tools/*.json`: Tool configurations

See the [Configuration Guide](configuration.md) for more details.

## Environment Variables

Set up the following environment variables based on your provider:

```bash
# For OpenRouter
export OPENROUTER_API_KEY="your-api-key"

# For Anthropic
export ANTHROPIC_API_KEY="your-api-key"

# For OpenAI
export OPENAI_API_KEY="your-api-key"

# For AWS Bedrock
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

## Common Commands

```bash
# Get help
hataraku --help

# Show version
hataraku --version

# Initialize or reset configuration
hataraku init

# Show configuration summary
hataraku config
```

## Examples

```bash
# Code review
hataraku "review my react component in src/components/Button.js"

# Explain code
hataraku "explain how auth.js works in my project"

# Create a new file
hataraku "create a utility function for formatting dates"

# Debug an issue
hataraku "help me debug this error: TypeError: Cannot read property 'map' of undefined"

# Run a more complex task with a specific agent
hataraku task run code-review --agent code-reviewer
```

For more detailed information, see the [full documentation](./README.md).