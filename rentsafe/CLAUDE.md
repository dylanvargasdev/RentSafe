@AGENTS.md

## Claude Code notes

- Skills are available as `/build-dapp`, `/trustless-work`, `/scaffold-stellar`,
  `/soroban-contracts`, `/stellar-basics`, `/cavos` (`.claude/skills/*` are
  symlinks to `.agents/skills/*`). If they're missing (e.g. Windows checkout),
  run `npm run agents:sync`.
- Project MCP servers in `.mcp.json` are optional docs helpers (`stellar-raven`
  for Stellar docs and ecosystem data needs a one-time browser sign-in: `/mcp` →
  Authenticate); approve them when prompted.
