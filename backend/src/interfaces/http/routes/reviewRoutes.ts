import type { FastifyInstance } from 'fastify'
import type { AnalyzeReactCodeUseCase } from '../../../application/analyzeReactCode.js'
import { analyzeCodeRequestSchema } from '../schemas/reviewSchemas.js'

export async function reviewRoutes(app: FastifyInstance, useCase: AnalyzeReactCodeUseCase) {
  app.get('/health', async () => ({ status: 'ok' }))

  app.post('/api/reviews/react', async (request, reply) => {
    const body = analyzeCodeRequestSchema.parse(request.body)
    const review = await useCase.execute(body)

    return reply.send(review)
  })
}
