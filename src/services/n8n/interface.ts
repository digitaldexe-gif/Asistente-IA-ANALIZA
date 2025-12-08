import { Appointment, Exam, GOESOrder, TimeSlot, Patient, Branch } from '../../types/domain.js';

export interface IN8nService {
    validateOrder(orderId: string): Promise<GOESOrder | null>;
    getPatient(patientId: string): Promise<Patient | null>;
    getExam(examCode: string): Promise<Exam | null>;
    getBranches(): Promise<Branch[]>;
    getSlots(examCode: string, branchId: string, startDate: string, endDate: string): Promise<TimeSlot[]>;
    createAppointment(appointment: Omit<Appointment, 'id' | 'status'>): Promise<Appointment>;
    updateAppointment(id: string, data: Partial<Appointment>): Promise<Appointment>;
    cancelAppointment(id: string): Promise<void>;
}
