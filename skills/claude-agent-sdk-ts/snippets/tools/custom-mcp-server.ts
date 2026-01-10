/**
 * Claude Agent SDK - Custom MCP Server
 *
 * Create custom tools using createSdkMcpServer and tool() helper.
 * This enables domain-specific tools for your agent.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { tool, createSdkMcpServer, query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/**
 * Create a custom MCP server with domain-specific tools
 */
const customServer = createSdkMcpServer({
  name: 'my-tools',
  version: '1.0.0',
  tools: [
    // Tool 1: Search a database
    tool(
      'search_database',
      'Search the database for records matching a query',
      {
        query: z.string().describe('Search query string'),
        table: z.enum(['users', 'orders', 'products']).describe('Table to search'),
        limit: z.number().optional().default(10).describe('Maximum results to return'),
      },
      async (args) => {
        // Simulate database search
        console.log(`Searching ${args.table} for: ${args.query}`);

        const mockResults = [
          { id: 1, name: 'Result 1', match: args.query },
          { id: 2, name: 'Result 2', match: args.query },
        ];

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  table: args.table,
                  query: args.query,
                  results: mockResults.slice(0, args.limit),
                  total: mockResults.length,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    ),

    // Tool 2: Send a notification
    tool(
      'send_notification',
      'Send a notification to a user',
      {
        userId: z.string().describe('User ID to notify'),
        message: z.string().describe('Notification message'),
        priority: z.enum(['low', 'normal', 'high']).default('normal'),
      },
      async (args) => {
        console.log(`Sending ${args.priority} notification to ${args.userId}: ${args.message}`);

        // Simulate sending notification
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                notificationId: `notif_${Date.now()}`,
                userId: args.userId,
                priority: args.priority,
              }),
            },
          ],
        };
      }
    ),

    // Tool 3: Calculate metrics
    tool(
      'calculate_metrics',
      'Calculate business metrics for a date range',
      {
        startDate: z.string().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().describe('End date (YYYY-MM-DD)'),
        metrics: z.array(z.enum(['revenue', 'users', 'orders'])).describe('Metrics to calculate'),
      },
      async (args) => {
        console.log(`Calculating metrics from ${args.startDate} to ${args.endDate}`);

        const mockMetrics: Record<string, number> = {
          revenue: 125000,
          users: 1500,
          orders: 3200,
        };

        const results = args.metrics.reduce(
          (acc, metric) => {
            acc[metric] = mockMetrics[metric] || 0;
            return acc;
          },
          {} as Record<string, number>
        );

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  dateRange: { start: args.startDate, end: args.endDate },
                  metrics: results,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    ),
  ],
});

/**
 * Use the custom server with query()
 */
async function main() {
  const q = query({
    prompt: 'Search for users with "john" in their name and send a notification to the first result.',
    options: {
      model: 'sonnet',
      maxTurns: 20,

      // Register the custom MCP server
      mcpServers: {
        'my-tools': customServer,
      },

      // Allow the custom tools (prefixed with mcp__<server-name>__)
      allowedTools: [
        'mcp__my-tools__search_database',
        'mcp__my-tools__send_notification',
        'mcp__my-tools__calculate_metrics',
      ],
    },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === 'tool_use') {
          console.log(`[Tool Call] ${block.name}`);
        }
        if (block.type === 'text' && 'text' in block) {
          console.log('Claude:', block.text);
        }
      }
    }

    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(`\nCost: $${msg.total_cost_usd?.toFixed(4)}`);
    }
  }
}

main().catch(console.error);
