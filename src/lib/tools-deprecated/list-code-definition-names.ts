import { UnifiedTool } from '../types';
import * as path from 'path';
import { parseSourceCodeForDefinitionsTopLevel } from '../../services/tree-sitter';
import { getListCodeDefinitionNamesDescription } from '../../core-old/prompts/tools';

export interface ListCodeDefinitionsInput {
    path: string;
}

export interface ListCodeDefinitionsOutput {
    success: boolean;
    message: string;
    definitions?: string;
    error?: string;
}

// Helper function
function resolvePath(relativePath: string, cwd: string): string {
    return path.resolve(cwd, relativePath);
}

export const listCodeDefinitionsTool: UnifiedTool<ListCodeDefinitionsInput, ListCodeDefinitionsOutput> = {
    name: 'list_code_definition_names',
    description: getListCodeDefinitionNamesDescription,
    parameters: {
        path: {
            required: true,
            description: 'The path of the directory to list top level source code definitions for'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path of the directory to list top level source code definitions for'
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
                description: 'Whether the operation was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            definitions: {
                type: 'string',
                description: 'The list of code definitions found in the directory'
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
    async execute({ path: dirPath }: ListCodeDefinitionsInput, cwd: string): Promise<ListCodeDefinitionsOutput> {
        try {
            const absolutePath = resolvePath(dirPath, cwd);
            const definitions = await parseSourceCodeForDefinitionsTopLevel(absolutePath);
            
            return {
                success: true,
                message: `Successfully listed code definitions in ${dirPath}`,
                definitions
            };
        } catch (error) {
            return {
                success: false,
                message: `Error listing code definitions: ${error.message}`,
                error: error.message
            };
        }
    }
};