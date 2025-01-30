import { UnifiedTool } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';
import { platform } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getShowImageDescription } from '../../core/prompts/tools';

const execAsync = promisify(exec);

export interface ShowImageInput {
    path: string;
}

export interface ShowImageOutput {
    success: boolean;
    message: string;
    error?: string;
}

// Helper function
function resolvePath(relativePath: string, cwd: string): string {
    return path.resolve(cwd, relativePath);
}

// Platform-specific open command
function getOpenCommand(imagePath: string): string {
    switch (platform()) {
        case 'win32':
            return `start "" "${imagePath}"`;
        case 'darwin':
            return `open "${imagePath}"`;
        case 'linux':
            return `xdg-open "${imagePath}"`;
        default:
            throw new Error(`Unsupported platform: ${platform()}`);
    }
}

export const showImageTool: UnifiedTool<ShowImageInput, ShowImageOutput> = {
    name: 'show_image',
    description: getShowImageDescription(),
    parameters: {
        path: {
            required: true,
            description: 'The path to the image file to display'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path to the image file to display'
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
                description: 'Whether the image display was successful'
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
    async execute({ path: imagePath }: ShowImageInput, cwd: string): Promise<ShowImageOutput> {
        try {
            const absolutePath = resolvePath(imagePath, cwd);
            
            // Check if file exists
            try {
                await fs.access(absolutePath);
            } catch {
                throw new Error(`Image file not found at path: ${absolutePath}`);
            }

            // Get the platform-specific open command
            const command = getOpenCommand(absolutePath);

            // Execute the command
            await execAsync(command);

            return {
                success: true,
                message: `Image opened successfully: ${imagePath}`
            };
        } catch (error) {
            return {
                success: false,
                message: `Error displaying image: ${error.message}`,
                error: error.message
            };
        }
    }
};