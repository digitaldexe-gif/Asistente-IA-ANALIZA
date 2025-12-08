// Auto-generated schedule slots for December 2025 and January 2026
// Horario: 07:00–16:00, intervalos de 5 minutos

export interface Slot {
    slotId: string;
    start: string;
    end: string;
    isBooked: boolean;
    branchId: string;
}

const BRANCH_IDS = [
    'SS-001', 'ESC-001', 'SA-001', 'SM-001', 'ST-001',
    'MEJ-001', 'AH-001', 'AC-001', 'APO-001', 'SOY-001'
];

function generateSlots(): Slot[] {
    const slots: Slot[] = [];
    let slotCounter = 1;

    // December 2025 and January 2026
    const months = [
        { year: 2025, month: 12, days: 31 },
        { year: 2026, month: 1, days: 31 }
    ];

    for (const { year, month, days } of months) {
        for (let day = 1; day <= days; day++) {
            // Skip Sundays (day 0)
            const date = new Date(year, month - 1, day);
            if (date.getDay() === 0) continue;

            // Generate slots from 07:00 to 16:00 (last slot starts at 15:55)
            for (let hour = 7; hour < 16; hour++) {
                for (let minute = 0; minute < 60; minute += 5) {
                    const startDate = new Date(year, month - 1, day, hour, minute, 0);
                    const endDate = new Date(year, month - 1, day, hour, minute + 5, 0);

                    // Random booking status (30-60% booked)
                    const bookingRate = 0.3 + Math.random() * 0.3; // 30-60%
                    const isBooked = Math.random() < bookingRate;

                    // Random branch
                    const branchId = BRANCH_IDS[Math.floor(Math.random() * BRANCH_IDS.length)];

                    slots.push({
                        slotId: `SLOT-${String(slotCounter).padStart(6, '0')}`,
                        start: startDate.toISOString(),
                        end: endDate.toISOString(),
                        isBooked,
                        branchId
                    });

                    slotCounter++;
                }
            }
        }
    }

    return slots;
}

export const SCHEDULE_SLOTS = generateSlots();

console.log(`Generated ${SCHEDULE_SLOTS.length} slots for Dec 2025 - Jan 2026`);
