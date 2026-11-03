import type { Css } from "@aljazmc/syntax";
import { values } from "../../analysis/css.js";
import { rule } from "../../rules.js";

/** Moves the decimal point of a number, like `0.85` by 2 to `85`, null for exponents. */
const shift = (literal: string, by: number): string | null => {
    if (/[eE]/.test(literal)) return null;
    const sign = /^[+-]/.test(literal) ? (literal[0] as string) : "";
    const unsigned = literal.slice(sign.length);
    const [integer = "", fraction = ""] = unsigned.split(".");
    const point = integer.length + by;
    const digits =
        "0".repeat(Math.max(0, -point)) +
        integer +
        fraction +
        "0".repeat(Math.max(0, point - integer.length - fraction.length));
    const at = Math.max(0, point);
    const whole = digits.slice(0, at).replace(/^0+/, "");
    const rest = digits.slice(at).replace(/0+$/, "");
    return sign + (whole || "0") + (rest ? `.${rest}` : "");
};

export default rule<{ notation?: "number" | "percentage" }>({
    name: "useConsistentLightnessNotation",
    group: "nursery",
    severity: "info",
    recommended: false,
    fix: "safe",
    languages: ["css"],
    options: { notation: "percentage" },
    create: (context) => ({
        CssDeclaration(node) {
            for (const value of values(node.value)) {
                if (value.type !== "Function") continue;
                const lower = value.name.toLowerCase();
                // the scale of lightness: 0 to 1 in OKLCH and OKLab, 0 to 100 in LCH and Lab
                const unit =
                    lower === "oklch" || lower === "oklab"
                        ? 2
                        : lower === "lch" || lower === "lab"
                          ? 0
                          : null;
                if (unit === null) continue;
                const comma = value.children.findIndex(
                    (child) => child.type === "Comma",
                );
                const first = value.children.slice(
                    0,
                    comma < 0 ? undefined : comma,
                );
                const relative =
                    first[0]?.type === "Identifier" &&
                    /^from$/i.test(first[0].value);
                const lightness: Css.Value | undefined = relative
                    ? first[2]
                    : first[0];
                if (context.options.notation === "number") {
                    if (lightness?.type !== "Percentage") continue;
                    const number = unit
                        ? shift(lightness.value, -unit)
                        : lightness.value;
                    context.report(
                        lightness,
                        "This lightness is written as a percentage instead of a number.",
                        number === null
                            ? undefined
                            : {
                                  message: `Use ${number} instead.`,
                                  edits: [
                                      {
                                          start: lightness.start,
                                          end: lightness.end,
                                          text: number,
                                      },
                                  ],
                              },
                    );
                } else {
                    if (lightness?.type !== "Number") continue;
                    const number = unit
                        ? shift(lightness.value, unit)
                        : lightness.value;
                    context.report(
                        lightness,
                        "This lightness is written as a number instead of a percentage.",
                        number === null
                            ? undefined
                            : {
                                  message: `Use ${number}% instead.`,
                                  edits: [
                                      {
                                          start: lightness.start,
                                          end: lightness.end,
                                          text: `${number}%`,
                                      },
                                  ],
                              },
                    );
                }
            }
        },
    }),
});
