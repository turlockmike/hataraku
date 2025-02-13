import { UnifiedTool } from '../types';
import { input } from '@inquirer/prompts';
import { getWaitForUserDescription } from '../../core-old/prompts/tools';

export interface WaitForUserInput {
    prompt: string;
}

export interface WaitForUserOutput {
    success: boolean;
    message: string;
    response?: string;
    error?: string;
}

export const waitForUserTool: UnifiedTool<WaitForUserInput, WaitForUserOutput> = {
    name: 'wait_for_user',
    description: getWaitForUserDescription(),
    parameters: {
        prompt: {
            required: true,
            description: 'The message to display to the user before waiting for input'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            prompt: {
                type: 'string',
                description: 'The message to display to the user before waiting for input'
            }
        },
        required: ['prompt'],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the user input was successfully received'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            response: {
                type: 'string',
                description: 'The user\'s input response'
            },
            error: {
                type: 'string',
                description: 'Error message if the operation failed'
            }
        },
        required: ['success', 'message'],
        additionalProperties: false
    },
    // Implementation
    async execute({ prompt }: WaitForUserInput, cwd: string): Promise<WaitForUserOutput> {
        try {
            // Use inquirer to get user input
            const response = await input({
                message: prompt,
                validate: (value) => {
                    if (!value.trim()) {
                        return 'Input cannot be empty';
                    }
                    return true;
                }
            });

            return {
                success: true,
                message: 'User input received',
                response: response.trim()
            };
        } catch (error) {
            return {
                success: false,
                message: `Error getting user input: ${error.message}`,
                error: error.message
            };
        }
    }
};