import { SCHEDULE_SLOTS, Slot } from './schedule.data.js';
import { PersistentMemoryService } from '../memory/persistent.js';

export class ScheduleService {
    private slots: Slot[];
    private memoryService: PersistentMemoryService;

    constructor() {
        this.slots = [...SCHEDULE_SLOTS];
        this.memoryService = PersistentMemoryService.getInstance();
    }

    /**
     * Get all slots
     */
    getAllSlots(): Slot[] {
        return this.slots;
    }

    /**
     * Get slots for a specific day
     */
    getSlotsByDay(date: string): Slot[] {
        const targetDate = new Date(date);
        const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1);

        return this.slots.filter(slot => {
            const slotStart = new Date(slot.start);
            return slotStart >= dayStart && slotStart < dayEnd;
        });
    }

    /**
     * Get available slots for a branch and exam
     */
    getAvailableSlots(branchId: string, examCode?: string): Slot[] {
        return this.slots.filter(slot =>
            slot.branchId === branchId &&
            !slot.isBooked &&
            new Date(slot.start) > new Date() // Only future slots
        );
    }

    /**
     * Mark a slot as booked
     */
    markAsBooked(slotId: string): boolean {
        const slot = this.slots.find(s => s.slotId === slotId);
        if (!slot) return false;
        if (slot.isBooked) return false; // Already booked

        slot.isBooked = true;
        return true;
    }

    /**
     * Get patient's preferred hour based on history
     */
    async getPatientPreferredHour(patientId: string): Promise<number | null> {
        try {
            // Only look up existing patient, don't create fake ones
            const patient = await this.memoryService.findPatientById(patientId);

            if (!patient || !patient.history || patient.history.length === 0) {
                return null;
            }

            // Extract hours from appointment history using correct fields
            // History entries have: outcome (string) and date (Date)
            const hours = patient.history
                .filter((entry) =>
                    entry.outcome === 'appointment_created' && entry.date
                )
                .map((entry) => new Date(entry.date).getHours());

            if (hours.length === 0) return null;

            // Calculate average preferred hour
            const avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
            return avgHour;
        } catch (error) {
            console.error('Error getting patient preferred hour:', error);
            return null;
        }
    }

    /**
     * Suggest the best slot for a patient
     */
    async suggestBestSlot(patientId: string, examCode: string, branchId: string): Promise<Slot | null> {
        const availableSlots = this.getAvailableSlots(branchId, examCode);
        if (availableSlots.length === 0) return null;

        // Get patient's preferred hour
        const preferredHour = await this.getPatientPreferredHour(patientId);

        if (preferredHour !== null) {
            // Find slots closest to preferred hour
            const sortedByPreference = availableSlots.sort((a, b) => {
                const hourA = new Date(a.start).getHours();
                const hourB = new Date(b.start).getHours();
                const diffA = Math.abs(hourA - preferredHour);
                const diffB = Math.abs(hourB - preferredHour);
                return diffA - diffB;
            });

            return sortedByPreference[0];
        }

        // No preference, return earliest available
        return availableSlots.sort((a, b) =>
            new Date(a.start).getTime() - new Date(b.start).getTime()
        )[0];
    }

    /**
     * Get slots by date range
     */
    getSlotsByDateRange(startDate: string, endDate: string, branchId?: string): Slot[] {
        const start = new Date(startDate);
        const end = new Date(endDate);

        return this.slots.filter(slot => {
            const slotStart = new Date(slot.start);
            const matchesDate = slotStart >= start && slotStart <= end;
            const matchesBranch = !branchId || slot.branchId === branchId;
            return matchesDate && matchesBranch;
        });
    }

    /**
     * Get available slots count by date
     */
    getAvailableSlotsByDate(date: string, branchId?: string): number {
        const daySlots = this.getSlotsByDay(date);
        return daySlots.filter(slot =>
            !slot.isBooked &&
            (!branchId || slot.branchId === branchId)
        ).length;
    }
}
