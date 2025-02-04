import { EventEmitter } from 'events';
import { AgentConfig, TaskInput } from './types/config';
import { agentConfigSchema } from './schemas/config';
import { UnifiedTool } from '../../lib/types';
import { ModelProvider, modelProviderFromConfig } from '../../api';
import { ModelConfiguration } from '../../shared/api';
import { Anthropic } from '@anthropic-ai/sdk';

/**
 * Core Agent class that serves as the primary entry point for the Hataraku SDK.
 * Handles configuration, tool management, and task execution.
 */
export class Agent extends EventEmitter {
  private readonly config: AgentConfig;
  private initialized: boolean = false;
  private tools: Map<string, UnifiedTool> = new Map();
  private modelProvider: ModelProvider;

  /**
   * Creates a new Agent instance with the provided configuration
   * @param config The agent configuration
   * @throws {Error} If the configuration is invalid
   */
  constructor(config: AgentConfig) {
    super();
    
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
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Executes a task using the configured model and tools
   * @param input The task input configuration
   * @returns The result of the task execution
   * @throws {Error} If the agent is not initialized or task execution fails
   */
  public async task<TOutput = unknown>(input: TaskInput<TOutput>): Promise<TOutput> {
    if (!this.initialized) {
      const error = new Error('Agent must be initialized before executing tasks');
      this.emit('error', error);
      throw error;
    }

    this.emit('taskStart', input);

    try {
      if (input.stream) {
        return await this.executeStreamingTask(input);
      }
      return await this.executeTask(input);
    } catch (error) {
      this.emit('error', error);
      throw error;
    } finally {
      this.emit('taskEnd', input);
    }
  }

  /**
   * Executes a task with streaming response
   * @private
   */
  private async executeStreamingTask<TOutput>(input: TaskInput<TOutput>): Promise<TOutput> {
    const error = new Error('Streaming task execution not implemented yet');
    this.emit('error', error);
    throw error;
  }

  /**
   * Executes a task with regular response
   * @private
   */
  private async executeTask<TOutput>(input: TaskInput<TOutput>): Promise<TOutput> {
    // Create system prompt
    const systemPrompt = `You are an AI assistant. Your task is: ${input.content}`;

    // Create message array
    const messages: Anthropic.Messages.MessageParam[] = [];
    if (input.thread) {
      // Add thread context if available
      const contexts = input.thread.getAllContexts();
      for (const [key, value] of contexts) {
        messages.push({
          role: 'user',
          content: `Context ${key}: ${JSON.stringify(value)}`
        });
      }
    }

    // Add the task input as a user message
    messages.push({
      role: 'user',
      content: input.content
    });

    // Get response from model provider
    const stream = this.modelProvider.createMessage(systemPrompt, messages);
    let response = '';

    try {
      const result = await stream.next();
      if (result.value?.type === 'text' && result.value.text) {
        response = result.value.text;
      }

      // If output schema is provided, validate and parse response
      if (input.outputSchema) {
        try {
          const parsed = input.outputSchema.parse(JSON.parse(response));
          return parsed as TOutput;
        } catch (error) {
          const parseError = new Error(`Failed to parse response with schema: ${error.message}`);
          this.emit('error', parseError);
          throw parseError;
        }
      }

      return response as TOutput;
    } catch (error) {
      this.emit('error', error);
      throw error;
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
  private async loadTools(): Promise<void> {
    for (const tool of this.config.tools) {
      // Store the tool
      this.tools.set(tool.name, tool);
      
      // Initialize tool if it has an initialize method
      if (tool.initialize) {
        await tool.initialize();
      }
    }

    this.emit('toolsLoaded', Array.from(this.tools.keys()));
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