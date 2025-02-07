import { HatarakuTool, HatarakuToolResult } from '../types';

export interface ThinkingInput {
    content: string;
}

export class ThinkingTool implements HatarakuTool<ThinkingInput> {
    name = 'thinking';
    description = 'Record thinking/reasoning steps';
    [key: string]: any;

    constructor(private thinkingChain: string[]) {}

    parameters = {
        content: {
            required: true,
            description: 'The thinking content'
        }
    };

    inputSchema = {
        type: 'object' as const,
        properties: {
            content: {
                type: 'string',
                description: 'The thinking content'
            }
        },
        required: ['content'],
        additionalProperties: false
    };

    outputSchema = {
        type: 'object' as const,
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the thinking step was recorded successfully'
            }
        },
        required: ['success'],
        additionalProperties: false
    };

    streamHandler = {
        stream: (data: string) => {
            this.thinkingChain.push(data);
        }
    };

    async execute({ content }: ThinkingInput): Promise<HatarakuToolResult> {
        try {
            this.thinkingChain.push(content);
            return {
                content: [{
                    type: 'text',
                    text: content
                }]
            };
        } catch (error) {
            return {
                isError: true,
                content: [{
                    type: 'text',
                    text: `Error recording thinking step: ${error}`
                }]
            };
        }
    }
}