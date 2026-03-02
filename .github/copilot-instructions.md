# lifty — Copilot workspace instructions

## Icons & emoji
- **Never use Unicode emoji** in UI code (JSX, HTML, CSS). Always use [Lucide React](https://lucide.dev) icons instead.
- If a suitable Lucide icon doesn't exist, use a simple inline SVG.
- Lucide icons are already imported per-component — add to existing imports, don't add a new import block.

## Themes & colors
- Default theme is `lifty` (Catppuccin Mocha base + Pink `#f5c2e7` accent).
- Always use CSS variables (`var(--accent)`, `var(--bg)`, etc.) — never hardcode colors in JSX unless it's a static asset (SVG icon file).
- Catppuccin color reference: Mocha bg `#1e1e2e`, Pink `#f5c2e7`, Mauve `#cba6f7`.

## Code style
- Frontend is a single `App.jsx` file — add to it, don't create new component files unless explicitly asked.
- Styles go in `styles.css` — no CSS-in-JS libraries.
- Backend is FastAPI + SQLModel. Keep endpoints RESTful.

## Git workflow
- Active dev branch is `dev`. Never push directly to `main` without being asked.
- Commit messages: `fix:`, `feat:`, `ci:`, `docs:` prefixes.

## Docker
- Always rebuild with `docker compose up --build -d` after frontend/backend changes.
- Local app runs at http://localhost:5173.
