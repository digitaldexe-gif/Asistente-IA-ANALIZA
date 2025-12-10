import WebSocket from 'ws';
import { FastifyRequest } from 'fastify';
import { config } from '../../config/env.js';
import { tools } from './tools.js';
import { getN8nService } from '../n8n/index.js';
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
    private n8nService = getN8nService();
    private scheduleService = new ScheduleService();
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

            if (event.type === 'response.audio_transcript.delta') {
                // Optional: emit transcript if needed
                // this.emit('transcript', event.delta);
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

        let result: any = { error: 'Unknown tool' };

        try {
            if (name === 'validate_order') {
                const order = await this.n8nService.validateOrder(args.orderId);
                if (order && order.isValid) {
                    session.order = order;
                    this.memoryService.updateSession(this.sessionId, { order });

                    const patientData = await this.n8nService.getPatient(order.patientId);
                    if (patientData) {
                        const [name, ...surnameParts] = patientData.name.split(' ');
                        const surname = surnameParts.join(' ');
                        const patientDb: any = await this.memoryService.findOrCreatePatientByGoesData({
                            name: name || 'Unknown',
                            surname: surname || 'Unknown',
                            orderId: order.orderId
                        });

                        await this.memoryService.addPhoneNumber(patientDb.id, session.callerPhone);
                        await this.memoryService.addPatientExam(patientDb.id, {
                            code: order.examCode,
                            name: order.examName || 'Examen Médico'
                        });

                        session.patientId = patientDb.id;

                        result = {
                            success: true,
                            order,
                            patientHistory: patientDb.history,
                            patientExams: patientDb.exams,
                            patientProfile: {
                                emotionalState: patientDb.profile?.emotionalState || 'neutral',
                                preferredBranchId: patientDb.profile?.preferredBranchId
                            }
                        };
                    } else {
                        result = { success: true, order, warning: "Patient data not found for memory linking" };
                    }
                } else {
                    result = { success: false, message: 'Order invalid or expired' };
                }

            } else if (name === 'validate_goes_code') {
                const { GOESService } = await import('../goes/index.js');
                const goesService = new GOESService();
                const validation = goesService.validateCode(args.goesCode);
                if (validation.valid && validation.data) {
                    session.goesData = validation.data;
                    result = {
                        valid: true,
                        patient: { name: validation.data.patientName, surname: validation.data.patientSurname, document: validation.data.document },
                        exam: { id: validation.data.examId, name: validation.data.examName }
                    };
                } else {
                    result = { valid: false, message: 'Código GOES no válido o ya usado' };
                }
            } else if (name === 'sync_patient_to_vertical') {
                const { GOESService } = await import('../goes/index.js');
                const goesService = new GOESService();
                try {
                    const patient = await this.memoryService.findOrCreatePatientByGoesData({
                        name: args.patientName, surname: args.patientSurname, orderId: args.goesCode
                    });
                    if (session.callerPhone && session.callerPhone !== '+50300000000') {
                        await this.memoryService.addPhoneNumber(patient.id, session.callerPhone);
                    }
                    await this.memoryService.addPatientExam(patient.id, { code: args.examId.toString(), name: args.examName });
                    goesService.markAsUsed(args.goesCode);
                    await this.memoryService.addCallHistory(patient.id, { summary: `GOES ${args.goesCode} validated. Exam: ${args.examName}`, outcome: 'goes_validated' });
                    session.patientId = patient.id;
                    session.order = { patientId: patient.id, examCode: args.examId.toString(), examName: args.examName };
                    result = {
                        success: true, patientId: patient.id,
                        patientContext: {
                            fullName: `${patient.name} ${patient.surname}`, firstName: patient.name,
                            isReturningPatient: patient.history.length > 0,
                            previousCalls: patient.history.map((h: any) => ({ date: h.date.toISOString().split('T')[0], summary: h.summary, outcome: h.outcome })),
                            allExams: patient.exams.map((e: any) => ({ name: e.examName, code: e.examCode, date: e.date.toISOString().split('T')[0] })),
                            currentExam: { name: args.examName, code: args.examId },
                            preferences: patient.profile ? { preferredBranchId: patient.profile.preferredBranchId, emotionalState: patient.profile.emotionalState, notes: patient.profile.notes } : null
                        }
                    };
                } catch (err: any) {
                    console.error(`[${this.sessionId}] Error syncing:`, err);
                    result = { success: false, error: err.message };
                }
            } else if (name === 'get_branches') {
                const branches = this.kbService.getBranches(args.city);
                result = { branches };
            } else if (name === 'get_exam_info') {
                const exams = this.kbService.getExamInfo(args.query);
                result = { exams };
            } else if (name === 'get_company_info') {
                const info = this.kbService.getCompanyInfo();
                result = { info };
            } else if (name === 'get_policies') {
                const policies = this.kbService.getPolicies(args.keyword);
                result = { policies };
            } else if (name === 'get_faq') {
                const faqs = this.kbService.getFAQ(args.query);
                result = { faqs };
            } else if (name === 'search_knowledge') {
                const results = this.kbService.searchKnowledge(args.query);
                result = { results };
            } else if (name === 'check_availability') {
                if (!session.order) {
                    result = { error: 'No active order validated.' };
                } else {
                    const branchId = args.branchId || 'SS-001';
                    const startDate = args.date || new Date().toISOString().split('T')[0];

                    const allSlots = this.scheduleService.getAvailableSlots(branchId, session.order.examCode);
                    const filteredSlots = allSlots
                        .filter((slot: any) => slot.start.startsWith(startDate))
                        .slice(0, 20);

                    session.cachedSlots = filteredSlots;
                    this.memoryService.updateSession(this.sessionId, { cachedSlots: filteredSlots });
                    result = { slots: filteredSlots };
                }
            } else if (name === 'book_appointment') {
                if (!session.order) {
                    result = { error: 'No active order validated.' };
                } else {
                    const appointment = await this.n8nService.createAppointment({
                        patientId: session.order.patientId,
                        examCode: session.order.examCode,
                        branchId: session.selectedBranchId || 'unknown',
                        date: args.slotStart,
                    });

                    const slotToBook = this.scheduleService.getAllSlots().find(
                        (s: any) => s.start === args.slotStart && s.branchId === (session.selectedBranchId || 'unknown')
                    );
                    if (slotToBook) {
                        this.scheduleService.markAsBooked(slotToBook.slotId);
                    }

                    if (session.patientId) {
                        await this.memoryService.addCallHistory(session.patientId, {
                            summary: `Appointment booked for ${session.order.examCode} at ${args.slotStart}`,
                            outcome: 'appointment_created'
                        });
                    }

                    result = { success: true, appointmentId: appointment.id };
                }
            } else if (name === 'get_available_slots') {
                const slots = this.scheduleService.getAvailableSlots(args.branchId, args.examCode);
                const filtered = args.date
                    ? slots.filter((s: any) => s.start.startsWith(args.date))
                    : slots.slice(0, 20);
                result = { slots: filtered };
            } else if (name === 'suggest_best_slot') {
                const bestSlot = await this.scheduleService.suggestBestSlot(args.patientId, args.examCode, args.branchId);
                result = bestSlot ? { slot: bestSlot } : { error: 'No available slots found' };
            } else if (name === 'book_slot') {
                const success = this.scheduleService.markAsBooked(args.slotId);
                if (success && session.patientId) {
                    await this.memoryService.addCallHistory(session.patientId, {
                        summary: `Slot ${args.slotId} booked for exam ${args.examCode}`,
                        outcome: 'slot_booked'
                    });
                }
                result = success ? { success: true, slotId: args.slotId } : { error: 'Slot not available' };
            }
        } catch (err: any) {
            console.error(`[${this.sessionId}] Tool execution error`, err);
            result = { error: err.message };
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
