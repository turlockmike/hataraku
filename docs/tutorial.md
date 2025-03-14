# Hataraku Tutorial

This step-by-step tutorial will guide you through creating a project with Hataraku, from initial setup to creating
agents, tasks, and workflows.

## Prerequisites

Before you begin, ensure you have:

- Node.js (v18 or later)
- npm or yarn
- API key for at least one supported AI provider (OpenRouter, Anthropic, or Amazon Bedrock)

## Installation

First, create a new project and install Hataraku:

```bash
# Create a new project directory
mkdir my-hataraku-project
cd my-hataraku-project

# Initialize a new Node.js project
npm init -y

# Install Hataraku
npm install hataraku
```

## First Run Setup

When you first run Hataraku, it will create the necessary configuration directories and guide you through setting up
your first profile:

```bash
npx hataraku
```

This will:

1. Create configuration directories
2. Launch a profile creation wizard
3. Guide you through setting up your API keys

## Creating Your First Agent

Let's create a simple coding assistant agent. Create a file named `simple-agent.js`:

```javascript
import { createAgent, createOpenRouterProvider } from 'hataraku'

// Initialize the provider with your API key
// (You can also use environment variables or profile configuration)
const provider = createOpenRouterProvider('your-api-key')

// Create an agent
const agent = createAgent({
  name: 'CodeHelper',
  description: 'Assists with coding tasks',
  role: 'You are a helpful coding assistant specialized in JavaScript and TypeScript.',
  model: provider.getModel('anthropic/claude-3-sonnet'),
})

// Execute a simple task
async function main() {
  const response = await agent.task('What are the new features in ES2023?')
  console.log(response)
}

main().catch(console.error)
```

Run the example:

```bash
node --experimental-modules simple-agent.js
```

## Using Threads for Conversation Context

Let's enhance our agent to maintain a conversation. Modify `simple-agent.js`:

```javascript
import { createAgent, createOpenRouterProvider, Thread } from 'hataraku'

const provider = createOpenRouterProvider('your-api-key')

const agent = createAgent({
  name: 'CodeHelper',
  description: 'Assists with coding tasks',
  role: 'You are a helpful coding assistant specialized in JavaScript and TypeScript.',
  model: provider.getModel('anthropic/claude-3-sonnet'),
})

async function conversationExample() {
  // Create a new thread to maintain conversation context
  const thread = new Thread()

  // First question
  console.log('Q: What are the main data structures in JavaScript?')
  const response1 = await agent.task('What are the main data structures in JavaScript?', { thread })
  console.log(`A: ${response1}\n`)

  // Follow-up question using the same thread
  console.log('Q: Can you show examples of using Maps and Sets?')
  const response2 = await agent.task('Can you show examples of using Maps and Sets?', { thread })
  console.log(`A: ${response2}`)
}

conversationExample().catch(console.error)
```

## Creating Structured Tasks

Now, let's create a structured task with a defined schema for the output using Zod:

```javascript
import { createAgent, createTask, createOpenRouterProvider } from 'hataraku'
import { z } from 'zod'

const provider = createOpenRouterProvider('your-api-key')

const agent = createAgent({
  name: 'CodeAnalyzer',
  description: 'Analyzes code and provides feedback',
  role: 'You are an expert code reviewer who provides structured feedback.',
  model: provider.getModel('anthropic/claude-3-sonnet'),
})

// Define a schema for the response
const codeReviewSchema = z.object({
  strengths: z.array(z.string()),
  improvements: z.array(
    z.object({
      issue: z.string(),
      suggestion: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
    }),
  ),
  overallRating: z.number().min(1).max(10),
})

// Create a task with the schema
const codeReviewTask = createTask({
  name: 'Code Review',
  description: 'Reviews JavaScript code and provides structured feedback',
  agent: agent,
  outputSchema: codeReviewSchema,
  task: code => `Review the following JavaScript code and provide structured feedback:
    
${code}

Provide your feedback with strengths, improvements, and an overall rating from 1-10.`,
})

// Example code to review
const codeToReview = `
function fetchUserData(userId) {
  return fetch('/api/users/' + userId)
    .then(response => response.json())
    .then(data => {
      return data;
    })
    .catch(error => {
      console.log('Error fetching user data:', error);
    });
}
`

// Execute the task
async function runCodeReview() {
  const review = await codeReviewTask.run(codeToReview)

  console.log('Code Review Results:')
  console.log('\nStrengths:')
  review.strengths.forEach(strength => console.log(`- ${strength}`))

  console.log('\nImprovement Opportunities:')
  review.improvements.forEach(item => {
    console.log(`- ${item.issue} (${item.severity} severity)`)
    console.log(`  Suggestion: ${item.suggestion}`)
  })

  console.log(`\nOverall Rating: ${review.overallRating}/10`)
}

runCodeReview().catch(console.error)
```

## Adding Tools to Your Agent

Tools allow your agent to interact with external systems. Let's add some basic tools:

```javascript
import { createAgent, createOpenRouterProvider } from 'hataraku'
import { readFileTool, writeFileTool, webSearchTool } from 'hataraku/tools'

const provider = createOpenRouterProvider('your-api-key')

// Create an agent with tools
const agent = createAgent({
  name: 'DevHelper',
  description: 'Development assistant with tools',
  role: 'You are a development assistant that can help with coding tasks, search the web, and manage files.',
  model: provider.getModel('anthropic/claude-3-sonnet'),
  tools: [readFileTool, writeFileTool, webSearchTool],
})

async function toolDemoExample() {
  console.log('Using agent with tools...\n')

  // Ask the agent something that might require web search
  const response = await agent.task(
    'What is the current stable version of React? Create a simple React component that shows a counter.',
  )

  console.log(response)

  // Now ask the agent to save the component to a file
  await agent.task('Please save that counter component to a file called Counter.jsx')

  console.log('\nComponent saved to Counter.jsx')
}

toolDemoExample().catch(console.error)
```

## Creating a Multi-Step Workflow

Now, let's create a workflow that combines multiple tasks:

```javascript
import { createAgent, createOpenRouterProvider, Workflow } from 'hataraku'

const provider = createOpenRouterProvider('your-api-key')

const agent = createAgent({
  name: 'ProjectHelper',
  description: 'Helps with project tasks',
  role: 'You are a helpful assistant for software development projects.',
  model: provider.getModel('anthropic/claude-3-sonnet'),
})

// Create a workflow for generating a project
const projectGeneratorWorkflow = new Workflow({
  name: 'Project Generator',
  description: 'Generates project structure and documentation',
})

// Step 1: Generate a project outline
projectGeneratorWorkflow.addStep({
  name: 'Generate Project Outline',
  task: 'Create an outline for a JavaScript project that includes a REST API with the following features: user authentication, product listing, and order management. Include the file structure and main components.',
  agent: agent,
})

// Step 2: Create package.json
projectGeneratorWorkflow.addStep({
  name: 'Generate Package.json',
  task: 'Based on the project outline, create a package.json file with all the necessary dependencies.',
  agent: agent,
  input: results => `Based on this project outline, create a package.json file:
    
${results[0]}`,
})

// Step 3: Generate README.md
projectGeneratorWorkflow.addStep({
  name: 'Generate README',
  task: 'Create a README.md file for the project with installation and usage instructions.',
  agent: agent,
  input: results => `Based on this project outline and package.json, create a README.md file:
    
Project Outline:
${results[0]}

package.json:
${results[1]}`,
})

// Execute the workflow
async function runWorkflow() {
  console.log('Generating project documentation...\n')

  const results = await projectGeneratorWorkflow.execute()

  console.log('Workflow Complete! Results:')

  // Display the README
  console.log('\n--- README.md ---\n')
  console.log(results[2])
}

runWorkflow().catch(console.error)
```

## Using the CLI for Task Management

Hataraku provides a CLI for managing tasks, profiles, and agents:

```bash
# List all tasks
npx hataraku task list

# Create a new task
npx hataraku task create "Explain React Hooks" \
  --description "Explain React Hooks and provide examples" \
  --agent "web-developer"

# Run a task
npx hataraku task run "Explain React Hooks"

# Switch profiles
npx hataraku profile use technical-writing

# Run a task with a different model
npx hataraku task run "Explain React Hooks" --model claude-3-opus
```

## Creating and Using Custom Tools

Let's create a custom calculator tool:

```javascript
import { createAgent, createOpenRouterProvider } from 'hataraku'

// Define a custom calculator tool
const calculatorTool = {
  name: 'calculator',
  description: 'Performs mathematical calculations',
  parameters: {
    expression: {
      type: 'string',
      description: 'The mathematical expression to evaluate',
    },
  },
  execute: async ({ expression }) => {
    try {
      // Use a safer alternative to eval in real applications
      const result = eval(expression)
      return { result }
    } catch (error) {
      return { error: `Failed to calculate: ${error.message}` }
    }
  },
}

const provider = createOpenRouterProvider('your-api-key')

// Create an agent with the calculator tool
const agent = createAgent({
  name: 'MathHelper',
  description: 'Helps with mathematical calculations',
  role: 'You are a math tutor who can perform calculations and explain mathematical concepts.',
  model: provider.getModel('anthropic/claude-3-sonnet'),
  tools: [calculatorTool],
})

async function mathExample() {
  const response = await agent.task(
    'What is the result of (14 * 27) - (45 / 3) + 124? Also explain how to solve this step by step.',
  )

  console.log(response)
}

mathExample().catch(console.error)
```

## Optimizing Performance with Streaming

For long-running tasks, you can use streaming to get partial results as they become available:

```javascript
import { createAgent, createOpenRouterProvider } from 'hataraku'

const provider = createOpenRouterProvider('your-api-key')

const agent = createAgent({
  name: 'StoryWriter',
  description: 'Writes creative stories',
  role: 'You are a creative writer who can craft engaging stories.',
  model: provider.getModel('anthropic/claude-3-sonnet'),
})

async function streamingExample() {
  console.log('Generating a short story with streaming...\n')

  // Request a streaming response
  const stream = await agent.task(
    'Write a short story about a programmer who discovers an AI that can predict the future. Make it approximately 500 words.',
    { stream: true },
  )

  // Process the stream
  let fullResponse = ''

  for await (const chunk of stream) {
    process.stdout.write(chunk)
    fullResponse += chunk
  }

  console.log('\n\nStreaming complete!')
}

streamingExample().catch(console.error)
```

## Configuring Profiles for Different Use Cases

Create different profiles for different types of tasks:

```bash
# Create a profile for creative writing
npx hataraku profile create creative-writing \
  --description "Profile for creative writing tasks" \
  --provider openrouter \
  --model anthropic/claude-3-opus

# Create a profile for code assistance
npx hataraku profile create code-assistant \
  --description "Profile for coding assistance" \
  --provider anthropic \
  --model claude-3-sonnet

# Switch between profiles
npx hataraku profile use creative-writing
npx hataraku profile use code-assistant
```

## Next Steps

Now that you've completed this tutorial, you can:

1. Explore the advanced usage guide for more complex scenarios
2. Customize agents with specialized prompts
3. Integrate Hataraku into your applications
4. Create custom tools for your specific needs
5. Build complex workflows with conditional logic

Check out the [API reference](./api-reference.md) and [configuration guide](./configuration.md) for more details.
