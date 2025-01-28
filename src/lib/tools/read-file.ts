import { UnifiedTool } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ReadFileInput {
    path: string;
}

export interface ReadFileOutput {
    success: boolean;
    message: string;
    content?: string;
    error?: string;
}

// Helper function
function resolvePath(relativePath: string, cwd: string): string {
    return path.resolve(cwd, relativePath);
}

export const readFileTool: UnifiedTool<ReadFileInput, ReadFileOutput> = {
    name: 'read_file',
    description: 'Read the contents of a file at the specified path. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files.',
    parameters: {
        path: {
            required: true,
            description: 'The path of the file to read (relative to the current working directory)'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path of the file to read (relative to the current working directory)'
            }
        },
        required: ['path'],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the read operation was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            content: {
                type: 'string',
                description: 'The content of the file if successfully read'
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
    async execute({ path: filePath }: ReadFileInput, cwd: string): Promise<ReadFileOutput> {
        try {
            const absolutePath = resolvePath(filePath, cwd);
            const content = await fs.readFile(absolutePath, 'utf-8');
            
            return {
                success: true,
                message: `File successfully read from ${filePath}`,
                content
            };
        } catch (error) {
            return {
                success: false,
                message: `Error reading file: ${error.message}`,
                error: error.message
            };
        }
    }
};