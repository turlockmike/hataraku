import { AttemptCompletionTool } from '../attempt-completion';
import { createMockStream } from '../../testing/mock-stream';

describe('AttemptCompletionTool', () => {
  let tool: AttemptCompletionTool;
  let mockStream: AsyncGenerator<string> & { push(item: string): void; end(): void };
  
  beforeEach(() => {
    mockStream = createMockStream<string>();
    tool = new AttemptCompletionTool(mockStream);
  });

  test('should correctly handle stream data via streamHandler', async () => {
    const chunk1 = 'Hello';
    const chunk2 = ' World';

    // Test stream handling with callback
    let resolvedValue;
    await new Promise<void>((resolve) => {
      tool.streamHandler.stream(chunk1, (val: any) => {
        resolvedValue = val;
        resolve();
      });
    });
    expect(resolvedValue).toBe(chunk1);

    // Call stream without a callback
    tool.streamHandler.stream(chunk2);

    // Finalize and get the concatenated result
    let finalContent;
    await new Promise<void>((resolve) => {
      tool.streamHandler.finalize((val: any) => {
        finalContent = val;
        resolve();
      });
    });

    expect(finalContent).toBe(chunk1 + chunk2);
    // Use for await...of to get all chunks from the stream
    const chunks: string[] = [];
    for await (const chunk of mockStream) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual([chunk1, chunk2]);
  });

  test('should execute successfully', async () => {
    const resultInput = 'final result';
    const res = await tool.execute({ result: resultInput });
    expect(res).toEqual({
      content: [{
        type: 'text',
        text: resultInput
      }]
    });
  });

}); 