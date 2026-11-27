import { type Node, Walker } from "@aljazmc/syntax";

/** A misplaced `super`, reported like Biome's parser and syntax rules. */
export interface SuperError {
    position: number;
    category: "parse" | "syntax/correctness/noSuperWithoutExtends";
    message: string;
}

/** A class, with its extends clause. */
type Class = Extract<Node, { type: "ClassDeclaration" | "ClassExpression" }>;

const outside =
    "`super` is only valid inside of a class constructor of a subclass.";
const withoutExtends = "super() is only valid in derived class constructors";

/**
 * Finds `super` where Biome rejects it: a `super()` call outside a
 * constructor, looking through arrow functions, is an error of the parser,
 * and `super` in a class without `extends` one of its syntax rules. Biome
 * lints the rest of the file all the same.
 */
export default function superErrors(program: Node): SuperError[] {
    const errors: SuperError[] = [];
    /**
     * Visits a node in the class it is in, if any, and the class whose
     * constructor it is in, null in other functions, fields and blocks.
     */
    const visit = (
        node: Node,
        inClass: Class | undefined,
        constructorOf: Class | null,
    ): void => {
        switch (node.type) {
            case "ClassDeclaration":
            case "ClassExpression":
                if (node.superClass)
                    visit(node.superClass, inClass, constructorOf);
                for (const member of node.body.body) {
                    if (
                        member.type === "MethodDefinition" &&
                        member.kind === "constructor"
                    ) {
                        for (const child of Walker.children(member.value))
                            visit(child, node, node);
                        continue;
                    }
                    for (const child of Walker.children(member))
                        visit(child, node, null);
                }
                return;
            case "FunctionDeclaration":
            case "FunctionExpression":
                for (const child of Walker.children(node))
                    visit(child, inClass, null);
                return;
            case "CallExpression":
                if (node.callee.type === "Super") {
                    if (!constructorOf)
                        errors.push({
                            position: node.callee.start,
                            category: "parse",
                            message: outside,
                        });
                    else if (!constructorOf.superClass)
                        errors.push({
                            position: node.callee.start,
                            category:
                                "syntax/correctness/noSuperWithoutExtends",
                            message: withoutExtends,
                        });
                    for (const argument of node.arguments)
                        visit(argument, inClass, constructorOf);
                    return;
                }
                break;
            case "Super":
                if (inClass && !inClass.superClass)
                    errors.push({
                        position: node.start,
                        category: "syntax/correctness/noSuperWithoutExtends",
                        message: withoutExtends,
                    });
                return;
        }
        for (const child of Walker.children(node))
            visit(child, inClass, constructorOf);
    };
    visit(program, undefined, null);
    return errors;
}
