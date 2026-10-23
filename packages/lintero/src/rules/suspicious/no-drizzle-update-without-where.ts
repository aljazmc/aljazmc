import { rule } from "../../rules.js";
import { withoutWhere } from "./no-drizzle-delete-without-where.js";

export default rule<{ drizzleObjectName?: string[] }>({
    name: "noDrizzleUpdateWithoutWhere",
    group: "suspicious",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { drizzle: "recommended" },
    options: { drizzleObjectName: [] },
    create: (context) => ({
        CallExpression(node) {
            withoutWhere(
                context,
                node,
                "update",
                ".update() is used without .where(). This will update all rows in the table.",
            );
        },
    }),
});
