# HookGuard AI

AI-powered React code review platform for hooks analysis, architecture review, render loop detection, maintainability analysis, and pragmatic refactoring suggestions.

The MVP runs locally with React, Vite, TypeScript, TailwindCSS, shadcn-style UI components, Monaco Editor, Fastify, Zod, and Ollama with Gemma.

## Project Structure

```txt
hookguard-ai/
├── frontend/      # React + Vite + Tailwind + Monaco UI
├── backend/       # Fastify + TypeScript API
├── prompts/       # AI review prompt notes
├── docs/          # Architecture notes
└── README.md
```

## Requirements

- Node.js 20+
- npm
- Ollama running locally
- A Gemma model pulled in Ollama, for example `gemma3:4b`

## Local Setup

```bash
cd /home/moro/projects/personalProjects/hookguard-ai
cp backend/.env.example backend/.env
ollama pull gemma3:4b
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3333`

Health check: `http://localhost:3333/health`

## Separate Commands

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

## Build And Lint

```bash
npm run build
npm run lint
npm run format:check
```

## Backend Environment

```bash
PORT=3333
HOST=0.0.0.0
FRONTEND_ORIGIN=http://localhost:5173
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=gemma3:4b
```

Change `OLLAMA_MODEL` if your local Gemma tag is different.
