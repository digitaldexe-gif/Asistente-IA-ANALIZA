import { IN8nService } from './interface.js';
import { Appointment, Exam, GOESOrder, TimeSlot, Patient, Branch } from '../../types/domain.js';
import { config } from '../../config/env.js';

export class RealN8nService implements IN8nService {
    private baseUrl: string;

    constructor() {
        if (!config.N8N_WEBHOOK_BASE_URL) {
            throw new Error('N8N_WEBHOOK_BASE_URL is required for production mode');
        }
        this.baseUrl = config.N8N_WEBHOOK_BASE_URL;
    }

    private async request<T>(path: string, method: string = 'GET', body?: any): Promise<T> {
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

    async validateOrder(orderId: string): Promise<GOESOrder | null> {
        try {
            return await this.request<GOESOrder>('/validate-order', 'POST', { orderId });
        } catch (error) {
            console.error('Error validating order:', error);
            return null;
        }
    }

    async getPatient(patientId: string): Promise<Patient | null> {
        try {
            return await this.request<Patient>(`/patient/${patientId}`);
        } catch (error) {
            return null;
        }
    }

    async getExam(examCode: string): Promise<Exam | null> {
        try {
            return await this.request<Exam>(`/exam/${examCode}`);
        } catch (error) {
            return null;
        }
    }

    async getBranches(): Promise<Branch[]> {
        return this.request<Branch[]>('/branches');
    }

    async getSlots(examCode: string, branchId: string, startDate: string, endDate: string): Promise<TimeSlot[]> {
        return this.request<TimeSlot[]>('/slots', 'POST', { examCode, branchId, startDate, endDate });
    }

    async createAppointment(data: Omit<Appointment, 'id' | 'status'>): Promise<Appointment> {
        return this.request<Appointment>('/appointments', 'POST', data);
    }

    async updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment> {
        return this.request<Appointment>(`/appointments/${id}`, 'PATCH', data);
    }

    async cancelAppointment(id: string): Promise<void> {
        return this.request<void>(`/appointments/${id}`, 'DELETE');
    }
}
