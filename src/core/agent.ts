import {  LanguageModelV1, generateText, generateObject, streamText, ToolSet, CoreMessage, Message } from 'ai';
import { z } from 'zod';
import { AsyncIterableStream } from './types';
import { Thread } from './thread/thread';
const DEFAULT_MAX_STEPS = 5;
const DEFAULT_MAX_RETRIES = 4;

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
  model: LanguageModelV1 | Promise<LanguageModelV1>;
  tools?: ToolSet;
  callSettings?: CallSettings;
}

export interface TaskInput<T = unknown> {
  thread?: Thread;
  schema?: z.ZodType<T>;
  stream?: boolean;
}

export interface StreamingTaskResult {
  stream: AsyncGenerator<string>;
}

export class Agent {
  public readonly name: string;
  public readonly description: string;
  private readonly modelPromise: Promise<LanguageModelV1>;
  public readonly tools: ToolSet;
  public readonly callSettings: CallSettings;
  public readonly role: string;

  constructor(config: AgentConfig) {
    if (!config.name || config.name.trim() === '') {
      throw new Error('Agent name cannot be empty');
    }
    this.name = config.name;
    this.description = config.description;
    this.modelPromise = Promise.resolve(config.model);
    this.tools = config.tools || {};
    this.callSettings = config.callSettings || {};
    this.role = config.role;
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
  async task(task: string, input?: TaskInput & {stream: false | undefined }): Promise<string>;
  async task(task: string, input?: TaskInput & { stream: true}): Promise<AsyncIterableStream<string>>;
  async task<T>(task: string, input?: TaskInput<T> & { schema: z.ZodType<T>}): Promise<T>;
  async task(task: string, input?: TaskInput ): Promise<string>;
  async task<T>(task: string, input?: TaskInput<T> & { stream?: boolean; schema?: z.ZodType<T>}): Promise<string | AsyncIterableStream<string> | T> {
    const model = await this.modelPromise;
    const thread = input?.thread || new Thread();
    const maxSteps = this.callSettings.maxSteps || DEFAULT_MAX_STEPS;
    const maxRetries = this.callSettings.maxRetries || DEFAULT_MAX_RETRIES;
    thread.addMessage('user', task);
   
    if (input?.stream) {
      const {textStream} = streamText({
        model,
        system: this.getSystemPrompt(),
        messages: thread.getFormattedMessages(),
        maxSteps,
        maxRetries,
        tools: this.tools,
        ...this.callSettings,
        onError: (error) => {
          console.error('Error streaming text', error)
        },
        onFinish: (result) => {
          thread.addMessage('assistant', result.text);
        }
      });

      return textStream;
    }

    if (Object.keys(this.tools).length > 0 && input?.schema) {
      console.log('tools and schema')
      const result = await generateText({
        model,
        system: this.getSystemPrompt(),
        messages: thread.getFormattedMessages(),
        maxSteps,
        maxRetries,
        tools: this.tools,
        ...this.callSettings,
      })
      thread.addMessage('assistant', result.text);
      thread.addMessage('user', 'Based on the last response, please create a response that matches the schema provided. It must be valid JSON and match the schema exactly.')
      const { object } = await generateObject({
        model,
        system: this.getSystemPrompt(),
        messages: thread.getFormattedMessages(),
        maxRetries,
        maxSteps,
        schema: input.schema,
        ...this.callSettings,
      });

      thread.addMessage('assistant', JSON.stringify(object));
      return object;
    }

    if (input?.schema) {
      console.log('gerating object', this.getSystemPrompt(), thread.getFormattedMessages())
      const result = await generateObject({
        model,
        system: this.getSystemPrompt(),
        messages: thread.getFormattedMessages(),
        maxRetries,
        maxSteps,
        schema: input.schema,
        ...this.callSettings,
      });
      thread.addMessage('assistant', JSON.stringify(result.object));
      
      return result.object;
    }

    const result = await generateText({
      model,
      system: this.getSystemPrompt(),
      messages: thread.getFormattedMessages(),
      tools: this.tools,
      maxSteps,
      maxRetries,
      ...this.callSettings,
    });
      
    thread.addMessage('assistant', result.text);
    
    return result.text;
  }
}

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
} 
