/**
 * Claude Agent SDK - V1 Basic Query
 *
 * Simple query() usage with prompt string, iterating over messages.
 * Best for scripts, automation, and single-shot tasks.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

async function main() {
  const q = query({
    prompt: 'Hello! Please introduce yourself in one sentence.',
    options: {
      model: 'sonnet',
      maxTurns: 10,
    },
  });

  for await (const message of q) {
    // Handle assistant messages (Claude's responses)
    if (message.type === 'assistant' && message.message) {
      const textContent = message.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (textContent) {
        console.log('Claude:', textContent.text);
      }
    }

    // Handle result message (final status)
    if (message.type === 'result') {
      if (message.subtype === 'success') {
        console.log(`\nCompleted. Cost: $${message.total_cost_usd?.toFixed(4)}`);
      } else if (message.subtype?.startsWith('error')) {
        console.error('Agent encountered an error:', message.subtype);
      }
    }
  }
}

main().catch(console.error);
