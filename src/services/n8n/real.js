import { config } from '../../config/env';
export class RealN8nService {
    baseUrl;
    constructor() {
        if (!config.N8N_WEBHOOK_BASE_URL) {
            throw new Error('N8N_WEBHOOK_BASE_URL is required for production mode');
        }
        this.baseUrl = config.N8N_WEBHOOK_BASE_URL;
    }
    async request(path, method = 'GET', body) {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            throw new Error(`N8n request failed: ${response.statusText}`);
        }
        return response.json();
    }
    async validateOrder(orderId) {
        try {
            return await this.request('/validate-order', 'POST', { orderId });
        }
        catch (error) {
            console.error('Error validating order:', error);
            return null;
        }
    }
    async getPatient(patientId) {
        try {
            return await this.request(`/patient/${patientId}`);
        }
        catch (error) {
            return null;
        }
    }
    async getExam(examCode) {
        try {
            return await this.request(`/exam/${examCode}`);
        }
        catch (error) {
            return null;
        }
    }
    async getBranches() {
        return this.request('/branches');
    }
    async getSlots(examCode, branchId, startDate, endDate) {
        return this.request('/slots', 'POST', { examCode, branchId, startDate, endDate });
    }
    async createAppointment(data) {
        return this.request('/appointments', 'POST', data);
    }
    async updateAppointment(id, data) {
        return this.request(`/appointments/${id}`, 'PATCH', data);
    }
    async cancelAppointment(id) {
        return this.request(`/appointments/${id}`, 'DELETE');
    }
}
