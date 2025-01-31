import { EventEmitter } from 'events';
import { VoiceMonitorConfig, VoiceServiceState, VoiceCommandHandler, VoiceServiceEventHandler, ErrorHandler } from './types';
import { WakeWordDetector } from './WakeWordDetector';
import { AudioRecorder } from './AudioRecorder';
import { SpeechProcessor } from './SpeechProcessor';

/**
 * Main voice service that coordinates wake word detection, audio recording,
 * and speech-to-text processing
 */
export class VoiceMonitor extends EventEmitter {
    private config: VoiceMonitorConfig;
    private state: VoiceServiceState = VoiceServiceState.IDLE;
    private wakeWordDetector: WakeWordDetector;
    private audioRecorder: AudioRecorder;
    private speechProcessor: SpeechProcessor;
    private commandHandler?: VoiceCommandHandler;
    private stateHandler?: VoiceServiceEventHandler;
    private errorHandler?: ErrorHandler;

    constructor(config: VoiceMonitorConfig) {
        super();
        this.config = {
            sensitivity: 0.5,
            enableLogging: false,
            ...config
        };

        // Initialize components
        this.wakeWordDetector = new WakeWordDetector({
            wakeWord: this.config.wakeWord,
            sensitivity: this.config.sensitivity
        });

        this.audioRecorder = new AudioRecorder({
            config: AudioRecorder.getDefaultConfig(),
            onData: this.handleAudioData.bind(this),
            onError: this.handleError.bind(this)
        });

        this.speechProcessor = new SpeechProcessor({
            modelPath: '', // Will be set during initialization
            onResult: this.handleSpeechResult.bind(this),
            onError: this.handleError.bind(this)
        });

        // Set up event handlers
        this.setupEventHandlers();
    }

    /**
     * Set up event handlers for all components
     */
    private setupEventHandlers(): void {
        this.wakeWordDetector.on('error', this.handleError.bind(this));
        this.audioRecorder.on('error', this.handleError.bind(this));
        this.speechProcessor.on('error', this.handleError.bind(this));

        // Log events if logging is enabled
        if (this.config.enableLogging) {
            this.on('stateChange', (state) => {
                console.log(`Voice service state changed to: ${state}`);
            });
        }
    }

    /**
     * Start the voice monitoring service
     */
    async start(): Promise<void> {
        try {
            await this.audioRecorder.start();
            await this.wakeWordDetector.start();
            this.updateState(VoiceServiceState.LISTENING);
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    /**
     * Stop the voice monitoring service
     */
    async stop(): Promise<void> {
        try {
            await this.wakeWordDetector.stop();
            await this.audioRecorder.stop();
            await this.speechProcessor.cleanup();
            this.updateState(VoiceServiceState.IDLE);
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    /**
     * Handle incoming audio data
     */
    private async handleAudioData(data: Buffer): Promise<void> {
        try {
            if (this.state === VoiceServiceState.LISTENING) {
                this.wakeWordDetector.processAudio(data);
            } else if (this.state === VoiceServiceState.PROCESSING) {
                const result = await this.speechProcessor.processAudio(data);
                if (result && this.commandHandler) {
                    await this.commandHandler(result);
                }
            }
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    /**
     * Handle speech-to-text results
     */
    private async handleSpeechResult(text: string): Promise<void> {
        if (this.config.enableLogging) {
            console.log(`Speech recognized: ${text}`);
        }
    }

    /**
     * Update the service state
     */
    private updateState(newState: VoiceServiceState): void {
        this.state = newState;
        this.emit('stateChange', newState);
        if (this.stateHandler) {
            this.stateHandler(newState);
        }
    }

    /**
     * Handle errors from any component
     */
    private handleError(error: Error): void {
        this.updateState(VoiceServiceState.ERROR);
        this.emit('error', error);
        if (this.errorHandler) {
            this.errorHandler(error);
        }
        if (this.config.enableLogging) {
            console.error('Voice service error:', error);
        }
    }

    /**
     * Set handlers for voice commands and state changes
     */
    setHandlers({
        onCommand,
        onStateChange,
        onError
    }: {
        onCommand?: VoiceCommandHandler;
        onStateChange?: VoiceServiceEventHandler;
        onError?: ErrorHandler;
    }): void {
        this.commandHandler = onCommand;
        this.stateHandler = onStateChange;
        this.errorHandler = onError;
    }

    /**
     * Get the current service state
     */
    getState(): VoiceServiceState {
        return this.state;
    }
}