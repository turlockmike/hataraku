import { HatarakuTool, HatarakuToolResult } from '../types';

interface Call {
  params: any;
}

type SchemaProperty = {
  type: string;
  description?: string;
  items?: SchemaProperty;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
};

/**
 * A mock implementation of UnifiedTool for testing purposes.
 * Allows controlling responses and tracking calls without any test framework dependencies.
 */
export class MockTool implements HatarakuTool {
  private responses: Array<{ type: 'success' | 'error'; value: any }> = [];
  private calls: Call[] = [];
  private initializeCalls: number = 0;
  private customInitialize?: () => void;
  [key: string]: any;

  constructor(
    public name: string = 'mock_tool',
    public description: string = 'A mock tool for testing',
    public inputSchema = {
      type: 'object' as const,
      properties: {} as Record<string, SchemaProperty>,
      required: [] as string[],
      additionalProperties: false
    },
  ) {}

  /**
   * Queue a successful response
   */
  mockResponse(value: any) {
    this.responses.push({ type: 'success', value });
    return this;
  }

  /**
   * Queue an error response
   */
  mockError(error: any) {
    this.responses.push({ type: 'error', value: error });
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
   * Get the number of times execute was called
   */
  getCallCount(): number {
    return this.calls.length;
  }

  /**
   * Get the arguments from a specific execute call
   */
  getCall(index: number = 0): Call | undefined {
    return this.calls[index];
  }

  /**
   * Get all execute calls
   */
  getCalls(): Call[] {
    return [...this.calls];
  }

  /**
   * Get the number of times initialize was called
   */
  getInitializeCallCount(): number {
    return this.initializeCalls;
  }

  /**
   * Implementation of UnifiedTool.execute
   */
  async execute(params: any): Promise<HatarakuToolResult> {
    this.calls.push({ params });

    if (this.responses.length === 0) {
      return {
        isError: false,
        content: [{
          type: 'text',
          text: 'Mock tool executed'
        }]
      }; // Default response
    }

    const response = this.responses.shift()!;
    if (response.type === 'error') {
      throw response.value;
    }
    return response.value;
  }

  /**
   * Implementation of UnifiedTool.initialize (optional)
   */
  initialize() {
    this.initializeCalls++;
    if (this.customInitialize) {
      this.customInitialize();
    }
  }

  /**
   * Set a custom initialization function
   */
  setInitialize(fn: () => Promise<void>) {
    this.customInitialize = fn;
    return this;
  }

  /**
   * Create a basic mock tool with common parameters
   */
  static createBasic(name: string = 'mock_tool'): MockTool {
    return new MockTool(
      name,
      'A basic mock tool for testing',
      {
        type: 'object',
        properties: {
          result: { type: 'string' }
        },
        required: ['result'],
        additionalProperties: false
      }
    );
  }
}