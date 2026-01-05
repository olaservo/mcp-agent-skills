/**
 * Elicitation Capability - Handle server-initiated user input requests
 *
 * Copy this file to add elicitation support to any MCP client.
 *
 * Usage:
 *   import { Client } from '@modelcontextprotocol/sdk/client/index.js';
 *   import { setupElicitation } from './elicitation.js';
 *
 *   const client = new Client(
 *     { name: 'my-client', version: '1.0.0' },
 *     { capabilities: { elicitation: { form: {}, url: {} } } }
 *   );
 *
 *   setupElicitation(client);
 *   await client.connect(transport);
 */

import { createInterface } from 'node:readline';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ElicitRequestSchema, type ElicitResult } from '@modelcontextprotocol/sdk/types.js';

// Re-export SDK type for convenience
export type ElicitationResult = ElicitResult;

export interface ElicitationConfig {
  /** Custom form handler (default: terminal prompt) */
  onForm?: (message: string, schema?: Record<string, unknown>) => Promise<ElicitationResult>;
  /** Custom URL handler (default: log to console) */
  onUrl?: (url: string, message: string) => Promise<ElicitationResult>;
}

/**
 * Set up elicitation capability on a client.
 */
export function setupElicitation(client: Client, config: ElicitationConfig = {}): void {
  client.setRequestHandler(ElicitRequestSchema, async (request) => {
    const { params } = request;

    if (params.mode === 'url') {
      const url = (params.requestedSchema as { url?: string })?.url;
      if (!url) return { action: 'decline' };

      console.log(`\n[Elicitation] ${params.message}\n  URL: ${url}`);

      if (config.onUrl) return config.onUrl(url, params.message);
      return { action: 'accept', content: { redirected: true } };
    }

    // Form mode (default)
    console.log(`\n[Elicitation] ${params.message}`);

    if (config.onForm) return config.onForm(params.message, params.requestedSchema);

    // Default: terminal prompt
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>(r =>
      readline.question('  Accept? (y/n): ', a => { readline.close(); r(a.trim()); })
    );

    const accepted = ['y', 'yes'].includes(answer.toLowerCase());
    return {
      action: accepted ? 'accept' : 'decline',
      content: accepted ? { confirm: true } : undefined,
    };
  });
}
