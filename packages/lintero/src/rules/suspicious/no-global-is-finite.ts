import { rule } from "../../rules.js";
import { globalNumberMethod } from "./no-global-is-nan.js";

export default rule({
    name: "noGlobalIsFinite",
    group: "suspicious",
    severity: "warn",
    recommended: true,
    fix: "unsafe",
    languages: ["js"],
    create: globalNumberMethod("isFinite"),
});
