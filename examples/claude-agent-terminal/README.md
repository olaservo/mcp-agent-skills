# Claude Agent Terminal

A terminal-style chat UI for Claude Agent SDK.

## Features

- Dark monospace theme (VS Code-inspired)
- Input history with arrow key navigation
- Tool call blocks with approval UI
- WebSocket real-time communication
- SQLite persistence for chat history

## Prerequisites

- Node.js 18+
- Access to `@anthropic-ai/claude-agent-sdk` (required for server)

## Quick Start

1. Install the Claude Agent SDK (see claude-agent-sdk-ts skill for setup):
   ```bash
   npm install @anthropic-ai/claude-agent-sdk
   ```

2. Install other dependencies:
   ```bash
   npm install
   ```

3. Start the server (in one terminal):
   ```bash
   npm run server
   ```

4. Start the client (in another terminal):
   ```bash
   npm run dev
   ```

5. Open http://localhost:5173 in your browser

## Configuration

Edit `server/index.ts` CONFIG section:

```typescript
const CONFIG = {
  port: 3001,
  workingDirectory: process.cwd(),
  model: "sonnet",  // opus, sonnet, or haiku
  allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep"],
  systemPrompt: "You are a helpful AI assistant.",
  dbPath: "./chat.db",
};
```

## Architecture

```
React Client (Vite)      Express Server         Claude Agent SDK
     |                        |                       |
     |-- WebSocket ---------> |                       |
     |                        |-- query() ----------> |
     |<-- messages ---------- |                       |
     |                        |<-- SDK messages ----- |
     |                        |                       |
     |<-- tool_approval_req --|                       |
     |-- approve/reject ----> |                       |
     |                        |-- continue/block ---> |
```

## Keyboard Shortcuts

- **Enter**: Send message
- **Shift+Enter**: New line
- **Arrow Up**: Previous message in history
- **Arrow Down**: Next message in history
