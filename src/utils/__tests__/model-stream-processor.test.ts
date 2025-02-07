import { processModelStream, StreamProcessorState } from '../model-stream-processor';
import { ApiStreamChunk } from '../../api/transform/stream';
import { TaskInput } from '../../core/agent/types/config';
import { AttemptCompletionTool } from '../../lib/tools/attempt-completion-tool';
import { ThinkingTool } from '../../lib/tools/thinking-tool';
import { UnifiedTool } from '../../lib/types';

// Helper function to create async iterable from chunks
async function* createMockStream(chunks: ApiStreamChunk[]): AsyncIterable<ApiStreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

describe('Model Stream Processor', () => {
  let state: StreamProcessorState;
  let attemptCompletionOutputStream: string[];
  let tools: UnifiedTool[];

  beforeEach(() => {
    attemptCompletionOutputStream = [];
    state = {
      thinkingChain: []
    };

    // Create tools with stream handlers
    const completionTool = new AttemptCompletionTool(attemptCompletionOutputStream);
    const thinkingTool = new ThinkingTool(state.thinkingChain);
    tools = [completionTool, thinkingTool];
  });

  it('should process stream and emit thinking and completion chunks', async () => {
    const mockChunks: ApiStreamChunk[] = [
      { type: 'text', text: '<thinking>analyzing</thinking>' },
      { type: 'usage', inputTokens: 10, outputTokens: 5 },
      { type: 'text', text: '<attempt_completion>result</attempt_completion>' }
    ];

    const input: TaskInput<string> = {
      content: 'test task',
      role: 'assistant'
    };

    const metadata = await processModelStream(
      createMockStream(mockChunks),
      'test-task-1',
      input,
      tools,
      state
    );

    expect(attemptCompletionOutputStream).toEqual(['result']);
    expect(metadata).toEqual({
      taskId: 'test-task-1',
      input: 'test task',
      thinking: ['analyzing']
    });
  });

  it('should handle empty stream', async () => {
    const mockChunks: ApiStreamChunk[] = [];
    const input: TaskInput<string> = {
      content: 'test task',
      role: 'assistant'
    };

    const metadata = await processModelStream(
      createMockStream(mockChunks),
      'test-task-2',
      input,
      tools,
      state
    );

    expect(attemptCompletionOutputStream).toEqual([]);
    expect(metadata).toEqual({
      taskId: 'test-task-2',
      input: 'test task',
      thinking: []
    });
  });

  it('should handle stream errors', async () => {
    const mockChunks: ApiStreamChunk[] = [
      { type: 'text', text: '<thinking>analyzing</thinking>' },
      { type: 'text', text: '<invalid>tag</invalid>' } // This will cause XMLStreamParser to throw
    ];

    const input: TaskInput<string> = {
      content: 'test task',
      role: 'assistant'
    };

    await expect(processModelStream(
      createMockStream(mockChunks),
      'test-task-3',
      input,
      tools,
      state
    )).rejects.toThrow();
  });

  it('should handle multiple thinking blocks before completion', async () => {
    const mockChunks: ApiStreamChunk[] = [
      { type: 'text', text: '<thinking>step 1</thinking>' },
      { type: 'text', text: '<thinking>step 2</thinking>' },
      { type: 'text', text: '<attempt_completion>final result</attempt_completion>' }
    ];

    const input: TaskInput<string> = {
      content: 'test task',
      role: 'assistant'
    };

    const metadata = await processModelStream(
      createMockStream(mockChunks),
      'test-task-4',
      input,
      tools,
      state
    );

    expect(attemptCompletionOutputStream).toEqual(['final result']);
    expect(metadata.thinking).toEqual(['step 1', 'step 2']);
  });

  describe('integration with AttemptCompletionTool', () => {
    test('should process completion stream through AttemptCompletionTool', async () => {
      const mockChunks: ApiStreamChunk[] = [
        { type: 'text', text: '<thinking>analyzing request</thinking>' },
        { type: 'text', text: '<attempt_completion>Here is the final result</attempt_completion>' }
      ];

      const input: TaskInput<string> = {
        content: 'test task',
        role: 'assistant'
      };

      const metadata = await processModelStream(
        createMockStream(mockChunks),
        'test-task-completion',
        input,
        tools,
        state
      );

      expect(attemptCompletionOutputStream).toEqual(['Here is the final result']);
      expect(metadata).toEqual({
        taskId: 'test-task-completion',
        input: 'test task',
        thinking: ['analyzing request']
      });
    });

    test('should handle multiple completion chunks', async () => {
      const mockChunks: ApiStreamChunk[] = [
        { type: 'text', text: '<thinking>step 1</thinking>' },
        { type: 'text', text: '<attempt_completion>First part of the result</attempt_completion>' }
      ];

      const input: TaskInput<string> = {
        content: 'test task',
        role: 'assistant'
      };

      const metadata = await processModelStream(
        createMockStream(mockChunks),
        'test-task-chunks',
        input,
        tools,
        state
      );

      expect(attemptCompletionOutputStream).toEqual(['First part of the result']);
      expect(metadata).toEqual({
        taskId: 'test-task-chunks',
        input: 'test task',
        thinking: ['step 1']
      });
    });
  });
});