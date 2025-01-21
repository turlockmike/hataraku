export interface TextBlock {
    type: 'text';
    text: string;
}

export interface ImageBlock {
    type: 'image';
    image_url: {
        url: string;
    };
}

export interface ToolUseBlock {
    type: 'tool_use';
    tool_name: string;
    parameters: Record<string, string>;
}

export interface ToolResultBlock {
    type: 'tool_result';
    result: string;
}

export type MessageBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;

export type ToolResponse = string | MessageBlock[];

export interface MessageParser {
    parseToolUse(message: string): {
        name: string;
        params: Record<string, string>;
    } | null;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
    role: MessageRole;
    content: string;
}

export interface ApiClient {
    sendMessage(history: Message[]): Promise<string>;
}

export interface Tool {
    name: string;
    description: string;
    parameters: {
        [key: string]: {
            required: boolean;
            description: string;
        };
    };
}

export interface ToolExecutor {
    executeCommand(command: string): Promise<[boolean, ToolResponse]>;
    writeFile(path: string, content: string, lineCount: number): Promise<[boolean, ToolResponse]>;
    readFile(path: string): Promise<[boolean, ToolResponse]>;
    listFiles(path: string, recursive?: boolean): Promise<[boolean, ToolResponse]>;
    searchFiles(path: string, regex: string, filePattern?: string): Promise<[boolean, ToolResponse]>;
    listCodeDefinitions(path: string): Promise<[boolean, ToolResponse]>;
    browserAction(action: string, url?: string, coordinate?: string, text?: string): Promise<[boolean, ToolResponse]>;
    waitForUser(prompt: string): Promise<[boolean, ToolResponse]>;
    showImage(path: string): Promise<[boolean, ToolResponse]>;
    playAudio(path: string): Promise<[boolean, ToolResponse]>;
}

export interface CliConfig {
    mode?: string;
    mcpEnabled?: boolean;
    alwaysApproveResubmit?: boolean;
    requestDelaySeconds?: number;
    browserViewportSize?: { width: number; height: number };
    preferredLanguage?: string;
    customPrompts?: Record<string, string>;
}