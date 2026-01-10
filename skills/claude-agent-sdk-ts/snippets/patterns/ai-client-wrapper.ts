/**
 * Claude Agent SDK - AI Client Wrapper Pattern
 *
 * Reusable client wrapper class around query() for application integration.
 * Provides a clean interface for common operations.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { HookJSONOutput } from '@anthropic-ai/claude-agent-sdk';

/**
 * Type definitions
 */
export type SDKMessage = {
  type: string;
  subtype?: string;
  message?: {
    role: string;
    content: Array<{ type: string; text?: string; name?: string; input?: any }>;
  };
  total_cost_usd?: number;
  duration_ms?: number;
  session_id?: string;
};

export interface AIClientOptions {
  maxTurns?: number;
  cwd?: string;
  model?: 'opus' | 'sonnet' | 'haiku';
  allowedTools?: string[];
  disallowedTools?: string[];
  systemPrompt?: string;
  appendSystemPrompt?: string;
  settingSources?: ('user' | 'project' | 'local')[];
  hooks?: {
    PreToolUse?: Array<{ matcher: string; hooks: Array<(input: any) => Promise<HookJSONOutput>> }>;
    PostToolUse?: Array<{ matcher: string; hooks: Array<(input: any) => Promise<HookJSONOutput>> }>;
  };
}

export interface QueryResult {
  messages: SDKMessage[];
  text: string;
  cost: number;
  duration: number;
  toolCalls: Array<{ name: string; input: any }>;
}

/**
 * AI Client wrapper for the Claude Agent SDK
 */
export class AIClient {
  private defaultOptions: AIClientOptions;

  constructor(options: AIClientOptions = {}) {
    this.defaultOptions = {
      maxTurns: 100,
      cwd: process.cwd(),
      model: 'sonnet',
      allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'],
      ...options,
    };
  }

  /**
   * Stream query results
   */
  async *queryStream(
    prompt: string,
    options?: Partial<AIClientOptions>
  ): AsyncGenerator<SDKMessage> {
    const mergedOptions = { ...this.defaultOptions, ...options };

    for await (const message of query({
      prompt,
      options: mergedOptions as any,
    })) {
      yield message as SDKMessage;
    }
  }

  /**
   * Execute a query and collect all results
   */
  async querySingle(prompt: string, options?: Partial<AIClientOptions>): Promise<QueryResult> {
    const messages: SDKMessage[] = [];
    const textParts: string[] = [];
    const toolCalls: Array<{ name: string; input: any }> = [];
    let cost = 0;
    let duration = 0;

    for await (const message of this.queryStream(prompt, options)) {
      messages.push(message);

      // Extract text content
      if (message.type === 'assistant' && message.message) {
        for (const block of message.message.content) {
          if (block.type === 'text' && block.text) {
            textParts.push(block.text);
          }
          if (block.type === 'tool_use' && block.name) {
            toolCalls.push({ name: block.name, input: block.input });
          }
        }
      }

      // Extract result metadata
      if (message.type === 'result' && message.subtype === 'success') {
        cost = message.total_cost_usd || 0;
        duration = message.duration_ms || 0;
      }
    }

    return {
      messages,
      text: textParts.join('\n'),
      cost,
      duration,
      toolCalls,
    };
  }

  /**
   * Simple query that returns just the text response
   */
  async ask(prompt: string, options?: Partial<AIClientOptions>): Promise<string> {
    const result = await this.querySingle(prompt, options);
    return result.text;
  }

  /**
   * Query with callback for each message
   */
  async queryWithCallback(
    prompt: string,
    onMessage: (message: SDKMessage) => void,
    options?: Partial<AIClientOptions>
  ): Promise<QueryResult> {
    const messages: SDKMessage[] = [];
    const textParts: string[] = [];
    const toolCalls: Array<{ name: string; input: any }> = [];
    let cost = 0;
    let duration = 0;

    for await (const message of this.queryStream(prompt, options)) {
      messages.push(message);
      onMessage(message);

      if (message.type === 'assistant' && message.message) {
        for (const block of message.message.content) {
          if (block.type === 'text' && block.text) {
            textParts.push(block.text);
          }
          if (block.type === 'tool_use' && block.name) {
            toolCalls.push({ name: block.name, input: block.input });
          }
        }
      }

      if (message.type === 'result' && message.subtype === 'success') {
        cost = message.total_cost_usd || 0;
        duration = message.duration_ms || 0;
      }
    }

    return { messages, text: textParts.join('\n'), cost, duration, toolCalls };
  }

  /**
   * Update default options
   */
  setOptions(options: Partial<AIClientOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Get current options
   */
  getOptions(): AIClientOptions {
    return { ...this.defaultOptions };
  }
}

/**
 * Singleton instance for simple use cases
 */
let defaultClient: AIClient | null = null;

export function getDefaultClient(): AIClient {
  if (!defaultClient) {
    defaultClient = new AIClient();
  }
  return defaultClient;
}

/**
 * Usage example
 */
async function main() {
  // Create client with custom options
  const client = new AIClient({
    model: 'sonnet',
    cwd: process.cwd(),
    allowedTools: ['Read', 'Glob', 'Grep'],
  });

  // Simple question
  console.log('=== Simple Ask ===');
  const answer = await client.ask('What is TypeScript?');
  console.log(answer);

  // Full query with details
  console.log('\n=== Full Query ===');
  const result = await client.querySingle('List the TypeScript files in this directory.', {
    allowedTools: ['Glob', 'Read'],
  });
  console.log('Response:', result.text);
  console.log('Cost:', `$${result.cost.toFixed(4)}`);
  console.log('Tool calls:', result.toolCalls.map((t) => t.name).join(', '));

  // Streaming with callback
  console.log('\n=== Streaming ===');
  await client.queryWithCallback(
    'Explain what a closure is.',
    (msg) => {
      if (msg.type === 'assistant' && msg.message) {
        const text = msg.message.content.find((c) => c.type === 'text');
        if (text?.text) {
          process.stdout.write('.');
        }
      }
    },
    { model: 'haiku' }
  );
  console.log('\nDone!');
}

main().catch(console.error);
