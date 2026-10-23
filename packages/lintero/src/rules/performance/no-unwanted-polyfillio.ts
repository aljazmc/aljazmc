import Imports from "../../analysis/imports.js";
import { rule } from "../../rules.js";

/** Features Next.js polyfills already. */
const polyfilled = new Set([
    "Array.prototype.@@iterator",
    "Array.prototype.at",
    "Array.prototype.copyWithin",
    "Array.prototype.fill",
    "Array.prototype.find",
    "Array.prototype.findIndex",
    "Array.prototype.flatMap",
    "Array.prototype.flat",
    "Array.from",
    "Array.prototype.includes",
    "Array.of",
    "Function.prototype.name",
    "fetch",
    "Map",
    "Number.EPSILON",
    "Number.Epsilon",
    "Number.isFinite",
    "Number.isNaN",
    "Number.isInteger",
    "Number.isSafeInteger",
    "Number.MAX_SAFE_INTEGER",
    "Number.MIN_SAFE_INTEGER",
    "Number.parseFloat",
    "Number.parseInt",
    "Object.assign",
    "Object.entries",
    "Object.fromEntries",
    "Object.getOwnPropertyDescriptor",
    "Object.getOwnPropertyDescriptors",
    "Object.hasOwn",
    "Object.is",
    "Object.keys",
    "Object.values",
    "Reflect",
    "Set",
    "Symbol",
    "Symbol.asyncIterator",
    "String.prototype.codePointAt",
    "String.prototype.endsWith",
    "String.fromCodePoint",
    "String.prototype.includes",
    "String.prototype.@@iterator",
    "String.prototype.padEnd",
    "String.prototype.padStart",
    "String.prototype.repeat",
    "String.raw",
    "String.prototype.startsWith",
    "String.prototype.trimEnd",
    "String.prototype.trimStart",
    "URL",
    "URL.prototype.toJSON",
    "URLSearchParams",
    "WeakMap",
    "WeakSet",
    "Promise",
    "Promise.prototype.finally",
    "es2015",
    "es2016",
    "es2017",
    "es2018",
    "es2019",
    "es5",
    "es6",
    "es7",
]);

export default rule({
    name: "noUnwantedPolyfillio",
    group: "performance",
    severity: "warn",
    recommended: false,
    fix: "none",
    languages: ["jsx"],
    domains: { next: "recommended" },
    create: (context) => ({
        JSXElement(node) {
            if (
                node.name !== "script" &&
                Imports.of(context, node)?.source !== "next/script"
            )
                return;
            const src = node.attributes.find(
                (attribute) =>
                    attribute.type === "JSXAttribute" &&
                    attribute.name === "src",
            );
            if (
                src?.type !== "JSXAttribute" ||
                src.value?.type !== "StringLiteral"
            )
                return;
            const url = src.value.raw.slice(1, -1);
            if (
                !url.startsWith("https://polyfill.io/v3/") &&
                !url.startsWith("https://cdn.polyfill.io/v2/")
            )
                return;
            const features = new URLSearchParams(url.split("?")[1] ?? "").get(
                "features",
            );
            const unwanted = features
                ?.split(",")
                .some((feature) => polyfilled.has(feature));
            if (unwanted)
                context.report(
                    src.value,
                    "Prevent duplicate polyfills from Polyfill.io",
                );
        },
    }),
});
