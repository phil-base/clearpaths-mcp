# Clearpaths MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that lets AI assistants read and manage your goals in [Clearpaths](https://app.clearpaths.pro).

## Setup

### 1. Get an API token

Go to your Clearpaths profile → API Tokens → create a token with the abilities you want (e.g. `goals:read`, `goals:write`, `comments:write`).

### 2. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "clearpaths": {
      "command": "npx",
      "args": ["clearpaths-mcp"],
      "env": {
        "CLEARPATHS_URL": "https://app.clearpaths.pro",
        "CLEARPATHS_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

### Or configure Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "clearpaths": {
      "command": "npx",
      "args": ["clearpaths-mcp"],
      "env": {
        "CLEARPATHS_URL": "https://app.clearpaths.pro",
        "CLEARPATHS_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

### Or run locally

```bash
git clone https://github.com/phil-base/clearpaths-mcp.git
cd clearpaths-mcp
npm install
cp .env.example .env  # edit with your URL and token
npm run dev
```

## Tools

| Tool | Description |
|------|-------------|
| `list_goals` | List goals with optional filters (status, area, tier, parent) |
| `get_goal` | Get detailed info about a goal (children, blockers, notes) |
| `get_goal_tree` | Get a goal's full hierarchy as a nested tree |
| `get_summary` | Goal counts: total, active, completed, deferred, blocked |
| `list_areas` | List areas (life categories) in the current chapter |
| `list_goal_tiers` | List goal tiers (hierarchy levels) in the current chapter |
| `create_goal` | Create a new goal (root or sub-goal) |
| `update_goal` | Update a goal's title, description, area, tier, or parent |
| `delete_goal` | Delete a goal and all descendants |
| `complete_goal` | Mark a goal as complete (with optional note) |
| `cancel_goal` | Cancel a goal (with optional note) |
| `defer_goal` | Defer a goal (hide from execution views) |
| `undefer_goal` | Bring a deferred goal back to active |
| `block_goal` | Mark a goal as blocked by another goal |
| `unblock_goal` | Remove a blocking relationship |
| `add_progress_note` | Add a progress note to a goal |
| `list_progress_notes` | List all progress notes on a goal |

## Resources

| Resource | URI | Description |
|----------|-----|-------------|
| Current Chapter | `clearpaths://chapters/current` | Current chapter info |
| Blocked Goals | `clearpaths://goals/blocked` | Goals that are currently blocked |
| Goal Summary | `clearpaths://goals/summary` | Counts of goals by status |

## Token Abilities

Create tokens with only the abilities you need:

| Ability | What it allows |
|---------|---------------|
| `goals:read` | List, view, tree, summary |
| `goals:write` | Create, update, delete, complete, cancel, defer, block |
| `comments:read` | List progress notes |
| `comments:write` | Add and delete progress notes |
| `areas:read` | List areas |
| `goal-tiers:read` | List goal tiers |
| `chapters:read` | List and view chapters |

For full access, create a token with all abilities or use `*`.

## License

MIT
