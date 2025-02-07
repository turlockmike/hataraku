import { ApiStreamChunk } from '../api/transform/stream';
import { TaskInput } from '../core/agent/types/config';
import { TaskMetadata } from '../core/agent/agent';
import { XMLStreamParser } from './xml-stream-processor';
import { HatarakuTool } from '../lib/types';

// New interface to record tool call events
export interface ToolCall {
  name: string;
  params: { [paramName: string]: string };
  result?: any; // to be filled in later
}

// Extended metadata to include tool calls and usage metrics
export interface ExtendedTaskMetadata extends TaskMetadata {
  toolCalls: ToolCall[];
  usage: {
    tokensIn: number;
    tokensOut: number;
    cacheWrites: number;
    cacheReads: number;
    cost: number;
  };
  errors?: {
    type: string;
    message: string;
    timestamp: number;
  }[];
}

/**
 * Process a model stream and return metadata
 * @param modelStream - The raw model stream to process
 * @param taskId - Unique identifier for the task
 * @param input - Task input configuration
 * @param tools - Array of tools to use for processing
 */
export async function processModelStream(
  modelStream: AsyncIterable<ApiStreamChunk>,
  taskId: string,
  input: TaskInput<unknown>,
  tools: HatarakuTool[]
): Promise<ExtendedTaskMetadata> {
  // Create a promise that will resolve when attempt_completion is encountered
  let metadataResolve!: (value: ExtendedTaskMetadata) => void;
  const metadataPromise = new Promise<ExtendedTaskMetadata>((resolve) => {
    metadataResolve = resolve;
  });

  // Array to record tool call events
  const toolCalls: ToolCall[] = [];
  const errors: { type: string; message: string; timestamp: number; }[] = [];

  // Build stream handlers from tools that have streamHandler
  const handlers: { [toolName: string]: { stream: (data: string) => void, finalize?: () => void } } = {};
  for (const tool of tools) {
    if ('streamHandler' in tool && tool.streamHandler) {
      handlers[tool.name] = tool.streamHandler;
    }
  }

  // Create XML parser with a callback that records tool calls
  const parser = new XMLStreamParser({
    streamHandlers: {
      ...handlers,
    },
    onToolParsed: (toolName: string, params: { [paramName: string]: string }) => {
      // Record all tool calls, both streaming and non-streaming
      toolCalls.push({ name: toolName, params });
    },
    onComplete: () => {
      // This callback fires only once all stream handling (including finalize calls) is done.
      metadataResolve({
        taskId,
        input: input.content,
        toolCalls,
        usage: { ...usageMetrics },
        errors: errors.length > 0 ? errors : undefined
      });
    }
  });

  // Initialize usage metrics
  const usageMetrics = {
    tokensIn: 0,
    tokensOut: 0,
    cacheWrites: 0,
    cacheReads: 0,
    cost: 0
  };

  // Process the model stream directly to handle both text and usage chunks
  try {
    for await (const chunk of modelStream) {
      if (chunk.type === 'text') {
        try {
          parser.write(chunk.text);
        } catch (err) {
          errors.push({
            type: 'parse_error',
            message: err instanceof Error ? err.message : String(err),
            timestamp: Date.now()
          });
        }
      } else if (chunk.type === 'usage') {
        usageMetrics.tokensIn += chunk.inputTokens || 0;
        usageMetrics.tokensOut += chunk.outputTokens || 0;
        usageMetrics.cacheWrites += chunk.cacheWriteTokens || 0;
        usageMetrics.cacheReads += chunk.cacheReadTokens || 0;
        usageMetrics.cost += chunk.totalCost || 0;
      }
    }
    try {
      parser.end();
    } catch (err) {
      errors.push({
        type: 'stream_end_error',
        message: err instanceof Error ? err.message : String(err),
        timestamp: Date.now()
      });
    }
  } catch (err) {
    errors.push({
      type: 'stream_processing_error',
      message: err instanceof Error ? err.message : String(err),
      timestamp: Date.now()
    });
  }

  // Create metadata object
  const metadata: ExtendedTaskMetadata = {
    taskId,
    input: input.content,
    toolCalls,
    usage: { ...usageMetrics },
    errors: errors.length > 0 ? errors : undefined
  };

  // Resolve metadata if not already resolved
  metadataResolve(metadata);

  return metadataPromise;
}