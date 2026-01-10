/**
 * Claude Agent SDK - Message Queue Pattern
 *
 * AsyncIterable message queue for multi-turn V1 conversations.
 * Enables interactive chat with the V1 query() API.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

/**
 * Type for SDK user messages
 */
export type SDKUserMessage = {
  type: 'user';
  message: {
    role: 'user';
    content: string;
  };
};

/**
 * Message queue that implements AsyncIterable for use with query()
 *
 * Features:
 * - Async iterator interface for query() input
 * - Push messages from external sources (UI, WebSocket, etc.)
 * - Close queue to end conversation
 * - Backpressure handling via waiting promise
 */
export class MessageQueue {
  private messages: SDKUserMessage[] = [];
  private waiting: ((msg: SDKUserMessage) => void) | null = null;
  private closed = false;

  /**
   * Add a message to the queue
   * @param content - Message content string
   */
  push(content: string): void {
    if (this.closed) {
      console.warn('Cannot push to closed queue');
      return;
    }

    const msg: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content },
    };

    if (this.waiting) {
      // Someone is waiting for a message, deliver immediately
      this.waiting(msg);
      this.waiting = null;
    } else {
      // Queue the message
      this.messages.push(msg);
    }
  }

  /**
   * Async iterator implementation
   * Yields messages as they arrive, waits if queue is empty
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<SDKUserMessage> {
    while (!this.closed) {
      if (this.messages.length > 0) {
        // Return queued message
        yield this.messages.shift()!;
      } else {
        // Wait for next message
        const msg = await new Promise<SDKUserMessage>((resolve) => {
          this.waiting = resolve;
        });

        // Check if closed while waiting
        if (this.closed && msg.message.content === '') {
          break;
        }

        yield msg;
      }
    }
  }

  /**
   * Close the queue and stop iteration
   */
  close(): void {
    this.closed = true;

    // Unblock any waiting consumer
    if (this.waiting) {
      this.waiting({
        type: 'user',
        message: { role: 'user', content: '' },
      });
      this.waiting = null;
    }
  }

  /**
   * Check if queue is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Get number of pending messages
   */
  get length(): number {
    return this.messages.length;
  }
}

/**
 * Extended queue with event callbacks
 */
export class EventedMessageQueue extends MessageQueue {
  private onMessage?: (msg: SDKUserMessage) => void;
  private onClose?: () => void;

  setOnMessage(callback: (msg: SDKUserMessage) => void): void {
    this.onMessage = callback;
  }

  setOnClose(callback: () => void): void {
    this.onClose = callback;
  }

  push(content: string): void {
    super.push(content);
    if (this.onMessage) {
      this.onMessage({
        type: 'user',
        message: { role: 'user', content },
      });
    }
  }

  close(): void {
    super.close();
    if (this.onClose) {
      this.onClose();
    }
  }
}

/**
 * Usage example with query()
 */
import { query } from '@anthropic-ai/claude-agent-sdk';

async function main() {
  const queue = new MessageQueue();

  // Start query with queue as input
  const q = query({
    prompt: queue as any, // Cast needed for AsyncIterable
    options: {
      model: 'sonnet',
      maxTurns: 100,
      allowedTools: ['Read', 'Write'],
    },
  });

  // Process responses in background
  const responseTask = (async () => {
    for await (const msg of q) {
      if (msg.type === 'assistant' && msg.message) {
        const text = msg.message.content.find(
          (c: any): c is { type: 'text'; text: string } => c.type === 'text'
        );
        if (text) {
          console.log('Claude:', text.text);
        }
      }
    }
    console.log('Conversation ended');
  })();

  // Simulate user input
  queue.push('Hello! What can you help me with?');

  // Wait a bit for response, then send another message
  await sleep(3000);
  queue.push('Can you explain how async iterators work?');

  // End the conversation
  await sleep(5000);
  console.log('Closing conversation...');
  queue.close();

  await responseTask;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run if executed directly
main().catch(console.error);
