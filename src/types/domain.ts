export interface Patient {
    id: string;
    name: string;
    phone: string;
    email?: string;
}

export interface Exam {
    code: string;
    name: string;
    description: string;
}

export interface Appointment {
    id: string;
    patientId: string;
    examCode: string;
    branchId: string;
    date: string; // ISO 8601
    status: 'scheduled' | 'cancelled' | 'completed';
}

export interface GOESOrder {
    orderId: string;
    patientId: string;
    examCode: string;
    isValid: boolean;
    expirationDate: string;
    examName?: string;
}

export interface Branch {
    id: string;
    name: string;
    address: string;
}

export interface TimeSlot {
    start: string; // ISO 8601
    end: string;
    available: boolean;
}

export interface PatientHistoryEvent {
    id: string;
    patientId: string;
    eventType: 'appointment_created' | 'appointment_cancelled' | 'info_query' | 'log_event';
    timestamp: string;
    details: Record<string, any>;
    source: 'ai_assistant' | 'n8n' | 'manual';
}
