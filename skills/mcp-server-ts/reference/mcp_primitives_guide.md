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

### Annotations

```typescript
annotations: {
  readOnlyHint: true,      // Does not modify environment
  destructiveHint: false,  // Does not perform destructive updates
  idempotentHint: true,    // Safe to call multiple times with same result
  openWorldHint: true      // Interacts with external entities
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

### Annotations

```json
{
  "annotations": {
    "audience": ["user", "assistant"],
    "priority": 0.7,
    "lastModified": "2025-05-03T14:30:00Z"
  }
}
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
