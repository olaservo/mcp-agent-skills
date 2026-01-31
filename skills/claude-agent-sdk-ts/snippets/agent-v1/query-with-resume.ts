/**
 * Claude Agent SDK - V1 Query with Session Resume
 *
 * Maintain conversation memory across multiple query() calls
 * by capturing and reusing the session ID.
 *
 * This is the recommended pattern for building chat applications
 * with V1 that need conversation context.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

let sessionId: string | undefined;

async function chat(userPrompt: string): Promise<string> {
  const q = query({
    prompt: userPrompt,
    options: {
      model: 'sonnet',
      maxTurns: 10,
      // Resume previous session if we have one
      ...(sessionId && { resume: sessionId }),
    },
  });

  let response = '';

  for await (const message of q) {
    // Capture session ID from init message for conversation memory
    if (message.type === 'system' && message.subtype === 'init') {
      sessionId = (message as any).session_id;
    }

    // Collect response text
    if (message.type === 'assistant' && message.message) {
      for (const block of message.message.content) {
        if (block.type === 'text' && 'text' in block) {
          response += (block as { text: string }).text;
        }
      }
    }
  }

  return response;
}

async function main() {
  console.log('=== V1 Conversation Memory Demo ===\n');

  // Turn 1: Establish context
  console.log('You: My name is Alice and I like TypeScript.');
  const response1 = await chat('My name is Alice and I like TypeScript.');
  console.log(`Claude: ${response1}\n`);

  // Turn 2: Claude remembers the context
  console.log('You: What is my name and what do I like?');
  const response2 = await chat('What is my name and what do I like?');
  console.log(`Claude: ${response2}\n`);

  // Turn 3: Continue the conversation
  console.log('You: Suggest a project I might enjoy.');
  const response3 = await chat('Suggest a project I might enjoy.');
  console.log(`Claude: ${response3}`);
}

main().catch(console.error);

/**
 * Key points:
 *
 * 1. Capture session_id from the 'system' message with subtype 'init'
 * 2. Pass resume: sessionId to subsequent query() calls
 * 3. The session maintains full conversation context
 * 4. Works with all QueryOptions (cwd, systemPrompt, tools, etc.)
 *
 * Compare to V2 API:
 * - V2 unstable_v2_createSession has automatic memory but limited options
 * - V1 query() + resume gives you both memory AND full configuration
 */
