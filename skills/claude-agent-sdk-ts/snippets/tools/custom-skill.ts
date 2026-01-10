/**
 * Claude Agent SDK - Custom Skill Tool
 *
 * The Skill tool loads custom skills from .claude/skills/ directories.
 * Skills are "expertise packages" containing instructions, templates, and scripts.
 *
 * Source: https://github.com/anthropics/claude-agent-sdk-typescript
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import * as path from 'path';

/**
 * Using the Skill tool requires:
 * 1. allowedTools includes 'Skill'
 * 2. settingSources includes 'project' (to load from .claude/skills/)
 * 3. Skills defined in .claude/skills/<skill-name>/SKILL.md
 */

/**
 * Example: Resume Generator using docx skill
 *
 * Directory structure:
 * project/
 * ├── .claude/
 * │   └── skills/
 * │       └── docx/
 * │           ├── SKILL.md      # Skill instructions
 * │           └── docx-js.md    # Reference documentation
 * └── src/
 *     └── agent.ts
 */
async function generateResume(personName: string) {
  console.log(`Generating resume for: ${personName}`);

  const q = query({
    prompt: `Research "${personName}" and create a professional 1-page resume as a .docx file.`,
    options: {
      model: 'sonnet',
      maxTurns: 30,
      cwd: process.cwd(),

      // Enable Skill tool + other needed tools
      allowedTools: ['Skill', 'WebSearch', 'WebFetch', 'Bash', 'Write', 'Read'],

      // CRITICAL: Load skills from .claude/skills/
      settingSources: ['project'],

      systemPrompt: `You are a professional resume writer.
Use the docx skill to create formatted Word documents.
Research the person first, then generate their resume.`,
    },
  });

  for await (const msg of q) {
    if (msg.type === 'assistant' && msg.message) {
      for (const block of msg.message.content) {
        if (block.type === 'text' && 'text' in block) {
          console.log(block.text);
        }
        if (block.type === 'tool_use' && 'name' in block) {
          console.log(`[Tool: ${block.name}]`);
        }
      }
    }
  }
}

/**
 * SKILL.md Format
 *
 * Skills are defined in markdown files with YAML frontmatter:
 *
 * ```markdown
 * ---
 * name: my-skill
 * description: "What this skill does. Include activation triggers."
 * ---
 *
 * # Skill Name
 *
 * ## Activation Triggers
 * This skill activates when the conversation mentions:
 * - "keyword1", "keyword2"
 * - "phrase that triggers this skill"
 *
 * ## Instructions
 * Detailed instructions for Claude on how to use this skill...
 *
 * ## Templates
 * Code templates or examples...
 * ```
 */

/**
 * Example Skill: Executive Briefing
 *
 * File: .claude/skills/executive-briefing/SKILL.md
 *
 * ---
 * name: executive-briefing
 * description: "Transforms research into executive-ready briefings.
 *               Activates on 'executive', 'briefing', 'C-suite', 'board'."
 * ---
 *
 * # Executive Briefing Skill
 *
 * ## The BLUF Principle (Bottom Line Up Front)
 * Start with the conclusion. Executives are busy - lead with what matters.
 *
 * ## One-Page Format
 * [template structure...]
 */

/**
 * Skills can include additional resources:
 *
 * .claude/skills/pdf/
 * ├── SKILL.md           # Main instructions
 * ├── REFERENCE.md       # Detailed API reference
 * ├── FORMS.md           # Form-filling guide
 * └── scripts/           # Helper scripts
 *     ├── fill_pdf_form.py
 *     └── extract_form_fields.py
 */

/**
 * Built-in skill types (when using settingSources):
 *
 * - Document generation (docx, xlsx, pdf, pptx)
 * - Custom workflows (email automation, report generation)
 * - Domain expertise (financial analysis, code review)
 */

// Example usage
async function main() {
  const personName = process.argv[2] || 'Example Person';
  await generateResume(personName);
}

main().catch(console.error);
