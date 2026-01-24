import type { Rules } from "./rules.js";

const rules: Rules = {
    remote: "origin",
    branch: "HEAD",
};

export default {
    ignore: [".git", "node_modules"],
    rules,
};
