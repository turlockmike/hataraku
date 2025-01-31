export interface VoiceMonitorConfig {
    wakeWord: string;
    sensitivity?: number;
    enableLogging?: boolean;
}

export interface AudioConfig {
    sampleRate: number;
    channels: number;
    encoding: 'LINEAR16';
}

export interface WakeWordDetectorOptions {
    sensitivity?: number;
    wakeWord: string;
}

export interface AudioRecorderOptions {
    config: AudioConfig;
    onData?: (data: Buffer) => void;
    onError?: (error: Error) => void;
}

export interface SpeechProcessorOptions {
    modelPath: string;
    scorerPath?: string;
    onResult?: (text: string) => void;
    onError?: (error: Error) => void;
}

export enum VoiceServiceState {
    IDLE = 'IDLE',
    LISTENING = 'LISTENING',
    PROCESSING = 'PROCESSING',
    ERROR = 'ERROR'
}

export interface VoiceCommandResult {
    text: string;
    confidence: number;
    timestamp: number;
}

export type VoiceServiceEventHandler = (state: VoiceServiceState) => void;
export type VoiceCommandHandler = (result: VoiceCommandResult) => Promise<void>;
export type ErrorHandler = (error: Error) => void;