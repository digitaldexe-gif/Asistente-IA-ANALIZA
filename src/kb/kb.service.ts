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

/**
 * KbService - Read-only Knowledge Base for reference data
 * 
 * This service provides access to static reference data (exams, branches, policies, FAQ).
 * It does NOT handle patient data, appointments, or history.
 * 
 * For persistent data (patients, appointments, history), use PersistentMemoryService with Prisma.
 */
export class KbService {
    private readonly dataDir = path.join(process.cwd(), 'src', 'kb');
    private readonly kbPath = path.join(this.dataDir, 'kbdata.json');

    private kbData: KbData;

    constructor() {
        this.kbData = this.loadKbData();
    }

    // --- Helper ---

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

    // --- Knowledge Base Methods (Read-Only) ---

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
}
