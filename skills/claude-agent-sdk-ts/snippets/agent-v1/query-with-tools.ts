/**
 * Claude Agent SDK - V1 Query with Tool Configuration
 *
 * Configure allowedTools and disallowedTools to control agent capabilities.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as path from 'path';

async function main() {
  const q = query({
    prompt: 'List the files in the current directory and read the package.json if it exists.',
    options: {
      model: 'sonnet',
      maxTurns: 20,
      cwd: process.cwd(),

      // Allowlist: Only these tools can be used
      allowedTools: [
        'Read',      // Read file contents
        'Glob',      // Find files by pattern
        'Grep',      // Search file contents
        'Bash',      // Run shell commands
      ],

      // Blocklist: These tools are explicitly disabled
      // disallowedTools: ['WebSearch', 'WebFetch'],

      // Alternative: Use Claude Code preset for all tools
      // tools: { type: 'preset', preset: 'claude_code' },

      // Alternative: Disable all tools
      // tools: [],
    },
  });

  for await (const message of q) {
    if (message.type === 'assistant' && message.message) {
      // Log tool calls
      for (const block of message.message.content) {
        if (block.type === 'tool_use') {
          console.log(`[Tool] ${block.name}:`, JSON.stringify(block.input).slice(0, 100));
        }
        if (block.type === 'text' && 'text' in block) {
          console.log('Claude:', block.text);
        }
      }
    }

    if (message.type === 'result' && message.subtype === 'success') {
      console.log(`\nCost: $${message.total_cost_usd?.toFixed(4)}`);
    }
  }
}

main().catch(console.error);
