import { ModelProvider } from '../../api';
import { ModelInfo } from '../../shared/api';
import { Anthropic } from '@anthropic-ai/sdk';
import { ApiStreamChunk } from '../../api/transform/stream';

interface Call {
  systemPrompt: string;
  messages: Anthropic.Messages.MessageParam[];
}

/**
 * A mock implementation of ModelProvider for testing purposes.
 * Allows controlling responses and tracking calls without any test framework dependencies.
 */
export class MockProvider implements ModelProvider {
  private responses: Array<{ type: 'text' | 'error'; content: string }> = [];
  private modelInfo: { id: string; info: ModelInfo };
  private calls: Call[] = [];

  constructor(modelInfo?: { id: string; info: ModelInfo }) {
    this.modelInfo = modelInfo || {
      id: 'mock-model',
      info: {
        contextWindow: 4096,
        supportsPromptCache: false
      }
    };
  }

  /**
   * Queue a successful text response
   */
  mockResponse(text: string) {
    this.responses.push({ type: 'text', content: text });
    return this;
  }

  /**
   * Queue an error response
   */
  mockError(error: string) {
    this.responses.push({ type: 'error', content: error });
    return this;
  }

  /**
   * Clear all queued responses
   */
  clearResponses() {
    this.responses = [];
    return this;
  }

  /**
   * Get the number of times createMessage was called
   */
  getCallCount(): number {
    return this.calls.length;
  }

  /**
   * Get the arguments from a specific createMessage call
   */
  getCall(index: number = 0): Call | undefined {
    return this.calls[index];
  }

  /**
   * Get all createMessage calls
   */
  getCalls(): Call[] {
    return [...this.calls];
  }

  /**
   * Implementation of ModelProvider.createMessage
   */
  createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]) {
    this.calls.push({ systemPrompt, messages });

    const self = this;
    const generator = {
      responses: [...this.responses], // Create a copy for this iterator

      async next(): Promise<IteratorResult<ApiStreamChunk, any>> {
        if (this.responses.length === 0) {
          return {
            value: { type: 'text', text: 'mock response' },
            done: true
          };
        }

        const response = this.responses[0];
        this.responses.shift();

        if (response.type === 'error') {
          throw new Error(response.content);
        }

        return {
          value: { type: 'text', text: response.content },
          done: this.responses.length === 0
        };
      },

      async return(value: any): Promise<IteratorResult<ApiStreamChunk, any>> {
        return { value, done: true };
      },

      async throw(error: any): Promise<IteratorResult<ApiStreamChunk, any>> {
        throw error;
      },

      [Symbol.asyncIterator]() {
        return this;
      },

      [Symbol.asyncDispose]: async () => {}
    };

    return generator;
  }

  /**
   * Implementation of ModelProvider.getModel
   */
  getModel() {
    return { ...this.modelInfo };
  }

  /**
   * Mock the model info returned by getModel
   */
  mockModelInfo(modelInfo: { id: string; info: ModelInfo }) {
    this.modelInfo = modelInfo;
    return this;
  }
}