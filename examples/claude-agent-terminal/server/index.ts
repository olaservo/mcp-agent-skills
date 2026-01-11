/**
 * Express + WebSocket server with Claude Agent SDK, tool approval, and SQLite persistence
 *
 * Features:
 * - WebSocket endpoint for real-time chat
 * - Tool approval flow (client must approve/reject tool calls)
 * - SQLite persistence for chat history and SDK session resumption
 * - Configurable workingDirectory, model, allowedTools
 *
 * Usage:
 *   npm install express cors ws @anthropic-ai/claude-agent-sdk better-sqlite3
 *   npm install -D @types/better-sqlite3 @types/express @types/cors @types/ws tsx
 *   npx tsx server/index.ts
 */

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { HookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import Database from "better-sqlite3";
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
  dbPath: "./chat.db", // SQLite database path
};

// ============== DATABASE ==============
class ChatDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL"); // Better concurrency
    this.init();
  }

  private init() {
    // Sessions table: stores SDK session ID for resumption
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        sdk_session_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages table: stores chat messages
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_name TEXT,
        tool_input TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);
  }

  // Session methods
  createSession(id: string): void {
    this.db.prepare("INSERT OR IGNORE INTO sessions (id) VALUES (?)").run(id);
  }

  getSdkSessionId(sessionId: string): string | null {
    const row = this.db
      .prepare("SELECT sdk_session_id FROM sessions WHERE id = ?")
      .get(sessionId) as { sdk_session_id: string | null } | undefined;
    return row?.sdk_session_id ?? null;
  }

  setSdkSessionId(sessionId: string, sdkSessionId: string): void {
    this.db
      .prepare("UPDATE sessions SET sdk_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(sdkSessionId, sessionId);
  }

  // Message methods
  addMessage(sessionId: string, message: ChatMessage): void {
    this.db
      .prepare(`
        INSERT INTO messages (id, session_id, role, content, tool_name, tool_input, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        message.id,
        sessionId,
        message.role,
        message.content,
        message.toolName ?? null,
        message.toolInput ? JSON.stringify(message.toolInput) : null,
        message.timestamp
      );
  }

  getMessages(sessionId: string): ChatMessage[] {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp")
      .all(sessionId) as Array<{
        id: string;
        role: string;
        content: string;
        tool_name: string | null;
        tool_input: string | null;
        timestamp: string;
      }>;

    return rows.map((row) => ({
      id: row.id,
      role: row.role as ChatMessage["role"],
      content: row.content,
      timestamp: row.timestamp,
      toolName: row.tool_name ?? undefined,
      toolInput: row.tool_input ? JSON.parse(row.tool_input) : undefined,
    }));
  }

  close(): void {
    this.db.close();
  }
}

// Initialize database
const db = new ChatDatabase(CONFIG.dbPath);

// ============== TOOL APPROVAL ==============
const pendingApprovals = new Map<string, { resolve: (approved: boolean) => void }>();

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
  public readonly id: string;
  private queue = new MessageQueue();
  private outputIterator: AsyncIterator<unknown> | null = null;
  private subscribers = new Set<WebSocket>();
  private messages: ChatMessage[] = [];
  private isListening = false;
  private sdkSessionId: string | null = null;
  // Track pending tool IDs: key is `${tool_name}:${JSON.stringify(tool_input)}`, value is tool_id
  private pendingToolIds = new Map<string, string>();

  constructor(
    id: string,
    private broadcast: (ws: WebSocket, msg: ServerMessage) => void
  ) {
    this.id = id;

    // Create session in DB and load existing messages
    db.createSession(id);
    this.messages = db.getMessages(id);
    this.sdkSessionId = db.getSdkSessionId(id);

    // Create PreToolUse hook for tool approval
    const toolApprovalHook = {
      matcher: ".*",
      hooks: [
        async (input: { tool_name: string; tool_input: Record<string, unknown> }): Promise<HookJSONOutput> => {
          const requestId = crypto.randomUUID();

          // Look up the toolId from our tracking map
          const toolKey = `${input.tool_name}:${JSON.stringify(input.tool_input)}`;
          const toolId = this.pendingToolIds.get(toolKey) || requestId; // fallback to requestId if not found
          this.pendingToolIds.delete(toolKey); // Clean up

          const request: ToolApprovalRequest = {
            type: "tool_approval_request",
            requestId,
            toolId,
            toolName: input.tool_name,
            toolInput: input.tool_input,
          };
          for (const ws of this.subscribers) {
            this.broadcast(ws, request);
          }

          const approved = await Promise.race([
            new Promise<boolean>((resolve) => {
              pendingApprovals.set(requestId, { resolve });
            }),
            new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 60000)),
          ]);

          if (!approved) {
            return { decision: "block", stopReason: "Tool call rejected by user", continue: false };
          }
          return { continue: true };
        },
      ],
    };

    // Build query options - use resume if we have an SDK session ID
    const queryOptions: Record<string, unknown> = {
      maxTurns: 100,
      model: CONFIG.model,
      cwd: CONFIG.workingDirectory,
      allowedTools: CONFIG.allowedTools,
      systemPrompt: CONFIG.systemPrompt,
      hooks: { PreToolUse: [toolApprovalHook] },
    };

    // Resume existing SDK session if available (enables multi-turn context)
    if (this.sdkSessionId) {
      queryOptions.resume = this.sdkSessionId;
      console.log(`Resuming SDK session: ${this.sdkSessionId}`);
    }

    this.outputIterator = query({
      prompt: this.queue as unknown as AsyncIterable<UserMessage>,
      options: queryOptions,
    })[Symbol.asyncIterator]();
  }

  subscribe(ws: WebSocket) {
    this.subscribers.add(ws);
    this.broadcast(ws, { type: "history", messages: this.messages });
  }

  unsubscribe(ws: WebSocket) {
    this.subscribers.delete(ws);
  }

  sendMessage(content: string) {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };
    this.messages.push(userMsg);
    db.addMessage(this.id, userMsg); // Persist to DB
    this.broadcastAll({ type: "user_message", content });

    this.queue.push(content);

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
    const msg = message as {
      type: string;
      subtype?: string;
      session_id?: string;
      message?: { content: unknown };
      total_cost_usd?: number;
      duration_ms?: number;
    };

    // Capture SDK session ID from init message (critical for resumption)
    if (msg.type === "system" && msg.subtype === "init" && msg.session_id) {
      this.sdkSessionId = msg.session_id;
      db.setSdkSessionId(this.id, msg.session_id);
      console.log(`Captured SDK session ID: ${msg.session_id}`);
    }

    if (msg.type === "assistant" && msg.message) {
      const content = msg.message.content;

      if (typeof content === "string") {
        this.addAssistantMessage(content);
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text") {
            this.addAssistantMessage(block.text);
          } else if (block.type === "tool_use") {
            // Track the toolId for the upcoming PreToolUse hook
            const toolKey = `${block.name}:${JSON.stringify(block.input)}`;
            this.pendingToolIds.set(toolKey, block.id);

            // Store tool use in messages for history
            const toolMsg: ChatMessage = {
              id: block.id,
              role: "tool_use",
              content: "",
              timestamp: new Date().toISOString(),
              toolName: block.name,
              toolInput: block.input,
            };
            this.messages.push(toolMsg);
            db.addMessage(this.id, toolMsg);

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
    db.addMessage(this.id, assistantMsg); // Persist to DB
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

// Session management (single session for simplicity - extend to Map for multi-chat)
const SESSION_ID = "default"; // Use fixed ID for single-session mode
let session: Session | null = null;

function broadcast(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

wss.on("connection", (ws) => {
  console.log("Client connected");
  broadcast(ws, { type: "connected", message: "Connected to chat server" });

  // Create or reuse session (with persistence)
  if (!session) {
    session = new Session(SESSION_ID, broadcast);
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

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  db.close();
  process.exit(0);
});

server.listen(CONFIG.port, () => {
  console.log(`Server running at http://localhost:${CONFIG.port}`);
  console.log(`WebSocket endpoint: ws://localhost:${CONFIG.port}/ws`);
  console.log(`Database: ${CONFIG.dbPath}`);
});
