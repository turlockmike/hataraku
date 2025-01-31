import { EventEmitter } from 'events';
import { WakeWordDetectorOptions } from './types';
import ollama from 'ollama';

export class WakeWordDetector extends EventEmitter {
    private options: WakeWordDetectorOptions;
    private isListening: boolean = false;
    private ollamaClient: typeof ollama;
    private audioBuffer: Float32Array[] = [];
    private readonly SAMPLE_RATE = 16000;
    private readonly WINDOW_SIZE = 1.5; // seconds
    private readonly OVERLAP = 0.5; // seconds
    private readonly MODEL_NAME = 'openhermes';

    constructor(options: WakeWordDetectorOptions) {
        super();
        this.options = {
            sensitivity: 0.5,
            ...options,
        };
        this.ollamaClient = ollama;
    }

    /**
     * Initialize the wake word detector
     */
    async initialize(): Promise<void> {
        try {
            // Ensure model is available
            await this.ollamaClient.pull(this.MODEL_NAME);
            this.emit('initialized');
        } catch (error) {
            this.emit('error', new Error(`Failed to initialize wake word detector: ${error}`));
            throw error;
        }
    }

    /**
     * Start listening for wake word
     */
    async start(): Promise<void> {
        if (this.isListening) {
            return;
        }

        try {
            await this.initialize();
            this.isListening = true;
            this.emit('started');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop listening for wake word
     */
    async stop(): Promise<void> {
        if (!this.isListening) {
            return;
        }

        this.isListening = false;
        this.audioBuffer = [];
        this.emit('stopped');
    }

    /**
     * Process audio data for wake word detection
     */
    async processAudio(audioData: Buffer): Promise<void> {
        if (!this.isListening) {
            return;
        }

        try {
            // Convert audio buffer to Float32Array
            const float32Data = new Float32Array(audioData.length / 2);
            for (let i = 0; i < audioData.length; i += 2) {
                const int16Value = audioData.readInt16LE(i);
                float32Data[i / 2] = int16Value / 32768.0;
            }

            // Add to buffer
            this.audioBuffer.push(float32Data);

            // Calculate total buffer duration
            const totalSamples = this.audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
            const bufferDuration = totalSamples / this.SAMPLE_RATE;

            // Process buffer when it reaches window size
            if (bufferDuration >= this.WINDOW_SIZE) {
                // Concatenate buffer into single array
                const concatenated = new Float32Array(totalSamples);
                let offset = 0;
                for (const arr of this.audioBuffer) {
                    concatenated.set(arr, offset);
                    offset += arr.length;
                }

                // Convert to base64 for Ollama
                const audioBase64 = Buffer.from(concatenated.buffer).toString('base64');

                // Use Ollama for transcription
                const response = await this.ollamaClient.transcribe({
                    model: this.MODEL_NAME,
                    audio: audioBase64,
                    options: {
                        temperature: 0.1 // Lower temperature for more precise wake word detection
                    }
                });

                // Check for wake word in transcription
                const text = response.text.toLowerCase();
                if (text.includes('hey hataraku')) {
                    this.emit('wakeWord', {
                        keyword: 'hey hataraku',
                        timestamp: Date.now()
                    });
                }

                // Keep overlap portion of buffer
                const overlapSamples = Math.floor(this.OVERLAP * this.SAMPLE_RATE);
                const lastBuffer = concatenated.slice(-overlapSamples);
                this.audioBuffer = [lastBuffer];
            }
        } catch (error) {
            this.emit('error', error);
        }
    }

    /**
     * Check if the detector is currently listening
     */
    isActive(): boolean {
        return this.isListening;
    }
}