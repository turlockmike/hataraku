# Persistence Implementation Plan

## Implementation Checklist

### 1. Setup Configuration Directory Structure
- [x] Implement XDG base directory support
- [x] Create directory structure helpers
- [x] Add configuration path resolution

### 2. Profile Management System
- [x] Implement profile configuration schema
- [x] Create profile CRUD operations
- [x] Add profile activation/switching

### 3. External Tool Configuration
- [x] Implement MCP server configuration loading
- [x] Add environment variable interpolation
- [x] Create tool enable/disable functionality
- [x] Add validation for tool configurations

### 4. Agent Configuration System
- [x] Implement agent configuration schema
- [x] Create agent CRUD operations
- [x] Add built-in tool resolution ('hataraku')
- [x] Implement agent validation

### 5. Task Configuration System
- [x] Implement task configuration schema
- [x] Create task CRUD operations
- [x] Add task template processing
- [x] Implement input schema validation

### 6. CLI Integration
- [x] Update CLI to use profile system
- [x] Add profile management commands
- [x] Implement configuration override handling
- [x] Add configuration validation commands

### 7. Configuration Loading
- [x] Implement ConfigLoader
- [x] Add effective configuration resolution
- [x] Implement configuration inheritance
- [x] Add validation system

### 8. First Run Experience
- [x] Create FirstRunManager
- [x] Implement default profile creation
- [x] Add setup wizard
- [x] Create initial configuration templates

### 9. Testing & Validation
- [ ] Add configuration schema tests
- [ ] Create validation test suite
- [ ] Add integration tests
- [ ] Implement compatibility checks

### 10. Documentation
- [ ] Create user guide for configuration
- [ ] Add profile management documentation
- [ ] Document built-in tools
- [ ] Add configuration examples

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
    }
  ]
}
```

#### Implementation Details
- Store external tool configurations in `tools/[name].json` as arrays
- Built-in Hataraku tools are referenced directly in agent configurations using `"hataraku"`
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
  tools?: string[];  // References to tool configurations or "hataraku" for built-in tools
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
    "hataraku",  // Includes all built-in Hataraku tools
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
    "hataraku",  // Includes all built-in Hataraku tools
    "jira-tools"
  ]
}
```

Built-in Hataraku tools available through `"hataraku"`:
- `search-files`: Search for files in the workspace
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

## CLI Integration

### Default Configuration

#### Configuration Schema

TypeScript:
```typescript
interface Profile {
  name: string;
  description?: string;
  agent?: string;        // Default agent name
  provider?: string;     // Default provider (openai, anthropic, etc.)
  model?: string;        // Default model for the provider
  tools?: string[];      // Default tool configurations to load
  options?: {
    stream?: boolean;    // Enable/disable streaming by default
    sound?: boolean;     // Enable/disable sound effects
    interactive?: boolean; // Enable/disable interactive mode
  };
}

interface ProfilesConfig {
  activeProfile: string;  // Name of the active profile
  profiles: Profile[];
}
```

JSON:
```json
// profiles.json
{
  "activeProfile": "default",
  "profiles": [
    {
      "name": "default",
      "description": "Default configuration using Claude",
      "provider": "anthropic",
      "model": "claude-3-opus",
      "tools": ["ai-tools", "dev-tools"],
      "options": {
        "stream": true,
        "sound": true,
        "interactive": false
      }
    },
    {
      "name": "coding",
      "description": "Profile optimized for coding tasks",
      "agent": "code-reviewer",
      "provider": "anthropic",
      "model": "claude-3-opus",
      "tools": ["github-tools"],
      "options": {
        "stream": true,
        "sound": false,
        "interactive": false
      }
    },
    {
      "name": "planning",
      "description": "Profile for project planning",
      "agent": "task-planner",
      "provider": "openai",
      "model": "gpt-4-turbo",
      "tools": ["jira-tools"],
      "options": {
        "stream": true,
        "sound": false,
        "interactive": true
      }
    }
  ]
}
```

#### Implementation Details
- Store in `$XDG_CONFIG_HOME/hataraku/profiles.json`
- Create with default profile during first run
- Allow override via CLI arguments
- Support environment variable interpolation
- Profiles can inherit from other profiles (using base profile name)

### CLI Command Updates

```bash
# Existing commands with new options
hataraku [task] --profile <profileName>  # Use specific profile
hataraku [task] --config <configPath>    # Use alternative config location

# Profile management commands
hataraku profile list                    # List all profiles
hataraku profile show [name]             # Show profile details
hataraku profile create <name>           # Create new profile
hataraku profile update <name>           # Update profile
hataraku profile delete <name>           # Delete profile
hataraku profile activate <name>         # Set active profile
hataraku profile export <name>           # Export profile
hataraku profile import <path>           # Import profile
```

### Configuration Loading Process

1. **Initialization**
   ```typescript
   interface ConfigLoader {
     // Load all configurations
     loadConfig(): Promise<{
       profiles: ProfilesConfig;
       tools: Record<string, ToolsConfig>;
       agents: Record<string, AgentConfig>;
       tasks: Record<string, TaskConfig>;
     }>;

     // Get effective configuration (after CLI overrides)
     getEffectiveConfig(cliOptions: CliOptions): Promise<{
       profile: Profile;
       agent: AgentConfig;
       tools: ToolsConfig[];
     }>;

     // Profile management
     getProfile(name: string): Promise<Profile>;
     createProfile(profile: Profile): Promise<void>;
     updateProfile(name: string, profile: Partial<Profile>): Promise<void>;
     deleteProfile(name: string): Promise<void>;
     activateProfile(name: string): Promise<void>;
   }
   ```

### Configuration Resolution Order

1. Command-line arguments (highest priority)
2. Environment variables
3. Project-specific profile (if in a project directory)
4. Active user profile from `profiles.json`
5. Default profile (lowest priority)

### First-Run Experience

```typescript
interface FirstRunManager {
  // Check if this is first run
  isFirstRun(): Promise<boolean>;
  
  // Initialize default configurations
  initializeDefaults(): Promise<void>;
  
  // Guide user through initial setup
  runSetupWizard(): Promise<void>;
}
```

Example first-run process:
1. Detect first run
2. Create configuration directory structure
3. Create `profiles.json` with default profile
4. Optionally run interactive setup wizard
5. Initialize empty tool, agent, and task directories

### Configuration Validation

```typescript
interface ConfigValidator {
  // Validate all configurations
  validateAll(): Promise<ValidationResult>;
  
  // Validate specific configuration
  validateConfig(type: 'defaults' | 'tools' | 'agents' | 'tasks', config: unknown): Promise<ValidationResult>;
  
  // Check configuration compatibility
  checkCompatibility(): Promise<CompatibilityResult>;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

## Implementation Tasks

1. **Setup Configuration Directory Structure**
   - Implement XDG base directory support
   - Create directory structure helpers
   - Add configuration path resolution

2. **Profile Management System**
   - Implement profile configuration schema
   - Create profile CRUD operations
   - Add profile activation/switching

3. **External Tool Configuration**
   - Implement MCP server configuration loading
   - Add environment variable interpolation
   - Create tool enable/disable functionality
   - Add validation for tool configurations

4. **Agent Configuration System**
   - Implement agent configuration schema
   - Create agent CRUD operations
   - Add built-in tool resolution ('hataraku')
   - Implement agent validation

5. **Task Configuration System**
   - Implement task configuration schema
   - Create task CRUD operations
   - Add task template processing
   - Implement input schema validation

6. **CLI Integration**
   - Update CLI to use profile system
   - Add profile management commands
   - Implement configuration override handling
   - Add configuration validation commands

7. **Configuration Loading**
   - Implement ConfigLoader
   - Add effective configuration resolution
   - Implement configuration inheritance
   - Add validation system

8. **First Run Experience**
   - Create FirstRunManager
   - Implement default profile creation
   - Add setup wizard
   - Create initial configuration templates

9. **Testing & Validation**
   - Add configuration schema tests
   - Create validation test suite
   - Add integration tests
   - Implement compatibility checks

10. **Documentation**
    - Create user guide for configuration
    - Add profile management documentation
    - Document built-in tools
    - Add configuration examples
