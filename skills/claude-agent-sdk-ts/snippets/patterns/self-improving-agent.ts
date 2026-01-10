/**
 * Claude Agent SDK - Self-Improving Agent Pattern
 *
 * Agents that can develop, test, and persist reusable skills.
 * Uses built-in file tools (Write, Read, Glob) - no custom MCP server needed.
 *
 * SECURITY: This pattern requires sandboxing and careful controls.
 * See: https://www.anthropic.com/engineering/code-execution-with-mcp
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

/**
 * Self-Improving Agent Requirements:
 *
 * 1. SANDBOXING (Critical)
 *    - Execute generated code in isolated environment
 *    - Use containers, VMs, or sandboxed processes
 *    - Limit filesystem, network, and resource access
 *
 * 2. SKILL VALIDATION
 *    - Test skills before persisting
 *    - Validate syntax and behavior
 *    - Review generated code before activation
 *
 * 3. VERSION CONTROL
 *    - Track skill versions and changes
 *    - Allow rollback to previous versions
 *    - Log all skill modifications
 */

/**
 * Skills are just files! No custom MCP server needed.
 *
 * Directory structure:
 * .claude/skills/
 * └── my-skill/
 *     ├── SKILL.md        # Required: Instructions with YAML frontmatter
 *     ├── scripts/        # Optional: Executable code
 *     │   └── helper.py
 *     └── references/     # Optional: Documentation
 *         └── api-docs.md
 *
 * SKILL.md format:
 * ```markdown
 * ---
 * name: my-skill
 * description: "What this skill does and when to use it"
 * ---
 *
 * # My Skill
 *
 * Instructions for Claude on how to use this skill...
 * ```
 */

/**
 * Self-improving agent using built-in file tools
 */
async function runSelfImprovingAgent() {
  console.log('Starting self-improving agent...\n');

  const q = query({
    prompt: `You are a self-improving agent. When you solve a problem,
             consider whether the solution could be useful in the future.

             If so, save it as a skill by writing to .claude/skills/<skill-name>/SKILL.md

             Current task: Create a utility that formats dates in multiple
             locales (US, UK, ISO). If this is useful, save it as a reusable skill.`,
    options: {
      model: 'sonnet',
      maxTurns: 20,
      cwd: process.cwd(),

      // Just need file tools - no custom MCP server required!
      allowedTools: ['Write', 'Read', 'Glob', 'Bash'],

      // Load existing skills so agent can see what's already available
      settingSources: ['project', 'local'],

      systemPrompt: `You are a self-improving coding assistant.

SKILL DEVELOPMENT GUIDELINES:
1. When you create useful utilities, save them as skills
2. Before creating a new skill, use Glob to check .claude/skills/ for existing ones
3. Skills are saved to: .claude/skills/<skill-name>/SKILL.md

SKILL.md FORMAT (required):
\`\`\`markdown
---
name: skill-name-here
description: "Clear description of what this skill does"
---

# Skill Title

Instructions for using this skill...

## Usage
Examples and guidance...
\`\`\`

OPTIONAL: Add scripts to .claude/skills/<skill-name>/scripts/
OPTIONAL: Add docs to .claude/skills/<skill-name>/references/

SECURITY AWARENESS:
- Skills run in the user's environment
- Avoid skills that modify system settings
- Never save credentials or secrets in skills
- Test thoroughly before saving`,
    },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && 'text' in block) {
          console.log(block.text);
        }
        if (block.type === 'tool_use' && 'name' in block) {
          console.log(`\n[Tool: ${block.name}]\n`);
        }
      }
    }

    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log(`\n--- Session complete. Cost: $${msg.total_cost_usd?.toFixed(4)} ---`);
    }
  }
}

/**
 * Example: What the agent might create
 *
 * File: .claude/skills/date-formatter/SKILL.md
 *
 * ```markdown
 * ---
 * name: date-formatter
 * description: "Format dates in multiple locales (US, UK, ISO). Use when
 *               working with international date formats or data exports."
 * ---
 *
 * # Date Formatter
 *
 * Provides consistent date formatting across locales.
 *
 * ## Supported Formats
 * - US: MM/DD/YYYY (e.g., 01/15/2025)
 * - UK: DD/MM/YYYY (e.g., 15/01/2025)
 * - ISO: YYYY-MM-DD (e.g., 2025-01-15)
 *
 * ## Usage
 * When formatting dates, use these patterns:
 * - For APIs and databases: ISO format
 * - For US users: US format
 * - For international users: UK or ISO format
 *
 * ## Code Template
 * ```typescript
 * function formatDate(date: Date, locale: 'US' | 'UK' | 'ISO'): string {
 *   const d = date.getDate().toString().padStart(2, '0');
 *   const m = (date.getMonth() + 1).toString().padStart(2, '0');
 *   const y = date.getFullYear();
 *
 *   switch (locale) {
 *     case 'US': return `${m}/${d}/${y}`;
 *     case 'UK': return `${d}/${m}/${y}`;
 *     case 'ISO': return `${y}-${m}-${d}`;
 *   }
 * }
 * ```
 * ```
 */

/**
 * Production Considerations:
 *
 * 1. SANDBOXED EXECUTION
 *    Before activating a skill, test it in a sandboxed environment:
 *    - Docker container with limited permissions
 *    - Firecracker microVM for stronger isolation
 *    - Resource limits (CPU, memory, time)
 *
 * 2. CODE REVIEW
 *    Optionally require human review before skill activation:
 *    - Save to .claude/skills-pending/ first
 *    - Use a pre-tool hook to block Skill tool until reviewed
 *    - Integrate with PR/review workflow
 *
 * 3. SKILL VERSIONING
 *    Track skill evolution:
 *    - Use git to version .claude/skills/
 *    - Add changelog section to SKILL.md
 *    - Consider timestamped backups
 *
 * 4. ACCESS CONTROL
 *    Limit what skills can do:
 *    - Review scripts before allowing execution
 *    - Use allowedTools to restrict skill capabilities
 *    - Monitor skill usage with PostToolUse hooks
 */

// Run the agent
runSelfImprovingAgent().catch(console.error);
