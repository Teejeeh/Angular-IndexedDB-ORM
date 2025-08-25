export type Scalar = string | number | boolean | Date | null | undefined;

export interface FieldFilter<V> {
    equals?: V;
    in?: V[];
    notIn?: V[];
    contains?: V extends string ? string : never;
    startsWith?: V extends string ? string : never;
    endsWith?: V extends string ? string : never;
    gt?: V extends Scalar ? V : never;
    gte?: V extends Scalar ? V : never;
    lt?: V extends Scalar ? V : never;
    lte?: V extends Scalar ? V : never;
    not?: V | FieldFilter<V>;
}

export type WhereCondition<T> = {
    AND?: WhereFilter<T> | WhereFilter<T>[];
    OR?: WhereFilter<T>[];
    NOT?: WhereFilter<T> | WhereFilter<T>[];
} & WhereFilter<T>;

export type WhereFilter<T> = Partial<{ [K in keyof T]: T[K] | FieldFilter<T[K]> }>;

export type OrderBy<T> = Partial<{ [K in keyof T]: 'asc' | 'desc' }>;

export abstract class PrismaInterface<T> {
    // ----- Public API (Prisma-like subset) ----- //
    public abstract findUnique(args: { where: WhereCondition<T> }): Promise<T | null>;

    public abstract findFirst(args: {
        where?: WhereCondition<T>;
        orderBy?: OrderBy<T> | OrderBy<T>[];
    }): Promise<T | null>;

    public abstract findMany(args: {
        where?: WhereCondition<T>;
        orderBy?: OrderBy<T> | OrderBy<T>[];
        skip?: number;
        take?: number;
    }): Promise<T[]>;

    public abstract create(args: { data: T }): Promise<T>;

    public abstract createMany(args: { data: T[] }): Promise<{ count: number }>;

    public abstract update(args: { where: WhereCondition<T>; data: Partial<T> }): Promise<T>;

    public abstract updateMany(args: { where?: WhereCondition<T>; data: Partial<T>[] }): Promise<{ count: number }>;

    public abstract upsert(args: { where: WhereCondition<T>; create: Partial<T>; update: Partial<T> }): Promise<T>;

    public abstract delete(args: { where: WhereCondition<T> }): Promise<T>;

    public abstract deleteMany(args: { where?: WhereCondition<T> }): Promise<{ count: number }>;

    public abstract count(args: { where?: WhereCondition<T> }): Promise<number>;
}
