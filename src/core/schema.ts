import { EntityMeta, getAllEntities, resolveEntity } from './registry';

export function buildSchema(): Record<string, string> {
    const schema: Record<string, string> = {};
    const entities = getAllEntities()
        .slice()
        .sort((a, b) => a.tableName.localeCompare(b.tableName));
    for (const meta of entities) {
        schema[meta.tableName] = buildTableSchema(meta);
    }
    return schema;
}

function buildTableSchema(meta: EntityMeta): string {
    const resolved = resolveEntity(meta);
    // Determine primary key
    const primary = resolved.columns.find((c) => c.options.primary);
    const primaryPart = primary
        ? primary.options.autoIncrement
            ? `++${primary.propertyKey}`
            : primary.propertyKey
        : '';

    // Other columns
    const otherCols = resolved.columns
        .filter((c) => !c.options.primary)
        .map((c) => c.propertyKey)
        .sort();

    const parts: string[] = [];
    if (primaryPart) parts.push(primaryPart);
    parts.push(...otherCols);
    return parts.join(', ');
}

export function computeSignature(obj: Record<string, string>): string {
    const entries = Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
}

export function loadStoredVersion(dbName: string): { version: number; signature: string } {
    if (typeof window === 'undefined') return { version: 1, signature: '' };
    const raw = localStorage.getItem(versionKey(dbName));
    if (!raw) return { version: 1, signature: '' };
    try {
        return JSON.parse(raw);
    } catch {
        return { version: 1, signature: '' };
    }
}

export function storeVersion(dbName: string, version: number, signature: string) {
    if (typeof window === 'undefined') return version;
    localStorage.setItem(versionKey(dbName), JSON.stringify({ version, signature }));
    return version;
}

export function getVersion(dbName: string, schema: Record<string, string>) {
    const signature = computeSignature(schema);
    let { version, signature: storedSig } = loadStoredVersion(dbName);
    if (signature === storedSig) return version;
    return storeVersion(dbName, version + 1, signature);
}

function versionKey(dbName: string): string {
    return `__dexie_dynamic_version__::${dbName}`;
}
