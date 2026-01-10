/**
 * Claude Agent SDK - V1 Query with System Prompt
 *
 * Customize agent behavior with systemPrompt option.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

const CUSTOM_SYSTEM_PROMPT = `You are a helpful coding assistant specializing in TypeScript.

Key behaviors:
- Always explain your reasoning before writing code
- Use modern TypeScript features (ES2022+)
- Include type annotations
- Add helpful comments for complex logic
- Suggest tests when appropriate

When asked to write code, follow this format:
1. Brief explanation of the approach
2. The code itself
3. Usage example`;

async function main() {
  const q = query({
    prompt: 'Write a function that debounces another function.',
    options: {
      model: 'sonnet',
      maxTurns: 10,

      // Replace default system prompt entirely
      systemPrompt: CUSTOM_SYSTEM_PROMPT,

      // Or append to default system prompt:
      // appendSystemPrompt: 'Additional instructions here...',

      allowedTools: ['Read', 'Write'],
    },
  });

  for await (const message of q) {
    if (message.type === 'assistant' && message.message) {
      const textContent = message.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (textContent) {
        console.log(textContent.text);
      }
    }

    if (message.type === 'result' && message.subtype === 'success') {
      console.log(`\n--- Cost: $${message.total_cost_usd?.toFixed(4)} ---`);
    }
  }
}

main().catch(console.error);
