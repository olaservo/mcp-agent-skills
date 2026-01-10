/**
 * React chat client with WebSocket and tool approval UI
 *
 * Features:
 * - WebSocket connection to server
 * - Chat message display
 * - Tool approval: shows pending tool calls with approve/reject buttons
 * - No styling (functional HTML only - add your own CSS or use a design skill)
 *
 * Usage:
 *   npm install react react-dom
 *   Add to your React app or use with Vite
 */

import { useState, useEffect, useRef, FormEvent } from "react";
import type { ChatMessage, ServerMessage, ToolApprovalRequest } from "./types";

const WS_URL = "ws://localhost:3001/ws";

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ToolApprovalRequest[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data);

      switch (message.type) {
        case "connected":
          console.log("Connected to server");
          break;

        case "history":
          setMessages(message.messages);
          break;

        case "user_message":
          // Already added optimistically
          break;

        case "assistant_message":
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: message.content,
              timestamp: new Date().toISOString(),
            },
          ]);
          setIsLoading(false);
          break;

        case "tool_use":
          setMessages((prev) => [
            ...prev,
            {
              id: message.toolId,
              role: "tool_use",
              content: "",
              timestamp: new Date().toISOString(),
              toolName: message.toolName,
              toolInput: message.toolInput,
            },
          ]);
          break;

        case "tool_approval_request":
          setPendingApprovals((prev) => [...prev, message]);
          break;

        case "result":
          setIsLoading(false);
          break;

        case "error":
          console.error("Server error:", message.error);
          setIsLoading(false);
          break;
      }
    };

    return () => ws.close();
  }, []);

  // Send chat message
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isConnected) return;

    // Add message optimistically
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: input,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Send via WebSocket
    wsRef.current?.send(JSON.stringify({ type: "chat", content: input }));
    setInput("");
    setIsLoading(true);
  };

  // Handle tool approval
  const handleApproval = (requestId: string, approved: boolean) => {
    wsRef.current?.send(
      JSON.stringify({ type: "tool_approval_response", requestId, approved })
    );
    setPendingApprovals((prev) => prev.filter((p) => p.requestId !== requestId));
  };

  return (
    <div>
      <h1>Claude Agent Chat</h1>

      {/* Connection status */}
      <p>Status: {isConnected ? "Connected" : "Disconnected"}</p>

      {/* Tool approval requests */}
      {pendingApprovals.length > 0 && (
        <div>
          <h2>Pending Tool Approvals</h2>
          {pendingApprovals.map((request) => (
            <div key={request.requestId}>
              <p>
                <strong>Tool:</strong> {request.toolName}
              </p>
              <pre>{JSON.stringify(request.toolInput, null, 2)}</pre>
              <button onClick={() => handleApproval(request.requestId, true)}>
                Approve
              </button>
              <button onClick={() => handleApproval(request.requestId, false)}>
                Reject
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div>
        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === "user" && (
              <p>
                <strong>You:</strong> {msg.content}
              </p>
            )}
            {msg.role === "assistant" && (
              <p>
                <strong>Assistant:</strong> {msg.content}
              </p>
            )}
            {msg.role === "tool_use" && (
              <details>
                <summary>Tool: {msg.toolName}</summary>
                <pre>{JSON.stringify(msg.toolInput, null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
        {isLoading && <p>Thinking...</p>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={!isConnected || isLoading}
        />
        <button type="submit" disabled={!isConnected || isLoading}>
          Send
        </button>
      </form>
    </div>
  );
}
