import { Tool, ToolExecutionOptions } from 'ai';
import { accessMcpResourceTool } from '../access-mcp-resource';
import { McpClient } from '../../../lib/mcp/McpClient';

// Mock McpClient
jest.mock('../../../lib/mcp/McpClient');

describe('accessMcpResourceTool', () => {
  let mockMcpClient: jest.Mocked<McpClient>;
  const mockOptions: ToolExecutionOptions = {
    toolCallId: 'test-call-id',
    messages: []
  };

  // Cast tool to ensure execute method is available
  const tool = accessMcpResourceTool as Required<Tool>;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock implementation
    mockMcpClient = {
      initializeServers: jest.fn().mockResolvedValue(undefined),
      readResource: jest.fn(),
    } as unknown as jest.Mocked<McpClient>;

    // @ts-ignore - Mocking constructor
    McpClient.mockImplementation(() => mockMcpClient);
  });

  it('should successfully access a text resource', async () => {
    const mockResponse = {
      contents: [{
        uri: 'test://content',
        text: 'Sample text content',
        type: 'text',
        mimeType: 'text/plain'
      }]
    };

    mockMcpClient.readResource.mockResolvedValue(mockResponse);

    const result = await tool.execute({
      server_name: 'test-server',
      uri: 'test://resource'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{
      type: 'text',
      text: 'Sample text content'
    }]);
    expect(mockMcpClient.initializeServers).toHaveBeenCalled();
    expect(mockMcpClient.readResource).toHaveBeenCalledWith('test-server', 'test://resource');
  });

  it('should handle mixed content types', async () => {
    const mockResponse = {
      contents: [
        {
          uri: 'test://text',
          text: 'Text content',
          type: 'text',
          mimeType: 'text/plain'
        },
        {
          uri: 'test://image',
          blob: 'base64data',
          type: 'image',
          mimeType: 'image/png'
        }
      ]
    };

    mockMcpClient.readResource.mockResolvedValue(mockResponse);

    const result = await tool.execute({
      server_name: 'test-server',
      uri: 'test://resource'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{
      type: 'text',
      text: 'Text content\n[image content]'
    }]);
  });

  it('should handle empty content', async () => {
    const mockResponse = {
      contents: []
    };

    mockMcpClient.readResource.mockResolvedValue(mockResponse);

    const result = await tool.execute({
      server_name: 'test-server',
      uri: 'test://resource'
    }, mockOptions);

    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{
      type: 'text',
      text: 'No content available'
    }]);
  });

  it('should handle errors during resource access', async () => {
    const errorMessage = 'Failed to access resource';
    mockMcpClient.readResource.mockRejectedValue(new Error(errorMessage));

    const result = await tool.execute({
      server_name: 'test-server',
      uri: 'test://resource'
    }, mockOptions);

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{
      type: 'text',
      text: `Error accessing MCP resource: ${errorMessage}`
    }]);
  });
});