import { FastifyRequest, FastifyReply } from 'fastify';
import { ScheduleService } from '../services/schedule/schedule.service.js';
import { PersistentMemoryService } from '../services/memory/persistent.js';

const scheduleService = new ScheduleService();
const memoryService = PersistentMemoryService.getInstance();

export async function getAvailableSlotsHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const { branchId, examCode, date, startDate, endDate } = req.query as any;

        if (!branchId) {
            return reply.code(400).send({ success: false, error: 'Missing required parameter: branchId' });
        }

        let slots;
        if (date) {
            slots = scheduleService.getSlotsByDay(date);
        } else if (startDate && endDate) {
            slots = scheduleService.getSlotsByDateRange(startDate, endDate, branchId);
        } else {
            slots = scheduleService.getAvailableSlots(branchId, examCode);
        }

        const filteredSlots = slots
            .filter((s: any) => s.branchId === branchId && !s.isBooked)
            .slice(0, 50);

        return reply.code(200).send({
            success: true,
            data: filteredSlots,
            count: filteredSlots.length
        });
    } catch (error: any) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}

export async function bookAppointmentHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const { patientId, slotId, examCode } = req.body as any;

        if (!patientId || !slotId) {
            return reply.code(400).send({ success: false, error: 'Missing patientId or slotId' });
        }

        const success = scheduleService.markAsBooked(slotId);
        if (!success) {
            return reply.code(409).send({ success: false, error: 'Slot not available or already booked' });
        }

        await memoryService.addCallHistory(patientId, {
            summary: `Appointment booked manually: ${examCode} at slot ${slotId}`,
            outcome: 'appointment_created'
        });

        return reply.code(201).send({
            success: true,
            message: 'Appointment booked successfully',
            data: { slotId, patientId, examCode, status: 'booked' }
        });
    } catch (error: any) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}

export async function rescheduleAppointmentHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const { appointmentId, newSlotId } = req.body as any;
        // Mock implementation for Bolt.new demo
        // In real world: free old slot, book new slot
        return reply.code(200).send({
            success: true,
            message: 'Reschedule simulated',
            data: { appointmentId, newSlotId, status: 'rescheduled' }
        });
    } catch (error: any) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}

export async function cancelAppointmentHandler(req: FastifyRequest, reply: FastifyReply) {
    try {
        const { appointmentId } = req.body as any;
        // Mock implementation
        return reply.code(200).send({
            success: true,
            message: 'Cancellation simulated',
            data: { appointmentId, status: 'cancelled' }
        });
    } catch (error: any) {
        return reply.code(500).send({ success: false, error: error.message });
    }
}

// Backward compatibility or generic router if needed
export async function appointmentsHandler(req: FastifyRequest, reply: FastifyReply) {
    // Redirect to specific handlers based on body action or just legacy support
    // For now, we return specific error to encourage using new endpoints
    return reply.code(300).send({ success: false, error: 'Use specific endpoints: /api/appointments/available, /book, etc.' });
}
