/**
 * Claude Agent SDK - Settings Sources Configuration
 *
 * Configure settingSources to load settings from filesystem.
 * This enables .claude/ directory features like agents, commands, and hooks.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as path from 'path';

/**
 * Settings sources options:
 *
 * - 'user': ~/.claude/settings.json - User-wide settings
 * - 'project': .claude/settings.json - Project settings (checked into git)
 * - 'local': .claude/settings.local.json - Local overrides (gitignored)
 *
 * When enabled, these files are also loaded from .claude/:
 * - CLAUDE.md: Persistent context/memory
 * - agents/*.md: Subagent definitions
 * - commands/*.md: Slash command expansions
 * - output-styles/*.md: Custom output formatting
 * - hooks/: File-based hooks
 */

/**
 * Example 1: Project settings only
 *
 * Loads .claude/settings.json and related files.
 * Good for team projects where settings are version controlled.
 */
const projectSettingsQuery = query({
  prompt: 'Help me with this project.',
  options: {
    model: 'sonnet',
    cwd: process.cwd(),
    settingSources: ['project'],
  },
});

/**
 * Example 2: Project + local settings
 *
 * Loads both project settings and local overrides.
 * Local settings take precedence.
 */
const projectAndLocalQuery = query({
  prompt: 'Run the tests for this project.',
  options: {
    model: 'sonnet',
    cwd: process.cwd(),
    settingSources: ['project', 'local'],
  },
});

/**
 * Example 3: Full settings hierarchy
 *
 * Loads user, project, and local settings.
 * Precedence: local > project > user
 */
const fullSettingsQuery = query({
  prompt: 'What do you know about my preferences?',
  options: {
    model: 'sonnet',
    cwd: process.cwd(),
    settingSources: ['user', 'project', 'local'],
  },
});

/**
 * Example 4: No settings (full programmatic control)
 *
 * Default behavior - no filesystem settings loaded.
 * All configuration must be provided in options.
 */
const noSettingsQuery = query({
  prompt: 'A standalone query without any settings.',
  options: {
    model: 'sonnet',
    cwd: process.cwd(),
    // settingSources not specified = no filesystem settings
  },
});

/**
 * Example 5: Specific project directory
 *
 * Point to a different project's settings.
 */
const otherProjectQuery = query({
  prompt: 'Help with the other project.',
  options: {
    model: 'sonnet',
    cwd: '/path/to/other/project',
    settingSources: ['project', 'local'],
  },
});

/**
 * Example .claude/ directory structure:
 *
 * .claude/
 * ├── settings.json         # Project settings
 * ├── settings.local.json   # Local overrides (gitignored)
 * ├── CLAUDE.md             # Persistent context
 * ├── agents/               # Subagent definitions
 * │   ├── researcher.md
 * │   └── writer.md
 * ├── commands/             # Slash commands
 * │   ├── deploy.md
 * │   └── test.md
 * ├── output-styles/        # Output formatting
 * │   ├── executive.md
 * │   └── technical.md
 * └── hooks/                # File-based hooks
 *     └── audit-logger.py
 */

async function main() {
  // Run with project settings
  for await (const msg of projectAndLocalQuery) {
    if (msg.type === 'assistant' && msg.message) {
      const text = msg.message.content.find(
        (c: any): c is { type: 'text'; text: string } => c.type === 'text'
      );
      if (text) console.log(text.text);
    }
  }
}

main().catch(console.error);

/**
 * Example settings.json content:
 *
 * {
 *   "permissions": {
 *     "allow": ["Read", "Write", "Bash"],
 *     "deny": ["WebSearch"]
 *   },
 *   "model": "sonnet",
 *   "hooks": {
 *     "PreToolUse": ["hooks/validator.py"]
 *   }
 * }
 */
