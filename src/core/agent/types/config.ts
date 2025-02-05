import { z } from 'zod';
import { UnifiedTool } from '../../../lib/types';
import { ModelConfiguration, ModelProvider as ApiModelProvider } from '../../../shared/api';
import { ModelProvider } from '../../../api';
import { SystemPromptConfig } from '../../prompts/prompt-builder';

/**
 * Model configuration for the agent - can be either a ModelProvider instance or a ModelConfiguration
 */
export type ModelConfig = ModelProvider | ModelConfiguration;

/**
 * Configuration options for response streaming
 */
export interface StreamingConfig {
  /** Whether to enable streaming responses */
  enabled: boolean;
  /** Chunk size for streaming responses in bytes */
  chunkSize?: number;
  /** Maximum time to wait between chunks in milliseconds */
  maxDelay?: number;
}

/**
 * Main configuration interface for the Agent
 */
export interface AgentConfig {
  /** The name of the agent */
  name: string;
  /** Model configuration - can be either a ModelProvider instance or a ModelConfiguration */
  model: ModelConfig;
  /** List of tools to use - must be UnifiedTool instances */
  tools: UnifiedTool[];
  /** Streaming configuration */
  streaming?: StreamingConfig;
  /** Maximum number of retries for failed operations */
  maxRetries?: number;
  /** Timeout for operations in milliseconds */
  timeout?: number;
  /** The role of the agent to be used in the system prompt */
  role?: string;
  /** The custom instructions for the agent to be used in the system prompt */
  customInstructions?: string;
  /** The system prompt configuration. By default, the system prompt will be generated using the role and custom instructions and a minimal set of rules for tool use. */
  systemPromptConfig?: SystemPromptConfig;
}

/**
 * Role type for task messages
 */
export type TaskRole = 'user' | 'assistant' | 'system';

/**
 * File context for tasks
 */
export interface FileContext {
  name: string;
  content: Buffer;
  type: string;
}

/**
 * Task input configuration
 */
export interface TaskInput<TOutput = unknown> {
  /** The role of the message sender */
  role: TaskRole;
  /** The content of the task */
  content: string;
  /** The thread to use for context */
  thread?: Thread;
  /** Whether to stream the response */
  stream?: boolean;
  /** Additional context for the task */
  context?: Record<string, unknown> | FileContext[];
  /** Schema for validating the output */
  outputSchema?: z.ZodSchema<TOutput>;
}

/**
 * Thread for maintaining conversation context
 */
export class Thread {
  private contexts: Map<string, unknown> = new Map();

  public addContext(context: { key: string; content: unknown }): void {
    this.contexts.set(context.key, context.content);
  }

  public addFileContext(file: FileContext): void {
    this.contexts.set(`file:${file.name}`, file);
  }

  public getContext(key: string): unknown {
    return this.contexts.get(key);
  }

  public getAllContexts(): Map<string, unknown> {
    return new Map(this.contexts);
  }
}