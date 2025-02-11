import { Tool, LanguageModelV1, generateText, generateObject, streamText, tool, ToolSet, StreamTextResult, GenerateTextResult, GenerateObjectResult } from 'ai';
import { z } from 'zod';

type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>;

export interface AgentConfig {
  name: string;
  description: string;
  model: LanguageModelV1;
  tools: ToolSet;
}

export interface TaskInput<T = unknown> {
  input: string;
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

  constructor(config: AgentConfig) {
    this.validateConfig(config);
    
    this.name = config.name;
    this.description = config.description;
    this.model = config.model;
    this.tools = config.tools;
  }

  private validateConfig(config: AgentConfig) {
    if (!config.name || config.name.trim() === '') {
      throw new Error('Agent name cannot be empty');
    }
  }

  async executeTask(input: TaskInput & { stream: true }): Promise<AsyncIterableStream<string>>;
  async executeTask<T>(input: TaskInput<T> & { schema: z.ZodType<T> }): Promise<T>;
  async executeTask(input: TaskInput): Promise<string>;
  async executeTask<T>(input: TaskInput<T> & { stream?: boolean; schema?: z.ZodType<T> }): Promise<string | AsyncIterableStream<string> | T> {
    if (input.stream) {
      return this.executeStreamingTask(input);
    }

    // Currently ai-sdk doesn't support generating objects with tools, so we do a two-step process:
    // 1. Generate text
    // 2. Generate object from text
    if (Object.keys(this.tools).length > 0 && input.schema) {
      const result = await generateText({
        model: this.model,
        prompt: input.input,
        tools: this.tools,
      })
  
      if (input.schema) {
        const { object } = await generateObject({
          model: this.model,
          prompt: `Given the following text, extract the following information according to the schema provided:\n\n${result.text}`,
          schema: input.schema,
        });
        return object;
      }
  
      return result.text;
    }

    if (input.schema) {
      const result = await generateObject({
        model: this.model,
        prompt: input.input,
        schema: input.schema,
      });
      return result.object;
    }

    const result = await generateText({
      model: this.model,
      prompt: input.input,
    });
    return result.text;
  }

  private async executeStreamingTask(input: TaskInput) {
    const {textStream} = streamText({
      model: this.model,
      prompt: input.input,
      tools: this.tools,
    });

    return textStream;
  }
}

export function createAgent(config: AgentConfig): Agent {
  return new Agent(config);
} 