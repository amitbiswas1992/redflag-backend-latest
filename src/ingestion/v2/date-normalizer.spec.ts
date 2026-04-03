import { normalizeDateValue } from './date-normalizer';
import { DateColumnRule } from './schemas';

describe('normalizeDateValue', () => {
    const dateRule: DateColumnRule = {
        acceptedFormats: ['YYYY_MM_DD'],
        outputType: 'date',
        timezone: 'UTC',
        nullable: false,
    };

    it('normalizes YYYY-MM-DD date', () => {
        const result = normalizeDateValue('2026-04-03', dateRule);
        expect(result).toEqual({ success: true, normalized: '2026-04-03' });
    });

    it('rejects ambiguous slash formats when both variants are allowed', () => {
        const result = normalizeDateValue('03/04/2026', {
            acceptedFormats: ['MM_DD_YYYY', 'DD_MM_YYYY'],
            outputType: 'date',
            timezone: 'UTC',
            nullable: false,
        });

        expect(result.success).toBe(false);
        if (result.success) {
            return;
        }

        expect(result.code).toBe('AMBIGUOUS_DATE_FORMAT');
    });

    it('parses excel serial dates when enabled', () => {
        const result = normalizeDateValue('45292', {
            acceptedFormats: ['EXCEL_SERIAL'],
            outputType: 'date',
            timezone: 'UTC',
            nullable: false,
        });

        expect(result.success).toBe(true);
        if (!result.success) {
            return;
        }

        expect(result.normalized).toBe('2024-01-01');
    });

    it('rejects empty required values', () => {
        const result = normalizeDateValue('', dateRule);

        expect(result.success).toBe(false);
        if (result.success) {
            return;
        }

        expect(result.code).toBe('MISSING_REQUIRED_DATE');
    });
});
