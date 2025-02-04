import { Agent } from '..';
import { AgentConfig, TaskInput, Thread } from '../types/config';
import { z } from 'zod';
import { MockProvider, MockTool } from '../../../lib/testing';
import { ModelProvider } from '../../../api';

describe('Agent', () => {
  let mockProvider: MockProvider;
  let mockTool: MockTool;
  let mockToolWithInit: MockTool;
  let validConfigWithProvider: AgentConfig;
  let validConfigWithModelConfig: AgentConfig;

  beforeEach(() => {
    mockProvider = new MockProvider();
    mockTool = MockTool.createBasic('mock_tool');
    mockToolWithInit = MockTool.createBasic('mock_tool_init');
    mockToolWithInit.initialize = async () => {
      mockToolWithInit.initializeCalls++;
      /* mock initialization */
    };

    validConfigWithProvider = {
      model: mockProvider as ModelProvider,
      tools: [mockTool, mockToolWithInit],
    };

    validConfigWithModelConfig = {
      model: {
        apiProvider: 'anthropic',
        apiModelId: 'claude-3-5-sonnet-20241022'
      },
      tools: [mockTool, mockToolWithInit],
    };
  });

  const validTaskInput: TaskInput = {
    role: 'user',
    content: 'test task',
  };

  describe('constructor', () => {
    it('should create an instance with ModelProvider', () => {
      const agent = new Agent(validConfigWithProvider);
      expect(agent).toBeInstanceOf(Agent);
      expect(agent.getConfig()).toEqual(validConfigWithProvider);
      expect(agent.getModelProvider()).toBe(mockProvider);
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
      await agent.initialize();
      expect(agent.getLoadedTools()).toContain('mock_tool');
      expect(agent.getLoadedTools()).toContain('mock_tool_init');
      expect(mockToolWithInit.getInitializeCallCount()).toBe(1);
    });

    it('should initialize successfully with ModelConfiguration', async () => {
      const agent = new Agent(validConfigWithModelConfig);
      await agent.initialize();
      expect(agent.getLoadedTools()).toContain('mock_tool');
      expect(agent.getLoadedTools()).toContain('mock_tool_init');
      expect(mockToolWithInit.getInitializeCallCount()).toBe(1);
    });

    it('should only initialize once', async () => {
      const agent = new Agent(validConfigWithProvider);
      await agent.initialize();
      await agent.initialize();
      expect(agent.getLoadedTools()).toContain('mock_tool');
      expect(mockToolWithInit.getInitializeCallCount()).toBe(1);
    });
  });

  describe('task', () => {
    it('should throw error if not initialized', async () => {
      const agent = new Agent(validConfigWithProvider);
      await expect(agent.task(validTaskInput)).rejects.toThrow('Agent must be initialized');
    });

    it('should execute task successfully', async () => {
      mockProvider.clearResponses().mockResponse('test response');
      mockTool.mockResponse({ result: 'tool success' });

      const agent = new Agent(validConfigWithProvider);
      await agent.initialize();
      
      const result = await agent.task(validTaskInput);
      expect(result).toBe('test response');
      expect(mockProvider.getCallCount()).toBe(1);
      
      const call = mockProvider.getCall(0)!;
      expect(call.systemPrompt).toContain('test task');
      expect(call.messages).toHaveLength(1);
      expect(call.messages[0]).toEqual({
        role: 'user',
        content: 'test task'
      });
    });

    it('should throw not implemented error for streaming task', async () => {
      const agent = new Agent(validConfigWithProvider);
      await agent.initialize();
      await expect(agent.task({ ...validTaskInput, stream: true }))
        .rejects.toThrow('Streaming task execution not implemented yet');
    });

    it('should handle task with thread context', async () => {
      mockProvider.clearResponses().mockResponse('test response');
      const agent = new Agent(validConfigWithProvider);
      const thread = new Thread();
      thread.addContext({ key: 'test', content: { value: 'test' } });

      await agent.initialize();
      const result = await agent.task({ ...validTaskInput, thread });
      expect(result).toBe('test response');
      
      const call = mockProvider.getCall(0)!;
      expect(call.messages).toHaveLength(2); // Context message + task message
      expect(call.messages[0].content).toContain('test'); // Context included
    });

    it('should handle task with output schema', async () => {
      mockProvider.clearResponses().mockResponse('{"result": "test"}');
      const agent = new Agent(validConfigWithProvider);
      const outputSchema = z.object({
        result: z.string(),
      });

      await agent.initialize();
      const result = await agent.task({ ...validTaskInput, outputSchema });
      expect(result).toEqual({ result: 'test' });
    });

    it('should throw error for invalid output schema', async () => {
      mockProvider.clearResponses().mockResponse('invalid json');
      const agent = new Agent(validConfigWithProvider);
      const outputSchema = z.object({
        result: z.string(),
      });

      await agent.initialize();
      await expect(agent.task({ ...validTaskInput, outputSchema }))
        .rejects.toThrow('Failed to parse response with schema');
    });

    it('should handle model errors', async () => {
      mockProvider.clearResponses().mockError('Model error');
      const agent = new Agent(validConfigWithProvider);
      await agent.initialize();
      
      await expect(agent.task(validTaskInput))
        .rejects.toThrow('Model error');
    });

    it('should handle tool errors', async () => {
      mockProvider.clearResponses().mockResponse('test response');
      mockTool.mockError(new Error('Tool error'));

      const agent = new Agent(validConfigWithProvider);
      await agent.initialize();
      
      const result = await agent.task(validTaskInput);
      expect(result).toBe('test response');
      expect(mockTool.getCallCount()).toBe(0); // Tool not called yet since we haven't implemented tool execution
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
      mockProvider.clearResponses().mockResponse('test response');
      const agent = new Agent(validConfigWithProvider);
      const taskStartListener = jest.fn();
      const taskEndListener = jest.fn();
      const errorListener = jest.fn();
      
      agent.on('taskStart', taskStartListener);
      agent.on('taskEnd', taskEndListener);
      agent.on('error', errorListener);
      
      await agent.initialize();
      await agent.task(validTaskInput);
      
      expect(taskStartListener).toHaveBeenCalledWith(validTaskInput);
      expect(taskEndListener).toHaveBeenCalledWith(validTaskInput);
      expect(errorListener).not.toHaveBeenCalled();
    });

    it('should emit error events', async () => {
      mockProvider.clearResponses().mockError('Model error');
      const agent = new Agent(validConfigWithProvider);
      const errorListener = jest.fn();
      
      agent.on('error', errorListener);
      
      await agent.initialize();
      try {
        await agent.task(validTaskInput);
      } catch (error) {
        // Expected error
      }
      
      expect(errorListener).toHaveBeenCalled();
      const error = errorListener.mock.calls[0][0];
      expect(error instanceof Error).toBe(true);
      expect(error.message).toBe('Model error');
    });
  });
});