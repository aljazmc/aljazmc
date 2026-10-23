import type { Node } from "@aljazmc/syntax";
import { rule } from "../../rules.js";

/** ISO 639-1 languages, ISO 15924 scripts and ISO 3166-1 regions Biome knows. */
const languages = new Set(
    `
    aa ab af am an ar as ay az ba be bg bh bi bn bo br ca co cs cy da de dz
    el en eo es et eu fa fi fj fo fr fy ga gd gl gn gu gv ha he hi hr ht hu
    hy ia id ie ii ik in io is it iu iw ja ji jv ka kk kl km kn ko ks ku ky
    la li ln lo lt lv mg mi mk ml mn mo mr ms mt my na nb ne nl nn no oc om
    or pa pl ps pt qu rm rn ro ru rw sa sd sg sh si sk sl sm sn so sq sr ss
    st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ug uk ur uz vi vo wa
    wo xh yi yo zh zu
`
        .trim()
        .split(/\s+/),
);
const scripts = new Set(
    `
    Latn Cyrl Arab Hans Hant Grek Hebr Deva Beng Guru Gujr Orya Taml Telu
    Mlym Sinh Thai Laoo Tibt Mymr Hang Ethi Khmr Hira Kana Zyyy Armn
`
        .trim()
        .split(/\s+/),
);
const regions = new Set(
    `
    AD AE AF AG AI AL AM AN AO AQ AR AS AT AU AW AZ BA BB BD BE BF BG BH BI
    BJ BL BM BN BO BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR
    CU CV CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR
    GA GB GD GE GH GI GL GM GN GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM
    IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC
    LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MR MS MT
    MU MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK
    PL PM PN PR PT PW PY QA RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM
    SN SO SR ST SV SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG
    US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`
        .trim()
        .split(/\s+/),
);

/** Whether a tag is a language with an optional script and region, like `en`, `zh-Hant-TW` or `en-GB`. */
const valid = (tag: string): boolean => {
    const [language = "", ...rest] = tag.split("-");
    if (!languages.has(language)) return false;
    if (rest[0] !== undefined && scripts.has(rest[0])) rest.shift();
    if (rest[0] !== undefined && regions.has(rest[0])) rest.shift();
    return rest.length === 0;
};

export default rule({
    name: "useValidLang",
    group: "a11y",
    severity: "error",
    recommended: true,
    fix: "none",
    languages: ["jsx"],
    create: (context) => ({
        JSXElement(node) {
            if (node.name !== "html") return;
            const lang = node.attributes.find(
                (attribute) =>
                    attribute.type === "JSXAttribute" &&
                    attribute.name === "lang",
            );
            if (lang?.type !== "JSXAttribute" || !lang.value) return;
            let value: Node | null = lang.value;
            if (value.type === "JSXExpressionContainer")
                value = value.expression;
            const text =
                value?.type === "StringLiteral"
                    ? value.raw.slice(1, -1)
                    : value?.type === "TemplateLiteral" &&
                        value.expressions.length === 0
                      ? value.quasis[0]?.raw
                      : undefined;
            if (text !== undefined && !valid(text))
                context.report(
                    lang.value,
                    "Provide a valid value for the lang attribute.",
                );
        },
    }),
});
