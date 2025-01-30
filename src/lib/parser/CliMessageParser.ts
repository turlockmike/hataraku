import { MessageParser } from '../types';

export class CliMessageParser implements MessageParser {
    private stripThinkingTags(message: string): string {
        return message.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
    }

    parseToolUse(message: string): { name: string; params: Record<string, string> } | null {
        // Strip thinking tags before parsing tool use
        message = this.stripThinkingTags(message);
        
        // Look for XML-style tool use tags
        const toolUseMatch = message.match(/<([a-zA-Z_]+)>([\s\S]*?)<\/\1>/);
        if (!toolUseMatch) {
            return null;
        }

        const toolName = toolUseMatch[1];
        const paramsContent = toolUseMatch[2];

        // Parse parameters from the content
        const params: Record<string, string> = {};
        const paramMatches = paramsContent.matchAll(/<([a-zA-Z_]+)>([\s\S]*?)<\/\1>/g);
        
        for (const match of paramMatches) {
            const [, paramName, paramValue] = match;
            params[paramName] = paramValue.trim();
        }

        return {
            name: toolName,
            params
        };
    }
}