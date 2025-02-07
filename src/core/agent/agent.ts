import { AgentConfig, TaskInput } from './types/config';
import { agentConfigSchema } from './schemas/config';
import { UnifiedTool } from '../../lib/types';
import { ModelProvider, modelProviderFromConfig } from '../../api';
import { SystemPromptBuilder } from '../prompts/prompt-builder';
import { getToolDocs } from '../../lib';
import process from 'node:process';
import { Thread } from '../thread/thread';
import { serializeZodSchema } from '../../utils/schema';
import { ApiStreamChunk } from '../../api/transform/stream';
import { AttemptCompletionTool } from '../../lib/tools/attempt-completion-tool';
import { ThinkingTool } from '../../lib/tools/thinking-tool';
import { processModelStream, StreamProcessorState } from '../../utils/model-stream-processor';

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
  private tools: Map<string, UnifiedTool> = new Map();
  private modelProvider: ModelProvider;
  private systemPromptBuilder: SystemPromptBuilder;
  private role: string;
  private customInstructions: string;

  // Used to generate unique task ids.
  private taskCounter = 0;

  // Stream processor state
  private streamState: StreamProcessorState = {
    thinkingChain: []
  };

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

    // Initialize first-class tools
    this.thinkingTool = new ThinkingTool(this.streamState.thinkingChain);
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
      content: getToolDocs(Array.from(this.tools.values())),
      order: 45, // After tool-use-guidelines
      enabled: true
    })
  }

  /**
  * Executes a task using the configured model and tools.
  * @param input The task input configuration
  * @returns A streaming output object if streaming is enabled, otherwise a promise that resolves to the final result
  */
  public async task<TOutput = string>(
    input: TaskInput<TOutput> & { stream: true }
  ): Promise<StreamingTaskOutput<TOutput>>;
  public async task<TOutput = string>(
    input: TaskInput<TOutput> & { stream?: false | undefined }
  ): Promise<NonStreamingTaskOutput<TOutput>>;
  public async task<TOutput = string>(
    input: TaskInput<TOutput> & { stream?: boolean }
  ): Promise<StreamingTaskOutput<TOutput> | NonStreamingTaskOutput<TOutput>> {
    if (!this.initialized) {
      this.initialize();
    }

    if (input.stream && input.outputSchema) {
      return Promise.reject(new Error("Output schemas are not supported with streaming responses"));
    }

    // Generate a unique taskId for this task.
    const taskId = `${Date.now()}-${this.taskCounter++}`;

    const systemPrompt = this.systemPromptBuilder.build();
    const thread = input.thread || new Thread();
    let messageContent = `<task>${input.content}</task>`;
    if (input.outputSchema) {
      const schemaStr = serializeZodSchema(input.outputSchema);
      messageContent += `<output_schema>${schemaStr}</output_schema>`;
    }
    thread.addMessage('user', messageContent);
    const messages = thread.getFormattedMessages(true);

    // Reset state
    this.streamState = {
      thinkingChain: []
    };

    // Create a new AttemptCompletionTool instance for this task
    const outputStream: string[] = [];
    const attemptCompletionTool = new AttemptCompletionTool(outputStream);

    // Get the base async iterable stream from the model.
    let modelStream: AsyncIterable<ApiStreamChunk>;
    try {
      modelStream = this.modelProvider.createMessage(systemPrompt, messages);
    } catch (err) {
      throw new Error("No attempt_completion with result tag found in response");
    }

    // Get all tools including first-class tools
    const allTools = [
      this.thinkingTool,
      attemptCompletionTool,
      ...this.config.tools || []
    ];

    // Create a stream that yields from the AttemptCompletionTool's output
    const contentStream = (async function*(this: Agent): AsyncGenerator<string, TOutput> {
      let lastContent = '';
      while (true) {
        const content = attemptCompletionTool.getContent();
        if (content && content !== lastContent) {
          lastContent = content;
          yield content;
        }
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to prevent busy loop
      }
    }).bind(this)();

    // Process the model stream to get metadata
    const metadataPromise = processModelStream(modelStream, taskId, input, allTools, this.streamState);

    // For streaming case, return the full output object
    if (input.stream) {
      const contentPromise = new Promise<TOutput>(async (resolve) => {
        let lastContent = '';
        for await (const chunk of contentStream) {
          lastContent = chunk;
        }
        resolve(input.outputSchema
          ? JSON.parse(lastContent) as TOutput
          : lastContent as unknown as TOutput);
      });

      return {
        stream: contentStream,
        content: contentPromise,
        metadata: metadataPromise
      };
    }

    // For non-streaming case, wait for metadata and get final content
    const metadata = await metadataPromise;
    const content = input.outputSchema
      ? JSON.parse(attemptCompletionTool.getContent()) as TOutput
      : attemptCompletionTool.getContent() as unknown as TOutput;

    // Add response to thread if provided
    if (thread && content) {
      thread.addMessage('assistant', String(content));
    }

    return { content, metadata };
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
