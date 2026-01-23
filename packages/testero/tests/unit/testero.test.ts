import Arguments from "../../src/arguments.ts";
import Collector from "../../src/collector.ts";
import Each from "../../src/each.ts";
import { AssertionError } from "../../src/expect/assertion.ts";
import Equality from "../../src/expect/equality.ts";
import Expect from "../../src/expect/expect.ts";
import Format from "../../src/expect/format.ts";
import Mocks from "../../src/mock.ts";
import Runner, { type Result } from "../../src/runner.ts";

/** testero's own expect, Jest's is the global one here. */
const check = new Expect().create();

/** The message of the assertion error a call throws. */
const failure = (assertion: () => unknown): string => {
    try {
        assertion();
    } catch (error) {
        if (error instanceof AssertionError) return error.message;
        throw error;
    }
    throw new Error("the assertion passed");
};

/** Collects tests declared by a callback, then runs them. */
const run = async (
    declare: (collector: Collector) => void,
    settings: Partial<ConstructorParameters<typeof Runner>[0]> = {},
): Promise<Result[]> => {
    const collector = new Collector();
    declare(collector);
    collector.close();
    const { results } = await new Runner({ timeout: 100, ...settings }).run(
        collector.root,
    );
    return results;
};

const statuses = (results: Result[]) =>
    results.map(({ test, status }) => `${test.fullName}: ${status}`);

describe("format", () => {
    test("values print like Jest's pretty-format", () => {
        expect(Format.inline("a")).toBe('"a"');
        expect(Format.inline(-0)).toBe("-0");
        expect(Format.inline(10n)).toBe("10n");
        expect(Format.inline([1, { a: undefined }])).toBe(
            '[1, {"a": undefined}]',
        );
        expect(Format.inline(new Map([[1, "a"]]))).toBe('Map {1 => "a"}');
        expect(Format.inline(new Error("boom"))).toBe("[Error: boom]");
        expect(Format.inline(function named() {})).toBe("[Function named]");
        expect(Format.value({ a: [1] })).toBe('{\n  "a": [\n    1,\n  ],\n}');
    });

    test("cycles are marked", () => {
        const a: Record<string, unknown> = {};
        a.self = a;
        expect(Format.inline(a)).toBe('{"self": [Circular]}');
    });

    test("diffs mark expected and received lines", () => {
        expect(Format.diff({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(
            '- Expected\n+ Received\n\n  {\n    "a": 1,\n-   "b": 2,\n+   "b": 3,\n  }',
        );
    });
});

describe("equality", () => {
    test("loose equality ignores undefined properties, strict does not", () => {
        expect(Equality.equals({ a: 1, b: undefined }, { a: 1 })).toBe(true);
        expect(Equality.equals({ a: 1, b: undefined }, { a: 1 }, true)).toBe(
            false,
        );
        expect(Equality.equals([undefined], [])).toBe(false);
        // biome-ignore lint/suspicious/noSparseArray: a hole differs from undefined strictly
        expect(Equality.equals([, 1], [undefined, 1], true)).toBe(false);
    });

    test("classes count only strictly", () => {
        class Point {
            x = 1;
        }
        expect(Equality.equals(new Point(), { x: 1 })).toBe(true);
        expect(Equality.equals(new Point(), { x: 1 }, true)).toBe(false);
    });

    test("special objects compare by their values", () => {
        expect(Equality.equals(new Date(1), new Date(1))).toBe(true);
        expect(Equality.equals(/a/g, /a/i)).toBe(false);
        expect(Equality.equals(new Set([{ a: 1 }]), new Set([{ a: 1 }]))).toBe(
            true,
        );
        expect(
            Equality.equals(new Map([["a", [1]]]), new Map([["a", [1]]])),
        ).toBe(true);
        expect(Equality.equals(Number.NaN, Number.NaN)).toBe(true);
        expect(Equality.equals(0, -0)).toBe(false);
    });

    test("cycles are equal when they have the same shape", () => {
        const a: Record<string, unknown> = { name: "x" };
        const b: Record<string, unknown> = { name: "x" };
        a.self = a;
        b.self = b;
        expect(Equality.equals(a, b)).toBe(true);
    });

    test("matches checks a subset, recursively", () => {
        expect(
            Equality.matches({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 2 } }),
        ).toBe(true);
        expect(Equality.matches({ a: [1, 2] }, { a: [1] })).toBe(false);
    });
});

describe("expect", () => {
    test("passing matchers return nothing, failing ones throw", () => {
        expect(check(1).toBe(1)).toBeUndefined();
        expect(failure(() => check(1).toBe(2))).toBe(
            "expect(received).toBe(expected) // Object.is equality\n\nExpected: 2\nReceived: 1",
        );
        expect(failure(() => check(1).not.toBe(1))).toBe(
            "expect(received).not.toBe(expected) // Object.is equality\n\nExpected: not 1",
        );
    });

    test("toBe suggests toStrictEqual for equal objects", () => {
        expect(failure(() => check({ a: 1 }).toBe({ a: 1 }))).toContain(
            'replace "toBe" with "toStrictEqual"',
        );
    });

    test("deep matchers show a diff", () => {
        check({ a: [1, 2] }).toEqual({ a: [1, 2] });
        check({ a: 1, b: 2 }).toMatchObject({ a: 1 });
        expect(failure(() => check({ a: 1 }).toEqual({ a: 2 }))).toBe(
            'expect(received).toEqual(expected) // deep equality\n\n- Expected\n+ Received\n\n  {\n-   "a": 2,\n+   "a": 1,\n  }',
        );
    });

    test("the other matchers", () => {
        check(undefined).toBeUndefined();
        check(null).toBeNull();
        check(Number.NaN).toBeNaN();
        check("x").toBeTruthy();
        check(0).toBeFalsy();
        check(0).toBeDefined();
        check(2).toBeGreaterThan(1);
        check(2).toBeGreaterThanOrEqual(2);
        check(1).toBeLessThan(2);
        check(1).toBeLessThanOrEqual(1);
        check(0.1 + 0.2).toBeCloseTo(0.3);
        check(new TypeError()).toBeInstanceOf(Error);
        check([1, 2]).toContain(2);
        check("abc").toContain("b");
        check([{ a: 1 }]).toContainEqual({ a: 1 });
        check([1, 2]).toHaveLength(2);
        check({ a: { b: [1] } }).toHaveProperty("a.b[0]", 1);
        check({ a: 1 }).not.toHaveProperty("b");
        check("abc").toMatch(/b/);
        check("abc").toMatch("bc");
        expect(failure(() => check(1).toBeGreaterThan(2))).toBe(
            "expect(received).toBeGreaterThan(expected)\n\nExpected: > 2\nReceived:   1",
        );
        expect(failure(() => check([1]).toHaveLength(2))).toBe(
            "expect(received).toHaveLength(expected)\n\nExpected length: 2\nReceived length: 1\nReceived value:  [1]",
        );
    });

    test("toThrow checks what a function throws", () => {
        const thrower = () => {
            throw new TypeError("bad value");
        };
        check(thrower).toThrow();
        check(thrower).toThrow("bad");
        check(thrower).toThrow(/value$/);
        check(thrower).toThrow(TypeError);
        check(thrower).toThrow(new Error("bad value"));
        check(() => {}).not.toThrow();
        expect(failure(() => check(() => {}).toThrow())).toBe(
            "expect(received).toThrow()\n\nReceived function did not throw",
        );
        expect(failure(() => check(thrower).toThrow("good"))).toBe(
            'expect(received).toThrow(expected)\n\nExpected substring: "good"\nReceived message: "bad value"',
        );
    });

    test("matchers check their received values", () => {
        expect(failure(() => check(1).toMatch("1"))).toContain(
            "Matcher error: received value must be a string",
        );
    });

    test("resolves and rejects wait for promises", async () => {
        await check(Promise.resolve(1)).resolves.toBe(1);
        await check(Promise.reject(new Error("no"))).rejects.toThrow("no");
        await expect(check(Promise.resolve(1)).rejects.toBe(1)).rejects.toThrow(
            "Received promise resolved instead of rejected",
        );
    });

    test("asymmetric matchers match by a rule", () => {
        check({ id: 7, name: "a", tags: ["x", "y"] }).toEqual({
            id: check.any(Number),
            name: check.stringMatching(/^a/),
            tags: check.arrayContaining(["y"]),
        });
        check({ a: 1, b: 2 }).toEqual(check.objectContaining({ a: 1 }));
        check("hello").toEqual(check.stringContaining("ell"));
        check(null).not.toEqual(check.anything());
        check(0.301).toEqual(check.closeTo(0.3, 2));
        check({ a: 1 }).toEqual(check.not.objectContaining({ b: 1 }));
    });

    test("extend adds matchers", () => {
        check.extend({
            toBeEven(received: number) {
                return {
                    pass: received % 2 === 0,
                    message: () => `expected ${received} to be even`,
                };
            },
        });
        check(2).toBeEven();
        expect(failure(() => check(3).toBeEven())).toBe(
            "expected 3 to be even",
        );
    });

    test("assertion counts", () => {
        const counting = new Expect();
        const local = counting.create();
        counting.reset();
        local.assertions(2);
        local(1).toBe(1);
        expect(counting.verify()[0]?.message).toContain(
            "Expected 2 assertions to be called but received 1 assertion call.",
        );
        counting.reset();
        local.hasAssertions();
        expect(counting.verify()).toHaveLength(1);
    });
});

describe("mocks", () => {
    test("mock functions record calls and results", () => {
        const fn = Mocks.fn((a: number, b: number) => a + b);
        expect(fn(1, 2)).toBe(3);
        expect(fn.mock.calls).toEqual([[1, 2]]);
        expect(fn.mock.results).toEqual([{ type: "return", value: 3 }]);
        check(fn).toHaveBeenCalledWith(1, 2);
        check(fn).toHaveBeenCalledTimes(1);
        check(fn).toHaveReturnedWith(3);
        expect(failure(() => check(fn).toHaveBeenCalledWith(2))).toBe(
            "expect(received).toHaveBeenCalledWith(...expected)\n\nExpected: 2\nReceived\n  1: 1, 2\n\nNumber of calls: 1",
        );
    });

    test("implementations, once and in order", async () => {
        const fn = Mocks.fn()
            .mockReturnValue("default")
            .mockReturnValueOnce("first");
        expect([fn(), fn()]).toEqual(["first", "default"]);
        fn.mockResolvedValueOnce("later");
        await expect(fn()).resolves.toBe("later");
        fn.mockReset();
        expect(fn()).toBeUndefined();
        expect(fn.mock.calls).toHaveLength(1);
        fn.mockClear();
        expect(fn.mock.calls).toHaveLength(0);
    });

    test("thrown errors are results too", () => {
        const fn = Mocks.fn(() => {
            throw new Error("x");
        });
        expect(() => fn()).toThrow("x");
        expect(fn.mock.results[0]?.type).toBe("throw");
    });

    test("spies call through until restored", () => {
        const object = { greet: (name: string) => `hi ${name}` };
        const spy = Mocks.spyOn(object, "greet");
        expect(object.greet("a")).toBe("hi a");
        check(spy).toHaveBeenCalledWith("a");
        spy.mockReturnValue("mocked");
        expect(object.greet("b")).toBe("mocked");
        spy.mockRestore();
        expect(object.greet("c")).toBe("hi c");
        expect(Mocks.isMockFunction(object.greet)).toBe(false);
    });

    test("calls on non mocks are matcher errors", () => {
        expect(failure(() => check(() => {}).toHaveBeenCalled())).toContain(
            "received value must be a mock or spy function",
        );
    });
});

describe("each", () => {
    test("titles from printf placeholders and object properties", () => {
        expect(Each.title("%s + %d = %i (%#)", ["a", 1.5, 2.5], 3)).toBe(
            "a + 1.5 = 2 (3)",
        );
        expect(Each.title("$a and $b.c", [{ a: "x", b: { c: [1] } }], 0)).toBe(
            "x and [1]",
        );
        expect(Each.title("%p %j %%", [{ a: 1 }, [1]], 0)).toBe(
            '{"a": 1} [1] %',
        );
    });

    test("rows from arrays, values and tagged templates", () => {
        expect(
            Each.rows(
                [
                    [1, 2],
                    [3, 4],
                ],
                [],
            ),
        ).toEqual([
            [1, 2],
            [3, 4],
        ]);
        expect(Each.rows([1, 2], [])).toEqual([[1], [2]]);
        const table = Object.assign(["a | b\n", "|", ""], {
            raw: ["a | b\n", "|", ""],
        }) as unknown as TemplateStringsArray;
        expect(Each.rows(table, [1, 2])).toEqual([[{ a: 1, b: 2 }]]);
    });
});

describe("runner", () => {
    test("hooks run around tests from the outside in", async () => {
        const calls: string[] = [];
        await run(({ describe, test, hook }) => {
            hook("beforeAll")(() => void calls.push("beforeAll"));
            hook("beforeEach")(() => void calls.push("beforeEach"));
            hook("afterEach")(() => void calls.push("afterEach"));
            hook("afterAll")(() => void calls.push("afterAll"));
            describe("inner", () => {
                hook("beforeEach")(() => void calls.push("inner beforeEach"));
                hook("afterEach")(() => void calls.push("inner afterEach"));
                test("a", () => void calls.push("test a"));
            });
            test("b", () => void calls.push("test b"));
        });
        expect(calls).toEqual([
            "beforeAll",
            "beforeEach",
            "inner beforeEach",
            "test a",
            "inner afterEach",
            "afterEach",
            "beforeEach",
            "test b",
            "afterEach",
            "afterAll",
        ]);
    });

    test("only, skip and todo", async () => {
        const results = await run(({ describe, test }) => {
            test("a", () => {});
            test.only("b", () => {});
            test.skip("c", () => {});
            test.todo("d");
            describe.only("e", () => {
                test("f", () => {});
            });
        });
        expect(statuses(results)).toEqual([
            "a: skipped",
            "b: passed",
            "c: skipped",
            "d: todo",
            "e f: passed",
        ]);
    });

    test("failures, timeouts, done callbacks and failing hooks", async () => {
        const results = await run(({ describe, test, hook }) => {
            test("throws", () => {
                throw new Error("boom");
            });
            test("rejects", async () => {
                throw new Error("later");
            });
            test("times out", () => new Promise(() => {}), 20);
            test("done", (done) => {
                setTimeout(done, 1);
            });
            test("done with an error", (done) => done(new Error("failed")));
            describe("setup", () => {
                hook("beforeAll")(() => {
                    throw new Error("no setup");
                });
                test("never runs", () => {});
            });
        });
        expect(statuses(results)).toEqual([
            "throws: failed",
            "rejects: failed",
            "times out: failed",
            "done: passed",
            "done with an error: failed",
            "setup never runs: failed",
        ]);
        expect(String(results[2]?.errors[0])).toContain(
            "Exceeded timeout of 20 ms",
        );
        expect(String(results[5]?.errors[0])).toContain("no setup");
    });

    test("name patterns select tests by their full name", async () => {
        const results = await run(
            ({ describe, test }) => {
                describe("math", () => {
                    test("adds", () => {});
                    test("subtracts", () => {});
                });
            },
            { namePattern: /math add/ },
        );
        expect(statuses(results)).toEqual([
            "math adds: passed",
            "math subtracts: skipped",
        ]);
    });

    test("each declares a test per row", async () => {
        const results = await run(({ test }) => {
            test.each([
                [1, 2, 3],
                [2, 2, 4],
            ])("%i + %i = %i", (a, b, sum) => {
                check((a as number) + (b as number)).toBe(sum);
            });
        });
        expect(statuses(results)).toEqual([
            "1 + 2 = 3: passed",
            "2 + 2 = 4: passed",
        ]);
    });

    test("tests cannot be declared while tests run", () => {
        const collector = new Collector();
        collector.close();
        expect(() => collector.test("late", () => {})).toThrow(
            "while tests run",
        );
    });
});

describe("arguments", () => {
    test("patterns, names and flags like Jest's", () => {
        const args = new Arguments([
            "unit",
            "-t",
            "adds",
            "--bail",
            "--testTimeout=50",
        ]);
        expect(args.patterns).toEqual(["unit"]);
        expect(args.namePattern).toEqual(/adds/);
        expect(args.rules).toEqual({ bail: true, testTimeout: 50 });
        expect(() => new Arguments(["--nope"])).toThrow(
            "Unknown option --nope.",
        );
    });
});
