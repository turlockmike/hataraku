import TurndownService from "turndown";
import { JSDOM } from 'jsdom';

interface RequestPayload {
    url: string;
    headers?: Record<string, string>;
}

interface FetcherResponse {
    content: Array<{ type: 'text'; text: string }>;
    isError: boolean;
}

export class Fetcher {
    private static async _fetch({
        url,
        headers,
    }: RequestPayload): Promise<Response> {
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    ...headers,
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            return response;
        } catch (e: unknown) {
            if (e instanceof Error) {
                throw new Error(`Failed to fetch ${url}: ${e.message}`);
            } else {
                throw new Error(`Failed to fetch ${url}: Unknown error`);
            }
        }
    }

    static async html(requestPayload: RequestPayload): Promise<FetcherResponse> {
        try {
            const response = await this._fetch(requestPayload);
            const html = await response.text();
            return { content: [{ type: "text", text: html }], isError: false };
        } catch (error) {
            return {
                content: [{ type: "text", text: (error as Error).message }],
                isError: true,
            };
        }
    }

    static async json(requestPayload: RequestPayload): Promise<FetcherResponse> {
        try {
            const response = await this._fetch(requestPayload);
            const json = await response.json();
            return {
                content: [{ type: "text", text: JSON.stringify(json, null, 2) }],
                isError: false,
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: (error as Error).message }],
                isError: true,
            };
        }
    }

    static async txt(requestPayload: RequestPayload): Promise<FetcherResponse> {
        try {
            const response = await this._fetch(requestPayload);
            const html = await response.text();

            const dom = new JSDOM(html);
            const document = dom.window.document;

            // Type-safe element removal
            const scripts = document.getElementsByTagName("script");
            const styles = document.getElementsByTagName("style");
            
            // Convert HTMLCollections to arrays and specify element types
            Array.from(scripts as HTMLCollectionOf<HTMLScriptElement>)
                .forEach(script => script.parentNode?.removeChild(script));
            
            Array.from(styles as HTMLCollectionOf<HTMLStyleElement>)
                .forEach(style => style.parentNode?.removeChild(style));

            const text = document.body?.textContent || "";
            const normalizedText = text.replace(/\s+/g, " ").trim();

            return {
                content: [{ type: "text", text: normalizedText }],
                isError: false,
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: (error as Error).message }],
                isError: true,
            };
        }
    }

    static async markdown(requestPayload: RequestPayload): Promise<FetcherResponse> {
        try {
            const response = await this._fetch(requestPayload);
            const html = await response.text();
            const turndownService = new TurndownService();
            const markdown = turndownService.turndown(html);
            return { content: [{ type: "text", text: markdown }], isError: false };
        } catch (error) {
            return {
                content: [{ type: "text", text: (error as Error).message }],
                isError: true,
            };
        }
    }
}