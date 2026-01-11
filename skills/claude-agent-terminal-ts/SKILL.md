---
name: claude-agent-terminal-ts
description: Terminal-style React UI for Claude Agent SDK with keyboard navigation, tool approval, and dark theme
---

# Claude Agent Terminal UI

A retro terminal-inspired chat interface for Claude Agent SDK agents.

## Features

- Dark monospace theme (VS Code-inspired colors)
- Input history with arrow key navigation
- Collapsible tool call blocks with status badges
- Inline tool approval prompts (Approve/Reject)
- Auto-scroll to latest message
- SQLite persistence for chat history
- SDK session resumption across page reloads

## Prerequisites

- Node.js 18+
- Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- Claude Code authentication (`claude login`)

## Quick Start

### 1. Install Dependencies

```bash
# Server dependencies
npm install express cors ws @anthropic-ai/claude-agent-sdk better-sqlite3
npm install -D @types/better-sqlite3 @types/express @types/cors @types/ws tsx typescript

# Client dependencies
npm install react react-dom @mantine/core @mantine/hooks @tabler/icons-react
```

### 2. Copy Snippets

Copy these files from `snippets/` to your project:

```
your-project/
  src/
    types.ts      # Shared types
    server.ts     # Backend server
    client.tsx    # React component
    styles.css    # Terminal theme
```

### 3. Configure Server

Edit `server.ts` CONFIG section:

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

### 4. Start Server

```bash
npx tsx server.ts
```

### 5. Use Component

```tsx
import { TerminalChat } from './client';
import './styles.css';

function App() {
  return (
    <div style={{ height: '100vh' }}>
      <TerminalChat wsEndpoint="ws://localhost:3001/ws" />
    </div>
  );
}
```

## Architecture

```
React Client          Express Server         Claude Agent SDK
(client.tsx)          (server.ts)
     |                     |                       |
     |-- WebSocket ------> |                       |
     |                     |-- query() ----------> |
     |<-- messages ------- |                       |
     |                     |<-- SDK messages ----- |
     |                     |                       |
     |<-- tool_approval ---|                       |
     |-- approve/reject -> |                       |
     |                     |-- continue/block ---> |
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter | Send message |
| Shift+Enter | New line |
| Arrow Up | Previous message in history |
| Arrow Down | Next message in history |

## Component Props

### TerminalChat

| Prop | Type | Description |
|------|------|-------------|
| `wsEndpoint` | `string` | WebSocket server URL (e.g., `ws://localhost:3001/ws`) |

## Flexible Container

The `<TerminalChat />` component fills whatever container it's placed in:

```tsx
// Full page
<div style={{ height: '100vh' }}>
  <TerminalChat wsEndpoint="ws://localhost:3001/ws" />
</div>

// Sidebar
<div style={{ display: 'flex' }}>
  <MainContent />
  <div style={{ width: '400px', height: '100vh' }}>
    <TerminalChat wsEndpoint="ws://localhost:3001/ws" />
  </div>
</div>

// Fixed height panel
<div style={{ height: '300px' }}>
  <TerminalChat wsEndpoint="ws://localhost:3001/ws" />
</div>
```

## WebSocket Protocol

### Server to Client

| Message Type | Description |
|--------------|-------------|
| `connected` | Initial connection confirmation |
| `history` | Chat history on connect |
| `user_message` | Echo of sent message |
| `assistant_message` | Agent response text |
| `tool_use` | Tool call initiated |
| `tool_approval_request` | Awaiting user approval |
| `result` | Request completed with cost |
| `error` | Error occurred |

### Client to Server

| Message Type | Description |
|--------------|-------------|
| `chat` | User message |
| `tool_approval_response` | Approve/reject tool call |

## Customization

### Colors (in styles.css)

| Variable | Default | Usage |
|----------|---------|-------|
| Background | `#1e1e1e` | Main terminal background |
| Header | `#252526` | Header and input area |
| Text | `#d4d4d4` | Default text color |
| User text | `#9cdcfe` | User message color |
| Accent | `#569cd6` | Tool blocks, focus states |
| Success | `#6a9955` | Completed status |
| Error | `#f14c4c` | Error messages |
| Warning | `#ffcc00` | Approval prompts |

### Fonts

The component uses a monospace font stack:
```css
'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'SF Mono', 'Consolas', monospace
```

## Working Example

A complete working example is available at:
```
mcp-agent-skills/examples/claude-agent-terminal/
```

To run it:
```bash
cd examples/claude-agent-terminal
npm install
npm run server   # Terminal 1
npm run dev      # Terminal 2
# Open http://localhost:5173
```

## Related Skills

| Skill | Description |
|-------|-------------|
| `claude-agent-sdk-ts` | SDK patterns and API reference |
| `claude-agent-ui-ts` | Simpler UI alternative |
