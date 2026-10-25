# BiteMark (tastemark-neon)

Personal food-journal PWA. React 19 + Vite + Tailwind 4 frontend; Neon Postgres/Auth/Data API backend; Vercel functions in `api/`.

**Read first, update after every decision/task:**
- `docs/frontend.md`: UI, components, client logic, decisions, open issues
- `docs/backend.md`: schema/RLS/RPCs, `api/`, scripts, env, decisions, open issues

Working rules:
- Do not run git commands that change state (no commit, branch, stash, push). The user handles git.
- Ask one question at a time, in chat text. Explain the question and each option. No popup question tool.
- Use superpowers skills, the Playwright MCP for testing (`npm run dev`), and the frontend-design skill for UI work.
