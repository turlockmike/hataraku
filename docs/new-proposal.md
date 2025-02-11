# Hataraku – Agents, Tasks & CLI Documentation

## Overview
Hataraku is a framework that lets you define agents with specific tasks. Each agent encapsulates its own capabilities—including a set of tasks, tools, and instructions. Agents and tasks can be registered in centralized storage and loaded from YAML files, making the system highly modular, versionable, and easy to manage via a CLI.

## Value Proposition
- **Modular**: Agents and tasks are highly reusable and can be used across different workflows.
- **Versionable**: Agents and tasks can be versioned and rolled back to previous versions.
- **Easy to Manage**: Agents and tasks can be managed via persistance or synced from remote sources.
- **Easy to Use**: Agents and tasks can be used in a simple to use API.
- **Observability**: Task execution metrics, agent performance analytics, resource usage tracking for better sharing and consistency and testing of agents. 
- **Integrations**: Can easily be converted for use with other AI Agent frameworks such as AWS Bedrock via cdk.



## Key Concepts
1. **Agents** – An agent represents a specialized entity that can perform one or more tasks. Each agent defines:
   - A name and description
   - A model (if applicable) such as OpenAI's GPT-4
   - A list of tools (by name) and detailed instructions
   - A registry of tasks it can execute
   - By coupling the agent with a specific model, tools and instructions, the agent can be used in a reusable and consistent way across different workflows.
2. **Tasks** – Tasks define what an agent does when processing input. Each task is defined by:
   - A name and description
   - A schema (via Zod) for validating outputs
   - A prompt (or a function generating a prompt from the input)
   - A list of required tools
   - By coupling the task with a specific schema, prompt and required tools, the task can be used in a reusable and consistent way instead of users having to constantly be expert prompt engineers.
3. **Tools** – Reusable capabilities that agents can leverage in their tasks
   - Tools are created programmatically from vercel's AI SDK or loaded via MCP as a client from a config file.
4. **Workflows** – Workflows are defined by a sequence of tasks that are executed in a specific order. In this initial implementation, workflows are defined by executing a sequence of tasks (in parallel or sequentially) in code.

## Code Implementation



```typescript
// Import required dependencies
import { createAgent, createTask, createTool, hataraku, Tool } from 'hataraku';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Define a tool
const readDiff = createTool({
  name: 'read_diff',
  description: 'Reads a diff file',
  parameters: z.object({
    diff: z.string()
  }),
  execute: async ({ diff }: { diff: string }) => {
    // TODO: Implement the logic to read the diff file
    return {
      message: 'Diff file read successfully',
      diff: diff
    };
  }
});

// Load tools from MCP Server
const tools = await hataraku.loadToolsFromMCP('./config/mcp-settings.json');
const analyzeComplexity = tools.find(tool => tool.name === 'analyze_complexity');


// Define base types for agents and tasks
type TaskBlueprint<TInput, TOutput> = {
  name: string;
  description: string;
  schema: z.ZodType<TOutput>;
  prompt: string | ((input: TInput) => string);
  requiredTools?: Tool[];
};

type Agent<TTasks extends Record<string, TaskBlueprint<any, any>>> = {
  name: string;
  description: string;
  defaultModel?: any;
  tools: Tool[];
  instructions: string[];
  tasks: TTasks;
  executeTask<TName extends keyof TTasks>(
    taskName: TName,
    input: Parameters<TTasks[TName]['prompt']>[0]
  ): Promise<z.infer<TTasks[TName]['schema']>>;
};

// Define a task schema
const codeAnalysisSchema = z.object({
  impactLevel: z.enum(['high', 'medium', 'low']),
  changedComponents: z.array(z.string()),
  potentialRisks: z.array(z.string()),
  complexity: z.number().min(1).max(10),
  testCoverage: z.number().min(0).max(100)
});

// Example agent definition
const codeAnalyzer = createAgent({
  name: 'Code Analyzer',
  description: 'Analyzes code changes and provides structured feedback',
  defaultModel: openai('gpt-4-turbo'),
  tools: [readDiff, analyzeComplexity],
  instructions: [
    'Focus on understanding code changes and their impact',
    'Consider both direct and indirect effects of changes',
    'Evaluate complexity and risk factors'
  ]
});

const analyzeDiff = createTask({
  name: 'Analyze Code Diff',
  agent: codeAnalyzer,
  description: 'Performs initial analysis of code changes',
  schema: codeAnalysisSchema,
  prompt: (input: { diff: string }) => `Analyze this code diff and provide structured feedback:\n\n${input.diff}`,
  requiredTools: [readDiff, analyzeComplexity] //Optional, if not provided, all tools registered with the agent will be used.
});

// Execute a task
const results = await analyzeDiff({
  diff: 'diff --git a/file.ts b/file.ts\n- old code\n+ new code with substantial changes ...'
});
```

## CLI Reference

### Agent Management

```bash
# List all available tools
hataraku tools list

# Add a new agent
hataraku agent add \
  --name code-analyzer \
  --description "Analyzes code changes and provides structured feedback" \
  --model openai('gpt-4-turbo') \
  --tools read_diff,analyze_complexity \
  --instructions "Focus on understanding code changes and their impact"

# Add agent from YAML config
hataraku agent add --from-yaml ./agents/code-analyzer.yaml

# List all agents
hataraku agent list

# Get agent details
hataraku agent info code-analyzer

# Update agent
hataraku agent update code-analyzer --tools read_diff,analyze_complexity,new_tool

# Delete agent
hataraku agent delete code-analyzer
```

### Task Management

```bash
# Create a new task
hataraku task create \
  --agent code-analyzer \
  --name analyzeDiff \
  --description "Analyzes code changes and provides structured feedback" \
  --schema codeAnalysisSchema \
  --prompt "Analyze this code diff and provide structured feedback:\n\n${input.diff}" \
  --required-tools read_diff,analyze_complexity

# List tasks for an agent
hataraku task list --agent code-analyzer

# Run a task
hataraku task run \
  --task analyzeDiff \
  --input "diff --git a/file.ts b/file.ts\n- old code\n+ new code with substantial changes ..."

# Run a task from an agent (not a pre-defined task)
hataraku task run \
  --agent code-analyzer \
  --prompt "diff --git a/file.ts b/file.ts\n- old code\n+ new code with substantial changes ..."

# Run a task with custom properties
hataraku "diff --git a/file.ts b/file.ts\n- old code\n+ new code with substantial changes ..." \
  --model anthropic/claude-3-5-sonnet \
  --provider openrouter
  --system-instructions "You are a helpful assistant that analyzes code changes and provides structured feedback."
  --temperature 0.5
  --max-tokens 1000
  --with-tools read_diff,analyze_complexity


# Schedule a task
hataraku task schedule \
  --cron "0 9 * * *" \
  --task analyzeDiff \
  --input "diff --git a/file.ts b/file.ts\n- old code\n+ new code with substantial changes ..."

# Schedule a task (human readable schedule)
hataraku task schedule \
  --cron "every day at 9am" \
  --task analyzeDiff \
  --input "diff --git a/file.ts b/file.ts\n- old code\n+ new code with substantial changes ..."

# Run with custom prompt
hataraku task run \
  --prompt "Analyze this code diff and provide structured feedback:\n\n${input.diff}" \
  --agent code-analyzer
```

### MCP Client Integration
Every MCP Client will also be able to use the agents, tasks and tools provided by the MCP Server configuration. For example, engineers while writing code in Cursor will be able to use the agents, tasks and tools provided by the MCP Server configuration for reusability and consistency. Non engineers will be able to utilize similar agents, tasks and tools in a client like Claude Desktop or other MCP powered clients.

## YAML Configuration

### Agent Configuration
```yaml
# ./agents/code-analyzer.yaml
name: Code Analyzer
description: Analyzes code changes and provides structured feedback
model: 
  type: openai
  name: gpt-4-turbo
tools:
  - read_diff
  - analyze_complexity
instructions:
  - Focus on understanding code changes and their impact
  - Consider both direct and indirect effects of changes
  - Evaluate complexity and risk factors
tasks:
  analyzeDiff:
    name: Analyze Code Diff
    description: Performs initial analysis of code changes
    schema:
      type: object
      properties:
        impactLevel:
          type: enum
          values: [high, medium, low]
        changedComponents:
          type: array
          items: string
        potentialRisks:
          type: array
          items: string
        complexity:
          type: number
          min: 1
          max: 10
        testCoverage:
          type: number
          min: 0
          max: 100
    prompt: |
      Analyze this code diff and provide structured feedback:
      
      ${input.diff}
    requiredTools:
      - read_diff
      - analyze_complexity
```

### Task Configuration
```yaml
# ./tasks/analyze-diff.yaml
name: Analyze Code Diff
description: Performs initial analysis of code changes
agent: code-analyzer
schema:
  type: object
  properties:
    impactLevel:
      type: enum
      values: [high, medium, low]
    changedComponents:
      type: array
      items: string
    potentialRisks:
      type: array
      items: string
    complexity:
      type: number
      min: 1
      max: 10
    testCoverage:
      type: number
      min: 0
      max: 100
prompt: |
  Analyze this code diff and provide structured feedback:
  
  ${input.diff}
requiredTools:
  - read_diff
  - analyze_complexity
```

### MCP Server Settings
```yaml
# ./config/mcp-settings.json
{
    "mcpServers": {
        "weather": {
            "command": "uv",
            "args": [
                "--directory",
                "/ABSOLUTE/PATH/TO/PARENT/FOLDER/weather",
                "run",
                "weather.py"
            ]
        }
    }
}
```

## Feature requests

### Task Analyzer
- Analyzes a task to make sure it is well defined, fits the agent's capabilities, tools and fits complexity
- Allow task models to be set to 'auto' to let the task analyzer choose the best model




