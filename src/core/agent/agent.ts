import { EventEmitter } from 'events';
import { AgentConfig, TaskInput } from './types/config';
import { agentConfigSchema } from './schemas/config';
import { UnifiedTool } from '../../lib/types';
import { ModelProvider, modelProviderFromConfig } from '../../api';
import { Anthropic } from '@anthropic-ai/sdk';
import { SystemPromptBuilder } from '../prompts/prompt-builder';

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

    if (input.stream) {
      return this.executeStreamingTask(input) as any;
    }

    return this.executeTask(input) as any;
  }

  /**
   * Executes a task with regular response
   * @private
   */
  private async executeTask<TOutput>(input: TaskInput<TOutput>): Promise<TOutput> {
    // Create system prompt
    const systemPrompt = this.systemPromptBuilder.build();

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

    try {
      // Get response from model provider
      const stream = this.modelProvider.createMessage(systemPrompt, messages);
      let fullResponse = '';

      // Get first chunk
      const { value: firstChunk, done: firstDone } = await stream.next();
      if (firstChunk?.type === 'text' && firstChunk.text) {
        fullResponse = firstChunk.text;
      }

      // If not done, accumulate remaining chunks
      if (!firstDone) {
        for await (const chunk of stream) {
          if (chunk.type === 'text' && chunk.text) {
            fullResponse += chunk.text;
          }
        }
      }

      // If output schema is provided, validate and parse response
      if (input.outputSchema) {
        try {
          const parsed = input.outputSchema.parse(JSON.parse(fullResponse));
          return parsed as TOutput;
        } catch (error) {
          const parseError = new Error(`Failed to parse response with schema: ${error.message}`);
          throw parseError;
        }
      }

      return fullResponse as TOutput;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Executes a task with streaming response
   * @private
   */
  private async *executeStreamingTask<TOutput>(
    input: TaskInput<TOutput>
  ): AsyncGenerator<TOutput> {
    // Create system prompt
    const systemPrompt = this.systemPromptBuilder.build();

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

    try {
      // Get response stream from model provider
      const stream = this.modelProvider.createMessage(systemPrompt, messages);
      let currentChunk = '';

      // Process stream chunks
      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.text) {
          if (input.outputSchema) {
            currentChunk += chunk.text;
            try {
              // Try to parse as JSON and validate
              const parsed = input.outputSchema.parse(JSON.parse(currentChunk));
              yield parsed as TOutput;
              currentChunk = ''; // Reset after successful parse
            } catch {
              // If parsing fails, continue accumulating chunks
              continue;
            }
          } else {
            // If no schema, yield the text directly
            yield chunk.text as TOutput;
          }
        }
      }

      // Handle any remaining chunk
      if (currentChunk && input.outputSchema) {
        try {
          const parsed = input.outputSchema.parse(JSON.parse(currentChunk));
          yield parsed as TOutput;
        } catch (error) {
          const parseError = new Error(`Failed to parse response with schema: ${error.message}`);
          throw parseError;
        }
      }
    } catch (error) {
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