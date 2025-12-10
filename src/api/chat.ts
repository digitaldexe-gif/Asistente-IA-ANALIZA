import { FastifyRequest, FastifyReply } from 'fastify';
import OpenAI from 'openai';
import { config } from '../config/env.js';
import { tools } from '../services/openai/tools.js';
import { PersistentMemoryService } from '../services/memory/persistent.js';
import { KbService } from '../kb/kb.service.js';
import { ScheduleService } from '../services/schedule/index.js';

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface ChatRequest {
    message: string;
    sessionId?: string;
}

export async function chatHandler(req: FastifyRequest<{ Body: ChatRequest }>, reply: FastifyReply) {
    const { message, sessionId = `chat-${Date.now()}` } = req.body;

    if (!message) {
        return reply.code(400).send({ error: 'Message is required' });
    }

    const memoryService = PersistentMemoryService.getInstance();
    const kbService = new KbService();
    const scheduleService = new ScheduleService();
    const session = memoryService.getSession(sessionId);

    try {
        // Build conversation history
        // Build conversation history
        // Build conversation history
        const { SYSTEM_PROMPT } = await import('../services/openai/prompt.js');

        const history = session.history || [];
        const messages: ChatMessage[] = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history.map((h: any) => ({ role: h.role, content: h.content } as ChatMessage)),
            { role: 'user', content: message }
        ];

        // Save user message to history
        await memoryService.addMessage(sessionId, 'user', message);

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages as any,
            tools: tools.map(tool => ({

                const aiMessage = response.choices[0].message;
                const toolCalls = aiMessage.tool_calls || [];

                // Execute tool calls
                const toolResults: any[] = [];

                for(const toolCall of toolCalls) {
                    if (!('function' in toolCall)) continue;

                    const functionName = toolCall.function.name;
                    const args = JSON.parse(toolCall.function.arguments);

                    console.log(`[${sessionId}]Tool call: ${functionName}`, args);

                    let result: any = { error: 'Unknown tool' };

                    try {
                        if (functionName === 'validate_goes_code') {
                            const { GOESService } = await import('../services/goes/index.js');
                            const goesService = new GOESService();
                            const validation = goesService.validateCode(args.goesCode);

                            if (validation.valid && validation.data) {
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
                                result = { valid: false, message: 'Código GOES no válido o ya usado' };
                            }
                        } else if (functionName === 'sync_patient_to_vertical') {
                            const { GOESService } = await import('../services/goes/index.js');
                            const goesService = new GOESService();

                            const patient = await memoryService.findOrCreatePatientByGoesData({
                                name: args.patientName,
                                surname: args.patientSurname,
                                orderId: args.goesCode
                            });

                            await memoryService.addPatientExam(patient.id, {
                                code: args.examId.toString(),
                                name: args.examName
                            });

                            goesService.markAsUsed(args.goesCode);

                            await memoryService.addCallHistory(patient.id, {
                                summary: `GOES ${args.goesCode} validated.Exam: ${args.examName} `,
                                outcome: 'goes_validated'
                            });

                            session.patientId = patient.id;

                            result = {
                                success: true,
                                patientId: patient.id,
                                patientContext: {
                                    fullName: `${patient.name} ${patient.surname} `,
                                    firstName: patient.name,
                                    isReturningPatient: patient.history.length > 0,
                                    previousCalls: patient.history.map((h: any) => ({
                                        date: h.date.toISOString().split('T')[0],
                                        summary: h.summary,
                                        outcome: h.outcome
                                    })),
                                    allExams: patient.exams.map((e: any) => ({
                                        name: e.examName,
                                        code: e.examCode,
                                        date: e.date.toISOString().split('T')[0]
                                    })),
                                    currentExam: { name: args.examName, code: args.examId },
                                    preferences: patient.profile ? {
                                        preferredBranchId: patient.profile.preferredBranchId,
                                        emotionalState: patient.profile.emotionalState
                                    } : null
                                }
                            };
                        } else if (functionName === 'get_available_slots') {
                            const slots = scheduleService.getAvailableSlots(args.branchId, args.examCode);
                            const filtered = slots.slice(0, 5);
                            result = { slots: filtered };
                        } else if (functionName === 'book_slot') {
                            const success = scheduleService.markAsBooked(args.slotId);
                            if (success && session.patientId) {
                                await memoryService.addCallHistory(session.patientId, {
                                    summary: `Slot ${args.slotId} booked`,
                                    outcome: 'slot_booked'
                                });
                            }
                            result = success ? { success: true, slotId: args.slotId } : { error: 'Slot not available' };
                        }
                    } catch (err: any) {
                        console.error(`[${sessionId}] Error executing ${functionName}: `, err);
                        result = { error: err.message };
                    }

                    toolResults.push({
                        tool_call_id: toolCall.id,
                        role: 'tool' as const,
                        name: functionName,
                        content: JSON.stringify(result)
                    });
                }

    // Get final response if there were tool calls
    let finalResponse = aiMessage.content;

                if(toolResults.length > 0) {
                const followUp = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        ...messages,
                        aiMessage,
                        ...toolResults
                    ]
                });

                finalResponse = followUp.choices[0].message.content;
            }

    return reply.send({
                sessionId,
                response: finalResponse,
                toolsExecuted: toolCalls.filter(tc => 'function' in tc).map(tc => (tc as any).function.name)
            });

        } catch (err: any) {
            console.error(`[${sessionId}] Chat error: `, err);
            return reply.code(500).send({ error: err.message });
        }
    }
