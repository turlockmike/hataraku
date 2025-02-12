import {  LanguageModelV1, generateText, generateObject, streamText, ToolSet, CoreMessage, Message } from 'ai';
import { z } from 'zod';

const DEFAULT_MAX_STEPS = 10;

type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>;

interface CallSettings {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string | undefined>;
  maxSteps?: number;
  toolChoice?: 'auto' | 'none' | 'required';
}

export interface AgentConfig {
  name: string;
  description: string;
  role: string; // System instructions for the agent
  model: LanguageModelV1;
  tools?: ToolSet;
  callSettings?: CallSettings;
}

export interface TaskInput<T = unknown> {
  messages?: Array<CoreMessage> | Array<Omit<Message, "id">>;
  schema?: z.ZodType<T>;
  stream?: boolean;
}

export interface StreamingTaskResult {
  stream: AsyncGenerator<string>;
}



export class Agent {
  public readonly name: string;
  public readonly description: string;
  public readonly model: LanguageModelV1;
  public readonly tools: ToolSet;
  public readonly callSettings: CallSettings;
  public readonly role: string;

  constructor(config: AgentConfig) {
    this.validateConfig(config);
    this.callSettings = config.callSettings || {};
    this.name = config.name;
    this.description = config.description;
    this.model = config.model;
    this.tools = config.tools || {};
    this.role = config.role;
  }

  private validateConfig(config: AgentConfig) {
    if (!config.name || config.name.trim() === '') {
      throw new Error('Agent name cannot be empty');
    }
  }

  private getSystemPrompt() {
    return `
    ROLE:
    ${this.role}

    DESCRIPTION given to the user:
    ${this.description}
    `
  }

  /**
   * Execute a task with the agent.
   * @param task - The task to execute.
   * @param input - The input to the task.
   * @returns The response from the task.
   */
  async task(task: string, input?: TaskInput & {stream: false | undefined}): Promise<string>;
  async task(task: string, input?: TaskInput & { stream: true }): Promise<AsyncIterableStream<string>>;
  async task<T>(task: string, input?: TaskInput<T> & { schema: z.ZodType<T> }): Promise<T>;
  async task(task: string, input?: TaskInput): Promise<string>;
  async task<T>(task: string, input?: TaskInput<T> & { stream?: boolean; schema?: z.ZodType<T> }): Promise<string | AsyncIterableStream<string> | T> {
    const messages = input?.messages || [];
    const maxSteps = this.callSettings.maxSteps || DEFAULT_MAX_STEPS;
    messages.push({
      role: 'user',
      content: task
    });
    if (input?.stream) {
      const {textStream} = streamText({
        model: this.model,
        system: this.getSystemPrompt(),
        messages,
        maxSteps,
        tools: this.tools,
        ...this.callSettings,
      });
  
      return textStream;
    }

    // Currently ai-sdk doesn't support generating objects with tools, so we do a two-step process:
    // 1. Generate text
    // 2. Generate object from text
    if (Object.keys(this.tools).length > 0 && input?.schema) {
      const result = await generateText({
        model: this.model,
        system: this.getSystemPrompt(),
        messages: messages,
        maxSteps,
        tools: this.tools,
        ...this.callSettings,
      })

      const responseMessages: CoreMessage[] = result.response.messages
      responseMessages.push({
        role:'user',
        content: 'Given the following text, extract the following information according to the schema provided:\n\n' + result.text
      })

      console.log('responseMessages', responseMessages)
  
      if (input?.schema) {
        const { object } = await generateObject({
          model: this.model,
          system: this.getSystemPrompt(),
          messages: responseMessages,
          schema: input.schema,
          ...this.callSettings,
        });
        return object;
      }
  
      return result.text;
    }

    if (input?.schema) {
      const result = await generateObject({
        model: this.model,
        system: this.getSystemPrompt(),
        messages: messages,
        maxSteps,
        schema: input.schema,
        ...this.callSettings,
      });
      return result.object;
    }

    const result = await generateText({
      model: this.model,
      system: this.getSystemPrompt(),
      messages: messages,
      tools: this.tools,
      maxSteps,
      ...this.callSettings,
    });
    return result.text;
  }
}

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
} 