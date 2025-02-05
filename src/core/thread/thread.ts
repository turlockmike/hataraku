import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { Anthropic } from '@anthropic-ai/sdk';

export interface ThreadMessage {
  role: 'user' | 'assistant';
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

  constructor(id?: string) {
    this.state = {
      id: id || uuidv4(),
      messages: [],
      contexts: new Map<string, ThreadContext>(),
      metadata: {},
      created: new Date(),
      updated: new Date()
    };
  }

  // Message Management
  addMessage(role: 'user' | 'assistant', content: string): void {
    const message: ThreadMessage = {
      role,
      content,
      timestamp: new Date()
    };
    this.state.messages.push(message);
    this.state.updated = new Date();
  }

  getMessages(): ThreadMessage[] {
    return this.state.messages.map(msg => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  }

  /**
   * Get messages formatted for the Anthropic API
   * @param includeContext Whether to include context messages at the start
   */
  getFormattedMessages(includeContext: boolean = true): Anthropic.Messages.MessageParam[] {
    const messages: Anthropic.Messages.MessageParam[] = [];

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
      messages: this.state.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })),
      contexts: this.state.contexts,
      created: new Date(this.state.created),
      updated: new Date(this.state.updated)
    };
  }

  // Persistence
  async save(path: string): Promise<void> {
    const dirPath = path.split('/').slice(0, -1).join('/');
    if (dirPath) {
      await fs.mkdir(dirPath, { recursive: true });
    }

    const serializedState = JSON.stringify(this.toJSON(), (key, value) => {
      if (value instanceof Map) {
        return Array.from(value.entries());
      }
      if (value instanceof Buffer) {
        return {
          type: 'Buffer',
          data: value.toString('base64')
        };
      }
      if (value instanceof Date) {
        return {
          type: 'Date',
          value: value.toISOString()
        };
      }
      return value;
    });

    const tempPath = `${path}.tmp`;
    await fs.writeFile(tempPath, serializedState, 'utf8');
    await fs.rename(tempPath, path);
  }

  static async load(path: string): Promise<Thread> {
    const data = await fs.readFile(path, 'utf8');
    const parsed = JSON.parse(data, (key, value) => {
      if (Array.isArray(value) && value.every(item => Array.isArray(item) && item.length === 2)) {
        return new Map(value);
      }
      if (value && typeof value === 'object') {
        if (value.type === 'Buffer') {
          return Buffer.from(value.data, 'base64');
        }
        if (value.type === 'Date') {
          return new Date(value.value);
        }
      }
      return value;
    });

    const thread = new Thread(parsed.id);
    thread.state = {
      ...parsed,
      messages: parsed.messages.map((msg: ThreadMessage) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      })),
      created: new Date(parsed.created),
      updated: new Date(parsed.updated)
    };
    return thread;
  }
} 