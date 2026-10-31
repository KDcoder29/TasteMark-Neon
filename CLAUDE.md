# BiteMark (tastemark-neon)

Personal food-journal PWA. Next.js 16 (single-page mode: the whole app is client-side) + React 19 + Tailwind 4; Neon Postgres/Auth/Data API backend; API routes in `app/api/*` (logic in `server/`).

**Read first, update after every decision/task:**
- `docs/frontend.md`: UI, components, client logic, decisions, open issues
- `docs/backend.md`: schema/RLS/RPCs, `api/`, scripts, env, decisions, open issues

Working rules:
- Do not run git commands that change state (no commit, branch, stash, push). The user handles git.
- Ask one question at a time, in chat text. Explain the question and each option. No popup question tool.
- Use superpowers skills, the Playwright MCP for testing (`npm run dev`, port 5175), and the frontend-design skill for UI work.
- Next.js 16 has breaking changes from older versions: read the guide in `node_modules/next/dist/docs/` before using a Next.js API.
- `npm run build` writes `.next/` (gitignored). Tests: `npm test` (Vitest, `vitest.config.js`).
