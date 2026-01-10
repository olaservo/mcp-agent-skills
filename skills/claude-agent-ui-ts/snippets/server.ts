/**
 * Express + WebSocket server with Claude Agent SDK and tool approval
 *
 * Features:
 * - WebSocket endpoint for real-time chat
 * - Tool approval flow (client must approve/reject tool calls)
 * - Configurable workingDirectory, model, allowedTools
 *
 * Usage:
 *   npm install express cors ws @anthropic-ai/claude-agent-sdk
 *   npx ts-node server.ts
 */

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import type {
  ChatMessage,
  ClientMessage,
  ServerMessage,
  ToolApprovalRequest,
} from "./types";

// ============== CONFIG ==============
// Set these before starting the server (reference claude-agent-sdk-ts skill for details)
const CONFIG = {
  port: 3001,
  workingDirectory: process.cwd(),
  model: "sonnet" as "opus" | "sonnet" | "haiku",
  allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
  systemPrompt: "You are a helpful AI assistant.",
};

// ============== TOOL APPROVAL ==============
// Pending approval requests: requestId -> { resolve, reject }
const pendingApprovals = new Map<
  string,
  { resolve: (approved: boolean) => void }
>();

// Handle tool approval response from client
function handleToolApprovalResponse(requestId: string, approved: boolean) {
  const pending = pendingApprovals.get(requestId);
  if (pending) {
    pending.resolve(approved);
    pendingApprovals.delete(requestId);
  }
}

// ============== MESSAGE QUEUE ==============
type UserMessage = { type: "user"; message: { role: "user"; content: string } };

class MessageQueue {
  private messages: UserMessage[] = [];
  private waiting: ((msg: UserMessage) => void) | null = null;
  private closed = false;

  push(content: string) {
    const msg: UserMessage = { type: "user", message: { role: "user", content } };
    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<UserMessage> {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield this.messages.shift()!;
      } else {
        yield await new Promise<UserMessage>((resolve) => {
          this.waiting = resolve;
        });
      }
    }
  }

  close() {
    this.closed = true;
  }
}

// ============== SESSION ==============
class Session {
  private queue = new MessageQueue();
  private outputIterator: AsyncIterator<unknown> | null = null;
  private subscribers = new Set<WebSocket>();
  private messages: ChatMessage[] = [];
  private isListening = false;

  constructor(private broadcast: (ws: WebSocket, msg: ServerMessage) => void) {
    // Create PreToolUse hook for tool approval
    const toolApprovalHook = {
      matcher: ".*", // Match all tools
      hooks: [
        async (input: { tool_name: string; tool_input: Record<string, unknown> }): Promise<HookJSONOutput> => {
          const requestId = crypto.randomUUID();

          // Send approval request to all subscribers
          const request: ToolApprovalRequest = {
            type: "tool_approval_request",
            requestId,
            toolName: input.tool_name,
            toolInput: input.tool_input,
          };
          for (const ws of this.subscribers) {
            this.broadcast(ws, request);
          }

          // Wait for approval (timeout after 60 seconds)
          const approved = await Promise.race([
            new Promise<boolean>((resolve) => {
              pendingApprovals.set(requestId, { resolve });
            }),
            new Promise<boolean>((resolve) =>
              setTimeout(() => resolve(false), 60000)
            ),
          ]);

          if (!approved) {
            return {
              decision: "block",
              stopReason: "Tool call rejected by user",
              continue: false,
            };
          }

          return { continue: true };
        },
      ],
    };

    // Start the SDK query with message queue and tool approval hook
    this.outputIterator = query({
      prompt: this.queue as unknown as AsyncIterable<UserMessage>,
      options: {
        maxTurns: 100,
        model: CONFIG.model,
        cwd: CONFIG.workingDirectory,
        allowedTools: CONFIG.allowedTools,
        systemPrompt: CONFIG.systemPrompt,
        hooks: {
          PreToolUse: [toolApprovalHook],
        },
      },
    })[Symbol.asyncIterator]();
  }

  subscribe(ws: WebSocket) {
    this.subscribers.add(ws);
    // Send history
    this.broadcast(ws, { type: "history", messages: this.messages });
  }

  unsubscribe(ws: WebSocket) {
    this.subscribers.delete(ws);
  }

  sendMessage(content: string) {
    // Store and broadcast user message
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    this.messages.push(userMsg);
    this.broadcastAll({ type: "user_message", content });

    // Send to agent
    this.queue.push(content);

    // Start listening if not already
    if (!this.isListening) {
      this.startListening();
    }
  }

  private async startListening() {
    if (this.isListening || !this.outputIterator) return;
    this.isListening = true;

    try {
      while (true) {
        const { value, done } = await this.outputIterator.next();
        if (done) break;
        this.handleSDKMessage(value);
      }
    } catch (error) {
      this.broadcastAll({ type: "error", error: (error as Error).message });
    }
  }

  private handleSDKMessage(message: unknown) {
    const msg = message as { type: string; message?: { content: unknown }; subtype?: string; total_cost_usd?: number; duration_ms?: number };

    if (msg.type === "assistant" && msg.message) {
      const content = msg.message.content;

      if (typeof content === "string") {
        this.addAssistantMessage(content);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text") {
            this.addAssistantMessage(block.text);
          } else if (block.type === "tool_use") {
            this.broadcastAll({
              type: "tool_use",
              toolName: block.name,
              toolId: block.id,
              toolInput: block.input,
            });
          }
        }
      }
    } else if (msg.type === "result") {
      this.broadcastAll({
        type: "result",
        success: msg.subtype === "success",
        cost: msg.total_cost_usd,
        duration: msg.duration_ms,
      });
    }
  }

  private addAssistantMessage(content: string) {
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content,
      timestamp: new Date().toISOString(),
    };
    this.messages.push(assistantMsg);
    this.broadcastAll({ type: "assistant_message", content });
  }

  private broadcastAll(msg: ServerMessage) {
    for (const ws of this.subscribers) {
      this.broadcast(ws, msg);
    }
  }

  close() {
    this.queue.close();
  }
}

// ============== SERVER ==============
const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

// Single session for simplicity (extend to Map<chatId, Session> for multi-chat)
let session: Session | null = null;

function broadcast(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

wss.on("connection", (ws) => {
  console.log("Client connected");
  broadcast(ws, { type: "connected", message: "Connected to chat server" });

  // Create session if needed
  if (!session) {
    session = new Session(broadcast);
  }
  session.subscribe(ws);

  ws.on("message", (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      if (message.type === "chat") {
        session?.sendMessage(message.content);
      } else if (message.type === "tool_approval_response") {
        handleToolApprovalResponse(message.requestId, message.approved);
      }
    } catch (error) {
      broadcast(ws, { type: "error", error: "Invalid message format" });
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    session?.unsubscribe(ws);
  });
});

server.listen(CONFIG.port, () => {
  console.log(`Server running at http://localhost:${CONFIG.port}`);
  console.log(`WebSocket endpoint: ws://localhost:${CONFIG.port}/ws`);
});
