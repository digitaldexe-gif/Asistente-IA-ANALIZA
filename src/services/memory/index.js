export class MemoryService {
    static instance;
    contexts = new Map();
    sessions = new Map();
    constructor() { }
    static getInstance() {
        if (!MemoryService.instance) {
            MemoryService.instance = new MemoryService();
        }
        return MemoryService.instance;
    }
    async getContext(phoneNumber) {
        if (!this.contexts.has(phoneNumber)) {
            this.contexts.set(phoneNumber, {
                phoneNumber,
                history: [],
                profile: {},
            });
        }
        return this.contexts.get(phoneNumber);
    }
    async updateContext(phoneNumber, update) {
        const context = await this.getContext(phoneNumber);
        this.contexts.set(phoneNumber, { ...context, ...update });
    }
    async addHistory(phoneNumber, entry) {
        const context = await this.getContext(phoneNumber);
        context.history.push(entry);
    }
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {});
        }
        return this.sessions.get(sessionId);
    }
    updateSession(sessionId, update) {
        const session = this.getSession(sessionId);
        this.sessions.set(sessionId, { ...session, ...update });
    }
    clearSession(sessionId) {
        this.sessions.delete(sessionId);
    }
}
