# Advanced Usage

This document covers advanced usage patterns and techniques for getting the most out of Hataraku.

## Advanced Agent Configuration

### Specialized System Prompts

Create specialized agents with detailed system prompts:

```typescript
const codeReviewAgent = createAgent({
  name: 'Code Reviewer',
  description: 'Performs detailed code reviews',
  role: `You are an expert code reviewer with 15+ years of experience in TypeScript.
  Focus on:
  - Architecture issues
  - Performance optimizations 
  - Security vulnerabilities
  - Maintainability concerns
  - Best practices
  
  Always provide concrete examples when suggesting improvements.`,
  model: createAnthropicProvider('claude-3-sonnet-20240229'),
})
```

### Dynamic Prompting

Generate prompts dynamically based on context:

```typescript
const dynamicAgent = createAgent({
  name: 'Dynamic Agent',
  description: 'Uses context to customize behavior',
  role: context => {
    if (context.language === 'typescript') {
      return 'You are a TypeScript expert...'
    } else if (context.language === 'python') {
      return 'You are a Python specialist...'
    }
    return 'You are a general programming assistant...'
  },
  model: createOpenRouterProvider('anthropic/claude-3-opus'),
})
```

## Advanced Task Patterns

### Composite Tasks

Chain multiple tasks together with context passing:

```typescript
// Task 1: Extract requirements
const extractRequirements = createTask({
  name: 'Extract Requirements',
  description: 'Extract key requirements from specifications',
  agent: agent,
  task: 'Extract and list all functional requirements from this specification document',
})

// Task 2: Generate test cases based on requirements
const generateTests = createTask({
  name: 'Generate Tests',
  description: 'Create test cases for the requirements',
  agent: agent,
  task: requirements => `Generate unit test cases for these requirements: ${requirements}`,
})

// Execute in sequence
const requirements = await extractRequirements.run(specificationDocument)
const testCases = await generateTests.run(requirements)
```

### Retry Strategies

Implement advanced retry mechanisms:

```typescript
const robustTask = createTask({
  name: 'Robust Processing',
  description: 'Process data with automatic retries',
  agent: agent,
  task: 'Process this data and extract key metrics',
  // Custom retry logic
  onError: async (error, attempt, maxAttempts) => {
    if (attempt < maxAttempts) {
      const backoffTime = Math.pow(2, attempt) * 1000 // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, backoffTime))
      return true // Retry
    }
    return false // Don't retry
  },
})
```

## Advanced Workflows

### Parallel Execution

Execute tasks in parallel for improved performance:

```typescript
const workflow = new Workflow({
  name: 'Parallel Processing',
  description: 'Process multiple documents simultaneously',
})

// Add parallel steps
workflow.addParallelSteps([
  {
    name: 'Process Document 1',
    task: 'Summarize this document',
    input: () => documents[0],
  },
  {
    name: 'Process Document 2',
    task: 'Summarize this document',
    input: () => documents[1],
  },
  {
    name: 'Process Document 3',
    task: 'Summarize this document',
    input: () => documents[2],
  },
])

// Add a step that combines results
workflow.addStep({
  name: 'Combine Summaries',
  task: 'Combine these document summaries into a comprehensive overview',
  input: results => results.join('\n\n'),
})

// Execute the workflow
const result = await workflow.execute()
```

### Conditional Workflows

Create workflows with conditional branching:

```typescript
const conditionalWorkflow = new Workflow({
  name: 'Conditional Analysis',
  description: 'Analyze data with conditional paths',
})

// Initial analysis
conditionalWorkflow.addStep({
  name: 'Initial Analysis',
  task: 'Analyze this data and determine if it needs deep processing',
  input: ctx => ctx.data,
})

// Conditional branch
conditionalWorkflow.addConditionalStep({
  condition: (results, ctx) => results.needsDeepProcessing === true,
  onTrue: {
    name: 'Deep Processing',
    task: 'Perform deep processing on the data',
    input: (results, ctx) => ctx.data,
  },
  onFalse: {
    name: 'Simple Processing',
    task: 'Perform simple processing on the data',
    input: (results, ctx) => ctx.data,
  },
})

// Execute with context
const result = await conditionalWorkflow.execute({
  context: { data: rawData },
})
```

## Advanced Thread Management

### Thread Persistence

Persist threads to disk for long-running conversations:

```typescript
import { FileSystemStorage } from 'hataraku'

// Create a thread with file system persistence
const storage = new FileSystemStorage('./conversations/user123.thread')
const thread = new Thread({ storage })

// Add messages
thread.addUserMessage('I need help with my project')
await thread.save() // Persist to disk

// Later, load the thread
const loadedThread = await FileSystemStorage.load('./conversations/user123.thread')
```

### Thread Summarization

Summarize long threads to stay within context limits:

```typescript
// Summarize a long thread
const summarizedThread = await threadSummarizer.summarize(thread, {
  maxMessages: 10,
  preserveRecentMessages: 3,
  summaryPrompt: 'Summarize this conversation while preserving the key information',
})

// Use the summarized thread with an agent
const response = await agent.task('Continue helping with my project', {
  thread: summarizedThread,
})
```

## Advanced Tool Integration

### Custom Tool Factories

Create factory functions for frequently used tool patterns:

```typescript
// Tool factory function
function createDatabaseQueryTool(connectionString) {
  return {
    name: 'query-database',
    description: 'Query the database for information',
    parameters: {
      query: {
        type: 'string',
        description: 'SQL query to execute',
      },
    },
    execute: async ({ query }) => {
      const connection = await createConnection(connectionString)
      try {
        const results = await connection.query(query)
        return { results }
      } finally {
        await connection.close()
      }
    },
  }
}

// Use the factory to create a tool
const userDbTool = createDatabaseQueryTool('postgres://user:pass@localhost/users')

// Add to an agent
const agent = createAgent({
  // ... other config
  tools: [userDbTool],
})
```

### Tool Composition

Compose multiple tools into higher-level tools:

```typescript
// Create a composed tool that combines multiple file operations
const fileManager = createComposedTool({
  name: 'file-manager',
  description: 'Manages files with high-level operations',
  tools: [readFileTool, writeFileTool, listDirTool],
  compose: tools => ({
    name: 'backup-file',
    description: 'Creates a backup of a file',
    parameters: {
      path: {
        type: 'string',
        description: 'Path to the file to backup',
      },
    },
    execute: async ({ path }) => {
      const { readFileTool, writeFileTool } = tools
      const content = await readFileTool.execute({ path })
      const backupPath = `${path}.backup-${Date.now()}`
      await writeFileTool.execute({
        path: backupPath,
        content: content.data,
      })
      return {
        success: true,
        originalPath: path,
        backupPath,
      }
    },
  }),
})
```

## Performance Optimization

### Caching Strategies

Implement caching for expensive operations:

```typescript
import { createCache } from 'hataraku'

// Create a cache for task results
const taskCache = createCache({
  type: 'memory', // or 'redis', 'filesystem', etc.
  ttl: 3600, // Cache for 1 hour
})

// Use the cache with a task
const cachedTask = createTask({
  name: 'Cached Analysis',
  description: 'Analyze data with caching',
  agent: agent,
  task: 'Analyze this data deeply',
  cache: {
    instance: taskCache,
    keyGenerator: input => crypto.createHash('md5').update(input).digest('hex'),
  },
})

// Execute with automatic caching
const result = await cachedTask.run(data)
```

### Streaming Processing

Process streaming responses efficiently:

```typescript
const streamingTask = createTask({
  name: 'Streaming Processor',
  description: 'Process data in a streaming fashion',
  agent: agent,
  task: 'Generate a detailed report',
})

// Stream and process incrementally
const stream = await streamingTask.run(data, { stream: true })

let reportSections = []
for await (const chunk of stream) {
  // Process each chunk as it arrives
  const processed = processChunk(chunk)
  reportSections.push(processed)

  // Update UI in real-time
  updateUserInterface(reportSections)
}
```

## Custom Providers

### Provider Composition

Create a provider that tries multiple backends:

```typescript
class FallbackProvider implements ProviderV1 {
  private providers: ProviderV1[]

  constructor(providers: ProviderV1[]) {
    this.providers = providers
  }

  async getModel(modelId: string): Promise<LanguageModelV1> {
    return new FallbackModel(modelId, this.providers)
  }
}

class FallbackModel implements LanguageModelV1 {
  private modelId: string
  private providers: ProviderV1[]

  constructor(modelId: string, providers: ProviderV1[]) {
    this.modelId = modelId
    this.providers = providers
  }

  async generateResponse(prompt: string, options?: ResponseOptions): Promise<string> {
    let lastError

    for (const provider of this.providers) {
      try {
        const model = await provider.getModel(this.modelId)
        return await model.generateResponse(prompt, options)
      } catch (error) {
        lastError = error
        // Try next provider
      }
    }

    throw new Error(`All providers failed: ${lastError.message}`)
  }

  // Implement other required methods...
}

// Usage
const fallbackProvider = new FallbackProvider([
  createAnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY }),
  createOpenRouterProvider({ apiKey: process.env.OPENROUTER_API_KEY }),
  createBedrockProvider({ region: 'us-west-2' }),
])
```

### Custom Model Adapters

Adapt third-party APIs to work with Hataraku:

```typescript
class CustomApiProvider implements ProviderV1 {
  private apiKey: string
  private endpoint: string

  constructor(config: { apiKey: string; endpoint: string }) {
    this.apiKey = config.apiKey
    this.endpoint = config.endpoint
  }

  async getModel(modelId: string): Promise<LanguageModelV1> {
    return new CustomApiModel(modelId, this.apiKey, this.endpoint)
  }
}

class CustomApiModel implements LanguageModelV1 {
  private modelId: string
  private apiKey: string
  private endpoint: string

  constructor(modelId: string, apiKey: string, endpoint: string) {
    this.modelId = modelId
    this.apiKey = apiKey
    this.endpoint = endpoint
  }

  async generateResponse(prompt: string, options?: ResponseOptions): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelId,
        prompt: prompt,
        max_tokens: options?.maxTokens || 1000,
        temperature: options?.temperature || 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.output
  }

  // Implement other required methods...
}

// Usage
const customProvider = new CustomApiProvider({
  apiKey: process.env.CUSTOM_API_KEY,
  endpoint: 'https://api.example.com/generate',
})
```

## Error Handling and Debugging

### Verbose Logging

Enable detailed logging for troubleshooting:

```typescript
import { configureLogging } from 'hataraku'

// Configure logging
configureLogging({
  level: 'debug', // 'error', 'warn', 'info', 'debug', 'trace'
  format: 'json', // 'text', 'json'
  destination: 'file', // 'console', 'file'
  filePath: './logs/hataraku.log',
  rotation: {
    maxSize: '10m',
    maxFiles: 5,
  },
})

// Create agent with verbose logging
const agent = createAgent({
  // ... config
  verbose: true,
})

// Execute task with tracing
const result = await agent.task('Debug this code', {
  verbose: true,
  trace: {
    enabled: true,
    includePrompts: true,
    includeResponses: true,
    includeTokenCounts: true,
  },
})
```

### Custom Error Handlers

Implement custom error handling strategies:

```typescript
const task = createTask({
  name: 'Error-Handled Task',
  description: 'A task with custom error handling',
  agent: agent,
  task: 'Process this complex data',
  errorHandler: async (error, context) => {
    // Log detailed error information
    console.error('Task error:', {
      error: error.message,
      stack: error.stack,
      taskName: context.taskName,
      input: context.input.substring(0, 100) + '...',
      timestamp: new Date().toISOString(),
    })

    // Attempt recovery based on error type
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      // Wait and suggest retry
      await new Promise(resolve => setTimeout(resolve, 5000))
      return {
        recovered: true,
        result: 'Rate limit exceeded. Retrying after delay...',
      }
    }

    if (error.code === 'CONTEXT_LENGTH_EXCEEDED') {
      // Summarize input and retry
      const summarizedInput = await summarizationAgent.task(`Summarize this text to 1/3 its length: ${context.input}`)

      return {
        recovered: true,
        retry: true,
        newInput: summarizedInput,
      }
    }

    // Default error response
    return {
      recovered: false,
      error: `Failed to process task: ${error.message}`,
    }
  },
})
```

## Best Practices

### Production Deployment

Strategies for deploying Hataraku in production:

1. **Environment Configuration**

   - Use environment variables for all sensitive values
   - Implement configuration validation at startup
   - Separate development/staging/production configs

2. **Reliability**

   - Implement circuit breakers for external API calls
   - Set appropriate timeouts for all operations
   - Use exponential backoff for retries

3. **Monitoring**

   - Track token usage and costs
   - Monitor response times and error rates
   - Set up alerts for unusual patterns

4. **Security**
   - Rotate API keys regularly
   - Validate and sanitize all user inputs
   - Use least-privilege principles for tool permissions

### Performance Checklist

- [ ] Optimize thread management to reduce token usage
- [ ] Implement appropriate caching
- [ ] Use streaming responses when appropriate
- [ ] Monitor token usage and adjust prompts accordingly
- [ ] Batch related tasks when possible
- [ ] Use the most efficient model for each task type
