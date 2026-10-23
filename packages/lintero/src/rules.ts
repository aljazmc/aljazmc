import type { Node, NodeOf, NodeType } from "@aljazmc/syntax";
import type Context from "./analysis/context.js";

/** "on" uses the rule's default severity. */
export type Level = "off" | "on" | "info" | "warn" | "error";
export type Severity = "info" | "warn" | "error";
export type FixKind = "none" | "safe" | "unsafe";
export type Preset = "recommended" | "all" | "none";
export type DomainValue = "recommended" | "all" | "none";

export type Group =
    | "a11y"
    | "complexity"
    | "correctness"
    | "nursery"
    | "performance"
    | "security"
    | "style"
    | "suspicious";

export type Domain =
    | "astro"
    | "drizzle"
    | "next"
    | "playwright"
    | "project"
    | "qwik"
    | "react"
    | "reactNative"
    | "solid"
    | "svelte"
    | "tailwind"
    | "test"
    | "turborepo"
    | "types"
    | "vue";

export type RuleConfiguration =
    | Level
    | { level: Level; fix?: FixKind; options?: object };

/** A level for the whole group, or a configuration per rule. */
export type GroupConfiguration = Level | Record<string, RuleConfiguration>;

/** Biome's linter settings: linter.*, linter.rules.*, javascript.* and json.linter. */
export interface Rules {
    enabled: boolean;
    /** Globs of the files to lint in order, the last match decides, "!" excludes. */
    includes: string[];
    domains: Partial<Record<Domain, DomainValue>>;
    preset: Preset;
    /** Biome's older switch, false disables the recommended preset. */
    recommended?: boolean;
    a11y?: GroupConfiguration;
    complexity?: GroupConfiguration;
    correctness?: GroupConfiguration;
    nursery?: GroupConfiguration;
    performance?: GroupConfiguration;
    security?: GroupConfiguration;
    style?: GroupConfiguration;
    suspicious?: GroupConfiguration;
    javascript: {
        enabled: boolean;
        /** Global names known to exist, for rules that check undeclared names. */
        globals: string[];
        jsxRuntime: "reactClassic" | "transparent";
    };
    json: { enabled: boolean };
}

/** The languages a rule applies to, "js" covers TypeScript and JSX too. */
export type Language = "js" | "json" | "jsx" | "ts";

/** A text change, replacing source from start to end. */
export interface Edit {
    start: number;
    end: number;
    text: string;
}

export interface Fix {
    message: string;
    edits: Edit[];
}

export interface Report {
    start: number;
    end: number;
    message: string;
    fix?: Fix;
    /** What the diagnostic is about, for suppressions like `useExhaustiveDependencies(a)`. */
    instance?: string;
}

type Enter = { [T in NodeType]?: (node: NodeOf<T>) => void };
type Leave = { [T in NodeType as `${T}:exit`]?: (node: NodeOf<T>) => void };

/** Handlers called on entering, or with `:exit` on leaving, nodes of a type. */
export type Visitor = Enter & Leave & { "*"?: (node: Node) => void };

export interface Rule<Options extends object = object> {
    name: string;
    group: Group;
    severity: Severity;
    recommended: boolean;
    fix: FixKind;
    languages: Language[];
    /** Domains the rule belongs to, and whether it is recommended in them. */
    domains?: Partial<Record<Domain, "all" | "recommended">>;
    /** Default options, merged with the configured ones. */
    options?: Options;
    create(context: Context<Options>): Visitor;
}

/** Defines a rule, keeping its options type. */
export function rule<Options extends object = object>(
    definition: Rule<Options>,
): Rule<Options> {
    return definition;
}
