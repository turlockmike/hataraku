# Hataraku Configuration Guide

This document describes the configuration system for Hataraku, an autonomous coding agent and SDK.

## Overview

Hataraku uses a persistent configuration system that follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html). This allows for:

- **Profiles**: Different configurations for different use cases
- **Tasks**: Saved task definitions with templating support
- **Agents**: Agent configuration with role, model, and tools
- **Tools**: External tool configurations (MCP servers) with environment variables

## Directory Structure

Hataraku stores its configuration in the following locations:

```
$XDG_CONFIG_HOME/hataraku/         # (~/.config/hataraku/)
├── profiles.json                  # Profile definitions
├── tools/                         # Tool configurations
│   ├── ai-tools.json
│   ├── dev-tools.json
│   └── [name].json
├── agents/                        # Agent configurations
│   ├── code-assistant.json
│   ├── code-reviewer.json
│   └── [name].json
└── tasks/                         # Task configurations
    ├── code-review.json
    ├── explain-code.json
    └── [name].json
```

And data in:

```
$XDG_DATA_HOME/hataraku/           # (~/.local/share/hataraku/)
└── logs/                          # Task execution logs
```

## Profile Configuration

A profile is a set of preferences for Hataraku, including which provider and model to use, which tools to load, and other options.

### Example Profile

```json
{
  "name": "coding",
  "description": "Profile optimized for coding tasks",
  "provider": "anthropic",
  "model": "claude-3-7-sonnet-20250219",
  "agent": "code-assistant",
  "tools": ["ai-tools", "github-tools"],
  "options": {
    "stream": true,
    "sound": true,
    "maxRetries": 3,
    "maxSteps": 50
  }
}
```

### CLI Profile Commands

```bash
# List all profiles
hataraku profile list

# Show profile details
hataraku profile show [name]

# Create a new profile
hataraku profile create

# Use a profile
hataraku profile use <name>
```

## Agent Configuration

An agent defines the role, model, and tools used for a specific task.

### Example Agent Configuration

```json
{
  "name": "Code Reviewer",
  "description": "Expert code review agent",
  "role": "You are an expert code reviewer...",
  "model": {
    "provider": "anthropic",
    "name": "claude-3-7-sonnet-20250219",
    "parameters": {
      "temperature": 0.7,
      "maxTokens": 4000
    }
  },
  "tools": [
    "hataraku",
    "github-tools"
  ]
}
```

The special `"hataraku"` tool includes all built-in tools:

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

## Task Configuration

Tasks define saved operations that can be run with the CLI.

### Example Task Configuration

```json
{
  "name": "Code Review",
  "description": "Comprehensive code review for pull requests or specific files",
  "agent": "code-reviewer",
  "schema": {
    "type": "object",
    "properties": {
      "files": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Array of file paths to review"
      },
      "focus_areas": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Specific areas to focus review on"
      }
    },
    "required": ["files"]
  },
  "task": "Review the following files:\n${files.join('\\n- ')}\n\nFocus on the following areas:\n${focus_areas ? focus_areas.join('\\n- ') : 'All aspects of code quality and best practices'}",
  "parameters": "files,focus_areas"
}
```

### CLI Task Commands

```bash
# List all tasks
hataraku task list

# Show task details
hataraku task show <name>

# Run a task
hataraku task run <name>

# Run a task with a specific agent
hataraku task run <name> --agent <agent>
```

## Tool Configuration

Tools define external MCP servers with environment variables.

### Example Tool Configuration

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

## Environment Variable Interpolation

Environment variables in tool configurations are interpolated at runtime. For example, `${GITHUB_TOKEN}` will be replaced with the value of the `GITHUB_TOKEN` environment variable.

## CLI Options

Hataraku supports various command-line options that can override settings from the active profile:

```bash
# Use a specific profile
hataraku --profile coding "refactor this code"

# Use a specific agent
hataraku --agent code-reviewer "review my code"

# Use a specific provider and model
hataraku --provider openai --model gpt-4 "explain this code"

# Disable streaming or sound
hataraku --no-stream --no-sound "create a test file"

# Use interactive mode
hataraku -i "initial prompt"
```

## First Run Experience

When you run Hataraku for the first time, it will:

1. Create the configuration directories
2. Prompt you to create a default profile
3. Initialize default configurations

You can also manually initialize the configuration:

```bash
# Run the interactive setup wizard
hataraku init

# Create default configurations without prompts
hataraku init --yes
```

## Configuration Resolution Order

When running a command, Hataraku resolves the configuration in the following order (highest priority first):

1. Command-line arguments
2. Environment variables
3. Active profile settings
4. Default settings

## Advanced Usage

### Custom Providers

You can configure custom providers by setting the provider and model in a profile:

```json
{
  "name": "custom-model",
  "provider": "openrouter",
  "model": "deepseek/deepseek-r1",
  "options": {
    "stream": true
  }
}
```

### Available Models

#### Anthropic
- `claude-3-7-sonnet-20250219` - Recommended for most tasks
- `claude-3-5-sonnet-20241022` - Fast and efficient

#### OpenRouter
- `anthropic/claude-3.7-sonnet` - Anthropic's Claude 3.7 Sonnet
- `anthropic/claude-3.5-sonnet` - Anthropic's Claude 3.5 Sonnet
- `google/gemini-2.0-flash-001` - Google's Gemini 2.0 Flash
- `google/gemini-flash-1.5` - Google's Gemini Flash 1.5
- `deepseek/deepseek-r1` - DeepSeek R1
- `openai/gpt-4o-mini` - OpenAI GPT-4o Mini

#### Bedrock
- `us.anthropic.claude-3-7-sonnet-20250219-v1:0` - Claude 3.7 Sonnet
- `us.anthropic.claude-3-5-sonnet-20241022-v2:0` - Claude 3.5 Sonnet

### Task Templates

Tasks can use templates with parameter substitution:

```json
{
  "task": "Explain the code in ${file} with ${detail_level || 'medium'} level of detail.",
  "parameters": "file,detail_level"
}
```

The template supports JavaScript expressions within the `${}` placeholders, allowing for conditional logic and string operations. Parameters are specified as a comma-separated string.

### Bedrock Integration

To use AWS Bedrock, set the provider to `bedrock`:

```json
{
  "name": "bedrock-claude",
  "provider": "bedrock",
  "model": "us.anthropic.claude-3-7-sonnet-20250219-v1:0",
  "options": {
    "stream": true
  }
}
```

Make sure your AWS credentials are properly configured.

## Best Practices

1. **Create Specialized Profiles**: Create different profiles for different tasks, such as coding, documentation, or data analysis.

2. **Use Task Templates**: Define templates for common tasks to save time and ensure consistency.

3. **Organize Tool Configurations**: Group related tools in separate configuration files.

4. **Use Environment Variables**: Store API keys and tokens in environment variables rather than in configuration files.

5. **Create Custom Agents**: Define specialized agents for specific tasks, with tailored roles and tools.