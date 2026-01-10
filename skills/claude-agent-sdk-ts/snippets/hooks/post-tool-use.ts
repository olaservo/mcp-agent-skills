/**
 * Claude Agent SDK - PostToolUse Hooks
 *
 * Process tool results after execution.
 * Use for logging, auditing, transformation, or cost tracking.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { HookJSONOutput } from '@anthropic-ai/claude-agent-sdk';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Example 1: Audit logging hook
 */
const auditLogHook = {
  matcher: '.*', // Match all tools
  hooks: [
    async (input: any): Promise<HookJSONOutput> => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        tool: input.tool_name,
        input: input.tool_input,
        // result: input.tool_result, // Available in PostToolUse
      };

      // Write to audit log file
      const logPath = path.join(process.cwd(), 'audit.log');
      fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');

      console.log(`[Audit] Tool: ${input.tool_name}`);

      return { continue: true };
    },
  ],
};

/**
 * Example 2: Tool usage statistics
 */
const toolStats: Record<string, { count: number; totalTime: number }> = {};

const statsHook = {
  matcher: '.*',
  hooks: [
    async (input: any): Promise<HookJSONOutput> => {
      const toolName = input.tool_name;

      if (!toolStats[toolName]) {
        toolStats[toolName] = { count: 0, totalTime: 0 };
      }
      toolStats[toolName].count++;

      // In a real implementation, you'd track timing between pre and post hooks

      return { continue: true };
    },
  ],
};

/**
 * Example 3: Sensitive data redaction logging
 */
const sensitivePatterns = [
  /api[_-]?key/i,
  /password/i,
  /secret/i,
  /token/i,
  /credential/i,
];

const redactingLogHook = {
  matcher: '.*',
  hooks: [
    async (input: any): Promise<HookJSONOutput> => {
      const inputStr = JSON.stringify(input.tool_input);

      // Check for sensitive data
      const hasSensitive = sensitivePatterns.some((p) => p.test(inputStr));

      if (hasSensitive) {
        console.log(`[Log] Tool: ${input.tool_name} - Input: [REDACTED - contains sensitive data]`);
      } else {
        console.log(`[Log] Tool: ${input.tool_name} - Input: ${inputStr.slice(0, 100)}...`);
      }

      return { continue: true };
    },
  ],
};

/**
 * Example 4: File change tracking
 */
const fileChanges: Array<{ file: string; action: string; timestamp: string }> = [];

const fileChangeTracker = {
  matcher: 'Write|Edit|MultiEdit',
  hooks: [
    async (input: any): Promise<HookJSONOutput> => {
      const filePath = input.tool_input.file_path;
      const toolName = input.tool_name;

      const action = toolName === 'Write' ? 'created' : 'modified';

      fileChanges.push({
        file: filePath,
        action,
        timestamp: new Date().toISOString(),
      });

      console.log(`[File ${action}] ${filePath}`);

      return { continue: true };
    },
  ],
};

/**
 * Example 5: Notification on specific tools
 */
const notificationHook = {
  matcher: 'Bash|WebFetch',
  hooks: [
    async (input: any): Promise<HookJSONOutput> => {
      // In a real app, send notification to monitoring system
      console.log(`[NOTIFY] Sensitive tool used: ${input.tool_name}`);

      // Could send to Slack, PagerDuty, etc.
      // await sendSlackMessage(`Agent used ${input.tool_name}`);

      return { continue: true };
    },
  ],
};

/**
 * Use hooks with query()
 */
async function main() {
  const q = query({
    prompt: 'Read the package.json file and tell me about the project.',
    options: {
      model: 'sonnet',
      cwd: process.cwd(),
      allowedTools: ['Read', 'Glob', 'Grep'],

      hooks: {
        PostToolUse: [
          auditLogHook,
          statsHook,
          redactingLogHook,
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

  // Print stats at the end
  console.log('\n=== Tool Usage Statistics ===');
  for (const [tool, stats] of Object.entries(toolStats)) {
    console.log(`${tool}: ${stats.count} calls`);
  }
}

main().catch(console.error);

/**
 * Combining PreToolUse and PostToolUse:
 *
 * hooks: {
 *   PreToolUse: [validationHook, blockingHook],
 *   PostToolUse: [loggingHook, statsHook],
 * }
 */
