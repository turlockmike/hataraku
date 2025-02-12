import { z } from 'zod';

// Task execution function type
type TaskExecutor<TInput = unknown, TOutput = unknown> = (input: TInput) => Promise<TOutput>;

// Workflow builder types
interface WorkflowBuilder<TResults extends Record<string, unknown> = Record<string, unknown>> {
  task<TInput, TOutput>(
    name: string,
    executor: TaskExecutor<TInput, TOutput>,
    input: TInput
  ): WorkflowBuilder<TResults & { [K in string]: TOutput }>;
  
  when<T extends TResults>(
    condition: (results: T) => boolean,
    builder: (builder: WorkflowBuilder<T>) => WorkflowBuilder<T>
  ): WorkflowBuilder<TResults>;
  
  parallel<T extends Record<string, Promise<unknown>>>(
    tasks: T
  ): WorkflowBuilder<TResults & { [K in keyof T]: Awaited<T[K]> }>;

  execute(): Promise<TResults>;
}

export interface WorkflowConfig<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema?: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  // Event handlers
  onTaskStart?: (taskName: string) => void;
  onTaskComplete?: (taskName: string, result: unknown) => void;
  onWorkflowStart?: (workflowName: string, input: TInput) => void;
  onWorkflowComplete?: (workflowName: string, output: TOutput) => void;
  onError?: (error: Error) => void;
  execute?: (input: TInput) => Promise<TOutput>;
}

export interface Workflow<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  execute(input: TInput): Promise<TOutput>;
}

class WorkflowBuilderImpl<TResults extends Record<string, unknown> = Record<string, unknown>> implements WorkflowBuilder<TResults> {
  private tasks: Array<{
    name: string;
    executor: (input: unknown) => Promise<unknown>;
    input: unknown;
  }> = [];

  private conditionalTasks: Array<{
    condition: (results: TResults) => boolean;
    builder: (builder: WorkflowBuilder<TResults>) => WorkflowBuilder<TResults>;
  }> = [];

  constructor(private config: WorkflowConfig<unknown, unknown>) {}

  task<TInput, TOutput>(
    name: string,
    executor: TaskExecutor<TInput, TOutput>,
    input: TInput
  ): WorkflowBuilder<TResults & { [K in string]: TOutput }> {
    this.tasks.push({
      name,
      executor: executor as (input: unknown) => Promise<unknown>,
      input
    });
    return this as unknown as WorkflowBuilder<TResults & { [K in string]: TOutput }>;
  }

  when<T extends TResults>(
    condition: (results: T) => boolean,
    builder: (builder: WorkflowBuilder<T>) => WorkflowBuilder<T>
  ): WorkflowBuilder<TResults> {
    this.conditionalTasks.push({ 
      condition: (results) => {
        try {
          return condition(results as T);
        } catch (error) {
          return false;
        }
      }, 
      builder: (b) => builder(b as WorkflowBuilder<T>)
    });
    return this;
  }

  parallel<T extends Record<string, Promise<unknown>>>(
    tasks: T
  ): WorkflowBuilder<TResults & { [K in keyof T]: Awaited<T[K]> }> {
    const entries = Object.entries(tasks);
    entries.forEach(([name, promise]) => {
      this.tasks.push({
        name,
        executor: () => promise,
        input: undefined
      });
    });
    return this as unknown as WorkflowBuilder<TResults & { [K in keyof T]: Awaited<T[K]> }>;
  }

  async execute(): Promise<TResults> {
    const results: Record<string, unknown> = {};

    for (const task of this.tasks) {
      // Emit task start event
      this.config.onTaskStart?.(task.name);

      // Execute task
      const result = await task.executor(task.input);
      results[task.name] = result;

      // Emit task complete event
      this.config.onTaskComplete?.(task.name, result);

      // Check conditional tasks after each task execution
      for (const conditional of this.conditionalTasks) {
        if (conditional.condition(results as TResults)) {
          const conditionalBuilder = new WorkflowBuilderImpl<TResults>(this.config);
          const builtConditional = conditional.builder(conditionalBuilder);
          const conditionalResults = await builtConditional.execute();
          Object.assign(results, conditionalResults);
        }
      }
    }

    return results as TResults;
  }
}

type WorkflowBuilderFunction<TInput, TOutput> = 
  (workflow: WorkflowBuilder<Record<string, TOutput>>) => Promise<TOutput | WorkflowBuilder<Record<string, TOutput>>>;

export function createWorkflow<TInput = unknown, TOutput = unknown>(
  config: WorkflowConfig<TInput, TOutput>,
  builder?: WorkflowBuilderFunction<TInput, TOutput>
): Workflow<TInput, TOutput> {
  if (!config.name) {
    throw new Error('name is required');
  }

  return {
    name: config.name,
    description: config.description,
    execute: async (input: TInput): Promise<TOutput> => {
      try {
        // Validate input if schema is provided
        if (config.inputSchema) {
          input = config.inputSchema.parse(input);
        }

        // Notify workflow start
        config.onWorkflowStart?.(config.name, input);

        let output: TOutput;

        if (builder) {
          // Create workflow builder
          const workflowBuilder = new WorkflowBuilderImpl<Record<string, TOutput>>(config as WorkflowConfig<unknown, unknown>);
          
          // Execute builder function
          const builderResult = await builder(workflowBuilder);
          
          // If builder returns a WorkflowBuilder, execute it
          output = builderResult instanceof WorkflowBuilderImpl 
            ? await builderResult.execute() as TOutput
            : builderResult as TOutput;
        } else if (config.execute) {
          output = await config.execute(input);
        } else {
          throw new Error('Either builder or execute function is required');
        }

        // Validate output if schema is provided
        if (config.outputSchema) {
          config.outputSchema.parse(output);
        }

        // Notify workflow completion
        config.onWorkflowComplete?.(config.name, output);

        return output;
      } catch (error) {
        // Handle validation errors
        if (error instanceof z.ZodError) {
          const validationError = new Error('Validation error: ' + error.message);
          config.onError?.(validationError);
          throw validationError;
        }

        // Handle other errors
        if (error instanceof Error) {
          const workflowError = new Error(`Workflow '${config.name}' failed: ${error.message}`);
          config.onError?.(workflowError);
          throw workflowError;
        }

        throw error;
      }
    }
  };
} 