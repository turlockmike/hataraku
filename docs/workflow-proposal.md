
## Example Implementation: Workflow Execution

Here's an example of how workflow execution would work with the AI SDK integration:

```typescript
import { createAgent, createTask, createTool, createWorkflow } from 'hataraku';
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
const reviewWorkflow = createWorkflow({
  name: 'Comprehensive PR Review',
  async execute(input: { diff: string }) {
    // First, analyze the PR
    const prAnalysis = await analyzePR({ diff: input.diff });

    // Then run security check and test plan generation in parallel
    const [securityResults, testPlan] = await Promise.all([
      securityCheck({ 
        diff: input.diff, 
        complexity: prAnalysis.complexity 
      }),
      generateTestPlan({ 
        diff: input.diff,
        vulnerabilities: [] // Will be populated from security check
      })
    ]);

    // If high security risks are found, generate a new test plan with focus on vulnerabilities
    if (securityResults.riskLevel === 'high') {
      const updatedTestPlan = await generateTestPlan({
        diff: input.diff,
        vulnerabilities: securityResults.vulnerabilities
      });
      
      return {
        analysis: prAnalysis,
        security: securityResults,
        testPlan: updatedTestPlan
      };
    }

    return {
      analysis: prAnalysis,
      security: securityResults,
      testPlan: testPlan
    };
  }
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