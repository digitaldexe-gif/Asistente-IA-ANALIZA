export class MockN8nService {
    appointments = new Map();
    async validateOrder(orderId) {
        // Mock logic: "12345" is valid, "expired" is expired, others invalid
        if (orderId === '12345') {
            return {
                orderId,
                patientId: 'p1',
                examCode: 'EX-001',
                isValid: true,
                expirationDate: '2025-12-31',
            };
        }
        if (orderId === 'expired') {
            return {
                orderId,
                patientId: 'p1',
                examCode: 'EX-001',
                isValid: false,
                expirationDate: '2024-01-01',
            };
        }
        return null;
    }
    async getPatient(patientId) {
        if (patientId === 'p1') {
            return {
                id: 'p1',
                name: 'Juan Pérez',
                phone: '+50312345678',
                email: 'juan@example.com',
            };
        }
        return null;
    }
    async getExam(examCode) {
        if (examCode === 'EX-001') {
            return {
                code: 'EX-001',
                name: 'Hemograma Completo',
                description: 'Análisis de sangre general',
            };
        }
        return null;
    }
    async getBranches() {
        return [
            { id: 'b1', name: 'Sucursal Central', address: 'Av. Principal 123' },
            { id: 'b2', name: 'Sucursal Norte', address: 'Calle Norte 456' },
        ];
    }
    async getSlots(examCode, branchId, startDate, endDate) {
        // Generate some mock slots for the next few days
        const slots = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === 0)
                continue; // Skip Sundays
            // 8:00 AM
            const slot1 = new Date(d);
            slot1.setHours(8, 0, 0, 0);
            slots.push({
                start: slot1.toISOString(),
                end: new Date(slot1.getTime() + 30 * 60000).toISOString(),
                available: true,
            });
            // 10:00 AM
            const slot2 = new Date(d);
            slot2.setHours(10, 0, 0, 0);
            slots.push({
                start: slot2.toISOString(),
                end: new Date(slot2.getTime() + 30 * 60000).toISOString(),
                available: true,
            });
        }
        return slots;
    }
    async createAppointment(data) {
        const id = `apt-${Date.now()}`;
        const appointment = {
            ...data,
            id,
            status: 'scheduled',
        };
        this.appointments.set(id, appointment);
        console.log(`[MockN8n] Appointment created: ${id}`);
        return appointment;
    }
    async updateAppointment(id, data) {
        const apt = this.appointments.get(id);
        if (!apt)
            throw new Error('Appointment not found');
        const updated = { ...apt, ...data };
        this.appointments.set(id, updated);
        console.log(`[MockN8n] Appointment updated: ${id}`);
        return updated;
    }
    async cancelAppointment(id) {
        const apt = this.appointments.get(id);
        if (!apt)
            throw new Error('Appointment not found');
        apt.status = 'cancelled';
        this.appointments.set(id, apt);
        console.log(`[MockN8n] Appointment cancelled: ${id}`);
    }
}
