import type { Difference } from 'microdiff';

/**
 * Applies a microdiff Difference[] patch to a target object, returning the patched result.
 * REMOVE entries on arrays are applied in descending index order to avoid index-shift bugs.
 */
export function applyPatch<T extends object>(target: T, diff: Difference[]): T {
    if (diff.length === 0) return target;
    const result = structuredClone(target) as Record<string, unknown>;

    const changes = diff.filter((d) => d.type !== 'REMOVE');
    const removes = diff
        .filter((d): d is Extract<Difference, { type: 'REMOVE' }> => d.type === 'REMOVE')
        .sort((a, b) => {
            const ai = a.path[a.path.length - 1];
            const bi = b.path[b.path.length - 1];
            return typeof ai === 'number' && typeof bi === 'number' ? bi - ai : 0;
        });

    for (const d of changes) {
        let node: unknown = result;
        for (let i = 0; i < d.path.length - 1; i++) {
            node = (node as Record<string, unknown>)[d.path[i]];
            if (node === undefined || node === null) break;
        }
        if (node === undefined || node === null) continue;
        const key = d.path[d.path.length - 1];
        (node as Record<string, unknown>)[key as string] = (d as { value: unknown }).value;
    }

    for (const d of removes) {
        let node: unknown = result;
        for (let i = 0; i < d.path.length - 1; i++) {
            node = (node as Record<string, unknown>)[d.path[i]];
            if (node === undefined || node === null) break;
        }
        if (node === undefined || node === null) continue;
        const key = d.path[d.path.length - 1];
        if (Array.isArray(node)) {
            (node as unknown[]).splice(key as number, 1);
        } else {
            delete (node as Record<string, unknown>)[key as string];
        }
    }

    return result as T;
}
