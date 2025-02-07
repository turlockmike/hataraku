import { AgentConfig, TaskInput } from './types/config';
import { agentConfigSchema } from './schemas/config';
import { HatarakuTool } from '../../lib/types';
import { ModelProvider, modelProviderFromConfig } from '../../api';
import { SystemPromptBuilder } from '../prompts/prompt-builder';
import { getHatarakuToolDocs } from '../../lib';
import process from 'node:process';
import { Thread } from '../thread/thread';
import { serializeZodSchema } from '../../utils/schema';
import { ApiStreamChunk } from '../../api/transform/stream';
import { AttemptCompletionTool } from '../../lib/tools/attempt-completion';
import { ThinkingTool } from '../../lib/tools/thinking-tool';
import { processModelStream } from '../../utils/model-stream-processor';
import { z } from 'zod';

/**
* Metadata for a completed task.
*/
export interface TaskMetadata {
  taskId: string;
  input: string;
  thinking?: string[];
  tokensIn?: number;
  tokensOut?: number;
  totalCost?: number;
  toolCalls: { name: string; params: any; result?: any }[];
}

/**
* Composite result of a task execution.
* Contains a streaming async iterator, a promise for the final result and a promise for metadata.
*/
export interface StreamingTaskOutput<T> {
  stream: AsyncGenerator<string, T>;
  content: Promise<T>;
  metadata: Promise<TaskMetadata>;
}

/**
* Non-streaming task output.
* Contains the final result and metadata directly.
*/
export interface NonStreamingTaskOutput<T> {
  content: T;
  metadata: TaskMetadata;
}

/**
* Core Agent class that serves as the primary entry point for the Hataraku SDK.
* Handles configuration, tool management, and task execution.
*/
export class Agent {
  private readonly config: AgentConfig;
  private initialized: boolean = false;
  private tools: Map<string, HatarakuTool> = new Map();
  private modelProvider: ModelProvider;
  private systemPromptBuilder: SystemPromptBuilder;
  private role: string;
  private customInstructions: string;

  // Used to generate unique task ids.
  private taskCounter = 0;
  

  // First-class tools
  private thinkingTool: ThinkingTool;

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

    const thinkingChain: string[] = [];
    // Initialize first-class tools
    this.thinkingTool = new ThinkingTool(thinkingChain);
  }

  /**
  * Initializes the agent, loading tools and setting up necessary resources
  * @throws {Error} If initialization fails
  */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      // Load and initialize tools
      this.loadTools();
      this.initialized = true;
    } catch (error) {
      throw error;
    }

    this.systemPromptBuilder.addSection({
      name: 'tool_list',
      content: getHatarakuToolDocs(Array.from(this.tools.values())),
      order: 45, // After tool-use-guidelines
      enabled: true
    })
  }

  // A helper that creates an async stream with push/end capabilities.
  private createAsyncStream<T>(): AsyncGenerator<T> & { push(item: T): void; end(): void } {
    const buffer: T[] = [];
    let finished = false;
    let resolver: ((result: IteratorResult<T>) => void) | null = null;

    const generator: AsyncGenerator<T> = {
      async next(): Promise<IteratorResult<T>> {
        if (buffer.length > 0) {
          return { value: buffer.shift()!, done: false };
        }
        if (finished) {
          return { value: undefined as any, done: true };
        }
        return new Promise(resolve => {
          resolver = resolve;
        });
      },
      async return(): Promise<IteratorResult<T>> {
        finished = true;
        return { value: undefined as any, done: true };
      },
      async throw(err: any): Promise<IteratorResult<T>> {
        finished = true;
        return { value: undefined as any, done: true };
      },
      [Symbol.asyncIterator]() { return this; },
      async [Symbol.asyncDispose]() {
        finished = true;
      }
    };

    const stream = {
      push(item: T) {
        if (resolver) {
          resolver({ value: item, done: false });
          resolver = null;
        } else {
          buffer.push(item);
        }
      },
      end() {
        finished = true;
        if (resolver) {
          resolver({ value: undefined as any, done: true });
          resolver = null;
        }
      }
    };

    return { ...generator, ...stream } as AsyncGenerator<T> & { push(item: T): void; end(): void };
  }

  // Overload for streaming mode.
public async task<TOutput = string>(
  input: TaskInput<TOutput> & { stream: true }
): Promise<StreamingTaskOutput<TOutput>>;

// Overload for non-streaming mode.
public async task<TOutput = string>(
  input: TaskInput<TOutput> & { stream?: false | undefined }
): Promise<NonStreamingTaskOutput<TOutput>>;

  public async task<TOutput = string>(
    input: TaskInput<TOutput> & { stream?: boolean }
  ): Promise<StreamingTaskOutput<TOutput> | NonStreamingTaskOutput<TOutput>> {
    // Ensure the instance is initialized.
    if (!this.initialized) {
      await this.initialize();
    }

    // Streaming responses do not support output schemas.
    if (input.stream && input.outputSchema) {
      throw new Error("Output schemas are not supported with streaming responses");
    }

    // Generate a unique taskId.
    const taskId = `${Date.now()}-${this.taskCounter++}`;
    const systemPrompt = this.systemPromptBuilder.build();
    const thread = input.thread || new Thread();

    // Build the message content.
    let messageContent = `<task>${input.content}</task>`;
    if (input.outputSchema) {
      const schemaStr = serializeZodSchema(input.outputSchema);
      messageContent += `<output_schema>${schemaStr}</output_schema>`;
    }
    thread.addMessage("user", messageContent);
    const messages = thread.getFormattedMessages(true);


    // Create an async stream that we will use for streaming output.
    const outputStream = this.createAsyncStream<string>();

    // Create the attemptCompletion tool, providing it the stream.
    // (Assuming the tool writes its chunks to the stream.)
    const attemptCompletionTool = new AttemptCompletionTool(outputStream);

    // Get the model's async stream (e.g. from your provider).
    let modelStream: AsyncIterable<ApiStreamChunk>;
    try {
      modelStream = this.modelProvider.createMessage(systemPrompt, messages);
    } catch (err) {
      throw new Error("No attempt_completion tag found in response");
    }

    // Combine all tools (first-class and others) into one array.
    const allTools = [this.thinkingTool, attemptCompletionTool, ...(this.config.tools || [])];

    // Process the model's stream concurrently; this returns a metadata promise.
    const metadataPromise = processModelStream(modelStream, taskId, input, allTools);

    // Once the metadata (and processing) is complete, push final content and finish the stream.
    metadataPromise.then(() => {
      const finalContent = attemptCompletionTool.getContent();
      outputStream.push(finalContent);
      outputStream.end();
    });

    // If streaming mode was requested, return the stream along with a content promise and metadata.
    if (input.stream) {
      // contentPromise iterates over the stream to get the final output.
      const contentPromise = metadataPromise.then(async (metadata) => {
        // Execute all recorded tool calls
        for (const toolCall of metadata.toolCalls) {
          // except for attempt_completion and thinking, which are handled by the model-stream-processor
          if (toolCall.name !== 'attempt_completion' && toolCall.name !== 'thinking') {
            const tool = this.getTool(toolCall.name);
            if (tool.execute) {
              try {
                // Convert JSON Schema to Zod schema for validation
                const schema = tool.inputSchema && tool.inputSchema.properties ? z.object(
                  Object.fromEntries(
                    Object.entries(tool.inputSchema.properties).map(([key, value]) => [
                      key,
                      (value as { type: string }).type === 'number'
                        ? z.preprocess((arg) => {
                            if (typeof arg === 'string') {
                              const num = Number(arg);
                              return isNaN(num) ? arg : num;
                            }
                            return arg;
                          }, z.number())
                        : z.any()
                    ])
                  )
                ) : undefined;
                
                const convertedParams = schema ? schema.parse(toolCall.params) : toolCall.params;
                const res = await tool.execute(convertedParams);
                if (res.isError) {
                  throw new Error('Tool execution failed');
                }
                toolCall.result = res.content;
              } catch (err) {
                toolCall.result = err instanceof Error ? err : new Error(String(err));
              }
            }
          }
        }
        const content = attemptCompletionTool.getContent();
        return input.outputSchema ? JSON.parse(content) : content;
      }) as Promise<TOutput>;

      return {
        stream: outputStream,
        content: contentPromise,
        metadata: metadataPromise,
      };
    }

    // Non-streaming case: wait for metadata and then return the final content.
    const metadata = await metadataPromise;
    
    // Ensure at least one tool call was made
    if (metadata.toolCalls.length === 0) {
      throw new Error("No attempt_completion tag found in response");
    }
    
    // Execute all recorded tool calls
    for (const toolCall of metadata.toolCalls) {
      // except for attempt_completion and thinking, which are handled by the model-stream-processor
      if (toolCall.name !== 'attempt_completion' && toolCall.name !== 'thinking') {
        const tool = this.getTool(toolCall.name);
        if (tool.execute) {
          try {
            // Convert JSON Schema to Zod schema for validation
            const schema = tool.inputSchema && tool.inputSchema.properties ? z.object(
              Object.fromEntries(
                Object.entries(tool.inputSchema.properties).map(([key, value]) => [
                  key,
                  (value as { type: string }).type === 'number'
                    ? z.preprocess((arg) => {
                        if (typeof arg === 'string') {
                          const num = Number(arg);
                          return isNaN(num) ? arg : num;
                        }
                        return arg;
                      }, z.number())
                    : z.any()
                ])
              )
            ) : undefined;
            
            const convertedParams = schema ? schema.parse(toolCall.params) : toolCall.params;
            const res = await tool.execute(convertedParams);
            
            if (res.isError) {
              throw new Error('Tool execution failed');
            }
            toolCall.result = res.content;
          } catch (err) {
            toolCall.result = err instanceof Error ? err : new Error(String(err));
          }
        }
      }
    }

    const finalContent = attemptCompletionTool.getContent();
    const content = input.outputSchema ? JSON.parse(finalContent) : finalContent;

    // Optionally add the assistant's response to the thread.
    if (thread && content) {
      thread.addMessage("assistant", String(content));
    }

    return { content, metadata };
  }

  /**
  * Gets a tool by name
  * @param name The name of the tool to get
  * @returns The tool if found
  * @throws {Error} If the tool is not found
  */
  private getTool(name: string): HatarakuTool {
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
  private loadTools(): void {
    // Add first-class tools
    this.tools.set(this.thinkingTool.name, this.thinkingTool);

    // Add configured tools
    const tools = this.config.tools || [];
    for (const tool of tools) {
      // Store the tool
      this.tools.set(tool.name, tool);

      // Initialize tool if it has an initialize method
      if (tool.initialize) {
        tool.initialize();
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
