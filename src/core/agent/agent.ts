import { EventEmitter } from 'events';
import { AgentConfig, TaskInput } from './types/config';
import { agentConfigSchema } from './schemas/config';
import { UnifiedTool } from '../../lib/types';
import { ModelProvider, modelProviderFromConfig } from '../../api';
import { Anthropic } from '@anthropic-ai/sdk';
import { SystemPromptBuilder } from '../prompts/prompt-builder';
import * as z from 'zod';
import { attemptCompletionTool, getToolDocs } from '../../lib';
import chalk from 'chalk';

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

    if (input.stream) {
      if (input.outputSchema) {
        throw new Error("Output schemas are not supported with streaming responses");
      }
      return this.executeStreamingTask(input) as any;
    }

    return this.executeTask(input) as any;
  }

  /**
   * Executes a task with regular response
   * @private
   */
  private async executeTask<TOutput>(input: TaskInput<TOutput>): Promise<TOutput> {
    const systemPrompt = await this.systemPromptBuilder.build();

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

    // Format task content with schema if provided
    let messageContent = `<task>${input.content}</task>`;
    if (input.outputSchema) {
      const schemaStr = this.serializeZodSchema(input.outputSchema);
      messageContent += `<output_schema>${schemaStr}</output_schema>`;
    }

    // Add the task input as a user message
    messages.push({
      role: 'user',
      content: messageContent
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

      // Extract content from attempt_completion tag
      const completionMatch = fullResponse.match(/<attempt_completion>[\s\S]*?<result>([\s\S]*?)<\/result>[\s\S]*?<\/attempt_completion>/);
      if (!completionMatch) {
        throw new Error('No attempt_completion with result tag found in response');
      }
      const completionContent = completionMatch[1].trim();

      // If output schema is provided, validate and parse response
      if (input.outputSchema) {
        try {
          const parsed = input.outputSchema.parse(JSON.parse(completionContent));
          return parsed as TOutput;
        } catch (error) {
          const parseError = new Error(`Failed to parse response with schema: ${error.message}`);
          throw parseError;
        }
      }

      return completionContent as TOutput;
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
    const systemPrompt = await this.systemPromptBuilder.build();
    const messages: Anthropic.Messages.MessageParam[] = [];
    if (input.thread) {
      for (const [key, value] of input.thread.getAllContexts()) {
        messages.push({
          role: 'user',
          content: `Context ${key}: ${JSON.stringify(value)}`
        });
      }
    }
    let messageContent = `<task>${input.content}</task>`;
    if (input.outputSchema) {
      const schemaStr = this.serializeZodSchema(input.outputSchema);
      messageContent += `<output_schema>${schemaStr}</output_schema>`;
    }
    messages.push({
      role: 'user',
      content: messageContent
    });
  
    // Set up our state for streaming
    let buffer = '';
    let inResultMode = false;
    let tagBuffer = ''; // For collecting potential tag characters
  
    try {
      const stream = this.modelProvider.createMessage(systemPrompt, messages);
  
      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.text) {
          // Process the chunk character by character
          for (const char of chunk.text) {
            // If we haven't entered result mode yet, look for opening tags
            if (!inResultMode) {
              buffer += char;
              const attemptIndex = buffer.indexOf('<attempt_completion>');
              if (attemptIndex !== -1) {
                const resultIndex = buffer.indexOf('<result>', attemptIndex);
                if (resultIndex !== -1) {
                  // Found the result tag, discard everything before it
                  buffer = buffer.slice(resultIndex + '<result>'.length);
                  inResultMode = true;
                }
              }
              continue;
            }
            
            // In result mode - handle each character carefully
            if (char === '<') {
              // First yield any content we've accumulated before the tag
              if (buffer.length > 0) {
                yield buffer as TOutput;
                buffer = '';
              }
              // Start collecting a potential tag
              tagBuffer = char;
            } else if (tagBuffer.length > 0) {
              // We're in the middle of collecting a potential tag
              tagBuffer += char;
              
              // Check if we've found a closing tag
              if (tagBuffer === '</result>') {
                // Found the closing tag, stop processing
                return;
              }
              
              // If we can confirm this isn't a closing tag, yield it
              if (tagBuffer.length >= 2 && !tagBuffer.startsWith('</')) {
                buffer += tagBuffer;
                tagBuffer = '';
              }
              // Otherwise keep collecting the tag
            } else {
              // Normal character outside of any tag
              buffer += char;
              
              // Yield the buffer periodically
              if (buffer.length >= 4) {
                yield buffer as TOutput;
                buffer = '';
              }
            }
          }
        }
      }
      
      // Yield any remaining content if we haven't hit a closing tag
      if (buffer.length > 0 && tagBuffer.length === 0) {
        yield buffer as TOutput;
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

  private serializeZodSchema(schema: z.ZodType<any>): string {
    if (schema instanceof z.ZodObject) {
      const shape = schema._def.shape();
      const shapeEntries = Object.entries(shape).map(([key, value]) => {
        if (value instanceof z.ZodString) {
          return `"${key}": z.string()`;
        }
        if (value instanceof z.ZodNumber) {
          return `"${key}": z.number()`;
        }
        // Add more types as needed
        return `"${key}": z.unknown()`;
      });
      return `{${shapeEntries.join(', ')}}`;
    }
    // Handle other schema types as needed
    return 'z.unknown()';
  }
}