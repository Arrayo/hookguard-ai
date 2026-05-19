import cors from '@fastify/cors'
import Fastify from 'fastify'
import { AnalyzeReactCodeUseCase } from './application/analyzeReactCode.js'
import { OllamaReactReviewAdapter } from './infrastructure/ollama/OllamaReactReviewAdapter.js'
import { errorHandler } from './interfaces/http/errorHandler.js'
import { reviewRoutes } from './interfaces/http/routes/reviewRoutes.js'

export async function buildApp() {
  const app = Fastify({ logger: true })

  await app.register(cors, {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  })

  const reviewer = new OllamaReactReviewAdapter(
    process.env.OLLAMA_MODEL ?? 'gemma3:4b',
    process.env.OLLAMA_HOST,
  )
  const analyzeReactCode = new AnalyzeReactCodeUseCase(reviewer)

  await reviewRoutes(app, analyzeReactCode)
  app.setErrorHandler(errorHandler)

  return app
}
