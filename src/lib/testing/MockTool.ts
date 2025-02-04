import { UnifiedTool } from '../types';

interface Call {
  params: any;
  cwd: string;
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
export class MockTool implements UnifiedTool {
  private responses: Array<{ type: 'success' | 'error'; value: any }> = [];
  private calls: Call[] = [];
  private initializeCalls: number = 0;

  constructor(
    public name: string = 'mock_tool',
    public description: string = 'A mock tool for testing',
    public parameters: Record<string, { required: boolean; description: string }> = {},
    public inputSchema = {
      type: 'object' as const,
      properties: {} as Record<string, SchemaProperty>,
      required: [] as string[],
      additionalProperties: false
    },
    public outputSchema = {
      type: 'object' as const,
      properties: {} as Record<string, SchemaProperty>,
      required: [] as string[],
      additionalProperties: false
    }
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
  async execute(params: any, cwd: string): Promise<any> {
    this.calls.push({ params, cwd });

    if (this.responses.length === 0) {
      return { success: true }; // Default response
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
  async initialize(): Promise<void> {
    this.initializeCalls++;
  }

  /**
   * Create a basic mock tool with common parameters
   */
  static createBasic(name: string = 'mock_tool'): MockTool {
    return new MockTool(
      name,
      'A basic mock tool for testing',
      {
        input: {
          required: true,
          description: 'Test input parameter'
        }
      },
      {
        type: 'object',
        properties: {
          input: { type: 'string' }
        },
        required: ['input'],
        additionalProperties: false
      },
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