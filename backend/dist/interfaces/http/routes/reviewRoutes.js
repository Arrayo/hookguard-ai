import { analyzeCodeRequestSchema } from '../schemas/reviewSchemas.js';
export async function reviewRoutes(app, useCase) {
    app.get('/health', async () => ({ status: 'ok' }));
    app.post('/api/reviews/react', async (request, reply) => {
        const body = analyzeCodeRequestSchema.parse(request.body);
        const review = await useCase.execute(body);
        return reply.send(review);
    });
}
