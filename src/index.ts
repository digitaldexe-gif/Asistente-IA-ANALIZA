import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/env.js';
import { handleOpenAIStream } from './services/openai/handler.js';
import { KbService } from './kb/kb.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
    logger: true,
    logger: true,
});

// Import providers
import { VoximplantProvider } from './voice/providers/voximplant.js';
import { ChatProvider } from './voice/providers/chat.js';

fastify.register(websocket);

// Register static file serving
fastify.register(fastifyStatic, {
    root: join(__dirname, '../public'),
    prefix: '/'
});

fastify.register(async (fastify) => {
    // --- Web Chat Endpoint ---
    fastify.get('/chat/realtime', { websocket: true }, (connection, req) => {
        new ChatProvider(connection, req);
    });

    // --- Voximplant Endpoint ---
    fastify.get('/voximplant/realtime', { websocket: true }, (connection, req) => {
        new VoximplantProvider(connection, req);
    });

    fastify.get('/health', async () => {
        return { status: 'ok', mode: config.APP_MODE };
    });

    // Admin route for KB updates
    fastify.post('/admin/kb/update', async (req, reply) => {
        // TODO: Implement KB update logic
        return { status: 'received', message: 'KB update logic not implemented yet' };
    });

    // --- Knowledge Base Service (Read-Only Reference Data) ---
    const kbService = new KbService();

    // --- KB Reference Data Endpoints ---

    // Get branches
    fastify.get('/kb/branches', async (req: any) => {
        const { city } = req.query;
        return { branches: kbService.getBranches(city) };
    });

    // Get exam info
    fastify.get('/kb/exams', async (req: any) => {
        const { query } = req.query;
        if (!query) {
            return { exams: kbService.loadData().exams };
        }
        return { exams: kbService.getExamInfo(query) };
    });

    // Get company info
    fastify.get('/kb/company', async () => {
        return kbService.getCompanyInfo();
    });

    // Get policies
    fastify.get('/kb/policies', async (req: any) => {
        const { keyword } = req.query;
        return { policies: kbService.getPolicies(keyword) };
    });

    // Get FAQ
    fastify.get('/kb/faq', async (req: any) => {
        const { query } = req.query;
        if (!query) {
            return { faqs: kbService.loadData().faq };
        }
        return { faqs: kbService.getFAQ(query) };
    });

    // Search knowledge base
    fastify.get('/kb/search', async (req: any) => {
        const { query } = req.query;
        if (!query) {
            return { error: 'query parameter required' };
        }
        return kbService.searchKnowledge(query);
    });

    // --- N8N-Compatible API Endpoints (POST) ---

    // Import API handlers
    const { validateOrderHandler } = await import('./api/validate-order.js');
    const { patientHandler } = await import('./api/patient.js');
    const { historyHandler } = await import('./api/history.js');
    const { appointmentsHandler } = await import('./api/appointments.js');
    const { examsHandler } = await import('./api/exams.js');

    // Register POST endpoints
    fastify.post('/api/validate-order', validateOrderHandler);
    fastify.post('/api/patient', patientHandler);
    fastify.post('/api/history', historyHandler);
    fastify.post('/api/appointments', appointmentsHandler);
    fastify.post('/api/exams', examsHandler);

    // --- GOES-Vertical Integration Endpoints ---
    const { validateGoesCodeHandler } = await import('./api/validate-goes-code.js');
    const { syncPatientHandler } = await import('./api/sync-patient.js');
    const { logConversationHandler } = await import('./api/log-conversation.js');

    fastify.post('/api/validate-goes-code', validateGoesCodeHandler);
    fastify.post('/api/sync-patient', syncPatientHandler);
    fastify.post('/api/log-conversation', logConversationHandler);

    // --- Chat Demo Endpoint ---
    const { chatHandler } = await import('./api/chat.js');
    fastify.post('/api/chat', chatHandler);

    // --- Serve Static Chat UI ---
    fastify.get('/chat', async (req, reply) => {
        return reply.sendFile('chat.html');
    });
});

const start = async () => {
    try {
        await fastify.listen({ port: parseInt(config.PORT), host: '0.0.0.0' });
        console.log(`Server listening on port ${config.PORT} in ${config.APP_MODE} mode`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Graceful shutdown handlers for Railway
const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received, closing server gracefully...`);
    try {
        await fastify.close();
        console.log('Server closed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Error during graceful shutdown:', err);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

start();
