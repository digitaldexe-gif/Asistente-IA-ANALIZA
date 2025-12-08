import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export class PersistentMemoryService {
    static instance;
    // Temporary in-memory session storage (active calls only)
    activeSessions = new Map();
    constructor() { }
    static getInstance() {
        if (!PersistentMemoryService.instance) {
            PersistentMemoryService.instance = new PersistentMemoryService();
        }
        return PersistentMemoryService.instance;
    }
    /**
     * Finds a patient by Name + Surname (from GOES data).
     * If not found, creates a new patient record.
     */
    async findOrCreatePatientByGoesData(goesData) {
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
        }
        else {
            console.log(`[PersistentMemory] Found existing patient: ${patient.id}`);
        }
        return patient;
    }
    /**
     * Associates a phone number with a patient if not already linked.
     */
    async addPhoneNumber(patientId, phoneNumber) {
        try {
            await prisma.patientPhone.create({
                data: {
                    patientId,
                    phoneNumber,
                },
            });
            console.log(`[PersistentMemory] Added phone ${phoneNumber} to patient ${patientId}`);
        }
        catch (error) {
            // Ignore unique constraint violation (already exists)
            if (error.code !== 'P2002') {
                console.error('[PersistentMemory] Error adding phone:', error);
            }
        }
    }
    /**
     * Records a call history entry.
     */
    async addCallHistory(patientId, entry) {
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
    async addPatientExam(patientId, exam) {
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
    async updateProfile(patientId, data) {
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
    getSession(sessionId) {
        if (!this.activeSessions.has(sessionId)) {
            this.activeSessions.set(sessionId, {});
        }
        return this.activeSessions.get(sessionId);
    }
    updateSession(sessionId, data) {
        const session = this.getSession(sessionId);
        this.activeSessions.set(sessionId, { ...session, ...data });
    }
    clearSession(sessionId) {
        this.activeSessions.delete(sessionId);
    }
}
