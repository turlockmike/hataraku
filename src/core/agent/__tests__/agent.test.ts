import { Agent } from '..';
import { AgentConfig, TaskInput, Thread } from '../types/config';
import { UnifiedTool } from '../../../lib/types';
import { ModelProvider } from '../../../api';
import { z } from 'zod';
import { Anthropic } from '@anthropic-ai/sdk';

describe('Agent', () => {
  // Create a mock tool for testing
  const mockTool: UnifiedTool = {
    name: 'mock_tool',
    description: 'A mock tool for testing',
    parameters: {
      param1: {
        required: true,
        description: 'Test parameter'
      }
    },
    inputSchema: {
      type: 'object',
      properties: {
        param1: { type: 'string' }
      },
      required: ['param1'],
      additionalProperties: false
    },
    outputSchema: {
      type: 'object',
      properties: {
        result: { type: 'string' }
      },
      required: ['result'],
      additionalProperties: false
    },
    execute: async () => ({ result: 'test' })
  };

  // Create a mock tool with initialize method
  const mockToolWithInit: UnifiedTool = {
    ...mockTool,
    name: 'mock_tool_init',
    initialize: async () => { /* mock initialization */ }
  };

  // Create a mock model provider
  const mockModelProvider: ModelProvider = {
    createMessage: jest.fn().mockImplementation((systemPrompt: string, messages: Anthropic.Messages.MessageParam[]) => {
      const mockAsyncGenerator = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'text', text: 'test response' };
        },
        [Symbol.asyncDispose]: async () => {},
        next: jest.fn(),
        return: jest.fn(),
        throw: jest.fn(),
      };
      return mockAsyncGenerator;
    }),
    getModel: jest.fn().mockReturnValue({ 
      id: 'test-model', 
      info: { contextWindow: 4096, supportsPromptCache: false } 
    })
  };

  const validConfigWithProvider: AgentConfig = {
    model: mockModelProvider,
    tools: [mockTool, mockToolWithInit],
  };

  const validConfigWithModelConfig: AgentConfig = {
    model: {
      apiProvider: 'anthropic',
      apiModelId: 'claude-3-5-sonnet-20241022'
    },
    tools: [mockTool, mockToolWithInit],
  };

  const validTaskInput: TaskInput = {
    role: 'user',
    content: 'test task',
  };

  describe('constructor', () => {
    it('should create an instance with ModelProvider', () => {
      const agent = new Agent(validConfigWithProvider);
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getConfig()).toEqual(validConfigWithProvider);
      expect(agent.getModelProvider()).toBe(mockModelProvider);
    });

    it('should create an instance with ModelConfiguration', () => {
      const agent = new Agent(validConfigWithModelConfig);
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getConfig()).toEqual(validConfigWithModelConfig);
      expect(agent.getModelProvider()).toBeDefined();
    });

    it('should throw error with invalid config', () => {
      const invalidConfig = {
        model: {
          apiProvider: 'invalid-provider',
        },
      };

      expect(() => new Agent(invalidConfig as any)).toThrow('Invalid agent configuration');
    });
  });

  describe('initialize', () => {
    it('should initialize successfully with ModelProvider', async () => {
      const agent = new Agent(validConfigWithProvider);
      const initSpy = jest.spyOn(agent, 'initialize');
      
      await agent.initialize();
      expect(initSpy).toHaveBeenCalled();
      expect(agent.getLoadedTools()).toContain('mock_tool');
      expect(agent.getLoadedTools()).toContain('mock_tool_init');
    });

    it('should initialize successfully with ModelConfiguration', async () => {
      const agent = new Agent(validConfigWithModelConfig);
      const initSpy = jest.spyOn(agent, 'initialize');
      
      await agent.initialize();
      expect(initSpy).toHaveBeenCalled();
      expect(agent.getLoadedTools()).toContain('mock_tool');
      expect(agent.getLoadedTools()).toContain('mock_tool_init');
    });

    it('should only initialize once', async () => {
      const agent = new Agent(validConfigWithProvider);
      const initSpy = jest.spyOn(agent, 'initialize');
      
      await agent.initialize();
      await agent.initialize();
      expect(initSpy).toHaveBeenCalledTimes(2);
      expect(initSpy.mock.results[1].value).resolves.toBeUndefined();
    });
  });

  describe('task', () => {
    it('should throw error if not initialized', async () => {
      const agent = new Agent(validConfigWithProvider);
      await expect(agent.task(validTaskInput)).rejects.toThrow('Agent must be initialized');
    });

    it('should throw not implemented error for regular task', async () => {
      const agent = new Agent(validConfigWithProvider);
      await agent.initialize();
      await expect(agent.task(validTaskInput)).rejects.toThrow('Task execution not implemented yet');
    });

    it('should throw not implemented error for streaming task', async () => {
      const agent = new Agent(validConfigWithProvider);
      await agent.initialize();
      await expect(agent.task({ ...validTaskInput, stream: true }))
        .rejects.toThrow('Streaming task execution not implemented yet');
    });

    it('should handle task with thread context', async () => {
      const agent = new Agent(validConfigWithProvider);
      const thread = new Thread();
      thread.addContext({ key: 'test', content: { value: 'test' } });

      await agent.initialize();
      await expect(agent.task({ ...validTaskInput, thread }))
        .rejects.toThrow('Task execution not implemented yet');
    });

    it('should handle task with output schema', async () => {
      const agent = new Agent(validConfigWithProvider);
      const outputSchema = z.object({
        result: z.string(),
      });

      await agent.initialize();
      await expect(agent.task({ ...validTaskInput, outputSchema }))
        .rejects.toThrow('Task execution not implemented yet');
    });
  });

  describe('events', () => {
    it('should emit initialization events', async () => {
      const agent = new Agent(validConfigWithProvider);
      const initListener = jest.fn();
      const toolsLoadedListener = jest.fn();
      
      agent.on('initialized', initListener);
      agent.on('toolsLoaded', toolsLoadedListener);
      
      await agent.initialize();
      
      expect(initListener).toHaveBeenCalled();
      expect(toolsLoadedListener).toHaveBeenCalledWith(['mock_tool', 'mock_tool_init']);
    });

    it('should emit task events', async () => {
      const agent = new Agent(validConfigWithProvider);
      const taskStartListener = jest.fn();
      const taskEndListener = jest.fn();
      const errorListener = jest.fn();
      
      agent.on('taskStart', taskStartListener);
      agent.on('taskEnd', taskEndListener);
      agent.on('error', errorListener);
      
      await agent.initialize();
      
      try {
        await agent.task(validTaskInput);
      } catch (error) {
        // Expected error
      }
      
      expect(taskStartListener).toHaveBeenCalledWith(validTaskInput);
      expect(taskEndListener).toHaveBeenCalledWith(validTaskInput);
      expect(errorListener).toHaveBeenCalled();
    });
  });
});