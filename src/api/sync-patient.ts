import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { GOESService } from '../services/goes/index.js';

const prisma = new PrismaClient();
const goesService = new GOESService();

/**
 * POST /api/sync-patient
 * 
 * Syncs GOES patient data to Vertical (PostgreSQL)
 * Creates or updates patient
 * Marks GOES code as used (only here!)
 */
export async function syncPatientHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const params = { ...req.query as any, ...req.body as any };
        const { action, goesCode, patientData, examData } = params;

        if (!goesCode || !patientData || !examData) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required parameters: goesCode, patientData, examData'
            });
        }

        const { name, surname, document } = patientData;
        const { examId, examName } = examData;

        if (!name || !surname || !document) {
            return reply.code(400).send({
                success: false,
                error: 'Missing patient data: name, surname, document required'
            });
        }

        // Verify GOES code is still valid
        const validation = goesService.validateCode(goesCode);
        if (!validation.valid) {
            return reply.code(400).send({
                success: false,
                error: 'GOES code is invalid or already used'
            });
        }

        // Check if patient exists (by document or GOES code)
        let patient = await prisma.patient.findFirst({
            where: {
                OR: [
                    { primaryGoesCode: goesCode },
                    {
                        AND: [
                            { name: name },
                            { surname: surname }
                        ]
                    }
                ]
            },
            include: {
                phones: true,
                profile: true
            }
        });

        let created = false;
        let updated = false;

        if (!patient) {
            // Create new patient
            patient = await prisma.patient.create({
                data: {
                    name,
                    surname,
                    primaryGoesCode: goesCode,
                    profile: {
                        create: {}
                    }
                },
                include: {
                    phones: true,
                    profile: true
                }
            });
            created = true;
        } else {
            // Update existing patient
            patient = await prisma.patient.update({
                where: { id: patient.id },
                data: {
                    primaryGoesCode: goesCode
                },
                include: {
                    phones: true,
                    profile: true
                }
            });
            updated = true;
        }

        // Add exam to patient record
        await prisma.patientExam.create({
            data: {
                patientId: patient.id,
                examCode: examId.toString(),
                examName: examName
            }
        });

        // Mark GOES code as used (ONLY HERE!)
        const marked = goesService.markAsUsed(goesCode);

        if (!marked) {
            console.warn(`[sync-patient] Failed to mark GOES code ${goesCode} as used`);
        }

        // Log in call history
        await prisma.callHistory.create({
            data: {
                patientId: patient.id,
                summary: `GOES code ${goesCode} validated and patient synced. Exam: ${examName}`,
                outcome: 'goes_validated'
            }
        });

        return reply.code(200).send({
            success: true,
            data: {
                patientId: patient.id,
                created,
                updated
            }
        });

    } catch (error: any) {
        console.error('[sync-patient] Error:', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
