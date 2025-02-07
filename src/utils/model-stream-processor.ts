import { ApiStreamChunk } from '../api/transform/stream';
import { TaskInput } from '../core/agent/types/config';
import { TaskMetadata } from '../core/agent/agent';
import { XMLStreamParser } from './xml-stream-processor';
import { transformApiStreamForXmlParser } from './stream-processor';
import { UnifiedTool } from '../lib/types';

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
  state: StreamProcessorState
): Promise<TaskMetadata> {
  // Create metadata promise that resolves when attempt_completion is called
  let metadataResolve: ((value: TaskMetadata) => void) | null = null;
  const metadataPromise = new Promise<TaskMetadata>((resolve) => {
    metadataResolve = resolve;
  });

  // Create parser with handlers that update the state
  const handlers: { [toolName: string]: { stream: (data: string) => void, finalize?: () => void } } = {};
  for (const tool of tools) {
    if ('streamHandler' in tool && tool.streamHandler) {
      handlers[tool.name] = tool.streamHandler;
    }
  }

  const parser = new XMLStreamParser({
    streamHandlers: handlers,
    onToolParsed: (toolName: string, params: { [paramName: string]: string }) => {
      // For tools without stream handlers, call execute
      const tool = tools.find(t => t.name === toolName);
      if (tool && !('streamHandler' in tool)) {
        tool.execute(params, process.cwd());
      }

      // Resolve metadata when attempt_completion is called
      if (toolName === 'attempt_completion' && metadataResolve) {
        metadataResolve({
          taskId,
          input: input.content,
          thinking: state.thinkingChain
        });
      }
    }
  });

  const transformedStream = transformApiStreamForXmlParser(modelStream);

  // Process the stream
  try {
    for await (const text of transformedStream) {
      parser.write(text);
    }
    parser.end();
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }

  // Return empty metadata if no attempt_completion was called
  const metadata = await Promise.race([
    metadataPromise,
    Promise.resolve({
      taskId,
      input: input.content,
      thinking: state.thinkingChain
    })
  ]);

  return metadata;
}