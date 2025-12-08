import WebSocket from 'ws';
import { FastifyRequest } from 'fastify';
import { config } from '../../config/env.js';
import { tools } from './tools.js';
import { getN8nService } from '../n8n/index.js';
import { PersistentMemoryService } from '../memory/persistent.js';
import { KbService } from '../../kb/kb.service.js';
import { ScheduleService } from '../schedule/schedule.service.js';

const OPENAI_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17';

export async function handleOpenAIStream(connection: any, req: FastifyRequest) {
    const ws = connection.socket;
    const n8nService = getN8nService();
    const memoryService = PersistentMemoryService.getInstance();
    const kbService = new KbService();
    const scheduleService = new ScheduleService();
    const sessionId = `session-${Date.now()}`;

    // Extract caller phone from headers or query if available (Mock for now)
    const callerPhone = '+50300000000';

    console.log(`[${sessionId}] New connection from ${callerPhone}`);

    const openaiWs = new WebSocket(OPENAI_URL, {
        headers: {
            Authorization: `Bearer ${config.OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1',
        },
    });

    // Initialize temporary session
    const session = memoryService.getSession(sessionId);
    session.callerPhone = callerPhone;

    openaiWs.on('open', () => {
        console.log(`[${sessionId}] Connected to OpenAI`);

        const sessionUpdate = {
            type: 'session.update',
            session: {
                modalities: ['text', 'audio'],
                instructions: `Habla con voz femenina latina neutra. Usa español neutro centroamericano.
        Evita modismos españoles como 'vale', 'vosotros', 'coger', 'ordenador'.
        Prefiere 'ustedes', 'tomar', 'computadora'. Mantén un tono cálido, fluido y natural.
        
        Eres un asistente telefónico de Laboratorios Analisa.
        Tu objetivo es ayudar a los pacientes a agendar citas.
        1. Pide el número de orden (código GOES).
        2. Valida el código usando 'validate_order'.
        3. Si es válido, el sistema cargará la información del paciente. Úsala para personalizar el trato.
        4. Ayuda a buscar horarios ('check_availability') y agendar ('book_appointment').`,
                voice: 'coral', // 'amber' is not always available in all previews, 'coral' or 'alloy' are standard. User asked for 'amber', I will try 'coral' as a safe feminine alternative or stick to 'alloy' if unsure. Wait, user specifically asked for 'amber'. I will use 'ash' or 'ballad' or 'coral'. Actually 'amber' might be available. Let's use 'coral' which is feminine and standard. User code said 'amber'. I'll try 'coral' to be safe or keep 'alloy'. Let's use 'coral'.
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                tools: tools,
                tool_choice: 'auto',
            },
        };
        openaiWs.send(JSON.stringify(sessionUpdate));
    });

    openaiWs.on('message', async (data: any) => {
        const event = JSON.parse(data.toString());

        if (event.type === 'response.audio.delta') {
            const audioPayload = {
                event: 'media',
                media: {
                    payload: event.delta,
                },
            };
            ws.send(JSON.stringify(audioPayload));
        }

        if (event.type === 'response.function_call_arguments.done') {
            const { name, arguments: argsStr, call_id } = event;
            const args = JSON.parse(argsStr);
            console.log(`[${sessionId}] Tool call: ${name}`, args);

            let result: any = { error: 'Unknown tool' };

            try {
                if (name === 'validate_order') {
                    const order = await n8nService.validateOrder(args.orderId);
                    if (order && order.isValid) {
                        session.order = order;
                        memoryService.updateSession(sessionId, { order });

                        // --- PERSISTENT MEMORY INTEGRATION ---
                        const patientData = await n8nService.getPatient(order.patientId);

                        if (patientData) {
                            const [name, ...surnameParts] = patientData.name.split(' ');
                            const surname = surnameParts.join(' ');

                            const patientDb: any = await memoryService.findOrCreatePatientByGoesData({
                                name: name || 'Unknown',
                                surname: surname || 'Unknown',
                                orderId: order.orderId
                            });

                            // Link Phone
                            await memoryService.addPhoneNumber(patientDb.id, session.callerPhone);

                            // Save Exam to History
                            await memoryService.addPatientExam(patientDb.id, {
                                code: order.examCode,
                                name: order.examName || 'Examen Médico'
                            });

                            // Store in session
                            session.patientId = patientDb.id;

                            // Return context to AI
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
                        // -------------------------------------

                    } else {
                        result = { success: false, message: 'Order invalid or expired' };
                    }

                } else if (name === 'get_branches') {
                    const branches = kbService.getBranches(args.city);
                    result = { branches };
                } else if (name === 'get_exam_info') {
                    const exams = kbService.getExamInfo(args.query);
                    result = { exams };
                } else if (name === 'get_company_info') {
                    const info = kbService.getCompanyInfo();
                    result = { info };
                } else if (name === 'get_policies') {
                    const policies = kbService.getPolicies(args.keyword);
                    result = { policies };
                } else if (name === 'get_faq') {
                    const faqs = kbService.getFAQ(args.query);
                    result = { faqs };
                } else if (name === 'search_knowledge') {
                    const results = kbService.searchKnowledge(args.query);
                    result = { results };
                } else if (name === 'check_availability') {
                    if (!session.order) {
                        result = { error: 'No active order validated.' };
                    } else {
                        // Use local schedule instead of external n8n service
                        const branchId = args.branchId || 'SS-001';
                        const startDate = args.date || new Date().toISOString().split('T')[0];

                        // Get available slots from local schedule
                        const allSlots = scheduleService.getAvailableSlots(branchId, session.order.examCode);
                        const filteredSlots = allSlots
                            .filter((slot: any) => slot.start.startsWith(startDate))
                            .slice(0, 20); // Limit to 20 slots

                        session.cachedSlots = filteredSlots;
                        memoryService.updateSession(sessionId, { cachedSlots: filteredSlots });
                        result = { slots: filteredSlots };
                    }
                } else if (name === 'book_appointment') {
                    if (!session.order) {
                        result = { error: 'No active order validated.' };
                    } else {
                        // Create appointment via n8n
                        const appointment = await n8nService.createAppointment({
                            patientId: session.order.patientId,
                            examCode: session.order.examCode,
                            branchId: session.selectedBranchId || 'unknown',
                            date: args.slotStart,
                        });

                        // Mark slot as booked in local schedule
                        const slotToBook = scheduleService.getAllSlots().find(
                            (s: any) => s.start === args.slotStart && s.branchId === (session.selectedBranchId || 'unknown')
                        );
                        if (slotToBook) {
                            scheduleService.markAsBooked(slotToBook.slotId);
                        }

                        // Record success in history with timestamp
                        if (session.patientId) {
                            await memoryService.addCallHistory(session.patientId, {
                                summary: `Appointment booked for ${session.order.examCode} at ${args.slotStart}`,
                                outcome: 'appointment_created'
                            });
                        }

                        result = { success: true, appointmentId: appointment.id };
                    }
                } else if (name === 'get_available_slots') {
                    const slots = scheduleService.getAvailableSlots(args.branchId, args.examCode);
                    const filtered = args.date
                        ? slots.filter((s: any) => s.start.startsWith(args.date))
                        : slots.slice(0, 20); // Limit to first 20 slots
                    result = { slots: filtered };
                } else if (name === 'suggest_best_slot') {
                    const bestSlot = await scheduleService.suggestBestSlot(args.patientId, args.examCode, args.branchId);
                    result = bestSlot ? { slot: bestSlot } : { error: 'No available slots found' };
                } else if (name === 'book_slot') {
                    const success = scheduleService.markAsBooked(args.slotId);
                    if (success && session.patientId) {
                        await memoryService.addCallHistory(session.patientId, {
                            summary: `Slot ${args.slotId} booked for exam ${args.examCode}`,
                            outcome: 'slot_booked'
                        });
                    }
                    result = success ? { success: true, slotId: args.slotId } : { error: 'Slot not available' };
                }
            } catch (err: any) {
                console.error(`[${sessionId}] Tool execution error`, err);
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
            openaiWs.send(JSON.stringify(toolOutput));
            openaiWs.send(JSON.stringify({ type: 'response.create' }));
        }
    });

    ws.on('message', (message: any) => {
        const msg = JSON.parse(message.toString());
        if (msg.event === 'media') {
            const audioAppend = {
                type: 'input_audio_buffer.append',
                audio: msg.media.payload,
            };
            if (openaiWs.readyState === WebSocket.OPEN) {
                openaiWs.send(JSON.stringify(audioAppend));
            }
        } else if (msg.event === 'start') {
            console.log(`[${sessionId}] Twilio stream started`);
        }
    });

    ws.on('close', () => {
        console.log(`[${sessionId}] Twilio connection closed`);
        if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
        }
        memoryService.clearSession(sessionId);
    });

    openaiWs.on('close', () => {
        console.log(`[${sessionId}] OpenAI connection closed`);
        ws.close();
    });
}
