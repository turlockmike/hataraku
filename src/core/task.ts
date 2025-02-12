import { z } from 'zod';
import { Agent } from './agent';
import { AsyncIterableStream } from './types';

export interface TaskConfig<TInput = unknown, TOutput = unknown> {
    name: string;
    description: string;
    agent: Agent;
    schema?: z.ZodType<TOutput>;
    task: string | ((input: TInput) => string);
}

export class Task<TInput = unknown, TOutput = unknown> {
    public readonly name: string;
    public readonly description: string;
    private readonly agent: Agent;
    private readonly schema?: z.ZodType<TOutput>;
    private readonly task: string | ((input: TInput) => string);

    constructor(config: TaskConfig<TInput, TOutput>) {
        this.validateConfig(config);
        this.name = config.name;
        this.description = config.description;
        this.agent = config.agent;
        this.schema = config.schema;
        this.task = config.task;
    }

    private validateConfig(config: TaskConfig<TInput, TOutput>) {
        if (!config.name || config.name.trim() === '') {
            throw new Error('Task name cannot be empty');
        }
        if (!config.description || config.description.trim() === '') {
            throw new Error('Task description cannot be empty');
        }
        if (!config.agent) {
            throw new Error('Task must have an agent');
        }
        if (!config.task) {
            throw new Error('Task must have a task definition');
        }
    }

    private getTaskPrompt(input: TInput): string {
        if (typeof this.task === 'string') {
            return this.task;
        }
        return this.task(input);
    }

    /**
     * Execute the task with the given input
     */
    async execute(input: TInput): Promise<string>;
    async execute(input: TInput, options: { stream: true }): Promise<AsyncIterable<string> & ReadableStream<string>>;
    async execute<T>(input: TInput, options: { schema: z.ZodType<T> }): Promise<T>;
    async execute(input: TInput, options?: { stream?: boolean; schema?: z.ZodType<any> }): Promise<string | AsyncIterableStream<string> | any> {
        const prompt = this.getTaskPrompt(input);
        const defaultOptions = { 
            stream: undefined,
            schema: this.schema 
        };
        return this.agent.task(prompt, options || defaultOptions);
    }

    /**
     * Get information about the task
     */
    getInfo() {
        return {
            name: this.name,
            description: this.description
        };
    }
}

/**
 * Create a new task with the given configuration
 * @param config The task configuration
 * @returns A Task instance
 */
export function createTask<TInput = unknown, TOutput = unknown>(
    config: TaskConfig<TInput, TOutput>
): Task<TInput, TOutput> {
    return new Task<TInput, TOutput>(config);
} 