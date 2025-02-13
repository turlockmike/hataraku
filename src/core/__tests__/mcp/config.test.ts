import { McpConfigSchema, isMcpConfig } from '../../mcp/config';

describe('MCP Config Validation', () => {
  describe('Schema Validation', () => {
    it('validates a minimal valid config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: [],
          },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('validates a complete valid config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: ['arg1', 'arg2'],
            env: {
              KEY: 'value',
            },
            disabledTools: ['tool1', 'tool2'],
          },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('rejects config with missing required fields', () => {
      const config = {
        mcpServers: {
          'test-server': {
            // Missing command
            args: [],
          },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('rejects config with invalid types', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 123, // Should be string
            args: ['test'],
          },
        },
      };
      const result = McpConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('Type Guard', () => {
    it('returns true for valid config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'test',
            args: [],
          },
        },
      };
      expect(isMcpConfig(config)).toBe(true);
    });

    it('returns false for invalid config', () => {
      const config = {
        mcpServers: {
          'test-server': {
            args: [],
          },
        },
      };
      expect(isMcpConfig(config)).toBe(false);
    });

    it('returns false for non-object values', () => {
      expect(isMcpConfig(null)).toBe(false);
      expect(isMcpConfig(undefined)).toBe(false);
      expect(isMcpConfig('string')).toBe(false);
      expect(isMcpConfig(123)).toBe(false);
    });
  });
}); 