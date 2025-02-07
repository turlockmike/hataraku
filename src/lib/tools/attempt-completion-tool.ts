import { UnifiedTool } from '../types';

export interface AttemptCompletionInput {
    result: string;
}

export interface AttemptCompletionOutput {
    success: boolean;
    message: string;
}

export class AttemptCompletionTool implements UnifiedTool<AttemptCompletionInput, AttemptCompletionOutput> {
    name = 'attempt_completion';
    description = 'Attempt to complete the task';
    private content: string[] = [];

    constructor(private contentStream: AsyncGenerator<string, any>) {}

    parameters = {
        result: {
            required: true,
            description: 'The result of the task. Formulate this result in a way that is final and does not require further input from the user.'
        }
    };

    inputSchema = {
        type: 'object' as const,
        properties: {
            result: {
                type: 'string',
                description: 'The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don\'t end your result with questions or offers for further assistance.'
            }
        },
        required: ['result'],
        additionalProperties: false
    };

    outputSchema = {
        type: 'object' as const,
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the completion attempt was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation to display to the user'
            }
        },
        required: ['success', 'message'],
        additionalProperties: false
    };

    streamHandler = {
        stream: async (data: string, resolve?: (value: any) => void) => {
            this.content.push(data);
            (this.contentStream as any).push(data);
            if (resolve) {
                resolve(data);
            }
        },
        finalize: (resolve?: (value: any) => void) => {
            if (resolve) {
                resolve(this.getContent());
            }
            (this.contentStream as any).end();
        }
    };

    async execute({ result }: AttemptCompletionInput, _cwd: string): Promise<AttemptCompletionOutput> {
        try {
            return {
                success: true,
                message: result
            };
        } catch (error) {
            return {
                success: false,
                message: `Error completing task: ${error.message}`
            };
        }
    }

    getContent(): string {
        return this.content.join('');
    }
}