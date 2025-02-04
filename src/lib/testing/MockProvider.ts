import { ModelProvider } from '../../api';
import { ModelInfo } from '../../shared/api';
import { Anthropic } from '@anthropic-ai/sdk';
import { ApiStreamChunk } from '../../api/transform/stream';

interface Call {
  systemPrompt: string;
  messages: Anthropic.Messages.MessageParam[];
}

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

  mockResponse(text: string) {
    this.responses.push({ type: 'text', content: text });
    return this;
  }

  mockError(error: string) {
    this.responses.push({ type: 'error', content: error });
    return this;
  }

  clearResponses() {
    this.responses = [];
    return this;
  }

  getCallCount(): number {
    return this.calls.length;
  }

  getCall(index: number = 0): Call | undefined {
    return this.calls[index];
  }

  getCalls(): Call[] {
    return [...this.calls];
  }

  createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): AsyncGenerator<ApiStreamChunk, any, unknown> {
    this.calls.push({ systemPrompt, messages });

    const self = this;
    return {
      async next() {
        if (self.responses.length === 0) {
          return { value: { type: 'text', text: 'mock response' }, done: true };
        }

        const response = self.responses.shift()!;
        if (response.type === 'error') {
          throw new Error(response.content);
        }

        return { value: { type: 'text', text: response.content }, done: true };
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
  }

  getModel() {
    return { ...this.modelInfo };
  }

  mockModelInfo(modelInfo: { id: string; info: ModelInfo }) {
    this.modelInfo = modelInfo;
    return this;
  }
}