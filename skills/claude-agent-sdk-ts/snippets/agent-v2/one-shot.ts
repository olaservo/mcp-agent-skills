/**
 * Claude Agent SDK - V2 One-Shot Query
 *
 * Use unstable_v2_prompt for simple one-shot queries.
 * Returns result directly without message iteration.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { unstable_v2_prompt } from '@anthropic-ai/claude-agent-sdk';

async function main() {
  console.log('=== One-Shot Queries ===\n');

  // Simple question
  const result1 = await unstable_v2_prompt(
    'What is the capital of France? One word only.',
    { model: 'sonnet' }
  );

  if (result1.subtype === 'success') {
    console.log(`Q: What is the capital of France?`);
    console.log(`A: ${result1.result}`);
    console.log(`Cost: $${result1.total_cost_usd.toFixed(4)}\n`);
  }

  // Another question
  const result2 = await unstable_v2_prompt(
    'What is 42 * 17? Just the number.',
    { model: 'haiku' } // Use haiku for simple calculations
  );

  if (result2.subtype === 'success') {
    console.log(`Q: What is 42 * 17?`);
    console.log(`A: ${result2.result}`);
    console.log(`Cost: $${result2.total_cost_usd.toFixed(4)}\n`);
  }

  // Error handling
  const result3 = await unstable_v2_prompt(
    'Summarize the benefits of TypeScript in one sentence.',
    { model: 'sonnet' }
  );

  if (result3.subtype === 'success') {
    console.log(`Q: Benefits of TypeScript?`);
    console.log(`A: ${result3.result}`);
    console.log(`Cost: $${result3.total_cost_usd.toFixed(4)}`);
  } else {
    console.error('Query failed');
  }
}

main().catch(console.error);

/**
 * Use cases for unstable_v2_prompt:
 * - Simple Q&A without tool usage
 * - Quick calculations or transformations
 * - Single-turn requests where you just need the answer
 * - When you don't need streaming or tool call visibility
 *
 * For complex tasks with tools, use unstable_v2_createSession instead.
 */
