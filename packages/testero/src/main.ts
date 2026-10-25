#!/usr/bin/env node
export * from "./testero.js";
export { default } from "./testero.js";

// the command line runs only when this file is run, not when it is imported
if (import.meta.main) await import("./index.js");
