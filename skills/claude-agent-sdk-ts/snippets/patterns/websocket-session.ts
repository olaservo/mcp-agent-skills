/**
 * Claude Agent SDK - WebSocket Session Integration
 *
 * WebSocket server pattern for real-time chat applications.
 * Each client gets their own SDK session.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { WebSocketServer, WebSocket } from 'ws';
import { unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk';

/**
 * Message types for client-server communication
 */
interface ClientMessage {
  type: 'message' | 'close';
  content?: string;
}

interface ServerMessage {
  type: 'text' | 'tool_call' | 'error' | 'done' | 'cost';
  content?: string;
  tool?: string;
  cost?: number;
}

/**
 * Session wrapper for a WebSocket connection
 */
class WSSession {
  private ws: WebSocket;
  private session: Awaited<ReturnType<typeof unstable_v2_createSession>> | null = null;
  private active = false;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.setupHandlers();
  }

  private setupHandlers() {
    this.ws.on('message', async (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        await this.handleMessage(message);
      } catch (error) {
        this.send({ type: 'error', content: 'Invalid message format' });
      }
    });

    this.ws.on('close', () => {
      this.cleanup();
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.cleanup();
    });
  }

  private async handleMessage(message: ClientMessage) {
    switch (message.type) {
      case 'message':
        if (message.content) {
          await this.processUserMessage(message.content);
        }
        break;

      case 'close':
        this.cleanup();
        break;
    }
  }

  private async processUserMessage(content: string) {
    if (this.active) {
      this.send({ type: 'error', content: 'Previous message still processing' });
      return;
    }

    this.active = true;

    try {
      // Create session if needed
      if (!this.session) {
        this.session = unstable_v2_createSession({ model: 'sonnet' });
      }

      // Send message to Claude
      await this.session.send(content);

      // Stream responses
      for await (const msg of this.session.stream()) {
        if (msg.type === 'assistant' && msg.message) {
          for (const block of msg.message.content) {
            if (block.type === 'text' && 'text' in block) {
              this.send({ type: 'text', content: block.text });
            }
            if (block.type === 'tool_use' && 'name' in block) {
              this.send({ type: 'tool_call', tool: block.name });
            }
          }
        }

        if (msg.type === 'result' && msg.subtype === 'success') {
          this.send({ type: 'cost', cost: msg.total_cost_usd });
        }
      }

      this.send({ type: 'done' });
    } catch (error: any) {
      this.send({ type: 'error', content: error.message });
    } finally {
      this.active = false;
    }
  }

  private send(message: ServerMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private async cleanup() {
    if (this.session) {
      try {
        await this.session[Symbol.asyncDispose]();
      } catch {
        // Ignore cleanup errors
      }
      this.session = null;
    }
  }
}

/**
 * WebSocket server for Claude sessions
 */
export class ClaudeWebSocketServer {
  private wss: WebSocketServer;
  private sessions: Map<WebSocket, WSSession> = new Map();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      console.log('Client connected');
      const session = new WSSession(ws);
      this.sessions.set(ws, session);

      ws.on('close', () => {
        console.log('Client disconnected');
        this.sessions.delete(ws);
      });
    });

    console.log(`WebSocket server running on ws://localhost:${port}`);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: ServerMessage) {
    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * Get number of connected clients
   */
  get clientCount(): number {
    return this.sessions.size;
  }

  /**
   * Close the server
   */
  close() {
    this.wss.close();
  }
}

/**
 * Simple client example (for testing)
 */
export function createTestClient(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    ws.on('open', () => {
      console.log('Connected to server');

      // Send a message
      ws.send(JSON.stringify({ type: 'message', content: 'Hello! Introduce yourself.' }));
    });

    ws.on('message', (data) => {
      const msg: ServerMessage = JSON.parse(data.toString());

      switch (msg.type) {
        case 'text':
          console.log('Claude:', msg.content);
          break;
        case 'tool_call':
          console.log(`[Tool] ${msg.tool}`);
          break;
        case 'cost':
          console.log(`Cost: $${msg.cost?.toFixed(4)}`);
          break;
        case 'done':
          console.log('--- Response complete ---');
          ws.close();
          resolve();
          break;
        case 'error':
          console.error('Error:', msg.content);
          break;
      }
    });

    ws.on('error', reject);
  });
}

/**
 * Main entry point
 */
async function main() {
  const PORT = 8080;

  // Start server
  const server = new ClaudeWebSocketServer(PORT);

  // Keep running
  console.log('Press Ctrl+C to stop');

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
  });
}

// Run if executed directly
main().catch(console.error);

/**
 * Client-side usage (browser or Node.js):
 *
 * const ws = new WebSocket('ws://localhost:8080');
 *
 * ws.onopen = () => {
 *   ws.send(JSON.stringify({ type: 'message', content: 'Hello!' }));
 * };
 *
 * ws.onmessage = (event) => {
 *   const msg = JSON.parse(event.data);
 *   if (msg.type === 'text') {
 *     console.log(msg.content);
 *   }
 * };
 */
