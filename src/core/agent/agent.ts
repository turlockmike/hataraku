import { AgentConfig, TaskInput } from './types/config';
import { agentConfigSchema } from './schemas/config';
import { UnifiedTool } from '../../lib/types';
import { ModelProvider, modelProviderFromConfig } from '../../api';
import { SystemPromptBuilder } from '../prompts/prompt-builder';
import { attemptCompletionTool, getToolDocs } from '../../lib';
import process from 'node:process';
import { Thread } from '../thread/thread';
import { serializeZodSchema } from '../../utils/schema';
import { processResponseStream } from '../../utils/stream-processor';

/**
 * Core Agent class that serves as the primary entry point for the Hataraku SDK.
 * Handles configuration, tool management, and task execution.
 */
export class Agent {
  private readonly config: AgentConfig;
  private initialized: boolean = false;
  private tools: Map<string, UnifiedTool> = new Map();
  private modelProvider: ModelProvider;
  private systemPromptBuilder: SystemPromptBuilder;
  private role: string;
  private customInstructions: string;

  /**
   * Creates a new Agent instance with the provided configuration
   * @param config The agent configuration
   * @throws {Error} If the configuration is invalid
   */
  constructor(config: AgentConfig) {
    // Validate configuration
    const result = agentConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid agent configuration: ${result.error.message}`);
    }
    
    this.config = config;

    // Initialize model provider
    if ('createMessage' in config.model) {
      // Direct ModelProvider instance
      this.modelProvider = config.model;
    } else {
      // ModelConfiguration - create provider
      this.modelProvider = modelProviderFromConfig(config.model);
    }

    this.role = config.role || ''; 
    this.customInstructions = config.customInstructions || '';
    // Initialize system prompt builder with default config
    this.systemPromptBuilder = new SystemPromptBuilder({
      ...config.systemPromptConfig,
      sections: {
        ...config.systemPromptConfig?.sections,
        role: {
          definition: this.role
        },
        customInstructions: {
          instructions: this.customInstructions
        }
      }
    }, process.cwd());
  }

  /**
   * Initializes the agent, loading tools and setting up necessary resources
   * @throws {Error} If initialization fails
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load and initialize tools
      await this.loadTools();
      this.initialized = true;
    } catch (error) {
      throw error;
    }

    this.systemPromptBuilder.addSection({
      name: 'tool_list',
      content: getToolDocs(Array.from(this.tools.values())),
      order: 45, // After tool-use-guidelines
      enabled: true
    })
  }

  /**
   * Executes a task using the configured model and tools
   * @param input The task input configuration
   * @returns The result of the task execution or an AsyncIterable for streaming responses
   * @throws {Error} If the agent is not initialized or task execution fails
   */
  public async task<TOutput = string, TStream extends boolean = false>(
    input: TaskInput<TOutput> & {
      stream?: TStream;
    }
  ): Promise<TStream extends true ? AsyncIterable<TOutput> : TOutput> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (input.stream && input.outputSchema) {
      throw new Error("Output schemas are not supported with streaming responses");
    }

    const systemPrompt = await this.systemPromptBuilder.build();
    const thread = input.thread || new Thread();
    let messageContent = `<task>${input.content}</task>`;
    if (input.outputSchema) {
      const schemaStr = serializeZodSchema(input.outputSchema);
      messageContent += `<output_schema>${schemaStr}</output_schema>`;
    }
    thread.addMessage('user', messageContent);
    const messages = thread.getFormattedMessages(true);

    const stream = this.modelProvider.createMessage(systemPrompt, messages);
    const gen = processResponseStream(stream, thread);

    if (input.stream) {
      return (async function* (): AsyncGenerator<TOutput> {
        for await (const chunk of gen) {
          yield chunk as TOutput;
        }
      })() as TStream extends true ? AsyncIterable<TOutput> : TOutput;
    } else {
      // For non-streaming mode, accumulate chunks into the final result
      let finalAccumulated = '';
      for await (const part of gen) {
        finalAccumulated += part;
      }

      if (input.outputSchema) {
        try {
          const parsed = input.outputSchema.parse(JSON.parse(finalAccumulated));
          return parsed as TStream extends true ? AsyncIterable<TOutput> : TOutput;
        } catch (error: any) {
          throw new Error(`Failed to parse response with schema: ${error.message}`);
        }
      }
      return finalAccumulated as TStream extends true ? AsyncIterable<TOutput> : TOutput;
    }
  }

  /**
   * Gets a tool by name
   * @param name The name of the tool to get
   * @returns The tool if found
   * @throws {Error} If the tool is not found
   */
  private getTool(name: string): UnifiedTool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }
    return tool;
  }

  /**
   * Loads and initializes the configured tools
   * @private
   */
  // TODO: Need to handle duplication of tools and tool name collisions
  private async loadTools(): Promise<void> {
    const tools = this.config.tools || [];
    tools.push(attemptCompletionTool);
    for (const tool of tools) {
      // Store the tool
      this.tools.set(tool.name, tool);
      
      // Initialize tool if it has an initialize method
      if (tool.initialize) {
        await tool.initialize();
      }
    }
  }

  /**
   * Gets the current agent configuration
   * @returns The agent configuration
   */
  public getConfig(): Readonly<AgentConfig> {
    return Object.freeze({ ...this.config });
  }

  /**
   * Gets the list of loaded tool names
   * @returns Array of tool names
   */
  public getLoadedTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Gets the model provider instance
   * @returns The model provider
   */
  public getModelProvider(): ModelProvider {
    return this.modelProvider;
  }
}
