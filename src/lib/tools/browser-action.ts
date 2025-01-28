import { UnifiedTool } from '../types';
import { CliBrowserSession } from '../../services/browser/CliBrowserSession';

export interface BrowserActionInput {
    action: string;
    url?: string;
    coordinate?: string;
    text?: string;
}

export interface BrowserActionOutput {
    success: boolean;
    message: string;
    screenshot?: string;
    logs?: string;
    currentUrl?: string;
    currentMousePosition?: string;
    error?: string;
}

let browserSession: CliBrowserSession | null = null;

function formatBrowserResult(result: { 
    screenshot?: string; 
    logs?: string; 
    currentUrl?: string; 
    currentMousePosition?: string; 
}): string {
    const parts = [];
    
    if (result.logs) {
        parts.push(`Console logs:\n${result.logs}`);
    }
    
    if (result.currentUrl) {
        parts.push(`Current URL: ${result.currentUrl}`);
    }
    
    if (result.currentMousePosition) {
        parts.push(`Mouse position: ${result.currentMousePosition}`);
    }
    
    if (result.screenshot) {
        parts.push(`Screenshot captured (base64 encoded)`);
    }
    
    return parts.join('\n\n') || 'Action completed successfully';
}

export const browserActionTool: UnifiedTool<BrowserActionInput, BrowserActionOutput> = {
    name: 'browser_action',
    description: 'Request to interact with a Puppeteer-controlled browser. Every action, except `close`, will be responded to with a screenshot of the browser\'s current state, along with any new console logs.',
    parameters: {
        action: {
            required: true,
            description: 'The action to perform (launch, click, type, scroll_down, scroll_up, close)'
        },
        url: {
            required: false,
            description: 'The URL to navigate to (required for launch action)'
        },
        coordinate: {
            required: false,
            description: 'The x,y coordinates for click action'
        },
        text: {
            required: false,
            description: 'The text to type for type action'
        }
    },
    // JSON Schema for input validation
    inputSchema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['launch', 'click', 'type', 'scroll_down', 'scroll_up', 'close'],
                description: 'The action to perform'
            },
            url: {
                type: 'string',
                description: 'The URL to navigate to (required for launch action)'
            },
            coordinate: {
                type: 'string',
                pattern: '^\\d+,\\d+$',
                description: 'The x,y coordinates for click action'
            },
            text: {
                type: 'string',
                description: 'The text to type for type action'
            }
        },
        required: ['action'],
        additionalProperties: false
    },
    // JSON Schema for output validation
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the browser action was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            screenshot: {
                type: 'string',
                description: 'Base64 encoded screenshot of the browser state'
            },
            logs: {
                type: 'string',
                description: 'Console logs from the browser'
            },
            currentUrl: {
                type: 'string',
                description: 'Current URL of the browser'
            },
            currentMousePosition: {
                type: 'string',
                description: 'Current mouse position in the browser'
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
    async execute({ action, url, coordinate, text }: BrowserActionInput, cwd: string): Promise<BrowserActionOutput> {
        try {
            // Initialize browser session if not exists
            if (!browserSession) {
                browserSession = new CliBrowserSession();
            }

            // Handle different browser actions
            switch (action) {
                case 'launch': {
                    if (!url) {
                        return {
                            success: false,
                            message: 'URL is required for launch action',
                            error: 'Missing URL parameter'
                        };
                    }
                    await browserSession.launchBrowser();
                    const result = await browserSession.navigateToUrl(url);
                    return {
                        success: true,
                        message: 'Browser launched and navigated successfully',
                        ...result
                    };
                }

                case 'click': {
                    if (!coordinate) {
                        return {
                            success: false,
                            message: 'Coordinate is required for click action',
                            error: 'Missing coordinate parameter'
                        };
                    }
                    const result = await browserSession.click(coordinate);
                    return {
                        success: true,
                        message: `Clicked at coordinate ${coordinate}`,
                        ...result
                    };
                }

                case 'type': {
                    if (!text) {
                        return {
                            success: false,
                            message: 'Text is required for type action',
                            error: 'Missing text parameter'
                        };
                    }
                    const result = await browserSession.type(text);
                    return {
                        success: true,
                        message: 'Text typed successfully',
                        ...result
                    };
                }

                case 'scroll_down': {
                    const result = await browserSession.scrollDown();
                    return {
                        success: true,
                        message: 'Scrolled down successfully',
                        ...result
                    };
                }

                case 'scroll_up': {
                    const result = await browserSession.scrollUp();
                    return {
                        success: true,
                        message: 'Scrolled up successfully',
                        ...result
                    };
                }

                case 'close': {
                    await browserSession.closeBrowser();
                    browserSession = null;
                    return {
                        success: true,
                        message: 'Browser closed successfully'
                    };
                }

                default:
                    return {
                        success: false,
                        message: `Unknown browser action: ${action}`,
                        error: `Invalid action: ${action}`
                    };
            }
        } catch (error) {
            // Ensure browser is closed on error
            if (browserSession) {
                await browserSession.closeBrowser();
                browserSession = null;
            }
            return {
                success: false,
                message: `Browser action failed: ${error.message}`,
                error: error.message
            };
        }
    }
};