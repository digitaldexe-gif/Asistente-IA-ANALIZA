import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/validate-order
 * 
 * Actions: validate_order
 * 
 * Validates a GOES order code and returns patient/exam information
 */
export async function validateOrderHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        // Accept params from body OR query
        const params = { ...req.query as any, ...req.body as any };
        const { action, orderId } = params;

        if (!orderId) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required parameter: orderId'
            });
        }

        // Mock validation - In production, call actual GOES API or N8N webhook
        const isValid = orderId.startsWith('GOES-');

        if (!isValid) {
            return reply.code(200).send({
                success: false,
                isValid: false,
                message: 'Invalid order code'
            });
        }

        // Extract patient info from order (mock data)
        // In production, this would come from N8N or external API
        const orderData = {
            isValid: true,
            orderId: orderId,
            patientId: `PAT-${Date.now()}`,
            patientName: 'Mock Patient',
            examCode: 'HB001',
            examName: 'Hemograma Completo',
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };

        return reply.code(200).send({
            success: true,
            data: orderData
        });

    } catch (error: any) {
        console.error('[validate-order] Error:', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
