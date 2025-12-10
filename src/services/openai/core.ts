import WebSocket from 'ws';
import { FastifyRequest } from 'fastify';
import { config } from '../../config/env.js';
import { tools } from './tools.js';
import { GOESService } from '../goes/goes.service.js'; // Internal Service
import { PersistentMemoryService } from '../memory/persistent.js';
import { KbService } from '../../kb/kb.service.js';
import { ScheduleService } from '../schedule/schedule.service.js';

import { SYSTEM_PROMPT } from './prompt.js';

const OPENAI_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17';

export interface IOpenAICoreConfig {
    audioFormat: 'pcm16' | 'g711_ulaw';
    callerPhone?: string;
}

export class OpenAICore {
    private openaiWs: WebSocket | null = null;
    private sessionId: string;
    private config: IOpenAICoreConfig;
    private memoryService = PersistentMemoryService.getInstance();
    private kbService = new KbService();
    // private n8nService = getN8nService(); // REMOVED
    private scheduleService = new ScheduleService();
    private goesService = new GOESService(); // Internal Mock Service
    private eventListeners: { [key: string]: Function[] } = {};

    constructor(config: IOpenAICoreConfig) {
        this.config = config;
        this.sessionId = `session-${Date.now()}`;
    }

    public on(event: string, callback: Function) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    private emit(event: string, data: any) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(cb => cb(data));
        }
    }

    public connect() {
        console.log(`[${this.sessionId}] Connecting to OpenAI for ${this.config.callerPhone}`);

        this.openaiWs = new WebSocket(OPENAI_URL, {
            headers: {
                Authorization: `Bearer ${config.OPENAI_API_KEY}`,
                'OpenAI-Beta': 'realtime=v1',
            },
        });

        const session = this.memoryService.getSession(this.sessionId);
        session.callerPhone = this.config.callerPhone || '+50300000000';

        this.openaiWs.on('open', () => {
            console.log(`[${this.sessionId}] Connected to OpenAI`);
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    modalities: ['text', 'audio'],
                    instructions: SYSTEM_PROMPT,
                    voice: 'coral',
                    input_audio_format: this.config.audioFormat,
                    output_audio_format: this.config.audioFormat,
                    tool_choice: 'auto',
                    tools: tools,
                    turn_detection: {
                        type: 'server_vad',
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 200
                    }
                },
            };
            this.sendToOpenAI(sessionUpdate);
        });

        this.openaiWs.on('message', async (data: any) => {
            const event = JSON.parse(data.toString());

            if (event.type === 'response.audio.delta') {
                this.emit('audio', event.delta);
            }

            if (event.type === 'response.text.delta') {
                this.emit('text', event.delta);
            }

            if (event.type === 'response.function_call_arguments.done') {
                await this.handleToolCall(event);
            }
        });

        this.openaiWs.on('close', (code, reason) => {
            console.log(`[${this.sessionId}] OpenAI connection closed: ${code} ${reason}`);
            this.emit('close', { code, reason });
        });

        this.openaiWs.on('error', (err) => {
            console.error(`[${this.sessionId}] OpenAI WebSocket Error:`, err);
            this.emit('error', err);
        });
    }

    public sendAudio(base64Audio: string) {
        if (this.openaiWs && this.openaiWs.readyState === WebSocket.OPEN) {
            const audioAppend = {
                type: 'input_audio_buffer.append',
                audio: base64Audio,
            };
            this.sendToOpenAI(audioAppend);
        }
    }

    public sendText(text: string) {
        if (this.openaiWs && this.openaiWs.readyState === WebSocket.OPEN) {
            const textEvent = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [
                        { type: 'input_text', text: text }
                    ]
                }
            };
            this.sendToOpenAI(textEvent);
            this.sendToOpenAI({ type: 'response.create' });
        }
    }

    private sendToOpenAI(data: any) {
        if (this.openaiWs && this.openaiWs.readyState === WebSocket.OPEN) {
            this.openaiWs.send(JSON.stringify(data));
        }
    }

    public close() {
        if (this.openaiWs) {
            this.openaiWs.close();
            this.openaiWs = null;
        }
        this.memoryService.clearSession(this.sessionId);
    }

    private async handleToolCall(event: any) {
        const { name, arguments: argsStr, call_id } = event;
        const args = JSON.parse(argsStr);
        const session = this.memoryService.getSession(this.sessionId);
        console.log(`[${this.sessionId}] Tool call: ${name}`, args);

        let result: any = { error: 'Unknown tool or not implemented' };

        try {
            // --- 1. GOES & Validation Tools ---
            if (name === 'validate_goes_code') {
                // Internal Service Call
                const validation = this.goesService.validateCode(args.goesCode);

                if (validation.valid && validation.data) {
                    session.goesData = validation.data;
                    result = {
                        valid: true,
                        patient: {
                            name: validation.data.patientName,
                            surname: validation.data.patientSurname,
                            document: validation.data.document
                        },
                        exam: {
                            id: validation.data.examId,
                            name: validation.data.examName
                        }
                    };
                } else {
                    result = { valid: false, message: 'Código GOES no válido o ya usado.' };
                }

            } else if (name === 'sync_patient_to_vertical') {
                // Logic to "sync" to External DB (Mocked via Memory for now)
                try {
                    const patient = await this.memoryService.findOrCreatePatientByGoesData({
                        name: args.patientName,
                        surname: args.patientSurname,
                        orderId: args.goesCode
                    });

                    // Link Phone
                    if (session.callerPhone && session.callerPhone !== '+50300000000') {
                        await this.memoryService.addPhoneNumber(patient.id, session.callerPhone);
                    }

                    // Add Exam Request
                    await this.memoryService.addPatientExam(patient.id, {
                        code: args.examId.toString(),
                        name: args.examName
                    });

                    // Mark Code Used
                    this.goesService.markAsUsed(args.goesCode);

                    // Log History
                    await this.memoryService.addCallHistory(patient.id, {
                        summary: `GOES ${args.goesCode} validated. Exam: ${args.examName}`,
                        outcome: 'goes_validated'
                    });

                    // Update Session
                    session.patientId = patient.id;
                    session.order = {
                        patientId: patient.id,
                        examCode: args.examId.toString(),
                        examName: args.examName
                    };

                    result = {
                        success: true,
                        patientId: patient.id,
                        patientContext: {
                            fullName: `${patient.name} ${patient.surname}`,
                            isReturningPatient: patient.history.length > 0
                        }
                    };
                } catch (err: any) {
                    console.error(`[${this.sessionId}] Error syncing:`, err);
                    result = { success: false, error: err.message };
                }

                // --- 2. Knowledge Base Tools ---
            } else if (name === 'search_knowledge') {
                const results = this.kbService.searchKnowledge(args.query);
                result = { results };

            } else if (name === 'get_branches') {
                result = { branches: this.kbService.getBranches(args.city) };
            } else if (name === 'get_exam_info') {
                result = { exams: this.kbService.getExamInfo(args.query) };
            } else if (name === 'get_company_info') {
                result = { info: this.kbService.getCompanyInfo() };
            } else if (name === 'get_policies') {
                result = { policies: this.kbService.getPolicies(args.keyword) };
            } else if (name === 'get_faq') {
                result = { faqs: this.kbService.getFAQ(args.query) };

                // --- 3. Agenda / Scheduling Tools ---
            } else if (name === 'get_available_slots') {
                const slots = this.scheduleService.getAvailableSlots(args.branchId, args.examCode);
                const filtered = args.date
                    ? slots.filter((s: any) => s.start.startsWith(args.date))
                    : slots.slice(0, 20); // Limit results
                result = { slots: filtered };

            } else if (name === 'book_slot') {
                const success = this.scheduleService.markAsBooked(args.slotId);

                if (success && session.patientId) {
                    await this.memoryService.addCallHistory(session.patientId, {
                        summary: `Slot ${args.slotId} booked for exam ${args.examCode}`,
                        outcome: 'slot_booked'
                    });
                }

                // Also update session state if needed
                result = success
                    ? { success: true, slotId: args.slotId, message: "Cita confirmada exitosamente." }
                    : { error: 'El horario seleccionado ya no está disponible.' };

            } else if (name === 'suggest_best_slot') {
                const bestSlot = await this.scheduleService.suggestBestSlot(args.patientId, args.examCode, args.branchId);
                result = bestSlot ? { slot: bestSlot } : { error: 'No se encontraron horarios preferentes.' };
            }

        } catch (err: any) {
            console.error(`[${this.sessionId}] Tool execution error`, err);
            result = { error: 'Internal processing error: ' + err.message };
        }

        const toolOutput = {
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: call_id,
                output: JSON.stringify(result),
            },
        };
        this.sendToOpenAI(toolOutput);
        this.sendToOpenAI({ type: 'response.create' });
    }
}
