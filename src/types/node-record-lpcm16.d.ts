declare module 'node-record-lpcm16' {
    import { Stream } from 'stream';

    interface RecordOptions {
        sampleRate?: number;
        channels?: number;
        compress?: boolean;
        threshold?: number;
        thresholdStart?: number;
        thresholdEnd?: number;
        silence?: string;
        verbose?: boolean;
        recordProgram?: string;
        recorder?: string;
        device?: string;
        audioType?: string;
        duration?: number;
        keepSilence?: boolean;
    }

    interface Recorder {
        stream(): Stream;
        stop(): void;
        pause(): void;
        resume(): void;
    }

    export function record(options?: RecordOptions): Recorder;
}