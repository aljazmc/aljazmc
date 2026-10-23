import type {
    Backreference,
    Group,
    Pattern,
    Term,
} from "../../analysis/regex.js";
import { parseRegex } from "../../analysis/regex.js";
import { rule } from "../../rules.js";

type Container = Group | Pattern;

/** The groups and the pattern around a node, from the closest. */
const ancestors = (node: { parent?: Container } | Group): Container[] => {
    const list: Container[] = [];
    let current = "parent" in node ? node.parent : undefined;
    while (current) {
        list.push(current);
        current = current.type === "group" ? current.parent : undefined;
    }
    return list;
};

/** The alternative of a container a position is in. */
const alternative = (container: Container, position: number): number =>
    container.alternatives.findIndex((terms: Term[]) =>
        terms.some((term) => term.start <= position && position < term.end),
    );

const negative = (group: Container) =>
    group.type === "group" &&
    (group.kind === "negativeLookahead" || group.kind === "negativeLookbehind");
const lookbehind = (group: Container) =>
    group.type === "group" &&
    (group.kind === "lookbehind" || group.kind === "negativeLookbehind");

export default rule({
    name: "noUselessRegexBackrefs",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        RegExpLiteral(node) {
            const parsed = parseRegex(node.raw);
            if (!parsed) return;
            const report = (reference: Backreference, message: string) =>
                context.report(
                    {
                        start: node.start + 1 + reference.start,
                        end: node.start + 1 + reference.end,
                    },
                    `This backreference ${message}, making it always match an empty string.`,
                );

            for (const reference of parsed.backreferences) {
                const group =
                    typeof reference.reference === "number"
                        ? parsed.groups[reference.reference - 1]
                        : parsed.groups.find(
                              (candidate) =>
                                  candidate.name === reference.reference,
                          );
                if (!group) continue;
                const around = ancestors(reference);
                if (around.includes(group)) {
                    report(
                        reference,
                        "is nested within the group to which it refers",
                    );
                    continue;
                }
                const outer = [group, ...ancestors(group)];
                const common = outer.find((container) =>
                    around.includes(container),
                ) as Container;
                if (
                    alternative(common, group.start) !==
                    alternative(common, reference.start)
                ) {
                    report(
                        reference,
                        "refers to a group placed in another alternate branch",
                    );
                    continue;
                }
                if (
                    outer.some(
                        (container) =>
                            container !== group &&
                            negative(container) &&
                            !around.includes(container),
                    )
                ) {
                    report(
                        reference,
                        "refers to a group within a negated assertion",
                    );
                    continue;
                }
                const behind = around.some(
                    (container) =>
                        lookbehind(container) && outer.includes(container),
                );
                if (behind && group.end <= reference.start)
                    report(
                        reference,
                        "refers to a group that appears before itself in a lookbehind assertion",
                    );
                else if (!behind && group.start > reference.start)
                    report(
                        reference,
                        "refers to a group that appears after it",
                    );
            }
        },
    }),
});
