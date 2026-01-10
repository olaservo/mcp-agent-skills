/**
 * Claude Agent SDK - V2 Basic Session
 *
 * Create a session with unstable_v2_createSession, use send() and stream().
 * Best for interactive applications with conversation context.
 *
 * Note: V2 APIs are prefixed with unstable_v2_ and may change between versions.
 * Requires TypeScript 5.2+ with target ES2022 for "await using" syntax.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk';

async function main() {
  // Create a session - "await using" ensures automatic cleanup
  await using session = unstable_v2_createSession({ model: 'sonnet' });

  // Send a message
  await session.send('Hello! Please introduce yourself in one sentence.');

  // Stream and process responses
  for await (const msg of session.stream()) {
    if (msg.type === 'assistant') {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) {
        console.log('Claude:', text.text);
      }
    }

    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(`\nCost: $${msg.total_cost_usd?.toFixed(4)}`);
    }
  }
  // Session is automatically disposed when the block exits
}

main().catch(console.error);

/**
 * Alternative without "await using" (for older TypeScript):
 *
 * const session = unstable_v2_createSession({ model: 'sonnet' });
 * try {
 *   await session.send('Hello!');
 *   for await (const msg of session.stream()) { ... }
 * } finally {
 *   await session[Symbol.asyncDispose]();
 * }
 */
