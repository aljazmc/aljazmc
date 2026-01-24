/** Settings of monorepo, set in `monorepo.config.ts`. */
export interface Rules {
    /** The remote whose tags are checked and pushed. */
    remote: string;
    /** The branch tags must be in the history of, after a rebase. */
    branch: string;
}
