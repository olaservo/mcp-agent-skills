/**
 * Terminal Chat React Components
 *
 * A terminal-style chat interface for Claude Agent SDK with:
 * - Dark monospace theme (VS Code-inspired)
 * - Input history with arrow key navigation
 * - Tool call blocks with approval UI
 * - Auto-scroll to latest message
 *
 * Dependencies:
 *   npm install react react-dom @mantine/core @mantine/hooks @tabler/icons-react
 *
 * Usage:
 *   import { TerminalChat } from './client';
 *   <TerminalChat wsEndpoint="ws://localhost:3001/ws" />
 */

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { ActionIcon, Collapse } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconSend,
  IconTerminal2,
  IconChevronDown,
  IconChevronRight,
  IconTool,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import type {
  ChatMessage,
  ToolCallInfo,
  ServerMessage,
  ClientMessage,
  ServerChatMessage,
} from './types';
import { generateId } from './types';

// ============== TOOL BLOCK ==============

interface ToolBlockProps {
  toolCall: ToolCallInfo;
  onApprove?: () => void;
  onReject?: () => void;
}

function ToolBlock({ toolCall, onApprove, onReject }: ToolBlockProps) {
  const [expanded, { toggle }] = useDisclosure(false);
  const hasArgs = Object.keys(toolCall.arguments).length > 0;
  const hasResult = toolCall.result !== undefined;
  const needsApproval = toolCall.status === 'awaiting-approval';

  const getStatusLabel = (status: ToolCallInfo['status']): string => {
    switch (status) {
      case 'pending': return 'pending';
      case 'executing': return 'running...';
      case 'awaiting-approval': return 'awaiting approval';
      case 'completed': return 'done';
      case 'failed': return 'failed';
      default: return status;
    }
  };

  return (
    <div className="terminal-tool-call">
      <div className="terminal-tool-call-header">
        <IconTool size={14} />
        <span>{toolCall.name}</span>
        <span className={`terminal-tool-call-status terminal-tool-call-status-${toolCall.status}`}>
          {getStatusLabel(toolCall.status)}
        </span>
        {(hasArgs || hasResult) && (
          <ActionIcon size="xs" variant="subtle" onClick={toggle} color="gray">
            {expanded ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </ActionIcon>
        )}
      </div>

      {needsApproval && onApprove && onReject && (
        <div className="terminal-tool-approval">
          <span className="terminal-tool-approval-text">Allow this tool to run?</span>
          <button className="terminal-tool-approval-btn terminal-tool-approval-btn-approve" onClick={onApprove}>
            <IconCheck size={12} style={{ marginRight: 4 }} />
            Approve
          </button>
          <button className="terminal-tool-approval-btn terminal-tool-approval-btn-reject" onClick={onReject}>
            <IconX size={12} style={{ marginRight: 4 }} />
            Reject
          </button>
        </div>
      )}

      <Collapse in={expanded}>
        {hasArgs && (
          <div className="terminal-tool-call-args">
            <pre>{JSON.stringify(toolCall.arguments, null, 2)}</pre>
          </div>
        )}
        {hasResult && (
          <div className={`terminal-tool-result ${toolCall.isError ? 'terminal-tool-result-error' : ''}`}>
            <div className="terminal-tool-result-header">Result:</div>
            <div className="terminal-tool-result-content">
              <pre>{toolCall.result}</pre>
            </div>
          </div>
        )}
      </Collapse>
    </div>
  );
}

// ============== MESSAGE BUBBLE ==============

interface MessageBubbleProps {
  message: ChatMessage;
  onApprove?: (toolCallId: string) => void;
  onReject?: (toolCallId: string) => void;
}

function MessageBubble({ message, onApprove, onReject }: MessageBubbleProps) {
  const getRoleClass = (role: ChatMessage['role']): string => {
    switch (role) {
      case 'user': return 'terminal-message-user';
      case 'assistant': return 'terminal-message-assistant';
      case 'system': return 'terminal-message-system';
      case 'tool-result': return 'terminal-message-assistant';
      default: return '';
    }
  };

  const roleClass = getRoleClass(message.role);
  const streamingClass = message.isStreaming ? 'terminal-message-streaming' : '';
  const errorClass = message.error ? 'terminal-message-error' : '';

  return (
    <div className={`terminal-message ${roleClass} ${streamingClass} ${errorClass}`.trim()}>
      {message.content && <div className="terminal-message-content">{message.content}</div>}
      {message.error && <div className="terminal-message-error">Error: {message.error}</div>}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="terminal-message-tool-calls">
          {message.toolCalls.map((toolCall) => (
            <ToolBlock
              key={toolCall.id}
              toolCall={toolCall}
              onApprove={onApprove ? () => onApprove(toolCall.id) : undefined}
              onReject={onReject ? () => onReject(toolCall.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============== TERMINAL CHAT ==============

interface TerminalChatProps {
  wsEndpoint: string;
}

export function TerminalChat({ wsEndpoint }: TerminalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isConnected, setIsConnected] = useState(false);

  const pendingApprovals = useRef<Map<string, string>>(new Map());
  const ws = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [messages]);

  // Convert server history message to client format
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

  // Handle server messages
  const handleServerMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'connected':
        console.log('Server says:', msg.message);
        break;

      case 'history': {
        const historyMessages = msg.messages.map(convertServerMessage);
        setMessages(historyMessages);
        break;
      }

      case 'user_message':
        break;

      case 'assistant_message': {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: msg.content,
          timestamp: new Date(),
        }]);
        break;
      }

      case 'tool_use': {
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

  // Send message
  const sendMessage = useCallback(() => {
    const content = input.trim();
    if (!content || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    setInputHistory(prev => [...prev, content]);
    setHistoryIndex(-1);

    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    }]);

    const clientMsg: ClientMessage = { type: 'chat', content };
    ws.current.send(JSON.stringify(clientMsg));
    setInput('');
  }, [input]);

  // Handle approval
  const handleApprove = useCallback((toolCallId: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    // Get the requestId for this tool (keyed by toolId)
    const requestId = pendingApprovals.current.get(toolCallId);
    if (!requestId) return;

    setMessages(prev => prev.map(m => ({
      ...m,
      toolCalls: m.toolCalls?.map(tc =>
        tc.id === toolCallId ? { ...tc, status: 'executing' as ToolCallInfo['status'] } : tc
      ),
    })));

    const clientMsg: ClientMessage = { type: 'tool_approval_response', requestId, approved: true };
    ws.current.send(JSON.stringify(clientMsg));
    pendingApprovals.current.delete(toolCallId);
  }, []);

  // Handle rejection
  const handleReject = useCallback((toolCallId: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    // Get the requestId for this tool (keyed by toolId)
    const requestId = pendingApprovals.current.get(toolCallId);
    if (!requestId) return;

    setMessages(prev => prev.map(m => ({
      ...m,
      toolCalls: m.toolCalls?.map(tc =>
        tc.id === toolCallId ? { ...tc, status: 'failed' as ToolCallInfo['status'], result: 'Rejected by user' } : tc
      ),
    })));

    const clientMsg: ClientMessage = { type: 'tool_approval_response', requestId, approved: false };
    ws.current.send(JSON.stringify(clientMsg));
    pendingApprovals.current.delete(toolCallId);
  }, []);

  // Keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'ArrowUp' && !e.shiftKey) {
      const textarea = e.currentTarget;
      if (textarea.selectionStart === 0 && inputHistory.length > 0) {
        e.preventDefault();
        const newIndex = Math.min(historyIndex + 1, inputHistory.length - 1);
        setHistoryIndex(newIndex);
        setInput(inputHistory[inputHistory.length - 1 - newIndex]);
      }
    }

    if (e.key === 'ArrowDown' && !e.shiftKey) {
      const textarea = e.currentTarget;
      if (textarea.selectionStart === textarea.value.length && historyIndex >= 0) {
        e.preventDefault();
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(newIndex < 0 ? '' : inputHistory[inputHistory.length - 1 - newIndex]);
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [inputHistory, historyIndex, sendMessage]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setHistoryIndex(-1);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }, []);

  return (
    <div className="terminal">
      <div className="terminal-header">
        <div className="terminal-header-title">
          <IconTerminal2 size={18} />
          <span>Claude Agent Terminal</span>
          <span className="terminal-header-status">{isConnected ? 'connected' : 'disconnected'}</span>
        </div>
      </div>

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
            <MessageBubble key={msg.id} message={msg} onApprove={handleApprove} onReject={handleReject} />
          ))
        )}
      </div>

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
