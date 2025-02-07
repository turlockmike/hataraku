import { UnifiedTool } from '../types';

export interface ThinkingInput {
    content: string;
}

export interface ThinkingOutput {
    success: boolean;
}

export class ThinkingTool implements UnifiedTool<ThinkingInput, ThinkingOutput> {
    name = 'thinking';
    description = 'Record thinking/reasoning steps';

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

    async execute({ content }: ThinkingInput): Promise<ThinkingOutput> {
        try {
            this.thinkingChain.push(content);
            return {
                success: true
            };
        } catch (error) {
            return {
                success: false
            };
        }
    }
}