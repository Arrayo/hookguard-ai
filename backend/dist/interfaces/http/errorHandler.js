import { ZodError } from 'zod';
export function errorHandler(error, _request, reply) {
    if (error instanceof ZodError) {
        return reply.status(400).send({
            error: 'ValidationError',
            message: 'Request validation failed.',
            details: error.issues,
        });
    }
    if (error.name === 'SyntaxError') {
        return reply.status(400).send({
            error: 'BadRequest',
            message: 'Invalid JSON payload.',
        });
    }
    const message = error.message.includes('fetch failed')
        ? 'Could not reach Ollama. Make sure Ollama is running and the Gemma model is available.'
        : error.message;
    return reply.status(500).send({
        error: 'InternalServerError',
        message,
    });
}
