# Stars Repo Extrator w/ simple Dashboard

A Next.js application to explore a GitHub user's starred repositories with pagination and export to JSON/CSV. Built with modern, type-safe tooling and a clean architecture.

- Browse starred repositories with pagination and per-page controls
- Client-side validation with Zod + React Hook Form
- API routes for data fetching and exporting
- Optional GitHub token support for higher rate limits

## Tech Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- Styling: Tailwind CSS
- Forms & Validation: react-hook-form, zod
- Icons: lucide-react

## Getting Started

Prerequisites:
- Node.js LTS (18 or 20) and npm

Install dependencies:
- npm install

Run the development server (PowerShell):
- $env:PORT="3001"; npm run dev
- Open http://localhost:3001

Alternative (Command Prompt):
- set PORT=3001 && npm run dev

Production build:
- npm run build
- npm run start (optionally set PORT as above)

Lint:
- npm run lint

## Environment Variables
Create a .env.local file (optional but recommended for higher rate limits):
- GITHUB_TOKEN=your_github_pat

The token is used by API routes to authenticate GitHub requests when available.

## Project Structure
- app/ — App Router, pages, API routes, and UI components
- app/api/starred — Fetch starred repositories (GET)
- app/api/export — Export starred repositories (POST)
- app/components — Reusable UI components
- app/lib — Utilities, constants, and validation schemas

## API

GET /api/starred
- Query: username (required), page (optional), per_page (optional)
- Response: { items: [...], link: string | null, rate: { limit, remaining, reset } }
- Example (PowerShell): Invoke-RestMethod -Uri "http://localhost:3001/api/starred?username=vercel&page=1&per_page=30"

POST /api/export
- Body: { "username": "vercel", "format": "json" | "csv" }
- Effect: Writes stars.json or stars.csv to the repository root
- Response: { ok: boolean, count: number, path: string, format: string }
- Example (PowerShell): Invoke-RestMethod -Uri http://localhost:3001/api/export -Method Post -ContentType "application/json" -Body '{"username":"vercel","format":"csv"}'

## Troubleshooting
- Port in use: change the PORT value (e.g., 3002)
- GitHub rate limits: set GITHUB_TOKEN in .env.local
- Network errors from API routes: verify internet access and token validity

## Notes
- Files exported by the API are written to the repository root (stars.json, stars.csv)
- This project follows a mobile-first, accessible, and performance-minded approach
