#!/usr/bin/env node
export * from "./monorepo.js";
export { default } from "./monorepo.js";

// the command line runs only when this file is run, not when it is imported
if (import.meta.main) await import("./index.js");
