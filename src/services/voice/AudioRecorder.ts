import { EventEmitter } from 'events';
import { AudioRecorderOptions, AudioConfig } from './types';
import * as recorder from 'node-record-lpcm16';
import { execSync } from 'child_process';

export class AudioRecorder extends EventEmitter {
    private options: AudioRecorderOptions;
    private isRecording: boolean = false;
    private recordStream: any = null;
    private readonly DEFAULT_CONFIG: AudioConfig = {
        sampleRate: 16000, // Required by most speech recognition engines
        channels: 1,       // Mono audio
        encoding: 'LINEAR16'
    };

    constructor(options: AudioRecorderOptions) {
        super();
        this.options = {
            config: {
                ...this.DEFAULT_CONFIG,
                ...(options.config || {})
            },
            onData: options.onData,
            onError: options.onError
        };
    }

    /**
     * Get default audio configuration
     */
    static getDefaultConfig(): AudioConfig {
        return {
            sampleRate: 16000,
            channels: 1,
            encoding: 'LINEAR16'
        };
    }

    /**
     * Verify audio recording capabilities
     */
    private verifyRecordingCapabilities(): void {
        try {
            // Check if rec command is available
            execSync('which rec');
            console.log('Using rec command for recording');
        } catch {
            throw new Error(
                'SoX rec command not found. Please install SoX:\n' +
                '- On macOS: brew install sox\n' +
                '- On Linux: sudo apt-get install sox libsox-fmt-all\n' +
                '- Or visit http://sox.sourceforge.net'
            );
        }
    }

    /**
     * Start audio recording
     */
    async start(): Promise<void> {
        if (this.isRecording) {
            return;
        }

        try {
            // Verify recording capabilities
            this.verifyRecordingCapabilities();

            // Configure recorder
            const recorderConfig = {
                sampleRate: this.options.config.sampleRate,
                channels: this.options.config.channels,
                silence: '10.0',
                threshold: 0.5,
                keepSilence: true,
                recorder: 'rec' // Use rec command from SoX
            };

            console.log('Starting recording with config:', recorderConfig); // Debug log

            // Start recording
            this.recordStream = recorder.record(recorderConfig)
                .stream()
                .on('data', (data: Buffer) => {
                    if (this.options.onData) {
                        this.options.onData(data);
                    }
                    this.emit('data', data);
                })
                .on('error', (error: Error) => {
                    console.error('Recording error:', error); // Debug log
                    if (this.options.onError) {
                        this.options.onError(error);
                    }
                    this.emit('error', error);
                });

            this.isRecording = true;
            this.emit('started');
            console.log('Recording started successfully'); // Debug log
        } catch (error) {
            const typedError = error as Error;
            console.error('Failed to start recording:', typedError); // Debug log
            if (this.options.onError) {
                this.options.onError(typedError);
            }
            this.emit('error', typedError);
            throw typedError;
        }
    }

    /**
     * Stop audio recording
     */
    async stop(): Promise<void> {
        if (!this.isRecording) {
            return;
        }

        try {
            if (this.recordStream) {
                this.recordStream.stop();
                this.recordStream = null;
            }
            this.isRecording = false;
            this.emit('stopped');
        } catch (error) {
            const typedError = error as Error;
            if (this.options.onError) {
                this.options.onError(typedError);
            }
            this.emit('error', typedError);
            throw typedError;
        }
    }

    /**
     * Pause audio recording
     */
    async pause(): Promise<void> {
        if (!this.isRecording || !this.recordStream) {
            return;
        }

        try {
            this.recordStream.pause();
            this.emit('paused');
        } catch (error) {
            const typedError = error as Error;
            if (this.options.onError) {
                this.options.onError(typedError);
            }
            this.emit('error', typedError);
            throw typedError;
        }
    }

    /**
     * Resume audio recording
     */
    async resume(): Promise<void> {
        if (!this.isRecording || !this.recordStream) {
            return;
        }

        try {
            this.recordStream.resume();
            this.emit('resumed');
        } catch (error) {
            const typedError = error as Error;
            if (this.options.onError) {
                this.options.onError(typedError);
            }
            this.emit('error', typedError);
            throw typedError;
        }
    }

    /**
     * Check if system has audio input capabilities
     */
    static async checkAudioInput(): Promise<boolean> {
        try {
            // Create test recorder
            const audioRecorder = new AudioRecorder({ config: AudioRecorder.getDefaultConfig() });
            audioRecorder.verifyRecordingCapabilities();

            // Attempt a short recording
            const testRecorder = recorder.record({
                sampleRate: 16000,
                channels: 1,
                duration: 0.1,
                recorder: 'rec'
            });

            return new Promise((resolve) => {
                testRecorder.stream()
                    .on('data', () => {
                        testRecorder.stop();
                        resolve(true);
                    })
                    .on('error', (error: Error) => {
                        console.error('Audio test error:', error); // Debug log
                        resolve(false);
                    });

                // Stop the test after a short timeout if no data is received
                setTimeout(() => {
                    testRecorder.stop();
                    resolve(false);
                }, 500);
            });
        } catch (error) {
            console.error('Failed to check audio input:', error); // Debug log
            return false;
        }
    }
}