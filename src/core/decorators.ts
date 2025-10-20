import { addColumn, addEntity, ColumnOptions, Ctor } from './registry';

// Entity decorator for classes
function entity(name?: string) {
  return function <T extends Ctor>(target: T): T {
    addEntity(target, name);
    return target;
  };
}

// Property decorator for columns
function column(options: ColumnOptions = {}) {
  return function (target: any, propertyKey: string | symbol): void {
    addColumn(target, propertyKey, options);
  };
}

// Property decorator for primary columns
function primaryColumn(options: Omit<ColumnOptions, 'primary'> = {}) {
  return function (target: any, propertyKey: string | symbol): void {
    addColumn(target, propertyKey, { ...options, primary: true });
  };
}

// Property decorator for indexed columns
function indexedColumn(options: Omit<ColumnOptions, 'index'> = {}) {
  return function (target: any, propertyKey: string | symbol): void {
    addColumn(target, propertyKey, { ...options, index: true });
  };
}

export {
  column as Column,
  entity as Entity,
  primaryColumn as PrimaryColumn,
  indexedColumn as IndexedColumn,
};
