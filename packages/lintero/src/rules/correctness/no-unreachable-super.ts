import { type Node, Walker } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** How often `super()` may have been called on the paths reaching a point, 2 for more than once. */
type State = Set<number>;

type Problem = "this" | "twice" | "loop" | "return" | "end";

/** Messages by priority, like Biome only the first problem found is reported. */
const messages: Record<Problem, string> = {
    this: "This constructor has code paths accessing `this` without calling `super()` first.",
    twice: "This constructor has code paths where `super()` is called more than once.",
    loop: "This constructor calls `super()` in a loop.",
    return: "This constructor has code paths that return without calling `super()` first.",
    end: "This constructor has code paths that return without calling `super()`.",
};

interface Target {
    labels: string[];
    /** Loops and switches take unlabeled breaks, loops take continues. */
    kind: "block" | "loop" | "switch";
    breaks: State[];
    continues: State[];
}

const union = (...states: (State | null | undefined)[]): State | null => {
    const present = states.filter((state): state is State => !!state);
    return present.length === 0
        ? null
        : new Set(present.flatMap((state) => [...state]));
};

const scopes = [
    "ArrowFunctionExpression",
    "ClassDeclaration",
    "ClassExpression",
    "FunctionDeclaration",
    "FunctionExpression",
];

export default rule({
    name: "noUnreachableSuper",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        MethodDefinition(method) {
            if (method.kind !== "constructor" || !method.value.body) return;
            const parent = context.parent(context.parent(method) as Node);
            if (
                (parent?.type !== "ClassDeclaration" &&
                    parent?.type !== "ClassExpression") ||
                !parent.superClass ||
                parent.superClass.type === "NullLiteral"
            )
                return;

            const problems = new Set<Problem>();
            let silent = 0;
            const flag = (problem: Problem) => {
                if (silent === 0) problems.add(problem);
            };
            const targets: Target[] = [];

            /** Evaluates an expression in source order, its branches too. */
            const scan = (node: Node, state: State) => {
                if (scopes.includes(node.type)) return;
                if (node.type === "ThisExpression") {
                    if (state.has(0)) flag("this");
                    return;
                }
                if (
                    node.type === "CallExpression" &&
                    node.callee.type === "Super"
                ) {
                    if ([...state].some((count) => count > 0)) flag("twice");
                    const next = [...state].map((count) =>
                        Math.min(count + 1, 2),
                    );
                    state.clear();
                    for (const count of next) state.add(count);
                    for (const argument of node.arguments)
                        scan(argument, state);
                    return;
                }
                for (const child of Walker.children(node)) scan(child, state);
            };

            const list = (
                statements: Node[],
                state: State | null,
            ): State | null => {
                let current = state;
                for (const statement of statements) {
                    if (!current) return null;
                    current = exec(statement, current);
                }
                return current;
            };

            const loop = (
                node: Node,
                body: Node,
                state: State,
                labels: string[],
                repeats: boolean,
            ): State | null => {
                const target: Target = {
                    labels,
                    kind: "loop",
                    breaks: [],
                    continues: [],
                };
                targets.push(target);
                const after = exec(body, new Set(state));
                targets.pop();
                if (repeats) {
                    // whether the body calls super() on a path that runs it again
                    silent++;
                    const probe: Target = {
                        labels,
                        kind: "loop",
                        breaks: [],
                        continues: [],
                    };
                    targets.push(probe);
                    const again = union(
                        exec(body, new Set([0])),
                        ...probe.continues,
                    );
                    targets.pop();
                    silent--;
                    if (again && [...again].some((count) => count > 0))
                        flag("loop");
                }
                if (node.type === "DoWhileStatement" && after)
                    scan(node.test, after);
                const exits = union(...target.breaks);
                if (repeats && node.type !== "DoWhileStatement") return exits;
                return node.type === "DoWhileStatement"
                    ? union(after, exits, ...target.continues)
                    : union(state, after, exits, ...target.continues);
            };

            const exec = (
                node: Node,
                state: State,
                labels: string[] = [],
            ): State | null => {
                switch (node.type) {
                    case "BlockStatement":
                        return list(node.body, state);
                    case "LabeledStatement": {
                        const body = node.body;
                        const label = node.label.name;
                        if (
                            /(While|For|ForIn|ForOf|DoWhile)Statement$/.test(
                                body.type,
                            )
                        )
                            return exec(body, state, [...labels, label]);
                        const target: Target = {
                            labels: [label],
                            kind: "block",
                            breaks: [],
                            continues: [],
                        };
                        targets.push(target);
                        const after = exec(body, state);
                        targets.pop();
                        return union(after, ...target.breaks);
                    }
                    case "IfStatement": {
                        scan(node.test, state);
                        const consequent = exec(
                            node.consequent,
                            new Set(state),
                        );
                        const alternate = node.alternate
                            ? exec(node.alternate, new Set(state))
                            : state;
                        return union(consequent, alternate);
                    }
                    case "ReturnStatement":
                        if (node.argument) scan(node.argument, state);
                        if (state.has(0)) flag("return");
                        return null;
                    case "ThrowStatement":
                        scan(node.argument, state);
                        return null;
                    case "BreakStatement":
                    case "ContinueStatement": {
                        const label = node.label?.name;
                        const target = [...targets]
                            .reverse()
                            .find((candidate) =>
                                label !== undefined
                                    ? candidate.labels.includes(label)
                                    : node.type === "ContinueStatement"
                                      ? candidate.kind === "loop"
                                      : candidate.kind !== "block",
                            );
                        if (node.type === "BreakStatement")
                            target?.breaks.push(state);
                        else target?.continues.push(state);
                        return null;
                    }
                    case "WhileStatement": {
                        scan(node.test, state);
                        const repeats =
                            node.test.type === "BooleanLiteral" &&
                            node.test.value;
                        return loop(node, node.body, state, labels, repeats);
                    }
                    case "DoWhileStatement":
                        return loop(node, node.body, state, labels, true);
                    case "ForStatement": {
                        if (node.init) scan(node.init, state);
                        if (node.test) scan(node.test, state);
                        const repeats =
                            !node.test ||
                            (node.test.type === "BooleanLiteral" &&
                                node.test.value);
                        return loop(node, node.body, state, labels, repeats);
                    }
                    case "ForInStatement":
                    case "ForOfStatement":
                        scan(node.right, state);
                        return loop(node, node.body, state, labels, false);
                    case "SwitchStatement": {
                        scan(node.discriminant, state);
                        const target: Target = {
                            labels,
                            kind: "switch",
                            breaks: [],
                            continues: [],
                        };
                        targets.push(target);
                        let fallthrough: State | null = null;
                        for (const clause of node.cases) {
                            if (clause.type !== "SwitchCase") continue;
                            const entry = union(fallthrough, state) as State;
                            if (clause.test) scan(clause.test, entry);
                            fallthrough = list(clause.consequent, entry);
                        }
                        targets.pop();
                        const matched = node.cases.some(
                            (clause) =>
                                clause.type === "SwitchCase" &&
                                clause.test === null,
                        );
                        return union(
                            fallthrough,
                            ...target.breaks,
                            matched ? null : state,
                        );
                    }
                    case "TryStatement": {
                        // the handler may start after any statement of the block
                        const seen: State[] = [new Set(state)];
                        let current: State | null = new Set(state);
                        for (const statement of node.block.body) {
                            if (!current) break;
                            current = exec(statement, current);
                            if (current) seen.push(new Set(current));
                        }
                        let after = current;
                        if (node.handler) {
                            const entry = union(...seen) as State;
                            after = union(
                                after,
                                exec(node.handler.body, entry),
                            );
                        }
                        if (node.finalizer)
                            after = after ? exec(node.finalizer, after) : null;
                        return after;
                    }
                    case "FunctionDeclaration":
                    case "ClassDeclaration":
                    case "EmptyStatement":
                        return state;
                    default:
                        scan(node, state);
                        return state;
                }
            };

            const body = method.value.body;
            if (body?.type !== "BlockStatement") return;
            const end = list(body.body, new Set([0]));
            if (end?.has(0)) flag("end");
            const problem = (Object.keys(messages) as Problem[]).find((key) =>
                problems.has(key),
            );
            if (problem) context.report(method.key, messages[problem]);
        },
    }),
});
