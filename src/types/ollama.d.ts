declare module 'ollama' {
    interface OllamaOptions {
        model?: string;
        format?: 'json';
        context?: number[];
        options?: {
            temperature?: number;
            num_predict?: number;
            top_k?: number;
            top_p?: number;
            repeat_penalty?: number;
            seed?: number;
            stop?: string[];
        };
    }

    interface AudioTranscriptionOptions extends OllamaOptions {
        audio: Buffer | string; // Buffer or base64 string
        language?: string;
        task?: 'transcribe' | 'translate';
    }

    interface AudioTranscriptionResult {
        text: string;
        segments?: Array<{
            start: number;
            end: number;
            text: string;
            confidence: number;
        }>;
    }

    interface KeywordDetectionOptions extends OllamaOptions {
        audio: Buffer | string;
        keywords: string[];
        threshold?: number;
    }

    interface KeywordDetectionResult {
        detected: boolean;
        keyword?: string;
        confidence?: number;
        timestamp?: number;
    }

    interface PullOptions {
        name: string;
        insecure?: boolean;
        stream?: boolean;
    }

    interface PullResponse {
        status: string;
        digest?: string;
        total?: number;
        completed?: number;
    }

    export interface Ollama {
        transcribe(options: AudioTranscriptionOptions): Promise<AudioTranscriptionResult>;
        detectKeywords(options: KeywordDetectionOptions): Promise<KeywordDetectionResult>;
        pull(modelName: string, options?: Omit<PullOptions, 'name'>): Promise<PullResponse>;
    }

    const ollama: Ollama;
    export default ollama;
}