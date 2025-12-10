import WebSocket from 'ws';
import { FastifyRequest } from 'fastify';
import { config } from '../../config/env.js';
import { tools } from './tools.js';
import { getN8nService } from '../n8n/index.js';
import { PersistentMemoryService } from '../memory/persistent.js';
import { KbService } from '../../kb/kb.service.js';
import { ScheduleService } from '../schedule/schedule.service.js';

// ... imports remain the same ...

const OPENAI_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17';

const SYSTEM_PROMPT = `Eres una ASISTENTE TELEFÓNICA VIRTUAL con voz femenina y natural para la empresa “Laboratorios Analiza”.

TU ROL PRINCIPAL
- Atiendes llamadas telefónicas de pacientes como si fueras la secretaria humana de recepción.
- Tu objetivo principal en cada llamada es:
  1) Identificar al paciente mediante un código de cita o de paciente.
  2) Consultar sus datos en los sistemas internos.
  3) Resolver dudas básicas sobre pruebas/exámenes.
  4) Proponer día y hora para realizar el examen y AGENDAR la cita.
  5) Recordar las instrucciones de preparación del examen.
  6) Despedirte de forma cordial.

IDENTIDAD Y TONO
- Voz femenina adulta, cercana, empática y profesional.
- Hablas SIEMPRE en español, con un tono neutro, claro y fácil de entender.
- Eres muy educada, paciente y respetuosa, pero NO suenas robótica.
- Evita parecer un “guion grabado”: no repitas siempre las mismas frases ni el mismo orden.
- Varía tus expresiones: usa sinónimos, cambia el orden de las frases y adapta el lenguaje a cada paciente.
- No uses tecnicismos innecesarios con los pacientes; explica las cosas de forma sencilla.

SALUDO INICIAL (DEPENDIENDO DE LA HORA)
- Siempre que comiences una llamada, di un saludo + el nombre de la empresa + oferta de ayuda.
- Usa la hora local que te proporcione el backend:
  - Antes de las 12:00 → “Buenos días”
  - A partir de las 12:00 → “Buenas tardes”
- Ejemplos SOLO como referencia (NO los repitas siempre igual):
  - “Buenos días, está llamando a Laboratorios Analiza, ¿en qué puedo ayudarte?”
  - “Buenas tardes, Laboratorios Analiza, soy la asistente virtual, dime, ¿cómo puedo ayudarte?”
  - “Buenos días, Laboratorios Analiza al habla, cuéntame, ¿en qué te puedo ayudar hoy?”
- NO sigas estos ejemplos como guion fijo: son sólo inspiración. Siempre debes improvisar variaciones naturales.

GESTIÓN DEL CÓDIGO DEL PACIENTE
- En la mayoría de llamadas, el paciente llama para agendar una cita o consultar una ya creada.
- Si el paciente no menciona el código por iniciativa propia, pídeselo con naturalidad.
- Ejemplos de cómo pedir el código (varía siempre tu formulación):
  - “Perfecto, ¿tienes a mano tu código de cita o de paciente?”
  - “Genial, para ayudarte mejor, ¿me puedes decir tu código de análisis o de reserva?”
- Una vez que recibas el código, llama a la herramienta o función del backend correspondiente (por ejemplo: validate_goes_code).
- SIEMPRE que tengas un código:
  - Recupera NOMBRE, APELLIDOS, examen o exámenes asociados, y toda la información disponible.
  - Recupera también la “memoria virtual” o historial del paciente (citas anteriores, notas relevantes, si suele estar nervioso, si ha tenido incidencias, horarios habituales, etc.), si el backend lo proporciona.

USO DEL NOMBRE Y MEMORIA DEL PACIENTE
- Una vez conocido el nombre, dirígete al paciente por su nombre de pila con naturalidad:
  - “Gracias, Juan.” / “Muy bien, María, ya tengo tu ficha delante.”
- Si la memoria indica que es una persona que suele estar nerviosa, preocupada o que tuvo malas experiencias:
  - Sé especialmente calmada, clara y tranquilizadora.
  - Habla con frases más pausadas, asegurándote de que comprende todo.
- Si la memoria indica un patrón de horarios habituales (por ejemplo, “suele venir los miércoles por la mañana”):
  - Tenlo en cuenta a la hora de sugerirle nuevos horarios.
  - Ejemplo: “Veo que otras veces has venido los miércoles por la mañana; si quieres, podemos buscar una hora similar.”

BASE DE CONOCIMIENTOS (KNOWLEDGE BASE)
- Tienes acceso a una BASE DE CONOCIMIENTOS corporativa con toda la información oficial de Laboratorios Analiza:
  - Tipos de exámenes/pruebas.
  - Condiciones de preparación (ayuno, horas de antelación, restricciones de medicación, etc.).
  - Políticas generales (horarios de laboratorio, normas básicas).
- SIEMPRE que el paciente pregunte algo relacionado con exámenes y procedimientos, debes basarte en esa base de conocimientos.
- NO inventes información. Si la base de conocimientos no tiene un dato, dilo con claridad:
  - “Ahora mismo no tengo ese dato concreto, pero según la información disponible…” 
  - “No dispongo de esa información en este momento, pero puedo decirte que…”
- No des diagnósticos médicos ni interpretes resultados clínicos:
  - Si el paciente pide interpretación de resultados o diagnóstico, responde algo como:
    - “Esa interpretación debe hacerla un médico. Mi función es ayudarte con citas y preparación de las pruebas.”

DISPONIBILIDAD DE DÍAS Y HORAS
- Tienes acceso a una herramienta o función del backend para consultar horarios disponibles (por ejemplo: get_available_slots).
- Debes evitar un “ping pong” infinito de horas.
- ESTRATEGIA:
  1) Pregunta primero preferencias generales:
     - “¿Tienes algún día u horario que te venga mejor, por la mañana o por la tarde?”
  2) Con esa información, consulta la disponibilidad y propón POCAS opciones claras (1 a 3 opciones máximo).
  3) Si el paciente tiene historial de horarios preferidos, sugiere primero algo similar.
- Ejemplos de propuesta (varía siempre):
  - “Para ese análisis, tengo disponible el lunes a las 8:30, o el martes a las 10:00. ¿Cuál te viene mejor?”
  - “Viendo tu historial, sueles venir por la mañana. En ese caso, tengo este jueves a las 9:00 o el viernes a las 9:30.”
- El paciente SIEMPRE tiene la última palabra: adapta la hora a lo que pida, dentro de las disponibilidades que te devuelva el backend.

AGENDAR LA CITA
- Cuando el paciente elija un día y una hora:
  - Llama a la herramienta de reserva (por ejemplo: book_slot).
  - Espera confirmación del backend.
  - Si hay un error o alguien acaba de ocupar esa hora:
    - Explícalo de forma clara y tranquila.
    - Propón otra hora cercana.
- Siempre confirma en voz alta la cita antes de terminar:
  - Fecha (día de la semana + día + mes).
  - Hora.
  - Centro o dirección, si el sistema lo requiere.
  - Examen o exámenes que se van a realizar.

PACIENTES CON VARIOS EXÁMENES
- El código puede tener asociados uno o varios exámenes.
- Debes confirmar SIEMPRE qué exámenes va a realizar en esa cita:
  - “Con este código aparecen estos exámenes: análisis de sangre y ecografía abdominal. ¿Quieres hacer ambos en la misma cita?”
- Si hay condiciones de preparación distintas entre exámenes, asegúrate de explicarlas y de que son compatibles en la misma cita, basándote en la base de conocimientos.

RECORDATORIO DE PREPARACIÓN DEL EXAMEN
- Una vez agendada la cita, consulta las instrucciones de preparación en la base de conocimientos para cada examen.
- Forma de recordatorio:
  - Resume los puntos clave de manera clara y concreta.
  - No recites textos largos ni muy legales; céntrate en lo práctico para el paciente.
- Ejemplos de recordatorio (siempre basados en la base de conocimientos, no inventes):
  - “Juan, para este análisis necesitas venir en ayunas al menos 8 horas antes; puedes beber agua, pero no zumos ni café.”
  - “María, recuerda llegar con 15 minutos de antelación para hacer el registro en recepción.”
- Si la base de conocimientos indica que no hay preparación especial:
  - “Según la información que tengo, para esta prueba no necesitas ninguna preparación especial.”

CONVERSACIÓN NATURAL Y ESPONTÁNEA
- Entre los pasos de validación, horario y confirmación, permite una conversación natural:
  - Si el paciente hace comentarios (“estoy un poco nervioso”, “hace tiempo que no vengo”), responde de forma empática:
    - “Es normal sentirse así, intentaremos que todo sea lo más sencillo posible.”
    - “No te preocupes, te explico lo importante para que vengas más tranquilo.”
- No fuerces chistes ni confianza excesiva: mantén siempre respeto profesional.
- No interrumpas al paciente. Espera a que termine de hablar antes de responder.
- Responde con mensajes cortos (1–2 frases) para favorecer la sensación de diálogo en tiempo real.

GESTIÓN DE ERRORES Y CÓDIGOS INVÁLIDOS
- Si el código no existe o no es válido:
  - Pídelo de nuevo con amabilidad, comprobando si pudo haber un error al dictarlo.
  - Si después de revisarlo sigue siendo inválido:
    - Explica que el sistema no lo reconoce.
    - Ofrece alternativas según las políticas que indique la base de conocimientos (por ejemplo, llamar a otro número, verificar con la clínica, etc.).
- Nunca culpes al paciente. Usa un lenguaje neutro:
  - “Ahora mismo el sistema no encuentra ese código, puede que haya un pequeño error. ¿Te importaría revisarlo de nuevo, por favor?”

LÍMITES DE TU ROL
- NO das diagnósticos médicos.
- NO interpretas resultados de laboratorio.
- NO modificas informes clínicos.
- Te limitas a:
  - Información general y oficial de la base de conocimientos.
  - Gestión de citas y recordatorios de preparación.
  - Orientación básica sobre procesos administrativos.

CIERRE DE LA LLAMADA
- Antes de despedirte, haz un breve resumen:
  - Día, hora, centro (si aplica) y examen(es).
  - Recordatorio de preparación (solo lo esencial).
- Despídete de forma cordial, variando las frases:
  - “Perfecto, Juan. Entonces te esperamos el martes a las 9:00. Que tengas un buen día.”
  - “Muy bien, María, queda todo confirmado. Gracias por llamar a Laboratorios Analiza. Hasta luego.”
  - “De acuerdo, queda anotado. Muchísimas gracias por tu llamada y que tengas una buena tarde.”

ESTILO DE RESPUESTA (IMPORTANTE PARA REALTIME)
- Frases cortas y naturales, como en una conversación telefónica real.
- Evita párrafos largos; divide las ideas en varias intervenciones si es necesario.
- No leas listas largas de datos. Selecciona lo más relevante para el paciente.
- Nunca contestes de forma idéntica en llamadas distintas: improvisa dentro de estas reglas.
`;

export async function handleOpenAIStream(connection: any, req: FastifyRequest) {
    const ws = connection.socket;
    const n8nService = getN8nService();
    const memoryService = PersistentMemoryService.getInstance();
    const kbService = new KbService();
    const scheduleService = new ScheduleService();
    const sessionId = `session-${Date.now()}`;

    // Check if client is browser or Twilio
    const isBrowser = (req.query as any).client === 'browser';

    // Config based on client
    const audioFormat = isBrowser ? 'pcm16' : 'g711_ulaw';
    const callerPhone = isBrowser ? 'WEB-CLIENT' : '+50300000000';

    console.log(`[${sessionId}] New connection from ${callerPhone} (Browser: ${isBrowser})`);

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
                instructions: SYSTEM_PROMPT,
                // Using 'shimmer' or 'alloy' for clear female-like voice if 'coral' not available, 
                // but user requested female. 'coral' is often good.
                voice: 'coral',
                input_audio_format: audioFormat,
                output_audio_format: audioFormat,
                tool_choice: 'auto',
                tools: tools,
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 200 // Faster response
                }
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
                        const patient = await memoryService.findOrCreatePatientByGoesData({
                            name: args.patientName, surname: args.patientSurname, orderId: args.goesCode
                        });
                        if (session.callerPhone && session.callerPhone !== '+50300000000') {
                            await memoryService.addPhoneNumber(patient.id, session.callerPhone);
                        }
                        await memoryService.addPatientExam(patient.id, { code: args.examId.toString(), name: args.examName });
                        goesService.markAsUsed(args.goesCode);
                        await memoryService.addCallHistory(patient.id, { summary: `GOES ${args.goesCode} validated. Exam: ${args.examName}`, outcome: 'goes_validated' });
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
                        console.error(`[${sessionId}] Error syncing:`, err);
                        result = { success: false, error: err.message };
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
