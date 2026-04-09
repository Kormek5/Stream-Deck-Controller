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
- **Routes**: `/api/profiles`, `/api/profiles/:id/buttons`, `/api/buttons`, `/api/buttons/:id/execute`, `/api/activity`, `/api/stats`

## Database Schema

- `profiles` — button deck profiles (Gaming, Work, Media, etc.)
- `buttons` — individual buttons with action config per profile
- `activity` — log of all button executions

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
