/**
 * Claude Agent SDK - JSONL Chat Store
 *
 * File-based chat storage using JSONL (JSON Lines) format.
 * Each chat is stored as a separate .jsonl file with append-only writes.
 * Lightweight alternative to SQLite - no native dependencies.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Chat metadata stored in index
 */
export interface ChatMeta {
  id: string;
  title: string;
  sdkSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat message stored in JSONL file
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: unknown[];
  timestamp: string;
}

/**
 * Index file structure
 */
interface ChatIndex {
  chats: Record<string, ChatMeta>;
}

/**
 * JSONL-based chat store
 */
export class JsonlChatStore {
  private chatsDir: string;
  private indexPath: string;
  private index: ChatIndex;

  constructor(chatsDir: string = './chats') {
    this.chatsDir = chatsDir;
    this.indexPath = path.join(chatsDir, 'chats-index.json');
    this.index = { chats: {} };
    this.initialize();
  }

  /**
   * Create chats directory and load index
   */
  private initialize(): void {
    // Ensure chats directory exists
    if (!fs.existsSync(this.chatsDir)) {
      fs.mkdirSync(this.chatsDir, { recursive: true });
    }

    // Load or create index
    if (fs.existsSync(this.indexPath)) {
      try {
        const data = fs.readFileSync(this.indexPath, 'utf-8');
        this.index = JSON.parse(data);
      } catch {
        this.index = { chats: {} };
      }
    }
  }

  /**
   * Save the index file
   */
  private saveIndex(): void {
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2));
  }

  /**
   * Get the JSONL file path for a chat
   */
  private getChatPath(chatId: string): string {
    return path.join(this.chatsDir, `${chatId}.jsonl`);
  }

  /**
   * Create a new chat
   */
  createChat(title?: string): ChatMeta {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const chatTitle = title || `Chat ${now.slice(0, 10)}`;

    const meta: ChatMeta = {
      id,
      title: chatTitle,
      sdkSessionId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.index.chats[id] = meta;
    this.saveIndex();

    // Create empty chat file
    fs.writeFileSync(this.getChatPath(id), '');

    return meta;
  }

  /**
   * Get a chat by ID
   */
  getChat(chatId: string): ChatMeta | null {
    return this.index.chats[chatId] || null;
  }

  /**
   * List all chats, most recent first
   */
  listChats(): ChatMeta[] {
    return Object.values(this.index.chats).sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  /**
   * Update the SDK session ID for a chat
   */
  updateSessionId(chatId: string, sdkSessionId: string): void {
    const meta = this.index.chats[chatId];
    if (meta) {
      meta.sdkSessionId = sdkSessionId;
      meta.updatedAt = new Date().toISOString();
      this.saveIndex();
    }
  }

  /**
   * Update chat title
   */
  updateTitle(chatId: string, title: string): void {
    const meta = this.index.chats[chatId];
    if (meta) {
      meta.title = title;
      meta.updatedAt = new Date().toISOString();
      this.saveIndex();
    }
  }

  /**
   * Append a message to a chat (JSONL format)
   */
  appendMessage(
    chatId: string,
    role: 'user' | 'assistant',
    content: string,
    toolCalls?: unknown[]
  ): ChatMessage {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    if (toolCalls && toolCalls.length > 0) {
      message.toolCalls = toolCalls;
    }

    // Append to JSONL file
    const line = JSON.stringify(message) + '\n';
    fs.appendFileSync(this.getChatPath(chatId), line);

    // Update index timestamp
    const meta = this.index.chats[chatId];
    if (meta) {
      meta.updatedAt = message.timestamp;
      this.saveIndex();
    }

    return message;
  }

  /**
   * Read all messages from a chat
   */
  readMessages(chatId: string): ChatMessage[] {
    const chatPath = this.getChatPath(chatId);

    if (!fs.existsSync(chatPath)) {
      return [];
    }

    const content = fs.readFileSync(chatPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    return lines.map((line) => JSON.parse(line) as ChatMessage);
  }

  /**
   * Delete a chat and its messages file
   */
  deleteChat(chatId: string): void {
    const chatPath = this.getChatPath(chatId);

    if (fs.existsSync(chatPath)) {
      fs.unlinkSync(chatPath);
    }

    delete this.index.chats[chatId];
    this.saveIndex();
  }
}

/**
 * Example: Using JsonlChatStore with Claude Agent SDK
 */
async function example() {
  const { unstable_v2_createSession, unstable_v2_resumeSession } = await import(
    '@anthropic-ai/claude-agent-sdk'
  );

  const store = new JsonlChatStore('./my-chats');

  // Create a new chat
  const chat = store.createChat('JSONL Chat Example');
  console.log(`Created chat: ${chat.id}`);

  // Create SDK session
  await using session = unstable_v2_createSession({ model: 'sonnet' });

  // Send a message
  const userMessage = 'Hello! Tell me a short joke.';
  store.appendMessage(chat.id, 'user', userMessage);

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
  store.appendMessage(
    chat.id,
    'assistant',
    assistantContent,
    toolCalls.length > 0 ? toolCalls : undefined
  );

  console.log(`Assistant: ${assistantContent}`);

  // Show what's stored
  console.log('\nStored messages:');
  for (const msg of store.readMessages(chat.id)) {
    console.log(`  [${msg.role}] ${msg.content.slice(0, 50)}...`);
  }

  // Later: Resume the conversation
  const savedChat = store.getChat(chat.id);
  if (savedChat?.sdkSessionId) {
    await using resumedSession = unstable_v2_resumeSession(
      savedChat.sdkSessionId,
      { model: 'sonnet' }
    );
    console.log('\nSession resumed!');
  }
}

// Run example if executed directly
// example().catch(console.error);

/**
 * JSONL file format example (each line is valid JSON):
 *
 * {"id":"abc-123","role":"user","content":"Hello!","timestamp":"2024-01-15T10:30:00Z"}
 * {"id":"def-456","role":"assistant","content":"Hi there!","timestamp":"2024-01-15T10:30:01Z"}
 *
 * Benefits:
 * - Append-only writes (no file corruption on crash)
 * - Human-readable (one JSON object per line)
 * - Easy to stream/parse line by line
 * - No native dependencies (unlike SQLite)
 */
