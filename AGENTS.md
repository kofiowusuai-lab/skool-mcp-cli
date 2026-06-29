# AGENTS.md

## Purpose

This repo is a local CLI and MCP server for Skool classroom/community automation. Agents use it to inspect communities, draft classroom changes, and apply owner-approved updates through a real browser session.

## Start

```bash
npm install
npm test
npm run typecheck
npm run build
```

## Login

Use a dedicated local browser profile. The profile stores the user's Skool session and must never be committed.

```bash
npm run cli -- --headed login --community https://www.skool.com/YOUR-COMMUNITY/classroom
```

## Agent Rules

- Only use this tool on Skool communities the user owns or administers.
- Mutating commands are dry-run by default. Add `--execute` only after the user approves the exact operation.
- Do not commit `.skool-profile/`, `artifacts/`, screenshots, traces, cookies, or session data.
- Prefer `community map` and `list` before edits so the agent has current structure.
- Stop if the Skool UI is ambiguous, logged out, or presents an unexpected security prompt.

## MCP

After `npm install`, agents can point MCP clients at:

```json
{
  "mcpServers": {
    "skool": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/skool-mcp-cli"
    }
  }
}
```

Use `.env.example` for local defaults. Keep real profile paths and run artifacts local.
