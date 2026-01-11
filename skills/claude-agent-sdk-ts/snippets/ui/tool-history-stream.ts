/**
 * Claude Agent SDK - Tool History Stream
 *
 * Extract and format tool call events from SDK messages for UI display.
 * Provides a clean message stream suitable for showing tool activity
 * in a chat interface.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

/**
 * Tool use event (when agent calls a tool)
 */
export interface ToolUseEvent {
  type: 'tool_use';
  id: string;
  toolName: string;
  toolInput: unknown;
  timestamp: string;
  // Formatted display text for common tools
  displayText?: string;
}

/**
 * Tool result event (after tool executes)
 */
export interface ToolResultEvent {
  type: 'tool_result';
  id: string;
  toolUseId: string;
  content: unknown;
  isError: boolean;
  timestamp: string;
  // Formatted display text
  displayText?: string;
}

/**
 * Text content event
 */
export interface TextEvent {
  type: 'text';
  id: string;
  content: string;
  timestamp: string;
}

/**
 * All possible UI events
 */
export type UIEvent = ToolUseEvent | ToolResultEvent | TextEvent;

/**
 * Format tool input for display
 */
function formatToolInput(toolName: string, input: unknown): string {
  const obj = input as Record<string, unknown>;

  switch (toolName) {
    case 'Bash':
      return `$ ${obj.command}`;

    case 'Read':
      return `Reading: ${obj.file_path}`;

    case 'Write':
      return `Writing: ${obj.file_path}`;

    case 'Edit':
      return `Editing: ${obj.file_path}`;

    case 'Glob':
      return `Finding: ${obj.pattern}`;

    case 'Grep':
      return `Searching: ${obj.pattern}`;

    case 'WebSearch':
      return `Searching: "${obj.query}"`;

    case 'WebFetch':
      return `Fetching: ${obj.url}`;

    case 'Task':
      const desc = obj.description || obj.prompt;
      return `Subagent: ${String(desc).slice(0, 50)}...`;

    default:
      // Generic format: show first few keys
      const keys = Object.keys(obj).slice(0, 2);
      const preview = keys.map((k) => `${k}: ${String(obj[k]).slice(0, 30)}`);
      return preview.join(', ') || JSON.stringify(input).slice(0, 50);
  }
}

/**
 * Format tool result for display
 */
function formatToolResult(content: unknown, isError: boolean): string {
  if (isError) {
    return `Error: ${String(content).slice(0, 100)}`;
  }

  if (typeof content === 'string') {
    // Truncate long results
    return content.length > 200 ? content.slice(0, 200) + '...' : content;
  }

  if (Array.isArray(content)) {
    return `[${content.length} items]`;
  }

  return JSON.stringify(content).slice(0, 100);
}

/**
 * Extract UI events from an SDK message
 */
export function extractEvents(msg: SDKMessage): UIEvent[] {
  const events: UIEvent[] = [];
  const timestamp = new Date().toISOString();

  // Handle assistant messages (contains tool_use and text blocks)
  if (msg.type === 'assistant' && msg.message) {
    for (const block of msg.message.content) {
      if (block.type === 'text' && 'text' in block) {
        events.push({
          type: 'text',
          id: crypto.randomUUID(),
          content: block.text,
          timestamp,
        });
      }

      if (block.type === 'tool_use' && 'name' in block && 'id' in block) {
        const toolUse: ToolUseEvent = {
          type: 'tool_use',
          id: block.id as string,
          toolName: block.name as string,
          toolInput: (block as any).input,
          timestamp,
          displayText: formatToolInput(
            block.name as string,
            (block as any).input
          ),
        };
        events.push(toolUse);
      }
    }
  }

  // Handle tool results (from user messages containing tool_result)
  if (msg.type === 'user' && msg.message) {
    const content = msg.message.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_result' && 'tool_use_id' in block) {
          const result: ToolResultEvent = {
            type: 'tool_result',
            id: crypto.randomUUID(),
            toolUseId: block.tool_use_id as string,
            content: block.content,
            isError: !!(block as any).is_error,
            timestamp,
            displayText: formatToolResult(
              block.content,
              !!(block as any).is_error
            ),
          };
          events.push(result);
        }
      }
    }
  }

  return events;
}

/**
 * Tool history collector - accumulates tool events during a conversation
 */
export class ToolHistoryCollector {
  private events: UIEvent[] = [];
  private toolUseMap: Map<string, ToolUseEvent> = new Map();

  /**
   * Process an SDK message and extract events
   */
  process(msg: SDKMessage): UIEvent[] {
    const newEvents = extractEvents(msg);

    for (const event of newEvents) {
      this.events.push(event);

      // Track tool_use events for pairing with results
      if (event.type === 'tool_use') {
        this.toolUseMap.set(event.id, event);
      }
    }

    return newEvents;
  }

  /**
   * Get all collected events
   */
  getHistory(): UIEvent[] {
    return [...this.events];
  }

  /**
   * Get just the tool events (no text)
   */
  getToolEvents(): (ToolUseEvent | ToolResultEvent)[] {
    return this.events.filter(
      (e): e is ToolUseEvent | ToolResultEvent =>
        e.type === 'tool_use' || e.type === 'tool_result'
    );
  }

  /**
   * Get tool use/result pairs
   */
  getToolPairs(): Array<{ use: ToolUseEvent; result?: ToolResultEvent }> {
    const pairs: Array<{ use: ToolUseEvent; result?: ToolResultEvent }> = [];

    for (const event of this.events) {
      if (event.type === 'tool_use') {
        pairs.push({ use: event });
      } else if (event.type === 'tool_result') {
        // Find the matching tool_use
        const pair = pairs.find(
          (p) => p.use.id === event.toolUseId && !p.result
        );
        if (pair) {
          pair.result = event;
        }
      }
    }

    return pairs;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.events = [];
    this.toolUseMap.clear();
  }
}

/**
 * Example: Stream tool events to console
 */
async function example() {
  const { query } = await import('@anthropic-ai/claude-agent-sdk');

  const collector = new ToolHistoryCollector();

  const q = query({
    prompt: 'List the files in the current directory and read package.json',
    options: {
      model: 'sonnet',
      cwd: process.cwd(),
      allowedTools: ['Bash', 'Read', 'Glob'],
    },
  });

  console.log('=== Tool Activity ===\n');

  for await (const msg of q) {
    const events = collector.process(msg);

    for (const event of events) {
      switch (event.type) {
        case 'tool_use':
          console.log(`🔧 ${event.toolName}: ${event.displayText}`);
          break;

        case 'tool_result':
          const status = event.isError ? '❌' : '✅';
          console.log(`${status} Result: ${event.displayText}`);
          break;

        case 'text':
          // Skip text for this example
          break;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total events: ${collector.getHistory().length}`);
  console.log(`Tool calls: ${collector.getToolEvents().length}`);

  console.log('\n=== Tool Pairs ===');
  for (const pair of collector.getToolPairs()) {
    console.log(`  ${pair.use.toolName}: ${pair.result ? 'completed' : 'pending'}`);
  }
}

// Run example if executed directly
// example().catch(console.error);

/**
 * WebSocket message format for tool events:
 *
 * Tool use:
 * {
 *   "type": "tool_use",
 *   "id": "tool-call-id",
 *   "toolName": "Bash",
 *   "toolInput": { "command": "ls -la" },
 *   "displayText": "$ ls -la",
 *   "timestamp": "2024-01-15T10:30:00Z"
 * }
 *
 * Tool result:
 * {
 *   "type": "tool_result",
 *   "id": "result-id",
 *   "toolUseId": "tool-call-id",
 *   "content": "file1.txt\nfile2.txt",
 *   "isError": false,
 *   "displayText": "file1.txt\nfile2.txt",
 *   "timestamp": "2024-01-15T10:30:01Z"
 * }
 */
