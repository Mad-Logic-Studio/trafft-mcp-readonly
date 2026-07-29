declare namespace NodeJS {
  interface ProcessEnv { [key: string]: string | undefined }
}
declare const process: {
  env: NodeJS.ProcessEnv;
  exit(code?: number): never;
  once(event: string, listener: () => void): void;
};

declare module "dotenv/config";
declare module "node:fs" {
  export const constants: any;
  export const closeSync: (...args: any[]) => any;
  export const existsSync: (...args: any[]) => boolean;
  export const fchmodSync: (...args: any[]) => any;
  export const lstatSync: (...args: any[]) => { isSymbolicLink(): boolean };
  export const mkdirSync: (...args: any[]) => any;
  export const openSync: (...args: any[]) => number;
  export const writeSync: (...args: any[]) => any;
}
declare module "node:path" {
  export const dirname: (...args: any[]) => string;
  export const resolve: (...args: any[]) => string;
}
declare module "@modelcontextprotocol/sdk/server/mcp.js" {
  export class McpServer {
    constructor(config: any);
    tool(name: string, description: string, schema: any, handler: (args: any) => any): void;
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
  }
}
declare module "@modelcontextprotocol/sdk/server/stdio.js" {
  export class StdioServerTransport {}
}
declare module "zod" {
  export const z: any;
}
