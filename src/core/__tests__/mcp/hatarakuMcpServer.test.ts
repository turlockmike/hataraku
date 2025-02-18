import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { HatarakuMcpServer } from '../../../core/mcp/server/hatarakuMcpServer';
import { Task } from '../../../core/task';
import { Agent } from '../../../core/agent';
import { LanguageModelV1 } from 'ai';
import { TaskToolAdapter } from '../../../core/mcp/server/taskToolAdapter';

// Mock MCP SDK classes
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('../../../core/mcp/server/taskToolAdapter');

// Mock task factory functions
jest.mock('../../../core/task', () => {
  let mockAgent: Agent | null = null;
  let shouldFail = false;
  
  const createTask = (name: string, description: string) => new Task({
    name,
    description,
    agent: mockAgent!,
    task: (input: unknown) => {
      if (shouldFail && name === 'Analyze Code') {
        throw new Error('Task execution failed');
      }
      return 'Task completed';
    }
  });
  
  return {
    __setMockAgent: (agent: Agent) => {
      mockAgent = agent;
    },
    __setShouldFail: (fail: boolean) => {
      shouldFail = fail;
    },
    createCodeAnalysisTask: jest.fn(() => createTask('Analyze Code', 'Analyze code for complexity and issues')),
    createBugAnalysisTask: jest.fn(() => createTask('Debug Issue', 'Analyze bug reports and provide solutions')),
    createPRReviewTask: jest.fn(() => createTask('Review Pull Request', 'Review code changes and provide feedback')),
    createRefactoringPlanTask: jest.fn(() => createTask('Plan Refactoring', 'Create a structured refactoring plan'))
  };
});

describe('HatarakuMcpServer', () => {
  let mockServer: jest.Mocked<Server>;
  let requestHandlers: Map<string, Function>;
  let mockTasks: any;
  let mockToolAdapter: jest.Mocked<TaskToolAdapter>;
  let mockExecute: jest.Mock;
  let mockModel: LanguageModelV1;
  
  beforeEach(() => {
    // Setup mock server
    requestHandlers = new Map();
    mockServer = {
      setRequestHandler: jest.fn((schema, handler) => {
        requestHandlers.set(schema.method, handler);
      }),
      connect: jest.fn(),
      close: jest.fn()
    } as any;

    (Server as jest.Mock).mockImplementation(() => mockServer);

    // Setup mock execute function
    mockExecute = jest.fn().mockResolvedValue({
      data: 'Task completed',
      raw: {
        content: [
          {
            type: 'text',
            text: 'Task completed'
          }
        ],
        isError: false
      }
    });

    // Setup mock tool adapter
    mockToolAdapter = {
      convertToMcpTool: jest.fn((task) => ({
        name: task.name,
        description: task.description,
        parameters: {},
        execute: async (args: any) => {
          const result = await mockExecute(args);
          if (result instanceof Error) {
            throw result;
          }
          return result;
        }
      }))
    } as any;

    (TaskToolAdapter as jest.Mock).mockImplementation(() => mockToolAdapter);

    // Setup mock model
    mockModel = {
      provider: 'test',
      modelId: 'test-model',
      specificationVersion: 'v1',
      defaultObjectGenerationMode: 'json',
      async doGenerate() {
        return {
          text: 'test',
          reasoning: undefined,
          toolCalls: undefined,
          finishReason: 'stop',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          request: { body: '' },
          rawCall: { rawPrompt: '', rawSettings: {} },
          warnings: [],
          logprobs: undefined
        };
      },
      async doStream() {
        return {
          stream: new ReadableStream(),
          rawCall: { rawPrompt: '', rawSettings: {} }
        };
      }
    };

    // Reset all mocks
    jest.clearAllMocks();

    // Get mock tasks module
    mockTasks = jest.requireMock('../../../core/task');
    mockTasks.__setShouldFail(false);
  });

  it('should initialize with default configuration', () => {
    const server = new HatarakuMcpServer(mockModel);
    expect(server).toBeDefined();
    expect(Server).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'hataraku-mcp-server',
        version: '1.0.0'
      }),
      expect.anything()
    );
  });

  it('should discover and register all available tasks', async () => {
    const server = new HatarakuMcpServer(mockModel);
    await server.start();

    // Get the listTools handler
    const listToolsHandler = requestHandlers.get('tools/list');
    expect(listToolsHandler).toBeDefined();

    // Test tool listing
    const result = await listToolsHandler!({
      method: 'tools/list',
      params: {}
    });

    expect(result.tools).toHaveLength(4);
    const toolNames = result.tools.map((t: { name: string }) => t.name).sort();
    expect(toolNames).toEqual([
      'Analyze Code',
      'Debug Issue',
      'Plan Refactoring',
      'Review Pull Request'
    ]);
    expect(result._meta).toBeDefined();
  });

  it('should handle tool execution requests', async () => {
    const server = new HatarakuMcpServer(mockModel);
    await server.start();

    // Get the callTool handler
    const callToolHandler = requestHandlers.get('tools/call');
    expect(callToolHandler).toBeDefined();

    // Test tool execution
    const result = await callToolHandler!({
      method: 'tools/call',
      params: {
        name: 'Analyze Code',
        arguments: {
          prompt: 'function test() { return true; }'
        }
      }
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result._meta).toBeDefined();
  });

  it('should handle tool not found errors', async () => {
    const server = new HatarakuMcpServer(mockModel);
    await server.start();

    // Get the callTool handler
    const callToolHandler = requestHandlers.get('tools/call');
    expect(callToolHandler).toBeDefined();

    // Test error handling
    await expect(callToolHandler!({
      method: 'tools/call',
      params: {
        name: 'NonexistentTool',
        arguments: {
          prompt: 'test'
        }
      }
    })).rejects.toThrow(McpError);

    await expect(callToolHandler!({
      method: 'tools/call',
      params: {
        name: 'NonexistentTool',
        arguments: {
          prompt: 'test'
        }
      }
    })).rejects.toThrow('Tool not found: NonexistentTool');
  });

  it.skip('should handle tool execution errors', async () => {
    // Create server and start it
    const server = new HatarakuMcpServer(mockModel);
    await server.start();

    // Get the callTool handler
    const callToolHandler = requestHandlers.get('tools/call');
    expect(callToolHandler).toBeDefined();

    // Mock execute function to throw error
    mockExecute.mockReturnValueOnce(new Error('Task execution failed'));

    // Test error handling
    await expect(callToolHandler!({
      method: 'tools/call',
      params: {
        name: 'Analyze Code',
        arguments: {
          prompt: 'test'
        }
      }
    })).rejects.toThrow(McpError);

    await expect(callToolHandler!({
      method: 'tools/call',
      params: {
        name: 'Analyze Code',
        arguments: {
          prompt: 'test'
        }
      }
    })).rejects.toThrow('Task execution failed');
  });

  it('should handle streaming task execution', async () => {
    // Create server and start it
    const server = new HatarakuMcpServer(mockModel);
    await server.start();

    // Get the callTool handler
    const callToolHandler = requestHandlers.get('tools/call');
    expect(callToolHandler).toBeDefined();

    // Mock execute function for streaming
    mockExecute.mockResolvedValueOnce({
      data: new ReadableStream({
        start(controller) {
          controller.enqueue('test stream');
          controller.close();
        }
      }),
      raw: {
        content: [
          {
            type: 'stream',
            text: 'Streaming response',
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue('test stream');
                controller.close();
              }
            })
          }
        ],
        isError: false
      }
    });

    // Test streaming execution
    const result = await callToolHandler!({
      method: 'tools/call',
      params: {
        name: 'Analyze Code',
        arguments: {
          prompt: 'test',
          stream: true
        }
      }
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('stream');
    expect(result.content[0].stream).toBeInstanceOf(ReadableStream);
    expect(result._meta).toBeDefined();
  });
});