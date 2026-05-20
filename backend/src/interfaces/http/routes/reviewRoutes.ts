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

  app.post('/api/reviews/react/stream', async (request, reply) => {
    const body = analyzeCodeRequestSchema.parse(request.body)

    reply.hijack()

    const res = reply.raw
    const origin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173'
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'Content-Type',
    })

    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`)

    try {
      const review = await useCase.executeStream(body, send)
      send({ type: 'done', review })
    } catch (err) {
      send({ type: 'error', message: err instanceof Error ? err.message : 'Review failed' })
    } finally {
      res.end()
    }
  })
}
