import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpClient, type McpTool, type McpServerTools } from '../../mcp/McpClient';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');
jest.mock('fs/promises');
jest.mock('path');
jest.mock('os');

describe('McpClient', () => {
  let client: McpClient;
  let mockSdkClient: jest.Mocked<Client>;
  let mockTransport: jest.Mocked<StdioClientTransport>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock os.homedir
    (os.homedir as jest.Mock).mockReturnValue('/mock/home');

    // Mock path.join
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

    // Setup mock SDK client
    mockSdkClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      request: jest.fn().mockResolvedValue({ tools: [] }),
    } as any;

    (Client as jest.Mock).mockImplementation(() => mockSdkClient);

    // Setup mock transport
    mockTransport = {
      stderr: {
        on: jest.fn(),
      },
    } as any;

    (StdioClientTransport as jest.Mock).mockImplementation(() => mockTransport);

    client = new McpClient();
  });

  describe('initialization', () => {
    it('creates default config file if it does not exist', async () => {
      const mockReadFile = fs.readFile as jest.Mock;
      mockReadFile.mockRejectedValueOnce({ code: 'ENOENT' });

      const mockMkdir = fs.mkdir as jest.Mock;
      mockMkdir.mockResolvedValueOnce(undefined);

      const mockWriteFile = fs.writeFile as jest.Mock;
      mockWriteFile.mockResolvedValueOnce(undefined);

      await client.initializeServers();

      expect(mockMkdir).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalledWith(
        '/mock/home/.hataraku/mcp_settings.json',
        JSON.stringify({ mcpServers: {} }, null, 2)
      );
    });

    it('loads existing config file', async () => {
      const mockConfig = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: [],
          },
        },
      };

      const mockReadFile = fs.readFile as jest.Mock;
      mockReadFile.mockResolvedValueOnce(JSON.stringify(mockConfig));

      await client.initializeServers();

      expect(Client).toHaveBeenCalled();
      expect(StdioClientTransport).toHaveBeenCalledWith(expect.objectContaining({
        command: 'test',
        args: [],
      }));
      expect(mockSdkClient.connect).toHaveBeenCalled();
    });
  });

  describe('server tools', () => {
    const mockTools = [
      {
        name: 'tool1',
        description: 'Test tool 1',
        inputSchema: { type: 'object' },
      },
      {
        name: 'tool2',
        description: 'Test tool 2',
        inputSchema: { type: 'object' },
      },
    ];

    beforeEach(async () => {
      // Setup mock server
      const mockConfig = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: [],
          },
        },
      };

      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig));
      mockSdkClient.request.mockResolvedValueOnce({ tools: mockTools });

      await client.initializeServers();
    });

    it('returns available servers', () => {
      const servers = client.getAvailableServers();
      expect(servers).toContain('test-server');
    });

    it('gets server tools', async () => {
      mockSdkClient.request.mockResolvedValueOnce({ tools: mockTools });

      const result = await client.getServerTools('test-server');
      expect(result).toEqual({
        serverName: 'test-server',
        tools: mockTools,
      });
    });

    it('returns empty tools array for unknown server', async () => {
      const result = await client.getServerTools('unknown-server');
      expect(result).toEqual({
        serverName: 'unknown-server',
        tools: [],
      });
    });
  });

  describe('tool execution', () => {
    beforeEach(async () => {
      const mockConfig = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: [],
          },
        },
      };

      (fs.readFile as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockConfig));
      await client.initializeServers();
    });

    it('calls tool successfully', async () => {
      const mockResult = { result: 'success' };
      mockSdkClient.request.mockResolvedValueOnce(mockResult);

      const result = await client.callTool('test-server', 'test-tool', { arg: 'value' });
      expect(result).toEqual(mockResult);
      expect(mockSdkClient.request).toHaveBeenCalledWith(
        {
          method: 'tools/call',
          params: {
            name: 'test-tool',
            arguments: { arg: 'value' },
          },
        },
        expect.any(Object)
      );
    });

    it('throws error for unknown server', async () => {
      await expect(
        client.callTool('unknown-server', 'test-tool', {})
      ).rejects.toThrow('Server "unknown-server" not found');
    });

    it('throws error if servers not initialized', async () => {
      client = new McpClient(); // Reset client to uninitialized state
      await expect(
        client.callTool('test-server', 'test-tool', {})
      ).rejects.toThrow('MCP servers have not been initialized');
    });
  });
});