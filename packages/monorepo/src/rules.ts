/** How much a commit changes a version, by semantic versioning. */
export type Level = "major" | "minor" | "patch";

/** Settings of monorepo, set in `monorepo.config.ts`. */
export interface Rules {
    /** The remote whose tags are checked and pushed. */
    remote: string;
    /** The branch tags must be in the history of, after a rebase. */
    branch: string;
    /**
     * Roots of the packages versioned on their own, like `packages/*`, or `.`
     * for the package.json at the root of the repository.
     */
    packages: string[];
    /**
     * The level each type of conventional commit bumps, others do not bump.
     * `false` turns off a type the defaults bump, as settings are merged.
     */
    bump: Record<string, Level | false>;
    /** The commit message of a version, `{name}` and `{version}` are replaced. */
    message: string;
    /** The tag of a version of a package, a git tag name has no spaces. */
    tag: string;
    /** The tag of a version of the root package.json. */
    rootTag: string;
}
