# Claude Agent SDK API Reference

This reference covers both V1 (`query()`) and V2 (session-based) APIs for the Claude Agent SDK in TypeScript.

---

## Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

Requires Node.js 18+ and TypeScript 5.2+ (for `await using` syntax in V2).

---

## V1 API: query()

The `query()` function is the original API, ideal for script-like workflows and batch processing.

### Import

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
```

### Function Signature

```typescript
function query(params: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: QueryOptions;
}): AsyncIterable<SDKMessage>;
```

### QueryOptions

```typescript
interface QueryOptions {
  // Execution control
  maxTurns?: number;              // Max conversation turns (default: 100)
  cwd?: string;                   // Working directory for file operations

  // Model selection
  model?: 'opus' | 'sonnet' | 'haiku' | 'inherit';

  // Tool configuration
  allowedTools?: string[];        // Whitelist specific tools
  disallowedTools?: string[];     // Block specific tools
  tools?: string[] | { type: 'preset', preset: 'claude_code' };

  // Custom behavior
  systemPrompt?: string;          // Override default system prompt
  appendSystemPrompt?: string;    // Append to default system prompt

  // Settings
  settingSources?: ('user' | 'project' | 'local')[];

  // Hooks
  hooks?: {
    PreToolUse?: Hook[];
    PostToolUse?: Hook[];
  };

  // Subagents (programmatic definition)
  agents?: AgentDefinition[];

  // MCP servers
  mcpServers?: Record<string, McpServerConfig>;

  // Beta features
  betas?: string[];
}
```

### SDKMessage Types

```typescript
type SDKMessage = {
  type: 'system' | 'assistant' | 'user' | 'result';
  subtype?: string;
  message?: {
    role: string;
    content: ContentBlock[];
  };
  // For 'result' type:
  total_cost_usd?: number;
  session_id?: string;
};

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; id: string; input: any }
  | { type: 'tool_result'; tool_use_id: string; content: any };
```

### Basic Usage

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const q = query({
  prompt: 'Hello! Introduce yourself.',
  options: {
    model: 'sonnet',
    maxTurns: 10,
  },
});

for await (const message of q) {
  if (message.type === 'assistant' && message.message) {
    const text = message.message.content.find(c => c.type === 'text');
    if (text && 'text' in text) {
      console.log(text.text);
    }
  }
  if (message.type === 'result' && message.subtype === 'success') {
    console.log(`Cost: $${message.total_cost_usd?.toFixed(4)}`);
  }
}
```

---

## V2 API: Session-based

The V2 API provides session management for multi-turn conversations and persistence.

> **Note:** V2 APIs are prefixed with `unstable_v2_` and may change between SDK versions.

### Imports

```typescript
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  unstable_v2_prompt,
} from '@anthropic-ai/claude-agent-sdk';
```

### unstable_v2_createSession

Creates a new session for multi-turn conversations.

```typescript
function unstable_v2_createSession(options: SessionOptions): Session;

interface SessionOptions {
  model: 'opus' | 'sonnet' | 'haiku';
  // Additional options similar to QueryOptions
}

interface Session {
  send(message: string): Promise<void>;
  stream(): AsyncIterable<SDKMessage>;
  [Symbol.asyncDispose](): Promise<void>;
}
```

**Usage:**

```typescript
await using session = unstable_v2_createSession({ model: 'sonnet' });
await session.send('Your message');

for await (const msg of session.stream()) {
  // Process messages
}
// Session automatically disposed when block exits
```

### unstable_v2_resumeSession

Resume a previously created session.

```typescript
function unstable_v2_resumeSession(
  sessionId: string,
  options: SessionOptions
): Session;
```

**Usage:**

```typescript
// First session - save the ID
let sessionId: string;
{
  await using session = unstable_v2_createSession({ model: 'sonnet' });
  await session.send('Remember: my name is Alice');

  for await (const msg of session.stream()) {
    if (msg.type === 'system' && msg.subtype === 'init') {
      sessionId = msg.session_id!;
    }
  }
}

// Later - resume the session
{
  await using session = unstable_v2_resumeSession(sessionId, { model: 'sonnet' });
  await session.send('What is my name?');
  // Claude will remember "Alice"
}
```

### unstable_v2_prompt

One-shot convenience function for simple queries.

```typescript
async function unstable_v2_prompt(
  message: string,
  options: SessionOptions
): Promise<PromptResult>;

interface PromptResult {
  subtype: 'success' | 'error';
  result: string;
  total_cost_usd: number;
}
```

**Usage:**

```typescript
const result = await unstable_v2_prompt(
  'What is the capital of France?',
  { model: 'sonnet' }
);

if (result.subtype === 'success') {
  console.log(result.result);  // "Paris"
  console.log(`Cost: $${result.total_cost_usd.toFixed(4)}`);
}
```

---

## Tool Configuration

### Built-in Tools

The SDK provides access to Claude Code tools:

- **File Operations:** `Read`, `Write`, `Edit`, `MultiEdit`, `Glob`, `Grep`
- **Execution:** `Bash`, `BashOutput`, `KillBash`
- **Search:** `WebSearch`, `WebFetch`
- **Orchestration:** `Task` (subagents)
- **User Interaction:** `AskUserQuestion`, `TodoWrite`
- **Notebooks:** `NotebookEdit`

### Configuring Tools

**Allowlist specific tools:**
```typescript
options: {
  allowedTools: ['Read', 'Write', 'Bash'],
}
```

**Block specific tools:**
```typescript
options: {
  disallowedTools: ['WebSearch', 'WebFetch'],
}
```

**Use Claude Code preset:**
```typescript
options: {
  tools: { type: 'preset', preset: 'claude_code' },
}
```

**Disable all tools:**
```typescript
options: {
  tools: [],
}
```

### Custom MCP Server

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const customServer = createSdkMcpServer({
  name: 'my-tools',
  version: '1.0.0',
  tools: [
    tool(
      'search_database',
      'Search the database for records',
      {
        query: z.string().describe('Search query'),
        limit: z.number().optional().default(10),
      },
      async (args) => {
        const results = await db.search(args.query, args.limit);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2),
          }],
        };
      }
    ),
  ],
});

// Use in query
const q = query({
  prompt: 'Search for users named John',
  options: {
    mcpServers: { 'my-tools': customServer },
    allowedTools: ['mcp__my-tools__search_database'],
  },
});
```

---

## Hooks

Hooks intercept tool execution for validation, blocking, logging, or transformation.

### Hook Interface

```typescript
interface Hook {
  matcher: string;  // Regex pattern matching tool names
  hooks: HookFunction[];
}

type HookFunction = (input: HookInput) => Promise<HookJSONOutput>;

interface HookInput {
  tool_name: string;
  tool_input: any;
}

interface HookJSONOutput {
  continue: boolean;
  decision?: 'block' | 'allow';
  stopReason?: string;
  // For PostToolUse: can modify output
}
```

### PreToolUse Hooks

Execute before a tool runs. Can block or modify the call.

```typescript
hooks: {
  PreToolUse: [
    {
      matcher: 'Write|Edit|MultiEdit',
      hooks: [
        async (input) => {
          const filePath = input.tool_input.file_path || '';

          // Block writes to sensitive paths
          if (filePath.includes('/etc/') || filePath.includes('node_modules')) {
            return {
              decision: 'block',
              stopReason: 'Cannot write to protected paths',
              continue: false,
            };
          }

          return { continue: true };
        },
      ],
    },
  ],
}
```

### PostToolUse Hooks

Execute after a tool completes. Can log or transform results.

```typescript
hooks: {
  PostToolUse: [
    {
      matcher: '.*',  // Match all tools
      hooks: [
        async (input) => {
          console.log(`Tool used: ${input.tool_name}`);
          console.log(`Input: ${JSON.stringify(input.tool_input)}`);
          return { continue: true };
        },
      ],
    },
  ],
}
```

---

## Settings Sources

Control where the SDK loads configuration from:

```typescript
options: {
  settingSources: ['user', 'project', 'local'],
}
```

- **`user`**: `~/.claude/settings.json` - User-wide settings
- **`project`**: `.claude/settings.json` - Project settings (checked in)
- **`local`**: `.claude/settings.local.json` - Local overrides (gitignored)

When enabled, the SDK loads:
- `.claude/agents/` - Subagent definitions
- `.claude/commands/` - Slash command expansions
- `.claude/output-styles/` - Custom output formatting
- `.claude/hooks/` - File-based hooks
- `CLAUDE.md` - Persistent agent context

**Important:** Must set `cwd` to the directory containing `.claude/`:

```typescript
options: {
  cwd: process.cwd(),
  settingSources: ['project', 'local'],
}
```

---

## Model Selection

```typescript
options: {
  model: 'sonnet',  // Default, balanced
  // model: 'opus',   // Most capable, higher cost
  // model: 'haiku',  // Fastest, lowest cost
  // model: 'inherit', // Use parent's model (in subagents)
}
```

---

## Error Handling

### Result Message

The final message has `type: 'result'`:

```typescript
for await (const message of q) {
  if (message.type === 'result') {
    if (message.subtype === 'success') {
      console.log(`Completed. Cost: $${message.total_cost_usd}`);
    } else if (message.subtype === 'error') {
      console.error('Agent failed');
    }
  }
}
```

### Try-Catch

```typescript
try {
  for await (const message of query({ prompt: '...' })) {
    // Process
  }
} catch (error) {
  console.error('SDK error:', error);
}
```

---

## TypeScript Types

### Key Imports

```typescript
import {
  // V1
  query,

  // V2
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  unstable_v2_prompt,

  // Tools
  createSdkMcpServer,
  tool,

  // Types
  type SDKMessage,
  type SDKUserMessage,
  type HookJSONOutput,
} from '@anthropic-ai/claude-agent-sdk';
```

### SDKUserMessage (for V1 multi-turn)

```typescript
type SDKUserMessage = {
  type: 'user';
  message: {
    role: 'user';
    content: string;
  };
};
```

---

## Version Compatibility

| Feature | SDK Version | Notes |
|---------|-------------|-------|
| `query()` | 0.0.1+ | Stable API |
| `unstable_v2_*` | 0.1.0+ | May change |
| `tools` option | 0.1.57+ | Alternative to `allowedTools` |
| `systemPrompt` | 0.1.0+ | Replaces merged prompts |
| `createSdkMcpServer` | 0.1.0+ | Custom tool servers |

Check your version:
```bash
npm info @anthropic-ai/claude-agent-sdk version
```
