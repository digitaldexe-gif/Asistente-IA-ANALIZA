import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors'; // Using import from package
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/env.js';
import { KbService } from './kb/kb.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
    logger: true,
});

// Import providers
import { VoximplantProvider } from './voice/providers/voximplant.js';
import { ChatWebSocketProvider } from './voice/providers/ChatWebSocketProvider.js';

// 1. Register CORS first (Verified requirement)
fastify.register(fastifyCors, {
    origin: true
});

// 2. Register WebSocket (Verified requirement: correct plugin import)
fastify.register(fastifyWebsocket, {
    options: { maxPayload: 1048576 } // 1MB max payload
});

// 3. Register Static handling
fastify.register(fastifyStatic, {
    root: join(__dirname, '../public'),
    prefix: '/'
});

// 4. Register Routes
fastify.register(async (fastify) => {

    // --- WebSocket Endpoints (Must be GET) ---

    // Chat Realtime
    fastify.get('/chat/realtime', { websocket: true }, (connection, req) => {
        console.log(`[WS] New connection: ${req.url} (Chat)`);
        new ChatWebSocketProvider(connection, req);
    });

    // Voximplant Realtime
    fastify.get('/voximplant/realtime', { websocket: true }, (connection, req) => {
        console.log(`[WS] New connection: ${req.url} (Voximplant)`);
        new VoximplantProvider(connection, req);
    });

    // --- HTTP Endpoints ---

    fastify.get('/health', async () => {
        return { status: 'ok', mode: config.APP_MODE };
    });

    fastify.post('/admin/kb/update', async (req, reply) => {
        return { status: 'received', message: 'KB update logic not implemented yet' };
    });

    // --- Services & APIs ---

    // KB Service initialization
    const kbService = new KbService();

    // KB Endpoints
    fastify.get('/kb/branches', async (req: any) => ({ branches: kbService.getBranches(req.query.city) }));

    fastify.get('/kb/exams', async (req: any) => {
        const { query } = req.query;
        return query ? { exams: kbService.getExamInfo(query) } : { exams: kbService.loadData().exams };
    });

    fastify.get('/kb/company', async () => kbService.getCompanyInfo());

    fastify.get('/kb/policies', async (req: any) => ({ policies: kbService.getPolicies(req.query.keyword) }));

    fastify.get('/kb/faq', async (req: any) => {
        const { query } = req.query;
        return query ? { faqs: kbService.getFAQ(query) } : { faqs: kbService.loadData().faq };
    });

    fastify.get('/kb/search', async (req: any) => {
        if (!req.query.query) return { error: 'query parameter required' };
        return kbService.searchKnowledge(req.query.query);
    });

    // API Handlers (Dynamic Imports)
    const { validateOrderHandler } = await import('./api/validate-order.js');
    const { patientHandler } = await import('./api/patient.js');
    const { historyHandler } = await import('./api/history.js');
    const { appointmentsHandler } = await import('./api/appointments.js');
    const { examsHandler } = await import('./api/exams.js');

    fastify.post('/api/validate-order', validateOrderHandler);
    fastify.post('/api/patient', patientHandler);
    fastify.post('/api/history', historyHandler);
    fastify.post('/api/appointments', appointmentsHandler);
    fastify.post('/api/exams', examsHandler);

    // GOES Integration
    const { validateGoesCodeHandler } = await import('./api/validate-goes-code.js');
    const { syncPatientHandler } = await import('./api/sync-patient.js');
    const { logConversationHandler } = await import('./api/log-conversation.js');

    fastify.post('/api/validate-goes-code', validateGoesCodeHandler);
    fastify.post('/api/sync-patient', syncPatientHandler);
    fastify.post('/api/log-conversation', logConversationHandler);

    // Chat API (Fallback/History)
    const { chatHandler } = await import('./api/chat.js');
    fastify.post('/api/chat', chatHandler);

    // Serve HTML
    fastify.get('/chat', async (req, reply) => {
        return reply.sendFile('chat.html');
    });
});

const start = async () => {
    try {
        const port = parseInt(config.PORT || '3000');
        await fastify.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on port ${port} in ${config.APP_MODE} mode`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received, closing server gracefully...`);
    try {
        await fastify.close();
        process.exit(0);
    } catch (err) {
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

start();
