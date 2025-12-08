import { GOESOrder, TimeSlot } from '../../types/domain.js';

export interface CallHistory {
    date: string;
    summary: string;
    outcome: 'appointment_created' | 'info_only' | 'error' | 'cancelled';
}

export interface PatientContext {
    phoneNumber: string;
    history: CallHistory[];
    profile: {
        name?: string;
        preferredBranchId?: string;
        emotionalState?: string; // e.g., "anxious", "calm"
    };
}

export interface ActiveSession {
    order?: GOESOrder;
    cachedSlots?: TimeSlot[];
    selectedBranchId?: string;
    selectedExamCode?: string;
}

export class MemoryService {
    private static instance: MemoryService;
    private contexts: Map<string, PatientContext> = new Map();
    private sessions: Map<string, ActiveSession> = new Map();

    private constructor() { }

    static getInstance(): MemoryService {
        if (!MemoryService.instance) {
            MemoryService.instance = new MemoryService();
        }
        return MemoryService.instance;
    }

    async getContext(phoneNumber: string): Promise<PatientContext> {
        if (!this.contexts.has(phoneNumber)) {
            this.contexts.set(phoneNumber, {
                phoneNumber,
                history: [],
                profile: {},
            });
        }
        return this.contexts.get(phoneNumber)!;
    }

    async updateContext(phoneNumber: string, update: Partial<PatientContext>): Promise<void> {
        const context = await this.getContext(phoneNumber);
        this.contexts.set(phoneNumber, { ...context, ...update });
    }

    async addHistory(phoneNumber: string, entry: CallHistory): Promise<void> {
        const context = await this.getContext(phoneNumber);
        context.history.push(entry);
    }

    getSession(sessionId: string): ActiveSession {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {});
        }
        return this.sessions.get(sessionId)!;
    }

    updateSession(sessionId: string, update: Partial<ActiveSession>): void {
        const session = this.getSession(sessionId);
        this.sessions.set(sessionId, { ...session, ...update });
    }

    clearSession(sessionId: string): void {
        this.sessions.delete(sessionId);
    }
}
