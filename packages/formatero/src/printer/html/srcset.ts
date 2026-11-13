import {
    type IR,
    ifGroupBreaks,
    ifGroupFitsOnLine,
    softLineOrSpace,
} from "./ir.js";

interface Candidate {
    url: string;
    descriptor?: string;
}

/** The kind of a descriptor like `100w`, `2x` or `50h`, undefined when invalid. */
function kind(descriptor: string): "w" | "x" | "h" | undefined {
    const unit = descriptor.at(-1);
    const number = descriptor.slice(0, -1);
    // widths and heights are positive integers
    if (unit === "w" || unit === "h")
        return /^[0-9]*[1-9][0-9]*$/.test(number) ? unit : undefined;
    if (unit === "x")
        return /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(
            number,
        )
            ? unit
            : undefined;
    return undefined;
}

function parse(value: string): Candidate[] | undefined {
    const candidates: Candidate[] = [];
    let unit: string | undefined;
    let position = 0;
    const whitespace = (char: string | undefined) =>
        char === " " || char === "\t" || char === "\n" || char === "\r";
    while (position < value.length) {
        if (whitespace(value[position]) || value[position] === ",") {
            position++;
            continue;
        }
        const urlStart = position;
        while (position < value.length && !whitespace(value[position]))
            position++;
        let urlEnd = position;
        if (value[urlEnd - 1] === ",") {
            while (urlEnd > urlStart && value[urlEnd - 1] === ",") urlEnd--;
            candidates.push({ url: value.slice(urlStart, urlEnd) });
            continue;
        }
        while (position < value.length && whitespace(value[position]))
            position++;
        const descriptorStart = position;
        while (position < value.length && value[position] !== ",") position++;
        let descriptorEnd = position;
        while (
            descriptorEnd > descriptorStart &&
            whitespace(value[descriptorEnd - 1])
        )
            descriptorEnd--;
        const candidate: Candidate = { url: value.slice(urlStart, urlEnd) };
        if (descriptorEnd > descriptorStart) {
            const descriptor = value.slice(descriptorStart, descriptorEnd);
            const descriptorKind = kind(descriptor);
            if (!descriptorKind) return undefined;
            unit ??= descriptorKind;
            if (unit !== descriptorKind) return undefined;
            candidate.descriptor = descriptor;
        }
        candidates.push(candidate);
    }
    return candidates.length > 0 ? candidates : undefined;
}

/** The digits before the decimal point, or all but the unit. */
const integerLength = (descriptor: string) => {
    const dot = descriptor.indexOf(".");
    return dot >= 0 ? dot : Math.max(descriptor.length - 1, 0);
};

/** The candidates of a `srcset`, one per line when they break, descriptors aligned. */
export function srcset(value: string): IR | undefined {
    const candidates = parse(value);
    if (!candidates) return undefined;
    const widestUrl = Math.max(...candidates.map(({ url }) => url.length));
    const widestInteger = Math.max(
        0,
        ...candidates.flatMap(({ descriptor }) =>
            descriptor ? [integerLength(descriptor)] : [],
        ),
    );
    const parts: IR[] = [];
    for (const [index, { url, descriptor }] of candidates.entries()) {
        if (index > 0) parts.push(",", softLineOrSpace);
        parts.push(url);
        if (descriptor) {
            const padding =
                widestUrl -
                url.length +
                1 +
                widestInteger -
                integerLength(descriptor);
            parts.push(
                ifGroupBreaks(" ".repeat(padding)),
                ifGroupFitsOnLine(" "),
                descriptor,
            );
        }
    }
    return parts;
}
