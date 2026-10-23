import Jsx from "../../analysis/jsx.js";
import { rule } from "../../rules.js";
import { accessible, contentProps } from "./use-heading-content.js";

export default rule({
    name: "useAnchorContent",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "unsafe",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "a") return;
            // anchors given to components as props, like `render={<a />}`
            if (
                [...context.ancestors(node)].some(
                    (ancestor) => ancestor.type === "JSXAttribute",
                )
            )
                return;
            const visible =
                !Jsx.truthy(node, "aria-hidden") &&
                (accessible(node.children) ||
                    contentProps(node) ||
                    Jsx.spreads(node));
            if (visible) return;
            // the content is there when it is not hidden
            const hidden = Jsx.attribute(node, "aria-hidden");
            const shown =
                hidden &&
                (accessible(node.children) ||
                    contentProps(node) ||
                    Jsx.spreads(node));
            context.report(
                node,
                "Provide screen reader accessible content when using `a` elements.",
                shown
                    ? {
                          message:
                              "Remove the aria-hidden attribute to allow the anchor element and its content visible to assistive technologies.",
                          edits: [
                              {
                                  start: hidden.start,
                                  end: hidden.end,
                                  text: "",
                              },
                          ],
                      }
                    : undefined,
            );
        },
    }),
});
