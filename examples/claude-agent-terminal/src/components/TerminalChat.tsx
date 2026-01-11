/**
 * TerminalChat - Main terminal-style chat component
 *
 * Features:
 * - WebSocket connection to Claude Agent SDK server
 * - Input history with arrow key navigation
 * - Tool call display with approval UI
 * - Auto-scroll to latest message
 */

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { ActionIcon } from '@mantine/core';
import { IconSend, IconTerminal2 } from '@tabler/icons-react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage, ServerMessage, ClientMessage, ToolCallInfo, ServerChatMessage } from '../types';
import { generateId } from '../types';

interface TerminalChatProps {
  wsEndpoint: string;
}

export function TerminalChat({ wsEndpoint }: TerminalChatProps) {
  // Message state
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Input state
  const [input, setInput] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Connection state
  const [isConnected, setIsConnected] = useState(false);

  // Track pending approvals: toolCallId -> requestId
  const pendingApprovals = useRef<Map<string, string>>(new Map());

  // Refs
  const ws = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [messages]);

  // Convert server history message to client message format
  const convertServerMessage = useCallback((msg: ServerChatMessage): ChatMessage => {
    if (msg.role === 'tool_use') {
      return {
        id: msg.id,
        role: 'assistant',
        content: '',
        timestamp: new Date(msg.timestamp),
        toolCalls: [{
          id: msg.id,
          name: msg.toolName || 'unknown',
          arguments: msg.toolInput || {},
          status: 'completed',
        }],
      };
    }
    return {
      id: msg.id,
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: new Date(msg.timestamp),
    };
  }, []);

  // WebSocket connection
  useEffect(() => {
    const socket = new WebSocket(wsEndpoint);
    ws.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (error) {
        console.error('Failed to parse server message:', error);
      }
    };

    return () => {
      socket.close();
    };
  }, [wsEndpoint]);

  // Handle incoming server messages
  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'connected':
        console.log('Server says:', msg.message);
        break;

      case 'history': {
        // Load chat history on connect
        const historyMessages = msg.messages.map(convertServerMessage);
        setMessages(historyMessages);
        break;
      }

      case 'user_message':
        // Server echoes user message - we already added it, ignore
        break;

      case 'assistant_message': {
        // Add assistant message
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: msg.content,
          timestamp: new Date(),
        }]);
        break;
      }

      case 'tool_use': {
        // Add tool call to messages
        const toolCall: ToolCallInfo = {
          id: msg.toolId,
          name: msg.toolName,
          arguments: msg.toolInput,
          status: 'pending',
        };

        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          toolCalls: [toolCall],
        }]);
        break;
      }

      case 'tool_approval_request': {
        // Update the pending tool call to awaiting-approval status
        // Key by toolId for accurate matching with multiple tools of same type
        pendingApprovals.current.set(msg.toolId, msg.requestId);

        setMessages(prev => prev.map(m => ({
          ...m,
          toolCalls: m.toolCalls?.map(tc =>
            tc.id === msg.toolId && tc.status === 'pending'
              ? { ...tc, status: 'awaiting-approval' as ToolCallInfo['status'] }
              : tc
          ),
        })));
        break;
      }

      case 'result': {
        // Mark all pending tool calls as completed
        setMessages(prev => prev.map(m => ({
          ...m,
          toolCalls: m.toolCalls?.map(tc =>
            tc.status === 'executing'
              ? { ...tc, status: 'completed' as ToolCallInfo['status'] }
              : tc
          ),
        })));

        if (msg.cost !== undefined) {
          console.log(`Request completed. Cost: $${msg.cost.toFixed(4)}`);
        }
        break;
      }

      case 'error': {
        // Add error message
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'system',
          content: '',
          timestamp: new Date(),
          error: msg.error,
        }]);
        break;
      }
    }
  }, [convertServerMessage]);

  // Send message to server
  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    // Add to history
    setInputHistory(prev => [...prev, content]);
    setHistoryIndex(-1);

    // Add user message to UI
    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    }]);

    // Send to server
    const clientMsg: ClientMessage = { type: 'chat', content };
    ws.current.send(JSON.stringify(clientMsg));

    // Clear input
    setInput('');
  }, [input]);

  // Handle tool approval
  const handleApprove = useCallback((toolCallId: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    // Get the requestId for this tool (keyed by toolId)
    const requestId = pendingApprovals.current.get(toolCallId);
    if (!requestId) {
      console.error('No pending approval found for toolId:', toolCallId);
      return;
    }

    // Update UI immediately
    setMessages(prev => prev.map(m => ({
      ...m,
      toolCalls: m.toolCalls?.map(tc =>
        tc.id === toolCallId
          ? { ...tc, status: 'executing' as ToolCallInfo['status'] }
          : tc
      ),
    })));

    // Send approval to server
    const clientMsg: ClientMessage = {
      type: 'tool_approval_response',
      requestId,
      approved: true
    };
    ws.current.send(JSON.stringify(clientMsg));

    // Clean up
    pendingApprovals.current.delete(toolCallId);
  }, []);

  const handleReject = useCallback((toolCallId: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    // Get the requestId for this tool (keyed by toolId)
    const requestId = pendingApprovals.current.get(toolCallId);
    if (!requestId) {
      console.error('No pending approval found for toolId:', toolCallId);
      return;
    }

    // Update UI immediately
    setMessages(prev => prev.map(m => ({
      ...m,
      toolCalls: m.toolCalls?.map(tc =>
        tc.id === toolCallId
          ? { ...tc, status: 'failed' as ToolCallInfo['status'], result: 'Rejected by user' }
          : tc
      ),
    })));

    // Send rejection to server
    const clientMsg: ClientMessage = {
      type: 'tool_approval_response',
      requestId,
      approved: false
    };
    ws.current.send(JSON.stringify(clientMsg));

    // Clean up
    pendingApprovals.current.delete(toolCallId);
  }, []);

  // Keyboard handler for input
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Arrow up - navigate history backward
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      const textarea = e.currentTarget;
      const cursorAtStart = textarea.selectionStart === 0;

      if (cursorAtStart && inputHistory.length > 0) {
        e.preventDefault();
        const newIndex = Math.min(historyIndex + 1, inputHistory.length - 1);
        setHistoryIndex(newIndex);
        setInput(inputHistory[inputHistory.length - 1 - newIndex]);
      }
    }

    // Arrow down - navigate history forward
    if (e.key === 'ArrowDown' && !e.shiftKey) {
      const textarea = e.currentTarget;
      const cursorAtEnd = textarea.selectionStart === textarea.value.length;

      if (cursorAtEnd && historyIndex >= 0) {
        e.preventDefault();
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        if (newIndex < 0) {
          setInput('');
        } else {
          setInput(inputHistory[inputHistory.length - 1 - newIndex]);
        }
      }
    }

    // Enter - send message (Shift+Enter for newline)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [inputHistory, historyIndex, sendMessage]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setHistoryIndex(-1); // Reset history navigation when typing

    // Auto-resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }, []);

  return (
    <div className="terminal">
      {/* Header */}
      <div className="terminal-header">
        <div className="terminal-header-title">
          <IconTerminal2 size={18} />
          <span>Claude Agent Terminal</span>
          <span className="terminal-header-status">
            {isConnected ? 'connected' : 'disconnected'}
          </span>
        </div>
      </div>

      {/* Output area */}
      <div className="terminal-output-area" ref={outputRef}>
        {messages.length === 0 ? (
          <div className="terminal-welcome">
            <div className="terminal-welcome-title">Welcome to Claude Agent Terminal</div>
            <div className="terminal-welcome-hint">
              Type a message to start chatting with the Claude agent.
              <br />
              Use arrow keys to navigate input history.
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))
        )}
      </div>

      {/* Input area */}
      <div className="terminal-input-area">
        <div className="terminal-input-wrapper">
          <textarea
            className="terminal-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
            disabled={!isConnected}
            rows={1}
          />
          <div className="terminal-input-actions">
            <ActionIcon
              variant="filled"
              color="blue"
              onClick={sendMessage}
              disabled={!isConnected || !input.trim()}
              title="Send message (Enter)"
            >
              <IconSend size={18} />
            </ActionIcon>
          </div>
        </div>
      </div>
    </div>
  );
}
