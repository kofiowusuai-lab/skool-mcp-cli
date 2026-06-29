# Skool MCP/CLI

Local CLI and MCP server for Skool Classroom automation.

This tool drives Skool through a dedicated Playwright browser profile. It is built for Skool communities you own or administer. It does not collect Skool credentials, bypass login, or use private write APIs as the primary automation path.

## Install

```bash
git clone https://github.com/kofiowusuai-lab/skool-mcp-cli.git
cd skool-mcp-cli
npm install
npm test
npm run typecheck
npm run build
```

## Login

Use a separate Playwright profile for Skool:

```bash
npm run cli -- --headed login --community https://www.skool.com/YOUR-COMMUNITY/classroom
```

The first login should use `--headed` so Chromium opens with the persistent profile directory `.skool-profile/`. Complete Skool login manually in that browser profile. Future CLI and MCP runs reuse that profile and run headless by default.

Auto-login is enabled by default. If a command detects that Skool has logged out, it relaunches the same profile in a visible browser, waits up to 5 minutes for you to complete login, closes the browser, then retries the original command headless.

Disable auto-login for fail-fast scripts:

```bash
npm run cli -- --no-auto-login list --community https://www.skool.com/YOUR-COMMUNITY/classroom
```

## CLI

All mutating commands default to dry-run. Add `--execute` only when you want to apply the change to Skool.

```bash
npm run cli -- list --community https://www.skool.com/YOUR-COMMUNITY/classroom
```

```bash
npm run cli -- module create \
  --community https://www.skool.com/YOUR-COMMUNITY/classroom \
  --title "Start Here"
```

```bash
npm run cli -- module create \
  --community https://www.skool.com/YOUR-COMMUNITY/classroom \
  --title "Start Here" \
  --execute
```

```bash
npm run cli -- lesson create \
  --community https://www.skool.com/YOUR-COMMUNITY/classroom \
  --module "Start Here" \
  --title "Welcome" \
  --body-file ./lesson.md \
  --video-url https://video.example.com/welcome
```

Native Skool video upload uses `--video-file`. The file path is the local source file the CLI uploads into Skool's native upload control:

```bash
npm run cli -- lesson create \
  --community https://www.skool.com/YOUR-COMMUNITY/classroom \
  --module "Start Here" \
  --title "Uploaded Video Lesson" \
  --body-file ./lesson.md \
  --video-file /absolute/path/video.mp4 \
  --execute
```

Lesson image and module/course cover upload fields are also available:

```bash
npm run cli -- lesson edit \
  --community https://www.skool.com/YOUR-COMMUNITY/classroom \
  --lesson "Uploaded Video Lesson" \
  --image-file /absolute/path/image.png \
  --execute
```

```bash
npm run cli -- module create \
  --community https://www.skool.com/YOUR-COMMUNITY/classroom \
  --title "Module With Cover" \
  --cover-image-file /absolute/path/cover.png \
  --execute
```

```bash
npm run cli -- lesson edit \
  --community https://www.skool.com/YOUR-COMMUNITY/classroom \
  --lesson "Welcome" \
  --video-url https://video.example.com/new-link \
  --execute
```

### Targeting a lesson

`lesson edit` locates the lesson by exact title (`--lesson`). Titles inside one
module can be substrings of each other (for example `TRANSITIONS` and
`TEMPLATED TRANSITIONS`), so for unambiguous targeting pass the direct lesson URL
instead. Open the lesson in Skool and copy the URL; the `md=<unit_id>` selects
the exact lesson:

```bash
npm run cli -- lesson edit \
  --community https://www.skool.com/YOUR-COMMUNITY/classroom \
  --lesson-url "https://www.skool.com/YOUR-COMMUNITY/classroom/<course>?md=<unit_id>" \
  --title "New Title" \
  --body-file ./lesson.md \
  --execute
```

When `--lesson` is used and the lesson sits inside a module that is not open by
default, pass `--module "Module Name"` so the CLI opens the module first.

### Body content

`--body-file` and `--body` accept Markdown. The CLI converts it (headings,
bullet lists, numbered lists, inline `code`) into an HTML fragment and pastes it
into Skool's tiptap editor, which maps it onto the editor schema. Typing
Markdown directly is avoided because the editor's input rules are inconsistent.
Re-running an edit with content that already matches is a safe no-op: Skool
disables Save when there is no change, and the CLI reports
`No changes to apply`.

Batch operations can be applied from a JSON manifest. Batch commands are dry-run by default:

```bash
npm run cli -- batch apply --file /absolute/path/skool-batch.json
```

Apply the batch in order:

```bash
npm run cli -- batch apply --file /absolute/path/skool-batch.json --execute
```

Example manifest:

```json
{
  "communityUrl": "https://www.skool.com/YOUR-COMMUNITY/classroom",
  "operations": [
    {
      "type": "module.create",
      "title": "New Module"
    },
    {
      "type": "lesson.create",
      "moduleTitle": "New Module",
      "title": "Lesson 1",
      "bodyFile": "/absolute/path/lesson-1.md",
      "videoFile": "/absolute/path/video-1.mp4"
    },
    {
      "type": "lesson.edit",
      "lessonTitle": "Existing Lesson",
      "bodyFile": "/absolute/path/rewrite.md"
    }
  ]
}
```

## Community Map

The community map command inventories the visible Skool community tabs in a read-only scan: Community, Classroom, Calendar, Members, Map, Leaderboards, and About.

Run a concise summary scan:

```bash
npm run cli -- community map --community https://www.skool.com/YOUR-COMMUNITY
```

Return the full JSON manifest:

```bash
npm run cli -- community map --community https://www.skool.com/YOUR-COMMUNITY --json
```

Run a bounded one-level detail scan and return JSON:

```bash
npm run cli -- community map --community https://www.skool.com/YOUR-COMMUNITY --deep --json
```

This command is read-only and does not accept `--execute`. Deep scans are capped at 10 detail items per tab.

## MCP

Start the MCP server over stdio:

```bash
npm run mcp
```

Example MCP client config:

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

Tools exposed:

- `skool_check_login`
- `skool_list_classroom`
- `skool_create_module`
- `skool_create_lesson`
- `skool_update_lesson`
- `skool_reorder_lessons`
- `skool_map_community`

`skool_reorder_lessons` currently returns a guarded result instead of performing drag-and-drop. Reordering should only be enabled after manual validation against the live Skool UI.

`skool_map_community` returns the structured community map manifest for a Skool community URL. It accepts `communityUrl` plus the standard optional browser/profile fields, and supports `deep` for the same bounded one-level detail scan as the CLI.

## Agent Quick Start

When another user gives this repo link to an agent, the expected flow is:

```bash
git clone https://github.com/kofiowusuai-lab/skool-mcp-cli.git
cd skool-mcp-cli
cp .env.example .env
npm install
npm test
npm run build
npm run cli -- --headed login --community https://www.skool.com/YOUR-COMMUNITY/classroom
npm run cli -- list --community https://www.skool.com/YOUR-COMMUNITY/classroom
```

Agents should map/list first, propose the exact changes, and only add `--execute` after the user approves. More agent-specific rules are in `AGENTS.md`.

## Configuration

CLI flags override environment variables.

| Env var | Purpose | Default |
| --- | --- | --- |
| `SKOOL_PROFILE_DIR` | Persistent Playwright profile | `.skool-profile` |
| `SKOOL_ARTIFACT_DIR` | Failure screenshots/traces | `artifacts` |
| `SKOOL_COMMUNITY_URL` | Default community URL for future extension | unset |
| `SKOOL_HEADLESS` | Run browser headless | `true` |
| `SKOOL_AUTO_LOGIN` | Open a headed browser automatically when login is required | `true` |
| `SKOOL_EXECUTE` | Default execute mode for programmatic callers | `false` |

## Safety

- Write actions default to dry-run.
- Use `--execute` to mutate Skool.
- Batch manifests run operations in order and stop on the first failed operation.
- Routine commands run headless by default. Use `--headed` for login, security prompts, or selector debugging.
- Auto-login opens a visible browser only when Skool requires login, waits for completion, then closes it.
- The tool saves screenshots for failed live Playwright actions.
- Native upload support uses Skool's browser upload controls with `--video-file`, `--image-file`, and `--cover-image-file`.
- If Skool's upload control or completion state is ambiguous, the command fails with screenshot artifacts instead of saving blindly.
- Community map scans are read-only, do not use `--execute`, do not fill forms, and cap deep scans at 10 detail items per tab.
- Live selectors may need hardening after the first logged-in run because Skool does not expose a stable public API for Classroom writes.

## Verification

```bash
npm test
npm run typecheck
npm run build
npm run cli -- --help
```
