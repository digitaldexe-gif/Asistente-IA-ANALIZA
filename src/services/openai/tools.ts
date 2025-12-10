export const tools = [
    {
        type: 'function',
        name: 'validate_goes_code',
        description: 'Validates a 6-digit GOES code from the Ministry of Health. ALWAYS call this when patient provides a code. Returns patient and exam data if valid.',
        parameters: {
            type: 'object',
            properties: {
                goesCode: {
                    type: 'string',
                    description: 'The 6-digit GOES code from the patient',
                },
            },
            required: ['goesCode'],
        },
    },
    {
        type: 'function',
        name: 'sync_patient_to_vertical',
        description: 'Syncs GOES patient to Vertical database. Call IMMEDIATELY after successful validation. Creates patient record and marks code as used.',
        parameters: {
            type: 'object',
            properties: {
                goesCode: {
                    type: 'string',
                    description: 'The validated GOES code',
                },
                patientName: {
                    type: 'string',
                    description: 'Patient first name from validation',
                },
                patientSurname: {
                    type: 'string',
                    description: 'Patient surname from validation',
                },
                document: {
                    type: 'string',
                    description: 'Patient document from validation',
                },
                examId: {
                    type: 'number',
                    description: 'Exam ID from validation',
                },
                examName: {
                    type: 'string',
                    description: 'Exam name from validation',
                },
            },
            required: ['goesCode', 'patientName', 'patientSurname', 'document', 'examId', 'examName'],
        },
    },
    {
        type: 'function',
        name: 'get_branches',
        description: 'Retrieves a list of available laboratory branches.',
        parameters: {
            type: 'object',
            properties: {
                city: {
                    type: 'string',
                    description: 'Optional city name to filter branches.',
                },
            },
        },
    },
    {
        type: 'function',
        name: 'get_exam_info',
        description: 'Retrieves detailed information about a medical exam.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The name or code of the exam.',
                },
            },
            required: ['query'],
        },
    },
    {
        type: 'function',
        name: 'get_company_info',
        description: 'Retrieves general information about the laboratory.',
        parameters: {
            type: 'object',
            properties: {},
        },
    },
    {
        type: 'function',
        name: 'get_policies',
        description: 'Retrieves internal policies of the laboratory.',
        parameters: {
            type: 'object',
            properties: {
                keyword: {
                    type: 'string',
                    description: 'Optional keyword to filter policies.',
                },
            },
        },
    },
    {
        type: 'function',
        name: 'get_faq',
        description: 'Searches for Frequently Asked Questions.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The user\'s question.',
                },
            },
            required: ['query'],
        },
    },
    {
        type: 'function',
        name: 'search_knowledge',
        description: 'Performs a general search across the Knowledge Base.',
        parameters: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The search query.',
                },
            },
            required: ['query'],
        },
    },
    {
        type: 'function',
        name: 'get_available_slots',
        description: 'Gets available appointment slots for a specific branch and optional exam.',
        parameters: {
            type: 'object',
            properties: {
                branchId: {
                    type: 'string',
                    description: 'The branch ID (e.g., SS-001, ESC-001)',
                },
                examCode: {
                    type: 'string',
                    description: 'Optional exam code to check availability for',
                },
                date: {
                    type: 'string',
                    description: 'Optional date in YYYY-MM-DD format to filter slots',
                },
            },
            required: ['branchId'],
        },
    },
    {
        type: 'function',
        name: 'book_slot',
        description: 'Books a specific time slot for a patient.',
        parameters: {
            type: 'object',
            properties: {
                slotId: {
                    type: 'string',
                    description: 'The slot ID to book (e.g., SLOT-000123)',
                },
                patientId: {
                    type: 'string',
                    description: 'The patient ID',
                },
                examCode: {
                    type: 'string',
                    description: 'The exam code',
                },
            },
            required: ['slotId', 'patientId', 'examCode'],
        },
    },
    {
        type: 'function',
        name: 'suggest_best_slot',
        description: 'Suggests the best available slot for a patient based on their preferences and history.',
        parameters: {
            type: 'object',
            properties: {
                patientId: {
                    type: 'string',
                    description: 'The patient ID',
                },
                branchId: {
                    type: 'string',
                    description: 'The branch ID where the appointment should be scheduled',
                },
                examCode: {
                    type: 'string',
                    description: 'The exam code for the appointment',
                },
            },
            required: ['patientId', 'branchId', 'examCode'],
        },
    },
];
