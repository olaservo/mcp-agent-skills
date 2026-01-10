---
name: claude-agent-ui-ts
description: Add a React + WebSocket UI on top of Claude Agent SDK agents with tool approval support
---

# Claude Agent UI (TypeScript)

Add a web UI to your Claude Agent SDK agents. Includes real-time WebSocket communication and interactive tool approval.

## Prerequisites

- Node.js 18+
- Claude Agent SDK configured (see **claude-agent-sdk-ts** skill for setup)

## Quick Start

1. Copy the 3 snippet files to your project
2. Install dependencies:
   ```bash
   npm install express cors ws @anthropic-ai/claude-agent-sdk react react-dom
   ```
3. Edit `server.ts` CONFIG section (workingDirectory, model, allowedTools)
4. Start server: `npx ts-node server.ts`
5. Add `client.tsx` to your React app and open in browser

## Architecture

```
React Client ◄──WebSocket──► Express Server ◄──SDK──► Claude Agent
(client.tsx)                 (server.ts)
```

**Flow:**
1. User types message in React UI
2. Message sent via WebSocket to server
3. Server forwards to Claude Agent SDK
4. When agent wants to use a tool, server sends approval request to client
5. User approves or rejects in UI
6. Server continues or blocks tool based on response
7. Agent responses streamed back to UI in real-time

## Snippets

| Snippet | Description |
|---------|-------------|
| `server.ts` | Express + WebSocket server with SDK integration and tool approval |
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
};
```

See **claude-agent-sdk-ts** skill for detailed configuration options.

## Styling

The client has no styling (functional HTML only). Options:

- Add your own CSS
- Use Tailwind CSS
- Look for frontend/UX design helper skills

## Production Notes

For production deployment, consider:

- **Authentication**: Add user auth (not included)
- **Persistence**: Replace in-memory storage with a database
- **Containerization**: Isolate SDK in separate container for security
- **Error handling**: Add retry logic and graceful degradation

## Related Skills

| Skill | Use When |
|-------|----------|
| **claude-agent-sdk-ts** | SDK API details, tools, hooks, configuration |
| Frontend/UX design skills | Adding styling and better UI patterns |
