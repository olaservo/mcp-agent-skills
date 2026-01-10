/**
 * Claude Agent SDK - V2 Multi-Turn Conversation
 *
 * Sequential multi-turn conversation with automatic context retention.
 * This is the key advantage of V2 over V1.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk';

async function main() {
  console.log('=== Multi-Turn Conversation ===\n');

  await using session = unstable_v2_createSession({ model: 'sonnet' });

  // Turn 1
  console.log('User: What is 5 + 3?');
  await session.send('What is 5 + 3? Just give me the number.');

  for await (const msg of session.stream()) {
    if (msg.type === 'assistant') {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) {
        console.log(`Claude: ${text.text}`);
      }
    }
  }

  // Turn 2 - Claude remembers the context
  console.log('\nUser: Multiply that by 2.');
  await session.send('Multiply that by 2. Just give me the number.');

  for await (const msg of session.stream()) {
    if (msg.type === 'assistant') {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) {
        console.log(`Claude: ${text.text}`);
      }
    }
  }

  // Turn 3 - Context continues
  console.log('\nUser: What calculations have we done so far?');
  await session.send('What calculations have we done so far?');

  for await (const msg of session.stream()) {
    if (msg.type === 'assistant') {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) {
        console.log(`Claude: ${text.text}`);
      }
    }

    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(`\n--- Total cost: $${msg.total_cost_usd?.toFixed(4)} ---`);
    }
  }
}

main().catch(console.error);
