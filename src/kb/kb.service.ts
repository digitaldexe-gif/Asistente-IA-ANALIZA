import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Interfaces ---

interface KbExam {
    code: string;
    name: string;
    category: string;
    duration: string;
    description: string;
    requirements: string[];
    indications: string[];
}

interface KbBranch {
    id: string;
    name: string;
    city: string;
    address: string;
    phone: string;
    coordinates: { lat: number; lng: number };
}

interface KbPolicy {
    id: string;
    title: string;
    content: string;
    details: string[];
}

interface KbFaq {
    question: string;
    answer: string;
    keywords: string[];
}

interface KbPersonnel {
    name: string;
    role: string;
    specialty: string;
    branch: string;
    experience: string;
    description: string;
}

interface KbData {
    exams: KbExam[];
    branches: KbBranch[];
    company: any;
    policies: KbPolicy[];
    faq: KbFaq[];
    personnel: KbPersonnel[];
}

// Patient & Appointment Interfaces (Simplified for JSON storage)
interface Patient {
    id: string;
    name: string;
    phone: string;
    email?: string;
    dob?: string;
    gender?: string;
}

interface Appointment {
    id: string;
    patientId: string;
    examCode: string;
    branchId: string;
    date: string;
    status: 'scheduled' | 'cancelled' | 'completed';
}

interface PatientHistoryEntry {
    id: string;
    patientId: string;
    eventType: string;
    timestamp: string;
    details: any;
    source: string;
}

export class KbService {
    private readonly dataDir = path.join(process.cwd(), 'src', 'kb');
    private readonly kbPath = path.join(this.dataDir, 'kbdata.json');
    private readonly patientsPath = path.join(this.dataDir, 'patients.json');
    private readonly appointmentsPath = path.join(this.dataDir, 'appointments.json');
    private readonly historyPath = path.join(this.dataDir, 'patientHistory.json');

    private kbData: KbData;

    constructor() {
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        this.kbData = this.loadKbData();
        this.ensureFileExists(this.patientsPath, []);
        this.ensureFileExists(this.appointmentsPath, []);
        this.ensureFileExists(this.historyPath, []);
    }

    // --- Helpers ---

    private ensureFileExists(filePath: string, defaultContent: any) {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
        }
    }

    private loadKbData(): KbData {
        try {
            if (!fs.existsSync(this.kbPath)) {
                console.error(`KB Data file not found at: ${this.kbPath}`);
                return { exams: [], branches: [], company: {}, policies: [], faq: [], personnel: [] };
            }
            const fileContent = fs.readFileSync(this.kbPath, 'utf-8');
            return JSON.parse(fileContent);
        } catch (error) {
            console.error('Error loading KB data:', error);
            return { exams: [], branches: [], company: {}, policies: [], faq: [], personnel: [] };
        }
    }

    private readJson<T>(filePath: string): T {
        try {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error);
            return [] as any;
        }
    }

    private writeJson(filePath: string, data: any) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Error writing file ${filePath}:`, error);
        }
    }

    // --- Knowledge Base Methods ---

    loadData(): KbData {
        return this.kbData;
    }

    getBranches(city?: string): KbBranch[] {
        if (!city) return this.kbData.branches;
        return this.kbData.branches.filter(b =>
            (b.city?.toLowerCase() || '').includes(city.toLowerCase()) ||
            (b.address?.toLowerCase() || '').includes(city.toLowerCase())
        );
    }

    getExamInfo(query: string): KbExam[] {
        const normalizedQuery = query.toLowerCase();
        return this.kbData.exams.filter(e =>
            (e.code?.toLowerCase() === normalizedQuery) ||
            (e.name?.toLowerCase() || '').includes(normalizedQuery) ||
            (e.description?.toLowerCase() || '').includes(normalizedQuery)
        );
    }

    getCompanyInfo(): any {
        return this.kbData.company;
    }

    getPolicies(keyword?: string): KbPolicy[] {
        if (!keyword) return this.kbData.policies;
        const normalizedQuery = keyword.toLowerCase();
        return this.kbData.policies.filter(p =>
            (p.title?.toLowerCase() || '').includes(normalizedQuery) ||
            (p.content?.toLowerCase() || '').includes(normalizedQuery)
        );
    }

    getFAQ(query: string): KbFaq[] {
        const normalizedQuery = query.toLowerCase();
        return this.kbData.faq.filter(f =>
            (f.question?.toLowerCase() || '').includes(normalizedQuery) ||
            (f.keywords || []).some((k: string) => (k?.toLowerCase() || '').includes(normalizedQuery))
        );
    }

    searchKnowledge(query: string): any {
        const normalizedQuery = query.toLowerCase();
        return {
            exams: this.getExamInfo(query),
            faqs: this.getFAQ(query),
            policies: this.getPolicies(query),
            personnel: this.kbData.personnel.filter(p =>
                (p.name?.toLowerCase() || '').includes(normalizedQuery) ||
                (p.specialty?.toLowerCase() || '').includes(normalizedQuery) ||
                (p.branch?.toLowerCase() || '').includes(normalizedQuery)
            )
        };
    }

    // --- Patient Methods ---

    getAllPatients(): Patient[] {
        return this.readJson<Patient[]>(this.patientsPath);
    }

    getPatientById(id: string): Patient | null {
        const patients = this.getAllPatients();
        return patients.find(p => p.id === id) || null;
    }

    addPatient(patient: Omit<Patient, 'id'>): Patient {
        const patients = this.getAllPatients();
        const newPatient = { ...patient, id: `P-${Date.now()}` };
        patients.push(newPatient);
        this.writeJson(this.patientsPath, patients);
        return newPatient;
    }

    updatePatient(id: string, data: Partial<Patient>): Patient | null {
        const patients = this.getAllPatients();
        const index = patients.findIndex(p => p.id === id);
        if (index === -1) return null;

        patients[index] = { ...patients[index], ...data };
        this.writeJson(this.patientsPath, patients);
        return patients[index];
    }

    // --- Appointment Methods ---

    getAppointmentsByPatientId(patientId: string): Appointment[] {
        const appointments = this.readJson<Appointment[]>(this.appointmentsPath);
        return appointments.filter(a => a.patientId === patientId);
    }

    addAppointment(appointment: Omit<Appointment, 'id' | 'status'>): Appointment {
        const appointments = this.readJson<Appointment[]>(this.appointmentsPath);
        const newAppointment: Appointment = {
            ...appointment,
            id: `APT-${Date.now()}`,
            status: 'scheduled'
        };
        appointments.push(newAppointment);
        this.writeJson(this.appointmentsPath, appointments);
        return newAppointment;
    }

    updateAppointment(id: string, data: Partial<Appointment>): Appointment | null {
        const appointments = this.readJson<Appointment[]>(this.appointmentsPath);
        const index = appointments.findIndex(a => a.id === id);
        if (index === -1) return null;

        appointments[index] = { ...appointments[index], ...data };
        this.writeJson(this.appointmentsPath, appointments);
        return appointments[index];
    }

    cancelAppointment(id: string): boolean {
        const appointments = this.readJson<Appointment[]>(this.appointmentsPath);
        const index = appointments.findIndex(a => a.id === id);
        if (index === -1) return false;

        appointments[index].status = 'cancelled';
        this.writeJson(this.appointmentsPath, appointments);
        return true;
    }

    // --- History Methods ---

    getPatientHistory(patientId: string): PatientHistoryEntry[] {
        const history = this.readJson<PatientHistoryEntry[]>(this.historyPath);
        return history.filter(h => h.patientId === patientId);
    }

    addHistoryEntry(entry: Omit<PatientHistoryEntry, 'id' | 'timestamp'>): PatientHistoryEntry {
        const history = this.readJson<PatientHistoryEntry[]>(this.historyPath);
        const newEntry: PatientHistoryEntry = {
            ...entry,
            id: `EVT-${Date.now()}`,
            timestamp: new Date().toISOString()
        };
        history.push(newEntry);
        this.writeJson(this.historyPath, history);
        return newEntry;
    }
}
