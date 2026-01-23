import {
    type Attached,
    type Comment,
    type Node,
    Walker,
} from "@aljazmc/syntax";
import Nodes from "./nodes.js";

interface Context {
    comment: Comment;
    enclosing: Node;
    preceding?: Node;
    following?: Node;
}

/** Attaches comments to the nodes around them, after Prettier's attach algorithm. */
export default class Comments {
    /** Nodes that cannot hold comments, their comments go to neighbours. */
    static readonly #detached = new Set(["EmptyStatement", "TemplateElement"]);

    readonly #source: string;
    readonly #children = new Map<Node, Node[]>();

    constructor(source: string) {
        this.#source = source;
    }

    attach(root: Node, comments: Comment[]): void {
        const contexts = comments.map((comment) => this.#locate(root, comment));
        let ties: Context[] = [];

        for (const [index, context] of contexts.entries()) {
            const { comment, enclosing, preceding, following } = context;

            if (this.#ownLine(contexts, index)) {
                if (this.#ownLineHandler(context)) continue;
                if (following) this.#add(following, comment, "leading");
                else if (preceding) this.#add(preceding, comment, "trailing");
                else this.#add(enclosing, comment, "dangling");
            } else if (this.#endOfLine(contexts, index)) {
                if (this.#endOfLineHandler(context)) continue;
                if (preceding) this.#add(preceding, comment, "trailing");
                else if (following) this.#add(following, comment, "leading");
                else this.#add(enclosing, comment, "dangling");
            } else {
                if (this.#remainingHandler(context)) continue;
                if (preceding && following) {
                    if (
                        ties.length > 0 &&
                        ties.at(-1)?.following !== following
                    ) {
                        this.#breakTies(ties);
                        ties = [];
                    }
                    ties.push(context);
                } else if (preceding) this.#add(preceding, comment, "trailing");
                else if (following) this.#add(following, comment, "leading");
                else this.#add(enclosing, comment, "dangling");
            }
        }

        this.#breakTies(ties);
    }

    /** Comments between the same nodes are trailing up to a gap of more than whitespace or `(`. */
    #breakTies(ties: Context[]): void {
        const [first] = ties;
        if (!first?.preceding || !first.following) return;
        let gapEnd = first.following.start;
        let leadingFrom = ties.length;
        for (; leadingFrom > 0; leadingFrom--) {
            const { comment } = ties[leadingFrom - 1] as Context;
            if (
                /^[^\S\n]*\(?[^\S\n]*$/.test(
                    this.#source.slice(comment.end, gapEnd),
                )
            )
                gapEnd = comment.start;
            else break;
        }
        for (const [index, { comment }] of ties.entries()) {
            if (index < leadingFrom)
                this.#add(first.preceding, comment, "trailing");
            else this.#add(first.following, comment, "leading");
        }
    }

    #add(node: Node, comment: Comment, placement: Attached["placement"]): void {
        node.comments ??= [];
        node.comments.push({ ...comment, placement });
    }

    #childrenOf(node: Node): Node[] {
        let children = this.#children.get(node);
        if (!children) {
            children = Walker.children(node).filter(
                (child) =>
                    !Comments.#detached.has(child.type) &&
                    (child.end > child.start || child.type === "JSXText"),
            );
            this.#children.set(node, children);
        }
        return children;
    }

    #locate(root: Node, comment: Comment): Context {
        let enclosing = root;
        let preceding: Node | undefined;
        let following: Node | undefined;

        for (;;) {
            let inner: Node | undefined;
            preceding = undefined;
            following = undefined;
            for (const child of this.#childrenOf(enclosing)) {
                if (child.start <= comment.start && comment.end <= child.end) {
                    inner = child;
                    break;
                }
                if (child.end <= comment.start) preceding = child;
                else if (comment.end <= child.start && !following)
                    following = child;
            }
            if (!inner) break;
            enclosing = inner;
        }

        const context: Context = { comment, enclosing };
        if (preceding) context.preceding = preceding;
        if (following) context.following = following;
        return context;
    }

    /** Whether the comment, or the first of the comments before it on its line, starts a line. */
    #ownLine(contexts: Context[], index: number): boolean {
        const { comment, preceding } = contexts[index] as Context;
        let start = comment.start;
        if (preceding) {
            for (let previous = index - 1; previous >= 0; previous--) {
                const context = contexts[previous] as Context;
                if (
                    context.preceding !== preceding ||
                    /[\S\n]/.test(
                        this.#source.slice(context.comment.end, start),
                    )
                )
                    break;
                start = context.comment.start;
            }
        }
        return /(?:^|\n)[^\S\n]*$/.test(this.#source.slice(0, start));
    }

    /** Whether the comment, or the last of the comments after it on its line, ends a line. */
    #endOfLine(contexts: Context[], index: number): boolean {
        const { comment, following } = contexts[index] as Context;
        let end = comment.end;
        if (following) {
            for (let next = index + 1; next < contexts.length; next++) {
                const context = contexts[next] as Context;
                if (
                    context.following !== following ||
                    /[\S\n]/.test(
                        this.#source.slice(end, context.comment.start),
                    )
                )
                    break;
                end = context.comment.end;
            }
        }
        return /^[^\S\n\r]*(?:\r?\n|$)/.test(this.#source.slice(end));
    }

    #nextCharacter(index: number): string {
        const match = /^(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*(\S)/.exec(
            this.#source.slice(index),
        );
        return match?.[1] ?? "";
    }

    // Handlers, a subset of Prettier's

    #ownLineHandler(context: Context): boolean {
        return (
            this.#ifStatement(context, true) ||
            this.#conditional(context) ||
            this.#memberExpression(context) ||
            this.#blockEnd(context) ||
            this.#emptyParameters(context)
        );
    }

    #endOfLineHandler(context: Context): boolean {
        return (
            this.#ifStatement(context, false) ||
            this.#conditional(context) ||
            this.#emptyParameters(context) ||
            this.#propertyValue(context)
        );
    }

    #remainingHandler(context: Context): boolean {
        return (
            this.#ifStatement(context, false) ||
            this.#conditional(context) ||
            this.#emptyParameters(context) ||
            this.#propertyValue(context)
        );
    }

    /** `if (a /* comment *\/) {}`, comments before `else` and before the consequent block. */
    #ifStatement(
        { comment, enclosing, preceding, following }: Context,
        ownLine: boolean,
    ): boolean {
        if (
            (enclosing.type !== "IfStatement" &&
                enclosing.type !== "WhileStatement") ||
            !following
        )
            return false;
        if (preceding && this.#nextCharacter(comment.end) === ")") {
            this.#add(preceding, comment, "trailing");
            return true;
        }
        if (enclosing.type !== "IfStatement") return false;
        if (
            preceding === enclosing.consequent &&
            following === enclosing.alternate
        ) {
            if (preceding.type === "BlockStatement")
                this.#add(preceding, comment, "trailing");
            else this.#add(enclosing, comment, "dangling");
            return true;
        }
        if (following.type === "BlockStatement" && !ownLine) {
            if (following.body.length > 0)
                this.#add(following.body[0] as Node, comment, "leading");
            else this.#add(following, comment, "dangling");
            return true;
        }
        return false;
    }

    /** Comments after `?` or `:` lead the branch, unless on the line of the node before. */
    #conditional({
        comment,
        enclosing,
        preceding,
        following,
    }: Context): boolean {
        if (
            (enclosing.type !== "ConditionalExpression" &&
                enclosing.type !== "TSConditionalType") ||
            !following
        )
            return false;
        if (
            preceding &&
            !/[\r\n]/.test(this.#source.slice(preceding.end, comment.start))
        )
            return false;
        this.#add(following, comment, "leading");
        return true;
    }

    /** Comments in member chains go before the `.property`. */
    #memberExpression({ comment, enclosing, following }: Context): boolean {
        if (!Nodes.isMember(enclosing) || following?.type !== "Identifier")
            return false;
        this.#add(enclosing, comment, "leading");
        return true;
    }

    /** The last comments in a block go after its last statement. */
    #blockEnd({ comment, enclosing, preceding, following }: Context): boolean {
        if (following || !preceding) return false;
        if (
            ![
                "ClassBody",
                "BlockStatement",
                "Program",
                "TSModuleBlock",
                "TSInterfaceBody",
                "ObjectExpression",
                "SwitchCase",
                "StaticBlock",
            ].includes(enclosing.type)
        )
            return false;
        this.#add(preceding, comment, "trailing");
        return true;
    }

    /** `function f(/* comment *\/) {}` keeps the comment inside the parentheses. */
    #emptyParameters({ comment, enclosing }: Context): boolean {
        const fn =
            enclosing.type === "MethodDefinition" ? enclosing.value : enclosing;
        if (
            !(Nodes.isFunction(fn) || fn.type === "FunctionDeclaration") ||
            fn.params.length > 0
        )
            return false;
        const open = this.#source.lastIndexOf("(", comment.start);
        const close = this.#source.indexOf(")", comment.end);
        if (open < fn.start || close < 0) return false;
        if (
            !/^\s*$/.test(this.#source.slice(comment.end, close)) ||
            !/^\s*$/.test(this.#source.slice(open + 1, comment.start))
        )
            return false;
        this.#add(fn, comment, "dangling");
        return true;
    }

    /** Comments between an object key and its value go before the value. */
    #propertyValue({
        comment,
        enclosing,
        preceding,
        following,
    }: Context): boolean {
        if (
            (enclosing.type !== "Property" &&
                enclosing.type !== "PropertyDefinition") ||
            preceding !== enclosing.key ||
            !following ||
            following !== enclosing.value
        )
            return false;
        this.#add(following, comment, "leading");
        return true;
    }
}
