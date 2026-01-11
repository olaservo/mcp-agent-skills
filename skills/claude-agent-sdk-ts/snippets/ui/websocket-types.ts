/**
 * Claude Agent SDK - WebSocket Protocol Types (V1 Query API)
 *
 * Shared types for WebSocket communication between client and server.
 * Used with the V1 query() API and SQLite persistence.
 */

// ============== DATABASE TYPES ==============

/** Message stored in chat history (SQLite) */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool_use";
  content: string;
  timestamp: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

// ============== TOOL APPROVAL ==============

/** Tool approval request sent from server to client */
export interface ToolApprovalRequest {
  type: "tool_approval_request";
  requestId: string;
  toolId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

/** Tool approval response sent from client to server */
export interface ToolApprovalResponse {
  type: "tool_approval_response";
  requestId: string;
  approved: boolean;
}

// ============== WEBSOCKET PROTOCOL ==============

/** Messages from server to client */
export type ServerMessage =
  | { type: "connected"; message: string }
  | { type: "history"; messages: ChatMessage[] }
  | { type: "user_message"; content: string }
  | { type: "assistant_message"; content: string }
  | { type: "tool_use"; toolName: string; toolId: string; toolInput: Record<string, unknown> }
  | { type: "result"; success: boolean; cost?: number; duration?: number }
  | { type: "error"; error: string }
  | ToolApprovalRequest;

/** Messages from client to server */
export type ClientMessage =
  | { type: "chat"; content: string }
  | ToolApprovalResponse;

// ============== UTILITIES ==============

/** Generate a unique message ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
