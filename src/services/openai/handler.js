import WebSocket from 'ws';
import { config } from '../../config/env.js';
import { tools } from './tools.js';
import { getN8nService } from '../n8n/index.js';
import { PersistentMemoryService } from '../memory/persistent.js';
import { KbService } from '../../kb/kb.service.js';
const OPENAI_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
export async function handleOpenAIStream(connection, req) {
    const ws = connection.socket;
    const n8nService = getN8nService();
    const memoryService = PersistentMemoryService.getInstance();
    const kbService = new KbService();
    const sessionId = `session-${Date.now()}`;
    // ... (rest of the function)
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
                instructions: `Eres un asistente telefónico de Laboratorios Analisa.
        Tu objetivo es ayudar a los pacientes a agendar citas.
        1. Pide el número de orden (código GOES).
        2. Valida el código usando 'validate_order'.
        3. Si es válido, el sistema cargará la información del paciente. Úsala para personalizar el trato.
        4. Ayuda a buscar horarios ('check_availability') y agendar ('book_appointment').
        Mantén un tono profesional pero empático.`,
                voice: 'alloy',
                input_audio_format: 'g711_ulaw',
                output_audio_format: 'g711_ulaw',
                tools: tools,
                tool_choice: 'auto',
            },
        };
        openaiWs.send(JSON.stringify(sessionUpdate));
    });
    openaiWs.on('message', async (data) => {
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
            let result = { error: 'Unknown tool' };
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
                            const patientDb = await memoryService.findOrCreatePatientByGoesData({
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
                        }
                        else {
                            result = { success: true, order, warning: "Patient data not found for memory linking" };
                        }
                        // -------------------------------------
                    }
                    else {
                        result = { success: false, message: 'Order invalid or expired' };
                    }
                }
                else if (name === 'get_branches') {
                    const branches = kbService.getBranches(args.city);
                    result = { branches };
                }
                else if (name === 'get_exam_info') {
                    const exams = kbService.getExamInfo(args.query);
                    result = { exams };
                }
                else if (name === 'get_company_info') {
                    const info = kbService.getCompanyInfo();
                    result = { info };
                }
                else if (name === 'get_policies') {
                    const policies = kbService.getPolicies(args.keyword);
                    result = { policies };
                }
                else if (name === 'get_faq') {
                    const faqs = kbService.getFAQ(args.query);
                    result = { faqs };
                }
                else if (name === 'search_knowledge') {
                    const results = kbService.searchKnowledge(args.query);
                    result = { results };
                }
                else if (name === 'check_availability') {
                    if (!session.order) {
                        result = { error: 'No active order validated.' };
                    }
                    else {
                        const startDate = args.date || new Date().toISOString();
                        const endDate = new Date(new Date(startDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
                        const slots = await n8nService.getSlots(session.order.examCode, args.branchId, startDate, endDate);
                        session.cachedSlots = slots;
                        memoryService.updateSession(sessionId, { cachedSlots: slots });
                        result = { slots };
                    }
                }
                else if (name === 'book_appointment') {
                    if (!session.order) {
                        result = { error: 'No active order validated.' };
                    }
                    else {
                        const appointment = await n8nService.createAppointment({
                            patientId: session.order.patientId,
                            examCode: session.order.examCode,
                            branchId: session.selectedBranchId || 'unknown',
                            date: args.slotStart,
                        });
                        // Record success in history
                        if (session.patientId) {
                            await memoryService.addCallHistory(session.patientId, {
                                summary: `Appointment booked for ${session.order.examCode}`,
                                outcome: 'appointment_created'
                            });
                        }
                        result = { success: true, appointmentId: appointment.id };
                    }
                }
            }
            catch (err) {
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
    ws.on('message', (message) => {
        const msg = JSON.parse(message.toString());
        if (msg.event === 'media') {
            const audioAppend = {
                type: 'input_audio_buffer.append',
                audio: msg.media.payload,
            };
            if (openaiWs.readyState === WebSocket.OPEN) {
                openaiWs.send(JSON.stringify(audioAppend));
            }
        }
        else if (msg.event === 'start') {
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
