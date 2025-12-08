import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { config } from './config/env.js';
import { handleOpenAIStream } from './services/openai/handler.js';
import { KbService } from './kb/kb.service.js';

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

    // --- Unified KB Service ---
    const kbService = new KbService();

    // --- Public Endpoints (Frontend) ---

    // Patients
    fastify.get('/patients', async () => {
        return kbService.getAllPatients();
    });

    fastify.get('/patients/:id', async (req: any) => {
        return kbService.getPatientById(req.params.id);
    });

    // Appointments
    fastify.get('/appointments', async (req: any) => {
        const { patientId } = req.query;
        if (patientId) {
            return kbService.getAppointmentsByPatientId(patientId);
        }
        return [];
    });

    // History
    fastify.get('/patient-history/:patientId', async (req: any, reply) => {
        const { patientId } = req.params;
        const history = kbService.getPatientHistory(patientId);
        return { history };
    });

    // --- Internal Endpoints (n8n) ---

    // Validate Patient (Check if exists by Phone or ID)
    fastify.post('/internal/validate-patient', async (req: any) => {
        const { phone, id } = req.body;
        const patients = kbService.getAllPatients();

        if (id) {
            const p = patients.find((p: any) => p.id === id);
            return { exists: !!p, patient: p || null };
        }
        if (phone) {
            const p = patients.find((p: any) => p.phone === phone);
            return { exists: !!p, patient: p || null };
        }
        return { exists: false, error: 'Provide id or phone' };
    });

    // Create Patient
    fastify.post('/internal/create-patient', async (req: any) => {
        const patient = kbService.addPatient(req.body);
        kbService.addHistoryEntry({
            patientId: patient.id,
            eventType: 'info_query',
            details: { action: 'patient_created' },
            source: 'n8n'
        });
        return patient;
    });

    // Log Event
    fastify.post('/internal/log-event', async (req: any, reply) => {
        const { patientId, eventType, details, source } = req.body;

        if (!patientId || !eventType) {
            return reply.code(400).send({ error: 'Missing required fields: patientId, eventType' });
        }

        const event = kbService.addHistoryEntry({
            patientId,
            eventType,
            details: details || {},
            source: source || 'n8n'
        });

        return { success: true, eventId: event.id };
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
