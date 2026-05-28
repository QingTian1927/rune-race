# Rune Race

A multiplayer turn-based web game monorepo built with modern web technologies.

## Workspaces

- **apps/web** - React + Vite + React Three Fiber (3D client)
- **apps/server** - Fastify + Socket.IO (WebSocket server)
- **packages/shared** - Shared types, schemas, and protocol definitions

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 11

### Installation

```bash
pnpm install
```

### Development

Run all services (web + server) in parallel:

```bash
pnpm dev
```

This starts:
- 🌐 Web app: http://localhost:5173
- 🔌 WebSocket server: http://localhost:3000

#### Run Individual Services

Run only the web app:
```bash
pnpm dev:web
```

Run only the server:
```bash
pnpm dev:server
```

### Build

Build all workspaces:
```bash
pnpm build
```

Build specific workspace:
```bash
pnpm build:web
pnpm build:server
pnpm build:shared
```

### TypeScript

Type check the web app:
```bash
pnpm type-check
```

## Project Structure

```
.
├── apps/
│   ├── web/          # React client with 3D rendering
│   └── server/       # Fastify WebSocket server
├── packages/
│   └── shared/       # Shared types and protocol
└── assets/           # 3D models (KayKit collections)
```

## Features

- ✨ 3D rendering with Three.js + React Three Fiber
- 🎮 Real-time multiplayer via Socket.IO
- 🎨 Tailwind CSS + shadcn/ui components
- 📦 Monorepo with shared types across client/server
- 🚀 Production-ready deployment configs (Vercel + Render)

## Deployment

- **Client**: Deploy to [Vercel](https://vercel.com)
- **Server**: Deploy to [Render](https://render.com)
- **Database**: Supabase PostgreSQL + Auth

See [DEPLOY.md](./DEPLOY.md) for deploying the API and static client on **Render** (Blueprint in [`render.yaml`](./render.yaml)).
