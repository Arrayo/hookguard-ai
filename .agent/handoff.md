# Handoff

Objective: Create HookGuard AI, a production-ready hackathon MVP for local AI-powered React code review with Ollama + Gemma.

Status: Scaffolded frontend, backend, prompts, docs, tooling, and base architecture. Added resilient Ollama/Gemma response parsing with fallback UI. Backend and frontend build/lint pass.

Decisions: Used lightweight hexagonal backend layers; shadcn-style local UI primitives; Tailwind v4 Vite plugin; npm-only scripts. AI JSON parsing must never crash the backend; malformed model output is preserved in optional response metadata and shown as a frontend fallback notice.

Touched files: root package/tooling, frontend app/UI/API files, backend domain/application/infrastructure/http files, docs, prompts, README. Latest parsing fix touched `backend/src/infrastructure/ollama/OllamaReactReviewAdapter.ts`, `backend/src/domain/codeReview.ts`, `backend/src/interfaces/http/schemas/reviewSchemas.ts`, `frontend/src/types/review.ts`, and `frontend/src/App.tsx`.

Next step: Start Ollama, pull the configured Gemma model if needed, run `npm run dev` from the project root, and manually verify malformed Gemma responses render the recovered fallback panel.
