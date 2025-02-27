import { Tool } from 'ai';
import { z } from 'zod';
import { fetchTool } from './fetch';
import { readFileTool } from './read-file';
import { writeFileTool } from './write-file';
import { listFilesTool } from './list-files';
import { searchFilesTool } from './search-files';
import { searchAndReplaceTool } from './search-and-replace';
import { insertContentTool } from './insert-content';
import { applyDiffTool } from './apply-diff';
import { createExecuteCommandTool } from './execute-command';
import { listCodeDefinitionsTool } from './list-code-definitions';
import { playAudioTool } from './play-audio';
import { showImageTool } from './show-image';
import { searchReplaceV2Tool } from './search-and-replace-v2';

// Create the execute command tool with grey output
const executeCommandTool = createExecuteCommandTool({ outputColor: 'grey' });

// Export individual tools
export {
  fetchTool,
  readFileTool,
  writeFileTool,
  listFilesTool,
  searchFilesTool,
  searchAndReplaceTool,
  insertContentTool,
  applyDiffTool,
  executeCommandTool,
  listCodeDefinitionsTool,
  playAudioTool,
  showImageTool,
  searchReplaceV2Tool
};

// Tool Sets
export const NetworkTools: Record<string, Tool> = {
  fetch: fetchTool
};

export const FileSystemTools: Record<string, Tool> = {
  read_file: readFileTool,
  write_file: writeFileTool,
  list_files: listFilesTool,
  search_files: searchFilesTool,
  search_and_replace: searchAndReplaceTool,
  insert_content: insertContentTool,
  apply_diff: applyDiffTool
};

export const SystemTools: Record<string, Tool> = {
  execute_command: executeCommandTool
};

export const CodeAnalysisTools: Record<string, Tool> = {
  list_code_definitions: listCodeDefinitionsTool
};

export const MediaTools: Record<string, Tool> = {
  play_audio: playAudioTool,
  show_image: showImageTool
};

// All available tools
export const ALL_TOOLS: Record<string, Tool> = {
  ...NetworkTools,
  ...FileSystemTools,
  ...SystemTools,
  ...CodeAnalysisTools,
  ...MediaTools
};

// Helper to get tool documentation
export function getToolDocs(tools: Record<string, Tool>): string {
  return Object.entries(tools)
    .map(([name, tool]) => {
      if (tool.parameters instanceof z.ZodObject) {
        const params = tool.parameters.shape;
        const paramDocs = Object.entries(params)
          .map(([paramName, schema]) => {
            const zodSchema = schema as z.ZodTypeAny;
            const description = zodSchema.description || paramName;
            const isRequired = !zodSchema.isOptional();
            return `- ${paramName}: (${isRequired ? 'required' : 'optional'}) ${description}`;
          })
          .join('\n');
        return `## ${name}\nParameters:\n${paramDocs}`;
      }
      return `## ${name}\nParameters: (Schema not available)`;
    })
    .join('\n\n');
}