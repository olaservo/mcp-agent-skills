# MCP Primitives Guide

Reference for the three MCP server primitives: Tools, Resources, and Prompts.

**Protocol Revision:** 2025-11-25

---

## Overview

| Primitive | Control Model | Use Case |
|-----------|---------------|----------|
| **Tools** | Model-controlled | Actions with side effects (API calls, computations) |
| **Resources** | Application-controlled | Data/context for LLMs (files, database records) |
| **Prompts** | User-controlled | Template commands (slash commands, workflows) |

---

## Tools

Tools enable models to interact with external systems - querying databases, calling APIs, or performing computations.

### Capability Declaration

```json
{
  "capabilities": {
    "tools": {
      "listChanged": true
    }
  }
}
```

### Tool Definition

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (1-128 chars, alphanumeric + `_-. `) |
| `title` | No | Human-readable display name |
| `description` | Yes | What the tool does |
| `inputSchema` | Yes | JSON Schema for parameters |
| `outputSchema` | No | JSON Schema for structured output |
| `annotations` | No | Behavioral hints |

### Tool Annotations

Tool annotations provide hints to clients about tool behavior. These are **hints only** - not guaranteed to be accurate.

```typescript
annotations: {
  readOnlyHint: true,      // Does not modify environment
  destructiveHint: false,  // Does not perform destructive updates
  idempotentHint: true,    // Safe to call multiple times with same result
  openWorldHint: false     // Does not interact with external entities
}
```

**Default Values (if not specified):**

| Annotation | Default | Meaning |
|------------|---------|---------|
| `readOnlyHint` | `false` | Assumes tool DOES modify its environment |
| `destructiveHint` | `true` | Assumes tool IS destructive |
| `idempotentHint` | `false` | Assumes tool is NOT safe to retry |
| `openWorldHint` | `true` | Assumes tool interacts with external systems |

> **Important:** The defaults assume the most dangerous behavior. Servers should explicitly set annotations to indicate safer behavior.

**Conditional Semantics:**

- `destructiveHint` and `idempotentHint` are only meaningful when `readOnlyHint == false`
- If `readOnlyHint: true`, the other hints are irrelevant (read-only tools can't be destructive)

**Example: Read-only tool**
```typescript
annotations: {
  readOnlyHint: true,       // Only reads data
  openWorldHint: true       // Queries external API
}
// destructiveHint and idempotentHint omitted - not meaningful for read-only
```

**Example: Destructive tool**
```typescript
annotations: {
  readOnlyHint: false,      // Modifies environment
  destructiveHint: true,    // Deletes data
  idempotentHint: false,    // Each call has additional effect
  openWorldHint: false      // Only affects local state
}
```

### Tool Result Content Types

**Text:**
```json
{ "type": "text", "text": "Result string" }
```

**Image:**
```json
{
  "type": "image",
  "data": "base64-encoded-data",
  "mimeType": "image/png"
}
```

**Audio:**
```json
{
  "type": "audio",
  "data": "base64-encoded-audio-data",
  "mimeType": "audio/wav"
}
```

**Resource Link:**
```json
{
  "type": "resource_link",
  "uri": "file:///project/src/main.rs",
  "name": "main.rs",
  "mimeType": "text/x-rust"
}
```

**Embedded Resource:**
```json
{
  "type": "resource",
  "resource": {
    "uri": "file:///project/src/main.rs",
    "mimeType": "text/x-rust",
    "text": "fn main() { ... }"
  }
}
```

**Structured Content:**
```json
{
  "content": [{ "type": "text", "text": "{...}" }],
  "structuredContent": { "field": "value" }
}
```

### Error Handling

**Tool execution errors** (return in result):
```json
{
  "content": [{ "type": "text", "text": "Invalid date: must be in future" }],
  "isError": true
}
```

**Protocol errors** (JSON-RPC):
```json
{
  "error": {
    "code": -32602,
    "message": "Unknown tool: invalid_tool_name"
  }
}
```

---

## Resources

Resources provide data/context to language models - files, database schemas, application state.

### Capability Declaration

```json
{
  "capabilities": {
    "resources": {
      "subscribe": true,
      "listChanged": true
    }
  }
}
```

### Resource Definition

| Field | Required | Description |
|-------|----------|-------------|
| `uri` | Yes | Unique identifier (RFC 3986 URI) |
| `name` | Yes | Display name |
| `title` | No | Human-readable title |
| `description` | No | What the resource contains |
| `mimeType` | No | Content type |

### Common URI Schemes

| Scheme | Example | Use Case |
|--------|---------|----------|
| `file://` | `file:///home/user/doc.txt` | Local files |
| `http://` | `http://api.example.com/data` | Remote HTTP resources |
| `custom://` | `myapp://users/123` | Application-specific data |

### Resource Templates

For parameterized resources using URI templates (RFC 6570):

```json
{
  "uriTemplate": "myapp://users/{userId}/profile",
  "name": "User Profile",
  "description": "Access user profile by ID"
}
```

### Resource Contents

**Text:**
```json
{
  "uri": "file:///doc.txt",
  "mimeType": "text/plain",
  "text": "File contents here"
}
```

**Binary (blob):**
```json
{
  "uri": "file:///image.png",
  "mimeType": "image/png",
  "blob": "base64-encoded-data"
}
```

### Content Annotations

Content annotations provide hints to clients about how to use or display content. They apply to:
- Resources and resource templates
- Tool result content items (text, image, audio, embedded resources, resource links)
- Prompt messages

| Field | Type | Description |
|-------|------|-------------|
| `audience` | `Role[]` | Who should see this content: `["user"]`, `["assistant"]`, or `["user", "assistant"]` |
| `priority` | `number` | Importance from 0.0 (optional) to 1.0 (required) |
| `lastModified` | `string` | ISO 8601 timestamp (e.g., `"2025-01-12T15:00:58Z"`) |

**Example: Resource with annotations**
```json
{
  "uri": "file:///project/README.md",
  "name": "README.md",
  "mimeType": "text/markdown",
  "annotations": {
    "audience": ["user"],
    "priority": 0.8,
    "lastModified": "2025-01-12T15:00:58Z"
  }
}
```

**When to use each field:**

| Field | Use Case |
|-------|----------|
| `audience: ["user"]` | Content for display only (images, formatted output) |
| `audience: ["assistant"]` | Technical details, debug info, context for LLM |
| `audience: ["user", "assistant"]` | Important content both should see (errors, key results) |
| `priority: 1.0` | Critical content that must be included |
| `priority: 0.5` | Normal importance |
| `priority: 0.0` | Optional/supplementary content, can be dropped if context limited |
| `lastModified` | Enable sorting by recency, show "last updated" in UI |

**Example: Tool result with annotated content items**
```typescript
return {
  content: [
    {
      type: "text",
      text: "Operation completed successfully",
      annotations: {
        priority: 0.9,
        audience: ["user", "assistant"]
      }
    },
    {
      type: "text",
      text: "Debug: processed 150 records in 2.3s",
      annotations: {
        priority: 0.2,
        audience: ["assistant"]  // Technical detail for LLM context
      }
    }
  ]
};
```

---

## Prompts

Prompts provide template messages for interacting with language models - typically exposed as slash commands.

### Capability Declaration

```json
{
  "capabilities": {
    "prompts": {
      "listChanged": true
    }
  }
}
```

### Prompt Definition

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier |
| `title` | No | Human-readable display name |
| `description` | No | What the prompt does |
| `arguments` | No | List of customization arguments |

### Prompt Arguments

```json
{
  "arguments": [
    {
      "name": "code",
      "description": "The code to review",
      "required": true
    },
    {
      "name": "language",
      "description": "Programming language",
      "required": false
    }
  ]
}
```

### Prompt Messages

```json
{
  "messages": [
    {
      "role": "user",
      "content": {
        "type": "text",
        "text": "Please review this code:\n..."
      }
    }
  ]
}
```

**Roles:** `user` or `assistant`

**Content types:** Same as tool results (text, image, resource)

---

## Protocol Messages Summary

### Tools
- `tools/list` - Discover available tools
- `tools/call` - Invoke a tool
- `notifications/tools/list_changed` - Tool list changed

### Resources
- `resources/list` - List available resources
- `resources/read` - Read resource contents
- `resources/templates/list` - List resource templates
- `resources/subscribe` - Subscribe to changes
- `notifications/resources/list_changed` - Resource list changed
- `notifications/resources/updated` - Specific resource changed

### Prompts
- `prompts/list` - List available prompts
- `prompts/get` - Get prompt with arguments
- `notifications/prompts/list_changed` - Prompt list changed

---

## When to Use Which Primitive

### Use Tools When:
- Performing actions with side effects
- Calling external APIs
- Running computations
- Creating, updating, or deleting data
- Operations require complex input validation

### Use Resources When:
- Exposing read-only data
- Data is addressable by URI
- Content is relatively static or can be templated
- LLM needs context without taking action

### Use Prompts When:
- Providing user-invokable commands
- Creating reusable message templates
- Building slash command interfaces
- Guiding user interactions with the LLM

---

## Security Considerations

**Servers MUST:**
- Validate all inputs
- Implement access controls
- Rate limit invocations
- Sanitize outputs

**Clients SHOULD:**
- Confirm sensitive operations with user
- Show inputs before calling server
- Validate results
- Implement timeouts
- Log usage for audit
