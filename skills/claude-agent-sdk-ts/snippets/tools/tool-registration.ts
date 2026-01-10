/**
 * Claude Agent SDK - Tool Registration with Zod Schemas
 *
 * Define type-safe tools using the tool() helper function with Zod schemas.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

/**
 * Pattern 1: Simple tool with basic types
 */
const echoTool = tool(
  'echo',
  'Echo back the provided message',
  {
    message: z.string().describe('Message to echo'),
  },
  async (args) => ({
    content: [{ type: 'text', text: `Echo: ${args.message}` }],
  })
);

/**
 * Pattern 2: Tool with optional parameters and defaults
 */
const greetTool = tool(
  'greet',
  'Generate a greeting for a person',
  {
    name: z.string().describe('Name of the person to greet'),
    formal: z.boolean().optional().default(false).describe('Use formal greeting'),
    language: z.enum(['en', 'es', 'fr']).optional().default('en').describe('Language'),
  },
  async (args) => {
    const greetings: Record<string, Record<string, string>> = {
      en: { informal: 'Hi', formal: 'Good day' },
      es: { informal: 'Hola', formal: 'Buenos días' },
      fr: { informal: 'Salut', formal: 'Bonjour' },
    };

    const style = args.formal ? 'formal' : 'informal';
    const greeting = greetings[args.language][style];

    return {
      content: [{ type: 'text', text: `${greeting}, ${args.name}!` }],
    };
  }
);

/**
 * Pattern 3: Tool with complex nested schema
 */
const createOrderTool = tool(
  'create_order',
  'Create a new order with items',
  {
    customer: z.object({
      id: z.string().describe('Customer ID'),
      email: z.string().email().describe('Customer email'),
    }),
    items: z
      .array(
        z.object({
          productId: z.string().describe('Product ID'),
          quantity: z.number().int().positive().describe('Quantity'),
          price: z.number().positive().describe('Unit price'),
        })
      )
      .min(1)
      .describe('Order items'),
    notes: z.string().optional().describe('Order notes'),
  },
  async (args) => {
    const total = args.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              orderId: `ORD-${Date.now()}`,
              customer: args.customer,
              items: args.items,
              total,
              notes: args.notes,
              status: 'pending',
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

/**
 * Pattern 4: Tool with union types
 */
const processDataTool = tool(
  'process_data',
  'Process data in different formats',
  {
    format: z.enum(['json', 'csv', 'xml']).describe('Input format'),
    data: z.string().describe('Data to process'),
    options: z
      .union([
        z.object({
          format: z.literal('json'),
          pretty: z.boolean().optional(),
        }),
        z.object({
          format: z.literal('csv'),
          delimiter: z.string().optional(),
        }),
        z.object({
          format: z.literal('xml'),
          root: z.string().optional(),
        }),
      ])
      .optional()
      .describe('Format-specific options'),
  },
  async (args) => {
    return {
      content: [
        {
          type: 'text',
          text: `Processed ${args.format} data: ${args.data.length} characters`,
        },
      ],
    };
  }
);

/**
 * Pattern 5: Tool with validation
 */
const validateEmailTool = tool(
  'validate_email',
  'Validate an email address',
  {
    email: z.string().email().describe('Email address to validate'),
  },
  async (args) => {
    // Email is already validated by Zod schema
    const domain = args.email.split('@')[1];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            valid: true,
            email: args.email,
            domain,
          }),
        },
      ],
    };
  }
);

/**
 * Create server with all tools
 */
const toolServer = createSdkMcpServer({
  name: 'example-tools',
  version: '1.0.0',
  tools: [echoTool, greetTool, createOrderTool, processDataTool, validateEmailTool],
});

export { toolServer };

/**
 * Usage with query():
 *
 * const q = query({
 *   prompt: 'Create an order for customer cust_123...',
 *   options: {
 *     mcpServers: { 'example-tools': toolServer },
 *     allowedTools: [
 *       'mcp__example-tools__echo',
 *       'mcp__example-tools__greet',
 *       'mcp__example-tools__create_order',
 *       'mcp__example-tools__process_data',
 *       'mcp__example-tools__validate_email',
 *     ],
 *   },
 * });
 */
