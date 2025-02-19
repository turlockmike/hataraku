import { McpTool, ParsedMcpToolResponse, McpError, ErrorCode, McpToolExecutionOptions } from '../types';
import { Task } from '../../task';
import { zodToJsonSchema } from '../../../utils/schema';
import { z } from 'zod';

interface ToolArgs {
  stream?: boolean;
  [key: string]: any;
}

export class TaskToolAdapter {
  convertToMcpTool<TInput = unknown, TOutput = unknown>(task: Task<TInput, TOutput>): McpTool<ToolArgs & TInput, TOutput | (AsyncIterable<string> & ReadableStream<string>)> {
    const info = task.getInfo();
    
    return {
      name: info.name,
      description: info.description,
      parameters: this.generateParameters(task),
      execute: async (args: ToolArgs & TInput, options?: McpToolExecutionOptions): Promise<ParsedMcpToolResponse<TOutput | (AsyncIterable<string> & ReadableStream<string>)>> => {
        try {
          // Use a cast to access the private property 'task'
          const rawTask = (task as any).task;
          if (typeof rawTask === 'string') {
            // For basic tasks with a static prompt, ignore input args and use the task's own prompt
            if (args.stream) {
              const stream = await task.execute(rawTask as TInput, { stream: true, thread: (options as any)?.thread } as any);
              return {
                data: stream,
                raw: {
                  content: [
                    { type: 'stream', text: 'Streaming response', stream }
                  ],
                  isError: false
                }
              };
            }
            const result = await task.execute(rawTask as TInput, { thread: (options as any)?.thread } as any);
            const isObject = result !== null && typeof result === 'object';
            const text = isObject ? JSON.stringify(result) : String(result);
            return {
              data: result,
              raw: {
                content: [
                  { type: 'text', text }
                ],
                isError: false
              }
            };
          } else {
            // For tasks that require input, pass the provided args
            if (args.stream) {
              const stream = await task.execute(args, { stream: true, thread: (options as any)?.thread } as any);
              return {
                data: stream,
                raw: {
                  content: [
                    { type: 'stream', text: 'Streaming response', stream }
                  ],
                  isError: false
                }
              };
            }
            const result = await task.execute(args, { thread: (options as any)?.thread } as any);
            const isObject = result !== null && typeof result === 'object';
            const text = isObject ? JSON.stringify(result) : String(result);
            return {
              data: result,
              raw: {
                content: [
                  { type: 'text', text }
                ],
                isError: false
              }
            };
          }
        } catch (error) {
          if (error instanceof McpError) {
            throw error;
          }
          const errorMessage = error instanceof Error ? error.message : 'Task execution failed';
          throw new McpError(ErrorCode.ExecutionError, errorMessage);
        }
      }
    };
  }

  private generateParameters<TInput, TOutput>(task: Task<TInput, TOutput>): Record<string, any> {
    const baseParams = {
      stream: {
        type: 'boolean',
        description: 'Enable streaming output',
        optional: true
      }
    };

    // Use cast to access the private task property
    const rawTask = (task as any).task;
    if (typeof rawTask === 'string') {
      return baseParams;
    }

    const schema = (task as any).inputSchema;
    if (schema && schema instanceof z.ZodObject) {
      const taskSchema = zodToJsonSchema(schema);
      return {
        ...taskSchema.properties,
        ...baseParams
      };
    }
    return baseParams;
  }
}