export const tools = [
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
];
