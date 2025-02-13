import type { ToolExecutionOptions } from 'ai';

/**
 * Base interface for MCP tool responses
 */
export interface McpToolResponse<T = any> {
    content: Array<{
        type: string;
        text: string;
    }>;
    isError: boolean;
}

/**
 * Parsed MCP tool response
 */
export interface ParsedMcpToolResponse<T = any> {
    data: T;
    raw: McpToolResponse;
}

/**
 * Base tool interface matching the AI package's Tool type
 */
export interface BaseTool<TArgs = any, TResult = any> {
    description?: string;
    parameters: Record<string, any>;
    execute: (args: TArgs, options: ToolExecutionOptions) => Promise<TResult>;
}

/**
 * MCP tool with proper typing
 */
export interface McpTool<TArgs = any, TResult = any> extends BaseTool<TArgs, ParsedMcpToolResponse<TResult>> {
    description: string;
    parameters: Record<string, any>;
}

/**
 * Jira ticket interface
 */
export interface JiraTicket {
    key: string;
    summary: string;
    status: string;
    type: string;
    priority: string;
    assignee?: {
        name: string;
        email: string;
    };
    reporter?: {
        name: string;
        email: string;
    };
    description?: string;
    created?: string;
    updated?: string;
    url?: string;
}

/**
 * Arguments for Jira get ticket tool
 */
export interface JiraGetTicketArgs {
    ticketId: string;
}

/**
 * Jira get ticket tool type
 */
export type JiraGetTicketTool = McpTool<JiraGetTicketArgs, JiraTicket>;