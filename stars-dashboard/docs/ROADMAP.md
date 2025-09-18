# Roadmap

This document outlines the planned improvements and milestones for Stars Dashboard. Timelines are indicative and priorities may change based on feedback and issues.

## Goals
- Deliver a reliable, fast, and accessible way to explore a user's starred repositories
- Provide convenient export options (CSV/JSON) for current view and full history
- Maintain strong code quality: type-safety, tests, and consistent design system

## Milestones

### v0.2 — Stabilization and polish (Short term)
- Build health: resolve remaining TypeScript/ESLint issues (remove `any`, unused vars) [high]
- Image optimization: complete next/image migration and verify remote patterns config [high]
- Export: improve error handling; clear user feedback for success/failure states [high]
- UX: refine pagination controls and per-page selector; keyboard focus management [high]
- Accessibility: confirm labels, landmarks, and visible focus across flows [high]
- Performance: memoize list items where appropriate; avoid unnecessary re-renders [medium]

### v0.3 — Features and reliability
- Topics metadata: cache and batch-fetch topics to reduce API calls [high]
- Filters: filter by language/topic, and text search within results [high]
- Export “All”: robust server-side pagination/aggregation; progress feedback in UI [high]
- Error states: rate-limit and network error guidance with actionable recovery [medium]
- Tests: add unit tests for utils and API routes; component tests for critical UI [medium]

### v0.4 — Integrations and hardening
- Auth (optional): NextAuth + GitHub to raise rate limits and personalize defaults [medium]
- Persistence: remember last username, per-page setting; lightweight local storage [medium]
- Analytics: basic anonymous usage metrics to inform UX improvements [low]
- Docs: expand developer docs (contributing, architecture, API reference) [medium]

### v1.0 — Production readiness
- Database (optional): Prisma-backed cache for starred metadata and faster browsing [medium]
- Background sync jobs and incremental updates [medium]
- Security: input sanitization review, rate limiting, and abuse prevention checklist [high]
- CI/CD: lint, typecheck, tests, and preview deploys on PRs [high]
- Monitoring: error tracking (e.g., Sentry) and performance (Web Vitals) [medium]
- Deployment: Vercel guide, environment configuration, and operational runbook [medium]

## Non-functional checklist
- Accessibility (a11y): keyboard nav, screen reader labels, color contrast
- Performance: fast initial load, smooth navigation, minimal layout shift
- Code quality: strict TypeScript, zero lint violations, clear architecture boundaries
- Security: never log secrets, validate and sanitize all inputs

## Tracking
Issues and tasks should be tracked in the repository’s issue tracker and referenced from this roadmap when appropriate. Priorities: [high], [medium], [low].