import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/exams
 * 
 * Actions: get_patient_exams, add_patient_exam
 * 
 * Manages patient exam records using Prisma + PostgreSQL
 */
export async function examsHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const params = { ...req.query as any, ...req.body as any };
        const { action, patientId, examCode, examName, limit = 20 } = params;

        // GET_PATIENT_EXAMS
        if (action === 'get_patient_exams' || !action) {
            if (!patientId) {
                return reply.code(400).send({
                    success: false,
                    error: 'Missing required parameter: patientId'
                });
            }

            const exams = await prisma.patientExam.findMany({
                where: { patientId },
                orderBy: { date: 'desc' },
                take: parseInt(limit as string)
            });

            return reply.code(200).send({
                success: true,
                data: exams,
                count: exams.length
            });
        }

        // ADD_PATIENT_EXAM
        if (action === 'add_patient_exam') {
            if (!patientId || !examCode || !examName) {
                return reply.code(400).send({
                    success: false,
                    error: 'Missing required parameters: patientId, examCode, examName'
                });
            }

            const exam = await prisma.patientExam.create({
                data: {
                    patientId,
                    examCode,
                    examName
                }
            });

            return reply.code(201).send({
                success: true,
                data: exam
            });
        }

        return reply.code(400).send({
            success: false,
            error: 'Invalid action. Supported: get_patient_exams, add_patient_exam'
        });

    } catch (error: any) {
        console.error('[exams] Error:', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
