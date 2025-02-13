
## Example Implementation: Workflow Execution

Here's an example of how workflow execution would work with the AI SDK integration:

```typescript
import { createAgent, createTask, createTool, createWorkflow } from 'hataraku';
import { readDiff } from './tools/readDiff';
import { analyzeComplexity } from './tools/analyzeComplexity';
import { securityScan } from './tools/securityScan';
import { testGenerator } from './tools/testGenerator';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

// Define our schemas
const pullRequestSchema = z.object({
  title: z.string(),
  description: z.string(),
  changedFiles: z.array(z.string()),
  complexity: z.number().min(1).max(10)
});

const securitySchema = z.object({
  vulnerabilities: z.array(z.string()),
  riskLevel: z.enum(['high', 'medium', 'low']),
  recommendations: z.array(z.string())
});

const testPlanSchema = z.object({
  testCases: z.array(z.string()),
  coverage: z.number().min(0).max(100),
  estimatedTime: z.number()
});

// Create an agent with necessary tools
const reviewAgent = createAgent({
  name: 'Code Review Assistant',
  description: 'Assists with comprehensive code review tasks',
  defaultModel: openai('gpt-4-turbo'),
  tools: [readDiff, analyzeComplexity, securityScan, testGenerator],
  instructions: [
    'Analyze code changes thoroughly',
    'Focus on security implications',
    'Suggest comprehensive test coverage'
  ]
});

// Define individual tasks
const analyzePR = createTask({
  name: 'Analyze Pull Request',
  agent: reviewAgent,
  schema: pullRequestSchema,
  prompt: (input: { diff: string }) => 
    `Analyze this pull request and provide structured feedback:\n\n${input.diff}`,
  requiredTools: [readDiff, analyzeComplexity]
});

const securityCheck = createTask({
  name: 'Security Analysis',
  agent: reviewAgent,
  schema: securitySchema,
  prompt: (input: { diff: string, complexity: number }) => 
    `Perform a security analysis of these changes. Consider the complexity level of ${complexity}:\n\n${input.diff}`,
  requiredTools: [securityScan]
});

const generateTestPlan = createTask({
  name: 'Test Plan Generation',
  agent: reviewAgent,
  schema: testPlanSchema,
  prompt: (input: { diff: string, vulnerabilities: string[] }) => 
    `Generate a test plan for these changes. Focus on these potential vulnerabilities: ${vulnerabilities.join(', ')}\n\n${input.diff}`,
  requiredTools: [testGenerator]
});



// Create and execute a workflow
const reviewWorkflow = createWorkflow<{ diff: string}, WorkflowOutput>({
  name: 'Comprehensive PR Review',
  description: 'Reviews a pull request and generates a test plan',
  inputSchema: z.object({ diff: z.string() }),
  outputSchema: z.object({
    analysis: pullRequestSchema,
    security: securitySchema,
    testPlan: testPlanSchema
  }),
}, async (w) => {
  const [prAnalyis, securityCheck] = await w.parallel([
    {
      name: 'Analyze Pull Request',
      task: analyzePR.execute,
      input: { diff: 'test code' }
    },
    {
      name: 'Security Analysis',
      task: securityCheck.execute,
      input: { diff: 'test code', complexity: prAnalyis.complexity }
    }
  ]);
  let testPlan;
  if (securityCheck.riskLevel === 'medium') {
    testPlan = await w.task('Test Plan Generation', generateTestPlan.execute, { diff: 'test code', vulnerabilities: securityCheck.vulnerabilities });
  } else if (securityCheck.riskLevel === 'low') {
    testPlan = await w.task('Test Plan Generation', generateTestPlan.execute, { diff: 'test code', vulnerabilities: [] });
  } else {
    w.fail('Security check failed');
  }
  return w.success({
    analysis: prAnalyis,
    security: securityCheck,
    testPlan: testPlan
  })
});

// Execute the workflow
const results = await reviewWorkflow.execute({
  diff: 'diff --git a/file.ts b/file.ts\n- old code\n+ new code ...'
});

// Access structured results
console.log('PR Complexity:', results.analysis.complexity);
console.log('Security Risk Level:', results.security.riskLevel);
console.log('Test Coverage:', results.testPlan.coverage);
```

This example demonstrates:
1. Task Definition with Schemas
   - Each task has a strongly-typed schema
   - Tasks can depend on results from other tasks
   - Tasks can use different tools based on their needs

2. Parallel Execution
   - Security check and initial test plan run in parallel
   - Uses Promise.all for concurrent execution

3. Conditional Flow
   - Generates new test plan if high security risks are found
   - Shows how to chain task results together

4. Type Safety
   - All inputs and outputs are fully typed
   - Schemas ensure data validation at runtime

5. Error Handling
   - Each task can handle its own errors
   - Workflow can handle task failures gracefully

This implementation provides a clean, type-safe way to compose complex workflows while maintaining readability and maintainability. 