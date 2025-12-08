import { goesCodes, GOESCode } from './goes.data.js';

/**
 * GOES Service
 * 
 * Handles validation of GOES codes from Ministry of Health
 * Codes are single-use only
 */
export class GOESService {
    /**
     * Validates a GOES code
     * Does NOT mark as used - that happens in sync-patient
     */
    validateCode(code: string): { valid: boolean; data?: GOESCode } {
        const goesEntry = goesCodes.find(g => g.goesCode === code);

        if (!goesEntry) {
            return { valid: false };
        }

        if (goesEntry.used) {
            return { valid: false };
        }

        // Check expiry
        const now = new Date();
        const expiry = new Date(goesEntry.expiryDate);
        if (now > expiry) {
            return { valid: false };
        }

        return {
            valid: true,
            data: goesEntry
        };
    }

    /**
     * Marks a GOES code as used
     * Called only from sync-patient endpoint
     */
    markAsUsed(code: string): boolean {
        const goesEntry = goesCodes.find(g => g.goesCode === code);

        if (!goesEntry) {
            return false;
        }

        if (goesEntry.used) {
            return false;
        }

        goesEntry.used = true;
        return true;
    }

    /**
     * Get code info (for debugging)
     */
    getCodeInfo(code: string): GOESCode | null {
        return goesCodes.find(g => g.goesCode === code) || null;
    }
}
