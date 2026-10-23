import type {
    Domain,
    FixKind,
    Group,
    Level,
    Rule,
    RuleConfiguration,
    Rules,
    Severity,
} from "../rules.js";

/** A rule enabled by the settings, with its severity and options. */
export interface Active {
    rule: Rule;
    severity: Severity;
    options: object;
    fix: FixKind;
}

/** Project files besides package.json that rules read, like `turbo.json`. */
export interface Project {
    turbo?: unknown;
    /** Reads another file of the project by its path from the root, for rules that follow imports. */
    read?: (file: string) => string | undefined;
}

/** Fields of package.json listing dependencies, and the module type. */
export interface Manifest {
    type?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

/** Resolves Biome style linter settings to the enabled rules. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups settings helpers
export default class Settings {
    /** Packages, with their minimum version, that enable a domain. */
    static readonly dependencies: Partial<
        Record<Domain, Record<string, string>>
    > = {
        astro: { astro: "1.0.0" },
        drizzle: { "drizzle-orm": "0.9.0" },
        next: { next: "14.0.0" },
        playwright: { "@playwright/test": "1.0.0" },
        qwik: { "@builder.io/qwik": "1.0.0", "@qwik.dev/core": "2.0.0" },
        react: { react: "16.0.0" },
        reactNative: { "react-native": "0.60.0" },
        solid: { solid: "1.0.0" },
        svelte: { svelte: "3.0.0" },
        tailwind: { tailwindcss: "4.0.0" },
        test: { ava: "2.0.0", jest: "26.0.0", mocha: "8.0.0", vitest: "1.0.0" },
        turborepo: { turbo: "1.0.0" },
        vue: { vue: "3.0.0" },
    };

    /** Domains enabled by the dependencies of a project. */
    static detect(manifest: Manifest): Domain[] {
        const installed = {
            ...manifest.peerDependencies,
            ...manifest.devDependencies,
            ...manifest.dependencies,
        };

        return (
            Object.entries(Settings.dependencies) as [
                Domain,
                Record<string, string>,
            ][]
        )
            .filter(([, packages]) =>
                Object.entries(packages).some(([name, minimum]) => {
                    const range = installed[name];
                    return (
                        range !== undefined && Settings.#atLeast(range, minimum)
                    );
                }),
            )
            .map(([domain]) => domain);
    }

    static resolve(
        settings: Rules,
        rules: Rule[],
        detected: Domain[],
    ): Active[] {
        const preset =
            settings.recommended === false ? "none" : settings.preset;
        const active: Active[] = [];

        for (const rule of rules) {
            let enabled = Settings.#preset(settings, rule, preset, detected);
            let severity = rule.severity;
            let options: object = rule.options ?? {};
            let fix = rule.fix;

            const group = settings[rule.group as Group];
            if (typeof group === "string") {
                enabled = group !== "off";
                severity = Settings.#severity(group, rule.severity);
            } else if (group?.[rule.name] !== undefined) {
                const configuration = group[rule.name] as RuleConfiguration;
                const level =
                    typeof configuration === "string"
                        ? configuration
                        : configuration.level;
                enabled = level !== "off";
                severity = Settings.#severity(level, rule.severity);
                if (typeof configuration === "object") {
                    options = { ...options, ...configuration.options };
                    if (configuration.fix) fix = configuration.fix;
                }
            }

            if (enabled) active.push({ rule, severity, options, fix });
        }

        return active;
    }

    static #preset(
        settings: Rules,
        rule: Rule,
        preset: Rules["preset"],
        detected: Domain[],
    ): boolean {
        if (rule.group === "nursery") return false;
        if (!rule.domains) {
            if (preset === "all") return true;
            return preset === "recommended" && rule.recommended;
        }

        const values = (Object.entries(rule.domains) as [Domain, string][]).map(
            ([domain, membership]) => {
                const value =
                    settings.domains[domain] ??
                    (detected.includes(domain) ? "recommended" : undefined);
                if (value === "all") return true;
                if (value === "recommended")
                    return membership === "recommended";
                if (value === "none") return false;
                return preset === "all";
            },
        );
        return values.some(Boolean);
    }

    static #severity(level: Level, fallback: Severity): Severity {
        return level === "on" || level === "off" ? fallback : level;
    }

    /** Whether a version range allows versions at or above a minimum. */
    static #atLeast(range: string, minimum: string): boolean {
        const version = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(range);
        if (!version)
            return (
                range === "*" ||
                range === "latest" ||
                range.startsWith("workspace:")
            );

        const actual = version.slice(1).map((part) => Number(part ?? 0));
        const wanted = minimum.split(".").map(Number);
        for (const [index, part] of wanted.entries()) {
            const value = actual[index] ?? 0;
            if (value !== part) return value > part;
        }
        return true;
    }
}
