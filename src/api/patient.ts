import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/patient
 * 
 * Actions: get_patient, create_patient, update_patient
 * 
 * Manages patient data using Prisma + PostgreSQL
 */
export async function patientHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const params = { ...req.query as any, ...req.body as any };
        const { action, patientId, name, surname, phone, email } = params;

        // GET_PATIENT
        if (action === 'get_patient') {
            if (!patientId) {
                return reply.code(400).send({
                    success: false,
                    error: 'Missing required parameter: patientId'
                });
            }

            const patient = await prisma.patient.findUnique({
                where: { id: patientId },
                include: {
                    phones: true,
                    profile: true,
                    exams: {
                        orderBy: { date: 'desc' },
                        take: 10
                    },
                    history: {
                        orderBy: { date: 'desc' },
                        take: 5
                    }
                }
            });

            if (!patient) {
                return reply.code(404).send({
                    success: false,
                    error: 'Patient not found'
                });
            }

            return reply.code(200).send({
                success: true,
                data: patient
            });
        }

        // CREATE_PATIENT
        if (action === 'create_patient') {
            if (!name || !surname) {
                return reply.code(400).send({
                    success: false,
                    error: 'Missing required parameters: name, surname'
                });
            }

            const patient = await prisma.patient.create({
                data: {
                    name,
                    surname,
                    profile: {
                        create: {}
                    },
                    ...(phone && {
                        phones: {
                            create: {
                                phoneNumber: phone
                            }
                        }
                    })
                },
                include: {
                    phones: true,
                    profile: true
                }
            });

            return reply.code(201).send({
                success: true,
                data: patient
            });
        }

        // UPDATE_PATIENT
        if (action === 'update_patient') {
            if (!patientId) {
                return reply.code(400).send({
                    success: false,
                    error: 'Missing required parameter: patientId'
                });
            }

            const updateData: any = {};
            if (name) updateData.name = name;
            if (surname) updateData.surname = surname;

            const patient = await prisma.patient.update({
                where: { id: patientId },
                data: updateData,
                include: {
                    phones: true,
                    profile: true
                }
            });

            return reply.code(200).send({
                success: true,
                data: patient
            });
        }

        // SEARCH_PATIENT (dynamic search)
        if (action === 'search_patient') {
            const { goesCode, name, surname, phone } = params;

            if (!goesCode && !name && !surname && !phone) {
                return reply.code(400).send({
                    success: false,
                    error: 'At least one search parameter required: goesCode, name, surname, or phone'
                });
            }

            // Build dynamic where clause
            const whereClause: any = {};

            if (goesCode) {
                whereClause.primaryGoesCode = goesCode;
            }

            if (name) {
                whereClause.name = {
                    contains: name,
                    mode: 'insensitive'
                };
            }

            if (surname) {
                whereClause.surname = {
                    contains: surname,
                    mode: 'insensitive'
                };
            }

            // Search by phone in related table
            let phoneFilter = {};
            if (phone) {
                phoneFilter = {
                    phones: {
                        some: {
                            phoneNumber: {
                                contains: phone
                            }
                        }
                    }
                };
            }

            const patients = await prisma.patient.findMany({
                where: {
                    ...whereClause,
                    ...phoneFilter
                },
                include: {
                    phones: true,
                    profile: true,
                    exams: {
                        orderBy: { date: 'desc' },
                        take: 10
                    },
                    history: {
                        orderBy: { date: 'desc' },
                        take: 5
                    }
                },
                take: 50 // Limit results
            });

            return reply.code(200).send({
                success: true,
                data: patients,
                count: patients.length
            });
        }

        // LIST_PATIENTS (optional - for admin)
        if (action === 'list_patients' || !action) {
            const patients = await prisma.patient.findMany({
                take: 50,
                orderBy: { createdAt: 'desc' },
                include: {
                    phones: true,
                    profile: true
                }
            });

            return reply.code(200).send({
                success: true,
                data: patients,
                count: patients.length
            });
        }

        return reply.code(400).send({
            success: false,
            error: 'Invalid action. Supported: get_patient, create_patient, update_patient, search_patient, list_patients'
        });

    } catch (error: any) {
        console.error('[patient] Error:', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
