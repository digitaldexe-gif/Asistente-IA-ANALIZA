import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { ScheduleService } from '../services/schedule/schedule.service.js';

const prisma = new PrismaClient();
const scheduleService = new ScheduleService();

/**
 * POST /api/appointments
 * 
 * Actions: get_slots, book_appointment, cancel_appointment
 * 
 * Manages appointments and slots using Prisma + Local Schedule
 */
export async function appointmentsHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const params = { ...req.query as any, ...req.body as any };
        const {
            action,
            branchId,
            examCode,
            date,
            patientId,
            slotId,
            startDate,
            endDate
        } = params;

        // GET_SLOTS
        if (action === 'get_slots') {
            if (!branchId) {
                return reply.code(400).send({
                    success: false,
                    error: 'Missing required parameter: branchId'
                });
            }

            let slots;

            if (date) {
                // Get slots for specific day
                slots = scheduleService.getSlotsByDay(date);
            } else if (startDate && endDate) {
                // Get slots for date range
                slots = scheduleService.getSlotsByDateRange(startDate, endDate, branchId);
            } else {
                // Get all available slots for branch
                slots = scheduleService.getAvailableSlots(branchId, examCode);
            }

            // Filter by branch if not already done
            const filteredSlots = slots
                .filter((s: any) => s.branchId === branchId && !s.isBooked)
                .slice(0, 50); // Limit to 50 slots

            return reply.code(200).send({
                success: true,
                data: filteredSlots,
                count: filteredSlots.length
            });
        }

        // BOOK_APPOINTMENT
        if (action === 'book_appointment') {
            if (!patientId || !slotId || !examCode) {
                return reply.code(400).send({
                    success: false,
                    error: 'Missing required parameters: patientId, slotId, examCode'
                });
            }

            // Mark slot as booked
            const success = scheduleService.markAsBooked(slotId);

            if (!success) {
                return reply.code(400).send({
                    success: false,
                    error: 'Slot not available or already booked'
                });
            }

            // Record in call history
            await prisma.callHistory.create({
                data: {
                    patientId,
                    summary: `Appointment booked: ${examCode} at slot ${slotId}`,
                    outcome: 'appointment_created'
                }
            });

            return reply.code(201).send({
                success: true,
                message: 'Appointment booked successfully',
                data: {
                    slotId,
                    patientId,
                    examCode,
                    status: 'booked'
                }
            });
        }

        // SUGGEST_BEST_SLOT
        if (action === 'suggest_best_slot') {
            if (!patientId || !branchId || !examCode) {
                return reply.code(400).send({
                    success: false,
                    error: 'Missing required parameters: patientId, branchId, examCode'
                });
            }

            const bestSlot = await scheduleService.suggestBestSlot(patientId, examCode, branchId);

            if (!bestSlot) {
                return reply.code(404).send({
                    success: false,
                    error: 'No available slots found'
                });
            }

            return reply.code(200).send({
                success: true,
                data: bestSlot
            });
        }

        return reply.code(400).send({
            success: false,
            error: 'Invalid action. Supported: get_slots, book_appointment, suggest_best_slot'
        });

    } catch (error: any) {
        console.error('[appointments] Error:', error);
        return reply.code(500).send({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
