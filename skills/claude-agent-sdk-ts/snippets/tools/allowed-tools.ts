/**
 * Claude Agent SDK - Tool Configuration
 *
 * Examples of configuring allowed and disallowed tools.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Available built-in tools:
 *
 * File Operations:
 * - Read: Read file contents
 * - Write: Create new files
 * - Edit: Edit existing files
 * - MultiEdit: Multiple edits in one call
 * - Glob: Find files by pattern
 * - Grep: Search file contents
 *
 * Execution:
 * - Bash: Run shell commands
 * - BashOutput: Alternative bash tool
 * - KillBash: Kill running bash processes
 *
 * Search:
 * - WebSearch: Search the web
 * - WebFetch: Fetch web page contents
 *
 * Orchestration:
 * - Task: Run subagents
 *
 * User Interaction:
 * - AskUserQuestion: Prompt user for input
 * - TodoWrite: Create/update todo lists
 *
 * Notebooks:
 * - NotebookEdit: Edit Jupyter notebooks
 *
 * Other:
 * - ExitPlanMode: Exit plan mode
 * - LS: List directory contents
 * - Skill: Execute custom skills
 */

// Example 1: Read-only agent (no file modifications)
const readOnlyQuery = query({
  prompt: 'Analyze the codebase structure.',
  options: {
    model: 'sonnet',
    allowedTools: ['Read', 'Glob', 'Grep'],
  },
});

// Example 2: File operations only (no network or shell)
const fileOnlyQuery = query({
  prompt: 'Refactor the utils.ts file.',
  options: {
    model: 'sonnet',
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'],
    disallowedTools: ['Bash', 'WebSearch', 'WebFetch'],
  },
});

// Example 3: Full Claude Code capabilities
const fullCapabilitiesQuery = query({
  prompt: 'Build a new feature.',
  options: {
    model: 'sonnet',
    tools: { type: 'preset', preset: 'claude_code' },
  },
});

// Example 4: No tools (pure conversation)
const conversationOnlyQuery = query({
  prompt: 'Explain the benefits of TypeScript.',
  options: {
    model: 'sonnet',
    tools: [], // Disable all tools
  },
});

// Example 5: Specific tool set for research
const researchQuery = query({
  prompt: 'Research best practices for error handling.',
  options: {
    model: 'sonnet',
    allowedTools: ['WebSearch', 'WebFetch', 'Read'],
  },
});

// Example 6: Development workflow tools
const devWorkflowQuery = query({
  prompt: 'Fix the failing tests.',
  options: {
    model: 'sonnet',
    allowedTools: [
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'Bash',      // For running tests
      'TodoWrite', // For tracking progress
    ],
  },
});

// Run one of the examples
async function main() {
  for await (const msg of readOnlyQuery) {
    if (msg.type === 'assistant' && msg.message) {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) console.log(text.text);
    }
  }
}

main().catch(console.error);
