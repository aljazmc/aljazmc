import { Includes } from "@aljazmc/config";
import type { Node } from "@aljazmc/syntax";
import Nodes from "../../analysis/nodes.js";
import { rule } from "../../rules.js";

interface Options {
    androidPathPatterns?: string[];
    iosPathPatterns?: string[];
}

export default rule<Options>({
    name: "useReactNativePlatformComponents",
    group: "correctness",
    severity: "error",
    recommended: false,
    fix: "none",
    languages: ["js"],
    domains: { reactNative: "recommended" },
    options: {
        androidPathPatterns: ["**/*.android.{js,jsx,ts,tsx}"],
        iosPathPatterns: ["**/*.ios.{js,jsx,ts,tsx}"],
    },
    create: (context) => {
        const components: {
            node: Node;
            name: string;
            platform: "android" | "ios";
        }[] = [];
        const add = (node: Node, name: string | undefined) => {
            if (name?.endsWith("Android"))
                components.push({ node, name, platform: "android" });
            else if (name?.endsWith("IOS"))
                components.push({ node, name, platform: "ios" });
        };

        return {
            ImportDeclaration(node) {
                if (Nodes.string(node.source) !== "react-native") return;
                for (const specifier of node.specifiers)
                    if (specifier.type === "ImportSpecifier")
                        add(specifier, Nodes.key(specifier.imported));
            },
            VariableDeclarator(node) {
                // const { ProgressBarAndroid } = require("react-native")
                const { id, init } = node;
                if (
                    id.type !== "ObjectPattern" ||
                    init?.type !== "CallExpression" ||
                    Nodes.path(init.callee) !== "require" ||
                    Nodes.string(init.arguments[0]) !== "react-native"
                )
                    return;
                for (const property of id.properties)
                    if (property.type === "Property")
                        add(
                            property,
                            Nodes.key(property.key, property.computed),
                        );
            },
            "Program:exit"() {
                const android = new Includes(
                    context.options.androidPathPatterns ?? [],
                ).matches(context.file);
                const ios = new Includes(
                    context.options.iosPathPatterns ?? [],
                ).matches(context.file);
                const mixed =
                    components.some(
                        (component) => component.platform === "android",
                    ) &&
                    components.some(
                        (component) => component.platform === "ios",
                    );
                for (const { node, name, platform } of components) {
                    if (platform === "android" ? android : ios) continue;
                    context.report(
                        node,
                        mixed
                            ? "iOS and Android components cannot be mixed in the same file."
                            : platform === "android"
                              ? `Android component ${name} is used outside of an Android-specific file.`
                              : `iOS component ${name} is used outside of an iOS-specific file.`,
                    );
                }
            },
        };
    },
});
