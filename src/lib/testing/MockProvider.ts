import { ModelProvider } from '../../api';
import { ModelInfo } from '../../shared/api';
import { Anthropic } from '@anthropic-ai/sdk';
import { ApiStream, ApiStreamChunk } from '../../api/transform/stream';

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

  async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): AsyncGenerator<ApiStreamChunk> {
    this.calls.push({ systemPrompt, messages });

    if (this.responses.length === 0) {
      throw new Error('No mocked responses available');
    }

    const response = this.responses.shift();
    if (!response) {
      throw new Error('No mocked responses available');
    }

    if (response.type === 'error') {
      throw new Error(response.content);
    }


    // Split the response into smaller chunks to simulate streaming
    const chunks = response.content.match(/.{1,4}/g) || [];
    for (const chunk of chunks) {
      yield {
        type: 'text',
        text: chunk,
      };

      // Simulate some delay between chunks
      await new Promise(resolve => setTimeout(resolve, 1));
    }

    // Final usage chunk to update output tokens
    yield {
      type: 'usage',
      inputTokens: 0,
      outputTokens: response.content.length, // Approximate token count
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