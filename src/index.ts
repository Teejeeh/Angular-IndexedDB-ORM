import {
  inject,
  Inject,
  Injectable,
  InjectionToken,
  ModuleWithProviders,
  NgModule,
  Optional,
  Provider,
} from '@angular/core';
import { PrismaService } from './clients/prisma.service';
import { Database } from './core';

export const INDEXED_DB_NAME = new InjectionToken<string>('INDEXED_DB_NAME');

@Injectable()
export class IndexedDB extends Database {
  constructor(@Optional() @Inject(INDEXED_DB_NAME) name: string | null) {
    super(name ?? 'default');
  }
}

@NgModule()
export class IndexedDBModule {
  static provide = (name: string): Provider => ({
    provide: IndexedDB,
    useFactory: () => new IndexedDB(name),
  });

  static forRoot(name: string): ModuleWithProviders<IndexedDBModule> {
    return {
      ngModule: IndexedDBModule,
      providers: [IndexedDBModule.provide(name)],
    };
  }
}

export const usePrismaClient = <T extends {}>(
  ctor: new (...args: unknown[]) => T
): PrismaService<T> => {
  const table = inject(IndexedDB).tableFor(ctor);
  return new PrismaService<T>(table);
};

export * from './core/decorators';
