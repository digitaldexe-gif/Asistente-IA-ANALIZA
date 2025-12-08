import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/history
 * 
 * Actions: get_history, add_history
 * 
 * Manages call history using Prisma + PostgreSQL
 */
export async function historyHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const params = { ...req.query as any, ...req.body as any };
        const { action, patientId, summary, outcome, limit = 10 } = params;

        // GET_HISTORY
        if (action === 'get_history' || !action) {
            if (!patientId) {
                return reply.code(400).send({
                    success: false,
                    error: 'Missing required parameter: patientId'
                });
            }

            const history = await prisma.callHistory.findMany({
                where: { patientId },
                orderBy: { date: 'desc' },
                take: parseInt(limit as string)
            });

            return reply.code(200).send({
                success: true,
                data: history,
                count: history.length
            });
        }

        // ADD_HISTORY
        if (action === 'add_history') {
            if (!patientId || !summary || !outcome) {
                return reply.code(400).send({
                    success: false,
                    error: 'Missing required parameters: patientId, summary, outcome'
                });
            }

            const entry = await prisma.callHistory.create({
                data: {
                    patientId,
                    summary,
                    outcome
                }
            });

            return reply.code(201).send({
                success: true,
                data: entry
            });
        }

        return reply.code(400).send({
            success: false,
            error: 'Invalid action. Supported: get_history, add_history'
        });

    } catch (error: any) {
        console.error('[history] Error:', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
