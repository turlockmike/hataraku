import { getMcpTools } from '../../mcp/toolWrapper';
import { McpClient } from '../../mcp/McpClient';
import { McpToolError } from '../../mcp/errors';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('../../mcp/McpClient');
jest.mock('fs/promises');

interface Tool {
  description: string;
  parameters: Record<string, any>;
  execute: (args: Record<string, any>) => Promise<any>;
}

interface Tools {
  [key: string]: Tool;
}

describe('MCP Tool Wrapper', () => {
  let mockClient: jest.Mocked<McpClient>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mock client
    mockClient = new McpClient() as jest.Mocked<McpClient>;
    mockClient.initializeServers = jest.fn().mockResolvedValue(undefined);
    mockClient.loadConfig = jest.fn().mockResolvedValue(undefined);
    mockClient.loadConfigFromPath = jest.fn().mockResolvedValue(undefined);
    mockClient.getAvailableServers = jest.fn().mockReturnValue(['test-server']);
    mockClient.getServerTools = jest.fn().mockResolvedValue({
      serverName: 'test-server',
      tools: [
        {
          name: 'tool1',
          description: 'Test tool 1',
          inputSchema: { type: 'object', properties: { foo: { type: 'string' } } },
        },
        {
          name: 'tool2',
          description: 'Test tool 2',
          inputSchema: { type: 'object', properties: { bar: { type: 'number' } } },
        },
      ],
    });
    mockClient.callTool = jest.fn().mockResolvedValue({ result: 'success' });

    // Mock constructor to return our mock
    (McpClient as jest.Mock).mockImplementation(() => mockClient);

    // Setup fs mocks
    (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({
      mcpServers: {
        'test-server': {
          command: 'test',
          args: [],
        },
      },
    }));
  });

  describe('Configuration', () => {
    it('uses default config when no options provided', async () => {
      await getMcpTools();
      expect(mockClient.initializeServers).toHaveBeenCalled();
    });

    it('loads config from path when configPath provided', async () => {
      const mockConfig = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: [],
          },
        },
      };
      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig));

      await getMcpTools({ configPath: '/test/path' });
      expect(fs.readFile).toHaveBeenCalledWith('/test/path', 'utf-8');
      expect(mockClient.loadConfigFromPath).toHaveBeenCalledWith('/test/path');
    });

    it('handles file read errors gracefully', async () => {
      (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('File not found'));

      await expect(
        getMcpTools({ configPath: '/test/path' })
      ).rejects.toThrow('Failed to read config file: /test/path');
    });

    it('uses provided config when config object provided', async () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: [],
          },
        },
      };
      await getMcpTools({ config });
      expect(mockClient.loadConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('Tool Loading', () => {
    it('loads all available tools by default', async () => {
      const tools = await getMcpTools();
      expect(Object.keys(tools)).toEqual([
        'test-server_tool1',
        'test-server_tool2',
      ]);
    });

    it('respects disabled tools in config', async () => {
      const tools = await getMcpTools({
        config: {
          mcpServers: {
            'test-server': {
              command: 'test',
              args: [],
              disabledTools: ['tool1'],
            },
          },
        },
      });
      expect(Object.keys(tools)).toEqual(['test-server_tool2']);
    });

    it('creates tools with correct interface', async () => {
      const tools = (await getMcpTools()) as Tools;
      const tool = tools['test-server_tool1'];

      expect(tool).toBeDefined();
      expect(tool).toMatchObject({
        description: 'Test tool 1',
        parameters: {
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        },
      });
      expect(typeof tool.execute).toBe('function');
    });
  });

  describe('Tool Execution', () => {
    let tools: Tools;

    beforeEach(async () => {
      tools = (await getMcpTools()) as Tools;
    });

    it('executes tools through client', async () => {
      const tool = tools['test-server_tool1'];
      expect(tool).toBeDefined();

      const result = await tool.execute({ foo: 'bar' });
      
      expect(mockClient.callTool).toHaveBeenCalledWith(
        'test-server',
        'tool1',
        { foo: 'bar' }
      );
      expect(result).toEqual({ result: 'success' });
    });

    it('calls onToolCall callback when provided', async () => {
      const onToolCall = jest.fn();
      tools = (await getMcpTools({ onToolCall })) as Tools;
      const tool = tools['test-server_tool1'];
      expect(tool).toBeDefined();
      
      await tool.execute({ foo: 'bar' });
      
      expect(onToolCall).toHaveBeenCalledWith(
        'test-server',
        'tool1',
        { foo: 'bar' },
        expect.any(Promise)
      );
    });

    it('handles tool execution errors', async () => {
      const error = new Error('Test error');
      mockClient.callTool.mockRejectedValueOnce(error);
      
      const tool = tools['test-server_tool1'];
      expect(tool).toBeDefined();

      await expect(
        tool.execute({ foo: 'bar' })
      ).rejects.toThrow(McpToolError);
    });
  });
});