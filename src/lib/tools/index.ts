import { Tool } from '../types';
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
import { browserActionTool } from './browser-action';
import { fetchTool } from './fetch';
import { toGraphTool } from './to-graph';

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
    playAudioTool,
    toGraphTool,
    // fetchTool // TODO: add this back in
];

// Tool documentation generator
export function getToolDocs(): string {
    return AVAILABLE_TOOLS.map(tool => {
        const params = Object.entries(tool.parameters)
            .map(([name, param]) =>
                `- ${name}: (${param.required ? 'required' : 'optional'}) ${param.description}`
            )
            .join('\n');
        return `## ${tool.name}\nDescription: ${tool.description}\nParameters:\n${params}`;
    }).join('\n\n');
}

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
    playAudioTool,
    fetchTool,
    toGraphTool
};