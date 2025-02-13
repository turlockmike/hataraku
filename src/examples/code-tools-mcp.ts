import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { execSync } from 'child_process';

interface ServerResult {
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema: {
      type: 'object';
      properties?: Record<string, unknown>;
    };
  }>;
  content?: Array<{
    type: string;
    text: string;
  }>;
  _meta?: Record<string, unknown>;
}

// Complexity metrics calculation
function calculateComplexity(code: string) {
  const lines = code.split('\n');
  const metrics = {
    lines: lines.length,
    nonEmptyLines: lines.filter(line => line.trim().length > 0).length,
    commentLines: lines.filter(line => line.trim().startsWith('//')).length,
    maxLineLength: Math.max(...lines.map(line => line.length)),
    cyclomaticComplexity: 0,
    nestingDepth: 0
  };

  // Calculate cyclomatic complexity (simplified)
  metrics.cyclomaticComplexity = (code.match(/if|while|for|&&|\|\||case/g) || []).length + 1;

  // Calculate max nesting depth
  let currentDepth = 0;
  metrics.nestingDepth = lines.reduce((maxDepth, line) => {
    currentDepth += (line.match(/{/g) || []).length;
    currentDepth -= (line.match(/}/g) || []).length;
    return Math.max(maxDepth, currentDepth);
  }, 0);

  return metrics;
}

// Git commit message generation
function generateCommitMessage(diff: string, description: string) {
  // Parse diff to understand changes
  const filesChanged = (diff.match(/diff --git a\/(.*?) b\//g) || [])
    .map(line => line.replace('diff --git a/', '').replace(' b/', ''));
  
  const addedLines = (diff.match(/^\+(?![\+\-])/gm) || []).length;
  const removedLines = (diff.match(/^\-(?![\+\-])/gm) || []).length;

  // Determine type of change
  const types = [];
  if (diff.includes('package.json')) {types.push('deps');}
  if (diff.includes('test')) {types.push('test');}
  if (diff.includes('fix') || diff.includes('bug')) {types.push('fix');}
  if (diff.includes('refactor')) {types.push('refactor');}
  if (types.length === 0) {types.push('feat');}

  // Generate message
  const type = types[0];
  const scope = filesChanged.length === 1 ? filesChanged[0].split('/')[0] : '';
  const stats = `[+${addedLines}/-${removedLines}]`;
  
  return {
    subject: `${type}${scope ? `(${scope})` : ''}: ${description}`,
    body: `Files changed: ${filesChanged.join(', ')}\n${stats}`,
    type,
    scope,
    stats
  };
}

class CodeToolsServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'code-tools-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerTools();
  }

  private registerTools(): void {
    // Register tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        {
          name: 'analyze_complexity',
          description: 'Analyze code complexity metrics',
          inputSchema: {
            type: 'object' as const,
            properties: {
              code: {
                type: 'string',
                description: 'Code to analyze'
              },
              threshold: {
                type: 'number',
                description: 'Complexity warning threshold',
                optional: true
              }
            }
          }
        },
        {
          name: 'generate_commit',
          description: 'Generate a conventional commit message',
          inputSchema: {
            type: 'object' as const,
            properties: {
              description: {
                type: 'string',
                description: 'Brief description of changes'
              },
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Files to include in diff',
                optional: true
              }
            }
          }
        }
      ];

      return {
        tools,
        _meta: {}
      } satisfies ServerResult;
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'analyze_complexity': {
            const schema = z.object({
              code: z.string(),
              threshold: z.number().optional().default(10)
            });

            const args = schema.parse(request.params.arguments);
            const metrics = calculateComplexity(args.code);
            const warnings = [];

            if (metrics.cyclomaticComplexity > args.threshold) {
              warnings.push(`High cyclomatic complexity: ${metrics.cyclomaticComplexity}`);
            }
            if (metrics.nestingDepth > 3) {
              warnings.push(`Deep nesting detected: ${metrics.nestingDepth} levels`);
            }
            if (metrics.maxLineLength > 80) {
              warnings.push(`Long lines detected: ${metrics.maxLineLength} characters`);
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    metrics,
                    warnings,
                    recommendations: warnings.length > 0 ? [
                      'Consider breaking down complex conditions',
                      'Extract deeply nested code into functions',
                      'Keep lines under 80 characters for readability'
                    ] : ['Code complexity is within acceptable limits']
                  }, null, 2)
                }
              ],
              _meta: {}
            } satisfies ServerResult;
          }

          case 'generate_commit': {
            const schema = z.object({
              description: z.string(),
              files: z.array(z.string()).optional()
            });

            const args = schema.parse(request.params.arguments);
            
            // Get diff for specified files or all staged changes
            const diffCommand = args.files 
              ? `git diff HEAD ${args.files.join(' ')}`
              : 'git diff --staged';
            
            const diff = execSync(diffCommand, { encoding: 'utf-8' });
            const message = generateCommitMessage(diff, args.description);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    message: `${message.subject}\n\n${message.body}`,
                    type: message.type,
                    scope: message.scope,
                    stats: message.stats
                  }, null, 2)
                }
              ],
              _meta: {}
            } satisfies ServerResult;
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InvalidRequest,
          error instanceof Error ? error.message : 'Tool execution failed'
        );
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('Code Tools MCP server running on stdio');
  }

  async close() {
    await this.server.close();
  }
}

// Start server when run directly
if (require.main === module) {
  const server = new CodeToolsServer();
  server.start().catch(console.error);
}

export { CodeToolsServer };