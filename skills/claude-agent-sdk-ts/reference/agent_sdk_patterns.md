# Claude Agent SDK Patterns Guide

Best practices and common patterns for building agents with the Claude Agent SDK.

---

## Choosing Between V1 and V2

### Use V1 `query()` When:

- Building CLI tools or automation scripts
- Processing batch tasks
- Single-shot queries without conversation history
- You need simpler code structure
- Compatibility with older SDK versions is important

**V1 Strengths:**
- Simpler async iteration model
- Works with any Node.js version supporting async iterators
- More established, stable API

### Use V2 Session API When:

- Building interactive chat applications
- Need multi-turn conversations with context
- Want to persist and resume conversations
- Building web services with multiple users
- Need clean session lifecycle management

**V2 Strengths:**
- Natural multi-turn conversation flow
- Session persistence with `unstable_v2_resumeSession`
- `await using` for automatic cleanup
- One-shot convenience with `unstable_v2_prompt`

---

## Message Processing Patterns

### Pattern: Extract Text from Messages

```typescript
function extractText(message: SDKMessage): string | null {
  if (message.type === 'assistant' && message.message) {
    const textBlock = message.message.content.find(
      (c): c is { type: 'text'; text: string } => c.type === 'text'
    );
    return textBlock?.text || null;
  }
  return null;
}

for await (const msg of query({ prompt: '...' })) {
  const text = extractText(msg);
  if (text) console.log(text);
}
```

### Pattern: Track Tool Calls

```typescript
for await (const msg of query({ prompt: '...' })) {
  if (msg.type === 'assistant' && msg.message) {
    for (const block of msg.message.content) {
      if (block.type === 'tool_use') {
        console.log(`Tool: ${block.name}`);
        console.log(`Input: ${JSON.stringify(block.input)}`);
      }
    }
  }
}
```

### Pattern: Collect Full Response

```typescript
async function getFullResponse(prompt: string): Promise<string> {
  const parts: string[] = [];

  for await (const msg of query({ prompt })) {
    if (msg.type === 'assistant' && msg.message) {
      const text = msg.message.content.find(c => c.type === 'text');
      if (text && 'text' in text) {
        parts.push(text.text);
      }
    }
  }

  return parts.join('');
}
```

---

## Tool Configuration Patterns

### Pattern: Minimal Tool Set

Start with the minimum tools needed, expand as required:

```typescript
options: {
  allowedTools: ['Read'],  // Start minimal
}
```

### Pattern: Read-Only Agent

```typescript
options: {
  allowedTools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'],
  // No Write, Edit, Bash - agent can only read
}
```

### Pattern: File Operations Only

```typescript
options: {
  allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
  disallowedTools: ['Bash', 'WebSearch', 'WebFetch'],
}
```

### Pattern: Sandboxed Execution

```typescript
options: {
  cwd: '/tmp/sandbox',  // Isolated directory
  allowedTools: ['Read', 'Write', 'Bash'],
  hooks: {
    PreToolUse: [{
      matcher: 'Write|Edit',
      hooks: [async (input) => {
        const path = input.tool_input.file_path;
        if (!path.startsWith('/tmp/sandbox/')) {
          return {
            decision: 'block',
            stopReason: 'Writes restricted to sandbox',
            continue: false,
          };
        }
        return { continue: true };
      }],
    }],
  },
}
```

---

## Hook Patterns

### Pattern: Audit Logging

```typescript
hooks: {
  PostToolUse: [{
    matcher: '.*',
    hooks: [async (input) => {
      await fs.appendFile('audit.log', JSON.stringify({
        timestamp: new Date().toISOString(),
        tool: input.tool_name,
        input: input.tool_input,
      }) + '\n');
      return { continue: true };
    }],
  }],
}
```

### Pattern: Block Dangerous Commands

```typescript
const DANGEROUS_PATTERNS = [
  /rm\s+-rf/,
  />\s*\/dev\/sd/,
  /mkfs/,
  /dd\s+if=/,
];

hooks: {
  PreToolUse: [{
    matcher: 'Bash',
    hooks: [async (input) => {
      const command = input.tool_input.command || '';
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
          return {
            decision: 'block',
            stopReason: `Blocked dangerous command: ${command}`,
            continue: false,
          };
        }
      }
      return { continue: true };
    }],
  }],
}
```

### Pattern: Rate Limiting

```typescript
const toolCounts: Record<string, number> = {};
const LIMITS: Record<string, number> = {
  WebSearch: 10,
  WebFetch: 20,
};

hooks: {
  PreToolUse: [{
    matcher: 'WebSearch|WebFetch',
    hooks: [async (input) => {
      const tool = input.tool_name;
      toolCounts[tool] = (toolCounts[tool] || 0) + 1;

      if (toolCounts[tool] > (LIMITS[tool] || Infinity)) {
        return {
          decision: 'block',
          stopReason: `Rate limit exceeded for ${tool}`,
          continue: false,
        };
      }
      return { continue: true };
    }],
  }],
}
```

---

## Multi-Turn Patterns

### Pattern: V1 Message Queue

For V1 API, use an async iterator to enable multi-turn:

```typescript
class MessageQueue {
  private messages: SDKUserMessage[] = [];
  private waiting: ((msg: SDKUserMessage) => void) | null = null;
  private closed = false;

  push(content: string) {
    const msg: SDKUserMessage = {
      type: 'user',
      message: { role: 'user', content },
    };

    if (this.waiting) {
      this.waiting(msg);
      this.waiting = null;
    } else {
      this.messages.push(msg);
    }
  }

  async *[Symbol.asyncIterator]() {
    while (!this.closed) {
      if (this.messages.length > 0) {
        yield this.messages.shift()!;
      } else {
        yield await new Promise<SDKUserMessage>(resolve => {
          this.waiting = resolve;
        });
      }
    }
  }

  close() { this.closed = true; }
}

// Usage
const queue = new MessageQueue();
const q = query({ prompt: queue as any });

// In one context: push messages
queue.push('Hello');

// In another: iterate responses
for await (const msg of q) { ... }
```

### Pattern: V2 Interactive Loop

```typescript
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

await using session = unstable_v2_createSession({ model: 'sonnet' });

while (true) {
  const userInput = await new Promise<string>(resolve => {
    rl.question('You: ', resolve);
  });

  if (userInput === 'exit') break;

  await session.send(userInput);

  for await (const msg of session.stream()) {
    if (msg.type === 'assistant') {
      const text = msg.message.content.find(c => c.type === 'text');
      if (text && 'text' in text) {
        console.log(`Claude: ${text.text}`);
      }
    }
  }
}

rl.close();
```

---

## Session Management Patterns

### Pattern: Session Persistence (V2)

```typescript
import * as fs from 'fs/promises';

const SESSION_FILE = './session.json';

async function loadOrCreateSession() {
  try {
    const data = await fs.readFile(SESSION_FILE, 'utf-8');
    const { sessionId } = JSON.parse(data);
    return unstable_v2_resumeSession(sessionId, { model: 'sonnet' });
  } catch {
    return unstable_v2_createSession({ model: 'sonnet' });
  }
}

async function saveSession(sessionId: string) {
  await fs.writeFile(SESSION_FILE, JSON.stringify({ sessionId }));
}

// Usage
await using session = await loadOrCreateSession();
await session.send('Hello');

for await (const msg of session.stream()) {
  if (msg.type === 'system' && msg.subtype === 'init') {
    await saveSession(msg.session_id!);
  }
  // ... process messages
}
```

---

## Application Integration Patterns

### Pattern: Express HTTP Endpoint

```typescript
import express from 'express';
import { unstable_v2_prompt } from '@anthropic-ai/claude-agent-sdk';

const app = express();
app.use(express.json());

app.post('/ask', async (req, res) => {
  const { question } = req.body;

  try {
    const result = await unstable_v2_prompt(question, { model: 'sonnet' });

    res.json({
      answer: result.result,
      cost: result.total_cost_usd,
    });
  } catch (error) {
    res.status(500).json({ error: 'Agent failed' });
  }
});

app.listen(3000);
```

### Pattern: WebSocket Streaming

```typescript
import { WebSocketServer } from 'ws';
import { unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk';

const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', async (ws) => {
  await using session = unstable_v2_createSession({ model: 'sonnet' });

  ws.on('message', async (data) => {
    const message = data.toString();
    await session.send(message);

    for await (const msg of session.stream()) {
      if (msg.type === 'assistant') {
        const text = msg.message.content.find(c => c.type === 'text');
        if (text && 'text' in text) {
          ws.send(JSON.stringify({ type: 'text', content: text.text }));
        }
      }
    }
    ws.send(JSON.stringify({ type: 'done' }));
  });
});
```

---

## Subagent Patterns

### Pattern: Using Task Tool

The Task tool enables subagent orchestration:

```typescript
options: {
  allowedTools: ['Task', 'Read', 'Write'],
  agents: [
    {
      name: 'researcher',
      description: 'Research specialist for finding information',
      tools: ['WebSearch', 'WebFetch', 'Read'],
      systemPrompt: 'You are a research specialist...',
    },
    {
      name: 'writer',
      description: 'Content writer for creating documents',
      tools: ['Write', 'Edit'],
      systemPrompt: 'You are a technical writer...',
    },
  ],
}
```

The main agent can then spawn subagents using the Task tool:

```typescript
// In the prompt or via tool call
"Use the researcher agent to find information about X, then use the writer agent to create a summary."
```

---

## Error Handling Patterns

### Pattern: Graceful Degradation

```typescript
try {
  for await (const msg of query({ prompt, options })) {
    // Process messages
  }
} catch (error) {
  if (error.message.includes('rate limit')) {
    console.log('Rate limited, waiting...');
    await sleep(60000);
    // Retry
  } else if (error.message.includes('context length')) {
    console.log('Context too long, summarizing...');
    // Summarize and retry
  } else {
    throw error;
  }
}
```

### Pattern: Cost Tracking

```typescript
let totalCost = 0;
const MAX_COST = 1.0;  // $1.00 limit

for await (const msg of query({ prompt })) {
  if (msg.type === 'result' && msg.subtype === 'success') {
    totalCost += msg.total_cost_usd || 0;

    if (totalCost > MAX_COST) {
      console.warn(`Cost limit reached: $${totalCost.toFixed(4)}`);
      break;
    }
  }
}
```

---

## Configuration Best Practices

### Always Set cwd

```typescript
options: {
  cwd: process.cwd(),  // Or specific project directory
}
```

Without `cwd`, file operations may fail or operate in unexpected locations.

### Use settingSources for .claude/ Integration

```typescript
options: {
  cwd: process.cwd(),
  settingSources: ['project', 'local'],
}
```

This enables:
- `CLAUDE.md` for persistent context
- `.claude/agents/` for subagent definitions
- `.claude/commands/` for slash commands
- `.claude/hooks/` for file-based hooks

### Start with sonnet, Upgrade as Needed

```typescript
options: {
  model: 'sonnet',  // Good balance of capability and cost
}
```

Use `opus` for complex reasoning tasks, `haiku` for simple/fast operations.

---

## Security Considerations

1. **Validate tool inputs** with PreToolUse hooks
2. **Restrict file paths** to specific directories
3. **Block dangerous Bash commands** with pattern matching
4. **Rate limit** expensive operations
5. **Audit log** all tool usage
6. **Use minimal tool sets** - only enable what's needed
7. **Set cwd** to an isolated directory for sandboxing
