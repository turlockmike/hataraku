import { Anthropic } from '@anthropic-ai/sdk';
import { MessageRole } from '../../lib/types';
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

export interface ThreadStorage {
  save(state: ThreadState): Promise<void>;
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

  /**
   * Returns a truncated version of this thread, containing only the most recent messages such that
   * the estimated token count does not exceed maxTokens. The first message is always preserved.
   * Each individual message can also be truncated if it exceeds maxTokensPerMessage.
   * @param maxTokens The maximum number of tokens for the entire thread
   * @param maxTokensPerMessage Optional maximum number of tokens per individual message (defaults to 50000)
   */
  public truncate(maxTokens: number, maxTokensPerMessage: number = 50000): Thread {
    if (this.state.messages.length === 0) {
      return new Thread({ state: { ...this.state, messages: [] } });
    }

    const MAX_CHARS_PER_MESSAGE = maxTokensPerMessage * 4;
    const MAX_CHARS = maxTokens * 4;

    // Always keep the first message, but truncate it if needed
    const firstMessage = this.state.messages[0];
    let firstMessageContent = firstMessage.content;
    if (firstMessageContent.length > MAX_CHARS) {
      firstMessageContent = firstMessageContent.slice(0, MAX_CHARS);
    } else if (firstMessageContent.length > MAX_CHARS_PER_MESSAGE) {
      firstMessageContent = firstMessageContent.slice(0, MAX_CHARS_PER_MESSAGE);
    }
    let tokenCount = Math.ceil(firstMessageContent.length / 4);

    const truncatedMessages: ThreadMessage[] = [
      { ...firstMessage, content: firstMessageContent }
    ];

    // If we have more messages and space for at least one more
    if (this.state.messages.length > 1 && tokenCount < maxTokens) {
      // Calculate remaining space
      const remainingTokens = maxTokens - tokenCount;
      const remainingChars = remainingTokens * 4;

      // Try to fit the last message
      const lastMessage = this.state.messages[this.state.messages.length - 1];
      let lastMessageContent = lastMessage.content;
      
      // Truncate last message to fit in remaining space if needed
      if (lastMessageContent.length > remainingChars) {
        lastMessageContent = lastMessageContent.slice(0, remainingChars);
      }
      if (lastMessageContent.length > MAX_CHARS_PER_MESSAGE) {
        lastMessageContent = lastMessageContent.slice(0, MAX_CHARS_PER_MESSAGE);
      }

      // Add the last message
      truncatedMessages.push({ ...lastMessage, content: lastMessageContent });
      tokenCount += Math.ceil(lastMessageContent.length / 4);

      // If we still have space, try to add more messages from the end
      const stillRemainingTokens = maxTokens - tokenCount;
      if (stillRemainingTokens > 0) {
        for (let i = this.state.messages.length - 2; i > 0; i--) {
          const message = this.state.messages[i];
          let content = message.content;
          if (content.length > MAX_CHARS_PER_MESSAGE) {
            content = content.slice(0, MAX_CHARS_PER_MESSAGE);
          }
          const messageTokens = Math.ceil(content.length / 4);
          if (tokenCount + messageTokens > maxTokens) {
            break;
          }
          tokenCount += messageTokens;
          truncatedMessages.push({ ...message, content });
        }
      }

      // Reverse the remaining messages to restore chronological order
      // (excluding the first message which is already in position)
      const remainingMessages = truncatedMessages.slice(1).reverse();
      return new Thread({
        state: {
          ...this.state,
          messages: [truncatedMessages[0], ...remainingMessages],
          updated: new Date()
        }
      });
    }

    // If we can't fit any more messages, just return the truncated first message
    return new Thread({
      state: {
        ...this.state,
        messages: truncatedMessages,
        updated: new Date()
      }
    });
  }
} 