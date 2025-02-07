import { HatarakuTool, HatarakuToolResult } from '../types';

export interface AttemptCompletionInput {
    result: string;
}

export interface AttemptCompletionOutput {
    success: boolean;
    message: string;
}

export class AttemptCompletionTool implements HatarakuTool<AttemptCompletionInput> {
    name = 'attempt_completion';
    description = 'Attempt to complete the task';
    private content: string[] = [];
    [key: string]: any;

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

    async execute({ result }: AttemptCompletionInput): Promise<HatarakuToolResult> {
        try {
            return {
                content: [{
                    type: 'text',
                    text: result
                }]
            };
        } catch (error) {
            return {
                isError: true,
                content: [{
                    type: 'text',
                    text: `Error completing task: ${error.message}`
                }]
            };
        }
    }

    getContent(): string {
        return this.content.join('');
    }
}