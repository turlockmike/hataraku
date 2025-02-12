import { Tool } from 'ai';
import { z } from 'zod';
import fetch from 'node-fetch';

export const fetchTool: Tool = {
  description: "Fetches content from a URL. Supports different response formats (html, json, text) and custom headers.",
  parameters: z.object({
    url: z.string().url().describe('The URL to fetch content from'),
    format: z.enum(['html', 'json', 'text']).optional().describe('The desired format of the response. Defaults to text.'),
    headers: z.record(z.string()).optional().describe('Request headers as a key-value object')
  }),
  execute: async ({ url, format = 'text', headers = {} }) => {
    try {
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Failed to fetch: ${response.statusText} (${response.status})`
          }]
        };
      }

      let content: string;
      switch (format) {
        case 'json':
          const json = await response.json();
          content = JSON.stringify(json, null, 2);
          break;
        case 'html':
          content = await response.text();
          break;
        case 'text':
        default:
          content = await response.text();
          break;
      }

      return {
        content: [{
          type: "text",
          text: content
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error fetching content: ${error.message}`
        }]
      };
    }
  }
};