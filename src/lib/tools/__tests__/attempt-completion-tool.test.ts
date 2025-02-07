import { AttemptCompletionTool } from '../attempt-completion-tool';

describe('AttemptCompletionTool', () => {
  let tool: AttemptCompletionTool;
  let outputStream: string[];
  
  beforeEach(() => {
    outputStream = [];
    tool = new AttemptCompletionTool(outputStream);
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
    expect(outputStream).toEqual([chunk1, chunk2]);
  });

  test('should execute successfully', async () => {
    const resultInput = 'final result';
    const res = await tool.execute({ result: resultInput }, 'test-cwd');
    expect(res).toEqual({
      success: true,
      message: resultInput
    });
  });

}); 