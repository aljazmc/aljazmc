import type { Node } from "@aljazmc/syntax";

/**
 * How statements can complete: "normal" continues with the next statement,
 * the others are abrupt, `break:label` and `continue:label` when labeled.
 */
export type Completion = string;

/** A simple control flow analysis over statements. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups flow helpers
export default class Flow {
    /** The ways a statement can complete. */
    static completions(node: Node): Set<Completion> {
        switch (node.type) {
            case "ReturnStatement":
                return new Set(["return"]);
            case "ThrowStatement":
                return new Set(["throw"]);
            case "BreakStatement":
                return new Set([
                    node.label ? `break:${node.label.name}` : "break",
                ]);
            case "ContinueStatement":
                return new Set([
                    node.label ? `continue:${node.label.name}` : "continue",
                ]);
            case "BlockStatement":
            case "StaticBlock":
                return Flow.list(node.body);
            case "IfStatement":
                return Flow.#union(
                    Flow.completions(node.consequent),
                    node.alternate
                        ? Flow.completions(node.alternate)
                        : new Set(["normal"]),
                );
            case "LabeledStatement": {
                const body = Flow.completions(node.body);
                const label = node.label.name;
                if (body.delete(`break:${label}`)) body.add("normal");
                if (body.delete(`continue:${label}`)) body.add("normal");
                return body;
            }
            case "WhileStatement":
            case "DoWhileStatement":
            case "ForStatement":
            case "ForInStatement":
            case "ForOfStatement":
                return Flow.#loop(node);
            case "SwitchStatement":
                return Flow.#switch(node);
            case "TryStatement":
                return Flow.#try(node);
            default:
                return new Set(["normal"]);
        }
    }

    /** The ways a list of statements can complete. */
    static list(statements: readonly Node[]): Set<Completion> {
        const result = new Set<Completion>();

        for (const statement of statements) {
            const completions = Flow.completions(statement);
            for (const completion of completions)
                if (completion !== "normal") result.add(completion);
            if (!completions.has("normal")) return result;
        }

        result.add("normal");
        return result;
    }

    /** Whether a condition is a literal that is always true. */
    static #infinite(test: Node | null): boolean {
        return (
            test === null ||
            (test.type === "BooleanLiteral" && test.value) ||
            (test.type === "NumericLiteral" && Number(test.raw) !== 0)
        );
    }

    static #loop(node: Node): Set<Completion> {
        if (!("body" in node) || !node.body || Array.isArray(node.body))
            return new Set(["normal"]);
        const body = Flow.completions(node.body as Node);
        const result = new Set<Completion>();
        let exits = false;

        for (const completion of body) {
            if (completion === "break") exits = true;
            else if (completion !== "continue" && completion !== "normal")
                result.add(completion);
        }

        const test =
            node.type === "ForStatement" ||
            node.type === "WhileStatement" ||
            node.type === "DoWhileStatement"
                ? node.test
                : undefined;
        const infinite = test !== undefined && Flow.#infinite(test);
        const runsOnce =
            node.type === "DoWhileStatement" &&
            !body.has("normal") &&
            !body.has("continue");

        if (exits || (!infinite && !runsOnce)) result.add("normal");
        return result;
    }

    static #switch(node: Node): Set<Completion> {
        if (node.type !== "SwitchStatement") return new Set(["normal"]);
        const result = new Set<Completion>();
        let falls = false;

        for (const clause of node.cases) {
            const completions = Flow.list(clause.consequent);
            for (const completion of completions) {
                if (completion === "break") result.add("normal");
                else if (completion !== "normal") result.add(completion);
            }
            falls = completions.has("normal");
        }

        const exhaustive = node.cases.some((clause) => clause.test === null);
        if (falls || !exhaustive) result.add("normal");
        return result;
    }

    static #try(node: Node): Set<Completion> {
        if (node.type !== "TryStatement") return new Set(["normal"]);
        const block = Flow.completions(node.block);
        // anything in the block may throw, the handler takes over then
        if (node.handler) {
            block.delete("throw");
            for (const completion of Flow.completions(node.handler.body))
                block.add(completion);
        }
        if (!node.finalizer) return block;

        const finalizer = Flow.completions(node.finalizer);
        if (!finalizer.delete("normal")) return finalizer;
        return Flow.#union(block, finalizer);
    }

    static #union(a: Set<Completion>, b: Set<Completion>): Set<Completion> {
        return new Set([...a, ...b]);
    }
}
