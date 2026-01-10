/**
 * Claude Agent SDK - PreToolUse Hooks
 *
 * Intercept and control tool calls before they execute.
 * Use for validation, blocking dangerous operations, or modifying inputs.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { HookJSONOutput } from '@anthropic-ai/claude-agent-sdk';
import * as path from 'path';

/**
 * Example 1: Block writes to sensitive paths
 */
const pathRestrictionHook = {
  matcher: 'Write|Edit|MultiEdit',
  hooks: [
    async (input: any): Promise<HookJSONOutput> => {
      const filePath = input.tool_input.file_path || '';

      // Block writes to system paths
      const forbiddenPaths = ['/etc/', '/usr/', 'node_modules/', '.env'];
      for (const forbidden of forbiddenPaths) {
        if (filePath.includes(forbidden)) {
          return {
            decision: 'block',
            stopReason: `Cannot write to restricted path: ${forbidden}`,
            continue: false,
          };
        }
      }

      return { continue: true };
    },
  ],
};

/**
 * Example 2: Restrict script files to specific directory
 */
const scriptLocationHook = {
  matcher: 'Write|Edit|MultiEdit',
  hooks: [
    async (input: any): Promise<HookJSONOutput> => {
      const filePath = input.tool_input.file_path || '';
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.js' || ext === '.ts') {
        const scriptsDir = path.join(process.cwd(), 'scripts');

        if (!filePath.startsWith(scriptsDir)) {
          return {
            decision: 'block',
            stopReason: `Script files must be in ${scriptsDir}`,
            continue: false,
          };
        }
      }

      return { continue: true };
    },
  ],
};

/**
 * Example 3: Block dangerous bash commands
 */
const dangerousCommandsHook = {
  matcher: 'Bash',
  hooks: [
    async (input: any): Promise<HookJSONOutput> => {
      const command = input.tool_input.command || '';

      const dangerous = [
        /rm\s+-rf\s+\//,     // rm -rf /
        /rm\s+-rf\s+~\//,    // rm -rf ~/
        />\s*\/dev\/sd/,     // Write to disk device
        /mkfs/,             // Format filesystem
        /dd\s+if=/,         // Low-level disk operations
        /:(){ :|:& };:/,    // Fork bomb
      ];

      for (const pattern of dangerous) {
        if (pattern.test(command)) {
          return {
            decision: 'block',
            stopReason: `Blocked dangerous command: ${command.slice(0, 50)}...`,
            continue: false,
          };
        }
      }

      return { continue: true };
    },
  ],
};

/**
 * Example 4: Rate limiting hook
 */
const toolCounts: Record<string, number> = {};
const RATE_LIMITS: Record<string, number> = {
  WebSearch: 10,
  WebFetch: 20,
  Bash: 50,
};

const rateLimitHook = {
  matcher: '.*', // Match all tools
  hooks: [
    async (input: any): Promise<HookJSONOutput> => {
      const toolName = input.tool_name;
      const limit = RATE_LIMITS[toolName];

      if (limit !== undefined) {
        toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;

        if (toolCounts[toolName] > limit) {
          return {
            decision: 'block',
            stopReason: `Rate limit exceeded for ${toolName} (max ${limit})`,
            continue: false,
          };
        }
      }

      return { continue: true };
    },
  ],
};

/**
 * Use hooks with query()
 */
async function main() {
  const q = query({
    prompt: 'Create a new TypeScript file with a hello world function.',
    options: {
      model: 'sonnet',
      cwd: process.cwd(),
      allowedTools: ['Write', 'Read', 'Bash'],

      hooks: {
        PreToolUse: [
          pathRestrictionHook,
          scriptLocationHook,
          dangerousCommandsHook,
          rateLimitHook,
        ],
      },
    },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) console.log('Claude:', text.text);
    }
  }
}

main().catch(console.error);
