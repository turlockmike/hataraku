import {  LanguageModelV1, generateText, generateObject, streamText, ToolSet, CoreMessage, Message } from 'ai';
import { z } from 'zod';
import { AsyncIterableStream } from './types';
import { Thread } from './thread/thread';
const DEFAULT_MAX_STEPS = 25;

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
  messages?: Array<CoreMessage>;
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
  async task(task: string, input?: TaskInput & {stream: false | undefined, thread?: Thread}): Promise<string>;
  async task(task: string, input?: TaskInput & { stream: true, thread?: Thread}): Promise<AsyncIterableStream<string>>;
  async task<T>(task: string, input?: TaskInput<T> & { schema: z.ZodType<T>, thread?: Thread}): Promise<T>;
  async task(task: string, input?: TaskInput & { thread?: Thread}): Promise<string>;
  async task<T>(task: string, input?: TaskInput<T> & { stream?: boolean; schema?: z.ZodType<T>, thread?: Thread}): Promise<string | AsyncIterableStream<string> | T> {
    const messages: CoreMessage[] = input?.messages || input?.thread?.getFormattedMessages() || [];
    const maxSteps = this.callSettings.maxSteps || DEFAULT_MAX_STEPS;
    messages.push({
      role: 'user',
      content: task
    });
    if (input?.thread) {
      input.thread.addMessage('user', task);
    }
    if (input?.stream) {
      const {textStream} = streamText({
        model: this.model,
        system: this.getSystemPrompt(),
        messages,
        maxSteps,
        tools: this.tools,
        ...this.callSettings,
        onError: (error) => {
          console.error('Error streaming text', error)
        },
        onFinish: (result) => {
          if (input?.thread) {
            input.thread.addMessage('assistant', result.text);
          }
        }
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
      messages.push({
        role: 'user',
        content: 'Based on the last response, please create a response that matches the schema provided. It must be valid JSON and match the schema exactly.'
      })
      if (input?.thread) {
        input.thread.addMessage('user', 'Based on the last response, please create a response that matches the schema provided. It must be valid JSON and match the schema exactly.')
      }
      const { object } = await generateObject({
        model: this.model,
        mode: 'json', // For some reason it doesn't work without this value.
        system: this.getSystemPrompt(),
        messages: messages,
        maxRetries: 2,
        maxSteps,
        schema: input.schema,
        ...this.callSettings,
      });

      if (input?.thread) {
        input.thread.addMessage('assistant', JSON.stringify(object));
      }
      return object;
    }

    if (input?.schema) {
      const result = await generateObject({
        model: this.model,
        system: this.getSystemPrompt(),
        messages: messages,
        maxRetries: 2,
        maxSteps,
        schema: input.schema,
        ...this.callSettings,
      });
      if (input?.thread) {
        input.thread.addMessage('assistant', JSON.stringify(result.object));
      }
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
    if (input?.thread) {
      input.thread.addMessage('assistant', result.text);
    }
    return result.text;
  }
}

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
} 
