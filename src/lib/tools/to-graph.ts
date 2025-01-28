#!/usr/bin/env node
import { UnifiedTool } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';
import { platform } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ToGraphInput {
    data: string; // CSV or JSON formatted data
    type: 'line' | 'bar' | 'pie' | 'scatter';
    title?: string;
    xLabel?: string;
    yLabel?: string;
}

export interface ToGraphOutput {
    success: boolean;
    message: string;
    error?: string;
    filePath?: string;
}

// Helper function to resolve path
function resolvePath(relativePath: string, cwd: string): string {
    return path.resolve(cwd, relativePath);
}

// Platform-specific open command
function getOpenCommand(filePath: string): string {
    switch (platform()) {
        case 'win32':
            return `start "" "${filePath}"`;
        case 'darwin':
            return `open "${filePath}"`;
        case 'linux':
            return `xdg-open "${filePath}"`;
        default:
            throw new Error(`Unsupported platform: ${platform()}`);
    }
}

// Generate HTML content with Chart.js
function generateHtml(data: string, type: string, title?: string, xLabel?: string, yLabel?: string): string {
    // Parse the data
    let parsedData;
    try {
        parsedData = JSON.parse(data);
    } catch {
        // Attempt to parse as CSV
        const lines = data.trim().split('\n').map(line => line.split(','));
        const headers = lines[0];
        const values = lines.slice(1);
        parsedData = values.map(row => {
            const obj: Record<string, any> = {};
            headers.forEach((header, i) => {
                obj[header.trim()] = isNaN(Number(row[i])) ? row[i].trim() : Number(row[i]);
            });
            return obj;
        });
    }

    // Extract labels and data
    const labels = Object.keys(parsedData[0]).filter(key => key !== 'value');
    const datasets = labels.map(label => ({
        label,
        data: parsedData.map((row: any) => row[label])
    }));

    return `
<!DOCTYPE html>
<html>
<head>
    <title>${title || 'Graph'}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            display: flex;
            flex-direction: column;
            align-items: center;
            font-family: Arial, sans-serif;
            margin: 20px;
            background: #f5f5f5;
        }
        .container {
            width: 80%;
            max-width: 800px;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="container">
        <canvas id="myChart"></canvas>
    </div>
    <script>
        const ctx = document.getElementById('myChart');
        new Chart(ctx, {
            type: '${type}',
            data: {
                labels: ${JSON.stringify(parsedData.map((row: any) => row[labels[0]]))},
                datasets: ${JSON.stringify(datasets.slice(1))}
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: ${!!title},
                        text: '${title || ''}'
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: ${!!xLabel},
                            text: '${xLabel || ''}'
                        }
                    },
                    y: {
                        title: {
                            display: ${!!yLabel},
                            text: '${yLabel || ''}'
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;
}

export const toGraphTool: UnifiedTool<ToGraphInput, ToGraphOutput> = {
    name: 'to_graph',
    description: 'Generate an HTML page with a graph visualization of the provided data using Chart.js. Accepts CSV or JSON formatted data.',
    parameters: {
        data: {
            required: true,
            description: 'The data to graph in CSV or JSON format'
        },
        type: {
            required: true,
            description: 'The type of graph to generate (line, bar, pie, or scatter)'
        },
        title: {
            required: false,
            description: 'The title of the graph'
        },
        xLabel: {
            required: false,
            description: 'Label for the X axis'
        },
        yLabel: {
            required: false,
            description: 'Label for the Y axis'
        }
    },
    inputSchema: {
        type: 'object',
        properties: {
            data: {
                type: 'string',
                description: 'The data to graph in CSV or JSON format'
            },
            type: {
                type: 'string',
                enum: ['line', 'bar', 'pie', 'scatter'],
                description: 'The type of graph to generate'
            },
            title: {
                type: 'string',
                description: 'The title of the graph'
            },
            xLabel: {
                type: 'string',
                description: 'Label for the X axis'
            },
            yLabel: {
                type: 'string',
                description: 'Label for the Y axis'
            }
        },
        required: ['data', 'type'],
        additionalProperties: false
    },
    outputSchema: {
        type: 'object',
        properties: {
            success: {
                type: 'boolean',
                description: 'Whether the graph generation was successful'
            },
            message: {
                type: 'string',
                description: 'A message describing the result of the operation'
            },
            error: {
                type: 'string',
                description: 'Error message if the operation failed'
            },
            filePath: {
                type: 'string',
                description: 'Path to the generated HTML file'
            }
        },
        required: ['success', 'message'],
        additionalProperties: false
    },
    async execute({ data, type, title, xLabel, yLabel }: ToGraphInput, cwd: string): Promise<ToGraphOutput> {
        try {
            // Generate HTML content
            const htmlContent = generateHtml(data, type, title, xLabel, yLabel);

            // Create a unique filename
            const timestamp = new Date().getTime();
            const fileName = `graph_${timestamp}.html`;
            const filePath = resolvePath(fileName, cwd);

            // Write the file
            await fs.writeFile(filePath, htmlContent, 'utf-8');

            // Open the file in the default browser
            const command = getOpenCommand(filePath);
            await execAsync(command);

            return {
                success: true,
                message: `Graph generated and opened successfully`,
                filePath: fileName
            };
        } catch (error) {
            return {
                success: false,
                message: `Error generating graph: ${error.message}`,
                error: error.message
            };
        }
    }
};