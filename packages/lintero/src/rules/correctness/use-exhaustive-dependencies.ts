import type { Node } from "@aljazmc/syntax";
import Functions from "../../analysis/functions.js";
import Nodes from "../../analysis/nodes.js";
import type { Binding } from "../../analysis/semantic.js";
import { rule } from "../../rules.js";

type StableResult = boolean | number | (number | string)[];

interface Hook {
    name: string;
    closureIndex?: number;
    dependenciesIndex?: number;
    stableResult?: StableResult;
}

interface Options {
    hooks?: Hook[];
    reportUnnecessaryDependencies?: boolean;
    reportMissingDependenciesArray?: boolean;
}

/** React's hooks taking a closure and its dependencies. */
const checked: Record<string, [number, number]> = {
    useCallback: [0, 1],
    useEffect: [0, 1],
    useImperativeHandle: [1, 2],
    useInsertionEffect: [0, 1],
    useLayoutEffect: [0, 1],
    useMemo: [0, 1],
};

/** React's hooks returning values that never change. */
const stable: Record<string, StableResult> = {
    useEffectEvent: true,
    useReducer: [1],
    useRef: true,
    useState: [1],
    useTransition: [1],
};

const libraries = ["react", "preact/hooks", "preact/compat"];

/** A captured or listed value, like `props.a` with `?.` kept as written. */
interface Path {
    text: string;
    /** The text with `?.` as `.`, for comparing. */
    key: string;
    node: Node;
}

const covers = (outer: string, inner: string): boolean =>
    inner === outer ||
    inner.startsWith(`${outer}.`) ||
    inner.startsWith(`${outer}[`);

export default rule<Options>({
    name: "useExhaustiveDependencies",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "unsafe",
    languages: ["js"],
    domains: { react: "recommended", next: "recommended" },
    options: {
        hooks: [],
        reportUnnecessaryDependencies: true,
        reportMissingDependenciesArray: false,
    },
    create: (context) => {
        const custom = new Map(
            (context.options.hooks ?? []).map((hook) => [hook.name, hook]),
        );

        /** Whether a binding is imported from React or Preact. */
        const fromReact = (identifier: Node): boolean | undefined => {
            const binding = context.semantic.referenced(identifier)?.binding;
            if (!binding) return undefined;
            const declaration = binding.declarations[0];
            const parent = declaration && context.parent(declaration.node);
            return (
                declaration?.kind === "import" &&
                parent?.type === "ImportDeclaration" &&
                libraries.includes(Nodes.string(parent.source) ?? "")
            );
        };

        /** The hook a callee calls, like `useEffect` or `React.useEffect`. */
        const hookName = (callee: Node): string | undefined => {
            if (callee.type === "Identifier") {
                if (custom.has(callee.name)) return callee.name;
                return fromReact(callee) ? callee.name : undefined;
            }
            const member = Nodes.member(callee);
            if (member?.object.type !== "Identifier") return;
            const imported = fromReact(member.object);
            if (imported === false) return;
            if (imported === undefined && member.object.name !== "React")
                return;
            return member.name;
        };

        const stableResult = (callee: Node): StableResult | undefined => {
            const name =
                callee.type === "Identifier"
                    ? callee.name
                    : Nodes.member(callee)?.name;
            if (name === undefined) return;
            const hook = custom.get(name);
            if (hook?.stableResult !== undefined) return hook.stableResult;
            return stable[name];
        };

        /** Whether a binding never changes between renders, like a `useState` setter or a constant. */
        const isStable = (binding: Binding, component: Node): boolean => {
            const declaration = binding.declarations[0];
            if (!declaration) return false;
            if (declaration.kind === "class") return true;
            const declarator = declaration.node;
            if (declarator.type !== "VariableDeclarator" || !declarator.init)
                return false;
            const init = declarator.init;
            if (init.type === "CallExpression") {
                const result = stableResult(init.callee);
                if (result === undefined || result === false) return false;
                if (result === true) return declarator.id === declaration.id;
                const keys = Array.isArray(result) ? result : [result];
                const { id } = declarator;
                if (id.type === "ArrayPattern")
                    return keys.some(
                        (key) =>
                            typeof key === "number" &&
                            id.elements[key] === declaration.id,
                    );
                if (id.type === "ObjectPattern")
                    return id.properties.some(
                        (property) =>
                            property.type === "Property" &&
                            property.value === declaration.id &&
                            keys.includes(
                                Nodes.key(property.key, property.computed) ??
                                    "",
                            ),
                    );
                return false;
            }
            return declaration.kind === "const" && constant(init, component);
        };

        /** Whether `value[1]` reads a stable index of a hook result, like a `useState` setter. */
        const stableIndex = (node: Node, binding: Binding): boolean => {
            const parent = context.parent(node);
            const declarator = binding.declarations[0]?.node;
            if (
                parent?.type !== "MemberExpression" ||
                parent.object !== node ||
                !parent.computed ||
                parent.property.type !== "NumericLiteral" ||
                declarator?.type !== "VariableDeclarator" ||
                declarator.init?.type !== "CallExpression"
            )
                return false;
            const result = stableResult(declarator.init.callee);
            const index = Number(parent.property.raw);
            return Array.isArray(result)
                ? result.includes(index)
                : result === index;
        };

        /** Whether an expression is the same on every render, like literals and operations on them. */
        const constant = (node: Node, component: Node): boolean => {
            switch (node.type) {
                case "StringLiteral":
                case "NumericLiteral":
                case "BooleanLiteral":
                case "NullLiteral":
                case "RegExpLiteral":
                    return true;
                case "TemplateLiteral":
                    return node.expressions.every((expression) =>
                        constant(expression, component),
                    );
                case "Identifier": {
                    const binding = context.semantic.referenced(node)?.binding;
                    return !binding || !local(binding, component);
                }
                case "UnaryExpression":
                    return (
                        node.argument.type !== "Identifier" &&
                        constant(node.argument, component)
                    );
                case "BinaryExpression":
                case "LogicalExpression":
                    return (
                        constant(node.left, component) &&
                        constant(node.right, component)
                    );
                default:
                    return false;
            }
        };

        /** Whether a binding is declared in the component, its parameters included. */
        const local = (binding: Binding, component: Node): boolean => {
            const node = binding.scope.node;
            return node.start >= component.start && node.end <= component.end;
        };

        /** The member chain an identifier starts, like `props.a?.b`, up to computed accesses. */
        const path = (identifier: Node & { name: string }): Path => {
            let node: Node = identifier;
            let text = identifier.name;
            const segments: Node[] = [identifier];
            for (;;) {
                const parent = context.parent(node);
                if (
                    parent?.type !== "MemberExpression" ||
                    parent.object !== node
                )
                    break;
                let segment: string;
                if (!parent.computed && parent.property.type === "Identifier")
                    segment = `${parent.optional ? "?." : "."}${parent.property.name}`;
                else if (
                    parent.computed &&
                    (parent.property.type === "StringLiteral" ||
                        parent.property.type === "NumericLiteral")
                )
                    segment = `${parent.optional ? "?." : ""}[${parent.property.raw}]`;
                else break;
                text += segment;
                node = parent;
                segments.push(parent);
            }
            // writing a.b changes a, not a.b
            const parent = context.parent(node);
            if (
                segments.length > 1 &&
                (parent?.type === "AssignmentExpression" ||
                    parent?.type === "UpdateExpression") &&
                ("left" in parent ? parent.left : parent.argument) === node
            ) {
                segments.pop();
                node = segments.at(-1) as Node;
                text = context.slice({
                    start: identifier.start,
                    end: node.end,
                });
            }
            return { text, key: text.replaceAll("?.", "."), node };
        };

        /** The function a closure argument is, also through a local name. */
        const closureOf = (node: Node | undefined): Node | undefined => {
            if (!node) return;
            if (Nodes.isFunction(node)) return node;
            if (node.type !== "Identifier") return;
            const declaration =
                context.semantic.referenced(node)?.binding?.declarations[0];
            if (!declaration) return;
            if (declaration.node.type === "FunctionDeclaration")
                return declaration.node;
            const init =
                declaration.node.type === "VariableDeclarator"
                    ? declaration.node.init
                    : null;
            return init && Nodes.isFunction(init) ? init : undefined;
        };

        return {
            CallExpression(node) {
                const name = hookName(node.callee);
                if (name === undefined) return;
                const hook = custom.get(name);
                const indexes =
                    hook?.closureIndex !== undefined &&
                    hook.dependenciesIndex !== undefined
                        ? [hook.closureIndex, hook.dependenciesIndex]
                        : checked[name];
                if (!indexes) return;
                const [closureIndex, dependenciesIndex] = indexes as [
                    number,
                    number,
                ];
                const range =
                    node.callee.type === "MemberExpression"
                        ? { start: node.callee.property.start, end: node.end }
                        : node;
                const list = node.arguments[dependenciesIndex];
                if (!list) {
                    if (context.options.reportMissingDependenciesArray)
                        context.report(
                            range,
                            "This hook does not have a dependencies array.",
                        );
                    return;
                }
                if (list.type !== "ArrayExpression") {
                    context.report(
                        list,
                        "This dependencies list is not an array literal.",
                    );
                    return;
                }
                const closure = closureOf(node.arguments[closureIndex]);
                const component = Functions.enclosing(context, node);
                if (!closure || !component) return;

                // values of the component the closure reads
                const captures: Path[] = [];
                for (const reference of context.semantic.references) {
                    const { binding } = reference;
                    if (
                        !binding ||
                        reference.type ||
                        reference.write ||
                        reference.start < closure.start ||
                        reference.end > closure.end ||
                        !local(binding, component) ||
                        binding.declarations.some(
                            (declaration) =>
                                declaration.start >= closure.start &&
                                declaration.end <= closure.end,
                        ) ||
                        isStable(binding, component) ||
                        stableIndex(reference.node, binding)
                    )
                        continue;
                    // JSX names like <Component /> are captures too
                    const captured =
                        reference.node.type === "Identifier"
                            ? path(reference.node)
                            : {
                                  text: reference.name,
                                  key: reference.name,
                                  node: reference.node,
                              };
                    if (!captures.some((other) => other.key === captured.key))
                        captures.push(captured);
                }

                const dependencies: {
                    path?: Path;
                    node: Node;
                    stable: boolean;
                }[] = [];
                for (const element of list.elements) {
                    if (!element || element.type === "SpreadElement") continue;
                    let root: Node = element;
                    while (root.type === "MemberExpression") root = root.object;
                    if (root.type !== "Identifier") {
                        dependencies.push({ node: element, stable: false });
                        continue;
                    }
                    const binding = context.semantic.referenced(root)?.binding;
                    const text = context.slice(element);
                    dependencies.push({
                        path: {
                            text,
                            key: text.replaceAll("?.", "."),
                            node: element,
                        },
                        node: element,
                        stable:
                            !binding ||
                            !local(binding, component) ||
                            isStable(binding, component),
                    });
                }

                for (const capture of captures)
                    if (
                        !dependencies.some(
                            (dependency) =>
                                dependency.path &&
                                covers(dependency.path.key, capture.key),
                        )
                    )
                        context.report(
                            range,
                            `This hook does not specify its dependency on ${capture.text}.`,
                            undefined,
                            capture.text,
                        );

                const unnecessary: string[] = [];
                const seen = new Set<string>();
                for (const dependency of dependencies) {
                    const key = dependency.path?.key;
                    if (
                        key === undefined ||
                        dependency.stable ||
                        seen.has(key)
                    ) {
                        unnecessary.push(context.slice(dependency.node));
                        continue;
                    }
                    seen.add(key);
                    if (captures.some((capture) => covers(key, capture.key)))
                        continue;
                    const specific = captures.filter((capture) =>
                        covers(capture.key, key),
                    );
                    if (specific.length > 0) {
                        // fine when other dependencies cover what it narrows
                        const covered = specific.every((capture) =>
                            dependencies.some(
                                (other) =>
                                    other.path &&
                                    covers(other.path.key, capture.key),
                            ),
                        );
                        if (!covered)
                            context.report(
                                range,
                                `This hook specifies a dependency more specific than its captures: ${dependency.path?.text}`,
                            );
                    } else unnecessary.push(context.slice(dependency.node));
                }
                if (
                    unnecessary.length > 0 &&
                    context.options.reportUnnecessaryDependencies !== false
                )
                    context.report(
                        range,
                        `This hook specifies more dependencies than necessary: ${unnecessary.join(", ")}.`,
                    );
            },
        };
    },
});
