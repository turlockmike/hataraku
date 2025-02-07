import { Agent } from '../agent';
import { AgentConfig, TaskInput, TaskRole } from '../types/config';
import { MockProvider } from '../../../lib/testing/MockProvider';
import { z } from 'zod';
import { UnifiedTool } from '../../../lib/types';

describe('Agent XML Stream Processing', () => {
  let agent: Agent;
  let mockProvider: MockProvider;

  beforeEach(() => {
    mockProvider = new MockProvider();
    const config: AgentConfig = {
      name: 'test-agent',
      model: mockProvider,
      tools: [],
      role: 'assistant'
    };
    agent = new Agent(config);
    agent.initialize();
  });

  describe('First-Class Tool Handling', () => {
    it('should handle attempt_completion streaming', async () => {
      const streamingResponse = `<thinking>Analyzing task...</thinking>
<attempt_completion>Task completed successfully</attempt_completion>`;
      
      mockProvider.mockResponse(streamingResponse);
      
      const result = await agent.task({
        content: 'Test task',
        role: 'assistant' as TaskRole,
        stream: true
      });

      const chunks: string[] = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk);
      }

      expect(chunks.join('')).toBe('Task completed successfully');
      const content = await result.content;
      expect(content).toBe('Task completed successfully');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed XML gracefully', async () => {
      const malformedResponse = `<thinking>Start thinking
<attempt_completion>Incomplete tag`;
      
      mockProvider.mockResponse(malformedResponse);
      
      await expect(agent.task({
        content: 'Test malformed XML',
        role: 'assistant' as TaskRole,
        stream: false
      })).rejects.toThrow('Incomplete XML stream at end');
    });

    it('should handle unexpected closing tags', async () => {
      const invalidResponse = `<thinking>Start thinking</attempt_completion>`;
      
      mockProvider.mockResponse(invalidResponse);
      
      await expect(agent.task({
        content: 'Test invalid tags',
        role: 'assistant' as TaskRole,
        stream: false
      })).rejects.toThrow('Mismatched closing tag');
    });
  });

  describe('Output Schema Compatibility', () => {
    it('should validate JSON output with schema', async () => {
      const response = `<thinking>Processing schema...</thinking>
<attempt_completion>
{"status": "success", "count": 42}
</attempt_completion>`;
      
      mockProvider.mockResponse(response);

      const outputSchema = z.object({
        status: z.string(),
        count: z.number()
      });
      
      const result = await agent.task({
        content: 'Test schema validation',
        role: 'assistant' as TaskRole,
        outputSchema,
        stream: false
      });

      expect(result.content).toEqual({
        status: 'success',
        count: 42
      });
    });
  });

  describe('Tool Execution Integration', () => {
    it('should execute tools with parsed parameters', async () => {
      const response = `<thinking>Executing tool...</thinking>
<read_file>
<path>test.txt</path>
</read_file>`;
      
      mockProvider.mockResponse(response);
      
      const mockReadFile = jest.fn().mockResolvedValue('file contents');
      
      interface ReadFileInput {
        path: string;
      }

      const readFileTool: UnifiedTool<ReadFileInput, string> = {
        name: 'read_file',
        description: 'Read a file',
        execute: mockReadFile,
        parameters: {
          path: { required: true, description: 'File path' }
        },
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path'],
          additionalProperties: false
        },
        outputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string' }
          },
          required: ['content'],
          additionalProperties: false
        }
      };

      agent = new Agent({
        name: 'test-agent',
        model: mockProvider,
        tools: [readFileTool],
        role: 'assistant'
      });
      agent.initialize();

      await agent.task({
        content: 'Read a file',
        role: 'assistant' as TaskRole,
        stream: false
      });

      expect(mockReadFile).toHaveBeenCalledWith({ path: 'test.txt' });
    });
  });

  describe('Streaming vs Non-Streaming', () => {
    it('should accumulate content in non-streaming mode', async () => {
      const response = `<thinking>Part 1</thinking>
<thinking>Part 2</thinking>
<attempt_completion>
Final result
</attempt_completion>`;
      
      mockProvider.mockResponse(response);
      
      const result = await agent.task({
        content: 'Test non-streaming',
        role: 'assistant' as TaskRole,
        stream: false
      });

      expect(result.content).toBe('Final result');
    });

    it('should stream content in streaming mode', async () => {
      const response = `<thinking>Part 1</thinking>
<thinking>Part 2</thinking>
<attempt_completion>
Final result
</attempt_completion>`;
      
      mockProvider.mockResponse(response);
      
      const result = await agent.task({
        content: 'Test streaming',
        role: 'assistant' as TaskRole,
        stream: true
      });

      const chunks: string[] = [];
      for await (const chunk of result.stream) {
        chunks.push(chunk);
      }

      expect(chunks).toContain('Part 1');
      expect(chunks).toContain('Part 2');
      expect(chunks).toContain('Final result');
    });
  });
});