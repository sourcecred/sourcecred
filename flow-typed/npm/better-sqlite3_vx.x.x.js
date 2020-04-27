// flow-typed signature: eb0227169323c50fa1a5b34a9f938e98
// flow-typed version: <<STUB>>/better-sqlite3_v7.0.0/flow_v0.120.1

declare class bettersqlite3$Database {
  +memory: boolean;
  +readonly: boolean;
  +name: string;
  +open: boolean;
  +inTransaction: boolean;

  constructor(
    filename: string,
    options?: bettersqlite3$Database$ConstructorOptions
  ): void;
  prepare(source: string): bettersqlite3$Statement;
  transaction<R, A>(f: (...A) => R): (...A) => R;
  pragma(pragma: string, options?: bettersqlite3$Database$PragmaOptions): any;
  backup(
    destination: string,
    options?: bettersqlite3$Database$BackupOptions
  ): Promise<bettersqlite3$Database$BackupProgress>;
  function(name: string, fn: (...args: any[]) => any): this;
  function(
    name: string,
    options: bettersqlite3$Database$FunctionOptions,
    fn: (...args: any[]) => any
  ): this;
  aggregate<T>(
    name: string,
    options: bettersqlite3$Database$AggregateOptions<T>
  ): this;
  loadExtension(path: strin, entryPoint?: string): this;
  exec(source: string): this;
  close(): this;
  defaultSafeIntegers(toggleState?: boolean): this;

  static SqliteError: Class<bettersqlite3$SqliteError>;
}

declare type bettersqlite3$Database$ConstructorOptions = {
  +readonly?: boolean,
  +fileMustExist?: boolean,
  +timeout?: number,
  +verbose?: ?(sqlText: string) => void
};

declare type bettersqlite3$Database$PragmaOptions = {
  +simple?: boolean
};

declare type bettersqlite3$Database$BackupOptions = {
  +attahced?: string,
  +progress?: (bettersqlite3$Database$BackupProgress) => number
};

declare type bettersqlite3$Database$BackupProgress = {
  +totalPages: number,
  +remainingPages: number
};

declare type bettersqlite3$Database$FunctionOptions = {
  +varargs?: boolean,
  +deterministic?: boolean,
  +safeIntegers?: boolean
};

// The actual contract to `aggregate` is more complicated and dynamic
// than can be expressed with Flow types. This is a "best-effort,
// happy-path" type definition that is on the right track but will not
// catch all errors. Consult the `better-sqlite3` API docs for the
// source of truth.
declare type bettersqlite3$Database$AggregateOptions<T> = {
  +step: (T, bettersqlite3$BoundValue) => T,
  +inverse?: (T, bettersqlite3$BoundValue) => T,
  +start?: T | (() => T),
  +result?: (T) => bettersqlite3$BoundValue
};

// Functions that accept bound parameters take positional parameters,
// named parameters (passed as an object), or a combination of the two.
// The named parameters can be placed anywhere in the argument list, but
// must appear at most once. We can't express this constraint, so we
// permit any argument to be either a simple value or a dictionary of
// values. In the case that a user provides multiple binding
// dictionaries, better-sqlite3 will fail fast with a TypeError.
//
// Also note that better-sqlite3 permits binding and returning `BigInt`s
// rather than `number`s, but Flow doesn't support `BigInt`s. As long as
// `defaultSafeIntegers` is not set and the user code never itself
// provides `BigInt`s, using `number` alone is a good enough
// approximation.
declare type bettersqlite3$BoundValue = number | string | Buffer | null;
declare type bettersqlite3$BindingDictionary = {
  +[string]: bettersqlite3$BoundValue
};
declare type bettersqlite3$BoundParameter =
  | bettersqlite3$BoundValue
  | bettersqlite3$BindingDictionary;

declare class bettersqlite3$Statement {
  +database: bettersqlite3$Database;
  +source: string;
  +reader: boolean;

  run(...params: bettersqlite3$BoundParameter[]): bettersqlite3$RunResult;
  get(...params: bettersqlite3$BoundParameter[]): any;
  all(...params: bettersqlite3$BoundParameter[]): any[];
  iterate(...params: bettersqlite3$BoundParameter[]): Iterator<any>;
  pluck(toggleState?: boolean): this;
  expand(toggleState?: boolean): this;
  raw(toggleState?: boolean): this;
  columns(toggleState?: boolean): this;
  bind(...params: bettersqlite3$BoundParameter[]): this;
  safeIntegers(toggleState?: boolean): this;
}

declare interface bettersqlite3$RunResult {
  changes: number;
  lastInsertRowid: number;
}

declare class bettersqlite3$SqliteError extends Error {
  +code: string;
  constructor(message: string, code: string): void;
}

declare module "better-sqlite3" {
  declare export type Database = bettersqlite3$Database;
  declare export type Database$ConstructorOptions = bettersqlite3$Database$ConstructorOptions;
  declare export type Database$RegisterOptions = bettersqlite3$Database$RegisterOptions;
  declare export type BoundValue = bettersqlite3$BoundValue;
  declare export type BindingDictionary = bettersqlite3$BindingDictionary;
  declare export type BoundParameter = bettersqlite3$BoundParameter;
  declare export type Statement = bettersqlite3$Statement;
  declare export type RunResult = bettersqlite3$RunResult;
  declare export type SqliteError = bettersqlite3$SqliteError;
  declare module.exports: Class<bettersqlite3$Database>;
}
