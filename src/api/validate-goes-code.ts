import { FastifyRequest, FastifyReply } from 'fastify';
import { GOESService } from '../services/goes/index.js';

const goesService = new GOESService();

/**
 * POST /api/validate-goes-code
 * 
 * Validates a GOES code from Ministry of Health
 * Does NOT mark as used - validation only
 */
export async function validateGoesCodeHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const params = { ...req.query as any, ...req.body as any };
        const { action, goesCode } = params;

        if (!goesCode) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required parameter: goesCode'
            });
        }

        const result = goesService.validateCode(goesCode);

        if (!result.valid) {
            return reply.code(200).send({
                success: true,
                valid: false,
                message: 'Code not found, already used, or expired'
            });
        }

        const { data } = result;

        return reply.code(200).send({
            success: true,
            valid: true,
            data: {
                patient: {
                    name: data!.patientName,
                    surname: data!.patientSurname,
                    document: data!.document
                },
                exam: {
                    id: data!.examId,
                    name: data!.examName
                }
            }
        });

    } catch (error: any) {
        console.error('[validate-goes-code] Error:', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
