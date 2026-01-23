import Equality from "./equality.js";
import Format from "./format.js";

/** A value that matches others by a rule instead of by equality, like `expect.any(Number)`. */
export abstract class Asymmetric<Sample = unknown> {
    protected readonly sample: Sample;
    /** Set for the `expect.not` variants, which match what the rule does not. */
    protected readonly inverse: boolean;

    constructor(sample: Sample, inverse = false) {
        this.sample = sample;
        this.inverse = inverse;
    }

    asymmetricMatch(other: unknown): boolean {
        return this.matches(other) !== this.inverse;
    }

    protected abstract matches(other: unknown): boolean;

    protected get prefix(): string {
        return this.inverse ? "Not" : "";
    }
}

type Constructor = abstract new (...args: never[]) => unknown;

/** `expect.any(Type)`: values of a type, primitives by their wrapper. */
export class Any extends Asymmetric<Constructor> {
    protected matches(other: unknown): boolean {
        const primitives = new Map<unknown, string>([
            [String, "string"],
            [Number, "number"],
            [Boolean, "boolean"],
            [BigInt, "bigint"],
            [Symbol, "symbol"],
            [Function, "function"],
        ]);
        const type = primitives.get(this.sample);
        if (type && typeof other === type) return true;
        if (this.sample === Object)
            return typeof other === "object" && other !== null;
        return other instanceof this.sample;
    }

    override toString(): string {
        return `Any<${this.sample.name}>`;
    }
}

/** `expect.anything()`: anything but null and undefined. */
export class Anything extends Asymmetric<undefined> {
    protected matches(other: unknown): boolean {
        return other !== null && other !== undefined;
    }

    override toString(): string {
        return "Anything";
    }
}

/** `expect.objectContaining(object)`: objects with at least these equal properties. */
export class ObjectContaining extends Asymmetric<Record<PropertyKey, unknown>> {
    protected matches(other: unknown): boolean {
        if (typeof other !== "object" || other === null) return false;
        return Reflect.ownKeys(this.sample).every(
            (key) =>
                key in other &&
                Equality.equals(
                    this.sample[key],
                    (other as Record<PropertyKey, unknown>)[key],
                ),
        );
    }

    override toString(): string {
        return `Object${this.prefix}Containing ${Format.inline(this.sample)}`;
    }
}

/** `expect.arrayContaining(array)`: arrays with these items, among others. */
export class ArrayContaining extends Asymmetric<unknown[]> {
    protected matches(other: unknown): boolean {
        return (
            Array.isArray(other) &&
            this.sample.every((item) =>
                other.some((value) => Equality.equals(item, value)),
            )
        );
    }

    override toString(): string {
        return `Array${this.prefix}Containing ${Format.inline(this.sample)}`;
    }
}

/** `expect.stringContaining(text)`: strings with this text in them. */
export class StringContaining extends Asymmetric<string> {
    protected matches(other: unknown): boolean {
        return typeof other === "string" && other.includes(this.sample);
    }

    override toString(): string {
        return `String${this.prefix}Containing ${JSON.stringify(this.sample)}`;
    }
}

/** `expect.stringMatching(pattern)`: strings matching a regular expression. */
export class StringMatching extends Asymmetric<RegExp> {
    protected matches(other: unknown): boolean {
        return typeof other === "string" && this.sample.test(other);
    }

    override toString(): string {
        return `String${this.prefix}Matching ${this.sample}`;
    }
}

/** `expect.closeTo(number, digits)`: numbers equal up to some decimal digits. */
export class CloseTo extends Asymmetric<number> {
    readonly #digits: number;

    constructor(sample: number, digits = 2, inverse = false) {
        super(sample, inverse);
        this.#digits = digits;
    }

    protected matches(other: unknown): boolean {
        if (typeof other !== "number") return false;
        if (other === this.sample) return true;
        return Math.abs(this.sample - other) < 10 ** -this.#digits / 2;
    }

    override toString(): string {
        return `Number${this.prefix}CloseTo ${this.sample} (${this.#digits} digits)`;
    }
}
