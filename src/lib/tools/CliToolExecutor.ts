import { spawn } from 'child_process';
import { ToolResponse, ToolExecutor } from '../types';
import { BaseToolExecutor } from './index';
import { CliBrowserSession } from '../../services/browser/CliBrowserSession';

export class CliToolExecutor extends BaseToolExecutor implements ToolExecutor {
    private browserSession?: CliBrowserSession;

    override async executeCommand(command: string): Promise<[boolean, ToolResponse]> {
        return new Promise((resolve) => {
            const process = spawn(command, [], {
                shell: true,
                cwd: this.getCurrentWorkingDirectory()
            });

            let output = '';
            let error = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                error += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    resolve([true, 'Command failed with code ' + code + '\n' + error]);
                } else {
                    resolve([false, output]);
                }
            });
        });
    }

    getCurrentWorkingDirectory(): string {
        return process.cwd();
    }

    override async browserAction(action: string, url?: string, coordinate?: string, text?: string): Promise<[boolean, ToolResponse]> {
        try {
            // Initialize browser session if not exists
            if (!this.browserSession) {
                this.browserSession = new CliBrowserSession();
            }

            // Handle different browser actions
            switch (action) {
                case 'launch':
                    if (!url) {
                        return [true, 'URL is required for launch action'];
                    }
                    await this.browserSession.launchBrowser();
                    const launchResult = await this.browserSession.navigateToUrl(url);
                    return [false, formatBrowserResult(launchResult)];

                case 'click':
                    if (!coordinate) {
                        return [true, 'Coordinate is required for click action'];
                    }
                    const clickResult = await this.browserSession.click(coordinate);
                    return [false, formatBrowserResult(clickResult)];

                case 'type':
                    if (!text) {
                        return [true, 'Text is required for type action'];
                    }
                    const typeResult = await this.browserSession.type(text);
                    return [false, formatBrowserResult(typeResult)];

                case 'scroll_down':
                    const scrollDownResult = await this.browserSession.scrollDown();
                    return [false, formatBrowserResult(scrollDownResult)];

                case 'scroll_up':
                    const scrollUpResult = await this.browserSession.scrollUp();
                    return [false, formatBrowserResult(scrollUpResult)];

                case 'close':
                    const closeResult = await this.browserSession.closeBrowser();
                    this.browserSession = undefined;
                    return [false, 'Browser closed successfully'];

                default:
                    return [true, `Unknown browser action: ${action}`];
            }
        } catch (error) {
            // Ensure browser is closed on error
            if (this.browserSession) {
                await this.browserSession.closeBrowser();
                this.browserSession = undefined;
            }
            return [true, `Browser action failed: ${error.message}`];
        }
    }
}

function formatBrowserResult(result: { screenshot?: string; logs?: string; currentUrl?: string; currentMousePosition?: string }): string {
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