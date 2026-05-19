# Architecture

HookGuard AI uses a lightweight hexagonal shape without enterprise overhead.

- `domain`: review types and ports.
- `application`: use-cases that orchestrate work.
- `infrastructure`: adapters for external systems, currently Ollama.
- `interfaces/http`: Fastify routes, schemas, and error handling.
- `frontend/src/features`: product-facing feature modules.
- `frontend/src/components/ui`: reusable shadcn-style primitives.

The backend depends inward: HTTP and Ollama adapters call application code, and application code depends on domain contracts.
