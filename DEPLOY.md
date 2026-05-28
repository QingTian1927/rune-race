# Deploying Rune Race on Render

Stack:

| Piece | Render service | Notes |
|--------|----------------|--------|
| **Client** | Static Site `rune-race-web` | Vite build → `apps/web/dist` |
| **API + WebSocket** | Web Service `rune-race-api` | Fastify + Socket.IO |
| **Auth + DB** | [Supabase](https://supabase.com) | Not hosted on Render |

## Prerequisites

1. Git repo pushed to GitHub/GitLab.
2. Supabase project with:
   - **Anonymous sign-in** enabled (Settings → Auth → Providers).
   - `profiles` table and RLS policies (see server docs).
3. [Render](https://render.com) account.

## Option A — Blueprint (recommended)

1. Render Dashboard → **New** → **Blueprint**.
2. Connect this repository.
3. Render reads [`render.yaml`](./render.yaml) and creates **two** services.
4. Set secret env vars when prompted (or after deploy):

   **API (`rune-race-api`)**

   | Variable | Value |
   |----------|--------|
   | `SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `SUPABASE_SECRET_KEY` | Service role key (server only, never expose to client) |
   | `CLIENT_ORIGIN` | `https://rune-race-web.onrender.com` (your static site URL) |

   **Web (`rune-race-web`)**

   | Variable | Value |
   |----------|--------|
   | `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon / publishable key |
   | `VITE_API_URL` | Set automatically from API `RENDER_EXTERNAL_URL` via blueprint |

5. Deploy. Wait for API health check: `https://<api-host>/health` → `{ "status": "ok" }`.

## Option B — Manual services

### 1. API (Web Service)

- **Root directory:** repository root  
- **Runtime:** Node  
- **Build command:**

  ```bash
  corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile && pnpm build:shared && pnpm build:game-engine && pnpm build:server
  ```

- **Start command:**

  ```bash
  cd apps/server && node dist/index.js
  ```

- **Health check path:** `/health`

- **Environment:** `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `CLIENT_ORIGIN`, `NODE_ENV=production`  
  (`PORT` is injected by Render automatically.)

### 2. Web (Static Site)

- **Build command:**

  ```bash
  corepack enable && corepack prepare pnpm@latest --activate && pnpm install --frozen-lockfile && pnpm build:shared && pnpm build:web
  ```

- **Publish directory:** `apps/web/dist`

- **Rewrite rule (SPA):** `/*` → `/index.html` (included in `render.yaml` and `apps/web/public/_redirects`)

- **Environment (build time):**

  ```bash
  VITE_API_URL=https://<your-api-service>.onrender.com
  VITE_SUPABASE_URL=...
  VITE_SUPABASE_PUBLISHABLE_KEY=...
  ```

  Redeploy the static site after changing any `VITE_*` variable.

## Supabase auth redirects

In Supabase → **Authentication** → **URL configuration**, add:

- **Site URL:** `https://rune-race-web.onrender.com` (your static URL)
- **Redirect URLs:** same origin + `/auth/login`, e.g.  
  `https://rune-race-web.onrender.com/**`

## Local vs production

| | Local | Production |
|---|--------|------------|
| Web | `pnpm dev:web` → :5173 | Static site on Render |
| API | `pnpm dev:server` → :3000 | Web service on Render |
| `VITE_API_URL` | empty (Vite proxy) or `http://localhost:3000` | `https://<api>.onrender.com` |
| Socket.IO | proxied in dev | connects to `VITE_API_URL` |

## Verify after deploy

1. Open the static site URL — home page loads.
2. Create/join lobby — WebSocket connects (browser devtools → Network → `socket.io`).
3. Sign in / guest profile — Supabase + `GET /api/profile` work.
4. Play a game — dice, moves, HUD update.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Web builds but API calls fail | `VITE_API_URL` must be `https://…`, rebuild static site after changing it |
| Socket disconnects | `CLIENT_ORIGIN` on API must include exact web URL (scheme + host) |
| Profile 500 | `SUPABASE_SECRET_KEY` on API; table `profiles` exists |
| SPA 404 on refresh | Static rewrite `/* → /index.html` |
| API build fails | Run `pnpm build:shared && pnpm build:game-engine && pnpm build:server` locally |

## Other hosts

- **Client only on Vercel:** [`vercel.json`](./vercel.json) — set `VITE_API_URL` to your Render API URL.
- **Monorepo build locally:** `pnpm build` builds all workspaces.
