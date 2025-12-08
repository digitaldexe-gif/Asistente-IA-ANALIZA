import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { config } from './config/env.js';
import { handleOpenAIStream } from './services/openai/handler.js';
const fastify = Fastify({
    logger: true,
});
fastify.register(websocket);
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        handleOpenAIStream(connection, req);
    });
    fastify.get('/health', async () => {
        return { status: 'ok', mode: config.APP_MODE };
    });
    // Admin route for KB updates
    fastify.post('/admin/kb/update', async (req, reply) => {
        // TODO: Implement KB update logic
        return { status: 'received', message: 'KB update logic not implemented yet' };
    });
});
const start = async () => {
    try {
        await fastify.listen({ port: parseInt(config.PORT), host: '0.0.0.0' });
        console.log(`Server listening on port ${config.PORT} in ${config.APP_MODE} mode`);
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
