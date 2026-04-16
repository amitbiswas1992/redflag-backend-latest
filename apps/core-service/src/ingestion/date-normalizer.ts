import { DateColumnRule } from './schemas';

const MS_IN_DAY = 86400000;
const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const slashDateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const numericRegex = /^\d+(?:\.\d+)?$/;

export type DateNormalizeErrorCode =
    | 'MISSING_REQUIRED_DATE'
    | 'INVALID_DATE_FORMAT'
    | 'AMBIGUOUS_DATE_FORMAT'
    | 'OUT_OF_RANGE_DATE'
    | 'INVALID_TIMEZONE';

export type DateNormalizeResult =
    | { success: true; normalized: string }
    | { success: false; code: DateNormalizeErrorCode; message: string };

function parseIsoDateOnly(value: string): Date | null {
    if (!isoDateRegex.test(value)) {
        return null;
    }

    const [yearText, monthText, dayText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        return null;
    }

    return parsed;
}

function parseBySlashFormat(value: string, format: 'MM_DD_YYYY' | 'DD_MM_YYYY'): Date | null {
    const match = slashDateRegex.exec(value);
    if (!match) {
        return null;
    }

    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);

    const month = format === 'MM_DD_YYYY' ? first : second;
    const day = format === 'MM_DD_YYYY' ? second : first;

    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        return null;
    }

    return parsed;
}

function parseFromUnix(value: string, mode: 'UNIX_SECONDS' | 'UNIX_MILLISECONDS'): Date | null {
    if (!numericRegex.test(value)) {
        return null;
    }

    const asNum = Number(value);
    if (!Number.isFinite(asNum)) {
        return null;
    }

    const millis = mode === 'UNIX_SECONDS' ? asNum * 1000 : asNum;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseFromExcelSerial(value: string): Date | null {
    if (!numericRegex.test(value)) {
        return null;
    }

    const serial = Number(value);
    if (!Number.isFinite(serial)) {
        return null;
    }

    const parsed = new Date(EXCEL_EPOCH_UTC_MS + serial * MS_IN_DAY);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateTimezone(timezone: string): boolean {
    try {
        Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
        return true;
    } catch {
        return false;
    }
}

function formatDateOnly(parsed: Date): string {
    return parsed.toISOString().slice(0, 10);
}

function formatDateTime(parsed: Date): string {
    return parsed.toISOString();
}

export function normalizeDateValue(
    rawValue: string | null | undefined,
    rule: DateColumnRule,
): DateNormalizeResult {
    const value = rawValue?.trim();

    if (!value) {
        if (rule.nullable) {
            return { success: true, normalized: '' };
        }

        return {
            success: false,
            code: 'MISSING_REQUIRED_DATE',
            message: 'Date value is required by mapping contract',
        };
    }

    if (!validateTimezone(rule.timezone)) {
        return {
            success: false,
            code: 'INVALID_TIMEZONE',
            message: `Unsupported timezone: ${rule.timezone}`,
        };
    }

    const acceptsSlashMonthFirst = rule.acceptedFormats.includes('MM_DD_YYYY');
    const acceptsSlashDayFirst = rule.acceptedFormats.includes('DD_MM_YYYY');

    if (acceptsSlashMonthFirst && acceptsSlashDayFirst && slashDateRegex.test(value)) {
        const match = slashDateRegex.exec(value);
        const firstText = match?.[1] ?? '';
        const secondText = match?.[2] ?? '';
        const first = Number(firstText);
        const second = Number(secondText);

        if (first <= 12 && second <= 12) {
            return {
                success: false,
                code: 'AMBIGUOUS_DATE_FORMAT',
                message: `Ambiguous slash date value: ${value}`,
            };
        }
    }

    let parsed: Date | null = null;

    for (const acceptedFormat of rule.acceptedFormats) {
        if (acceptedFormat === 'ISO_8601') {
            parsed = value.includes('T') ? new Date(value) : null;
            if (parsed && Number.isNaN(parsed.getTime())) {
                parsed = null;
            }
        } else if (acceptedFormat === 'YYYY_MM_DD') {
            parsed = parseIsoDateOnly(value);
        } else if (acceptedFormat === 'MM_DD_YYYY' || acceptedFormat === 'DD_MM_YYYY') {
            parsed = parseBySlashFormat(value, acceptedFormat);
        } else if (acceptedFormat === 'UNIX_SECONDS' || acceptedFormat === 'UNIX_MILLISECONDS') {
            parsed = parseFromUnix(value, acceptedFormat);
        } else if (acceptedFormat === 'EXCEL_SERIAL') {
            parsed = parseFromExcelSerial(value);
        }

        if (parsed) {
            break;
        }
    }

    if (!parsed) {
        return {
            success: false,
            code: 'INVALID_DATE_FORMAT',
            message: `Unsupported date format: ${value}`,
        };
    }

    const year = parsed.getUTCFullYear();
    if (year < 1900 || year > 2100) {
        return {
            success: false,
            code: 'OUT_OF_RANGE_DATE',
            message: `Date out of accepted range: ${value}`,
        };
    }

    return {
        success: true,
        normalized: rule.outputType === 'date' ? formatDateOnly(parsed) : formatDateTime(parsed),
    };
}
