import { rule } from "../../rules.js";

const boxed: Record<string, string | undefined> = {
    BigInt: "bigint",
    Boolean: "boolean",
    Function: undefined,
    Number: "number",
    Object: undefined,
    String: "string",
    Symbol: "symbol",
};

export default rule({
    name: "noBannedTypes",
    group: "complexity",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["ts"],
    create: (context) => ({
        TSTypeReference(node) {
            const { typeName } = node;
            if (
                typeName.type !== "Identifier" ||
                !Object.hasOwn(boxed, typeName.name) ||
                node.typeArguments ||
                !context.semantic.isGlobal(typeName)
            )
                return;
            const primitive = boxed[typeName.name];
            context.report(
                node,
                `Don't use '${typeName.name}' as a type.`,
                primitive
                    ? {
                          message: `Use lowercase primitives for consistency.`,
                          edits: [
                              {
                                  start: node.start,
                                  end: node.end,
                                  text: primitive,
                              },
                          ],
                      }
                    : undefined,
            );
        },
        TSTypeLiteral(node) {
            if (node.members.length > 0) return;
            const parent = context.parent(node);
            if (
                parent?.type === "TSTypeParameter" &&
                parent.constraint === node
            )
                return;
            if (parent?.type === "TSIntersectionType") return;
            context.report(node, "Don't use '{}' as a type.");
        },
    }),
});
