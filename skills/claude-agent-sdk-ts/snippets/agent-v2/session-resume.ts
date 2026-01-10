/**
 * Claude Agent SDK - V2 Session Resume
 *
 * Persist and resume sessions across restarts using session IDs.
 * Useful for long-running assistants or services.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
} from '@anthropic-ai/claude-agent-sdk';

async function main() {
  console.log('=== Session Persistence Demo ===\n');

  let sessionId: string | undefined;

  // First session - establish a memory
  {
    await using session = unstable_v2_createSession({ model: 'sonnet' });

    console.log('[Session 1] Telling Claude my favorite color...');
    await session.send('My favorite color is blue. Please remember this!');

    for await (const msg of session.stream()) {
      // Capture the session ID from the init message
      if (msg.type === 'system' && msg.subtype === 'init') {
        sessionId = msg.session_id;
        console.log(`[Session 1] Session ID: ${sessionId}`);
      }

      if (msg.type === 'assistant') {
        const text = msg.message.content.find(
          (c: any): c is { type: 'text'; text: string } => c.type === 'text'
        );
        if (text) {
          console.log(`[Session 1] Claude: ${text.text}`);
        }
      }
    }
  }
  // Session 1 closed here

  console.log('\n--- Session closed. Simulating time passing... ---\n');

  // In a real app, you would save sessionId to a database or file
  // and retrieve it later to resume the conversation

  // Resume the session
  if (sessionId) {
    await using session = unstable_v2_resumeSession(sessionId, { model: 'sonnet' });

    console.log('[Session 2] Resuming and asking Claude...');
    await session.send('What is my favorite color?');

    for await (const msg of session.stream()) {
      if (msg.type === 'assistant') {
        const text = msg.message.content.find(
          (c: any): c is { type: 'text'; text: string } => c.type === 'text'
        );
        if (text) {
          console.log(`[Session 2] Claude: ${text.text}`);
        }
      }

      if (msg.type === 'result' && msg.subtype === 'success') {
        console.log(`\n--- Total cost: $${msg.total_cost_usd?.toFixed(4)} ---`);
      }
    }
  }
}

main().catch(console.error);

/**
 * Session persistence use cases:
 * - User returns to a chat app later
 * - Server restarts but needs to continue conversations
 * - Multi-step workflows across separate invocations
 * - Debugging: replay a conversation from a specific point
 *
 * Note: Session IDs have a limited lifetime. Check SDK docs for expiration details.
 */
