import type { Rules } from "./rules.js";

const rules: Rules = {
    remote: "origin",
    branch: "HEAD",
    packages: [],
    bump: {
        feat: "minor",
        chore: "patch",
        docs: "patch",
        fix: "patch",
        perf: "patch",
        revert: "patch",
    },
    message: "version: update {name} to v{version}",
    tag: "{name}@{version}",
    rootTag: "v{version}",
};

export default {
    ignore: [".git", "node_modules"],
    rules,
};
