import { ApiStreamChunk } from '../api/transform/stream';
import { TaskInput } from '../core/agent/types/config';
import { TaskMetadata } from '../core/agent/agent';
import { XMLStreamParser } from './xml-stream-processor';
import { UnifiedTool } from '../lib/types';

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
}

export interface StreamProcessorState {
  thinkingChain: string[];
}

/**
 * Process a model stream and return metadata
 * @param modelStream - The raw model stream to process
 * @param taskId - Unique identifier for the task
 * @param input - Task input configuration
 * @param tools - Array of tools to use for processing
 * @param state - Stream processor state object
 */
export async function processModelStream(
  modelStream: AsyncIterable<ApiStreamChunk>,
  taskId: string,
  input: TaskInput<unknown>,
  tools: UnifiedTool[],
  state: { thinkingChain: string[] }
): Promise<ExtendedTaskMetadata> {
  // Create a promise that will resolve when attempt_completion is encountered
  let metadataResolve: ((value: ExtendedTaskMetadata) => void) | null = null;
  const metadataPromise = new Promise<ExtendedTaskMetadata>((resolve) => {
    metadataResolve = resolve;
  });

  // Array to record tool call events
  const toolCalls: ToolCall[] = [];

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
      thinking: {
        stream: (data: string) => {
          handlers.thinking.stream(data);
          toolCalls.push({ name: 'thinking', params: { content: data } });
        },
        finalize: handlers.thinking.finalize
      },
      attempt_completion: {
        stream: (() => {
          let content = '';
          let lastStreamedLength = 0;
          return (data: string) => {
            // Remove any closing tag content from the data
            const closingTagIndex = data.lastIndexOf("</attempt_completion");
            const newData = closingTagIndex !== -1 ? data.slice(0, closingTagIndex) : data;
            content = newData;
            
            // Only stream the new content
            const newContent = content.slice(lastStreamedLength);
            if (newContent) {
              handlers.attempt_completion.stream(newContent);
              lastStreamedLength = content.length;
            }
            
            // Replace any existing attempt_completion call with the accumulated content
            const existingIndex = toolCalls.findIndex(call => call.name === 'attempt_completion');
            if (existingIndex >= 0) {
              toolCalls[existingIndex] = { name: 'attempt_completion', params: { content } };
            } else {
              toolCalls.push({ name: 'attempt_completion', params: { content } });
            }
          };
        })(),
        finalize: handlers.attempt_completion.finalize
      }
    },
    onToolParsed: (toolName: string, params: { [paramName: string]: string }) => {
      // Record all tool calls, both streaming and non-streaming
      toolCalls.push({ name: toolName, params });
      
      // When attempt_completion is encountered, resolve metadata
      if (toolName === 'attempt_completion' && metadataResolve) {
        metadataResolve({
          taskId,
          input: input.content,
          thinking: state.thinkingChain,
          toolCalls,
          usage: { ...usageMetrics }
        });
      }
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
        parser.write(chunk.text);
      } else if (chunk.type === 'usage') {
        usageMetrics.tokensIn += chunk.inputTokens || 0;
        usageMetrics.tokensOut += chunk.outputTokens || 0;
        usageMetrics.cacheWrites += chunk.cacheWriteTokens || 0;
        usageMetrics.cacheReads += chunk.cacheReadTokens || 0;
        usageMetrics.cost += chunk.totalCost || 0;
      }
    }
    parser.end();
  } catch (err) {
    console.error('Error processing stream:', err); // Debug log
    throw err instanceof Error ? err : new Error(String(err));
  }

  // Wait for metadata resolution or default metadata if attempt_completion was not encountered
  const metadata = await Promise.race([
    metadataPromise,
    Promise.resolve({
      taskId,
      input: input.content,
      thinking: state.thinkingChain,
      toolCalls,
      usage: { ...usageMetrics }
    } as ExtendedTaskMetadata)
  ]);

  console.log('Tool calls:', toolCalls); // Debug log
  return metadata;
}