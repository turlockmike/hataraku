import { getMcpTools } from '../../mcp/toolWrapper';
import { McpClient } from '../../mcp/McpClient';
import { McpConfig } from '../../mcp/config';
import { McpTool } from '../../mcp/types';
import type { Tool } from 'ai';
import * as fs from 'fs/promises';

jest.mock('../../mcp/McpClient');
jest.mock('fs/promises');

describe('MCP Tool Wrapper', () => {
    let mockClient: jest.Mocked<McpClient>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockClient = new McpClient() as jest.Mocked<McpClient>;
        (McpClient as jest.MockedClass<typeof McpClient>).mockImplementation(() => mockClient);

        // Mock fs operations
        (fs.readFile as jest.Mock).mockImplementation(async (filePath) => {
            if (filePath === '/test/config.json') {
                return JSON.stringify({
                    mcpServers: {
                        'test-server': {
                            command: 'test',
                            args: ['arg1'],
                        },
                    },
                });
            }
            throw Object.assign(new Error('File not found'), { code: 'ENOENT' });
        });

        // Default mock implementations
        mockClient.loadConfig.mockResolvedValue();
        mockClient.getAvailableServers.mockReturnValue(['test-server']);
        mockClient.getServerTools.mockResolvedValue({
            serverName: 'test-server',
            tools: [
                {
                    name: 'tool1',
                    description: 'Test Tool 1',
                    inputSchema: { type: 'object' },
                },
                {
                    name: 'tool2',
                    description: 'Test Tool 2',
                    inputSchema: { type: 'object' },
                },
            ],
        });
        mockClient.callTool.mockResolvedValue({
            data: { result: 'success' },
            raw: {
                content: [{ type: 'text', text: '{"result":"success"}' }],
                isError: false,
            },
        });
    });

    describe('Configuration', () => {
        it('loads default config when no options provided', async () => {
            await getMcpTools();
            expect(mockClient.initializeServers).toHaveBeenCalled();
        });

        it('loads config from file when path provided', async () => {
            await getMcpTools({ configPath: '/test/config.json' });
            expect(mockClient.loadConfigFromPath).toHaveBeenCalledWith('/test/config.json');
        });

        it('uses provided config directly', async () => {
            const config: McpConfig = {
                mcpServers: {
                    'test-server': {
                        command: 'test',
                        args: ['arg1'],
                    },
                },
            };
            await getMcpTools({ config });
            expect(mockClient.loadConfig).toHaveBeenCalledWith(config);
        });
    });

    describe('Tool Loading', () => {
        it('loads all available tools by default', async () => {
            const { tools } = await getMcpTools();
            expect(Object.keys(tools)).toEqual(['test-server_tool1', 'test-server_tool2']);
        });

        it('respects disabled tools in config', async () => {
            const { tools } = await getMcpTools({
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
            const { tools } = await getMcpTools();
            const tool = tools['test-server_tool1'] as McpTool;
            expect(tool).toBeDefined();
            expect(tool.description).toBe('Test Tool 1');
            expect(tool.parameters).toEqual({ type: 'object' });
            expect(typeof tool.execute).toBe('function');
        });
    });

    describe('Tool Execution', () => {
        const execOptions = { toolCallId: 'test', messages: [] };

        it('executes tools through client', async () => {
            const { tools } = await getMcpTools();
            const tool = tools['test-server_tool1'] as McpTool;
            const args = { test: 'value' };
            const result = await tool.execute(args, execOptions);

            expect(mockClient.callTool).toHaveBeenCalledWith(
                'test-server',
                'tool1',
                args
            );
            expect(result).toEqual({
                data: { result: 'success' },
                raw: {
                    content: [{ type: 'text', text: '{"result":"success"}' }],
                    isError: false,
                },
            });
        });

        it('calls onToolCall callback when provided', async () => {
            const onToolCall = jest.fn();
            const { tools } = await getMcpTools({ onToolCall });
            const tool = tools['test-server_tool1'] as McpTool;
            const args = { test: 'value' };
            await tool.execute(args, execOptions);

            expect(onToolCall).toHaveBeenCalledWith(
                'test-server',
                'tool1',
                args,
                expect.any(Promise)
            );
        });

        it('handles tool execution errors', async () => {
            mockClient.callTool.mockRejectedValue(new Error('Test error'));
            const { tools } = await getMcpTools();
            const tool = tools['test-server_tool1'] as McpTool;

            await expect(tool.execute({ test: 'value' }, execOptions))
                .rejects
                .toThrow('Test error');
        });
    });

    describe('Cleanup', () => {
        it('disconnects all servers on cleanup', async () => {
            const { disconnect: cleanup } = await getMcpTools();
            await cleanup();
            expect(mockClient.disconnectServer).toHaveBeenCalledWith('test-server');
        });
    });
});