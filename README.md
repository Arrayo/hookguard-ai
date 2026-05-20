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

## Quick Start

After the one-time setup below, you only need two separate terminals to run the full app locally.

Terminal 1, keep Ollama running:

```bash
ollama serve
```

Terminal 2, from the project root:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:3333`

Health check: `http://localhost:3333/health`

Ollama: `http://127.0.0.1:11434`

## Local Setup

Run this once on a fresh clone so the quick-start commands above work without extra steps:

```bash
git clone https://github.com/Arrayo/hookguard-ai.git
cd hookguard-ai
cp backend/.env.example backend/.env
ollama pull gemma3:4b
npm install
npm install --prefix backend
npm install --prefix frontend
npm run dev
```

If you already have the repository locally, start from `cd hookguard-ai` and skip the `git clone` step.

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
