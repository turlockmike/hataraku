import { UnifiedTool } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getWriteToFileDescription } from '../../core/prompts/tools';

export interface WriteToFileInput {
    path: string;
    content: string;
    line_count: number;
}

export interface WriteToFileOutput {
    success: boolean;
    message: string;
    error?: string;
}

// Helper functions
function resolvePath(relativePath: string, cwd: string): string {
    return path.resolve(cwd, relativePath);
}

const fileExists = async (filePath: string): Promise<boolean> => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

export const writeToFileTool: UnifiedTool<WriteToFileInput, WriteToFileOutput> = {
    name: 'write_to_file',
    description: getWriteToFileDescription,
    parameters: {
        path: {
            required: true,
            description: 'The path of the file to write to (relative to the current working directory)'
        },
        content: {
            required: true,
            description: 'The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions.'
        },
        line_count: {
            required: true,
            description: 'The number of lines in the file'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path of the file to write to (relative to the current working directory)'
            },
            content: {
                type: 'string',
                description: 'The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions.'
            },
            line_count: {
                type: 'number',
                description: 'The number of lines in the file',
                minimum: 0
            }
        },
        required: ['path', 'content', 'line_count'],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the write operation was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
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
    async execute({ path: filePath, content, line_count }: WriteToFileInput, cwd: string): Promise<WriteToFileOutput> {
        try {
            const absolutePath = resolvePath(filePath, cwd);
            const exists = await fileExists(absolutePath);
            
            // Create directories if they don't exist
            await fs.mkdir(path.dirname(absolutePath), { recursive: true });
            
            await fs.writeFile(absolutePath, content);
            
            return {
                success: true,
                message: `File successfully ${exists ? 'updated' : 'created'} at ${filePath}`
            };
        } catch (error) {
            return {
                success: false,
                message: `Error writing file: ${error.message}`,
                error: error.message
            };
        }
    }
};