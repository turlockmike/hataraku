import express, { Request, Response, RequestHandler } from 'express';
import { TaskLoop } from './core/task-loop';
import { CliToolExecutor } from './lib/tools/CliToolExecutor';
import { CliMessageParser } from './lib/parser/CliMessageParser';
import { McpClient } from './lib/mcp/McpClient';
import { buildApiHandler } from './api';
import { ApiProvider } from './shared/api';

export async function startServer(port: number = 3000, apiKey: string, provider: ApiProvider = 'openrouter', model: string = 'anthropic/claude-3.5-sonnet') {
    const app = express();
    
    // Initialize components
    const apiHandler = buildApiHandler({
        apiProvider: provider,
        [`${provider}ApiKey`]: apiKey,
        [`${provider}ModelId`]: model
    });
    
    const toolExecutor = new CliToolExecutor(process.cwd());
    const messageParser = new CliMessageParser();
    const mcpClient = new McpClient();

    // Parse JSON bodies
    app.use(express.json());

    // Serve static HTML for the search page
    const homeHandler: RequestHandler = (_req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Hataraku Search</title>
                <style>
                    body {
                        font-family: system-ui, -apple-system, sans-serif;
                        max-width: 800px;
                        margin: 40px auto;
                        padding: 0 20px;
                        line-height: 1.6;
                    }
                    form {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 30px;
                    }
                    input[type="text"] {
                        flex: 1;
                        padding: 8px 12px;
                        font-size: 16px;
                        border: 1px solid #ccc;
                        border-radius: 4px;
                    }
                    button {
                        padding: 8px 20px;
                        font-size: 16px;
                        background: #0066cc;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    }
                    button:hover {
                        background: #0052a3;
                    }
                    #result {
                        padding: 20px;
                        border-radius: 4px;
                        background: #f5f5f5;
                    }
                    .error {
                        color: #cc0000;
                    }
                </style>
            </head>
            <body>
                <h1>Hataraku Search</h1>
                <form action="/search" method="POST">
                    <input type="text" name="query" placeholder="Enter your query..." required>
                    <button type="submit">Search</button>
                </form>
                <div id="result"></div>
                <script>
                    document.querySelector('form').addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const query = document.querySelector('input[name="query"]').value;
                        const result = document.getElementById('result');
                        result.innerHTML = 'Loading...';
                        
                        try {
                            const response = await fetch('/search', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({ query })
                            });
                            const html = await response.text();
                            result.innerHTML = html;
                        } catch (error) {
                            result.innerHTML = 'Error: ' + error.message;
                        }
                    });
                </script>
            </body>
            </html>
        `);
    };

    // Handle search requests
    const searchHandler: RequestHandler = async (req, res) => {
        try {
            const query = req.body.query;
            if (!query) {
                res.status(400).send('Query is required');
                return;
            }

            // Create task loop instance
            const taskLoop = new TaskLoop(
                apiHandler,
                toolExecutor,
                mcpClient,
                messageParser,
                3, // maxAttempts
                false, // isInteractive
                process.cwd(),
                { sound: false }
            );

            // Modify the query to request HTML output
            const taskQuery = `${query} (Return the result as HTML that can be displayed in a web page. DO NOT ATTEMPT TO OPEN OR DISPLAY IT, ONLY RETURN THE HTML in the result of the attempt_completion call)`;

            // Run the task and get the result
            const result = await taskLoop.run(taskQuery);

            // Send the completion result or a default error message
            res.send(result.completionResult || '<div class="error">No result returned</div>');
        } catch (error) {
            console.error('Search error:', error);
            res.status(500).send(`<div class="error">Error: ${error.message}</div>`);
        }
    };

    // Set up routes
    app.get('/', homeHandler);
    app.post('/search', searchHandler);

    return new Promise<void>((resolve, reject) => {
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
            resolve();
        }).on('error', reject);
    });
}
