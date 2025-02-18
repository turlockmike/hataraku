import { z } from 'zod';
import { Task } from '../../task';
import { Agent } from '../../agent';
import { TaskToolAdapter } from '../../mcp/server/taskToolAdapter';
import { createAgent } from '../../agent';
import { McpError, ErrorCode } from '../../mcp/types';
import { LanguageModelV1 } from 'ai';

// Mock implementation of LanguageModelV1
const mockModel: jest.Mocked<LanguageModelV1> = {
  provider: 'test',
  specificationVersion: 'v1',
  modelId: 'test-model',
  defaultObjectGenerationMode: 'json',
  doGenerate: jest.fn(),
  doStream: jest.fn()
};

describe('TaskToolAdapter', () => {
  let mockAgent: Agent;
  let mockAgentTask: jest.SpyInstance;
  
  beforeEach(() => {
    // Setup mock agent
    mockAgent = createAgent({
      name: 'test-agent',
      description: 'Test agent',
      role: 'test role',
      model: mockModel
    });

    mockAgentTask = jest.spyOn(mockAgent, 'task');
    mockAgentTask.mockImplementation(async () => 'test response');

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should convert basic task to MCP tool', async () => {
    const task = new Task({
      name: 'test-task',
      description: 'A test task',
      agent: mockAgent,
      task: 'test prompt'
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    expect(tool.name).toBe('test-task');
    expect(tool.description).toBe('A test task');
    expect(tool.parameters).toEqual({
      stream: {
        type: 'boolean',
        description: 'Enable streaming output',
        optional: true
      }
    });
  });

  it('should convert task with input schema to MCP tool', async () => {
    const inputSchema = z.object({
      message: z.string(),
      count: z.number()
    });

    const task = new Task<z.infer<typeof inputSchema>>({
      name: 'schema-task',
      description: 'Task with schema',
      agent: mockAgent,
      task: (input) => `Process ${input.message} ${input.count} times`,
      inputSchema: inputSchema
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    expect(tool.parameters).toMatchObject({
      message: { type: 'string' },
      count: { type: 'number' },
      stream: {
        type: 'boolean',
        description: 'Enable streaming output',
        optional: true
      }
    });
  });

  it('should handle task execution in tool', async () => {
    const expectedResponse = 'test response';
    mockAgentTask.mockResolvedValueOnce(expectedResponse);

    const task = new Task({
      name: 'exec-task',
      description: 'Executable task',
      agent: mockAgent,
      task: 'test execution'
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    const result = await tool.execute({});
    expect(result.raw.content).toHaveLength(1);
    expect(result.raw.content[0].type).toBe('text');
    expect(result.raw.content[0].text).toBe(expectedResponse);
    expect(result.data).toBe(expectedResponse);
  });

  it('should handle streaming task execution in tool', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue('test stream');
        controller.close();
      }
    });

    mockAgentTask.mockResolvedValueOnce(mockStream);

    const task = new Task({
      name: 'stream-task',
      description: 'Streaming task',
      agent: mockAgent,
      task: 'stream task'
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    const result = await tool.execute({ stream: true });
    expect(result.raw.content).toHaveLength(1);
    expect(result.raw.content[0].type).toBe('stream');
    expect(result.raw.content[0].stream).toBe(mockStream);
    expect(result.data).toBe(mockStream);
  });

  it('should handle task execution errors', async () => {
    const errorMessage = 'Task failed';
    mockAgentTask.mockRejectedValue(new Error(errorMessage));

    const task = new Task({
      name: 'error-task',
      description: 'Error task',
      agent: mockAgent,
      task: 'test error'
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    await expect(tool.execute({})).rejects.toThrow(McpError);
    await expect(tool.execute({})).rejects.toThrow(errorMessage);
  });

  it('should preserve task output schema in tool response', async () => {
    const outputSchema = z.object({
      result: z.string(),
      timestamp: z.number()
    });

    const mockOutput = {
      result: 'test',
      timestamp: 123
    };

    mockAgentTask.mockResolvedValueOnce(mockOutput);

    const task = new Task<unknown, z.infer<typeof outputSchema>>({
      name: 'output-schema-task',
      description: 'Task with output schema',
      agent: mockAgent,
      task: 'test output schema',
      outputSchema: outputSchema
    });

    const adapter = new TaskToolAdapter();
    const tool = adapter.convertToMcpTool(task);

    const result = await tool.execute({});
    expect(result.raw.content[0].text).toBe(JSON.stringify(mockOutput));
    expect(result.data).toEqual(mockOutput);
  });
});