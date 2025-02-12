import { Tool, ToolExecutionOptions } from 'ai';
import { useMcpTool } from '../use-mcp-tool';
import { McpClient } from '../../../lib/mcp/McpClient';

// Mock McpClient
jest.mock('../../../lib/mcp/McpClient');

describe('useMcpTool', () => {
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: []
  };

  // Cast tool to ensure execute method is available
  const tool = useMcpTool as Required<Tool>;

  let mockMcpClient: jest.Mocked<McpClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock implementation
    mockMcpClient = {
      initializeServers: jest.fn().mockResolvedValue(undefined),
      callTool: jest.fn(),
    } as unknown as jest.Mocked<McpClient>;

    // @ts-ignore - Mocking constructor
    McpClient.mockImplementation(() => mockMcpClient);
  });

  it('should successfully call MCP tool with arguments', async () => {
    const mockResult = {
      content: [{
        type: 'text' as const,
        text: 'Tool execution successful',
        resource: {
          uri: 'test://uri',
          text: 'Tool execution successful'
        }
      }]
    };

    mockMcpClient.callTool.mockResolvedValue(mockResult);

    const result = await tool.execute({
      server_name: 'test-server',
      tool_name: 'test-tool',
      arguments: JSON.stringify({ param1: 'value1', param2: 'value2' })
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{
      type: 'text',
      text: 'Tool execution successful'
    }]);
    expect(mockMcpClient.initializeServers).toHaveBeenCalled();
    expect(mockMcpClient.callTool).toHaveBeenCalledWith(
      'test-server',
      'test-tool',
      { param1: 'value1', param2: 'value2' }
    );
  });

  it('should handle tool execution without arguments', async () => {
    const mockResult = {
      content: [{
        type: 'text' as const,
        text: 'Tool executed',
        resource: {
          uri: 'test://uri',
          text: 'Tool executed'
        }
      }]
    };

    mockMcpClient.callTool.mockResolvedValue(mockResult);

    const result = await tool.execute({
      server_name: 'test-server',
      tool_name: 'test-tool'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(mockMcpClient.callTool).toHaveBeenCalledWith(
      'test-server',
      'test-tool',
      {}
    );
  });

  it('should handle invalid JSON arguments', async () => {
    const result = await tool.execute({
      server_name: 'test-server',
      tool_name: 'test-tool',
      arguments: 'invalid json'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Error executing MCP tool: /);
    expect(mockMcpClient.callTool).not.toHaveBeenCalled();
  });

  it('should handle tool execution errors', async () => {
    const errorMessage = 'Tool execution failed';
    mockMcpClient.callTool.mockRejectedValue(new Error(errorMessage));

    const result = await tool.execute({
      server_name: 'test-server',
      tool_name: 'test-tool'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(`Error executing MCP tool: ${errorMessage}`);
  });

  it('should handle server initialization errors', async () => {
    const errorMessage = 'Failed to initialize servers';
    mockMcpClient.initializeServers.mockRejectedValue(new Error(errorMessage));

    const result = await tool.execute({
      server_name: 'test-server',
      tool_name: 'test-tool'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(`Error executing MCP tool: ${errorMessage}`);
    expect(mockMcpClient.callTool).not.toHaveBeenCalled();
  });

  it('should handle non-text content types', async () => {
    const mockResult = {
      content: [
        {
          type: 'text' as const,
          text: 'Text content',
          resource: {
            uri: 'test://uri',
            text: 'Text content'
          }
        },
        {
          type: 'image' as const,
          data: 'base64data',
          mimeType: 'image/png',
          resource: {
            uri: 'test://image',
            blob: 'base64data',
            mimeType: 'image/png'
          }
        }
      ]
    };

    mockMcpClient.callTool.mockResolvedValue(mockResult);

    const result = await tool.execute({
      server_name: 'test-server',
      tool_name: 'test-tool'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([
      { type: 'text', text: 'Text content' },
      { type: 'text', text: '[image content]' }
    ]);
  });

  it('should initialize MCP client only once', async () => {
    const mockResult = {
      content: [{
        type: 'text' as const,
        text: 'Success',
        resource: {
          uri: 'test://uri',
          text: 'Success'
        }
      }]
    };

    mockMcpClient.callTool.mockResolvedValue(mockResult);

    // First call
    await tool.execute({
      server_name: 'test-server',
      tool_name: 'test-tool'
    }, mockOptions);

    // Second call
    await tool.execute({
      server_name: 'test-server',
      tool_name: 'another-tool'
    }, mockOptions);

    expect(mockMcpClient.initializeServers).toHaveBeenCalledTimes(1);
    expect(mockMcpClient.callTool).toHaveBeenCalledTimes(2);
  });

  it('should handle non-string error messages', async () => {
    mockMcpClient.callTool.mockRejectedValue({ code: 'TOOL_ERROR' });

    const result = await tool.execute({
      server_name: 'test-server',
      tool_name: 'test-tool'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error executing MCP tool: [object Object]');
  });
});