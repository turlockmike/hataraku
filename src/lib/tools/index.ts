import { Tool, ToolExecutor, ToolResponse } from '../types';
import { writeToFileTool } from './write-to-file';
import { readFileTool } from './read-file';
import { listFilesTool } from './list-files';
import { searchFilesTool } from './search-files';
import { executeCommandTool } from './execute-command';
import { attemptCompletionTool } from './attempt-completion';
import { listCodeDefinitionsTool } from './list-code-definition-names';
import { useMcpTool } from './use-mcp-tool';
import { accessMcpResourceTool } from './access-mcp-resource';
import { waitForUserTool } from './wait-for-user';
import { showImageTool } from './show-image';
import { playAudioTool } from './play-audio';

// Export all tools for backward compatibility
export const AVAILABLE_TOOLS: Tool[] = [
    writeToFileTool,
    readFileTool,
    listFilesTool,
    searchFilesTool,
    executeCommandTool,
    attemptCompletionTool,
    listCodeDefinitionsTool,
    useMcpTool,
    accessMcpResourceTool,
    waitForUserTool,
    showImageTool,
    playAudioTool
];

// Re-export individual tools for direct access
export {
    writeToFileTool,
    readFileTool,
    listFilesTool,
    searchFilesTool,
    executeCommandTool,
    attemptCompletionTool,
    listCodeDefinitionsTool,
    useMcpTool,
    accessMcpResourceTool,
    waitForUserTool,
    showImageTool,
    playAudioTool
};

// Base executor class that uses the new tool implementations
export class BaseToolExecutor implements ToolExecutor {
    constructor(protected cwd: string) {}

    async executeCommand(command: string): Promise<[boolean, ToolResponse]> {
        const result = await executeCommandTool.execute({ command }, this.cwd);
        return [!result.success, result.output || result.message];
    }

    async writeFile(filePath: string, content: string, lineCount: number): Promise<[boolean, ToolResponse]> {
        const result = await writeToFileTool.execute({ path: filePath, content, line_count: lineCount }, this.cwd);
        return [!result.success, result.message];
    }

    async readFile(filePath: string): Promise<[boolean, ToolResponse]> {
        const result = await readFileTool.execute({ path: filePath }, this.cwd);
        return [!result.success, result.content || result.message];
    }

    async listFiles(dirPath: string, recursive?: boolean): Promise<[boolean, ToolResponse]> {
        const result = await listFilesTool.execute({ path: dirPath, recursive }, this.cwd);
        return [!result.success, result.files?.join('\n') || result.message];
    }

    async searchFiles(dirPath: string, regex: string, filePattern?: string): Promise<[boolean, ToolResponse]> {
        const result = await searchFilesTool.execute({ path: dirPath, regex, file_pattern: filePattern }, this.cwd);
        return [!result.success, result.results || result.message];
    }

    async listCodeDefinitions(dirPath: string): Promise<[boolean, ToolResponse]> {
        const result = await listCodeDefinitionsTool.execute({ path: dirPath }, this.cwd);
        return [!result.success, result.definitions || result.message];
    }

    async browserAction(action: string, url?: string, coordinate?: string, text?: string): Promise<[boolean, ToolResponse]> {
        throw new Error('browserAction must be implemented by platform');
    }

    async waitForUser(prompt: string): Promise<[boolean, ToolResponse]> {
        const result = await waitForUserTool.execute({ prompt }, this.cwd);
        return [!result.success, result.response || result.message];
    }

    async showImage(imagePath: string): Promise<[boolean, ToolResponse]> {
        const result = await showImageTool.execute({ path: imagePath }, this.cwd);
        return [!result.success, result.message];
    }

    async playAudio(audioPath: string): Promise<[boolean, ToolResponse]> {
        const result = await playAudioTool.execute({ path: audioPath }, this.cwd);
        return [!result.success, result.message];
    }
}