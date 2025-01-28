import { UnifiedTool } from '../types';
import { spawn } from 'child_process';

export interface ExecuteCommandInput {
    command: string;
}

export interface ExecuteCommandOutput {
    success: boolean;
    message: string;
    output?: string;
    error?: string;
}

export const executeCommandTool: UnifiedTool<ExecuteCommandInput, ExecuteCommandOutput> = {
    name: 'execute_command',
    description: 'Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user\'s task. You must tailor your command to the user\'s system and provide a clear explanation of what the command does.',
    parameters: {
        command: {
            required: true,
            description: 'The CLI command to execute. This should be valid for the current operating system.'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.'
            }
        },
        required: ['command'],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the command execution was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            output: {
                type: 'string',
                description: 'The command output if successful'
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
    async execute({ command }: ExecuteCommandInput, cwd: string): Promise<ExecuteCommandOutput> {
        return new Promise((resolve) => {
            const process = spawn(command, [], {
                shell: true,
                cwd
            });

            let output = '';
            let error = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                error += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    resolve({
                        success: false,
                        message: `Command failed with code ${code}`,
                        error: error || 'Command execution failed',
                        output
                    });
                } else {
                    resolve({
                        success: true,
                        message: 'Command executed successfully',
                        output: output || 'Command completed with no output'
                    });
                }
            });
        });
    }
};