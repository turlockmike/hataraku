import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { HatarakuMcpServer } from '../../../core/mcp/server/hatarakuMcpServer';
import { Task } from '../../../core/task';
import { Agent, createAgent } from '../../../core/agent';
import { LanguageModelV1 } from 'ai';
import { MockLanguageModelV1 } from 'ai/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import z from 'zod';

describe('HatarakuMcpServer', () => {
  let model: LanguageModelV1;
  let mcpServer: HatarakuMcpServer;
  let agent: Agent;
  let client: Client;
  let server: Server;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;

  const sampleAnalysisResult = {
    wordCount: 10,
    sentiment: 'positive',
    topThemes: ['code', 'structure'],
    complexity: { level: 'intermediate', score: 7 },
    summary: 'The code is well-structured and follows good practices.'
  };

  beforeEach(async () => {
    model = new MockLanguageModelV1({
      defaultObjectGenerationMode: 'json',
      doGenerate: async () => ({
        text: JSON.stringify(sampleAnalysisResult),
        reasoning: 'Based on the code structure and patterns used.',
        toolCalls: undefined,
        finishReason: 'stop',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        request: { body: '' },
        rawCall: { rawPrompt: '', rawSettings: {} },
        warnings: [],
        logprobs: undefined
      })
    });

    agent = createAgent({
      name: 'test-agent',
      description: 'Test agent',
      role: 'test role',
      model
    });
    mcpServer = new HatarakuMcpServer(model, agent);

    // Setup transport and client for each test
    [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    server = await mcpServer.start(serverTransport);
    client = new Client({name: 'test-client', version: '1.0.0'});
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await server.close();
  });

  it('should initialize with default configuration', async () => {
    expect(mcpServer).toBeDefined();
    expect(server).toBeDefined();
    expect(client).toBeDefined();
  });

  it('should discover and register all available tasks', async () => {
    const tools = await client.listTools();
    expect(tools).toBeDefined();
    expect(tools.tools).toBeDefined();
    expect(tools.tools.length).toBeGreaterThanOrEqual(4);
    
    const toolNames = tools.tools.map((t: { name: string }) => t.name).sort();
    expect(toolNames).toEqual([
      'Analyze Code',
      'Debug Issue',
      'Plan Refactoring',
      'Review Pull Request'
    ]);
  });

  it('should handle tool execution requests', async () => {
    const response = await client.callTool({
      name: 'Analyze Code',
      arguments: {
        content: 'function test() { return true; }'
      }
    });

    expect(response.content).toBeDefined();
    expect(response.content[0].type).toBe('text');
    expect(response.content[0].text).toContain('analysis of the code');
    expect(response._meta).toBeDefined();
  });

  it('should handle tool not found errors', async () => {
    await expect(client.callTool({
      name: 'NonexistentTool',
      arguments: {
        content: 'test'
      }
    })).rejects.toThrow('Tool not found: NonexistentTool');
  });
});