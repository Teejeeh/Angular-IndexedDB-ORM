export type Ctor<T = unknown> = new (...args: any[]) => T;

export interface ColumnOptions {
    primary?: boolean; // Marks primary key
    autoIncrement?: boolean; // Only valid on primary
}

export interface ColumnMeta {
    propertyKey: string;
    options: ColumnOptions;
}

export interface EntityMeta {
    target: Ctor;
    tableName: string;
    columns: ColumnMeta[];
}

// Internal global in-memory registry of entities.
let byCtor: WeakMap<Ctor, EntityMeta> = new WeakMap();
const byTable: Map<string, EntityMeta> = new Map();
let sealed = false;

function assertNotSealed(action: string) {
    if (sealed) throw new Error(`Registry is sealed; cannot ${action} after database initialization.`);
}

export function ensureEntityMeta(target: Ctor, name?: string): EntityMeta {
    let meta = byCtor.get(target);
    if (!meta) {
        const tableName = name ?? target.name;
        if (!tableName) throw new Error('Table name cannot be empty');
        const existing = byTable.get(tableName);
        if (existing && existing.target !== target) {
            throw new Error(
                `Duplicate table name detected: "${tableName}" is already registered for a different entity.`,
            );
        }
        meta = { target, tableName, columns: [] };
        byCtor.set(target, meta);
        byTable.set(tableName, meta);
    } else if (name && meta.tableName !== name) {
        // Allow a one-time rename from the default constructor name to the explicit @Entity name.
        // This happens because property decorators run before the class decorator.
        const oldName = meta.tableName;
        const isDefaultOld = oldName === target.name;
        const conflict = byTable.get(name);
        if (conflict && conflict.target !== target) {
            throw new Error(`Duplicate table name detected: "${name}" is already registered for a different entity.`);
        }
        if (isDefaultOld) {
            const mapped = byTable.get(oldName);
            if (mapped === meta) byTable.delete(oldName);
            meta.tableName = name;
            byTable.set(name, meta);
        } else {
            // Prevent accidental renames at runtime causing schema drift
            throw new Error(
                `Entity already registered with table name "${meta.tableName}"; refusing to rename to "${name}".`,
            );
        }
    }
    return meta;
}

export function addEntity(target: Ctor, name?: string) {
    assertNotSealed('register entities');
    ensureEntityMeta(target, name);
}

export function addColumn(target: unknown, propertyKey: string | symbol, options: ColumnOptions = {}) {
    assertNotSealed('add columns');
    const ctor = (target as { constructor?: Ctor })?.constructor;
    if (!ctor) {
        throw new Error(
            `@Column used on an invalid target: missing constructor for property "${String(propertyKey)}".`,
        );
    }
    const meta = ensureEntityMeta(ctor);
    const key = String(propertyKey);
    const existingPrimary = meta.columns.find((c) => c.options.primary && c.propertyKey !== key);
    if (options.autoIncrement && !options.primary) {
        throw new Error(`autoIncrement requires primary: true (table: ${meta.tableName}, column: ${key})`);
    }
    if (options.primary && existingPrimary) {
        throw new Error(
            `Multiple primary columns not supported (table: ${meta.tableName}, columns: ${existingPrimary.propertyKey}, ${key})`,
        );
    }
    const idx = meta.columns.findIndex((c) => c.propertyKey === key);
    const col: ColumnMeta = {
        propertyKey: key,
        options: { ...(idx >= 0 ? meta.columns[idx].options : {}), ...options },
    };
    if (idx >= 0) meta.columns[idx] = col;
    else meta.columns.push(col);
}

export function getEntityMeta(target: Ctor): EntityMeta | undefined {
    return byCtor.get(target);
}

export function getEntityMetaByTable(tableName: string): EntityMeta | undefined {
    return byTable.get(tableName);
}

export function getAllEntities(): EntityMeta[] {
    return Array.from(byTable.values());
}

export function resetRegistry(): void {
    byTable.clear();
    byCtor = new WeakMap<Ctor, EntityMeta>();
    sealed = false;
}

export function sealRegistry(): void {
    sealed = true;
}

export function isRegistrySealed(): boolean {
    return sealed;
}

// Inheritance-aware metadata resolution
export function resolveEntity(meta: EntityMeta): { columns: ColumnMeta[] } {
    const chain: Ctor[] = [];
    let cursor: unknown = meta.target as Ctor;
    while (cursor && typeof cursor === 'function' && cursor !== Object && cursor !== Function) {
        const ctor = cursor as Ctor;
        chain.unshift(ctor);
        const proto = ctor.prototype ? Object.getPrototypeOf(ctor.prototype) : null;
        if (!proto?.constructor) break;
        cursor = proto.constructor as unknown;
        if (!cursor || cursor === Object) break;
    }
    const columnsMap = new Map<string, ColumnMeta>();

    for (const ctor of chain) {
        const m = byCtor.get(ctor);
        if (!m) continue;
        for (const c of m.columns) {
            const cloned: ColumnMeta = { propertyKey: c.propertyKey, options: { ...c.options } };
            columnsMap.set(cloned.propertyKey, cloned);
        }
    }

    // Validate only one primary across chain
    const primaries = Array.from(columnsMap.values()).filter((c) => !!c.options.primary);
    const distinctPrimaryKeys = new Set(primaries.map((p) => p.propertyKey));
    if (distinctPrimaryKeys.size > 1) {
        throw new Error(
            `Multiple primary columns across inheritance for table "${meta.tableName}": ${[...distinctPrimaryKeys].join(
                ', ',
            )}`,
        );
    }

    return {
        columns: Array.from(columnsMap.values()),
    };
}
