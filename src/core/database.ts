import dexie, { Table } from 'dexie';
import type { Ctor } from './registry';
import { getEntityMeta, sealRegistry } from './registry';
import { buildSchema, getVersion } from './schema';

export class Database extends dexie {
    private initialized = false;

    constructor(name?: string) {
        super(name ?? 'default');
        this.init();
    }

    async init(): Promise<void> {
        if (this.initialized) return;

        const schema = buildSchema();
        const version = getVersion(this.name, schema);
        this.version(version).stores(schema);
        // Prevent further registry mutations at runtime post open
        sealRegistry();

        await this.open();
        this.initialized = true;
    }

    tableFor<T>(entity: Ctor<T>): Table<T> {
        const meta = getEntityMeta(entity);
        const tableName = meta?.tableName;
        if (!tableName) throw new Error(`Entity not registered: ${entity.name}`);
        return this.table(tableName) as Table<T>;
    }
}
