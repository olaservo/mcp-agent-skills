---
name: claude-agent-ui-ts
description: Add a React + WebSocket UI on top of Claude Agent SDK agents with tool approval and SQLite persistence
---

# Claude Agent UI (TypeScript)

Add a web UI to your Claude Agent SDK agents. Includes real-time WebSocket communication, interactive tool approval, and SQLite persistence for chat history.

## Prerequisites

- Node.js 18+
- Claude Agent SDK configured (see **claude-agent-sdk-ts** skill for setup)

## Quick Start

1. Copy the 3 snippet files to your project
2. Install dependencies:
   ```bash
   npm install express cors ws @anthropic-ai/claude-agent-sdk better-sqlite3 react react-dom
   npm install -D @types/better-sqlite3
   ```
3. Edit `server.ts` CONFIG section (workingDirectory, model, allowedTools, dbPath)
4. Start server: `npx ts-node server.ts`
5. Add `client.tsx` to your React app and open in browser

## Architecture

```
React Client ◄──WebSocket──► Express Server ◄──SDK──► Claude Agent
(client.tsx)                 (server.ts)
                                   │
                                   ▼
                              SQLite DB
                              (chat.db)
```

**Flow:**
1. User types message in React UI
2. Message sent via WebSocket to server
3. Server persists message to SQLite and forwards to Claude Agent SDK
4. When agent wants to use a tool, server sends approval request to client
5. User approves or rejects in UI
6. Server continues or blocks tool based on response
7. Agent responses persisted to SQLite and streamed back to UI

## Snippets

| Snippet | Description |
|---------|-------------|
| `server.ts` | Express + WebSocket + SQLite server with SDK integration and tool approval |
| `client.tsx` | React chat UI with WebSocket and tool approval buttons |
| `types.ts` | Shared TypeScript types for messages |

## Configuration

Edit the CONFIG object in `server.ts`:

```typescript
const CONFIG = {
  port: 3001,
  workingDirectory: process.cwd(),  // Scope file operations
  model: "sonnet",                  // opus, sonnet, or haiku
  allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
  systemPrompt: "You are a helpful AI assistant.",
  dbPath: "./chat.db",              // SQLite database path
};
```

See **claude-agent-sdk-ts** skill for detailed configuration options.

## Persistence

The server uses SQLite (via better-sqlite3) to persist:

- **Chat messages**: All user, assistant, and tool_use messages
- **SDK session ID**: Captured from `system/init` message for session resumption

**Database schema:**
```sql
-- Sessions: stores SDK session ID for multi-turn resumption
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  sdk_session_id TEXT,
  created_at TEXT,
  updated_at TEXT
);

-- Messages: stores all chat messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  role TEXT,        -- 'user' | 'assistant' | 'tool_use'
  content TEXT,
  tool_name TEXT,   -- for tool_use messages
  tool_input TEXT,  -- JSON string for tool_use messages
  timestamp TEXT
);
```

**Session Resumption:**
When the server restarts, it:
1. Loads existing messages from SQLite
2. Retrieves the stored SDK session ID
3. Passes `resume: sdkSessionId` to the SDK query options
4. Claude resumes with full conversation context

This follows the SDK best practice of capturing `session_id` from the `system/init` message and using `resume` for multi-turn conversations.

## Styling

The client has no styling (functional HTML only). Options:

- Add your own CSS
- Use Tailwind CSS
- Look for frontend/UX design helper skills

## Production Notes

For production deployment, consider:

- **Authentication**: Add user auth (not included)
- **Multi-chat**: Extend from single session to `Map<chatId, Session>` for multiple conversations
- **Containerization**: Isolate SDK in separate container for security
- **Backup**: Add SQLite backup strategy (WAL mode already enabled for durability)
- **Error handling**: Add retry logic and graceful degradation

## Related Skills

| Skill | Use When |
|-------|----------|
| **claude-agent-sdk-ts** | SDK API details, tools, hooks, configuration |
| Frontend/UX design skills | Adding styling and better UI patterns |
