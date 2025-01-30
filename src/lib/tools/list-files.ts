import { UnifiedTool } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getListFilesDescription } from '../../core/prompts/tools';

export interface ListFilesInput {
    path: string;
    recursive?: boolean;
}

export interface ListFilesOutput {
    success: boolean;
    message: string;
    files?: string[];
    error?: string;
}

// Helper functions
function resolvePath(relativePath: string, cwd: string): string {
    return path.resolve(cwd, relativePath);
}

async function readDirRecursive(dir: string, recursive: boolean, cwd: string): Promise<string[]> {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    
    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory() && recursive) {
            files.push(...await readDirRecursive(res, recursive, cwd));
        } else {
            files.push(path.relative(cwd, res));
        }
    }
    
    return files;
}

export const listFilesTool: UnifiedTool<ListFilesInput, ListFilesOutput> = {
    name: 'list_files',
    description: getListFilesDescription,
    parameters: {
        path: {
            required: true,
            description: 'The path of the directory to list contents for'
        },
        recursive: {
            required: false,
            description: 'Whether to list files recursively'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path of the directory to list contents for'
            },
            recursive: {
                type: 'boolean',
                description: 'Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.'
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
                description: 'Whether the list operation was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            files: {
                type: 'array',
                items: {
                    type: 'string'
                },
                description: 'Array of file paths found in the directory'
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
    async execute({ path: dirPath, recursive = false }: ListFilesInput, cwd: string): Promise<ListFilesOutput> {
        try {
            const absolutePath = resolvePath(dirPath, cwd);
            const files = await readDirRecursive(absolutePath, recursive, cwd);
            
            return {
                success: true,
                message: `Successfully listed ${recursive ? 'all' : 'top-level'} files in ${dirPath}`,
                files
            };
        } catch (error) {
            return {
                success: false,
                message: `Error listing files: ${error.message}`,
                error: error.message
            };
        }
    }
};