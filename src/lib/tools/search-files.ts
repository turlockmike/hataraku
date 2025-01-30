import { UnifiedTool } from '../types';
import * as path from 'path';
import { searchFiles } from '../services/search';
import { getSearchFilesDescription } from '../../core/prompts/tools';

export interface SearchFilesInput {
    path: string;
    regex: string;
    file_pattern?: string;
}

export interface SearchFilesOutput {
    success: boolean;
    message: string;
    results?: string;
    error?: string;
}

// Helper function
function resolvePath(relativePath: string, cwd: string): string {
    return path.resolve(cwd, relativePath);
}

export const searchFilesTool: UnifiedTool<SearchFilesInput, SearchFilesOutput> = {
    name: 'search_files',
    description: getSearchFilesDescription,
    parameters: {
        path: {
            required: true,
            description: 'The path of the directory to search in'
        },
        regex: {
            required: true,
            description: 'The regular expression pattern to search for'
        },
        file_pattern: {
            required: false,
            description: 'Glob pattern to filter files (e.g., \'*.ts\' for TypeScript files)'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path of the directory to search in'
            },
            regex: {
                type: 'string',
                description: 'The regular expression pattern to search for. Uses Rust regex syntax.'
            },
            file_pattern: {
                type: 'string',
                description: 'Glob pattern to filter files (e.g., \'*.ts\' for TypeScript files)'
            }
        },
        required: ['path', 'regex'],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the search operation was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            results: {
                type: 'string',
                description: 'The search results with context'
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
    async execute({ path: dirPath, regex, file_pattern }: SearchFilesInput, cwd: string): Promise<SearchFilesOutput> {
        try {
            const absolutePath = resolvePath(dirPath, cwd);
            const results = await searchFiles(cwd, absolutePath, regex, file_pattern);
            
            return {
                success: true,
                message: `Successfully searched files in ${dirPath}`,
                results
            };
        } catch (error) {
            return {
                success: false,
                message: `Error searching files: ${error.message}`,
                error: error.message
            };
        }
    }
};