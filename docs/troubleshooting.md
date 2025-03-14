# Troubleshooting Guide

This document helps you diagnose and resolve common issues when working with Hataraku.

## Installation Issues

### Package Not Found

**Problem:** `Error: Cannot find module 'hataraku'`

**Solutions:**

1. Verify the package is installed:

   ```bash
   npm list hataraku
   ```

2. Reinstall the package:

   ```bash
   npm uninstall hataraku
   npm install hataraku
   ```

3. Check your import statement:

   ```typescript
   // Correct
   import { Agent } from 'hataraku'

   // Incorrect
   import { Agent } from './hataraku'
   ```

### TypeScript Errors

**Problem:** TypeScript errors about missing types.

**Solutions:**

1. Make sure TypeScript is properly configured:

   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "esModuleInterop": true,
       "skipLibCheck": true
     }
   }
   ```

2. Ensure you're using a compatible TypeScript version (4.7+).

3. Try clearing the TypeScript cache:
   ```bash
   rm -rf node_modules/.cache/typescript
   ```

## API Key Configuration

### Missing API Key

**Problem:** `Error: Missing API key for provider`

**Solutions:**

1. Set the API key in environment variables:

   ```bash
   # For OpenRouter
   export OPENROUTER_API_KEY=your_api_key

   # For Anthropic
   export ANTHROPIC_API_KEY=your_api_key

   # For OpenAI
   export OPENAI_API_KEY=your_api_key
   ```

2. Pass the API key directly in your code:

   ```typescript
   const provider = createAnthropicProvider({
     apiKey: 'your_api_key',
   })
   ```

3. Use a `.env` file with the dotenv package:

   ```
   // .env
   ANTHROPIC_API_KEY=your_api_key
   ```

   ```typescript
   // In your code
   import 'dotenv/config'
   ```

### Authentication Failures

**Problem:** `Error: Authentication failed` or `Error: Invalid API key`

**Solutions:**

1. Verify your API key is valid and not expired.
2. Check if your API key has the necessary permissions.
3. Ensure there are no extra spaces or newlines in your API key.
4. Confirm your account has available credits or quota.

## Task Execution Issues

### Task Times Out

**Problem:** Task execution hangs or times out.

**Solutions:**

1. Add a timeout option:

   ```typescript
   const task = new Task({
     description: 'Your task',
     model: 'openrouter/anthropic/claude-3.7-sonnet',
     callSettings: {
       abortSignal: AbortSignal.timeout(30000), // 30 seconds
     },
   })
   ```

2. Use streaming for long-running tasks:

   ```typescript
   const task = new Task({
     description: 'Your long task',
     model: 'openrouter/anthropic/claude-3.7-sonnet',
     stream: true,
   })

   const stream = await task.execute()
   for await (const chunk of stream) {
     console.log(chunk)
   }
   ```

3. Check your network connectivity and firewalls.

### Schema Validation Errors

**Problem:** `Error: Schema validation failed` or `ZodError: ...`

**Solutions:**

1. Log the model response to see what it's returning:

   ```typescript
   const rawResponse = await agent.task('Generate a person', {
     // No schema for now
   })
   console.log('Raw response:', rawResponse)
   ```

2. Make sure your schema matches what the model can realistically generate:

   ```typescript
   // Too restrictive
   const PersonSchema = z.object({
     name: z.string().min(5).max(20),
     age: z.number().int().positive().lt(100),
     email: z.string().email(),
   })

   // More permissive
   const PersonSchema = z.object({
     name: z.string(),
     age: z
       .number()
       .or(z.string())
       .transform(val => (typeof val === 'string' ? parseInt(val, 10) : val)),
     email: z.string(),
   })
   ```

3. Increase the max retries for schema validation:
   ```typescript
   const agent = createAgent({
     // ... other config
     callSettings: {
       maxRetries: 10, // Default is 4
     },
   })
   ```

### Model Errors

**Problem:** `Error: Model API returned an error` or `Error: Rate limit exceeded`

**Solutions:**

1. Check for rate limiting:

   - Implement exponential backoff for retries
   - Reduce concurrent requests to the same provider

2. Handle provider errors gracefully:

   ```typescript
   try {
     const result = await task.execute()
   } catch (error) {
     if (error.code === 'rate_limit_exceeded') {
       console.log('Rate limited, waiting before retry...')
       await new Promise(resolve => setTimeout(resolve, 5000))
       // Try again
     } else {
       console.error('Other error:', error)
     }
   }
   ```

3. Try a different model or provider if the issue persists.

## Tool-Related Issues

### Tool Function Not Called

**Problem:** The tool function isn't being called by the AI.

**Solutions:**

1. Improve the tool description to be more clear about when to use it:

   ```typescript
   calculator: {
     // Vague description
     description: 'Does math'

     // Better description
     description: 'Performs mathematical calculations. Use for basic arithmetic, algebra, and numeric computations that require precision.'
   }
   ```

2. Make your prompt more explicit about using the tool:

   ```typescript
   const result = await agent.task('Calculate 15% of $45.75. Use the calculator tool for accurate results.')
   ```

3. Check that your tool parameters are correctly defined:

   ```typescript
   // Missing parameters definition
   myTool: {
     description: 'Does something',
     execute: (params) => { /* implementation */ }
   }

   // Correct definition
   myTool: {
     name: 'myTool',
     description: 'Does something',
     parameters: {
       type: 'object',
       properties: {
         input: {
           type: 'string',
           description: 'The input to process'
         }
       },
       required: ['input']
     },
     execute: (params) => { /* implementation */ }
   }
   ```

### Tool Function Errors

**Problem:** Tool function throws an error during execution.

**Solutions:**

1. Add robust error handling in your tool:

   ```typescript
   execute: async params => {
     try {
       // Your tool implementation
       return { success: true, result }
     } catch (error) {
       console.error('Tool error:', error)
       return {
         success: false,
         error: error.message || 'Unknown error',
       }
     }
   }
   ```

2. Validate parameters before using them:

   ```typescript
   execute: async params => {
     if (!params.location || typeof params.location !== 'string') {
       return { success: false, error: 'Invalid location parameter' }
     }

     // Continue with implementation
   }
   ```

3. Implement logging for debugging:
   ```typescript
   execute: async params => {
     console.log('Tool called with params:', params)
     const result = await someOperation(params)
     console.log('Tool result:', result)
     return result
   }
   ```

## Workflow Issues

### Steps Not Running

**Problem:** Some workflow steps aren't executing.

**Solutions:**

1. Check step dependencies are correctly configured:

   ```typescript
   workflow.addStep({
     name: 'ProcessData',
     depends: ['FetchData'], // Make sure 'FetchData' is the correct name
   })
   ```

2. Verify that previous steps are completing successfully:

   ```typescript
   workflow.onStepComplete((step, result) => {
     console.log(`Step ${step.name} completed with result:`, result)
   })

   workflow.onStepError((step, error) => {
     console.error(`Step ${step.name} failed:`, error)
   })
   ```

3. Ensure your workflow is properly configured:
   ```typescript
   const workflow = new Workflow({
     name: 'DataProcessing',
     description: 'Processes data from multiple sources',
     // Missing options?
     failFast: false, // Continue even if some steps fail
   })
   ```

### Data Passing Between Steps

**Problem:** Data isn't being correctly passed between workflow steps.

**Solutions:**

1. Log intermediate results:

   ```typescript
   workflow.addStep({
     name: 'Step1',
     task: 'Generate data',
     onResult: result => {
       console.log('Step1 result:', result)
       return result
     },
   })
   ```

2. Explicitly map outputs to inputs:

   ```typescript
   workflow.addStep({
     name: 'Step2',
     task: 'Process data',
     input: results => ({
       data: results.Step1.data,
     }),
   })
   ```

3. Check for data type mismatches:
   ```typescript
   // Add validation
   workflow.addStep({
     name: 'Step2',
     task: 'Process data',
     input: results => {
       const data = results.Step1?.data
       if (!data || typeof data !== 'object') {
         throw new Error('Invalid data from Step1')
       }
       return { data }
     },
   })
   ```

## Provider-Specific Issues

### OpenRouter

**Problem:** `Error: Model not found on OpenRouter`

**Solutions:**

1. Check that the model ID is correct:

   ```typescript
   // Correct
   model: 'openrouter/anthropic/claude-3.7-sonnet'

   // Incorrect
   model: 'openrouter/claude-3.7-sonnet'
   ```

2. Verify the model is available on OpenRouter by checking their API documentation.

### Anthropic

**Problem:** `Error: Input too long for context window`

**Solutions:**

1. Reduce the input size:

   ```typescript
   const truncatedInput = input.slice(0, 100000) // Adjust as needed
   ```

2. Use a model with a larger context window:

   ```typescript
   model: 'claude-3-opus-20240229' // 200k token context window
   ```

3. Implement context chunking for very large inputs.

### AWS Bedrock

**Problem:** `Error: Access denied to AWS Bedrock models`

**Solutions:**

1. Verify your AWS credentials have the necessary permissions.
2. Ensure the model is available in your AWS region.
3. Check that you've requested access to the model in AWS Bedrock.

## Common Error Messages

| Error Message                               | Likely Cause                     | Solution                                    |
| ------------------------------------------- | -------------------------------- | ------------------------------------------- |
| `Cannot find module 'hataraku'`             | Package not installed            | Reinstall the package                       |
| `Missing API key for provider`              | API key not configured           | Set the API key                             |
| `Model API returned error: 429`             | Rate limit exceeded              | Implement retries with backoff              |
| `Schema validation failed`                  | AI response doesn't match schema | Adjust schema or improve prompt             |
| `AbortError: The operation was aborted`     | Request timed out                | Increase timeout or use streaming           |
| `Cannot read property 'X' of undefined`     | Missing data in workflow         | Add error handling for intermediate results |
| `TypeError: tool.execute is not a function` | Incorrectly defined tool         | Fix tool configuration                      |

## Getting Additional Help

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/turlockmike/hataraku/issues) for similar problems.
2. Enable verbose logging:
   ```typescript
   import { setLogLevel } from 'hataraku'
   setLogLevel('debug')
   ```
3. Create a minimal reproducible example.
4. Open a new issue with details about:
   - Hataraku version
   - Node.js version
   - Full error message and stack trace
   - Steps to reproduce
   - Code example
