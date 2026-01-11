/**
 * Claude Agent SDK - WebSocket Chat Session
 *
 * Complete WebSocket server integrating:
 * - Chat persistence (JSONL)
 * - Tool approval workflow
 * - Tool history streaming
 * - Session resume
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { WebSocketServer, WebSocket } from 'ws';
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
} from '@anthropic-ai/claude-agent-sdk';
import type { HookJSONOutput } from '@anthropic-ai/claude-agent-sdk';
import { JsonlChatStore } from '../persistence/chat-store-jsonl';
import {
  ApprovalManager,
  type ApprovalRequest,
  type ApprovalDecision,
} from './tool-approval-hook';
import { ToolHistoryCollector, type UIEvent } from './tool-history-stream';

/**
 * Messages from client to server
 */
interface ClientMessage {
  type:
    | 'message' // Send a chat message
    | 'create_chat' // Create new chat
    | 'load_chat' // Load existing chat
    | 'list_chats' // Get all chats
    | 'approval_decision'; // Approve/reject a tool
  content?: string;
  chatId?: string;
  title?: string;
  decision?: ApprovalDecision;
}

/**
 * Messages from server to client
 */
interface ServerMessage {
  type:
    | 'text' // Text content from Claude
    | 'tool_use' // Tool being called
    | 'tool_result' // Tool result
    | 'approval_request' // Approval needed
    | 'error' // Error occurred
    | 'done' // Message complete
    | 'chat_created' // New chat created
    | 'chat_loaded' // Chat loaded with history
    | 'chat_list' // List of chats
    | 'cost'; // Cost info
  content?: string;
  chatId?: string;
  chats?: Array<{ id: string; title: string; updatedAt: string }>;
  messages?: Array<{ role: string; content: string; timestamp: string }>;
  event?: UIEvent;
  approval?: ApprovalRequest;
  cost?: number;
}

/**
 * Chat session with persistence and tool approval
 */
class ChatSession {
  private ws: WebSocket;
  private store: JsonlChatStore;
  private approvalManager: ApprovalManager;
  private toolCollector: ToolHistoryCollector;
  private session: Awaited<ReturnType<typeof unstable_v2_createSession>> | null =
    null;
  private currentChatId: string | null = null;
  private processing = false;

  constructor(ws: WebSocket, store: JsonlChatStore) {
    this.ws = ws;
    this.store = store;
    this.approvalManager = new ApprovalManager(60000); // 60s timeout
    this.toolCollector = new ToolHistoryCollector();

    this.setupApprovalEvents();
    this.setupMessageHandler();
  }

  private setupApprovalEvents(): void {
    this.approvalManager.on('approval_needed', (request: ApprovalRequest) => {
      this.send({
        type: 'approval_request',
        approval: request,
      });
    });

    this.approvalManager.on('timeout', (request: ApprovalRequest) => {
      this.send({
        type: 'error',
        content: `Approval timed out for ${request.toolName}`,
      });
    });
  }

  private setupMessageHandler(): void {
    this.ws.on('message', async (data) => {
      try {
        const message: ClientMessage = JSON.parse(data.toString());
        await this.handleMessage(message);
      } catch (error) {
        this.send({ type: 'error', content: 'Invalid message format' });
      }
    });

    this.ws.on('close', () => this.cleanup());
    this.ws.on('error', () => this.cleanup());
  }

  private async handleMessage(message: ClientMessage): Promise<void> {
    switch (message.type) {
      case 'create_chat':
        this.handleCreateChat(message.title);
        break;

      case 'load_chat':
        if (message.chatId) {
          await this.handleLoadChat(message.chatId);
        }
        break;

      case 'list_chats':
        this.handleListChats();
        break;

      case 'message':
        if (message.content) {
          await this.handleUserMessage(message.content);
        }
        break;

      case 'approval_decision':
        if (message.decision) {
          this.approvalManager.resolveApproval(message.decision);
        }
        break;
    }
  }

  private handleCreateChat(title?: string): void {
    const chat = this.store.createChat(title);
    this.currentChatId = chat.id;
    this.toolCollector.clear();

    this.send({
      type: 'chat_created',
      chatId: chat.id,
      content: chat.title,
    });
  }

  private async handleLoadChat(chatId: string): Promise<void> {
    const chat = this.store.getChat(chatId);
    if (!chat) {
      this.send({ type: 'error', content: 'Chat not found' });
      return;
    }

    this.currentChatId = chatId;
    this.toolCollector.clear();

    const messages = this.store.readMessages(chatId);

    // Try to resume SDK session if available
    if (chat.sdkSessionId) {
      try {
        this.session = unstable_v2_resumeSession(chat.sdkSessionId, {
          model: 'sonnet',
        });
      } catch {
        // Session expired, will create new one on next message
        this.session = null;
      }
    }

    this.send({
      type: 'chat_loaded',
      chatId: chat.id,
      content: chat.title,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
    });
  }

  private handleListChats(): void {
    const chats = this.store.listChats();

    this.send({
      type: 'chat_list',
      chats: chats.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
      })),
    });
  }

  private async handleUserMessage(content: string): Promise<void> {
    if (this.processing) {
      this.send({ type: 'error', content: 'Already processing a message' });
      return;
    }

    if (!this.currentChatId) {
      // Auto-create chat if none selected
      const chat = this.store.createChat();
      this.currentChatId = chat.id;
    }

    this.processing = true;

    try {
      // Save user message
      this.store.appendMessage(this.currentChatId, 'user', content);

      // Create session if needed
      if (!this.session) {
        this.session = unstable_v2_createSession({
          model: 'sonnet',
          cwd: process.cwd(),
          hooks: {
            PreToolUse: [this.approvalManager.createHook()],
          },
        });
      }

      await this.session.send(content);

      let assistantContent = '';
      const toolCalls: unknown[] = [];

      for await (const msg of this.session.stream()) {
        // Capture session ID
        if (msg.type === 'system' && msg.subtype === 'init') {
          this.store.updateSessionId(this.currentChatId!, msg.session_id!);
        }

        // Extract and send tool events
        const events = this.toolCollector.process(msg);
        for (const event of events) {
          if (event.type === 'tool_use') {
            this.send({ type: 'tool_use', event });
          } else if (event.type === 'tool_result') {
            this.send({ type: 'tool_result', event });
          } else if (event.type === 'text') {
            this.send({ type: 'text', content: event.content });
            assistantContent += event.content;
          }
        }

        // Track tool calls for persistence
        if (msg.type === 'assistant' && msg.message) {
          for (const block of msg.message.content) {
            if (block.type === 'tool_use') {
              toolCalls.push(block);
            }
          }
        }

        // Send cost info
        if (msg.type === 'result' && msg.subtype === 'success') {
          this.send({ type: 'cost', cost: msg.total_cost_usd });
        }
      }

      // Save assistant response
      if (assistantContent || toolCalls.length > 0) {
        this.store.appendMessage(
          this.currentChatId!,
          'assistant',
          assistantContent,
          toolCalls.length > 0 ? toolCalls : undefined
        );
      }

      this.send({ type: 'done' });
    } catch (error: any) {
      this.send({ type: 'error', content: error.message });
    } finally {
      this.processing = false;
    }
  }

  private send(message: ServerMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private async cleanup(): Promise<void> {
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
 * WebSocket server for Claude chat sessions
 */
export class ClaudeChatServer {
  private wss: WebSocketServer;
  private store: JsonlChatStore;
  private currentSession: ChatSession | null = null;

  constructor(port: number, chatsDir: string = './chats') {
    this.store = new JsonlChatStore(chatsDir);
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws) => {
      console.log('Client connected');

      // Single user - replace any existing session
      if (this.currentSession) {
        console.log('Replacing existing session');
      }

      this.currentSession = new ChatSession(ws, this.store);

      ws.on('close', () => {
        console.log('Client disconnected');
        this.currentSession = null;
      });
    });

    console.log(`Chat server running on ws://localhost:${port}`);
  }

  close(): void {
    this.wss.close();
  }
}

/**
 * Main entry point
 */
async function main() {
  const PORT = 8080;

  const server = new ClaudeChatServer(PORT, './my-chats');

  console.log('Press Ctrl+C to stop');

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
  });
}

// Run if executed directly
// main().catch(console.error);

/**
 * Client-side usage example:
 *
 * const ws = new WebSocket('ws://localhost:8080');
 *
 * // Create a new chat
 * ws.send(JSON.stringify({ type: 'create_chat', title: 'My Chat' }));
 *
 * // Send a message
 * ws.send(JSON.stringify({ type: 'message', content: 'Hello!' }));
 *
 * // Handle responses
 * ws.onmessage = (event) => {
 *   const msg = JSON.parse(event.data);
 *
 *   switch (msg.type) {
 *     case 'text':
 *       console.log('Claude:', msg.content);
 *       break;
 *
 *     case 'tool_use':
 *       console.log('Tool:', msg.event.toolName, msg.event.displayText);
 *       break;
 *
 *     case 'approval_request':
 *       // Show approval UI, then send decision:
 *       ws.send(JSON.stringify({
 *         type: 'approval_decision',
 *         decision: { requestId: msg.approval.requestId, approved: true }
 *       }));
 *       break;
 *
 *     case 'done':
 *       console.log('Response complete');
 *       break;
 *   }
 * };
 */
