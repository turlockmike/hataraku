# Persistence Implementation Plan

## Overview

This document outlines the implementation plan for persistence in Hataraku, focusing on configuration management for tools (MCP servers), tasks, and agents. The system follows the XDG Base Directory Specification and integrates with existing patterns.

## Configuration Structure

### Base Directory Structure

Following XDG Base Directory Specification:

- **Configurations** (`$XDG_CONFIG_HOME/hataraku/` or `~/.config/hataraku/`):
  ```
  $XDG_CONFIG_HOME/hataraku/
  ├── tools/              # Tool configurations (MCP servers)
  │   ├── ai-tools.json
  │   ├── dev-tools.json
  │   └── [name].json
  ├── agents/            # Agent configurations
  │   └── [name].json
  └── tasks/            # Task configurations
      └── [name].json
  ```

- **Data** (`$XDG_DATA_HOME/hataraku/` or `~/.local/share/hataraku/`):
  ```
  $XDG_DATA_HOME/hataraku/
  └── logs/             # Task execution logs (existing)
  ```

## Component Specifications

### 1. Tools (MCP Servers)

#### Configuration Schema

TypeScript:
```typescript
interface ToolSetConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabledTools?: string[];  // Whitelist specific tools
  disabledTools?: string[];  // Blacklist specific tools
}

interface ToolsConfig {
  tools: ToolSetConfig[];
}
```

JSON:
```json
// tools/ai-tools.json
{
  "mcpServers": [
    {
      "name": "openai",
      "command": "node",
      "args": ["./dist/openai-server.js"],
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      },
      "disabledTools": [
        "image_generation",
        "audio_transcription"
      ]
    },
    {
      "name": "anthropic",
      "command": "python",
      "args": ["-m", "anthropic_server"],
      "env": {
        "ANTHROPIC_API_KEY": "${ANTHROPIC_API_KEY}"
      },
      "enabledTools": [
        "code_review",
        "documentation"
      ]
    }
  ]
}

// tools/dev-tools.json
{
  "mcpServers": [
    {
      "name": "github",
      "command": "node",
      "args": ["./dist/github-server.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    {
      "name": "jira",
      "command": "node",
      "args": ["./dist/jira-server.js"],
      "env": {
        "JIRA_API_TOKEN": "${JIRA_API_TOKEN}"
      }
    }
  ]
}

//tools/jira-tools.json
{
  "mcpServers": [
    {
      "name": "jira",
      "command": "node",
      "args": ["./dist/jira-server.js"],
      "env": {
        "JIRA_API_TOKEN": "${JIRA_API_TOKEN}"
      }
    }
  ]
}
```

#### Implementation Details
- Store tool configurations in `tools/[name].json` as arrays
- Allow both whitelist (enabledTools) and blacklist (disabledTools)
- Support environment variable interpolation

### 2. Agents

#### Configuration Schema

TypeScript:
```typescript
interface AgentConfig {
  name: string;
  description: string;
  role: string;
  model: {
    provider: string;
    name: string;
    parameters?: Record<string, unknown>;
  };
  tools?: string[];  // References to MCP tool names
}
```

JSON:
```json
// agents/code-reviewer.json
{
  "name": "Code Reviewer",
  "description": "Expert code review agent",
  "role": "You are an expert code reviewer...",
  "model": {
    "provider": "anthropic",
    "name": "claude-3-opus",
    "parameters": {
      "temperature": 0.7,
      "max_tokens": 4000
    }
  },
  "tools": [
    "jira-tools",
    "github-tools"
  ]
}

// agents/task-planner.json
{
  "name": "Task Planner",
  "description": "Project planning specialist",
  "role": "You are a project planning specialist...",
  "model": {
    "provider": "openai",
    "name": "gpt-4-turbo",
    "parameters": {
      "temperature": 0.3
    }
  },
  "tools": [
    "jira-tools",
    "google-docs-tools"
  ]
}
```

### 3. Tasks

#### Configuration Schema

TypeScript:
```typescript
interface TaskConfig {
  name: string;
  description: string;
  agent: string;  // Reference to agent configuration
  schema?: Record<string, unknown>;  // Input/output schema
  task: string | {
    template: string;
    parameters: string[];
  };
}
```

JSON:
```json
// tasks/review-pr.json
{
  "name": "Review Pull Request",
  "description": "Comprehensive code review for pull requests",
  "agent": "code-reviewer",
  "schema": {
    "type": "object",
    "properties": {
      "pr_url": {
        "type": "string",
        "description": "GitHub pull request URL"
      },
      "focus_areas": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "description": "Specific areas to focus review on"
      }
    }
  },
  "task": {
    "template": "Review the pull request at ${pr_url}.\nFocus on the following areas:\n${focus_areas.join('\\n- ')}",
    "parameters": ["pr_url", "focus_areas"]
  }
}

// tasks/plan-sprint.json
{
  "name": "Plan Sprint",
  "description": "Create a sprint plan from requirements",
  "agent": "task-planner",
  "schema": {
    "type": "object",
    "properties": {
      "requirements": {
        "type": "string",
        "description": "Sprint requirements document"
      },
      "team_size": {
        "type": "number",
        "description": "Number of team members"
      }
    }
  },
  "task": "Create a sprint plan based on the following requirements:\n${requirements}\n\nConsider team size of ${team_size} members."
}
```

## CLI Commands

```bash
# Tool Management (MCP Servers)
hataraku tools list                     # List all configured tools
hataraku tools add <name>              # Add new tool configuration
hataraku tools remove <name>           # Remove tool configuration
hataraku tools enable <name> [tool]    # Enable tool or specific capability
hataraku tools disable <name> [tool]   # Disable tool or specific capability
hataraku tools start                   # Start Hataraku MCP server

# Agent Management
hataraku agent list                    # List all agents
hataraku agent create <name>           # Create new agent
hataraku agent update <name>           # Update agent
hataraku agent delete <name>           # Delete agent
hataraku agent show <name>             # Show agent details

# Task Management
hataraku task list                     # List all tasks
hataraku task create <name>            # Create new task
hataraku task update <name>            # Update task
hataraku task delete <name>            # Delete task
hataraku task show <name>              # Show task details
hataraku task run <name> [input]       # Run task with optional input
hataraku task run <name> --agent <agent> [input]  # Run task with specific agent

# Configuration Management
hataraku config init                   # Initialize configuration directories
hataraku config validate               # Validate all configurations
hataraku config export                 # Export all configurations
hataraku config import <path>          # Import configurations
```

## API Design

```typescript
interface ConfigurationManager {
  // Tool Management
  listTools(): Promise<Record<string, ToolsConfig>>;
  addTool(name: string, config: ToolSetConfig): Promise<void>;
  removeTool(name: string): Promise<void>;
  enableTool(name: string, tool?: string): Promise<void>;
  disableTool(name: string, tool?: string): Promise<void>;
  
  // Agent Management
  listAgents(): Promise<string[]>;
  getAgent(name: string): Promise<AgentConfig>;
  createAgent(name: string, config: AgentConfig): Promise<void>;
  updateAgent(name: string, config: Partial<AgentConfig>): Promise<void>;
  deleteAgent(name: string): Promise<void>;
  
  // Task Management
  listTasks(): Promise<string[]>;
  getTask(name: string): Promise<TaskConfig>;
  createTask(name: string, config: TaskConfig): Promise<void>;
  updateTask(name: string, config: Partial<TaskConfig>): Promise<void>;
  deleteTask(name: string): Promise<void>;
  runTask(name: string, input?: unknown, options?: { agent?: string }): Promise<unknown>;
}
```
