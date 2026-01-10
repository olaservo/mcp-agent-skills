# MCP Tasks Guide (SEP-1686)

Reference for MCP Tasks - asynchronous operation execution with polling.

**Protocol Revision:** 2025-11-25 (experimental)
**SEP:** 1686

---

## Overview

Tasks enable "call now, fetch later" patterns for long-running operations. Instead of blocking until completion, clients receive a task ID and poll for status updates.

| Aspect | Description |
|--------|-------------|
| **Control Model** | Server-managed async execution |
| **Use Case** | Long-running operations (>2-3 seconds) |
| **Client Flow** | Create -> Poll -> Get Result |

---

## Task Lifecycle

```
                    Task State Machine

    +----------+
    | CREATED  |------------------------------------+
    +----+-----+                                    |
         |                                          |
         v                                          |
    +----------+     +----------------+             |
    | WORKING  |---->| INPUT_REQUIRED |             |
    +----+-----+     +-------+--------+             |
         |                   | (after elicitation)  |
         |                   v                      |
         |           +----------+                   |
         |           | WORKING  |                   |
         |           +----+-----+                   |
         |                |                         |
         v                v                         v
    +----------+    +----------+    +----------+
    |COMPLETED |    |  FAILED  |    |CANCELLED |
    +----------+    +----------+    +----------+
```

## Task States

| State | Description |
|-------|-------------|
| `working` | Task is actively processing |
| `completed` | Task finished successfully, result available |
| `failed` | Task encountered an error |
| `input_required` | Task paused, needs user input via elicitation |
| `cancelled` | Task was cancelled by client |

---

## Capability Declaration

```typescript
{
  capabilities: {
    tasks: {
      list: {},      // Support tasks/list method
      cancel: {},    // Support tasks/cancel method
      requests: {
        tools: {
          call: {},  // Support task-based tools/call
        },
      },
    },
  },
}
```

---

## Server Setup Requirements

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  InMemoryTaskStore,
  InMemoryTaskMessageQueue,
} from "@modelcontextprotocol/sdk/experimental";

const taskStore = new InMemoryTaskStore();
const taskMessageQueue = new InMemoryTaskMessageQueue();

const server = new McpServer(
  { name: "my-server", version: "1.0.0" },
  {
    capabilities: {
      tasks: { list: {}, cancel: {}, requests: { tools: { call: {} } } }
    },
    taskStore,
    taskMessageQueue,
  }
);
```

---

## Registering Task-Enabled Tools

Use `server.experimental.tasks.registerToolTask()`:

```typescript
server.experimental.tasks.registerToolTask(
  "tool-name",
  {
    title: "Tool Title",
    description: "What this tool does",
    inputSchema: MyZodSchema,
    execution: { taskSupport: "required" }, // or "optional"
  },
  {
    createTask: async (args, extra) => { /* ... */ },
    getTask: async (args, extra) => { /* ... */ },
    getTaskResult: async (args, extra) => { /* ... */ },
  }
);
```

### Handler Signatures

**createTask**: Called when client invokes `tools/call` with task parameter.
- Returns `{ task }` with task ID, TTL, pollInterval

**getTask**: Called when client invokes `tasks/get`.
- Returns current task status and statusMessage

**getTaskResult**: Called when client invokes `tasks/result`.
- Returns final `CallToolResult` when completed
- Can trigger elicitation if status is `input_required`

**cancelTask**: Called when client invokes `tasks/cancel`.
- Sets internal cancelled flag
- Background processing should check this flag and exit gracefully

---

## Task Store API

```typescript
// In createTask handler
const task = await extra.taskStore.createTask({
  ttl: 60000,        // Time-to-live in ms (auto-cleanup)
  pollInterval: 500, // Suggested poll interval for client
});

// During processing
await extra.taskStore.updateTaskStatus(taskId, "working", "Processing step 2...");

// On completion
await extra.taskStore.storeTaskResult(taskId, "completed", result);

// On failure
await extra.taskStore.storeTaskResult(taskId, "failed", {
  content: [{ type: "text", text: "Error: ..." }],
  isError: true,
});
```

---

## Input Required Flow (Elicitation)

When a task needs user clarification:

1. Update status to `input_required`:
   ```typescript
   await taskStore.updateTaskStatus(taskId, "input_required", "Need clarification");
   ```

2. In `getTaskResult`, send elicitation request:
   ```typescript
   const result = await extra.sendRequest(
     {
       method: "elicitation/create",
       params: {
         message: "Please clarify...",
         requestedSchema: { /* JSON Schema */ },
       },
     },
     ElicitResultSchema,
     { timeout: 60000 }
   );
   ```

3. Handle response and resume processing

---

## Protocol Messages

| Method | Direction | Description |
|--------|-----------|-------------|
| `tools/call` (with task) | C->S | Create task, returns task ID |
| `tasks/get` | C->S | Get task status |
| `tasks/result` | C->S | Get task result (or trigger elicitation) |
| `tasks/list` | C->S | List all tasks |
| `tasks/cancel` | C->S | Cancel a task |
| `notifications/tasks/progress` | S->C | Task progress update |

---

## When to Use Tasks vs Tools

### Use Tasks When:
- Operation takes >2-3 seconds
- Processing has multiple observable stages
- Operation might need user clarification mid-execution
- Client should remain responsive during processing

### Use Regular Tools When:
- Operation completes quickly (<2 seconds)
- No intermediate status is meaningful
- Simple request-response pattern suffices

---

## Cancellation Handling

Tasks should check for cancellation between processing stages:

```typescript
interface TaskState {
  cancelled: boolean;
  // ... other state
}

async function processTask(taskId: string, taskStore: any) {
  const state = taskStates.get(taskId);

  for (let i = 0; i < STAGES.length; i++) {
    // Check if task was cancelled externally
    if (state.cancelled) {
      return; // Exit gracefully - task store handles status update
    }

    await taskStore.updateTaskStatus(taskId, "working", `${STAGES[i]}...`);
    await doStageWork(i);
  }

  await taskStore.storeTaskResult(taskId, "completed", result);
}

// In cancelTask handler:
cancelTask: async (args, extra) => {
  const state = taskStates.get(extra.taskId);
  if (state) {
    state.cancelled = true;
  }
}
```

---

## Best Practices

1. **Set appropriate TTL**: Balance between cleanup and allowing retries
2. **Use statusMessage**: Provide human-readable progress updates
3. **Clean up state**: Delete internal state maps when task completes
4. **Handle cancellation**: Check for cancellation during long loops
5. **Reasonable pollInterval**: 500ms-2000ms depending on operation speed
6. **Check client capabilities**: Only use elicitation if client supports it

