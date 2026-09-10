# Repository instructions

Simfluence is an Angular frontend for an influencer campaign forecasting product. Read `README.md` for the migration context, architecture, and project layout before making changes. The sibling `../simfluence-backend` repository owns Supabase migrations, edge functions, and backend operations; read its `AGENTS.md` before changing an integration contract.

## Development

- Use `npm start` for the development server.
- Run `npm test` for the Vitest suite and `npm run build` for a production build.
- Keep simulation and scoring formulas server-side. Do not move product IP into the browser bundle.
- Keep shared code in `src/app/core` or `src/app/shared`; feature-specific code belongs under `src/app/features`.
- Treat generated files under `src/app/generated` as generated artifacts and do not edit them manually.

## MCP

The Angular CLI MCP server is declared for supported clients in `.mcp.json`, `.codex/config.toml`, and `.vscode/mcp.json`. Keep these declarations equivalent when changing the server command or arguments.
