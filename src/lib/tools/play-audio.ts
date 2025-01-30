import { UnifiedTool } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as sound from 'sound-play';
import { getPlayAudioDescription } from '../../core/prompts/tools';

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
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path to the audio file to play'
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
    async execute({ path: audioPath }: PlayAudioInput, cwd: string): Promise<PlayAudioOutput> {
        try {
            const absolutePath = resolvePath(audioPath, cwd);
            
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
            await sound.play(absolutePath);

            return {
                success: true,
                message: `Audio playback started: ${audioPath}`
            };
        } catch (error) {
            return {
                success: false,
                message: `Error playing audio: ${error.message}`,
                error: error.message
            };
        }
    }
};