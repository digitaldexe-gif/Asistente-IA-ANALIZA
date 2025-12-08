import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/log-conversation
 * 
 * Logs IA conversation turns for auditing and debugging
 */
export async function logConversationHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const params = { ...req.query as any, ...req.body as any };
        const { action, sessionId, patientId, turn, speaker, message } = params;

        if (!sessionId || turn === undefined || !speaker || !message) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required parameters: sessionId, turn, speaker, message'
            });
        }

        const log = await prisma.conversationLog.create({
            data: {
                sessionId,
                patientId: patientId || null,
                turn: parseInt(turn as string),
                speaker,
                message
            }
        });

        return reply.code(201).send({
            success: true,
            logId: log.id
        });

    } catch (error: any) {
        console.error('[log-conversation] Error:', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
