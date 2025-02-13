import { Tool } from 'ai';
import { z } from 'zod';

export const fetchTool: Tool = {
  description: "Fetches content from a URL. Supports different response formats (html, json, text) and custom headers.",
  parameters: z.object({
    url: z.string().url().describe('The URL to fetch from'),
    format: z.enum(['json', 'text', 'html']).optional().describe('The expected response format. Defaults to text.'),
    headers: z.string().optional().describe('A JSON string containing custom headers to send with the request')
  }),
  execute: async ({ url, format = 'text', headers: headersStr }) => {
    try {
      // Parse headers if provided
      const headers = headersStr ? JSON.parse(headersStr) : {};

      // Make the request
      const response = await fetch(url, { headers });

      if (!response.ok) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: `HTTP error ${response.status}: ${response.statusText}`
          }]
        };
      }

      // Handle response based on format
      let content;
      switch (format) {
        case 'json':
          content = await response.json();
          content = JSON.stringify(content, null, 2);
          break;
        case 'html':
          content = await response.text();
          break;
        default:
          content = await response.text();
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
          text: `Error fetching URL: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
};