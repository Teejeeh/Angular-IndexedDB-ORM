import { addColumn, addEntity, ColumnOptions, Ctor } from './registry';

function entity(name?: string) {
    return <T extends Ctor>(target: T) => addEntity(target, name);
}

function column(options: ColumnOptions = {}) {
    return (target: unknown, propertyKey: string | symbol) => addColumn(target, propertyKey, options);
}

function primaryColumn(options: Omit<ColumnOptions, 'primary'> = {}) {
    return column({ ...options, primary: true });
}

export { column as Column, entity as Entity, primaryColumn as PrimaryColumn };
