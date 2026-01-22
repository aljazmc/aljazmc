import { rule } from "../../rules.js";

/** The significant digits of a decimal number, without dot and exponent. */
const digits = (text: string): string => {
    const [mantissa = ""] = text.toLowerCase().split("e");
    return mantissa.replace(".", "").replace(/^0+/, "").replace(/0+$/, "");
};

const losesPrecision = (raw: string): boolean => {
    const clean = raw.replace(/_/g, "");
    if (clean.endsWith("n")) return false;

    if (/^0[xob]/i.test(clean)) {
        const exact = BigInt(clean);
        const stored = Number(clean);
        return !Number.isFinite(stored) || BigInt(stored) !== exact;
    }
    if (/^0\d/.test(clean)) return false;

    const requested = digits(clean);
    if (requested.length === 0) return false;
    if (requested.length > 100) return true;
    const value = Number(clean);
    if (!Number.isFinite(value)) return true;
    return digits(value.toPrecision(requested.length)) !== requested;
};

export default rule({
    name: "noPrecisionLoss",
    group: "correctness",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["js"],
    create: (context) => ({
        NumericLiteral(node) {
            if (losesPrecision(node.raw))
                context.report(
                    node,
                    "This number literal will lose precision at runtime.",
                );
        },
    }),
});
