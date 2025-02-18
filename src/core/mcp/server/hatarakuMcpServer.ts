import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { Task } from '../../task';
import { TaskToolAdapter } from './taskToolAdapter';
import { Agent, createAgent } from '../../agent';
import { LanguageModelV1 } from 'ai';
import {
  createCodeAnalysisTask,
  createBugAnalysisTask,
  createPRReviewTask,
  createRefactoringPlanTask
} from '../../sample-tasks';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
    stream?: ReadableStream;
  }>;
  _meta?: Record<string, unknown>;
  nextCursor?: string;
}


// Should be stored in ~/.hataraku/hataraku-mcp-server-<timestamp>.log
const logDir = path.join(os.homedir(), '.hataraku');
// Create the log directory if it doesn't exist
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, `hataraku-mcp-server-${Date.now()}.log`);
function log(message: string) {
  appendFileSync(logFile, message);
}

export class HatarakuMcpServer {
  private server: Server;
  private tasks: Map<string, Task<any, any>>;
  private adapter: TaskToolAdapter;
  private agent: Agent;

  constructor(model: LanguageModelV1, defaultAgent?: Agent) {
    this.server = new Server(
      {
        name: 'hataraku-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    this.tasks = new Map();
    this.adapter = new TaskToolAdapter();

    this.agent = defaultAgent ?? createAgent({
      name: 'hataraku-task-agent',
      description: 'Agent for executing Hataraku tasks',
      role: 'A software development assistant that helps with code analysis, review, and improvement',
      model
    });
  }

  async start() {
    await this.discoverTasks();
    await this.registerTools();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  private async discoverTasks(): Promise<void> {
    // Create instances of all available tasks
    const taskFactories = [
      createCodeAnalysisTask,
      createBugAnalysisTask,
      createPRReviewTask,
      createRefactoringPlanTask
    ];

    // Initialize tasks with the default agent
    for (const factory of taskFactories) {
      const task = factory(this.agent);
      this.tasks.set(task.name, task);
    }
  }

  private async registerTools(): Promise<void> {
    // Register tasks as MCP tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this.tasks.values()).map(task => ({
        name: task.name,
        description: task.description,
        inputSchema: {
          type: 'object' as const,
          properties: {
            prompt: {
              type: 'string',
              description: 'The input prompt for the task'
            },
            stream: {
              type: 'boolean',
              description: 'Enable streaming output',
              optional: true
            }
          },
          required: ['prompt']
        }
      }));

      return {
        tools,
        _meta: {}
      } satisfies ServerResult;
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const task = this.tasks.get(request.params.name);
      if (!task) {
        throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${request.params.name}`);
      }

      try {
        // Write to a log file
        
        const logEntry = `Calling task: ${task.name}\nRequest params: ${JSON.stringify(request.params)}\n`;
        log(logEntry);

        const args = request.params.arguments || {};
        if (!args.prompt || typeof args.prompt !== 'string') {
          throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid prompt parameter');
        }

        if (args.stream) {
          const stream = await task.execute(args.prompt, { stream: true });
          return {
            content: [{
              type: 'stream',
              text: 'Streaming response',
              stream
            }],
            _meta: {}
          } satisfies ServerResult;
        }

        log(`Executing task: ${task.name} with prompt: ${args.prompt}`);
        const result = await task.execute(args.prompt);
        log(`Task ${task.name} executed with result: ${JSON.stringify(result)}`);
        return {
          content: [{
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
          }],
          _meta: {}
        } satisfies ServerResult;
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InvalidRequest,
          error instanceof Error ? error.message : 'Task execution failed'
        );
      }
    });
  }

  async close() {
    await this.server.close();
  }
}