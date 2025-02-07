import { HatarakuTool, Tool, UnifiedTool } from '../types';
import { writeToFileTool } from './write-to-file';
import { readFileTool } from './read-file';
import { listFilesTool } from './list-files';
import { searchFilesTool } from './search-files';
import { executeCommandTool } from './execute-command';
import { listCodeDefinitionsTool } from './list-code-definition-names';
import { useMcpTool } from './use-mcp-tool';
import { accessMcpResourceTool } from './access-mcp-resource';
import { waitForUserTool } from './wait-for-user';
import { showImageTool } from './show-image';
import { playAudioTool } from './play-audio';
import { fetchTool } from './fetch';
import { toGraphTool } from './to-graph';

// Tool Sets
export const FileSystemTools: UnifiedTool[] = [
    writeToFileTool,
    readFileTool,
    listFilesTool,
    searchFilesTool
];

export const CodingTools: UnifiedTool[] = [
    ...FileSystemTools,
    executeCommandTool,
    listCodeDefinitionsTool
];

export const McpTools: UnifiedTool[] = [
    useMcpTool,
    accessMcpResourceTool
];

export const BrowserTools: UnifiedTool[] = [
    fetchTool,
    showImageTool
];

export const UtilityTools: UnifiedTool[] = [
    waitForUserTool,
    playAudioTool,
    toGraphTool
];

// All available tools
export const AVAILABLE_TOOLS: UnifiedTool[] = [
    ...FileSystemTools,
    ...CodingTools,
    ...McpTools,
    ...BrowserTools,
    ...UtilityTools
];

// Tool documentation generator
export function getToolDocs(tools: UnifiedTool[]): string {
    return tools.map(tool => {
        const params = Object.entries(tool.parameters)
            .map(([name, param]) =>
                `- ${name}: (${param.required ? 'required' : 'optional'}) ${typeof param.description === 'function' ? param.description(process.cwd()) : param.description}`
            )
            .join('\n');
        return `## ${tool.name}\nDescription: ${typeof tool.description === 'function' ? tool.description(process.cwd()) : tool.description}\nParameters:\n${params}`;
    }).join('\n\n');
}

export function getHatarakuToolDocs(tools: HatarakuTool[]): string {
    return tools.map(tool => {
        const params = tool.inputSchema?.properties ? 
            Object.entries(tool.inputSchema.properties)
                .map(([name, param]) => {
                    const description = (param as { description?: string }).description || name;
                    const type = (param as { type: string }).type;
                    const enumValues = (param as { enum?: string[] }).enum;
                    const enumStr = enumValues ? `, enum: [${enumValues.join(', ')}]` : '';
                    const isRequired = Array.isArray(tool.inputSchema?.required) && tool.inputSchema.required.includes(name);
                    return `- ${name}: (${isRequired ? 'required' : 'optional'}) ${description} (type: ${type}${enumStr})`;
                })
                .join('\n')
            : '';
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
    listCodeDefinitionsTool,
    useMcpTool,
    accessMcpResourceTool,
    waitForUserTool,
    showImageTool,
    playAudioTool,
    fetchTool,
    toGraphTool
};