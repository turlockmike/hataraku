import { createWorkflow, type Workflow, type WorkflowConfig } from '../../';
import { z } from 'zod';

describe('Workflow', () => {
  // Test schemas
  const analysisSchema = z.object({
    complexity: z.number().min(1).max(10),
    changedFiles: z.array(z.string())
  });

  const securitySchema = z.object({
    vulnerabilities: z.array(z.string()),
    riskLevel: z.enum(['high', 'medium', 'low'])
  });

  // Input/Output schemas
  const workflowInputSchema = z.object({
    diff: z.string(),
    branch: z.string().optional()
  });

  const workflowOutputSchema = z.object({
    analysis: analysisSchema,
    security: securitySchema.optional()
  });

  // Mock task responses
  const mockAnalysisResponse = {
    complexity: 5,
    changedFiles: ['test.ts']
  };

  const mockSecurityResponse = {
    vulnerabilities: [],
    riskLevel: 'low' as const
  };

  // Test tasks with mocked responses
  const analyzeCode = {
    name: 'Analyze Code',
    description: 'Analyzes code changes',
    execute: jest.fn().mockResolvedValue(mockAnalysisResponse)
  };

  const securityCheck = {
    name: 'Security Check',
    description: 'Checks for security issues',
    execute: jest.fn().mockResolvedValue(mockSecurityResponse)
  };

  // Event tracking
  type WorkflowEvent = {
    type: 'taskStart' | 'taskComplete' | 'workflowStart' | 'workflowComplete' | 'error';
    taskName?: string;
    workflowName?: string;
    timestamp: number;
    data?: unknown;
  };

  let eventLog: WorkflowEvent[];

  beforeEach(() => {
    // Reset mock function calls and event log before each test
    jest.clearAllMocks();
    eventLog = [];
  });

  describe('createWorkflow', () => {
    test('should create a workflow with schema validation', () => {
      const config: WorkflowConfig<z.infer<typeof workflowInputSchema>, z.infer<typeof workflowOutputSchema>> = {
        name: 'Test Workflow',
        description: 'A test workflow',
        inputSchema: workflowInputSchema,
        outputSchema: workflowOutputSchema
      };

      const workflow = createWorkflow(config, async (w) => ({
        analysis: mockAnalysisResponse,
        security: mockSecurityResponse
      }));

      expect(workflow).toBeDefined();
      expect(workflow.name).toBe(config.name);
      expect(workflow.description).toBe(config.description);
    });

    test('should throw error if input fails schema validation', async () => {
      const workflow = createWorkflow({
        name: 'Validated Workflow',
        description: 'A workflow with input validation',
        inputSchema: workflowInputSchema
      }, async (w) => ({
        analysis: mockAnalysisResponse
      }));

      await expect(workflow.execute({} as any))
        .rejects
        .toThrow('Validation error');
    });

    test('should throw error if output fails schema validation', async () => {
      const workflow = createWorkflow({
        name: 'Validated Workflow',
        description: 'A workflow with output validation',
        outputSchema: workflowOutputSchema
      }, async (w) => ({} as any));

      await expect(workflow.execute({ diff: 'test' }))
        .rejects
        .toThrow('Validation error');
    });
  });

  describe('workflow events', () => {
    test('should emit events for workflow lifecycle', async () => {
      type WorkflowOutput = {
        'Analyze Code': typeof mockAnalysisResponse;
        'Security Check': typeof mockSecurityResponse;
      };

      const workflow = createWorkflow<{ diff: string }, WorkflowOutput>({
        name: 'Event Workflow',
        description: 'A workflow that emits events',
        onTaskStart: (taskName: string) => {
          eventLog.push({
            type: 'taskStart',
            taskName,
            timestamp: Date.now()
          });
        },
        onTaskComplete: (taskName: string, result: unknown) => {
          eventLog.push({
            type: 'taskComplete',
            taskName,
            timestamp: Date.now(),
            data: result
          });
        },
        onWorkflowStart: (workflowName: string, input: unknown) => {
          eventLog.push({
            type: 'workflowStart',
            workflowName,
            timestamp: Date.now(),
            data: input
          });
        },
        onWorkflowComplete: (workflowName: string, output: unknown) => {
          eventLog.push({
            type: 'workflowComplete',
            workflowName,
            timestamp: Date.now(),
            data: output
          });
        }
      }, async (w) => {
        const builder = w
          .task('Analyze Code', analyzeCode.execute, { diff: 'test code' })
          .task('Security Check', securityCheck.execute, { 
            diff: 'test code',
            complexity: mockAnalysisResponse.complexity 
          });
        return builder;
      });

      await workflow.execute({ diff: 'test code' });

      expect(eventLog).toHaveLength(6);
      expect(eventLog[0]).toMatchObject({
        type: 'workflowStart',
        workflowName: 'Event Workflow'
      });
      expect(eventLog[1]).toMatchObject({
        type: 'taskStart',
        taskName: 'Analyze Code'
      });
      expect(eventLog[2]).toMatchObject({
        type: 'taskComplete',
        taskName: 'Analyze Code',
        data: mockAnalysisResponse
      });
      expect(eventLog[3]).toMatchObject({
        type: 'taskStart',
        taskName: 'Security Check'
      });
      expect(eventLog[4]).toMatchObject({
        type: 'taskComplete',
        taskName: 'Security Check',
        data: mockSecurityResponse
      });
      expect(eventLog[5]).toMatchObject({
        type: 'workflowComplete',
        workflowName: 'Event Workflow',
        data: {
          'Analyze Code': mockAnalysisResponse,
          'Security Check': mockSecurityResponse
        }
      });
    });

    test('should emit error event on failure', async () => {
      const workflow = createWorkflow({
        name: 'Error Workflow',
        description: 'A workflow that fails',
        onError: (error: Error) => {
          eventLog.push({
            type: 'error',
            timestamp: Date.now(),
            data: error
          });
        }
      }, async (w) => {
        throw new Error('Task failed');
      });

      await expect(workflow.execute({ diff: 'test' }))
        .rejects
        .toThrow('Workflow \'Error Workflow\' failed: Task failed');

      expect(eventLog).toHaveLength(1);
      expect(eventLog[0]).toMatchObject({
        type: 'error',
        data: new Error('Workflow \'Error Workflow\' failed: Task failed')
      });
    });
  });

  describe('workflow execution', () => {
    test('should execute tasks in sequence', async () => {
      type WorkflowOutput = {
        'Analyze Code': typeof mockAnalysisResponse;
        'Security Check': typeof mockSecurityResponse;
      };

      const workflow = createWorkflow<{ diff: string }, WorkflowOutput>({
        name: 'Code Review',
        description: 'Reviews code changes'
      }, async (w) => {
        const builder = w
          .task('Analyze Code', analyzeCode.execute, { diff: 'test code changes' })
          .task('Security Check', securityCheck.execute, { 
            diff: 'test code changes',
            complexity: mockAnalysisResponse.complexity 
          });
        return builder;
      });

      const testInput = { diff: 'test code changes' };
      const result = await workflow.execute(testInput);

      // Verify task execution order
      expect(analyzeCode.execute).toHaveBeenCalledWith(testInput);
      expect(securityCheck.execute).toHaveBeenCalledWith({
        diff: testInput.diff,
        complexity: mockAnalysisResponse.complexity
      });

      // Verify result structure
      expect(result).toEqual({
        'Analyze Code': mockAnalysisResponse,
        'Security Check': mockSecurityResponse
      });
    });

    test('should execute tasks in parallel when possible', async () => {
      type WorkflowOutput = {
        'Analyze Code': typeof mockAnalysisResponse;
        'Security Check': typeof mockSecurityResponse;
      };

      const workflow = createWorkflow<{ diff: string }, WorkflowOutput>({
        name: 'Parallel Review',
        description: 'Reviews code changes in parallel'
      }, async (w) => {
        const builder = w.parallel({
          'Analyze Code': analyzeCode.execute({ diff: 'test code changes' }),
          'Security Check': securityCheck.execute({ 
            diff: 'test code changes',
            complexity: 5
          })
        });
        return builder;
      });

      const testInput = { diff: 'test code changes' };
      const result = await workflow.execute(testInput);

      // Verify both tasks were called
      expect(analyzeCode.execute).toHaveBeenCalledWith(testInput);
      expect(securityCheck.execute).toHaveBeenCalledWith({
        diff: testInput.diff,
        complexity: 5
      });

      // Verify result structure
      expect(result).toEqual({
        'Analyze Code': mockAnalysisResponse,
        'Security Check': mockSecurityResponse
      });
    });

    test('should handle task failures gracefully', async () => {
      const error = new Error('Task failed');
      const failingTask = {
        name: 'Failing Task',
        description: 'A task that fails',
        execute: jest.fn().mockRejectedValue(error)
      };

      const workflow = createWorkflow({
        name: 'Failing Workflow',
        description: 'A workflow that handles failures'
      }, async (w) => {
        const builder = w.task('Failing Task', failingTask.execute, { data: 'test input' });
        return builder;
      });

      await expect(workflow.execute({
        data: 'test input'
      })).rejects.toThrow(`Workflow 'Failing Workflow' failed: ${error.message}`);

      expect(failingTask.execute).toHaveBeenCalledTimes(1);
    });

    test('should support conditional task execution', async () => {
      type AnalysisResult = typeof mockAnalysisResponse;
      type SecurityResult = typeof mockSecurityResponse;
      
      type WorkflowOutput = {
        'Analyze Code': AnalysisResult;
        'Security Check'?: SecurityResult;
      };

      const workflow = createWorkflow<{ diff: string }, WorkflowOutput>({
        name: 'Conditional Workflow',
        description: 'A workflow with conditional execution'
      }, async (w) => {
        const builder = w.task('Analyze Code', analyzeCode.execute, { diff: 'test code' });
        
        return builder.when(
          (results) => {
            const analysis = results['Analyze Code'];
            return typeof analysis === 'object' && 
              'complexity' in analysis && 
              typeof analysis.complexity === 'number' && 
              analysis.complexity > 7;
          },
          (b) => b.task('Security Check', securityCheck.execute, { 
            diff: 'test code',
            complexity: 8 // Use fixed value for test
          })
        );
      });

      // Test with low complexity
      analyzeCode.execute.mockResolvedValueOnce({ ...mockAnalysisResponse, complexity: 5 });
      let result = await workflow.execute({ diff: 'simple change' });
      expect(result).toEqual({
        'Analyze Code': { ...mockAnalysisResponse, complexity: 5 }
      });
      expect(securityCheck.execute).not.toHaveBeenCalled();

      // Test with high complexity
      analyzeCode.execute.mockResolvedValueOnce({ ...mockAnalysisResponse, complexity: 8 });
      result = await workflow.execute({ diff: 'complex change' });
      expect(result).toEqual({
        'Analyze Code': { ...mockAnalysisResponse, complexity: 8 },
        'Security Check': mockSecurityResponse
      });
      expect(securityCheck.execute).toHaveBeenCalledWith({
        diff: 'test code',
        complexity: 8
      });
    });
  });
});