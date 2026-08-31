# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev       # Dev server with nodemon (watches src/, auto-restarts)
npm run start           # Production start via babel-node
npm test                # Run unit tests (Jest)
npm run test:e2e        # Run e2e tests (supertest)
npm run test:cov        # Test coverage report
npm run lint            # ESLint
npm run format          # Prettier
npm run db:seed         # Seed database (scripts/seed.js)
```

Run a single test: `npx jest --testPathPattern=<pattern>` (e.g. `npx jest auth.service`).

## Architecture

NestJS backend (JavaScript, not TypeScript) using Babel for ES6+ transpilation. API prefix is `/api`. Swagger docs at `/api/docs`.

**Database:** PostgreSQL via Supabase SDK (`@supabase/supabase-js`). No ORM — raw Supabase queries through `SupabaseDbService` (`src/supabase/supabase-db.service.js`) which provides `findMany`, `findOne`, `insert`, `update`, `remove`. All tables have Row Level Security enabled. SQL migrations live in `migrations/`.

**Auth:** JWT Bearer tokens via Supabase Auth. `JwtAuthGuard` validates tokens by calling `supabase.auth.getUser(token)`. Use `@CurrentUser()` decorator to access the authenticated user. Role-based access uses `@Roles('OWNER')` + `@UseGuards(JwtAuthGuard, RolesGuard)` — the RolesGuard checks the `team_members` table for org-scoped roles.

**DI pattern:** Uses `@Dependencies()` decorator with manual constructor assignment (NestJS JS style), not constructor parameter injection.

## Module layout

Feature modules go in `src/modules/<feature>/` with `<feature>.module.js`, `<feature>.controller.js`, `<feature>.service.js`. Shared code (guards, decorators, filters, interceptors) goes in `src/common/`. Supabase integration is a global module in `src/supabase/`.

## Conventions (from CONVENTIONS.md)

- File names: lowercase kebab-case (`auth.controller.js`)
- Folder names: plural for features (`modules/users/`), singular for shared (`common/`, `config/`)
- Routes: lowercase plural nouns, RESTful verbs — no action words in URLs
- All endpoints must have Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBearerAuth` for protected routes)
- DTOs use `class-validator` decorators; global `ValidationPipe` is configured with `whitelist`, `forbidNonWhitelisted`, and `transform`

## Config

Environment variables validated via Joi schema in `src/config/config.schema.js`. Required: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Default port is `3000` (overridable via `PORT`).

## Error handling

Global exception filter (`src/common/filters/global-exception.filter.js`) returns a standardized shape: `{ statusCode, timestamp, path, message }`. Services throw NestJS HTTP exceptions (`UnauthorizedException`, `ConflictException`, etc.).
