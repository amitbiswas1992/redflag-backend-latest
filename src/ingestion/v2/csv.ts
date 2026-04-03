import { parse } from 'csv-parse/sync';

export type ParsedCsvRow = Record<string, string | null>;

function normalizeHeader(header: string): string {
    return header
        .trim()
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

export function parseCsvRows(csvData: string): ParsedCsvRow[] {
    const parsed = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
    }) as Record<string, unknown>[];

    return parsed.map((row) => {
        const normalized: ParsedCsvRow = {};

        for (const [key, value] of Object.entries(row)) {
            const header = normalizeHeader(key);
            if (!header) {
                continue;
            }

            if (value === undefined || value === null) {
                normalized[header] = null;
            } else {
                normalized[header] = String(value).trim();
            }
        }

        return normalized;
    });
}
