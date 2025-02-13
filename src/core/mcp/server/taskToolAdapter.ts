import { McpTool, McpToolResponse, ParsedMcpToolResponse, McpError, ErrorCode, McpToolExecutionOptions } from '../types';
import { Task } from '../../task';
import { zodToJsonSchema } from '../../../utils/schema';

interface ToolArgs {
  stream?: boolean;
  [key: string]: any;
}

export class TaskToolAdapter {
  convertToMcpTool<TInput = unknown, TOutput = unknown>(task: Task<TInput, TOutput>): McpTool<ToolArgs & TInput, TOutput> {
    const info = task.getInfo();
    
    return {
      name: info.name,
      description: info.description,
      parameters: this.generateParameters(task),
      execute: async (args: ToolArgs & TInput, options?: McpToolExecutionOptions): Promise<ParsedMcpToolResponse<TOutput>> => {
        try {
          if (args.stream) {
            const stream = await task.execute(args, { stream: true });
            return {
              data: stream as TOutput,
              raw: {
                content: [
                  {
                    type: 'stream',
                    text: 'Streaming response',
                    stream
                  }
                ],
                isError: false
              }
            };
          }

          const result = await task.execute(args);
          const isObject = result !== null && typeof result === 'object';
          const text = isObject ? JSON.stringify(result) : String(result);
          
          return {
            data: result,
            raw: {
              content: [
                {
                  type: 'text',
                  text
                }
              ],
              isError: false
            }
          };
        } catch (error) {
          // If it's already an McpError, rethrow it
          if (error instanceof McpError) {
            throw error;
          }

          // Get error message
          const errorMessage = error instanceof Error ? error.message : 'Task execution failed';

          // Create error response
          const errorResponse: McpToolResponse = {
            content: [
              {
                type: 'error',
                text: errorMessage
              }
            ],
            isError: true
          };

          // Throw new McpError with the error response
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

    // Access schema through type assertion since it's private
    const schema = (task as any).schema;
    if (!schema) {
      return baseParams;
    }

    // Convert task's Zod schema to parameters and merge with base
    const taskSchema = zodToJsonSchema(schema);
    return {
      ...taskSchema.properties,
      ...baseParams
    };
  }
}