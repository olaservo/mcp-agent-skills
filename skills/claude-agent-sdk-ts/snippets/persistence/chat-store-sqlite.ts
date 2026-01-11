/**
 * Claude Agent SDK - SQLite Chat Store
 *
 * Persistent chat storage using SQLite with better-sqlite3.
 * Stores chats, messages, and SDK session IDs for session resume.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 *
 * Install dependencies:
 *   npm install better-sqlite3
 *   npm install -D @types/better-sqlite3
 */

import Database from 'better-sqlite3';
import * as crypto from 'crypto';

/**
 * Chat metadata
 */
export interface Chat {
  id: string;
  title: string;
  sdkSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: string | null; // JSON string of tool call data
  timestamp: string;
}

/**
 * SQLite-based chat store
 */
export class ChatStore {
  private db: Database.Database;

  constructor(dbPath: string = './chats.db') {
    this.db = new Database(dbPath);
    this.initialize();
  }

  /**
   * Create tables if they don't exist
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        sdk_session_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    `);
  }

  /**
   * Create a new chat
   */
  createChat(title?: string): Chat {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const chatTitle = title || `Chat ${now.slice(0, 10)}`;

    this.db
      .prepare(
        `INSERT INTO chats (id, title, sdk_session_id, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?)`
      )
      .run(id, chatTitle, now, now);

    return {
      id,
      title: chatTitle,
      sdkSessionId: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get a chat by ID
   */
  getChat(chatId: string): Chat | null {
    const row = this.db
      .prepare('SELECT * FROM chats WHERE id = ?')
      .get(chatId) as any;

    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      sdkSessionId: row.sdk_session_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * List all chats, most recent first
   */
  listChats(): Chat[] {
    const rows = this.db
      .prepare('SELECT * FROM chats ORDER BY updated_at DESC')
      .all() as any[];

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      sdkSessionId: row.sdk_session_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Update the SDK session ID for a chat (for session resume)
   */
  updateSessionId(chatId: string, sdkSessionId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE chats SET sdk_session_id = ?, updated_at = ? WHERE id = ?`
      )
      .run(sdkSessionId, now, chatId);
  }

  /**
   * Update chat title
   */
  updateTitle(chatId: string, title: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE chats SET title = ?, updated_at = ? WHERE id = ?`)
      .run(title, now, chatId);
  }

  /**
   * Save a message to a chat
   */
  saveMessage(
    chatId: string,
    role: 'user' | 'assistant',
    content: string,
    toolCalls?: unknown[]
  ): ChatMessage {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const toolCallsJson = toolCalls ? JSON.stringify(toolCalls) : null;

    this.db
      .prepare(
        `INSERT INTO messages (id, chat_id, role, content, tool_calls, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, chatId, role, content, toolCallsJson, timestamp);

    // Update chat's updated_at
    this.db
      .prepare(`UPDATE chats SET updated_at = ? WHERE id = ?`)
      .run(timestamp, chatId);

    return {
      id,
      chatId,
      role,
      content,
      toolCalls: toolCallsJson,
      timestamp,
    };
  }

  /**
   * Get all messages for a chat
   */
  getMessages(chatId: string): ChatMessage[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC'
      )
      .all(chatId) as any[];

    return rows.map((row) => ({
      id: row.id,
      chatId: row.chat_id,
      role: row.role,
      content: row.content,
      toolCalls: row.tool_calls,
      timestamp: row.timestamp,
    }));
  }

  /**
   * Delete a chat and all its messages
   */
  deleteChat(chatId: string): void {
    this.db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId);
    this.db.prepare('DELETE FROM chats WHERE id = ?').run(chatId);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Example: Using ChatStore with Claude Agent SDK
 */
async function example() {
  const { unstable_v2_createSession, unstable_v2_resumeSession } = await import(
    '@anthropic-ai/claude-agent-sdk'
  );

  const store = new ChatStore('./my-chats.db');

  // Create a new chat
  const chat = store.createChat('My First Chat');
  console.log(`Created chat: ${chat.id}`);

  // Create SDK session
  await using session = unstable_v2_createSession({ model: 'sonnet' });

  // Send a message
  const userMessage = 'Hello! What is 2 + 2?';
  store.saveMessage(chat.id, 'user', userMessage);

  await session.send(userMessage);

  let assistantContent = '';
  const toolCalls: unknown[] = [];

  for await (const msg of session.stream()) {
    // Capture session ID for resume
    if (msg.type === 'system' && msg.subtype === 'init') {
      store.updateSessionId(chat.id, msg.session_id!);
    }

    // Collect assistant response
    if (msg.type === 'assistant' && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && 'text' in block) {
          assistantContent += block.text;
        }
        if (block.type === 'tool_use') {
          toolCalls.push(block);
        }
      }
    }
  }

  // Save assistant response
  store.saveMessage(
    chat.id,
    'assistant',
    assistantContent,
    toolCalls.length > 0 ? toolCalls : undefined
  );

  console.log(`Assistant: ${assistantContent}`);

  // Later: Resume the conversation
  const savedChat = store.getChat(chat.id);
  if (savedChat?.sdkSessionId) {
    await using resumedSession = unstable_v2_resumeSession(
      savedChat.sdkSessionId,
      { model: 'sonnet' }
    );
    console.log('Session resumed!');
  }

  store.close();
}

// Run example if executed directly
// example().catch(console.error);
