import { processModelStream } from '../model-stream-processor';
import { ApiStreamChunk } from '../../api/transform/stream';
import { TaskInput } from '../../core-old/agent/types/config';
import { AttemptCompletionTool } from '../../lib/tools-deprecated/attempt-completion';
import { ThinkingTool } from '../../lib/tools-deprecated/thinking-tool';
import { HatarakuTool } from '../../lib/types';
import { createMockStream as createOutputMockStream } from '../../lib/testing/mock-stream';

// Helper function to create async iterable from chunks
async function* createMockStream(chunks: ApiStreamChunk[]): AsyncIterable<ApiStreamChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

// Mock non-streaming tool for testing
const mockFooTool: HatarakuTool = {
  name: 'foo',
  description: 'A mock tool for testing',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false
  },
  execute: async () => ({
    content: [{
      type: 'text',
      text: 'foo executed'
    }]
  })
};

// Mock math addition tool
const mathAddTool: HatarakuTool = {
  name: 'math_add',
  description: 'Add two numbers together',
  inputSchema: {
    type: 'object',
    properties: {
      a: { type: 'number' },
      b: { type: 'number' }
    },
    required: ['a', 'b'],
    additionalProperties: false
  },
  
  execute: async (params: { a: number; b: number }) => {
    return {
      content: [{
        type: 'text',
        text: `The result is ${params.a + params.b}`
      }]
    };
  }
};

describe('Model Stream Processor', () => {
  let state: { thinkingChain: string[] };
  let attemptCompletionOutputStream: AsyncGenerator<string, any, any> & { push(item: string): void; end(): void };
  let tools: HatarakuTool[];

  beforeEach(() => {
    attemptCompletionOutputStream = createOutputMockStream<string>();
    state = {
      thinkingChain: []
    };

    // Create tools with stream handlers
    const completionTool = new AttemptCompletionTool(attemptCompletionOutputStream);
    const thinkingTool = new ThinkingTool(state.thinkingChain);
    tools = [completionTool, thinkingTool, mockFooTool, mathAddTool];
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
    );

    const chunks: string[] = [];
    for await (const chunk of attemptCompletionOutputStream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['result']);
    expect(metadata.taskId).toEqual('test-task-1');
    expect(metadata.input).toEqual('test task');
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
    );

    attemptCompletionOutputStream.end();
    const chunks: string[] = [];
    for await (const chunk of attemptCompletionOutputStream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([]);
    expect(metadata.taskId).toEqual('test-task-2');
    expect(metadata.input).toEqual('test task');
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

    const metadata = await processModelStream(
      createMockStream(mockChunks),
      'test-task-3',
      input,
      tools,
    );

    // Verify that the error was captured in metadata
    
    expect(metadata.errors).toMatchObject([{"message": "Mismatched closing tag </B> for tool element <A>.", "timestamp": expect.any(Number), "type": "parse_error"}, {"message": "Stream ended while still inside an element", "timestamp": expect.any(Number), "type": "stream_end_error"}]);
    

    // Verify that other metadata is still present
    expect(metadata.taskId).toEqual('test-task-3');
    expect(metadata.toolCalls).toHaveLength(1);
    expect(metadata.toolCalls[0].name).toEqual('thinking');
  });

  it('should handle stream end errors', async () => {
    const mockChunks: ApiStreamChunk[] = [
      { type: 'text', text: '<thinking>analyzing</thinking>' },
      { type: 'text', text: '<foo><param1>test' } // Incomplete XML
    ];

    const input: TaskInput<string> = {
      content: 'test task',
      role: 'assistant'
    };

    const metadata = await processModelStream(
      createMockStream(mockChunks),
      'test-task-end-error',
      input,
      tools,
    );

    // Verify that the error was captured in metadata
    expect(metadata.errors).toBeDefined();
    expect(metadata.errors!.length).toBe(1);
    expect(metadata.errors![0]).toMatchObject({
      type: 'stream_end_error',
      message: expect.stringContaining('Stream ended while still inside an element'),
      timestamp: expect.any(Number)
    });

    // Verify that partial processing still occurred
    expect(metadata.toolCalls).toHaveLength(1);
    expect(metadata.toolCalls[0].name).toEqual('thinking');
  });

  it('should handle multiple errors in the same stream', async () => {
    const mockChunks: ApiStreamChunk[] = [
      { type: 'text', text: '<thinking>analyzing</thinking>' },
      { type: 'text', text: '<A>tag</B>' }, // Parse error
      { type: 'text', text: '<foo><param1>test' } // Stream end error
    ];

    const input: TaskInput<string> = {
      content: 'test task',
      role: 'assistant'
    };

    const metadata = await processModelStream(
      createMockStream(mockChunks),
      'test-task-multiple-errors',
      input,
      tools,
    );

    // Verify that both errors were captured
    expect(metadata.errors).toBeDefined();
    expect(metadata.errors!.length).toBe(2);
    expect(metadata.errors![0]).toMatchObject({
      type: 'parse_error',
      message: expect.stringContaining('Mismatched closing tag'),
      timestamp: expect.any(Number)
    });
    expect(metadata.errors![1]).toMatchObject({
      type: 'stream_end_error',
      message: expect.stringContaining('Stream ended while still inside an element'),
      timestamp: expect.any(Number)
    });

    // Verify that successful operations were still recorded
    expect(metadata.toolCalls).toHaveLength(1);
    expect(metadata.toolCalls[0].name).toEqual('thinking');
  });

  it('should complete successfully when no errors occur', async () => {
    const mockChunks: ApiStreamChunk[] = [
      { type: 'text', text: '<thinking>analyzing</thinking>' },
      { type: 'text', text: '<attempt_completion>success</attempt_completion>' }
    ];

    const input: TaskInput<string> = {
      content: 'test task',
      role: 'assistant'
    };

    const metadata = await processModelStream(
      createMockStream(mockChunks),
      'test-task-no-errors',
      input,
      tools,
    );

    // Verify that no errors were recorded
    expect(metadata.errors).toBeUndefined();
    
    // Verify normal processing occurred
    expect(metadata.toolCalls).toHaveLength(2);
    expect(metadata.toolCalls[0].name).toEqual('thinking');
    expect(metadata.toolCalls[1].name).toEqual('attempt_completion');
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
    );

    const chunks: string[] = [];
    for await (const chunk of attemptCompletionOutputStream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['final result']);
    expect(metadata.taskId).toEqual('test-task-4');
    expect(metadata.input).toEqual('test task');
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
      );

      const chunks: string[] = [];
      for await (const chunk of attemptCompletionOutputStream) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['Here is the final result']);
      expect(metadata.taskId).toEqual('test-task-completion');
      expect(metadata.input).toEqual('test task');
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
      );

      const chunks: string[] = [];
      for await (const chunk of attemptCompletionOutputStream) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['First part of the result']);
      expect(metadata.taskId).toEqual('test-task-chunks');
      expect(metadata.input).toEqual('test task');
      expect(metadata.toolCalls.length).toBe(3);
      expect(metadata.toolCalls[0].name).toEqual('thinking');
      expect(metadata.toolCalls[1].name).toEqual('foo');
      expect(metadata.toolCalls[2].name).toEqual('attempt_completion');
      expect(metadata.usage).toEqual({ tokensIn: 0, tokensOut: 0, cacheWrites: 0, cacheReads: 0, cost: 0 });
    });
  });

  it('should execute math_add tool and include result in metadata', async () => {
    const mockChunks: ApiStreamChunk[] = [
      { type: 'text', text: '<thinking>Let me calculate that for you</thinking>' },
      { type: 'text', text: '<math_add><a>5</a><b>3</b></math_add>' },
      { type: 'text', text: '<attempt_completion>The result is 8</attempt_completion>' }
    ];

    const input: TaskInput<string> = {
      content: 'test task',
      role: 'assistant'
    };

    const metadata = await processModelStream(
      createMockStream(mockChunks),
      'test-task-math',
      input,
      tools,
    );

    // Verify tool execution and result
    expect(metadata.toolCalls).toHaveLength(3);
    expect(metadata.toolCalls[0].name).toEqual('thinking');
    expect(metadata.toolCalls[1]).toMatchObject({
      name: 'math_add',
      params: { a: '5', b: '3' },
    });
    expect(metadata.toolCalls[2].name).toEqual('attempt_completion');

    // Verify final output
    const chunks: string[] = [];
    for await (const chunk of attemptCompletionOutputStream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['The result is 8']);
  });

  it('should work with very large chunks', async () => {
    const text = '<thinking>Let me calculate that for you</thinking><math_add><a>5</a><b>3</b></math_add><attempt_completion>The result is 8</attempt_completion>';
    const mockChunks: ApiStreamChunk[] = [
      { type: 'text', text: text }
    ];
    const input: TaskInput<string> = {
      content: 'test task',
      role: 'assistant'
    };

    const metadata = await processModelStream(
      createMockStream(mockChunks),
      'test-task-large-chunk',
      input,
      tools,
    );

    expect(metadata.toolCalls).toHaveLength(3);
    expect(metadata.toolCalls[0].name).toEqual('thinking');
    expect(metadata.toolCalls[1].name).toEqual('math_add');
    expect(metadata.toolCalls[2].name).toEqual('attempt_completion');
    
    
  })
});