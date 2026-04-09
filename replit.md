# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (Tailwind CSS, shadcn/ui, framer-motion)

## Artifacts

### StreamDeck Panel (`artifacts/streamdeck`)
- **Preview path**: `/`
- **Purpose**: Browser-based StreamDeck control panel — programmable buttons to trigger actions from PC or phone
- **Features**: Profiles, customizable buttons, action types (URL, Hotkey, Script, VPN, Steam, App, Media), activity log, usage stats
- **Stack**: React + Vite, Tailwind CSS, shadcn/ui, framer-motion, wouter

### API Server (`artifacts/api-server`)
- **Preview path**: `/api`
- **Routes**: `/api/profiles`, `/api/profiles/:id/buttons`, `/api/folders`, `/api/buttons`, `/api/buttons/:id/execute`, `/api/activity`, `/api/stats`, `/api/agent-status`
- **WebSocket**: `/api/ws/agent` — real-time channel for desktop agents

## Desktop Agent Architecture

- Agent script: `artifacts/streamdeck/public/agent/agent.js` (downloadable, Node.js 18+)
- One external dep: `ws` (WebSocket client)
- Server-side bridge: `artifacts/api-server/src/lib/agent-bridge.ts`
- When a button is pressed, the execute route calls `sendToAllAgents()` which forwards the command to all connected desktop agents via WebSocket
- Agent handles 28 action types: real hotkeys, system commands (lock/sleep/shutdown), media keys, URL schemes (zoom://, discord://, spotify:), and more

## Database Schema

- `profiles` — button deck profiles (Gaming, Work, Media, etc.)
- `folders` — folders for grouping buttons within a profile
- `buttons` — individual buttons with action config per profile (nullable `folderId` FK)
- `activity` — log of all button executions

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
