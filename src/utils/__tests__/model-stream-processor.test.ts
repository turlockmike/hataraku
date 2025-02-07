import { processModelStream } from '../model-stream-processor';
import { ApiStreamChunk } from '../../api/transform/stream';
import { TaskInput } from '../../core/agent/types/config';
import { AttemptCompletionTool } from '../../lib/tools/attempt-completion-tool';
import { ThinkingTool } from '../../lib/tools/thinking-tool';
import { UnifiedTool } from '../../lib/types';
import { createMockStream as createOutputMockStream } from '../../lib/testing/mock-stream';

// Helper function to create async iterable from chunks
async function* createMockStream(chunks: ApiStreamChunk[]): AsyncIterable<ApiStreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

// Mock non-streaming tool for testing
const mockFooTool: UnifiedTool = {
  name: 'foo',
  description: 'A mock tool for testing',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false
  },
  parameters: {},
  execute: async () => [false, 'foo executed']
};

describe('Model Stream Processor', () => {
  let state: { thinkingChain: string[] };
  let attemptCompletionOutputStream: AsyncGenerator<string, any, any> & { push(item: string): void; end(): void };
  let tools: UnifiedTool[];

  beforeEach(() => {
    attemptCompletionOutputStream = createOutputMockStream<string>();
    state = {
      thinkingChain: []
    };

    // Create tools with stream handlers
    const completionTool = new AttemptCompletionTool(attemptCompletionOutputStream);
    const thinkingTool = new ThinkingTool(state.thinkingChain);
    tools = [completionTool, thinkingTool, mockFooTool];
  });

  it('should process stream and emit thinking and completion chunks', async () => {
    const mockChunks: ApiStreamChunk[] = [
      { type: 'text', text: '<thinking>analyzing</thinking>' },
      { type: 'usage', inputTokens: 10, outputTokens: 5 },
      { type: 'text', text: '<foo><content>test</content></foo>' },
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

    const chunks: string[] = [];
    for await (const chunk of attemptCompletionOutputStream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['result']);
    expect(metadata.taskId).toEqual('test-task-1');
    expect(metadata.input).toEqual('test task');
    expect(metadata.thinking).toEqual(['analyzing']);
    expect(metadata.usage).toEqual({ tokensIn: 10, tokensOut: 5, cacheWrites: 0, cacheReads: 0, cost: 0 });
    expect(metadata.toolCalls.length).toBe(3);
    expect(metadata.toolCalls[0].name).toEqual('thinking');
    expect(metadata.toolCalls[1].name).toEqual('foo');
    expect(metadata.toolCalls[2].name).toEqual('attempt_completion');
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

    attemptCompletionOutputStream.end();
    const chunks: string[] = [];
    for await (const chunk of attemptCompletionOutputStream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([]);
    expect(metadata.taskId).toEqual('test-task-2');
    expect(metadata.input).toEqual('test task');
    expect(metadata.thinking).toEqual([]);
    expect(metadata.toolCalls).toEqual([]);
    expect(metadata.usage).toEqual({ tokensIn: 0, tokensOut: 0, cacheWrites: 0, cacheReads: 0, cost: 0 });
  });

  it('should handle stream errors', async () => {
    const mockChunks: ApiStreamChunk[] = [
      { type: 'text', text: '<thinking>analyzing</thinking>' },
      { type: 'text', text: '<A>tag</B>' } // This will cause XMLStreamParser to throw
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
      { type: 'text', text: '<foo><content>test1</content></foo>' },
      { type: 'text', text: '<thinking>step 2</thinking>' },
      { type: 'text', text: '<foo><content>test2</content></foo>' },
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

    const chunks: string[] = [];
    for await (const chunk of attemptCompletionOutputStream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['final result']);
    expect(metadata.taskId).toEqual('test-task-4');
    expect(metadata.input).toEqual('test task');
    expect(metadata.thinking).toEqual(['step 1', 'step 2']);
    expect(metadata.toolCalls.length).toBe(5);
    expect(metadata.toolCalls[0].name).toEqual('thinking');
    expect(metadata.toolCalls[1].name).toEqual('foo');
    expect(metadata.toolCalls[2].name).toEqual('thinking');
    expect(metadata.toolCalls[3].name).toEqual('foo');
    expect(metadata.toolCalls[4].name).toEqual('attempt_completion');
  });

  describe('integration with AttemptCompletionTool', () => {
    test('should process completion stream through AttemptCompletionTool', async () => {
      const mockChunks: ApiStreamChunk[] = [
        { type: 'text', text: '<thinking>analyzing request</thinking>' },
        { type: 'text', text: '<foo><content>test</content></foo>' },
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

      const chunks: string[] = [];
      for await (const chunk of attemptCompletionOutputStream) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['Here is the final result']);
      expect(metadata.taskId).toEqual('test-task-completion');
      expect(metadata.input).toEqual('test task');
      expect(metadata.thinking).toEqual(['analyzing request']);
      expect(metadata.toolCalls.length).toBe(3);
      expect(metadata.toolCalls[0].name).toEqual('thinking');
      expect(metadata.toolCalls[1].name).toEqual('foo');
      expect(metadata.toolCalls[2].name).toEqual('attempt_completion');
      expect(metadata.usage).toEqual({ tokensIn: 0, tokensOut: 0, cacheWrites: 0, cacheReads: 0, cost: 0 });
    });

    test('should handle multiple completion chunks', async () => {
      const mockChunks: ApiStreamChunk[] = [
        { type: 'text', text: '<thinking>step 1</thinking>' },
        { type: 'text', text: '<foo><content>test</content></foo>' },
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

      const chunks: string[] = [];
      for await (const chunk of attemptCompletionOutputStream) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['First part of the result']);
      expect(metadata.taskId).toEqual('test-task-chunks');
      expect(metadata.input).toEqual('test task');
      expect(metadata.thinking).toEqual(['step 1']);
      expect(metadata.toolCalls.length).toBe(3);
      expect(metadata.toolCalls[0].name).toEqual('thinking');
      expect(metadata.toolCalls[1].name).toEqual('foo');
      expect(metadata.toolCalls[2].name).toEqual('attempt_completion');
      expect(metadata.usage).toEqual({ tokensIn: 0, tokensOut: 0, cacheWrites: 0, cacheReads: 0, cost: 0 });
    });
  });
});