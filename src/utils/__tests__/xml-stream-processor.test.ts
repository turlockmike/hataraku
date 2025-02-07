import { XMLStreamParser } from '../xml-stream-processor';

describe('XMLStreamParser', () => {
  test('should stream content in streaming mode with multiple chunks', () => {
    let streamedData = '';
    let finalized = false;
    const parser = new XMLStreamParser({
      streamHandlers: {
        liveTool: {
          stream: (data: string) => { streamedData += data; },
          finalize: () => { finalized = true; },
        },
      },
      onToolParsed: jest.fn(),
    });

    // Streaming mode: the tool "liveTool" is defined in streamHandlers.
    parser.write('<liveTool>');
    parser.write('Hello, ');
    expect(streamedData).toBe('Hello, ');
    parser.write('world!');
    expect(streamedData).toBe('Hello, world!');
    parser.write('</liveTool>');
    parser.end();

    expect(streamedData).toBe('Hello, world!');
    expect(finalized).toBe(true);
  });

  test('should parse tool with parameters in parsing mode', () => {
    const onToolParsed = jest.fn();
    const parser = new XMLStreamParser({
      streamHandlers: {}, // no streaming handlers, so this tool is parsed.
      onToolParsed,
    });

    // Parsing mode: the tool "otherTool" is not in the streamHandlers mapping.
    // The content of <param1> is treated as literal, even if it contains XML-like text.
    parser.write('<otherTool><param1>');
    parser.write('Hello <b>world</b>!');
    parser.write('</param1></otherTool>');
    parser.end();

    expect(onToolParsed).toHaveBeenCalledWith('otherTool', { param1: 'Hello <b>world</b>!' });
  });

  test('should correctly accumulate parameter content over multiple chunks', () => {
    const onToolParsed = jest.fn();
    const parser = new XMLStreamParser({
      streamHandlers: {},
      onToolParsed,
    });

    parser.write('<otherTool><param1>Hel');
    parser.write('lo, ');
    parser.write('world!</param1></otherTool>');
    parser.end();

    expect(onToolParsed).toHaveBeenCalledWith('otherTool', { param1: 'Hello, world!' });
  });

  test('should handle text content in parsing mode', () => {
    const onToolParsed = jest.fn();
    const parser = new XMLStreamParser({
      streamHandlers: {},
      onToolParsed,
    });

    parser.write('<otherTool>');
    parser.write('Unexpected text');
    parser.write('</otherTool>');
    parser.end();

    expect(onToolParsed).toHaveBeenCalledWith('otherTool', { content: 'Unexpected text' });
  });

  test('should throw error for mismatched closing tag in streaming mode', () => {
    let streamedData = '';
    let finalized = false;
    const parser = new XMLStreamParser({
      streamHandlers: {
        liveTool: {
          stream: (data: string) => { streamedData += data; },
          finalize: () => { finalized = true; },
        },
      },
      onToolParsed: jest.fn(),
    });

    parser.write('<liveTool>');
    parser.write('Hello');

    // Writing a closing tag with a different tool name should throw an error.
    expect(() => {
      parser.write('</notLiveTool>');
    }).toThrow(/Mismatched closing tag/);

    // Even though an error is thrown, finalized should not be called.
    expect(finalized).toBe(false);
  });

  test('should throw error for unexpected opening tag in streaming mode', () => {
    let streamedData = '';
    const parser = new XMLStreamParser({
      streamHandlers: {
        liveTool: {
          stream: (data: string) => { streamedData += data; },
          finalize: jest.fn(),
        },
      },
      onToolParsed: jest.fn(),
    });

    parser.write('<liveTool>');
    parser.write('Hello');
    // In streaming mode, encountering an opening tag (other than the expected closing tag)
    // should throw an error.
    expect(() => {
      parser.write('<unexpectedTag>');
    }).toThrow(/Unexpected opening tag/);
  });

  test('should throw error if stream ends with incomplete XML (trailing text)', () => {
    const parser = new XMLStreamParser({
      streamHandlers: {},
      onToolParsed: jest.fn(),
    });

    // Write a parameter that is never closed.
    parser.write('<otherTool><param1>Incomplete parameter');

    expect(() => {
      parser.end();
    }).toThrow(/Stream ended while still inside an element/);
  });

  test('should throw error if stream ends while inside an element', () => {
    const parser = new XMLStreamParser({
      streamHandlers: {},
      onToolParsed: jest.fn(),
    });

    // Open a tool element that is never closed.
    parser.write('<otherTool>');
    expect(() => {
      parser.end();
    }).toThrow(/Stream ended while still inside an element/);
  });

  describe('tool usage functionality', () => {
    // Helper function to create async iterable from chunks
    const processStream = (chunks: string[], streamHandlers: any = {}, onToolParsed = jest.fn()) => {
      const parser = new XMLStreamParser({
        streamHandlers,
        onToolParsed,
      });

      chunks.forEach(chunk => parser.write(chunk));
      parser.end();
    };

    describe('thinking blocks', () => {
      it('should process thinking blocks as streaming content', () => {
        let thoughtContent1 = '';
        let thoughtContent2 = '';
        let currentThought = 1;
        
        const thinkingHandler = {
          stream: (data: string) => {
            if (currentThought === 1) {
              thoughtContent1 += data;
            } else {
              thoughtContent2 += data;
            }
          },
          finalize: () => {
            currentThought++;
          },
        };
        
        processStream([
          '<thinking>analyzing code</thinking>',
          '<thinking>planning next step</thinking>'
        ], { thinking: thinkingHandler });

        expect(thoughtContent1).toBe('analyzing code');
        expect(thoughtContent2).toBe('planning next step');
      });

      it('should handle thinking blocks split across chunks', () => {
        let thoughtContent = '';
        const thinkingHandler = {
          stream: (data: string) => { thoughtContent += data; },
          finalize: jest.fn(),
        };
        
        processStream([
          '<think',
          'ing>analyzing</thinking>'
        ], { thinking: thinkingHandler });

        expect(thoughtContent).toBe('analyzing');
        expect(thinkingHandler.finalize).toHaveBeenCalled();
      });
    });

    describe('tool calls', () => {
      it('should handle streaming tool calls', () => {
        let streamedContent = '';
        const streamingTool = {
          stream: (data: string) => { streamedContent += data; },
          finalize: jest.fn(),
        };

        processStream([
          '<attempt_completion>',
          'streamed content',
          '</attempt_completion>'
        ], { attempt_completion: streamingTool });

        expect(streamedContent).toBe('streamed content');
        expect(streamingTool.finalize).toHaveBeenCalled();
      });

      it('should parse parameters for non-streaming tool calls', () => {
        const onToolParsed = jest.fn();
        
        processStream([
          '<create_jira_ticket>',
          '<summary>Bug fix</summary>',
          '<description>Fix the issue</description>',
          '</create_jira_ticket>'
        ], {}, onToolParsed);

        expect(onToolParsed).toHaveBeenCalledWith('create_jira_ticket', {
          summary: 'Bug fix',
          description: 'Fix the issue'
        });
      });

      it('should preserve nested XML-like content in parameters', () => {
        const onToolParsed = jest.fn();
        
        processStream([
          '<create_jira_ticket>',
          '<summary>Bug fix</summary>',
          '<description>Fix <code>main.ts</code></description>',
          '</create_jira_ticket>'
        ], {}, onToolParsed);

        expect(onToolParsed).toHaveBeenCalledWith('create_jira_ticket', {
          summary: 'Bug fix',
          description: 'Fix <code>main.ts</code>'
        });
      });
    });

    describe('error handling', () => {
      it('should handle malformed tool calls gracefully', () => {
        const onToolParsed = jest.fn();
        
        expect(() => {
          processStream([
            '<create_jira_ticket>',
            '<summary>Bug fix',
            '<description>Missing closing tags',
            '</create_jira_ticket>'
          ], {}, onToolParsed);
        }).toThrow();

        expect(onToolParsed).not.toHaveBeenCalled();
      });
    });

    describe('streaming behavior', () => {
      it('should handle mixed content with streaming and non-streaming tools', () => {
        let streamedContent = '';
        let thoughtContent = '';
        const onToolParsed = jest.fn();
        
        const streamingTool = {
          stream: (data: string) => { streamedContent += data; },
          finalize: jest.fn(),
        };

        const thinkingHandler = {
          stream: (data: string) => { thoughtContent += data + ';'; },
          finalize: jest.fn(),
        };

        processStream([
          '<thinking>first thought</thinking>',
          '<attempt_completion>stream this</attempt_completion>',
          '<thinking>second thought</thinking>'
        ], { 
          attempt_completion: streamingTool,
          thinking: thinkingHandler 
        }, onToolParsed);

        expect(streamedContent).toBe('stream this');
        expect(thoughtContent).toBe('first thought;second thought;');
        expect(thinkingHandler.finalize).toHaveBeenCalledTimes(2);
        expect(streamingTool.finalize).toHaveBeenCalledTimes(1);
        expect(onToolParsed).toHaveBeenCalledTimes(3);
      });
    });
  });
  test('should call finalize for open streaming tool on end() when closing tag is missing', () => {
    let streamedContent = '';
    let finalizeCalled = false;
    const parser = new XMLStreamParser({
      streamHandlers: {
        liveTool: {
          stream: (data: string) => { streamedContent += data; },
          finalize: () => { finalizeCalled = true; },
        },
      },
      onToolParsed: jest.fn(),
    });
  
    parser.write('<liveTool>');
    parser.write('Stream without close tag');
    parser.end();
  
    expect(streamedContent).toBe('Stream without close tag');
    expect(finalizeCalled).toBe(true);
  });

  describe('onToolParsed behavior', () => {
    it('should call onToolParsed for streaming and non-streaming tools with correct parameters', () => {
      const onToolParsed = jest.fn();
      const streamHandler = jest.fn();
      const parser = new XMLStreamParser({
        streamHandlers: {
          streaming_tool: {
            stream: streamHandler,
            finalize: jest.fn(),
          },
        },
        onToolParsed,
      });

      // Single parameter
      parser.write('<simple_tool><param1>value1</param1></simple_tool>');
      expect(onToolParsed).toHaveBeenCalledWith('simple_tool', { param1: 'value1' });

      // Multiple parameters
      parser.write('<complex_tool><param1>value1</param1><param2>value2</param2></complex_tool>');
      expect(onToolParsed).toHaveBeenCalledWith('complex_tool', { param1: 'value1', param2: 'value2' });

      // Empty parameter
      parser.write('<empty_tool><param1></param1></empty_tool>');
      expect(onToolParsed).toHaveBeenCalledWith('empty_tool', { param1: '' });

      // Tool with no parameters
      parser.write('<no_params_tool></no_params_tool>');
      expect(onToolParsed).toHaveBeenCalledWith('no_params_tool', {});

      // Direct text content
      parser.write('<text_tool>direct text content</text_tool>');
      expect(onToolParsed).toHaveBeenCalledWith('text_tool', { content: 'direct text content' });

      // Streaming tool
      parser.write('<streaming_tool>some content</streaming_tool>');
      expect(onToolParsed).toHaveBeenCalledWith('streaming_tool', { 
        content: 'some content',
      });
      expect(streamHandler).toHaveBeenCalledWith('some content', undefined);

      // Mixed content and parameters
      parser.write('<mixed_tool>some text<param1>value1</param1>more text</mixed_tool>');
      expect(onToolParsed).toHaveBeenCalledWith('mixed_tool', { 
        content: 'some textmore text',
        param1: 'value1'
      });

      // Verify total number of calls
      expect(onToolParsed).toHaveBeenCalledTimes(7);
    });

    it('should be called for streaming tools', () => {
      const onToolParsed = jest.fn();
      const streamHandler = {
        stream: jest.fn(),
        finalize: jest.fn(),
      };
      
      const parser = new XMLStreamParser({
        streamHandlers: { streaming_tool: streamHandler },
        onToolParsed,
      });

      parser.write('<streaming_tool>some content</streaming_tool>');
      expect(onToolParsed).toHaveBeenCalledWith('streaming_tool', { content: 'some content' });
      expect(streamHandler.stream).toHaveBeenCalledWith('some content', undefined);
      expect(streamHandler.finalize).toHaveBeenCalled();
    });

    it('should handle mixed streaming and non-streaming tools correctly', () => {
      const onToolParsed = jest.fn();
      const streamHandler = {
        stream: jest.fn(),
        finalize: jest.fn(),
      };
      
      const parser = new XMLStreamParser({
        streamHandlers: { streaming_tool: streamHandler },
        onToolParsed,
      });

      parser.write('<non_streaming_tool><param1>value1</param1></non_streaming_tool>');
      parser.write('<streaming_tool>stream content</streaming_tool>');
      parser.write('<non_streaming_tool><param2>value2</param2></non_streaming_tool>');

      expect(onToolParsed).toHaveBeenCalledTimes(3);
      expect(onToolParsed).toHaveBeenNthCalledWith(1, 'non_streaming_tool', { param1: 'value1' });
      expect(onToolParsed).toHaveBeenNthCalledWith(2, 'streaming_tool', { content: 'stream content' });
      expect(onToolParsed).toHaveBeenNthCalledWith(3, 'non_streaming_tool', { param2: 'value2' });
      
      expect(streamHandler.stream).toHaveBeenCalledWith('stream content', undefined);
      expect(streamHandler.finalize).toHaveBeenCalled();
    });
  });

  test('should not include closing tag information in streamed content', () => {
    let streamedData = '';
    const parser = new XMLStreamParser({
      streamHandlers: {
        liveTool: {
          stream: (data: string) => { streamedData += data; },
          finalize: jest.fn(),
        },
      },
      onToolParsed: jest.fn(),
    });

    // Write content in chunks that include closing tag
    parser.write('<liveTool>Hello');
    parser.write(' world</liveTool>');
    parser.write('<liveTool>Another');
    parser.write(' message</live');
    parser.write('Tool>');
    parser.end();

    // Verify that no closing tag information is included
    expect(streamedData).toBe('Hello world' + 'Another message');
    expect(streamedData).not.toContain('</liveTool>');
    expect(streamedData).not.toContain('</live');
  });

  test('multiple tools in multiple chunks', () => {
    const onToolParsed = jest.fn();
    const parser = new XMLStreamParser({
      streamHandlers: {},
      onToolParsed,
    });

    parser.write('<thinking>Let me calculate that for you</thinking>');
    parser.write('<math_add><');
    parser.write('a>5</a');
    parser.write('><b>3</b');
    parser.write('></math_add>');
    parser.write('<attempt_completion>The result is 8</attempt_completion>');
    parser.end();
    
    expect(onToolParsed).toHaveBeenCalledWith('thinking', { content: 'Let me calculate that for you' });
    expect(onToolParsed).toHaveBeenCalledWith('math_add', { a: '5', b: '3' });
    expect(onToolParsed).toHaveBeenCalledWith('attempt_completion', { content: 'The result is 8' });
    
  })

  test('onComplete callback', () => {
    const onComplete = jest.fn();
    const parser = new XMLStreamParser({
      streamHandlers: {},
      onToolParsed: jest.fn(),
      onComplete,
    });

    parser.write('<thinking>Let me calculate that for you</thinking>');
    parser.write('<math_add><');
    parser.write('a')
    parser.write('>5</');
    parser.write('a><b>3</b');
    parser.write('></math_add>');
    expect(onComplete).not.toHaveBeenCalled();
    parser.end();
    expect(onComplete).toHaveBeenCalled();
  })
});
