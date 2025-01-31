import { EventEmitter } from 'events';
import { SpeechProcessorOptions, VoiceCommandResult } from './types';
import ollama from 'ollama';

export class SpeechProcessor extends EventEmitter {
    private options: SpeechProcessorOptions;
    private isInitialized: boolean = false;
    private ollamaClient: typeof ollama;
    private readonly MODEL_NAME = 'openhermes';

    constructor(options: SpeechProcessorOptions) {
        super();
        this.options = options;
        this.ollamaClient = ollama;
    }

    /**
     * Initialize the speech processor
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Check if Ollama is running and the model is available
            await this.ensureModelAvailable();
            this.isInitialized = true;
            this.emit('initialized');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Ensure the model is available in Ollama
     */
    private async ensureModelAvailable(): Promise<void> {
        try {
            // Try to pull the model if not already available
            await this.ollamaClient.pull(this.MODEL_NAME);
        } catch (error) {
            throw new Error(`Failed to ensure model availability: ${error}`);
        }
    }

    /**
     * Process audio data and convert to text
     */
    async processAudio(audioData: Buffer): Promise<VoiceCommandResult | null> {
        if (!this.isInitialized) {
            throw new Error('Speech processor not initialized');
        }

        try {
            // Convert audio buffer to base64 for Ollama
            const audioBase64 = audioData.toString('base64');

            // Process audio with model
            const response = await this.ollamaClient.transcribe({
                model: this.MODEL_NAME,
                audio: audioBase64,
                options: {
                    temperature: 0.2, // Lower temperature for more focused output
                }
            });

            // Create result
            const result: VoiceCommandResult = {
                text: response.text,
                confidence: response.segments?.[0]?.confidence ?? 1.0,
                timestamp: Date.now()
            };

            if (this.options.onResult) {
                this.options.onResult(result.text);
            }

            return result;
        } catch (error) {
            if (this.options.onError) {
                this.options.onError(error as Error);
            }
            throw error;
        }
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        this.isInitialized = false;
        this.emit('cleanup');
    }

    /**
     * Get the current initialization state
     */
    isReady(): boolean {
        return this.isInitialized;
    }

    /**
     * No need to download models as Ollama handles model management
     */
    static async prepareModels(): Promise<void> {
        // Nothing to prepare - Ollama handles model downloads
        return;
    }
}