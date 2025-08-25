import dexie, { IndexableType } from 'dexie';
import { OrderBy, PrismaInterface, WhereCondition } from './prisma.interface';

type LogicalKeys = 'AND' | 'OR' | 'NOT';

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getPrimaryKeyPath<T>(table: dexie.Table<T>): string | string[] | null {
  return table.schema?.primKey?.keyPath ?? null;
}

function hasOnlyKeys(obj: Record<string, unknown>, keys: string[]): boolean {
  const objKeys = Object.keys(obj);
  if (objKeys.length !== keys.length) return false;
  return keys.every((k) => objKeys.includes(k));
}

function valueForComparison(v: unknown): unknown {
  if (v instanceof Date) return v.getTime();
  return v;
}

function compareUnknown(a: unknown, b: unknown, dir: 'asc' | 'desc'): number {
  const direction = dir === 'desc' ? -1 : 1;
  if (a === b) return 0;
  if (a === undefined) return -1 * direction;
  if (b === undefined) return 1 * direction;
  if (a === null) return -1 * direction;
  if (b === null) return 1 * direction;
  const av = valueForComparison(a) as unknown as number | string | boolean;
  const bv = valueForComparison(b) as unknown as number | string | boolean;
  // Fallback compare for primitives
  if (av > (bv as unknown as typeof av)) return 1 * direction;
  if (av < (bv as unknown as typeof av)) return -1 * direction;
  return 0;
}

function normalizeOrderBy<T>(orderBy?: OrderBy<T> | OrderBy<T>[]) {
  const result: { key: keyof T; dir: 'asc' | 'desc' }[] = [];
  if (!orderBy) return result;
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  for (const ob of list) {
    const entries = Object.entries(ob as Record<string, 'asc' | 'desc' | undefined>);
    for (const [k, dir] of entries) {
      if (!dir) continue;
      result.push({ key: k as keyof T, dir });
    }
  }
  return result;
}

function toComparator<T>(orderBy?: OrderBy<T> | OrderBy<T>[]) {
  const parts = normalizeOrderBy(orderBy);
  if (!parts.length) return undefined as undefined | ((a: T, b: T) => number);
  return (a: T, b: T) => {
    for (const p of parts) {
      const av = (a as unknown as Record<string, unknown>)[p.key as unknown as string];
      const bv = (b as unknown as Record<string, unknown>)[p.key as unknown as string];
      const cmp = compareUnknown(av, bv, p.dir);
      if (cmp !== 0) return cmp;
    }
    return 0;
  };
}

function evalFieldFilter(value: unknown, condition: unknown): boolean {
  if (!isObject(condition)) {
    return value === condition;
  }
  for (const [opKey, opVal] of Object.entries(condition)) {
    switch (opKey) {
      case 'equals':
        if (value !== opVal) return false;
        break;
      case 'in':
        if (!Array.isArray(opVal) || !opVal.includes(value as never)) return false;
        break;
      case 'notIn':
        if (Array.isArray(opVal) && opVal.includes(value as never)) return false;
        break;
      case 'gt': {
        const av = valueForComparison(value);
        const bv = valueForComparison(opVal);
        if (!((av as number | string) > (bv as number | string))) return false;
        break;
      }
      case 'gte': {
        const av = valueForComparison(value);
        const bv = valueForComparison(opVal);
        if (!((av as number | string) >= (bv as number | string))) return false;
        break;
      }
      case 'lt': {
        const av = valueForComparison(value);
        const bv = valueForComparison(opVal);
        if (!((av as number | string) < (bv as number | string))) return false;
        break;
      }
      case 'lte': {
        const av = valueForComparison(value);
        const bv = valueForComparison(opVal);
        if (!((av as number | string) <= (bv as number | string))) return false;
        break;
      }
      case 'contains':
        if (typeof value === 'string' && typeof opVal === 'string') {
          if (!value.includes(opVal)) return false;
        } else if (Array.isArray(value)) {
          if (!value.includes(opVal)) return false;
        } else {
          return false;
        }
        break;
      case 'startsWith':
        if (typeof value !== 'string' || typeof opVal !== 'string' || !value.startsWith(opVal))
          return false;
        break;
      case 'endsWith':
        if (typeof value !== 'string' || typeof opVal !== 'string' || !value.endsWith(opVal))
          return false;
        break;
      case 'not':
        if (isObject(opVal)) {
          if (evalFieldFilter(value, opVal)) return false;
        } else {
          if (value === opVal) return false;
        }
        break;
      default:
        // Unknown operator, require strict equality if provided
        if (value !== opVal) return false;
    }
  }
  return true;
}

function buildPredicate<T>(where?: WhereCondition<T>): (item: T) => boolean {
  if (!where) return () => true;
  const logical: LogicalKeys[] = ['AND', 'OR', 'NOT'];
  const whereObj = where as Record<string, unknown>;
  const fieldKeys = Object.keys(whereObj).filter((k) => !logical.includes(k as LogicalKeys));

  return (item: T) => {
    // Field-level checks
    const itemRec = item as unknown as Record<string, unknown>;
    for (const k of fieldKeys) {
      const cond = whereObj[k];
      const val = itemRec[k];
      if (!evalFieldFilter(val, cond)) return false;
    }

    // Logical AND
    const andNode = whereObj['AND'] as unknown;
    if (Array.isArray(andNode)) {
      for (const sub of andNode) {
        if (!buildPredicate<T>(sub as WhereCondition<T>)(item)) return false;
      }
    } else if (andNode && isObject(andNode)) {
      if (!buildPredicate<T>(andNode as WhereCondition<T>)(item)) return false;
    }

    // Logical OR
    const orNode = whereObj['OR'] as unknown;
    if (Array.isArray(orNode) && orNode.length) {
      let ok = false;
      for (const sub of orNode) {
        if (buildPredicate<T>(sub as WhereCondition<T>)(item)) {
          ok = true;
          break;
        }
      }
      if (!ok) return false;
    }

    // Logical NOT
    const notNode = whereObj['NOT'] as unknown;
    if (Array.isArray(notNode)) {
      for (const sub of notNode) {
        if (buildPredicate<T>(sub as WhereCondition<T>)(item)) return false;
      }
    } else if (notNode && isObject(notNode)) {
      if (buildPredicate<T>(notNode as WhereCondition<T>)(item)) return false;
    }
    return true;
  };
}

function tryBuildKeyFromWhere<T>(
  table: dexie.Table<T>,
  where?: WhereCondition<T>
): IndexableType | undefined {
  if (!where) return undefined;
  const keyPath = getPrimaryKeyPath(table);
  if (!keyPath) return undefined;
  const logical: LogicalKeys[] = ['AND', 'OR', 'NOT'];
  const w = where as Record<string, unknown>;
  const keys = Object.keys(w).filter((k) => !logical.includes(k as LogicalKeys));
  if (typeof keyPath === 'string') {
    if (!hasOnlyKeys(Object.fromEntries(keys.map((k) => [k, true])), [keyPath])) return undefined;
    const raw = w[keyPath];
    if (raw === undefined) return undefined;
    if (isObject(raw)) {
      const eqVal = (raw as Record<string, unknown>)['equals'];
      return eqVal as IndexableType;
    }
    return raw as IndexableType;
  }
  // compound key
  const setKeys = Object.fromEntries(keys.map((k) => [k, true]));
  if (!hasOnlyKeys(setKeys, keyPath)) return undefined;
  const parts = keyPath.map((k) => {
    const raw = w[k];
    if (isObject(raw)) return (raw as Record<string, unknown>)['equals'];
    return raw;
  });
  return parts as unknown as IndexableType;
}

function getKeyFromEntity<T>(table: dexie.Table<T>, entity: T): IndexableType | undefined {
  const keyPath = getPrimaryKeyPath(table);
  if (!keyPath) return undefined;
  const rec = entity as unknown as Record<string, unknown>;
  if (typeof keyPath === 'string') return rec[keyPath] as IndexableType;
  return keyPath.map((k) => rec[k]) as unknown as IndexableType;
}

async function collectionForWhere<T>(table: dexie.Table<T>, where?: WhereCondition<T>) {
  if (!where) return table.toCollection();
  const pred = buildPredicate<T>(where);
  return table.toCollection().filter((item) => pred(item));
}

export class PrismaService<T extends {}> implements PrismaInterface<T> {
  constructor(private readonly table: dexie.Table<T, IndexableType>) {}

  public async findUnique(args: { where: WhereCondition<T> }): Promise<T | null> {
    const key = tryBuildKeyFromWhere(this.table, args.where);
    if (key !== undefined) {
      const got = await this.table.get(key);
      return (got as T | undefined) ?? null;
    }
    const col = await collectionForWhere(this.table, args.where);
    const first = await col.first();
    return (first as T | undefined) ?? null;
  }

  public async findFirst(args: {
    where?: WhereCondition<T>;
    orderBy?: OrderBy<T> | OrderBy<T>[];
  }): Promise<T | null> {
    const col = await collectionForWhere(this.table, args.where);
    const arr = (await col.toArray()) as T[];
    const cmp = toComparator<T>(args.orderBy);
    if (cmp) arr.sort(cmp);
    return arr.length ? arr[0] : null;
  }

  public async findMany(args: {
    where?: WhereCondition<T>;
    orderBy?: OrderBy<T> | OrderBy<T>[];
    skip?: number;
    take?: number;
  }): Promise<T[]> {
    const col = await collectionForWhere(this.table, args.where);
    const arr = (await col.toArray()) as T[];
    const cmp = toComparator<T>(args.orderBy);
    if (cmp) arr.sort(cmp);
    const start = args.skip ?? 0;
    const end = args.take != null ? start + args.take : undefined;
    return arr.slice(start, end);
  }

  public async create(args: { data: T }): Promise<T> {
    const key = await this.table.add(args.data);
    const created = await this.table.get(key);
    return (created as T | undefined) ?? args.data;
  }

  public async createMany(args: { data: T[] }): Promise<{ count: number }> {
    if (!args.data?.length) return { count: 0 };
    try {
      const keys = await this.table.bulkAdd(args.data, { allKeys: true });
      return { count: keys.length };
    } catch {
      // Fallback insert one-by-one
      let count = 0;
      for (const item of args.data) {
        try {
          await this.table.add(item);
          count++;
        } catch {
          // ignore duplicates/constraint errors
        }
      }
      return { count };
    }
  }

  public async update(args: { where: WhereCondition<T>; data: Partial<T> }): Promise<T> {
    const key = tryBuildKeyFromWhere(this.table, args.where);
    if (key !== undefined) {
      await this.table.update(key, args.data as T);
      const updated = await this.table.get(key);
      if (updated) return updated as T;
      throw new Error('Record to update not found.');
    }
    const existing = await this.findFirst({ where: args.where });
    if (!existing) throw new Error('Record to update not found.');
    const exKey = getKeyFromEntity(this.table, existing);
    if (exKey === undefined) throw new Error('Unable to resolve primary key for update.');
    await this.table.update(exKey, args.data as T);
    const updated = await this.table.get(exKey);
    return (
      (updated as T | undefined) ??
      ({
        ...(existing as unknown as Record<string, unknown>),
        ...(args.data as unknown as Record<string, unknown>),
      } as unknown as T)
    );
  }

  public async updateMany(args: {
    where?: WhereCondition<T>;
    data: Partial<T>[];
  }): Promise<{ count: number }> {
    const col = await collectionForWhere(this.table, args.where);
    const items = (await col.toArray()) as T[];
    if (!items.length) return { count: 0 };

    let modified = 0;
    if (args.data.length <= 1) {
      const patch = args.data[0] ?? ({} as Partial<T>);
      for (const item of items) {
        const key = getKeyFromEntity(this.table, item);
        if (key === undefined) continue;
        const n = await this.table.update(key, patch as T);
        if (n > 0) modified += n;
      }
      return { count: modified };
    }

    for (let i = 0; i < items.length; i++) {
      const patch = args.data[Math.min(i, args.data.length - 1)];
      const key = getKeyFromEntity(this.table, items[i]);
      if (key === undefined) continue;
      const n = await this.table.update(key, patch as T);
      if (n > 0) modified += n;
    }
    return { count: modified };
  }

  public async upsert(args: {
    where: WhereCondition<T>;
    create: Partial<T>;
    update: Partial<T>;
  }): Promise<T> {
    const existing = await this.findUnique({ where: args.where });
    if (existing) return this.update({ where: args.where, data: args.update });
    return this.create({ data: args.create as T });
  }

  public async delete(args: { where: WhereCondition<T> }): Promise<T> {
    const target = await this.findUnique({ where: args.where });
    if (!target) throw new Error('Record to delete not found.');
    const key =
      tryBuildKeyFromWhere(this.table, args.where) ?? getKeyFromEntity(this.table, target);
    if (key === undefined) throw new Error('Unable to resolve primary key for delete.');
    await this.table.delete(key);
    return target as T;
  }

  public async deleteMany(args: { where?: WhereCondition<T> }): Promise<{ count: number }> {
    const col = await collectionForWhere(this.table, args.where);
    const items = (await col.toArray()) as T[];
    if (!items.length) return { count: 0 };
    const keys: IndexableType[] = [];
    for (const it of items) {
      const k = getKeyFromEntity(this.table, it);
      if (k !== undefined) keys.push(k);
    }
    await this.table.bulkDelete(keys);
    return { count: keys.length };
  }

  public async count(args: { where?: WhereCondition<T> }): Promise<number> {
    if (!args.where) return this.table.count();
    const col = await collectionForWhere(this.table, args.where);
    return col.count();
  }
}
