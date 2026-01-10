/**
 * Claude Agent SDK - V1 Query with Message Queue
 *
 * Use AsyncIterable<SDKUserMessage> for multi-turn conversations in V1.
 * This pattern enables interactive chat with the V1 API.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

// Type for user messages
type SDKUserMessage = {
  type: 'user';
  message: {
    role: 'user';
    content: string;
  };
};

/**
 * Message queue that implements AsyncIterable for feeding messages to query()
 */
class MessageQueue {
  private messages: SDKUserMessage[] = [];
  private waiting: ((msg: SDKUserMessage) => void) | null = null;
  private closed = false;

  /**
   * Add a message to the queue
   */
  push(content: string) {
    const msg: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content },
    };

    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  /**
   * Async iterator implementation
   */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<SDKUserMessage> {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield this.messages.shift()!;
      } else {
        yield await new Promise<SDKUserMessage>((resolve) => {
          this.waiting = resolve;
        });
      }
    }
  }

  /**
   * Close the queue (stops iteration)
   */
  close() {
    this.closed = true;
    // Resolve any waiting promise with a dummy message to unblock
    if (this.waiting) {
      this.waiting({
        type: 'user',
        message: { role: 'user', content: '' },
      });
    }
  }
}

async function main() {
  const queue = new MessageQueue();

  // Start query with the queue as input
  const q = query({
    prompt: queue as any, // Cast needed for AsyncIterable
    options: {
      model: 'sonnet',
      maxTurns: 100,
      allowedTools: ['Read', 'Write', 'Bash'],
    },
  });

  // Send first message
  queue.push('Hello! What can you help me with?');

  // Process responses in background
  const responsePromise = (async () => {
    for await (const message of q) {
      if (message.type === 'assistant' && message.message) {
        const text = message.message.content.find(
          (c: any): c is { type: 'text'; text: string } => c.type === 'text'
        );
        if (text) {
          console.log('Claude:', text.text);
        }
      }
    }
  })();

  // Simulate user sending more messages
  await sleep(2000);
  queue.push('Can you explain what TypeScript is?');

  await sleep(5000);
  queue.push('Thanks! Goodbye.');

  await sleep(2000);
  queue.close();

  await responsePromise;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
