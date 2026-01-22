import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

const builtins = ["hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable"];

/** Whether an object is Object.prototype or an object literal, where the builtins are safe. */
const safe = (object: Node) =>
    Nodes.path(object) === "Object.prototype" ||
    Nodes.unwrap(object).type === "ObjectExpression";

export default rule({
    name: "noPrototypeBuiltins",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "safe",
    languages: ["js"],
    create: (context) => ({
        CallExpression(node) {
            let callee = Nodes.unwrap(node.callee);
            const member = Nodes.member(callee);
            if (member && (member.name === "call" || member.name === "apply"))
                callee = Nodes.unwrap(member.object);

            const access = Nodes.member(callee);
            const called = callee !== Nodes.unwrap(node.callee);
            // Object.hasOwn replaces even the safe hasOwnProperty calls
            if (!access || !builtins.includes(access.name)) return;
            // called through call or apply, only hasOwnProperty has a better alternative
            if (called ? access.name !== "hasOwnProperty" : safe(access.object))
                return;
            if (callee.type !== "MemberExpression") return;

            const fix =
                access.name === "hasOwnProperty" &&
                callee === Nodes.unwrap(node.callee) &&
                node.arguments.length === 1
                    ? {
                          message: "Use 'Object.hasOwn()' instead.",
                          edits: [
                              {
                                  start: node.start,
                                  end: node.end,
                                  text: `Object.hasOwn(${context.slice(access.object)}, ${context.slice(node.arguments[0] as Node)})`,
                              },
                          ],
                      }
                    : undefined;
            context.report(
                callee === Nodes.unwrap(node.callee)
                    ? callee.property
                    : node.callee,
                `Do not access Object.prototype method '${access.name}' from target object.`,
                fix,
            );
        },
    }),
});
