import { ModelProvider } from '../../../../api';
import { ModelInfo } from '../../../../shared/api';
import { Anthropic } from '@anthropic-ai/sdk';
import { ApiStreamChunk } from '../../../../api/transform/stream';

export class MockProvider implements ModelProvider {
  private responses: Array<{ type: 'text' | 'error'; content: string }> = [];
  private modelInfo: { id: string; info: ModelInfo };
  private createMessageMock = jest.fn();
  private getModelMock = jest.fn();

  constructor(modelInfo?: { id: string; info: ModelInfo }) {
    this.modelInfo = modelInfo || {
      id: 'mock-model',
      info: {
        contextWindow: 4096,
        supportsPromptCache: false
      }
    };
    this.getModelMock.mockReturnValue(this.modelInfo);
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
  getCreateMessageCallCount(): number {
    return this.createMessageMock.mock.calls.length;
  }

  /**
   * Get the arguments from a specific createMessage call
   */
  getCreateMessageCallArgs(index: number = 0): [string, Anthropic.Messages.MessageParam[]] | undefined {
    return this.createMessageMock.mock.calls[index];
  }

  /**
   * Get all createMessage calls
   */
  getCreateMessageCalls(): Array<[string, Anthropic.Messages.MessageParam[]]> {
    return this.createMessageMock.mock.calls;
  }

  /**
   * Implementation of ModelProvider.createMessage
   */
  createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]) {
    this.createMessageMock(systemPrompt, messages);

    const self = this;
    const generator = {
      async next() {
        if (self.responses.length === 0) {
          // Default response if none queued
          return {
            value: { type: 'text', text: 'mock response' } as ApiStreamChunk,
            done: true
          };
        }

        const response = self.responses.shift()!;
        if (response.type === 'error') {
          throw new Error(response.content);
        }

        return {
          value: { type: 'text', text: response.content } as ApiStreamChunk,
          done: self.responses.length === 0
        };
      },
      async return(value: any) {
        return { value, done: true };
      },
      async throw(error: any) {
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
    return this.getModelMock();
  }

  /**
   * Mock the model info returned by getModel
   */
  mockModelInfo(modelInfo: { id: string; info: ModelInfo }) {
    this.modelInfo = modelInfo;
    this.getModelMock.mockReturnValue(modelInfo);
    return this;
  }
}