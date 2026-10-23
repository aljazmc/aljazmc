import type { Node, NodeOf } from "@aljazmc/syntax";
import Imports from "./imports.js";
import Nodes from "./nodes.js";

/** Helpers for JSON documents, like Biome's configuration files. */
// biome-ignore lint/complexity/noStaticOnlyClass: groups JSON helpers
export default class Json {
    /** The value of a member of an object, like `files` of the configuration. */
    static member(node: Node | undefined, name: string): Node | undefined {
        if (node?.type !== "ObjectExpression") return;
        const property = node.properties.find(
            (property): property is NodeOf<"Property"> =>
                property.type === "Property" &&
                Nodes.key(property.key) === name,
        );
        return property?.value;
    }

    /** Whether a file is a Biome configuration, `biome.json` or `biome.jsonc`. */
    static biome(file: string): boolean {
        const name = Imports.segments(file).at(-1);
        return name === "biome.json" || name === "biome.jsonc";
    }

    /** The patterns of `files.includes` of a configuration. */
    static includes(program: Node): Node[] {
        const includes = Json.member(
            Json.member(Json.root(program), "files"),
            "includes",
        );
        return includes?.type === "ArrayExpression"
            ? includes.elements.filter(
                  (element): element is Node =>
                      element?.type === "StringLiteral",
              )
            : [];
    }

    /** The top level value of a JSON document. */
    static root(program: Node): Node | undefined {
        if (program.type === "Program") {
            const [statement] = program.body;
            return statement?.type === "ExpressionStatement"
                ? statement.expression
                : undefined;
        }
        return program;
    }
}
