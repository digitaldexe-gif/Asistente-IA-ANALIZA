import { PrismaClient, Patient, CallHistory, PatientProfile, PatientExam } from '@prisma/client';
import { GOESOrder } from '../../types/domain.js';

const prisma = new PrismaClient();

export interface PatientFullData extends Patient {
    phones: { phoneNumber: string }[];
    history: CallHistory[];
    exams: PatientExam[];
    profile: PatientProfile | null;
}

export class PersistentMemoryService {
    private static instance: PersistentMemoryService;

    // Temporary in-memory session storage (active calls only)
    private activeSessions: Map<string, any> = new Map();

    private constructor() { }

    static getInstance(): PersistentMemoryService {
        if (!PersistentMemoryService.instance) {
            PersistentMemoryService.instance = new PersistentMemoryService();
        }
        return PersistentMemoryService.instance;
    }

    /**
     * Finds a patient by Name + Surname (from GOES data).
     * If not found, creates a new patient record.
     */
    async findOrCreatePatientByGoesData(goesData: { name: string; surname: string; orderId: string }): Promise<PatientFullData> {
        const { name, surname, orderId } = goesData;

        // Try to find existing patient
        let patient = await prisma.patient.findUnique({
            where: {
                name_surname: {
                    name,
                    surname,
                },
            },
            include: {
                phones: true,
                history: {
                    orderBy: { date: 'desc' },
                    take: 5,
                },
                exams: {
                    orderBy: { date: 'desc' },
                    take: 10,
                },
                profile: true,
            },
        });

        // Create if not exists
        if (!patient) {
            patient = await prisma.patient.create({
                data: {
                    name,
                    surname,
                    primaryGoesCode: orderId,
                    profile: {
                        create: {}, // Empty profile
                    },
                },
                include: {
                    phones: true,
                    history: true,
                    exams: true,
                    profile: true,
                },
            });
            console.log(`[PersistentMemory] Created new patient: ${patient.id} (${name} ${surname})`);
        } else {
            console.log(`[PersistentMemory] Found existing patient: ${patient.id}`);
        }

        return patient;
    }

    /**
     * Finds a patient by ID (does NOT create if not found).
     * Used by scheduler to check preferences without creating fake patients.
     */
    async findPatientById(patientId: string): Promise<PatientFullData | null> {
        try {
            const patient = await prisma.patient.findUnique({
                where: { id: patientId },
                include: {
                    phones: true,
                    history: {
                        orderBy: { date: 'desc' },
                        take: 10,
                    },
                    exams: {
                        orderBy: { date: 'desc' },
                        take: 10,
                    },
                    profile: true,
                },
            });

            return patient;
        } catch (error) {
            console.error('[PersistentMemory] Error finding patient:', error);
            return null;
        }
    }

    /**
     * Associates a phone number with a patient if not already linked.
     */
    async addPhoneNumber(patientId: string, phoneNumber: string): Promise<void> {
        try {
            await prisma.patientPhone.create({
                data: {
                    patientId,
                    phoneNumber,
                },
            });
            console.log(`[PersistentMemory] Added phone ${phoneNumber} to patient ${patientId}`);
        } catch (error: any) {
            // Ignore unique constraint violation (already exists)
            if (error.code !== 'P2002') {
                console.error('[PersistentMemory] Error adding phone:', error);
            }
        }
    }

    /**
     * Records a call history entry.
     */
    async addCallHistory(patientId: string, entry: { summary: string; outcome: string }): Promise<void> {
        await prisma.callHistory.create({
            data: {
                patientId,
                summary: entry.summary,
                outcome: entry.outcome,
            },
        });
        console.log(`[PersistentMemory] Saved history for ${patientId}`);
    }

    /**
     * Saves a validated exam to the patient's record.
     */
    async addPatientExam(patientId: string, exam: { code: string; name: string }): Promise<void> {
        await prisma.patientExam.create({
            data: {
                patientId,
                examCode: exam.code,
                examName: exam.name,
            },
        });
        console.log(`[PersistentMemory] Added exam ${exam.code} to patient ${patientId}`);
    }

    /**
     * Updates patient profile (preferences, emotional state).
     */
    async updateProfile(patientId: string, data: Partial<PatientProfile>): Promise<void> {
        await prisma.patientProfile.upsert({
            where: { patientId },
            update: data,
            create: {
                patientId,
                ...data,
            },
        });
    }

    // --- Session Management (Temporary) ---

    getSession(sessionId: string): any {
        if (!this.activeSessions.has(sessionId)) {
            this.activeSessions.set(sessionId, {});
        }
        return this.activeSessions.get(sessionId);
    }

    updateSession(sessionId: string, data: any): void {
        const session = this.getSession(sessionId);
        this.activeSessions.set(sessionId, { ...session, ...data });
    }

    clearSession(sessionId: string): void {
        this.activeSessions.delete(sessionId);
    }
    async addMessage(sessionId: string, role: string, content: string): Promise<void> {
        const session = this.getSession(sessionId);
        if (!session.history) {
            session.history = [];
        }
        session.history.push({ role, content, timestamp: new Date() });
        this.updateSession(sessionId, { history: session.history });
    }
}
