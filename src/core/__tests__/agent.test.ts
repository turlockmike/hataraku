import { z } from 'zod';
import { createAgent } from '../agent';
import { MockLanguageModelV1 } from 'ai/test';
import { Tool } from 'ai';


describe('Agent', () => {
  // Create a mock tool for testing
  const mockTool: Tool = {
    description: 'A mock tool for testing',
    parameters: z.object({
      input: z.string()
    }),
    execute: async ({ input }) => {
      return {
        content: `Executed mock tool with input: ${input}`
      };
    }
  };

  describe('createAgent', () => {
    it('should create an agent with basic configuration', () => {
      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            text: 'Test response',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} }
          })
        }),
        tools: {
          mock_tool: mockTool
        }
      });

      expect(agent.name).toBe('Test Agent');
      expect(agent.description).toBe('A test agent');
      expect(agent.tools).toEqual({
        mock_tool: mockTool
      });
    });

    it('should validate agent configuration', () => {
      expect(() => {
        createAgent({
          name: '',  // Invalid: empty name
          role: 'You are a test agent',
          description: 'Test agent',
          model: new MockLanguageModelV1({}),
          tools: {
            mock_tool: mockTool
          }
        });
      }).toThrow('Agent name cannot be empty');
    });
  });

  describe('agent.task', () => {
    it('should handle basic text generation', async () => {
      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            text: 'Test response',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} }
          })
        }),
        tools: {
          mock_tool: mockTool
        }
      });

      const result = await agent.task('Test task input');

      expect(result).toBe('Test response');
    });

    it('should execute a task with tool calls', async () => {
      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async (options) => {
            if (options.mode.type === 'object-json') {
              return {
                text: `{"content":"Hello, world!"}`,
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                rawCall: { rawPrompt: null, rawSettings: {} }
              }
            } else {
              return {
                text: 'Test response',
                toolCalls: [{
                  toolCallId: 'call-1',
                  toolCallType: 'function',
                  toolName: 'mock_tool',
                  args: JSON.stringify({ input: 'test input' })
                }],
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                rawCall: { rawPrompt: null, rawSettings: {} }
              }
            }
          }
        }),
        tools: {
          mock_tool: mockTool
        }
      });

      const result = await agent.task('Test task input', {
        schema: z.object({
          content: z.string()
        })
      });

      expect(result).toEqual({
        content: 'Hello, world!'
      });
    });

    it('should handle streaming responses', async () => {
      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          doStream: async () => ({
            stream: new ReadableStream({
              async start(controller) {
                controller.enqueue({ type: 'text-delta', textDelta: 'This' });
                controller.enqueue({ type: 'text-delta', textDelta: ' is' });
                controller.enqueue({ type: 'text-delta', textDelta: ' a' });
                controller.enqueue({ type: 'text-delta', textDelta: ' test' });
                controller.enqueue({ 
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { promptTokens: 10, completionTokens: 20 }
                });
                controller.close();
              }
            }),
            rawCall: { rawPrompt: null, rawSettings: {} }
          })
        }),
        tools: {
          mock_tool: mockTool
        }
      });

      const result = await agent.task('Test task input', {
        stream: true
      });

      const chunks: string[] = [];
      for await (const chunk of result) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['This', ' is', ' a', ' test']);
    });

    it('should validate output against schema', async () => {
      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          doGenerate: async () => ({
            defaultObjectGenerationMode: 'json',
            text: 'Invalid response',
            finishReason: 'stop',
            usage: { promptTokens: 10, completionTokens: 20 },
            rawCall: { rawPrompt: null, rawSettings: {} }
          })
        }),
        tools: {
          mock_tool: mockTool
        }
      });

      const schema = z.object({
        count: z.number()
      });

      await expect(
        agent.task('Test task input', {
          schema
        })
      ).rejects.toThrow();
    });

    it('should include message history and system prompt in API calls', async () => {
      const mockDoGenerate = jest.fn().mockImplementation(async (options) => ({
        text: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} }
      }));

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          doGenerate: mockDoGenerate
        }),
        tools: {}
      });

      const messages = [
        { role: 'user' as const, content: 'Previous message 1' },
        { role: 'assistant' as const, content: 'Previous response 1' }
      ];

      await agent.task('Current message', { messages });

      expect(mockDoGenerate).toHaveBeenCalledWith(expect.objectContaining({
        prompt: expect.arrayContaining([
          {
            role: 'system',
            content: expect.stringContaining('You are a test agent')
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'Previous message 1' }],
            providerMetadata: undefined
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Previous response 1' }],
            providerMetadata: undefined
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'Current message' }],
            providerMetadata: undefined
          }
        ])
      }));
    });

    it('should pass through call settings to the model', async () => {
      const mockDoGenerate = jest.fn().mockImplementation(async (options) => ({
        text: 'Test response',
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        rawCall: { rawPrompt: null, rawSettings: {} }
      }));

      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          doGenerate: mockDoGenerate
        }),
        tools: {},
        callSettings: {
          temperature: 0.7,
          maxTokens: 1000,
          topP: 0.9
        }
      });

      await agent.task('Test message');

      expect(mockDoGenerate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.7,
        maxTokens: 1000,
        topP: 0.9
      }));
    });

    it('should combine tool usage with message history', async () => {
      const agent = createAgent({
        name: 'Test Agent',
        role: 'You are a test agent',
        description: 'A test agent',
        model: new MockLanguageModelV1({
          defaultObjectGenerationMode: 'json',
          doGenerate: async (options) => {
            if (options.mode?.type === 'object-json') {
              return {
                text: '{"content":"Executed mock tool with input: test input"}',
                finishReason: 'stop',
                usage: { promptTokens: 10, completionTokens: 20 },
                rawCall: { rawPrompt: null, rawSettings: {} }
              };
            }
            return {
              text: 'Tool response',
              toolCalls: [{
                toolCallId: 'call-1',
                toolCallType: 'function',
                toolName: 'mock_tool',
                args: JSON.stringify({ input: 'test input' })
              }],
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 20 },
              rawCall: { rawPrompt: null, rawSettings: {} }
            };
          }
        }),
        tools: {
          mock_tool: mockTool
        }
      });

      const messages = [
        { role: 'user' as const, content: 'Previous message' }
      ];

      const result = await agent.task('Use the tool', {
        messages,
        schema: z.object({
          content: z.string()
        })
      });

      expect(result).toEqual({
        content: 'Executed mock tool with input: test input'
      });
    });
  });
});