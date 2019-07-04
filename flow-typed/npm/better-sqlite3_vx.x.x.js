// flow-typed signature: 946429b216273f6ed9345df0294cfd25
// flow-typed version: <<STUB>>/better-sqlite3_v4.1.4/flow_v0.77.0

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
  exec(source: string): this;
  transaction(sources: $ReadOnlyArray<string>): bettersqlite3$Transaction;
  pragma(pragma: string, simplify?: boolean): any;
  checkpoint(databaseName?: string): this;
  register(fn: (...args: any[]) => any): void;
  register(
    options: bettersqlite3$Database$RegisterOptions,
    fn: (...args: any[]) => any
  ): void;
  close(): this;
  defaultSafeIntegers(toggleState?: boolean): this;

  static SqliteError: Class<bettersqlite3$SqliteError>;
}

declare type bettersqlite3$Database$ConstructorOptions = {
  +memory?: boolean,
  +readonly?: boolean,
  +fileMustExist?: boolean
};

declare type bettersqlite3$Database$RegisterOptions = {
  +name?: string,
  +varargs?: boolean,
  +deterministic?: boolean,
  +safeIntegers?: boolean
};

// Functions that accept bound parameters take positional parameters,
// named parameters (passed as an object), or a combination of the two.
// The named parameters can be placed anywhere in the argument list, but
// must appear at most once. We can't express this constraint, so we
// permit any argument to be either a simple value or a dictionary of
// values. In the case that a user provides multiple binding
// dictionaries, better-sqlite3 will fail fast with a TypeError.
//
// Also note that better-sqlite3 permits binding `Integer.IntLike` from
// npm/integer, not just `number`, but we don't have those typedefs. For
// now, `number` is a good approximation.
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
  bind(...params: bettersqlite3$BoundParameter[]): this;
  safeIntegers(toggleState?: boolean): this;
}

declare class bettersqlite3$Transaction {
  +database: bettersqlite3$Database;
  +source: string;

  constructor(db: bettersqlite3$Database, sources: string[]): void;
  run(...params: any[]): bettersqlite3$RunResult;
  bind(...params: any[]): this;
  safeIntegers(toggleState?: boolean): this;
}

declare interface bettersqlite3$RunResult {
  changes: number;
  // TODO: This is actually `Integer.IntLike` from npm/integer, but we
  // don't have those typedefs. For now, `number` is a good
  // approximation.
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
  declare export type Transaction = bettersqlite3$Transaction;
  declare export type RunResult = bettersqlite3$RunResult;
  declare export type SqliteError = bettersqlite3$SqliteError;
  declare module.exports: Class<bettersqlite3$Database>;
}
