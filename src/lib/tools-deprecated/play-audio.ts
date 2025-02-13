import { UnifiedTool } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as sound from 'sound-play';
import { getPlayAudioDescription } from '../../core-old/prompts/tools';

export interface PlayAudioInput {
    path: string;
}

export interface PlayAudioOutput {
    success: boolean;
    message: string;
    error?: string;
}

// Helper function
function resolvePath(relativePath: string, cwd: string): string {
    return path.resolve(cwd, relativePath);
}

// Supported audio formats
const SUPPORTED_FORMATS = ['.mp3', '.wav', '.ogg', '.aac', '.m4a'];

export const playAudioTool: UnifiedTool<PlayAudioInput, PlayAudioOutput> = {
    name: 'play_audio',
    description: getPlayAudioDescription(),
    parameters: {
        path: {
            required: true,
            description: 'The path to the audio file to play'
        },
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path to the audio file to play'
            },
        },
        // At least one of path or text must be provided
        required: [],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the audio playback was initiated successfully'
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
    async execute(input: PlayAudioInput, cwd: string): Promise<PlayAudioOutput> {
        try {

            // Handle audio file playback
            if (input.path) {
                const absolutePath = resolvePath(input.path, cwd);
                
                // Check if file exists
                try {
                    await fs.access(absolutePath);
                } catch {
                    throw new Error(`Audio file not found at path: ${absolutePath}`);
                }

                // Check file format
                const ext = path.extname(absolutePath).toLowerCase();
                if (!SUPPORTED_FORMATS.includes(ext)) {
                    throw new Error(`Unsupported audio format: ${ext}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`);
                }

                // Play the audio file
                const soundPromise = sound.play(absolutePath);
                
                // Set a timeout to ensure the sound handle is cleaned up
                const timeoutPromise = new Promise((resolve) => {
                    setTimeout(resolve, 1000); // Wait 1 second for the sound to play
                });
                
                // Wait for either the sound to finish or the timeout
                await Promise.race([soundPromise, timeoutPromise]);

                return {
                    success: true,
                    message: `Audio playback started: ${input.path}`
                };
            }

            throw new Error('Either path or text must be provided');
        } catch (error) {
            return {
                success: false,
                message: `Error playing audio: ${error.message}`,
                error: error.message
            };
        }
    }
};