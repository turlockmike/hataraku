import { UnifiedTool } from '../types';
import { executeCommandTool } from './execute-command';

export interface AttemptCompletionInput {
    result: string;
    command?: string;
    follow_up_tasks?: string[];
}

export interface AttemptCompletionOutput {
    success: boolean;
    message: string;
    commandOutput?: string;
    error?: string;
    follow_up_tasks?: string[];
}

export const attemptCompletionTool: UnifiedTool<AttemptCompletionInput, AttemptCompletionOutput> = {
    name: 'attempt_completion',
    description: 'After each tool use, the user will respond with the result of that tool use, i.e. if it succeeded or failed, along with any reasons for failure. Once you\'ve received the results of tool uses and can confirm that the task is complete, use this tool to present the result of your work to the user.',
    parameters: {
        result: {
            required: true,
            description: 'The result of the task. Formulate this result in a way that is final and does not require further input from the user.'
        },
        command: {
            required: false,
            description: 'Optional command to execute to demonstrate the result'
        },
        follow_up_tasks: {
            required: false,
            description: 'Optional array of up to 3 suggested follow-up tasks based on the current task and its result'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            result: {
                type: 'string',
                description: 'The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don\'t end your result with questions or offers for further assistance.'
            },
            command: {
                type: 'string',
                description: 'A CLI command to execute to show a live demo of the result to the user. For example, use `open index.html` to display a created html website. This command should be valid for the current operating system.'
            },
            follow_up_tasks: {
                type: 'array',
                items: {
                    type: 'string'
                },
                maxItems: 3,
                description: 'Up to 3 suggested follow-up tasks based on the current task and its result'
            }
        },
        required: ['result'],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the completion attempt was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            commandOutput: {
                type: 'string',
                description: 'Output from the demonstration command if one was provided and executed'
            },
            error: {
                type: 'string',
                description: 'Error message if the operation failed'
            },
            follow_up_tasks: {
                type: 'array',
                items: {
                    type: 'string'
                },
                description: 'Suggested follow-up tasks if any were provided'
            }
        },
        required: ['success', 'message'],
        additionalProperties: false
    },
    // Implementation
    async execute({ result, command, follow_up_tasks }: AttemptCompletionInput, cwd: string): Promise<AttemptCompletionOutput> {
        try {
            // Parse the follow up tasks
            
            // If there's a command to execute, run it using executeCommandTool
            if (command) {
                const commandResult = await executeCommandTool.execute({ command }, cwd);
                
                if (!commandResult.success) {
                    return {
                        success: false,
                        message: `Task completed but demonstration command failed: ${commandResult.error}`,
                        error: commandResult.error,
                        commandOutput: commandResult.output,
                        follow_up_tasks
                    };
                }

                return {
                    success: true,
                    message: result,
                    commandOutput: commandResult.output,
                    follow_up_tasks
                };
            }

            // If no command, just return the result
            return {
                success: true,
                message: result,
                follow_up_tasks
            };
        } catch (error) {
            return {
                success: false,
                message: `Error completing task: ${error.message}`,
                error: error.message,
                follow_up_tasks
            };
        }
    }
};