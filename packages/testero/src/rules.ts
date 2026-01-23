/** Jest like settings, set in `testero.config.ts`. */
export interface Rules {
    /** Globs of the test files in order, the last match decides, "!" excludes. */
    testMatch: string[];
    /** Milliseconds a test or a hook may take. */
    testTimeout: number;
    /** Stops after the first test file that fails. */
    bail: boolean;
    /** Lists every test, not only the files. */
    verbose: boolean;
    /** Succeeds when there are no test files. */
    passWithNoTests: boolean;
    /** Clears the calls of every mock before each test. */
    clearMocks: boolean;
    /** Also removes the implementations of every mock before each test. */
    resetMocks: boolean;
    /** Restores every spy to the original before each test. */
    restoreMocks: boolean;
}
