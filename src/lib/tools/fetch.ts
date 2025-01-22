import { UnifiedTool } from '../types';
import { Fetcher } from '../fetcher';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface FetchInput {
    url: string;
    format?: 'html' | 'json' | 'text' | 'markdown';
    headers?: string;
}

export interface FetchOutput {
    success: boolean;
    message: string;
    content?: string;
    error?: string;
}

export const fetchTool: UnifiedTool<FetchInput, FetchOutput> = {
    name: 'fetch',
    description: 'Fetch content from a URL in various formats (HTML, JSON, text, or markdown).',
    parameters: {
        url: {
            required: true,
            description: 'The URL to fetch content from'
        },
        format: {
            required: false,
            description: 'The desired format of the response (html, json, text, markdown). Defaults to html.'
        },
        headers: {
            required: false,
            description: 'JSON string of request headers'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'The URL to fetch content from'
            },
            format: {
                type: 'string',
                enum: ['html', 'json', 'text', 'markdown'],
                description: 'The desired format of the response. Defaults to html.' 
            },
            headers: {
                type: 'string',
                description: 'JSON string of request headers'
            }
        },
        required: ['url'],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the fetch operation was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            content: {
                type: 'string',
                description: 'The fetched content'
            },
            error: {
                type: 'string',
                description: 'Error message if the operation failed'
            }
        },
        required: ['success', 'message'],
        additionalProperties: false
    },
    // Implementation
    async execute({ url, format = 'html', headers }: FetchInput): Promise<FetchOutput> {
        try {
            const requestPayload = {
                url,
                headers: headers ? JSON.parse(headers) : undefined
            };

            let result;
            switch (format) {
                case 'json':
                    result = await Fetcher.json(requestPayload);
                    break;
                case 'text':
                    result = await Fetcher.txt(requestPayload);
                    break;
                case 'markdown':
                    result = await Fetcher.markdown(requestPayload);
                    break;
                case 'html':
                default:
                    result = await Fetcher.html(requestPayload);
                    break;
            }

            if (result.isError) {
                return {
                    success: false,
                    message: `Failed to fetch content: ${result.content[0].text}`,
                    error: result.content[0].text
                };
            }

            return {
                success: true,
                message: `Successfully fetched ${format} content`,
                content: result.content[0].text
            };
        } catch (error) {
            return {
                success: false,
                message: `Error fetching content: ${error.message}`,
                error: error.message
            };
        }
    }
};