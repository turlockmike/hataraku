import { Anthropic } from '@anthropic-ai/sdk';
import { MessageRole } from '../../lib/types';
import { ThreadStorage } from './storage';
import { randomUUID as uuid} from 'node:crypto';
import { CoreMessage } from 'ai';

export interface ThreadMessage {
  role: MessageRole;
  content: string;
  timestamp: Date;
}

export interface ThreadContext {
  key: string;
  value: any;
  metadata?: Record<string, any>;
  type?: string;
}

export interface FileContext extends ThreadContext {
  type: 'file';
  value: {
    content: Buffer;
    filename: string;
    mimeType: string;
  };
}

export interface ThreadState {
  id: string;
  messages: ThreadMessage[];
  contexts: Map<string, ThreadContext>;
  metadata: Record<string, any>;
  created: Date;
  updated: Date;
}

export interface FileContextOptions {
  key: string;
  content: Buffer;
  filename: string;
  mimeType: string;
  metadata?: Record<string, any>;
}

export class Thread {
  private state: ThreadState;
  private storage?: ThreadStorage;

  constructor(options?: { 
    id?: string;
    storage?: ThreadStorage;
    state?: Partial<ThreadState>;
  }) {
    this.state = {
      id: options?.id || options?.state?.id || uuid(),
      messages: options?.state?.messages || [],
      contexts: options?.state?.contexts || new Map<string, ThreadContext>(),
      metadata: options?.state?.metadata || {},
      created: options?.state?.created || new Date(),
      updated: options?.state?.updated || new Date()
    };
    this.storage = options?.storage;
  }

  get id(): string {
    return this.state.id;
  }

  // Message Management
  addMessage(role: MessageRole, content: string): void {
    const message: ThreadMessage = {
      role,
      content,
      timestamp: new Date()
    };
    this.state.messages.push(message);
    this.state.updated = new Date();
  }

  getMessages(): ThreadMessage[] {
    return this.state.messages;
  }

  /**
   * Get messages formatted for use with the AI SDK
   * @param includeContext Whether to include context messages at the start
   */
  getFormattedMessages(includeContext: boolean = true): CoreMessage[] {
    const messages: CoreMessage[] = [];

    // Add context messages first if requested
    if (includeContext) {
      const contexts = this.getAllContexts();
      for (const [key, value] of contexts) {
        messages.push({
          role: 'user',
          content: `Context ${key}: ${JSON.stringify(value)}`
        });
      }
    }

    // Add thread messages
    messages.push(...this.state.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })));

    return messages;
  }

  clearMessages(): void {
    this.state.messages = [];
    this.state.updated = new Date();
  }

  // Context Management
  addContext(key: string, value: any, metadata?: Record<string, any>): void {
    this.state.contexts.set(key, {
      key,
      value,
      metadata
    });
    this.state.updated = new Date();
  }

  getContext(key: string): ThreadContext | undefined {
    return this.state.contexts.get(key);
  }

  hasContext(key: string): boolean {
    return this.state.contexts.has(key);
  }

  removeContext(key: string): boolean {
    const result = this.state.contexts.delete(key);
    if (result) {
      this.state.updated = new Date();
    }
    return result;
  }

  getAllContexts(): Map<string, ThreadContext> {
    return new Map(this.state.contexts);
  }

  clearContexts(): void {
    this.state.contexts.clear();
    this.state.updated = new Date();
  }

  // File Context Support
  addFileContext(options: FileContextOptions): void {
    const fileContext: FileContext = {
      type: 'file',
      key: options.key,
      value: {
        content: options.content,
        filename: options.filename,
        mimeType: options.mimeType
      },
      metadata: options.metadata
    };
    this.state.contexts.set(options.key, fileContext);
    this.state.updated = new Date();
  }

  // Utilities
  clone(): Thread {
    const clonedThread = new Thread();
    
    // Clone messages
    clonedThread.state.messages = this.state.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));

    // Clone contexts (deep copy)
    this.state.contexts.forEach((context, key) => {
      if (context.type === 'file') {
        const fileContext = context as FileContext;
        clonedThread.addFileContext({
          key: fileContext.key,
          content: Buffer.from(fileContext.value.content),
          filename: fileContext.value.filename,
          mimeType: fileContext.value.mimeType,
          metadata: fileContext.metadata ? { ...fileContext.metadata } : undefined
        });
      } else {
        clonedThread.addContext(
          context.key,
          JSON.parse(JSON.stringify(context.value)),
          context.metadata ? { ...context.metadata } : undefined
        );
      }
    });

    // Clone metadata
    clonedThread.state.metadata = { ...this.state.metadata };
    
    return clonedThread;
  }

  merge(other: Thread): void {
    // Merge messages (maintaining chronological order)
    const allMessages = [...this.state.messages, ...other.getMessages()];
    this.state.messages = allMessages.sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Merge contexts (other thread's contexts take precedence on conflict)
    other.getAllContexts().forEach((context, key) => {
      if (context.type === 'file') {
        const fileContext = context as FileContext;
        this.addFileContext({
          key: fileContext.key,
          content: Buffer.from(fileContext.value.content),
          filename: fileContext.value.filename,
          mimeType: fileContext.value.mimeType,
          metadata: fileContext.metadata
        });
      } else {
        this.addContext(context.key, context.value, context.metadata);
      }
    });

    // Merge metadata
    this.state.metadata = {
      ...this.state.metadata,
      ...other.state.metadata
    };

    this.state.updated = new Date();
  }

  toJSON(): ThreadState {
    return {
      ...this.state,
      contexts: new Map(this.state.contexts)
    };
  }

  async save(): Promise<void> {
    if (!this.storage) {
      throw new Error('No storage mechanism configured');
    }
    await this.storage.save(this.state);
  }
} 