import Config from "@aljazmc/config";
import defaults from "../../src/config.ts";
import Lintero from "../../src/lintero.ts";
import type { Rules } from "../../src/rules.ts";

const settings = (rules: object = {}): Rules =>
    Config.merge(defaults.rules, rules);

const lint = (source: string, file = "a.ts", rules: object = {}) =>
    new Lintero(settings(rules))
        .lint(source, file)
        .map((d) => `${d.line}:${d.column} ${d.category} ${d.message}`);

/** Only one rule, given as `group/rule`. */
const only = (rule: string, level: unknown = "on") => {
    const [group, name] = rule.split("/") as [string, string];
    return { preset: "none", [group]: { [name]: level } };
};

/** Examples of Biome's documentation and edge cases, with the diagnostics Biome 2.6 reports for them. */
const biome: {
    rule: string;
    file: string;
    options?: object;
    source: string;
    expected: string[];
}[] = [
    {
        rule: "a11y/noAccessKey",
        file: "a.jsx",
        source: '<input type="submit" accessKey="s" value="Submit" />\n',
        expected: ["1:22 Avoid the accessKey attribute."],
    },
    {
        rule: "a11y/noAccessKey",
        file: "a.jsx",
        source: '<a href="https://webaim.org/" accessKey="w">WebAIM.org</a>\n',
        expected: ["1:31 Avoid the accessKey attribute."],
    },
    {
        rule: "a11y/noAccessKey",
        file: "a.jsx",
        source: '<button accessKey="n">Next</button>\n',
        expected: ["1:9 Avoid the accessKey attribute."],
    },
    {
        rule: "a11y/noAriaHiddenOnFocusable",
        file: "a.jsx",
        source: '<div aria-hidden="true" tabIndex="0" />\n',
        expected: ['1:1 Incorrect use of aria-hidden="true" detected.'],
    },
    {
        rule: "a11y/noAriaHiddenOnFocusable",
        file: "a.jsx",
        source: '<a href="/" aria-hidden="true" />\n',
        expected: ['1:1 Incorrect use of aria-hidden="true" detected.'],
    },
    {
        rule: "a11y/noAriaHiddenOnFocusable",
        file: "a.jsx",
        source: '<button aria-hidden="true" tabIndex="-1" />\n',
        expected: [],
    },
    {
        rule: "a11y/noAriaHiddenOnFocusable",
        file: "a.jsx",
        source: '<button aria-hidden="true" tabIndex={-1} />\n',
        expected: [],
    },
    {
        rule: "a11y/noAriaHiddenOnFocusable",
        file: "a.jsx",
        source: '<div aria-hidden="true"><a href="#"></a></div>\n',
        expected: [],
    },
    {
        rule: "a11y/noAriaHiddenOnFocusable",
        file: "a.jsx",
        source: '<input aria-hidden="true" />;\n<input type="hidden" aria-hidden="true" />;\n<div aria-hidden={true} tabIndex={0} />;\n<div aria-hidden="false" tabIndex="0" />;\n',
        expected: [
            '1:1 Incorrect use of aria-hidden="true" detected.',
            '3:1 Incorrect use of aria-hidden="true" detected.',
        ],
    },
    {
        rule: "a11y/noAutofocus",
        file: "a.jsx",
        source: "<input autoFocus />\n",
        expected: ["1:8 Avoid the autoFocus attribute."],
    },
    {
        rule: "a11y/noAutofocus",
        file: "a.jsx",
        source: '<input autoFocus="true" />\n',
        expected: ["1:8 Avoid the autoFocus attribute."],
    },
    {
        rule: "a11y/noAutofocus",
        file: "a.jsx",
        source: '<input autoFocus={"false"} />\n',
        expected: ["1:8 Avoid the autoFocus attribute."],
    },
    {
        rule: "a11y/noAutofocus",
        file: "a.jsx",
        source: "<input autoFocus={undefined} />\n",
        expected: ["1:8 Avoid the autoFocus attribute."],
    },
    {
        rule: "a11y/noAutofocus",
        file: "a.jsx",
        source: "<input />\n",
        expected: [],
    },
    {
        rule: "a11y/noAutofocus",
        file: "a.jsx",
        source: "<div />\n",
        expected: [],
    },
    {
        rule: "a11y/noAutofocus",
        file: "a.jsx",
        source: "<button />\n",
        expected: [],
    },
    {
        rule: "a11y/noAutofocus",
        file: "a.jsx",
        source: "// `autoFocus` prop in user created component is valid\n<MyComponent autoFocus={true} />\n",
        expected: [],
    },
    {
        rule: "a11y/noAutofocus",
        file: "a.jsx",
        source: "// `autoFocus` prop in element has `popover` attribute is valid\n<div popover><input autoFocus /></div>\n",
        expected: [],
    },
    {
        rule: "a11y/noAutofocus",
        file: "a.jsx",
        source: "// `autoFocus` prop in `dialog` is valid\n<dialog><input autoFocus /></dialog>\n",
        expected: [],
    },
    {
        rule: "a11y/noDistractingElements",
        file: "a.jsx",
        source: "<marquee />\n",
        expected: ["1:1 Don't use the 'marquee' element."],
    },
    {
        rule: "a11y/noDistractingElements",
        file: "a.jsx",
        source: "<blink />\n",
        expected: ["1:1 Don't use the 'blink' element."],
    },
    {
        rule: "a11y/noDistractingElements",
        file: "a.jsx",
        source: "<div />\n",
        expected: [],
    },
    {
        rule: "a11y/noHeaderScope",
        file: "a.jsx",
        source: "<div scope={scope} />\n",
        expected: [
            "1:6 Avoid using the scope attribute on elements other than th elements.",
        ],
    },
    {
        rule: "a11y/noHeaderScope",
        file: "a.jsx",
        source: '<div scope="col" />\n',
        expected: [
            "1:6 Avoid using the scope attribute on elements other than th elements.",
        ],
    },
    {
        rule: "a11y/noHeaderScope",
        file: "a.jsx",
        source: "<th scope={scope}></th>\n",
        expected: [],
    },
    {
        rule: "a11y/noHeaderScope",
        file: "a.jsx",
        source: '<th scope="col"></th>\n',
        expected: [],
    },
    {
        rule: "a11y/noHeaderScope",
        file: "a.jsx",
        source: '<td scope="row" />;\n<Foo scope="row" />;\n',
        expected: [
            "1:5 Avoid using the scope attribute on elements other than th elements.",
        ],
    },
    {
        rule: "a11y/noPositiveTabindex",
        file: "a.jsx",
        source: "<div tabIndex={1}>foo</div>\n",
        expected: ["1:15 Avoid positive values for the tabIndex prop."],
    },
    {
        rule: "a11y/noPositiveTabindex",
        file: "a.jsx",
        source: '<div tabIndex={"1"} />\n',
        expected: ["1:15 Avoid positive values for the tabIndex prop."],
    },
    {
        rule: "a11y/noPositiveTabindex",
        file: "a.js",
        source: 'React.createElement("div", { tabIndex: 1 })\n',
        expected: ["1:40 Avoid positive values for the tabIndex prop."],
    },
    {
        rule: "a11y/noPositiveTabindex",
        file: "a.jsx",
        source: '<div tabIndex="0" />\n',
        expected: [],
    },
    {
        rule: "a11y/noPositiveTabindex",
        file: "a.js",
        source: 'React.createElement("div", { tabIndex: -1 })\n',
        expected: [],
    },
    {
        rule: "a11y/noRedundantAlt",
        file: "a.jsx",
        source: '<img src="src" alt="photo content" />;\n',
        expected: [
            '1:20 Avoid the words "image", "picture", or "photo" in img element alt text.',
        ],
    },
    {
        rule: "a11y/noRedundantAlt",
        file: "a.jsx",
        source: "<img alt={`picture doing ${things}`} {...this.props} />;\n",
        expected: [
            '1:10 Avoid the words "image", "picture", or "photo" in img element alt text.',
        ],
    },
    {
        rule: "a11y/noRedundantAlt",
        file: "a.jsx",
        source: '<img alt="picture of cool person" aria-hidden={false} />;\n',
        expected: [
            '1:10 Avoid the words "image", "picture", or "photo" in img element alt text.',
        ],
    },
    {
        rule: "a11y/noRedundantAlt",
        file: "a.jsx",
        source: '<>\n\t<img src="src" alt="alt" />\n\t<img src="src" alt={photo} />\n\t<img src="bar" aria-hidden alt="Picture of me taking a photo of an image" />\n</>\n',
        expected: [],
    },
    {
        rule: "a11y/noRedundantAlt",
        file: "a.jsx",
        source: '<img alt="My image" />;\n<img alt="images of" />;\n<img alt="Photograph" />;\n<img alt="photo" aria-hidden="true" />;\n<Img alt="photo" />;\n',
        expected: [
            '1:10 Avoid the words "image", "picture", or "photo" in img element alt text.',
        ],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: "<svg>foo</svg>\n",
        expected: ["1:1 Alternative text title element cannot be empty"],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: "<svg>\n    <title></title>\n    <circle />\n</svg>\n",
        expected: ["1:1 Alternative text title element cannot be empty"],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: "<svg>foo</svg>\n",
        expected: ["1:1 Alternative text title element cannot be empty"],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: "<svg>\n    <rect />\n    <rect />\n    <g>\n        <title>foo</title>\n        <circle />\n        <circle />\n    </g>\n</svg>\n",
        expected: ["1:1 Alternative text title element cannot be empty"],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: '<svg role="graphics-symbol"><rect /></svg>\n',
        expected: ["1:1 Alternative text title element cannot be empty"],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: "<svg>\n    <title>Pass</title>\n    <circle />\n</svg>\n",
        expected: [],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: '<svg role="img" aria-labelledby="title">\n    <span id="title">Pass</span>\n</svg>\n',
        expected: [],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: '<svg role="img" aria-label="title">\n    <span id="title">Pass</span>\n</svg>\n',
        expected: [],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: '<svg role="graphics-symbol">\n    <title>Pass</title>\n    <rect />\n</svg>\n',
        expected: [],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: '<svg aria-hidden="true"><rect /></svg>\n',
        expected: [],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: "<svg aria-hidden><rect /></svg>\n",
        expected: [],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: '<svg role="img" aria-label="">\n    <span id="">Pass</span>\n</svg>\n',
        expected: [],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: '<svg role="presentation">foo</svg>\n',
        expected: [],
    },
    {
        rule: "a11y/noSvgWithoutTitle",
        file: "a.jsx",
        source: '<svg><title>{name}</title></svg>;\n<svg role="img" />;\n<svg role="none" />;\n<svg {...p} />;\n',
        expected: ["1:1 Alternative text title element cannot be empty"],
    },
    {
        rule: "a11y/useAltText",
        file: "a.jsx",
        source: '<img src="image.png" />\n',
        expected: [
            "1:1 Provide a text alternative through the alt, aria-label or aria-labelledby attribute",
        ],
    },
    {
        rule: "a11y/useAltText",
        file: "a.jsx",
        source: '<input type="image" src="image.png" />\n',
        expected: [
            "1:1 Provide a text alternative through the alt, aria-label or aria-labelledby attribute",
        ],
    },
    {
        rule: "a11y/useAltText",
        file: "a.jsx",
        source: '<img src="image.png" alt="image alt" />\n',
        expected: [],
    },
    {
        rule: "a11y/useAltText",
        file: "a.jsx",
        source: '<input type="image" src="image.png" alt="alt text" />\n',
        expected: [],
    },
    {
        rule: "a11y/useAltText",
        file: "a.jsx",
        source: '<input type="image" src="image.png" aria-label="alt text" />\n',
        expected: [],
    },
    {
        rule: "a11y/useAltText",
        file: "a.jsx",
        source: '<input type="image" src="image.png" aria-labelledby="someId" />\n',
        expected: [],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: "<a />\n",
        expected: [
            "1:1 Provide screen reader accessible content when using `a` elements.",
        ],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: "<a></a>\n",
        expected: [
            "1:1 Provide screen reader accessible content when using `a` elements.",
        ],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: "<a>    </a>\n",
        expected: [
            "1:1 Provide screen reader accessible content when using `a` elements.",
        ],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: "<a aria-hidden>content</a>\n",
        expected: [
            "1:1 Provide screen reader accessible content when using `a` elements.",
        ],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: '<a><span aria-hidden="true">content</span></a>\n',
        expected: [
            "1:1 Provide screen reader accessible content when using `a` elements.",
        ],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: "<a>content</a>\n",
        expected: [],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: 'function html() {\n    return { __html: "foo" }\n}\n<a dangerouslySetInnerHTML={html()} />\n',
        expected: [],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: "<a><TextWrapper aria-hidden={true} />content</a>\n",
        expected: [],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: '<a><div aria-hidden="true"></div>content</a>\n',
        expected: [],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: '<Button render={<a href="/home" aria-label="Home" />}>Home</Button>\n',
        expected: [],
    },
    {
        rule: "a11y/useAnchorContent",
        file: "a.jsx",
        source: '<a>{label}</a>;\n<a><img alt="x" /></a>;\n<a children="x" />;\n',
        expected: [],
    },
    {
        rule: "a11y/useButtonType",
        file: "a.jsx",
        source: "<button>Do something</button>\n",
        expected: ["1:1 Provide an explicit type prop for the button element."],
    },
    {
        rule: "a11y/useButtonType",
        file: "a.jsx",
        source: '<button type="incorrectType">Do something</button>\n',
        expected: ["1:14 Provide a valid type prop for the button element."],
    },
    {
        rule: "a11y/useButtonType",
        file: "a.js",
        source: "React.createElement('button');\n",
        expected: [
            "1:21 Provide an explicit type prop for the button element.",
        ],
    },
    {
        rule: "a11y/useButtonType",
        file: "a.jsx",
        source: '<>\n    <button type="button">Do something</button>\n    <button type={buttonType}>Do something</button>\n</>\n',
        expected: [],
    },
    {
        rule: "a11y/useHeadingContent",
        file: "a.jsx",
        source: "<h1 />\n",
        expected: [
            "1:1 Provide screen reader accessible content when using heading  elements.",
        ],
    },
    {
        rule: "a11y/useHeadingContent",
        file: "a.jsx",
        source: "<h1><div aria-hidden /></h1>\n",
        expected: [
            "1:1 Provide screen reader accessible content when using heading  elements.",
        ],
    },
    {
        rule: "a11y/useHeadingContent",
        file: "a.jsx",
        source: '<h1 aria-label="Screen reader content" aria-hidden>invisible content</h1>\n',
        expected: [
            "1:1 Provide screen reader accessible content when using heading  elements.",
        ],
    },
    {
        rule: "a11y/useHeadingContent",
        file: "a.jsx",
        source: "<h1></h1>\n",
        expected: [
            "1:1 Provide screen reader accessible content when using heading  elements.",
        ],
    },
    {
        rule: "a11y/useHeadingContent",
        file: "a.jsx",
        source: "<h1>heading</h1>\n",
        expected: [],
    },
    {
        rule: "a11y/useHeadingContent",
        file: "a.jsx",
        source: '<h1><div aria-hidden="true"></div>visible content</h1>\n',
        expected: [],
    },
    {
        rule: "a11y/useHeadingContent",
        file: "a.jsx",
        source: '<h1 aria-label="Screen reader content"><div aria-hidden="true">invisible content</div></h1>\n',
        expected: [],
    },
    {
        rule: "a11y/useHeadingContent",
        file: "a.jsx",
        source: '<h1 dangerouslySetInnerHTML={{ __html: "heading" }} />\n',
        expected: [],
    },
    {
        rule: "a11y/useHeadingContent",
        file: "a.jsx",
        source: "<h1><div aria-hidden />visible content</h1>\n",
        expected: [],
    },
    {
        rule: "a11y/useHeadingContent",
        file: "a.jsx",
        source: '<h2>{title}</h2>;\n<h3><Trans /></h3>;\n<h4 children="x" />;\n',
        expected: [],
    },
    {
        rule: "a11y/useHtmlLang",
        file: "a.jsx",
        source: "<html></html>\n",
        expected: ["1:1 Provide a lang attribute when using the html element."],
    },
    {
        rule: "a11y/useHtmlLang",
        file: "a.jsx",
        source: '<html lang={""}></html>\n',
        expected: ["1:1 Provide a lang attribute when using the html element."],
    },
    {
        rule: "a11y/useHtmlLang",
        file: "a.jsx",
        source: "<html lang={null}></html>\n",
        expected: ["1:1 Provide a lang attribute when using the html element."],
    },
    {
        rule: "a11y/useHtmlLang",
        file: "a.jsx",
        source: "<html lang={undefined}></html>\n",
        expected: ["1:1 Provide a lang attribute when using the html element."],
    },
    {
        rule: "a11y/useHtmlLang",
        file: "a.jsx",
        source: "<html lang={true}></html>\n",
        expected: ["1:1 Provide a lang attribute when using the html element."],
    },
    {
        rule: "a11y/useHtmlLang",
        file: "a.jsx",
        source: '<html lang="en"></html>\n',
        expected: [],
    },
    {
        rule: "a11y/useHtmlLang",
        file: "a.jsx",
        source: "<html lang={language}></html>\n",
        expected: [],
    },
    {
        rule: "a11y/useHtmlLang",
        file: "a.jsx",
        source: "<html {...props}></html>\n",
        expected: [],
    },
    {
        rule: "a11y/useHtmlLang",
        file: "a.jsx",
        source: '<html lang={""} {...props}></html>\n',
        expected: [],
    },
    {
        rule: "a11y/useIframeTitle",
        file: "a.jsx",
        source: " <iframe />\n",
        expected: ["1:2 Provide a title attribute when using iframe elements."],
    },
    {
        rule: "a11y/useIframeTitle",
        file: "a.jsx",
        source: "<iframe></iframe>\n",
        expected: ["1:1 Provide a title attribute when using iframe elements."],
    },
    {
        rule: "a11y/useIframeTitle",
        file: "a.jsx",
        source: '<iframe title="" />\n',
        expected: ["1:1 Provide a title attribute when using iframe elements."],
    },
    {
        rule: "a11y/useIframeTitle",
        file: "a.jsx",
        source: '<iframe title={""} />\n',
        expected: ["1:1 Provide a title attribute when using iframe elements."],
    },
    {
        rule: "a11y/useIframeTitle",
        file: "a.jsx",
        source: "<iframe title={undefined} />\n",
        expected: ["1:1 Provide a title attribute when using iframe elements."],
    },
    {
        rule: "a11y/useIframeTitle",
        file: "a.jsx",
        source: "<iframe title={false} />\n",
        expected: ["1:1 Provide a title attribute when using iframe elements."],
    },
    {
        rule: "a11y/useIframeTitle",
        file: "a.jsx",
        source: "<iframe title={true} />\n",
        expected: ["1:1 Provide a title attribute when using iframe elements."],
    },
    {
        rule: "a11y/useIframeTitle",
        file: "a.jsx",
        source: "<iframe title={42} />\n",
        expected: ["1:1 Provide a title attribute when using iframe elements."],
    },
    {
        rule: "a11y/useIframeTitle",
        file: "a.jsx",
        source: '<>\n  <iframe title="This is a unique title" />\n  <iframe title={uniqueTitle} />\n  <iframe {...props} />\n</>\n',
        expected: [],
    },
    {
        rule: "a11y/useKeyWithClickEvents",
        file: "a.jsx",
        source: "<div onClick={() => {}} />\n",
        expected: [
            "1:1 Enforce to have the onClick mouse event with the onKeyUp, the onKeyDown, or the onKeyPress keyboard event.",
        ],
    },
    {
        rule: "a11y/useKeyWithClickEvents",
        file: "a.jsx",
        source: "<div onClick={() => {}} onKeyDown={handleKeyDown} />\n",
        expected: [],
    },
    {
        rule: "a11y/useKeyWithClickEvents",
        file: "a.jsx",
        source: "<div onClick={() => {}} onKeyUp={handleKeyUp} />\n",
        expected: [],
    },
    {
        rule: "a11y/useKeyWithClickEvents",
        file: "a.jsx",
        source: "<div onClick={() => {}} onKeyPress={handleKeyPress} />\n",
        expected: [],
    },
    {
        rule: "a11y/useKeyWithClickEvents",
        file: "a.jsx",
        source: "// this rule doesn't apply to user created component\n<MyComponent onClick={() => {}} />\n",
        expected: [],
    },
    {
        rule: "a11y/useKeyWithClickEvents",
        file: "a.jsx",
        source: '<button onClick={() => console.log("test")}>Submit</button>\n',
        expected: [],
    },
    {
        rule: "a11y/useKeyWithClickEvents",
        file: "a.jsx",
        source: '<div onClick={f} {...p} />;\n<input onClick={f} />;\n<a onClick={f}>x</a>;\n<span onClick={f} aria-hidden />;\n<span onClick={f} role="button" />;\n<div onClick={f} role="presentation" />;\n',
        expected: [
            "1:1 Enforce to have the onClick mouse event with the onKeyUp, the onKeyDown, or the onKeyPress keyboard event.",
            "3:1 Enforce to have the onClick mouse event with the onKeyUp, the onKeyDown, or the onKeyPress keyboard event.",
            "5:1 Enforce to have the onClick mouse event with the onKeyUp, the onKeyDown, or the onKeyPress keyboard event.",
        ],
    },
    {
        rule: "a11y/useKeyWithMouseEvents",
        file: "a.jsx",
        source: "<div onMouseOver={() => {}} />\n",
        expected: [
            "1:1 onMouseOver must be accompanied by onFocus for accessibility.",
        ],
    },
    {
        rule: "a11y/useKeyWithMouseEvents",
        file: "a.jsx",
        source: "<div onMouseOut={() => {}} />\n",
        expected: [
            "1:1 onMouseOut must be accompanied by onBlur for accessibility.",
        ],
    },
    {
        rule: "a11y/useKeyWithMouseEvents",
        file: "a.jsx",
        source: "<>\n  <div onMouseOver={() => {}} onFocus={() => {}} />\n  <div onMouseOut={() => {}} onBlur={() => {}} />\n  <div onMouseOver={() => {}} {...otherProps} />\n  <div onMouseOut={() => {}} {...otherProps} />\n  <div onMouseOver={() => {}} onFocus={() => {}} {...otherProps} />\n  <div onMouseOut={() => {}} onBlur={() => {}} {...otherProps} />\n</>\n",
        expected: [],
    },
    {
        rule: "a11y/useMediaCaption",
        file: "a.jsx",
        source: "\t<video />\n",
        expected: [
            "1:2 Provide a track for captions when using audio or video elements.",
        ],
    },
    {
        rule: "a11y/useMediaCaption",
        file: "a.jsx",
        source: "\t<audio>child</audio>\n",
        expected: [
            "1:2 Provide a track for captions when using audio or video elements.",
        ],
    },
    {
        rule: "a11y/useMediaCaption",
        file: "a.jsx",
        source: '\t<audio>\n\t\t<track kind="captions" {...props} />\n\t</audio>\n',
        expected: [],
    },
    {
        rule: "a11y/useMediaCaption",
        file: "a.jsx",
        source: "\t<video muted {...props}></video>\n",
        expected: [],
    },
    {
        rule: "a11y/useMediaCaption",
        file: "a.jsx",
        source: '<video><track kind="subtitles" /></video>;\n<audio muted={false} />;\n',
        expected: [
            "1:1 Provide a track for captions when using audio or video elements.",
        ],
    },
    {
        rule: "complexity/noAdjacentSpacesInRegex",
        file: "a.js",
        source: "/   /\n",
        expected: [
            "1:2 This regular expression contains unclear uses of consecutive spaces.",
        ],
    },
    {
        rule: "complexity/noAdjacentSpacesInRegex",
        file: "a.js",
        source: "/foo  */\n",
        expected: [
            "1:5 This regular expression contains unclear uses of consecutive spaces.",
        ],
    },
    {
        rule: "complexity/noAdjacentSpacesInRegex",
        file: "a.js",
        source: "/foo  {2,}bar   {3,5}baz/\n",
        expected: [
            "1:5 This regular expression contains unclear uses of consecutive spaces.",
        ],
    },
    {
        rule: "complexity/noAdjacentSpacesInRegex",
        file: "a.js",
        source: "/foo [ba]r  b(a|z)/\n",
        expected: [
            "1:11 This regular expression contains unclear uses of consecutive spaces.",
        ],
    },
    {
        rule: "complexity/noAdjacentSpacesInRegex",
        file: "a.js",
        source: "/foo {2}bar/\n",
        expected: [],
    },
    {
        rule: "complexity/noAdjacentSpacesInRegex",
        file: "a.js",
        source: "/ foo bar baz /\n",
        expected: [],
    },
    {
        rule: "complexity/noAdjacentSpacesInRegex",
        file: "a.js",
        source: "/foo bar\tbaz/\n",
        expected: [],
    },
    {
        rule: "complexity/noArguments",
        file: "a.js",
        source: "function f() {\n   console.log(arguments);\n}\n",
        expected: ["2:16 Use the rest parameters instead of arguments."],
    },
    {
        rule: "complexity/noArguments",
        file: "a.cjs",
        source: "function f() {\n    let arguments = 1;\n    console.log(arguments);\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "function f<T extends {}>(x: T) {\n    assert(x != null);\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "type NonNullableMyType = MyType & {};\n",
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "// equivalent to `{}`\ntype AnythingNotNullish = NonNullable<unknown>;\n",
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: 'let foo: String = "bar";\n',
        expected: ["1:10 Don't use 'String' as a type."],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "const bool = true as Boolean;\n",
        expected: ["1:22 Don't use 'Boolean' as a type."],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: 'let invalidTuple: [string, Number] = ["foo", 12];\n',
        expected: ["1:28 Don't use 'Number' as a type."],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "function badFunction(cb: Function) {\n  cb(12);\n}\n",
        expected: ["1:26 Don't use 'Function' as a type."],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "const notEmpty: {} = {prop: 12};\n",
        expected: ["1:17 Don't use '{}' as a type."],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: 'const alsoNotAnObj: Object = "foo";\n',
        expected: ["1:21 Don't use 'Object' as a type."],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: 'const foo: string = "bar";\n',
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: 'let tuple: [boolean, string] = [false, "foo"];\n',
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "function betterFunction(cb: (n: number) => string) {\n  return cb(12);\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "type wrapFn<T extends (...args: never) => unknown> = { func: T }\n",
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "const goodObj: object = {foo: 12};\n",
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "type emptyObj = Record<string, never>;\n",
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "declare function foo<T extends {}>(x: T): void;\n",
        expected: [],
    },
    {
        rule: "complexity/noBannedTypes",
        file: "a.ts",
        source: "type notNull<T> = T & {};\n",
        expected: [],
    },
    {
        rule: "complexity/noCommaOperator",
        file: "a.js",
        source: "const foo = (doSomething(), 0);\n",
        expected: ["1:27 The comma operator is disallowed."],
    },
    {
        rule: "complexity/noCommaOperator",
        file: "a.js",
        source: "for (; doSomething(), !!test; ) {}\n",
        expected: ["1:21 The comma operator is disallowed."],
    },
    {
        rule: "complexity/noCommaOperator",
        file: "a.js",
        source: "// Use a semicolon instead.\nlet a, b;\na = 1, b = 2;\n",
        expected: ["3:6 The comma operator is disallowed."],
    },
    {
        rule: "complexity/noCommaOperator",
        file: "a.js",
        source: "for(a = 0, b = 0; (a + b) < 10; a++, b += 2) {}\n",
        expected: [],
    },
    {
        rule: "complexity/noEmptyTypeParameters",
        file: "a.ts",
        source: "interface Foo<> {}\n",
        expected: ["1:14 Unexpected empty type parameter list."],
    },
    {
        rule: "complexity/noEmptyTypeParameters",
        file: "a.ts",
        source: "type Bar<> = {};\n",
        expected: ["1:9 Unexpected empty type parameter list."],
    },
    {
        rule: "complexity/noEmptyTypeParameters",
        file: "a.ts",
        source: "interface Foo {}\n",
        expected: [],
    },
    {
        rule: "complexity/noEmptyTypeParameters",
        file: "a.ts",
        source: "type Foo<T> = {\n bar: T;\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noExtraBooleanCast",
        file: "a.js",
        source: "if (!Boolean(foo)) {\n}\n",
        expected: ["1:6 Avoid redundant `Boolean` call"],
    },
    {
        rule: "complexity/noExtraBooleanCast",
        file: "a.js",
        source: "while (!!foo) {}\n",
        expected: ["1:8 Avoid redundant double-negation."],
    },
    {
        rule: "complexity/noExtraBooleanCast",
        file: "a.js",
        source: "let x = 1;\ndo {\n1 + 1;\n} while (Boolean(x));\n",
        expected: ["4:10 Avoid redundant `Boolean` call"],
    },
    {
        rule: "complexity/noExtraBooleanCast",
        file: "a.js",
        source: "for (; !!foo; ) {}\n",
        expected: ["1:8 Avoid redundant double-negation."],
    },
    {
        rule: "complexity/noExtraBooleanCast",
        file: "a.js",
        source: "new Boolean(!!x);\n",
        expected: ["1:13 Avoid redundant double-negation."],
    },
    {
        rule: "complexity/noExtraBooleanCast",
        file: "a.js",
        source: "Boolean(!x);\n!x;\n!!x;\n",
        expected: [],
    },
    {
        rule: "complexity/noFlatMapIdentity",
        file: "a.js",
        source: "array.flatMap((arr) => arr);\n",
        expected: ["1:1 Avoid unnecessary callback in flatMap call."],
    },
    {
        rule: "complexity/noFlatMapIdentity",
        file: "a.js",
        source: "array.flatMap((arr) => {return arr});\n",
        expected: ["1:1 Avoid unnecessary callback in flatMap call."],
    },
    {
        rule: "complexity/noFlatMapIdentity",
        file: "a.js",
        source: "array.flatMap((arr) => arr * 2);\n",
        expected: [],
    },
    {
        rule: "complexity/noStaticOnlyClass",
        file: "a.js",
        source: "class X {\n  static foo = false;\n  static bar() {};\n}\n",
        expected: ["1:1 Avoid classes that contain only static members."],
    },
    {
        rule: "complexity/noStaticOnlyClass",
        file: "a.ts",
        source: "class StaticConstants {\n  static readonly version = 42;\n\n  static isProduction() {\n    return process.env.NODE_ENV === 'production';\n  }\n}\n",
        expected: ["1:1 Avoid classes that contain only static members."],
    },
    {
        rule: "complexity/noStaticOnlyClass",
        file: "a.js",
        source: "const X = {\n  foo: false,\n  bar() {}\n};\n",
        expected: [],
    },
    {
        rule: "complexity/noStaticOnlyClass",
        file: "a.js",
        source: "export const version = 42;\n\nexport function isProduction() {\n  return process.env.NODE_ENV === 'production';\n}\n\nfunction logHelloWorld() {\n  console.log('Hello, world!');\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noStaticOnlyClass",
        file: "a.js",
        source: "class Empty {}\n",
        expected: [],
    },
    {
        rule: "complexity/noStaticOnlyClass",
        file: "a.js",
        source: "export class Utilities {\n  static mutableCount = 1;\n  static incrementCount() {\n    Utilities.mutableCount += 1;\n  }\n}\n",
        expected: ["1:8 Avoid classes that contain only static members."],
    },
    {
        rule: "complexity/noStaticOnlyClass",
        file: "a.js",
        source: "let mutableCount = 1;\n\nexport function getMutableCount() {\n  return mutableField;\n}\n\nexport function incrementCount() {\n  mutableField += 1;\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noThisInStatic",
        file: "a.js",
        source: " class A {\n    static CONSTANT = 0;\n\n    static foo() {\n        this.CONSTANT;\n    }\n }\n",
        expected: ["5:9 Using this in a static context can be confusing."],
    },
    {
        rule: "complexity/noThisInStatic",
        file: "a.js",
        source: " class B extends A {\n    static bar() {\n        super.CONSTANT;\n    }\n }\n",
        expected: ["3:9 Using super in a static context can be confusing."],
    },
    {
        rule: "complexity/noThisInStatic",
        file: "a.js",
        source: "class B extends A {\n    static ANOTHER_CONSTANT = A.CONSTANT + 1;\n\n    static foo() {\n        A.CONSTANT;\n        B.ANOTHER_CONSTANT;\n    }\n\n    bar() {\n        this.property;\n    }\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noThisInStatic",
        file: "a.js",
        source: "class A {\n   static foo() {\n       doSomething()\n   }\n\n   bar() {\n     A.foo()\n   }\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessCatch",
        file: "a.js",
        source: "try {\n    doSomething();\n} catch(e) {\n    throw e;\n}\n",
        expected: [
            "4:5 The catch clause that only rethrows the original error is useless.",
        ],
    },
    {
        rule: "complexity/noUselessCatch",
        file: "a.js",
        source: "try {\n    doSomething();\n} catch(e) {\n    throw e;\n} finally {\n    doCleanUp();\n}\n",
        expected: [
            "4:5 The catch clause that only rethrows the original error is useless.",
        ],
    },
    {
        rule: "complexity/noUselessCatch",
        file: "a.js",
        source: "try {\n    doSomething();\n} catch(e) {\n    doSomethingWhenCatch();\n    throw e;\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessCatch",
        file: "a.js",
        source: "try {\n    doSomething();\n} catch(e) {\n    handleError(e);\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessCatch",
        file: "a.js",
        source: "try {\n    doSomething();\n} finally {\n    doCleanUp();\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessConstructor",
        file: "a.js",
        source: "class A {\n    constructor (a) {}\n}\n",
        expected: ["2:5 This constructor is unnecessary."],
    },
    {
        rule: "complexity/noUselessConstructor",
        file: "a.js",
        source: "class B extends A {\n    constructor (a) {\n        super(a);\n    }\n}\n",
        expected: ["2:5 This constructor is unnecessary."],
    },
    {
        rule: "complexity/noUselessConstructor",
        file: "a.js",
        source: "class C {\n    /**\n     * Documented constructor.\n     */\n    constructor () {}\n}\n",
        expected: ["5:5 This constructor is unnecessary."],
    },
    {
        rule: "complexity/noUselessConstructor",
        file: "a.ts",
        source: "class A {\n    protected constructor() {\n        this.prop = 1;\n    }\n}\n\nclass B extends A {\n    // Make the parent constructor public.\n    constructor () {\n        super();\n    }\n}\n",
        expected: ["9:5 This constructor is unnecessary."],
    },
    {
        rule: "complexity/noUselessConstructor",
        file: "a.js",
        source: "class A {\n    constructor (prop) {\n        this.prop = prop;\n    }\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessConstructor",
        file: "a.js",
        source: "class B extends A {\n    constructor () {\n        super(5);\n    }\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessConstructor",
        file: "a.ts",
        source: "class C {\n    // Empty constructor with parameter properties are allowed.\n    constructor (private prop: number) {}\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessConstructor",
        file: "a.ts",
        source: "class D {\n  constructor(public arg: number){}\n}\n\nclass F extends D {\n  // constructor with default parameters are allowed.\n  constructor(arg = 4) {\n    super(arg)\n  }\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessConstructor",
        file: "a.ts",
        source: "class Base {\n    constructor(public value: string | number) {}\n}\n\nclass Narrowed extends Base {\n    constructor(value: string) {\n        super(value);\n    }\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessConstructor",
        file: "a.ts",
        source: "@Decorator\nclass C {\n    constructor (prop: number) {}\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessContinue",
        file: "a.js",
        source: "loop: for (let i = 0; i < 5; i++) {\n  continue loop;\n}\n",
        expected: ["2:3 Unnecessary continue statement"],
    },
    {
        rule: "complexity/noUselessContinue",
        file: "a.js",
        source: "while (i--) {\n  continue;\n}\n",
        expected: ["2:3 Unnecessary continue statement"],
    },
    {
        rule: "complexity/noUselessContinue",
        file: "a.js",
        source: "while (1) {\n  continue;\n}\n",
        expected: ["2:3 Unnecessary continue statement"],
    },
    {
        rule: "complexity/noUselessContinue",
        file: "a.js",
        source: 'for (let i = 0; i < 10; i++) {\n  if (i > 5) {\n    console.log("foo");\n    continue;\n  } else if (i >= 5 && i < 8) {\n    console.log("test");\n  } else {\n    console.log("test");\n  }\n}\n',
        expected: ["4:5 Unnecessary continue statement"],
    },
    {
        rule: "complexity/noUselessContinue",
        file: "a.js",
        source: "for (let i = 0; i < 9; i++) {\n  continue;\n}\n",
        expected: ["2:3 Unnecessary continue statement"],
    },
    {
        rule: "complexity/noUselessContinue",
        file: "a.js",
        source: "test2: do {\n\tcontinue test2;\n} while (true);\n",
        expected: ["2:2 Unnecessary continue statement"],
    },
    {
        rule: "complexity/noUselessContinue",
        file: "a.js",
        source: "while (i) {\n  if (i > 5) {\n    continue;\n  }\n  console.log(i);\n  i--;\n}\n\nloop: while (1) {\n  forLoop: for (let i = 0; i < 5; i++) {\n    if (someCondition) {\n      continue loop;\n    }\n  }\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessContinue",
        file: "a.js",
        source: "for (const a of b) {\n    try {\n        f(a);\n    } catch {\n        continue;\n    }\n}\n",
        expected: ["5:9 Unnecessary continue statement"],
    },
    {
        rule: "complexity/noUselessEmptyExport",
        file: "a.js",
        source: 'import { A } from "module";\nexport {};\n',
        expected: [
            "2:1 This empty export is useless because there's another export or import.",
        ],
    },
    {
        rule: "complexity/noUselessEmptyExport",
        file: "a.js",
        source: "export const A = 0;\nexport {};\n",
        expected: [
            "2:1 This empty export is useless because there's another export or import.",
        ],
    },
    {
        rule: "complexity/noUselessEmptyExport",
        file: "a.js",
        source: "export {};\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessFragments",
        file: "a.jsx",
        source: "<>\n    <>foo</>\n    <SomeComponent />\n</>\n",
        expected: ["2:5 This fragment is unnecessary."],
    },
    {
        rule: "complexity/noUselessFragments",
        file: "a.jsx",
        source: "<></>\n",
        expected: ["1:1 This fragment is unnecessary."],
    },
    {
        rule: "complexity/noUselessFragments",
        file: "a.jsx",
        source: "<Component prop={<><div /></>} />\n",
        expected: ["1:18 This fragment is unnecessary."],
    },
    {
        rule: "complexity/noUselessFragments",
        file: "a.jsx",
        source: "<Component prop={<>{}</>} />\n",
        expected: ["1:18 This fragment is unnecessary."],
    },
    {
        rule: "complexity/noUselessFragments",
        file: "a.jsx",
        source: "<>\nfoo\n</>\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessFragments",
        file: "a.jsx",
        source: "<React.Fragment>\nfoo\n</React.Fragment>\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessFragments",
        file: "a.jsx",
        source: "<>\n    <Foo />\n    <Bar />\n</>\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessFragments",
        file: "a.jsx",
        source: "<>foo {bar}</>\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessLabel",
        file: "a.js",
        source: "loop: while(a) {\n    break loop;\n}\n",
        expected: ["2:11 Unnecessary label."],
    },
    {
        rule: "complexity/noUselessLabel",
        file: "a.js",
        source: "outer: while(a) {\n    while(b) {\n        break outer;\n    }\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessLoneBlockStatements",
        file: "a.js",
        source: "{}\n",
        expected: [
            "1:1 This block statement doesn't serve any purpose and can be safely removed.",
        ],
    },
    {
        rule: "complexity/noUselessLoneBlockStatements",
        file: "a.js",
        source: "if (foo) {\n  bar();\n  {\n    baz();\n  }\n}\n",
        expected: [
            "3:3 This block statement doesn't serve any purpose and can be safely removed.",
        ],
    },
    {
        rule: "complexity/noUselessLoneBlockStatements",
        file: "a.js",
        source: "while (foo) {\n  bar();\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessLoneBlockStatements",
        file: "a.js",
        source: "switch (a) {\n    case 1: {\n        f();\n        break;\n    }\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessRename",
        file: "a.js",
        source: 'import { foo as bar } from "baz";\nexport { foo as bar };\nlet { foo: bar } = baz;\n',
        expected: [],
    },
    {
        rule: "complexity/noUselessRename",
        file: "a.js",
        source: 'import { foo as foo } from "bar";\n',
        expected: ["1:10 Useless rename."],
    },
    {
        rule: "complexity/noUselessRename",
        file: "a.js",
        source: "export { foo as foo };\n",
        expected: ["1:10 Useless rename."],
    },
    {
        rule: "complexity/noUselessRename",
        file: "a.js",
        source: "let { foo: foo } = bar;\n",
        expected: ["1:7 Useless rename."],
    },
    {
        rule: "complexity/noUselessRename",
        file: "a.js",
        source: 'import { foo as bar } from "baz";\n',
        expected: [],
    },
    {
        rule: "complexity/noUselessRename",
        file: "a.js",
        source: "export { foo as bar };\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessRename",
        file: "a.js",
        source: "let { foo: bar } = baz;\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessStringRaw",
        file: "a.js",
        source: "String.raw`a`;\n",
        expected: [
            "1:1 String.raw is useless when the raw string doesn't contain any escape sequence.",
        ],
    },
    {
        rule: "complexity/noUselessStringRaw",
        file: "a.js",
        source: "String.raw`a ${v}`;\n",
        expected: [
            "1:1 String.raw is useless when the raw string doesn't contain any escape sequence.",
        ],
    },
    {
        rule: "complexity/noUselessStringRaw",
        file: "a.js",
        source: "String.raw`\\n ${a}`;\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessStringRaw",
        file: "a.js",
        source: "String.raw`\\n`;\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessSwitchCase",
        file: "a.js",
        source: "switch (foo) {\n    case 0:\n    default:\n        break;\n    case 1:\n        break;\n}\n",
        expected: ["2:5 Useless case clause."],
    },
    {
        rule: "complexity/noUselessSwitchCase",
        file: "a.js",
        source: "switch (foo) {\n    default:\n    case 0:\n        break;\n    case 1:\n        break;\n}\n",
        expected: ["3:5 Useless case clause."],
    },
    {
        rule: "complexity/noUselessSwitchCase",
        file: "a.js",
        source: "switch (foo) {\n    case 0:\n        break;\n    default:\n        break;\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessSwitchCase",
        file: "a.js",
        source: "switch (foo) {\n    case 0:\n        break;\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessTernary",
        file: "a.js",
        source: "var a = x ? true : true;\n",
        expected: [
            "1:9 Unnecessary use of boolean literals in conditional expression.",
        ],
    },
    {
        rule: "complexity/noUselessTernary",
        file: "a.js",
        source: "var a = foo === 1 ? false : true;\n",
        expected: [
            "1:9 Unnecessary use of boolean literals in conditional expression.",
        ],
    },
    {
        rule: "complexity/noUselessTernary",
        file: "a.js",
        source: "var a = foo + 1 ? false : true;\n",
        expected: [
            "1:9 Unnecessary use of boolean literals in conditional expression.",
        ],
    },
    {
        rule: "complexity/noUselessTernary",
        file: "a.js",
        source: "var a = foo + 1 ? true : false;\n",
        expected: [
            "1:9 Unnecessary use of boolean literals in conditional expression.",
        ],
    },
    {
        rule: "complexity/noUselessTernary",
        file: "a.js",
        source: "var a = x === 2 ? 'Yes' : 'No';\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessTernary",
        file: "a.js",
        source: "var a = x === 2 ? 'Yes' : false;\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessThisAlias",
        file: "a.js",
        source: "class A {\n    method() {\n        const self = this;\n        return () => {\n            return self;\n        }\n    }\n}\n",
        expected: ["3:15 This aliasing of this is unnecessary."],
    },
    {
        rule: "complexity/noUselessThisAlias",
        file: "a.js",
        source: "class A {\n    method() {\n        const self = this;\n        return function() {\n            this.g();\n            return self;\n        }\n    }\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "interface FooAny<T extends any> {}\n",
        expected: [
            "1:20 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "type BarAny<T extends any> = {};\n",
        expected: [
            "1:15 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "class BazAny<T extends any> {\n}\n",
        expected: [
            "1:16 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "class BazAny {\n  quxAny<U extends any>() {}\n}\n",
        expected: [
            "2:12 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "const QuuxAny = <T extends any>() => {};\n",
        expected: [
            "1:20 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "function QuuzAny<T extends any>() {}\n",
        expected: [
            "1:20 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "interface FooUnknown<T extends unknown> {}\n",
        expected: [
            "1:24 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "type BarUnknown<T extends unknown> = {};\n",
        expected: [
            "1:19 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "class BazUnknown<T extends unknown> {\n}\n",
        expected: [
            "1:20 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "class BazUnknown {\n  quxUnknown<U extends unknown>() {}\n}\n",
        expected: [
            "2:16 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "const QuuxUnknown = <T extends unknown>() => {};\n",
        expected: [
            "1:24 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "function QuuzUnknown<T extends unknown>() {}\n",
        expected: [
            "1:24 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "interface Foo<T> {}\n\ntype Bar<T> = {};\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessTypeConstraint",
        file: "a.ts",
        source: "type A<T> = T extends [infer U extends unknown] ? U : never;\n",
        expected: [
            "1:32 Constraining a type parameter to any or unknown is useless.",
        ],
    },
    {
        rule: "complexity/noUselessUndefinedInitialization",
        file: "a.js",
        source: "var a = undefined;\n",
        expected: ["1:7 It's not necessary to initialize a to undefined."],
    },
    {
        rule: "complexity/noUselessUndefinedInitialization",
        file: "a.js",
        source: "let b = undefined, c = 1, d = 2;\n",
        expected: ["1:7 It's not necessary to initialize b to undefined."],
    },
    {
        rule: "complexity/noUselessUndefinedInitialization",
        file: "a.js",
        source: "for (let i = 0; i < 100; i++) {\n\tlet i = undefined;\n}\n",
        expected: ["2:8 It's not necessary to initialize i to undefined."],
    },
    {
        rule: "complexity/noUselessUndefinedInitialization",
        file: "a.js",
        source: "let f = /**/undefined/**/ ;\n",
        expected: ["1:7 It's not necessary to initialize f to undefined."],
    },
    {
        rule: "complexity/noUselessUndefinedInitialization",
        file: "a.js",
        source: "var a = 1;\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessUndefinedInitialization",
        file: "a.js",
        source: "class Foo {\n\tbar = undefined;\n}\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessUndefinedInitialization",
        file: "a.js",
        source: "export let x = undefined;\n",
        expected: [],
    },
    {
        rule: "complexity/noUselessUndefinedInitialization",
        file: "a.js",
        source: "let y = undefined;\nexport { y };\n",
        expected: [],
    },
    {
        rule: "complexity/useArrowFunction",
        file: "a.js",
        source: "const z = function() {\n    return 0;\n}\n",
        expected: [
            "1:11 This function expression can be turned into an arrow function.",
        ],
    },
    {
        rule: "complexity/useArrowFunction",
        file: "a.js",
        source: "const delegatedFetch = async function(url) {\n    return await fetch(url);\n}\n",
        expected: [
            "1:24 This function expression can be turned into an arrow function.",
        ],
    },
    {
        rule: "complexity/useArrowFunction",
        file: "a.js",
        source: "const f = function() {\n    return this.prop;\n}\n",
        expected: [],
    },
    {
        rule: "complexity/useArrowFunction",
        file: "a.js",
        source: "const z = function z() {\n    return 0;\n}\n",
        expected: [],
    },
    {
        rule: "complexity/useArrowFunction",
        file: "a.js",
        source: "const q = function () {\n    return arguments[0];\n}\n",
        expected: [],
    },
    {
        rule: "complexity/useArrowFunction",
        file: "a.ts",
        source: "const z = function(this: A): number {\n    return 0;\n}\n",
        expected: [],
    },
    {
        rule: "complexity/useDateNow",
        file: "a.js",
        source: "const foo = new Date().getTime();\n",
        expected: ["1:13 Use Date.now() instead of new Date().getTime()."],
    },
    {
        rule: "complexity/useDateNow",
        file: "a.js",
        source: "const foo = new Date().valueOf();\n",
        expected: ["1:13 Use Date.now() instead of new Date().valueOf()."],
    },
    {
        rule: "complexity/useDateNow",
        file: "a.js",
        source: "const foo = +new Date();\n",
        expected: ["1:13 Use Date.now() instead of new Date()."],
    },
    {
        rule: "complexity/useDateNow",
        file: "a.js",
        source: "const foo = Number(new Date());\n",
        expected: ["1:13 Use Date.now() instead of Number(new Date())."],
    },
    {
        rule: "complexity/useDateNow",
        file: "a.js",
        source: "const foo = new Date() * 2;\n",
        expected: ["1:13 Use Date.now() instead of new Date()."],
    },
    {
        rule: "complexity/useDateNow",
        file: "a.js",
        source: "const foo = Date.now();\n",
        expected: [],
    },
    {
        rule: "complexity/useDateNow",
        file: "a.js",
        source: "const foo = Date.now() * 2;\n",
        expected: [],
    },
    {
        rule: "complexity/useFlatMap",
        file: "a.js",
        source: 'const array = ["split", "the text", "into words"];\narray.map(sentence => sentence.split(\' \')).flat();\n',
        expected: [
            "2:1 The call chain .map().flat() can be replaced with a single .flatMap() call.",
        ],
    },
    {
        rule: "complexity/useFlatMap",
        file: "a.js",
        source: 'const array = ["split", "the text", "into words"];\narray.map(sentence => sentence.split(\' \')).flat(1);\n',
        expected: [
            "2:1 The call chain .map().flat() can be replaced with a single .flatMap() call.",
        ],
    },
    {
        rule: "complexity/useFlatMap",
        file: "a.js",
        source: 'const array = ["split", "the text", "into words"];\narray.map(sentence => sentence.split(\' \')).flat(2);\n',
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findIndex(x => x === 'foo');\n",
        expected: [
            "1:15 Prefer Array#indexOf() over Array#findIndex() when looking for the index of an item.",
        ],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findIndex(x => 'foo' === x);\n",
        expected: [
            "1:15 Prefer Array#indexOf() over Array#findIndex() when looking for the index of an item.",
        ],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findIndex(x => {\n     return x === 'foo';\n});\n",
        expected: [
            "1:15 Prefer Array#indexOf() over Array#findIndex() when looking for the index of an item.",
        ],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findLastIndex(x => 'foo' === x);\n",
        expected: [
            "1:15 Prefer Array#lastIndexOf() over Array#findLastIndex() when looking for the index of an item.",
        ],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findLastIndex(x => {\n     return x === 'bar';\n});\n",
        expected: [
            "1:15 Prefer Array#lastIndexOf() over Array#findLastIndex() when looking for the index of an item.",
        ],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findLastIndex(function(x) {\n     return x === 'foo';\n});\n",
        expected: [
            "1:15 Prefer Array#lastIndexOf() over Array#findLastIndex() when looking for the index of an item.",
        ],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.indexOf('foo');\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findIndex(x => x !== 'foo');\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findIndex((x, index) => x === index);\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findIndex(x => (x === 'foo') && isValid());\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findIndex(x => y === 'foo');\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findIndex(x => y.x === 'foo');\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findIndex(x => {\n    const bar = getBar();\n    return x === bar;\n});\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findIndex(function(x) {\n    const bar = getBar();\n    return x === bar;\n});\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.lastIndexOf('foo');\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findLastIndex(x => x !== 'foo');\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findLastIndex((x, index) => x === index);\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findLastIndex(x => (x === 'foo') && isValid());\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findLastIndex(x => y === 'foo');\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "const index = foo.findLastIndex(x => y.x === 'foo');\n",
        expected: [],
    },
    {
        rule: "complexity/useIndexOf",
        file: "a.js",
        source: "a.toString(x => x === 1);\n",
        expected: [],
    },
    {
        rule: "complexity/useLiteralKeys",
        file: "a.js",
        source: 'a.b["c"];\n',
        expected: [
            "1:5 The computed expression can be simplified without the use of a string literal.",
        ],
    },
    {
        rule: "complexity/useLiteralKeys",
        file: "a.js",
        source: "a.c[`d`]\n",
        expected: [
            "1:5 The computed expression can be simplified without the use of a string literal.",
        ],
    },
    {
        rule: "complexity/useLiteralKeys",
        file: "a.js",
        source: 'a.c[`d`] = "something"\n',
        expected: [
            "1:5 The computed expression can be simplified without the use of a string literal.",
        ],
    },
    {
        rule: "complexity/useLiteralKeys",
        file: "a.js",
        source: "a = {\n\t['b']: d\n}\n",
        expected: [
            "2:3 The computed expression can be simplified to a string literal.",
        ],
    },
    {
        rule: "complexity/useLiteralKeys",
        file: "a.js",
        source: 'a["c" + "d"];\na[d.c];\n',
        expected: [],
    },
    {
        rule: "complexity/useNumericLiterals",
        file: "a.js",
        source: 'parseInt("111110111", 2);\n',
        expected: [
            "1:1 This call to parseInt() can be replaced by a binary literal.",
        ],
    },
    {
        rule: "complexity/useNumericLiterals",
        file: "a.js",
        source: 'Number.parseInt("767", 8);\n',
        expected: [
            "1:1 This call to Number.parseInt() can be replaced by an octal literal.",
        ],
    },
    {
        rule: "complexity/useNumericLiterals",
        file: "a.js",
        source: 'Number.parseInt("-1f7", 16);\n',
        expected: [
            "1:1 This call to Number.parseInt() can be replaced by a hexadecimal literal.",
        ],
    },
    {
        rule: "complexity/useNumericLiterals",
        file: "a.js",
        source: "parseInt(1);\nparseInt(1, 3);\nNumber.parseInt(1);\nNumber.parseInt(1, 3);\n\n0b111110111 === 503;\n0o767 === 503;\n0x1F7 === 503;\n\na[parseInt](1,2);\n\nparseInt(foo);\nparseInt(foo, 2);\nNumber.parseInt(foo);\nNumber.parseInt(foo, 2);\n",
        expected: [],
    },
    {
        rule: "complexity/useRegexLiterals",
        file: "a.js",
        source: 'new RegExp("abc", "u");\n',
        expected: [
            "1:1 Use a regular expression literal instead of the RegExp constructor.",
        ],
    },
    {
        rule: "complexity/useRegexLiterals",
        file: "a.js",
        source: '/abc/u;\n\nnew RegExp("abc", flags);\n',
        expected: [],
    },
    {
        rule: "complexity/useSimpleNumberKeys",
        file: "a.js",
        source: "({ 0x1: 1 });\n",
        expected: ["1:4 Hexadecimal number literal is not allowed here."],
    },
    {
        rule: "complexity/useSimpleNumberKeys",
        file: "a.js",
        source: '({ 11_1.11: "ee" });\n',
        expected: ["1:4 Number literal with underscore is not allowed here."],
    },
    {
        rule: "complexity/useSimpleNumberKeys",
        file: "a.js",
        source: "({ 0o1: 1 });\n",
        expected: ["1:4 Octal number literal is not allowed here."],
    },
    {
        rule: "complexity/useSimpleNumberKeys",
        file: "a.js",
        source: "({ 1n: 1 });\n",
        expected: ["1:4 Bigint is not allowed here."],
    },
    {
        rule: "complexity/useSimpleNumberKeys",
        file: "a.js",
        source: '({ 11_1.11: "ee" });\n',
        expected: ["1:4 Number literal with underscore is not allowed here."],
    },
    {
        rule: "complexity/useSimpleNumberKeys",
        file: "a.js",
        source: '({ 0: "zero" });\n({ 122: "integer" });\n({ 1.22: "floating point" });\n({ 3.1e12: "floating point with e" });\n',
        expected: [],
    },
    {
        rule: "correctness/noConstantCondition",
        file: "a.js",
        source: "if (false) {\n    doSomethingUnfinished();\n}\n",
        expected: ["1:5 This condition always evaluates to the same value."],
    },
    {
        rule: "correctness/noConstantCondition",
        file: "a.js",
        source: "if (Boolean(1)) {\n    doSomethingAlways();\n}\n",
        expected: ["1:5 This condition always evaluates to the same value."],
    },
    {
        rule: "correctness/noConstantCondition",
        file: "a.js",
        source: "if (undefined) {\n    doSomethingUnfinished();\n}\n",
        expected: ["1:5 This condition always evaluates to the same value."],
    },
    {
        rule: "correctness/noConstantCondition",
        file: "a.js",
        source: "for (;-2;) {\n    doSomethingForever();\n}\n",
        expected: ["1:7 This condition always evaluates to the same value."],
    },
    {
        rule: "correctness/noConstantCondition",
        file: "a.js",
        source: "while (typeof x) {\n    doSomethingForever();\n}\n",
        expected: ["1:8 This condition always evaluates to the same value."],
    },
    {
        rule: "correctness/noConstantCondition",
        file: "a.js",
        source: "var result = 0 ? a : b;\n",
        expected: ["1:14 This condition always evaluates to the same value."],
    },
    {
        rule: "correctness/noConstantCondition",
        file: "a.js",
        source: 'if (x === 0) {\n    doSomething();\n}\n\nfor (;;) {\n    doSomethingForever();\n}\n\nwhile (typeof x === "undefined") {\n    doSomething();\n}\n\ndo {\n    doSomething();\n} while (x);\n\nvar result = x !== 0 ? a : b;\n\n// Exception\nwhile (true) {\n    if (x) { break; }\n    x = f();\n}\n',
        expected: [],
    },
    {
        rule: "correctness/noConstantMathMinMaxClamp",
        file: "a.js",
        source: "Math.min(0, Math.max(100, x));\n",
        expected: [
            "1:1 This Math.min/Math.max combination leads to a constant result.",
        ],
    },
    {
        rule: "correctness/noConstantMathMinMaxClamp",
        file: "a.js",
        source: "Math.max(100, Math.min(0, x));\n",
        expected: [
            "1:1 This Math.min/Math.max combination leads to a constant result.",
        ],
    },
    {
        rule: "correctness/noConstantMathMinMaxClamp",
        file: "a.js",
        source: "Math.min(100, Math.max(0, x));\n",
        expected: [],
    },
    {
        rule: "correctness/noConstantMathMinMaxClamp",
        file: "a.js",
        source: "Math.min(Math.max(x, 100), 0);\nMath.min(-5, Math.max(5, x));\n",
        expected: [
            "1:1 This Math.min/Math.max combination leads to a constant result.",
        ],
    },
    {
        rule: "correctness/noConstAssign",
        file: "a.js",
        source: "const a = 1;\na = 4;\n",
        expected: ["2:1 Can't assign a because it's a constant."],
    },
    {
        rule: "correctness/noConstAssign",
        file: "a.js",
        source: "const a = 2;\na += 1;\n",
        expected: ["2:1 Can't assign a because it's a constant."],
    },
    {
        rule: "correctness/noConstAssign",
        file: "a.js",
        source: "const a = 1;\n++a;\n",
        expected: ["2:3 Can't assign a because it's a constant."],
    },
    {
        rule: "correctness/noConstAssign",
        file: "a.js",
        source: "const a = 1, b = 2;\n\na = 2;\n",
        expected: ["3:1 Can't assign a because it's a constant."],
    },
    {
        rule: "correctness/noConstAssign",
        file: "a.js",
        source: "const a = 10;\nlet b = 10;\nb = 20;\n",
        expected: [],
    },
    {
        rule: "correctness/noConstructorReturn",
        file: "a.js",
        source: "class A {\n    constructor() {\n        return 0;\n    }\n}\n",
        expected: ["3:9 The constructor should not return a value."],
    },
    {
        rule: "correctness/noConstructorReturn",
        file: "a.js",
        source: "class A {\n    constructor() {}\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noConstructorReturn",
        file: "a.js",
        source: "class B {\n    constructor(x) {\n        return;\n    }\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noEmptyCharacterClassInRegex",
        file: "a.js",
        source: '/^a[]/.test("a"); // false\n',
        expected: [
            "1:4 The regular expression includes this empty character class.",
        ],
    },
    {
        rule: "correctness/noEmptyCharacterClassInRegex",
        file: "a.js",
        source: '/^a[^]/.test("ax"); // true\n',
        expected: [
            "1:4 The regular expression includes this negated empty character class.",
        ],
    },
    {
        rule: "correctness/noEmptyCharacterClassInRegex",
        file: "a.js",
        source: '/^a[xy]/.test("ay"); // true\n',
        expected: [],
    },
    {
        rule: "correctness/noEmptyCharacterClassInRegex",
        file: "a.js",
        source: '/^a[^xy]/.test("ab"); // true\n',
        expected: [],
    },
    {
        rule: "correctness/noEmptyCharacterClassInRegex",
        file: "a.js",
        source: '/^a\\[]/.test("a[]"); // true\n',
        expected: [],
    },
    {
        rule: "correctness/noEmptyPattern",
        file: "a.js",
        source: "var {} = foo;\n",
        expected: ["1:5 Unexpected empty object pattern."],
    },
    {
        rule: "correctness/noEmptyPattern",
        file: "a.js",
        source: "var {a: {}} = foo;\n",
        expected: ["1:9 Unexpected empty object pattern."],
    },
    {
        rule: "correctness/noEmptyPattern",
        file: "a.js",
        source: "function foo({}) {}\n",
        expected: ["1:14 Unexpected empty object pattern."],
    },
    {
        rule: "correctness/noEmptyPattern",
        file: "a.js",
        source: "var {a = {}} = foo;\nvar {a, b = {}} = foo;\nvar {a = []} = foo;\nfunction foo({a = {}}) {}\nfunction foo({a = []}) {}\nvar [a] = foo;\n",
        expected: [],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: "var math = Math();\n",
        expected: ["1:12 Math cannot be called as a function."],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: "var newMath = new Math();\n",
        expected: ["1:19 Math cannot be called as a function."],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: "var json = JSON();\n",
        expected: ["1:12 JSON cannot be called as a function."],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: "var newJSON = new JSON();\n",
        expected: ["1:19 JSON cannot be called as a function."],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: "var reflect = Reflect();\n",
        expected: ["1:15 Reflect cannot be called as a function."],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: "var newReflect = new Reflect();\n",
        expected: ["1:22 Reflect cannot be called as a function."],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: "var atomics = Atomics();\n",
        expected: ["1:15 Atomics cannot be called as a function."],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: "var newAtomics = new Atomics();\n",
        expected: ["1:22 Atomics cannot be called as a function."],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: "var intl = Intl();\n",
        expected: ["1:12 Intl cannot be called as a function."],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: "var newIntl = new Intl();\n",
        expected: ["1:19 Intl cannot be called as a function."],
    },
    {
        rule: "correctness/noGlobalObjectCalls",
        file: "a.js",
        source: 'function area(r) {\n    return Math.PI * r * r;\n}\n\nvar object = JSON.parse("{}");\n\nvar value = Reflect.get({ x: 1, y: 2 }, "x");\n\nvar first = Atomics.load(foo, 0);\n\nvar segmenterFr = new Intl.Segmenter("fr", { granularity: "word" });\n',
        expected: [],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.cjs",
        source: "if (test) {\n    function f() {}\n}\n",
        expected: [
            "2:5 This function should be declared at the root of the script.",
        ],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.js",
        source: "if (test) {\n    var x = 1;\n}\n",
        expected: [
            "2:5 This var should be declared at the root of the module.",
        ],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.cjs",
        source: "function f() {\n    if (test) {\n        function g() {}\n    }\n}\n",
        expected: [
            "3:9 This function should be declared at the root of the enclosing function.",
        ],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.js",
        source: "function f() {\n    if (test) {\n        var x = 1;\n    }\n}\n",
        expected: [
            "3:9 This var should be declared at the root of the enclosing function.",
        ],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.js",
        source: "// inside a module, function declarations are block-scoped and thus allowed.\nif (test) {\n    function f() {}\n}\nexport {}\n",
        expected: [],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.js",
        source: "function f() { }\n",
        expected: [],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.js",
        source: "function f() {\n    function g() {}\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.js",
        source: "function f() {\n    var x = 1;\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.js",
        source: "function f() {\n    if (test) {\n        const g = function() {};\n    }\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.js",
        source: "class S { static { if (a) { var x = 1; } } }\nfor (var i = 0; i < 1; i++) {}\nif (a) for (var j of b) {}\nfunction f() { for (var k = 0; ; ) {} }\n",
        expected: [
            "1:29 This var should be declared at the root of the static block.",
            "2:6 This var should be declared at the root of the module.",
            "4:21 This var should be declared at the root of the enclosing function.",
        ],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.cjs",
        source: "if (a) { function f() {} }\nclass S2 { static { if (a) { function g() {} } } }\n",
        expected: [
            "1:10 This function should be declared at the root of the script.",
            "2:30 This function should be declared at the root of the static block.",
        ],
    },
    {
        rule: "correctness/noInnerDeclarations",
        file: "a.ts",
        source: 'namespace N { if (a) { var x = 1; } var y = 2; }\ndeclare module "m" { var z: number; }\nexport var q = 1;\nswitch (a) { case 1: var s = 1; }\n',
        expected: [
            "1:24 This var should be declared at the root of the enclosing function.",
            "4:22 This var should be declared at the root of the module.",
        ],
    },
    {
        rule: "correctness/noInvalidBuiltinInstantiation",
        file: "a.js",
        source: "const text = new BigInt(1);\n",
        expected: ["1:14 Use BigInt() instead of new BigInt()."],
    },
    {
        rule: "correctness/noInvalidBuiltinInstantiation",
        file: "a.js",
        source: "const map = Map([\n  ['foo', 'bar']\n]);\n",
        expected: ["1:13 Use new Map() instead of Map()."],
    },
    {
        rule: "correctness/noInvalidBuiltinInstantiation",
        file: "a.js",
        source: "const text = BigInt(1);\n",
        expected: [],
    },
    {
        rule: "correctness/noInvalidBuiltinInstantiation",
        file: "a.js",
        source: "const map = new Map([\n ['foo', 'bar']\n]);\n",
        expected: [],
    },
    {
        rule: "correctness/noInvalidConstructorSuper",
        file: "a.js",
        source: "class A {\n    constructor() {\n        super();\n    }\n}\n",
        expected: [
            "3:9 This class should not have a super() call. You should remove it.",
        ],
    },
    {
        rule: "correctness/noInvalidConstructorSuper",
        file: "a.js",
        source: "class A extends undefined {\n    constructor() {\n        super();\n    }\n}\n",
        expected: [
            "3:9 This class calls super(), but the class extends from a non-constructor.",
        ],
    },
    {
        rule: "correctness/noInvalidConstructorSuper",
        file: "a.js",
        source: "export default class A extends B {\n    constructor() {\n        super();\n    }\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noInvalidConstructorSuper",
        file: "a.js",
        source: "export class A {\n    constructor() {}\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noInvalidConstructorSuper",
        file: "a.js",
        source: "class A extends B { constructor() { foo(); } }\nclass A3 extends null { constructor() { super(); } }\nclass A4 extends 5 { constructor() { super(); } }\n",
        expected: [
            "2:41 This class calls super(), but the class extends from a non-constructor.",
            "3:38 This class calls super(), but the class extends from a non-constructor.",
        ],
    },
    {
        rule: "correctness/noInvalidUseBeforeDeclaration",
        file: "a.js",
        source: "function f() {\n    console.log(x);\n    let x;\n}\n",
        expected: ["2:17 This variable is used before its declaration."],
    },
    {
        rule: "correctness/noInvalidUseBeforeDeclaration",
        file: "a.js",
        source: "function f() {\n    console.log(x);\n    var x = 0;\n}\n",
        expected: ["2:17 This variable is used before its declaration."],
    },
    {
        rule: "correctness/noInvalidUseBeforeDeclaration",
        file: "a.js",
        source: "function f(a = b, b = 0) {}\n",
        expected: ["1:16 This parameter is used before its declaration."],
    },
    {
        rule: "correctness/noInvalidUseBeforeDeclaration",
        file: "a.js",
        source: "new C();\nclass C {}\n",
        expected: ["1:5 This class is used before its declaration."],
    },
    {
        rule: "correctness/noInvalidUseBeforeDeclaration",
        file: "a.js",
        source: "f();\nfunction f() {}\n",
        expected: [],
    },
    {
        rule: "correctness/noInvalidUseBeforeDeclaration",
        file: "a.js",
        source: "// An export can reference a variable before its declaration.\nexport { CONSTANT };\nconst CONSTANT = 0;\n",
        expected: [],
    },
    {
        rule: "correctness/noInvalidUseBeforeDeclaration",
        file: "a.js",
        source: "function f() { return CONSTANT; }\nconst CONSTANT = 0;\n",
        expected: [],
    },
    {
        rule: "correctness/noInvalidUseBeforeDeclaration",
        file: "a.ts",
        source: "function f() {\n    new C();\n}\nlet c: C;\nclass C {}\n",
        expected: [],
    },
    {
        rule: "correctness/noInvalidUseBeforeDeclaration",
        file: "a.ts",
        source: "const e = E.A;\nenum E { A }\nfunction h() { return z; }\nlet z = 1;\nfoo(y);\nusing y = a;\ntype T = typeof w;\nconst w = 1;\n",
        expected: [
            "1:11 This enum is used before its declaration.",
            "5:5 This variable is used before its declaration.",
        ],
    },
    {
        rule: "correctness/noNonoctalDecimalEscape",
        file: "a.js",
        source: 'const x = "\\8";\n',
        expected: [
            "1:12 Don't use `\\8` and `\\9` escape sequences in string literals.",
        ],
    },
    {
        rule: "correctness/noNonoctalDecimalEscape",
        file: "a.js",
        source: 'const x = "Don\'t use \\8 escape.";\n',
        expected: [
            "1:22 Don't use `\\8` and `\\9` escape sequences in string literals.",
        ],
    },
    {
        rule: "correctness/noNonoctalDecimalEscape",
        file: "a.js",
        source: 'const x = "Don\'t use \\9 escape.";\n',
        expected: [
            "1:22 Don't use `\\8` and `\\9` escape sequences in string literals.",
        ],
    },
    {
        rule: "correctness/noNonoctalDecimalEscape",
        file: "a.js",
        source: 'const x = "8";\n',
        expected: [],
    },
    {
        rule: "correctness/noNonoctalDecimalEscape",
        file: "a.js",
        source: 'const x = "Don\'t use \\\\8 and \\\\9 escapes.";\n',
        expected: [],
    },
    {
        rule: "correctness/noPrecisionLoss",
        file: "a.js",
        source: "const x = 9007199254740993\n",
        expected: ["1:11 This number literal will lose precision at runtime."],
    },
    {
        rule: "correctness/noPrecisionLoss",
        file: "a.js",
        source: "const x = 5.123000000000000000000000000001\n",
        expected: ["1:11 This number literal will lose precision at runtime."],
    },
    {
        rule: "correctness/noPrecisionLoss",
        file: "a.js",
        source: "const x = 0x20000000000001\n",
        expected: ["1:11 This number literal will lose precision at runtime."],
    },
    {
        rule: "correctness/noPrecisionLoss",
        file: "a.js",
        source: "const x = 0x2_000000000_0001;\n",
        expected: ["1:11 This number literal will lose precision at runtime."],
    },
    {
        rule: "correctness/noPrecisionLoss",
        file: "a.js",
        source: "const x = 12345\nconst x = 123.456\nconst x = 123e34\nconst x = 12300000000000000000000000\nconst x = 0x1FFFFFFFFFFFFF\nconst x = 9007199254740991\nconst x = 9007_1992547409_91\n",
        expected: [],
    },
    {
        rule: "correctness/noSelfAssign",
        file: "a.js",
        source: "a = a;\n",
        expected: ["1:5 a is assigned to itself."],
    },
    {
        rule: "correctness/noSelfAssign",
        file: "a.js",
        source: "[a] = [a];\n",
        expected: ["1:8 a is assigned to itself."],
    },
    {
        rule: "correctness/noSelfAssign",
        file: "a.js",
        source: "({a: b} = {a: b});\n",
        expected: ["1:15 b is assigned to itself."],
    },
    {
        rule: "correctness/noSelfAssign",
        file: "a.js",
        source: "a.b = a.b;\n",
        expected: ["1:9 b is assigned to itself."],
    },
    {
        rule: "correctness/noSelfAssign",
        file: "a.js",
        source: "a[b] = a[b];\n",
        expected: ["1:10 b is assigned to itself."],
    },
    {
        rule: "correctness/noSelfAssign",
        file: "a.js",
        source: "a[b].foo = a[b].foo;\n",
        expected: ["1:17 foo is assigned to itself."],
    },
    {
        rule: "correctness/noSelfAssign",
        file: "a.js",
        source: "a['b'].foo = a['b'].foo;\n",
        expected: ["1:21 foo is assigned to itself."],
    },
    {
        rule: "correctness/noSelfAssign",
        file: "a.js",
        source: "a &= a;\nvar a = a;\nlet a = a;\nconst a = a;\n[a, b] = [b, a];\n",
        expected: [],
    },
    {
        rule: "correctness/noSetterReturn",
        file: "a.js",
        source: "class A {\n    set foo(x) {\n        return x;\n    }\n}\n",
        expected: ["3:9 The setter should not return a value."],
    },
    {
        rule: "correctness/noSetterReturn",
        file: "a.js",
        source: "const b = {\n    set foo(x) {\n        return x;\n    },\n};\n",
        expected: ["3:9 The setter should not return a value."],
    },
    {
        rule: "correctness/noSetterReturn",
        file: "a.js",
        source: "const c = {\n    set foo(x) {\n        if (x) {\n            return x;\n        }\n    },\n};\n",
        expected: ["4:13 The setter should not return a value."],
    },
    {
        rule: "correctness/noSetterReturn",
        file: "a.js",
        source: "// early-return\nclass A {\n    set foo(x) {\n        if (x) {\n            return;\n        }\n    }\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noSetterReturn",
        file: "a.js",
        source: "// not a setter\nclass B {\n  set(x) {\n    return x;\n  }\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noStringCaseMismatch",
        file: "a.js",
        source: 'if (s.toUpperCase() === "Abc") {}\n',
        expected: ["1:5 This expression always returns false."],
    },
    {
        rule: "correctness/noStringCaseMismatch",
        file: "a.js",
        source: 'while (s.toLowerCase() === "Abc") {}\n',
        expected: ["1:8 This expression always returns false."],
    },
    {
        rule: "correctness/noStringCaseMismatch",
        file: "a.js",
        source: 'if (s.toUpperCase() === "ABC") {}\nwhile (s.toLowerCase() === "abc") {}\nfor (;s.toLocaleLowerCase() === "ABC";) {}\nwhile (s.toLocaleUpperCase() === "abc") {}\nfor (let s = "abc"; s === "abc"; s = s.toUpperCase()) {}\n',
        expected: [],
    },
    {
        rule: "correctness/noStringCaseMismatch",
        file: "a.js",
        source: 'if (s.toUpperCase() !== "Abc") {}\nif ("Abc" == s.toLowerCase()) {}\nswitch (s.toUpperCase()) { case "abc": break; }\nif (a.toString() === "Abc") {}\n',
        expected: [
            "2:5 This expression always returns false.",
            "3:33 This case will never match.",
        ],
    },
    {
        rule: "correctness/noSwitchDeclarations",
        file: "a.js",
        source: "switch (foo) {\n    case 0:\n        const x = 1;\n        break;\n    case 2:\n        x; // `x` can be used while it is not initialized\n        break;\n}\n",
        expected: [
            "3:9 Other switch clauses can erroneously access this declaration.\nWrap the declaration in a block to restrict its access to the switch clause.",
        ],
    },
    {
        rule: "correctness/noSwitchDeclarations",
        file: "a.js",
        source: "switch (foo) {\n    case 0:\n        function f() {}\n        break;\n    case 2:\n        f(); // `f` can be called here\n        break;\n}\n",
        expected: [
            "3:9 Other switch clauses can erroneously access this declaration.\nWrap the declaration in a block to restrict its access to the switch clause.",
        ],
    },
    {
        rule: "correctness/noSwitchDeclarations",
        file: "a.js",
        source: "switch (foo) {\n    case 0:\n        class A {}\n        break;\n    default:\n        new A(); // `A` can be instantiated here\n        break;\n}\n",
        expected: [
            "3:9 Other switch clauses can erroneously access this declaration.\nWrap the declaration in a block to restrict its access to the switch clause.",
        ],
    },
    {
        rule: "correctness/noSwitchDeclarations",
        file: "a.js",
        source: "switch (foo) {\n    case 0: {\n        const x = 1;\n        break;\n    }\n    case 1:\n        // `x` is not visible here\n        break;\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noUnreachable",
        file: "a.js",
        source: "function example() {\n    return;\n    neverCalled();\n}\n",
        expected: ["3:5 This code will never be reached ..."],
    },
    {
        rule: "correctness/noUnreachable",
        file: "a.js",
        source: "function example() {\n    for(let i = 0; i < 10; ++i) {\n        break;\n    }\n}\n",
        expected: ["2:28 This code will never be reached ..."],
    },
    {
        rule: "correctness/noUnreachable",
        file: "a.js",
        source: "function example() {\n    for(const key in value) {\n        continue;\n        neverCalled();\n    }\n}\n",
        expected: ["4:9 This code will never be reached ..."],
    },
    {
        rule: "correctness/noUnsafeFinally",
        file: "a.js",
        source: "(() => {\n    try {\n        return 1; // 1 is returned but suspended until finally block ends\n    } catch(err) {\n        return 2;\n    } finally {\n        return 3; // 3 is returned before 1, which we did not expect\n    }\n})();\n",
        expected: ["7:9 Unsafe usage of 'return'."],
    },
    {
        rule: "correctness/noUnsafeFinally",
        file: "a.js",
        source: '(() => {\n    try {\n        throw new Error("Try"); // error is thrown but suspended until finally block ends\n    } finally {\n        return 3; // 3 is returned before the error is thrown, which we did not expect\n    }\n})();\n',
        expected: ["5:9 Unsafe usage of 'return'."],
    },
    {
        rule: "correctness/noUnsafeFinally",
        file: "a.js",
        source: '(() => {\n    try {\n        throw new Error("Try")\n    } catch(err) {\n        throw err; // The error thrown from try block is caught and re-thrown\n    } finally {\n        throw new Error("Finally"); // Finally(...) is thrown, which we did not expect\n    }\n})();\n',
        expected: ["7:9 Unsafe usage of 'throw'."],
    },
    {
        rule: "correctness/noUnsafeFinally",
        file: "a.js",
        source: "(() => {\n    label: try {\n      return 0; // 0 is returned but suspended until finally block ends\n    } finally {\n      break label; // It breaks out the try-finally block, before 0 is returned.\n    }\n    return 1;\n})();\n",
        expected: ["5:7 Unsafe usage of 'break'."],
    },
    {
        rule: "correctness/noUnsafeFinally",
        file: "a.js",
        source: "function a() {\n  switch (condition) {\n    case 'a': {\n      try {\n        console.log('a');\n        return;\n      } finally {\n        break;\n      }\n    }\n    case 'b': {\n      console.log('b');\n    }\n  }\n}\n",
        expected: ["8:9 Unsafe usage of 'break'."],
    },
    {
        rule: "correctness/noUnsafeFinally",
        file: "a.js",
        source: 'let foo = function() {\n    try {\n        return 1;\n    } catch(err) {\n        return 2;\n    } finally {\n        console.log("hola!");\n    }\n};\n',
        expected: [],
    },
    {
        rule: "correctness/noUnsafeFinally",
        file: "a.js",
        source: 'let foo = function() {\n    try {\n        return 1;\n    } catch(err) {\n        return 2;\n    } finally {\n        let a = function() {\n            return "hola!";\n        }\n    }\n};\n',
        expected: [],
    },
    {
        rule: "correctness/noUnsafeFinally",
        file: "a.js",
        source: 'let foo = function(a) {\n    try {\n        return 1;\n    } catch(err) {\n        return 2;\n    } finally {\n        switch(a) {\n            case 1: {\n                console.log("hola!")\n                break;\n            }\n        }\n    }\n};\n',
        expected: [],
    },
    {
        rule: "correctness/noUnsafeOptionalChaining",
        file: "a.js",
        source: "1 in obj?.foo;\n",
        expected: ["1:9 Unsafe usage of optional chaining."],
    },
    {
        rule: "correctness/noUnsafeOptionalChaining",
        file: "a.cjs",
        source: "with (obj?.foo);\n",
        expected: ["1:10 Unsafe usage of optional chaining."],
    },
    {
        rule: "correctness/noUnsafeOptionalChaining",
        file: "a.js",
        source: "for (bar of obj?.foo);\n",
        expected: ["1:16 Unsafe usage of optional chaining."],
    },
    {
        rule: "correctness/noUnsafeOptionalChaining",
        file: "a.js",
        source: "bar instanceof obj?.foo;\n",
        expected: ["1:19 Unsafe usage of optional chaining."],
    },
    {
        rule: "correctness/noUnsafeOptionalChaining",
        file: "a.js",
        source: "const { bar } = obj?.foo;\n",
        expected: ["1:20 Unsafe usage of optional chaining."],
    },
    {
        rule: "correctness/noUnsafeOptionalChaining",
        file: "a.js",
        source: "(obj?.foo)();\n",
        expected: ["1:5 Unsafe usage of optional chaining."],
    },
    {
        rule: "correctness/noUnsafeOptionalChaining",
        file: "a.js",
        source: "(baz?.bar).foo;\n",
        expected: ["1:5 Unsafe usage of optional chaining."],
    },
    {
        rule: "correctness/noUnsafeOptionalChaining",
        file: "a.js",
        source: "(obj?.foo)?.();\nobj?.foo();\n(obj?.foo ?? bar)();\nobj?.foo.bar;\nobj.foo?.bar;\nfoo?.()?.bar;\n",
        expected: [],
    },
    {
        rule: "correctness/noUnsafeOptionalChaining",
        file: "a.js",
        source: "[...obj?.foo];\nfoo(...obj?.foo);\nnew (obj?.foo)();\nclass Q extends obj?.foo {}\n(a?.b?.c).d;\n(a && b?.c).d;\n(a || b?.c).d;\n(a ? b?.c : d).e;\n[a] = obj?.foo;\n",
        expected: [
            "1:8 Unsafe usage of optional chaining.",
            "2:11 Unsafe usage of optional chaining.",
            "3:9 Unsafe usage of optional chaining.",
            "4:20 Unsafe usage of optional chaining.",
            "5:6 Unsafe usage of optional chaining.",
            "6:8 Unsafe usage of optional chaining.",
            "7:8 Unsafe usage of optional chaining.",
            "8:7 Unsafe usage of optional chaining.",
            "9:10 Unsafe usage of optional chaining.",
        ],
    },
    {
        rule: "correctness/noUnusedFunctionParameters",
        file: "a.js",
        source: "function foo(myVar) {\n    console.log('foo');\n}\n",
        expected: ["1:14 This parameter myVar is unused."],
    },
    {
        rule: "correctness/noUnusedFunctionParameters",
        file: "a.js",
        source: "new Promise((accept, reject) => {\n    window.setTimeout(accept, 1000);\n});\n",
        expected: ["1:22 This parameter reject is unused."],
    },
    {
        rule: "correctness/noUnusedFunctionParameters",
        file: "a.js",
        source: "const squares = [[1, 1], [2, 4], [3, 9], [4, 16]];\nsquares.filter(([k, v]) => v > 5);\n",
        expected: ["2:18 This parameter k is unused."],
    },
    {
        rule: "correctness/noUnusedFunctionParameters",
        file: "a.js",
        source: "function foo(myVar) {\n    console.log(myVar);\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedFunctionParameters",
        file: "a.js",
        source: "function withObjectSpread({ a, ...rest }) {\n\t    return rest;\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedFunctionParameters",
        file: "a.js",
        options: { ignoreRestSiblings: false },
        source: "function withObjectSpread({ b, ...rest }) {\n\t    return rest;\n}\n",
        expected: ["1:29 This parameter b is unused."],
    },
    {
        rule: "correctness/noUnusedImports",
        file: "a.js",
        source: "import A from 'mod';\n",
        expected: ["1:8 This import is unused."],
    },
    {
        rule: "correctness/noUnusedImports",
        file: "a.js",
        source: "import * as A from 'mod';\n",
        expected: ["1:13 This import is unused."],
    },
    {
        rule: "correctness/noUnusedImports",
        file: "a.ts",
        source: "import { type A, B } from 'mod';\n\nexport { B }\n",
        expected: ["1:10 Several of these imports are unused."],
    },
    {
        rule: "correctness/noUnusedImports",
        file: "a.ts",
        source: "// Header comment\nimport /*inner comment */ A from 'mod'; // Associated comment\n",
        expected: ["2:27 This import is unused."],
    },
    {
        rule: "correctness/noUnusedImports",
        file: "a.ts",
        source: "// Another header comment\nimport {\n    // A's header comment\n    type A, // A's comment\n    // B's header comment\n    B,\n} from 'mod';\n\nexport { B }\n",
        expected: ["4:5 Several of these imports are unused."],
    },
    {
        rule: "correctness/noUnusedImports",
        file: "a.ts",
        source: "import { A, type B } from 'mod';\n\nfunction f(arg: B): A {\n    return new A(arg);\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedImports",
        file: "a.ts",
        source: "import type {} from '@mui/lab/themeAugmentation';\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedLabels",
        file: "a.js",
        source: "LOOP: for (const x of xs) {\n    if (x > 0) {\n        break;\n    }\n    f(x);\n}\n",
        expected: ["1:1 Unused label."],
    },
    {
        rule: "correctness/noUnusedLabels",
        file: "a.js",
        source: "LOOP: for (const x of xs) {\n    if (x > 0) {\n        break LOOP;\n    }\n    f(x);\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedLabels",
        file: "a.js",
        source: "function nonNegative(n) {\n    DEV: assert(n >= 0);\n    return n;\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedPrivateClassMembers",
        file: "a.js",
        source: "class OnlyWrite {\n  #usedOnlyInWrite = 5;\n\n  method() {\n\t    this.#usedOnlyInWrite = 212;\n  }\n}\n",
        expected: ["2:3 This private class member is defined but never used."],
    },
    {
        rule: "correctness/noUnusedPrivateClassMembers",
        file: "a.ts",
        source: " class TsBioo {\n   private unusedProperty = 5;\n }\n",
        expected: ["2:12 This private class member is defined but never used."],
    },
    {
        rule: "correctness/noUnusedPrivateClassMembers",
        file: "a.ts",
        source: " class TsBioo {\n   private unusedMethod() {}\n }\n",
        expected: ["2:12 This private class member is defined but never used."],
    },
    {
        rule: "correctness/noUnusedPrivateClassMembers",
        file: "a.js",
        source: "class UsedMember {\n  #usedMember = 42;\n\n  method() {\n\t    return this.#usedMember;\n  }\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedPrivateClassMembers",
        file: "a.js",
        source: "class UsedMember {\n  #usedMember;\n\n  method() {\n    this.#usedMember ??= getValue();\n  }\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedPrivateClassMembers",
        file: "a.ts",
        source: " class TsBioo {\n   private member: number;\n\n   set_with_name(name: string, value: number) {\n     this[name] = value;\n   }\n }\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedPrivateClassMembers",
        file: "a.ts",
        source: "declare class A {\n    private a: number;\n}\nclass B {\n    #used = 1;\n    m() {\n        return #used in this;\n    }\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.js",
        source: "let a = 4;\na++;\n",
        expected: ["1:5 This variable a is unused."],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.js",
        source: "function foo() {}\n",
        expected: ["1:10 This function foo is unused."],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.js",
        source: "function foo() {\n    foo();\n}\n",
        expected: ["1:10 This function foo is unused."],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.js",
        source: "const foo = () => {\n    foo();\n};\n",
        expected: ["1:7 This variable foo is unused."],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.ts",
        source: "export function f<T>() {}\n",
        expected: ["1:19 This type parameter T is unused."],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.js",
        source: "const { brand } = car;\n",
        expected: ["1:9 This variable brand is unused."],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.js",
        source: "function foo(b) {\n    console.log(b)\n};\nfoo();\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.js",
        source: "export function foo(_unused) {}\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.ts",
        source: "function used_overloaded(): number;\nfunction used_overloaded(s: string): string;\nfunction used_overloaded(s?: string) {\n    return s;\n}\nused_overloaded();\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.js",
        source: 'const car = { brand: "Tesla", year: 2019, countryCode: "US" };\nconst { brand, ...rest } = car;\nconsole.log(rest);\n',
        expected: [],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.ts",
        source: "const MyComponent = () => {};\nnamespace MyComponent {\n    export type Props = { id: string };\n}\nexport default MyComponent;\n",
        expected: [],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.js",
        options: { ignoreRestSiblings: false },
        source: 'const car = { brand: "Tesla", year: 2019, countryCode: "US" };\nconst { brand, ...other } = car;\nconsole.log(other);\n',
        expected: ["2:9 This variable brand is unused."],
    },
    {
        rule: "correctness/noUnusedVariables",
        file: "a.js",
        options: { ignoreRestSiblings: false },
        source: 'const car = { brand: "Tesla", year: 2019, countryCode: "US" };\nconst { brand: _, ...other } = car;\nconsole.log(other);\n',
        expected: [],
    },
    {
        rule: "correctness/noVoidElementsWithChildren",
        file: "a.jsx",
        source: "<br>invalid child</br>\n",
        expected: ["1:1 br is a void element tag and must not have children."],
    },
    {
        rule: "correctness/noVoidElementsWithChildren",
        file: "a.jsx",
        source: '<img alt="some text" children={"some child"} />\n',
        expected: ["1:1 img is a void element tag and must not have children."],
    },
    {
        rule: "correctness/noVoidElementsWithChildren",
        file: "a.js",
        source: "React.createElement('img', {}, 'child')\n",
        expected: ["1:1 img is a void element tag and must not have children."],
    },
    {
        rule: "correctness/noVoidElementsWithChildren",
        file: "a.jsx",
        source: '<br dangerouslySetInnerHTML={{__html: "a"}} />;\n<hr></hr>;\n<img children="a">b</img>;\n',
        expected: [
            "1:1 br is a void element tag and must not have the dangerouslySetInnerHTML prop.",
            "3:1 img is a void element tag and must not have children.",
        ],
    },
    {
        rule: "correctness/noVoidTypeReturn",
        file: "a.ts",
        source: "class A {\n    f(): void {\n        return undefined;\n    }\n}\n",
        expected: [
            "3:9 The function should not return a value because its return type is void.",
        ],
    },
    {
        rule: "correctness/noVoidTypeReturn",
        file: "a.ts",
        source: "const a = {\n    f(): void {\n        return undefined;\n    }\n}\n",
        expected: [
            "3:9 The function should not return a value because its return type is void.",
        ],
    },
    {
        rule: "correctness/noVoidTypeReturn",
        file: "a.ts",
        source: "function f(): void {\n    return undefined;\n}\n",
        expected: [
            "2:5 The function should not return a value because its return type is void.",
        ],
    },
    {
        rule: "correctness/noVoidTypeReturn",
        file: "a.ts",
        source: "export default function(): void {\n    return undefined;\n}\n",
        expected: [
            "2:5 The function should not return a value because its return type is void.",
        ],
    },
    {
        rule: "correctness/noVoidTypeReturn",
        file: "a.ts",
        source: "const g = (): void => {\n    return undefined;\n};\n",
        expected: [
            "2:5 The function should not return a value because its return type is void.",
        ],
    },
    {
        rule: "correctness/noVoidTypeReturn",
        file: "a.ts",
        source: "const h = function(): void {\n    return undefined;\n};\n",
        expected: [
            "2:5 The function should not return a value because its return type is void.",
        ],
    },
    {
        rule: "correctness/noVoidTypeReturn",
        file: "a.js",
        source: "class A {\n    f() {\n        return undefined;\n    }\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noVoidTypeReturn",
        file: "a.ts",
        source: "class B {\n    f(): void {}\n}\n",
        expected: [],
    },
    {
        rule: "correctness/noVoidTypeReturn",
        file: "a.ts",
        source: "function f(): void {\n    return;\n}\n",
        expected: [],
    },
    {
        rule: "correctness/useIsNan",
        file: "a.js",
        source: "123 == NaN\n",
        expected: ["1:1 Use the Number.isNaN function to compare with NaN."],
    },
    {
        rule: "correctness/useIsNan",
        file: "a.js",
        source: "123 != NaN\n",
        expected: ["1:1 Use the Number.isNaN function to compare with NaN."],
    },
    {
        rule: "correctness/useIsNan",
        file: "a.js",
        source: "switch(foo) { case (NaN): break; }\n",
        expected: [
            "1:20 'case NaN' can never match. Use Number.isNaN before the switch.",
        ],
    },
    {
        rule: "correctness/useIsNan",
        file: "a.js",
        source: 'Number.NaN == "abc"\n',
        expected: ["1:1 Use the Number.isNaN function to compare with NaN."],
    },
    {
        rule: "correctness/useIsNan",
        file: "a.js",
        source: "if (Number.isNaN(123) !== true) {}\n\nfoo(Number.NaN / 2)\n\nswitch(foo) {}\n",
        expected: [],
    },
    {
        rule: "correctness/useParseIntRadix",
        file: "a.js",
        source: 'parseInt("071");\n',
        expected: ["1:1 Missing radix parameter"],
    },
    {
        rule: "correctness/useParseIntRadix",
        file: "a.js",
        source: "parseInt(someValue);\n",
        expected: ["1:1 Missing radix parameter"],
    },
    {
        rule: "correctness/useParseIntRadix",
        file: "a.js",
        source: 'parseInt("071", "abc");\n',
        expected: ["1:1 Invalid radix parameter"],
    },
    {
        rule: "correctness/useParseIntRadix",
        file: "a.js",
        source: 'parseInt("071", 37);\n',
        expected: ["1:1 Invalid radix parameter"],
    },
    {
        rule: "correctness/useParseIntRadix",
        file: "a.js",
        source: "parseInt();\n",
        expected: [
            "1:1 This call to parseInt has no arguments, it will always return NaN",
        ],
    },
    {
        rule: "correctness/useParseIntRadix",
        file: "a.js",
        source: 'parseInt("071", 10);\nparseInt("071", 8);\nparseFloat(someValue);\n',
        expected: [],
    },
    {
        rule: "correctness/useValidForDirection",
        file: "a.js",
        source: "for (var i = 0; i < 10; i--) {\n}\n",
        expected: [
            "1:5 The update clause in this loop moves the variable in the wrong direction.",
        ],
    },
    {
        rule: "correctness/useValidForDirection",
        file: "a.js",
        source: "for (var i = 10; i >= 0; i++) {\n}\n",
        expected: [
            "1:5 The update clause in this loop moves the variable in the wrong direction.",
        ],
    },
    {
        rule: "correctness/useValidForDirection",
        file: "a.js",
        source: "for (var i = 0; i > 10; i++) {\n}\n",
        expected: [
            "1:5 The update clause in this loop moves the variable in the wrong direction.",
        ],
    },
    {
        rule: "correctness/useValidForDirection",
        file: "a.js",
        source: "for (var i = 0; i < 10; i++) {\n}\n",
        expected: [],
    },
    {
        rule: "correctness/useValidTypeof",
        file: "a.js",
        source: 'typeof foo === "strnig";\n',
        expected: ['1:16 "strnig" is not a valid typeof value.'],
    },
    {
        rule: "correctness/useValidTypeof",
        file: "a.js",
        source: 'typeof foo == "undefimed";\n',
        expected: ['1:15 "undefimed" is not a valid typeof value.'],
    },
    {
        rule: "correctness/useValidTypeof",
        file: "a.js",
        source: 'typeof bar != "nunber";\n',
        expected: ['1:15 "nunber" is not a valid typeof value.'],
    },
    {
        rule: "correctness/useValidTypeof",
        file: "a.js",
        source: "typeof foo === undefined;\n",
        expected: ["1:16 Invalid typeof comparison."],
    },
    {
        rule: "correctness/useValidTypeof",
        file: "a.js",
        source: "typeof foo == 0;\n",
        expected: ["1:15 Invalid typeof comparison."],
    },
    {
        rule: "correctness/useValidTypeof",
        file: "a.js",
        source: 'typeof foo === "string";\n',
        expected: [],
    },
    {
        rule: "correctness/useValidTypeof",
        file: "a.js",
        source: 'typeof bar == "undefined";\n',
        expected: [],
    },
    {
        rule: "correctness/useValidTypeof",
        file: "a.js",
        source: "typeof bar === typeof qux;\n",
        expected: [],
    },
    {
        rule: "correctness/useValidTypeof",
        file: "a.js",
        source: "typeof foo === bar\n",
        expected: [],
    },
    {
        rule: "correctness/useYield",
        file: "a.js",
        source: "function* foo() {\n  return 10;\n}\n",
        expected: ["1:1 This generator function doesn't contain yield."],
    },
    {
        rule: "correctness/useYield",
        file: "a.js",
        source: "function* foo() {\n  yield 5;\n  return 10;\n}\n\nfunction foo() {\n  return 10;\n}\n\n// This rule does not warn on empty generator functions.\nfunction* foo() { }\n",
        expected: [],
    },
    {
        rule: "performance/noAccumulatingSpread",
        file: "a.js",
        source: "var a = ['a', 'b', 'c'];\na.reduce((acc, val) => [...acc, val], []);\n",
        expected: [
            "2:25 Avoid the use of spread (`...`) syntax on accumulators.",
        ],
    },
    {
        rule: "performance/noAccumulatingSpread",
        file: "a.js",
        source: "var a = ['a', 'b', 'c'];\na.reduce((acc, val) => {return [...acc, val];}, []);\n",
        expected: [
            "2:33 Avoid the use of spread (`...`) syntax on accumulators.",
        ],
    },
    {
        rule: "performance/noAccumulatingSpread",
        file: "a.js",
        source: "var a = ['a', 'b', 'c'];\na.reduce((acc, val) => ({...acc, [val]: val}), {});\n",
        expected: [
            "2:26 Avoid the use of spread (`...`) syntax on accumulators.",
        ],
    },
    {
        rule: "performance/noAccumulatingSpread",
        file: "a.js",
        source: "var a = ['a', 'b', 'c'];\na.reduce((acc, val) => {return Object.assign([], acc, val);}, []);\n",
        expected: ["2:32 Avoid the use of Object.assign on accumulators."],
    },
    {
        rule: "performance/noAccumulatingSpread",
        file: "a.js",
        source: "var a = ['a', 'b', 'c'];\na.reduce((acc, val) => {acc.push(val); return acc}, []);\n",
        expected: [],
    },
    {
        rule: "performance/noAccumulatingSpread",
        file: "a.js",
        source: "var a = ['a', 'b', 'c'];\na.reduce((acc, val) => Object.assign(acc, val), []);\n",
        expected: [],
    },
    {
        rule: "performance/noAccumulatingSpread",
        file: "a.js",
        source: "var a = ['a', 'b', 'c'];\na.reduce((acc, val) => {return Object.assign(acc, val);}, []);\n",
        expected: [],
    },
    {
        rule: "performance/noDynamicNamespaceImportAccess",
        file: "a.js",
        source: 'import * as foo from "foo"\nfoo["bar"]\n',
        expected: [
            "2:1 Avoid accessing namespace imports dynamically, it can prevent efficient tree shaking and increase bundle size.",
        ],
    },
    {
        rule: "performance/noDynamicNamespaceImportAccess",
        file: "a.js",
        source: 'import * as foo from "foo"\nconst key = "bar"\nfoo[key]\n',
        expected: [
            "3:1 Avoid accessing namespace imports dynamically, it can prevent efficient tree shaking and increase bundle size.",
        ],
    },
    {
        rule: "performance/noDynamicNamespaceImportAccess",
        file: "a.js",
        source: 'import * as foo from "foo"\nfoo.bar\n',
        expected: [],
    },
    {
        rule: "performance/noDynamicNamespaceImportAccess",
        file: "a.js",
        source: 'import { bar } from "foo"\nbar\n',
        expected: [],
    },
    {
        rule: "performance/noDynamicNamespaceImportAccess",
        file: "a.js",
        source: 'import messages from "i18n"\nconst knownMessagesMap = {\n hello: messages.hello,\n goodbye: messages.goodbye\n}\n\nconst dynamicKey = "hello"\nknownMessagesMap[dynamicKey]\n',
        expected: [],
    },
    {
        rule: "security/noBlankTarget",
        file: "a.jsx",
        source: "<a href='http://external.link' target='_blank'>child</a>\n",
        expected: [
            '1:32 Avoid using target="_blank" without rel="noopener" or rel="noreferrer".',
        ],
    },
    {
        rule: "security/noBlankTarget",
        file: "a.jsx",
        source: "<a href='http://external.link' target='_blank' rel='nofollow'>child</a>\n",
        expected: [
            '1:32 Avoid using target="_blank" without rel="noopener" or rel="noreferrer".',
        ],
    },
    {
        rule: "security/noBlankTarget",
        file: "a.jsx",
        source: "<a {...props} href='http://external.link' target='_blank' rel='nofollow'>child</a>\n",
        expected: [
            '1:43 Avoid using target="_blank" without rel="noopener" or rel="noreferrer".',
        ],
    },
    {
        rule: "security/noBlankTarget",
        file: "a.jsx",
        source: "<a href='http://external.link' rel='noopener' target='_blank'>child</a>\n",
        expected: [],
    },
    {
        rule: "security/noBlankTarget",
        file: "a.jsx",
        source: "<a href='http://external.link' rel='noreferrer' target='_blank'>child</a>\n",
        expected: [],
    },
    {
        rule: "security/noBlankTarget",
        file: "a.jsx",
        source: "// The rule accepts elements with spread props, because the required\n// attribute may be injected dynamically:\n<a href='http://external.link' target='_blank' {...props}>child</a>\n",
        expected: [],
    },
    {
        rule: "security/noBlankTarget",
        file: "a.jsx",
        options: { allowNoReferrer: false },
        source: "<a href='http://external.link' rel='noreferrer' target='_blank'>child</a>\n",
        expected: ['1:49 Avoid using target="_blank" without rel="noopener".'],
    },
    {
        rule: "security/noBlankTarget",
        file: "a.jsx",
        options: { allowDomains: ["https://example.com", "example.org"] },
        source: "<>\n  <a target='_blank' testme href='https://example.com'></a>\n  <a target='_blank' href='example.org'></a>\n</>\n",
        expected: [],
    },
    {
        rule: "security/noBlankTarget",
        file: "a.jsx",
        options: { allowDomains: ["https://example.com"] },
        source: "<>\n  <a target='_blank' testme href='https://example.com'></a>\n  <a target='_blank' href='example.org'></a>\n</>\n",
        expected: [
            '3:6 Avoid using target="_blank" without rel="noopener" or rel="noreferrer".',
        ],
    },
    {
        rule: "security/noGlobalEval",
        file: "a.js",
        source: 'eval("var a = 0");\n',
        expected: ["1:1 Do not use eval()."],
    },
    {
        rule: "security/noGlobalEval",
        file: "a.js",
        source: '(0, globalThis.eval)("var a = 0")\n',
        expected: ["1:5 Do not use eval()."],
    },
    {
        rule: "security/noGlobalEval",
        file: "a.js",
        source: "f(eval);\n",
        expected: ["1:3 Do not use eval()."],
    },
    {
        rule: "security/noGlobalEval",
        file: "a.js",
        source: "const aliasedEval = eval;\n",
        expected: ["1:21 Do not use eval()."],
    },
    {
        rule: "security/noGlobalEval",
        file: "a.cjs",
        source: 'function f(eval) {\n    eval("let a = 0;");\n}\n',
        expected: [],
    },
    {
        rule: "security/noGlobalEval",
        file: "a.js",
        source: 'let foo = globalThis;\nfoo.eval("let a = 0;");\n',
        expected: [],
    },
    {
        rule: "security/noScriptUrl",
        file: "a.jsx",
        source: '<a href="javascript:void(0)">Click me</a>\n',
        expected: [
            "1:8 Avoid using javascript: URLs, as they can be a security risk.",
        ],
    },
    {
        rule: "security/noScriptUrl",
        file: "a.jsx",
        source: "<a href=\"javascript:alert('XSS')\">Click me</a>\n",
        expected: [
            "1:8 Avoid using javascript: URLs, as they can be a security risk.",
        ],
    },
    {
        rule: "security/noScriptUrl",
        file: "a.js",
        source: "React.createElement('a', { href: 'javascript:void(0)' });\n",
        expected: [
            "1:34 Avoid using javascript: URLs, as they can be a security risk.",
        ],
    },
    {
        rule: "security/noScriptUrl",
        file: "a.jsx",
        source: '<a href="https://example.com">Click me</a>\n',
        expected: [],
    },
    {
        rule: "security/noScriptUrl",
        file: "a.jsx",
        source: '<a href="/path/to/page">Click me</a>\n',
        expected: [],
    },
    {
        rule: "security/noScriptUrl",
        file: "a.jsx",
        source: '<a href="#section">Click me</a>\n',
        expected: [],
    },
    {
        rule: "style/noNonNullAssertion",
        file: "a.ts",
        source: "interface Example {\n  property?: string;\n}\ndeclare const foo: Example;\nconst includesBaz = foo.property!.includes('baz');\n",
        expected: ["5:21 Forbidden non-null assertion."],
    },
    {
        rule: "style/noNonNullAssertion",
        file: "a.ts",
        source: '(b!! as number) = "test";\n',
        expected: ["1:2 Forbidden non-null assertion."],
    },
    {
        rule: "style/noNonNullAssertion",
        file: "a.ts",
        source: "interface Example {\n  property?: string;\n}\n\ndeclare const foo: Example;\nconst includesBaz = foo.property?.includes('baz') ?? false;\n",
        expected: [],
    },
    {
        rule: "style/useArrayLiterals",
        file: "a.js",
        source: "const xs = Array();\n",
        expected: [
            "1:12 Use an array literal instead of the Array constructor.",
        ],
    },
    {
        rule: "style/useArrayLiterals",
        file: "a.js",
        source: "const xs = Array(0, 1, 2);\n",
        expected: [
            "1:12 Use an array literal instead of the Array constructor.",
        ],
    },
    {
        rule: "style/useArrayLiterals",
        file: "a.js",
        source: "const xs = new Array(0, 1, 2);\n",
        expected: [
            "1:12 Use an array literal instead of the Array constructor.",
        ],
    },
    {
        rule: "style/useArrayLiterals",
        file: "a.js",
        source: "const xs = Array(...args);\n",
        expected: [
            "1:12 Use an array literal instead of the Array constructor.",
        ],
    },
    {
        rule: "style/useArrayLiterals",
        file: "a.ts",
        source: "const xs = new Array<number>()\n",
        expected: [
            "1:12 Use an array literal instead of the Array constructor.",
        ],
    },
    {
        rule: "style/useArrayLiterals",
        file: "a.js",
        source: "const xs = Array(65000);\n",
        expected: [],
    },
    {
        rule: "style/useArrayLiterals",
        file: "a.js",
        source: "const xs = [0, 1, 2];\n",
        expected: [],
    },
    {
        rule: "style/useConst",
        file: "a.js",
        source: "let a = 3;\nconsole.log(a);\n",
        expected: [
            "1:1 This let declares a variable that is only assigned once.",
        ],
    },
    {
        rule: "style/useConst",
        file: "a.js",
        source: "// `a` is redefined (not reassigned) on each loop step.\nfor (let a of [1, 2, 3]) {\n    console.log(a);\n}\n",
        expected: [
            "2:6 This let declares a variable that is only assigned once.",
        ],
    },
    {
        rule: "style/useConst",
        file: "a.js",
        source: "// `a` is redefined (not reassigned) on each loop step.\nfor (let a in [1, 2, 3]) {\n    console.log(a);\n}\n",
        expected: [
            "2:6 This let declares a variable that is only assigned once.",
        ],
    },
    {
        rule: "style/useConst",
        file: "a.js",
        source: "let a;\na = 0;\n",
        expected: [
            "1:1 This let declares a variable that is only assigned once.",
        ],
    },
    {
        rule: "style/useConst",
        file: "a.js",
        source: "let a = 3;\n{\n    let a = 4;\n    a = 2;\n}\n",
        expected: [
            "1:1 This let declares a variable that is only assigned once.",
        ],
    },
    {
        rule: "style/useConst",
        file: "a.js",
        source: "let a = 2;\na = 3;\nconsole.log(a);\n",
        expected: [],
    },
    {
        rule: "style/useConst",
        file: "a.js",
        source: "let a = 1, b = 2;\nb = 3;\n",
        expected: [],
    },
    {
        rule: "style/useConst",
        file: "a.js",
        source: "let a;\na; // the variable is read before its assignment\na = 0;\n",
        expected: [],
    },
    {
        rule: "style/useConst",
        file: "a.js",
        source: "let a;\nfunction f() {\n    return a; // read\n}\na = 0; // written\n",
        expected: [],
    },
    {
        rule: "style/useExponentiationOperator",
        file: "a.js",
        source: "const foo = Math.pow(2, 8);\n",
        expected: ["1:13 Use the '**' operator instead of 'Math.pow'."],
    },
    {
        rule: "style/useExponentiationOperator",
        file: "a.js",
        source: "const bar = Math.pow(a, b);\n",
        expected: ["1:13 Use the '**' operator instead of 'Math.pow'."],
    },
    {
        rule: "style/useExponentiationOperator",
        file: "a.js",
        source: "let baz = Math.pow(a + b, c + d);\n",
        expected: ["1:11 Use the '**' operator instead of 'Math.pow'."],
    },
    {
        rule: "style/useExponentiationOperator",
        file: "a.js",
        source: "let quux = Math.pow(-1, n);\n",
        expected: ["1:12 Use the '**' operator instead of 'Math.pow'."],
    },
    {
        rule: "style/useExponentiationOperator",
        file: "a.js",
        source: "const foo = 2 ** 8;\n\nconst bar = a ** b;\n\nlet baz = (a + b) ** (c + d);\n\nlet quux = (-1) ** n;\n",
        expected: [],
    },
    {
        rule: "style/useExportType",
        file: "a.ts",
        source: "interface I {}\nexport { I };\n",
        expected: ["2:8 All exports are only types."],
    },
    {
        rule: "style/useExportType",
        file: "a.ts",
        source: "type T = number;\nexport { T };\n",
        expected: ["2:8 All exports are only types."],
    },
    {
        rule: "style/useExportType",
        file: "a.ts",
        source: 'import type { T } from "./mod.js";\nexport { T };\n',
        expected: ["2:8 All exports are only types."],
    },
    {
        rule: "style/useExportType",
        file: "a.ts",
        source: "export { type X, type Y };\n",
        expected: ["1:8 All exports are only types."],
    },
    {
        rule: "style/useExportType",
        file: "a.js",
        source: "class C {}\nfunction f() {}\nexport { C, f };\n",
        expected: [],
    },
    {
        rule: "style/useExportType",
        file: "a.ts",
        options: { style: "inlineType" },
        source: 'import type { A } from "./mod.ts";\nexport { A };\n',
        expected: ["2:8 Some exports are only types."],
    },
    {
        rule: "style/useExportType",
        file: "a.ts",
        options: { style: "inlineType" },
        source: 'import { A } from "./mod.ts";\nexport type { A };\n',
        expected: ["2:8 Some exports are only types."],
    },
    {
        rule: "style/useExportType",
        file: "a.ts",
        options: { style: "separatedType" },
        source: 'import type { A } from "./mod.ts";\nexport { A };\n',
        expected: ["2:8 All exports are only types."],
    },
    {
        rule: "style/useExportType",
        file: "a.ts",
        options: { style: "separatedType" },
        source: 'import { A, B } from "./mod.ts";\nexport { type A, B };\n',
        expected: ["2:8 Separate type exports from other exports."],
    },
    {
        rule: "style/useImportType",
        file: "a.ts",
        source: 'import { A } from "./mod.js";\ntype TypeOfA = typeof A;\nlet a: A;\n',
        expected: ["1:8 All these imports are only used as types."],
    },
    {
        rule: "style/useImportType",
        file: "a.ts",
        source: 'import { type A, type B } from "./mod.js";\n',
        expected: ["1:8 All these imports are only used as types."],
    },
    {
        rule: "style/useImportType",
        file: "a.ts",
        source: 'import { type A, B } from "./mod.js";\nlet c: A;\nlet d: typeof B;\n',
        expected: ["1:8 All these imports are only used as types."],
    },
    {
        rule: "style/useImportType",
        file: "a.ts",
        source: 'import type { A } from "./mod.js";\nlet a: A;\n',
        expected: [],
    },
    {
        rule: "style/useImportType",
        file: "a.ts",
        source: 'import { B } from "./mod.js";\nlet a: B = new B();\n',
        expected: [],
    },
    {
        rule: "style/useImportType",
        file: "a.ts",
        source: 'import { type A, B } from "./mod.js";\nlet c: A;\nlet d = new B();\n',
        expected: [],
    },
    {
        rule: "style/useImportType",
        file: "a.ts",
        source: 'import { A } from "./mod.js";\n\nimport { B } from "./mod.js" with {};\nexport type { B };\n',
        expected: [],
    },
    {
        rule: "style/useImportType",
        file: "a.ts",
        options: { style: "inlineType" },
        source: 'import { A } from "./mod.ts";\nexport type { A };\n',
        expected: ["1:8 Some named imports are only used as types."],
    },
    {
        rule: "style/useImportType",
        file: "a.ts",
        options: { style: "separatedType" },
        source: 'import { A } from "./mod.ts";\nexport type { A };\n',
        expected: ["1:8 All these imports are only used as types."],
    },
    {
        rule: "style/useImportType",
        file: "a.ts",
        options: { style: "separatedType" },
        source: 'import { type A, type B } from "./mod.ts";\nexport type { A, B };\n',
        expected: ["1:8 All these imports are only used as types."],
    },
    {
        rule: "style/useLiteralEnumMembers",
        file: "a.ts",
        source: "const x = 2;\nenum Computed {\n    A,\n    B = x,\n}\n",
        expected: [
            "4:9 The enum member should be initialized with a literal value such as a number or a string.",
        ],
    },
    {
        rule: "style/useLiteralEnumMembers",
        file: "a.ts",
        source: "enum Direction {\n    Left,\n    Right,\n}\n",
        expected: [],
    },
    {
        rule: "style/useLiteralEnumMembers",
        file: "a.ts",
        source: "enum Order {\n    Less = -1,\n    Equal = 0,\n    Greater = 1,\n}\n",
        expected: [],
    },
    {
        rule: "style/useLiteralEnumMembers",
        file: "a.ts",
        source: 'enum State {\n    Open = "Open",\n    Close = "Close",\n}\n',
        expected: [],
    },
    {
        rule: "style/useLiteralEnumMembers",
        file: "a.ts",
        source: "enum FileAccess {\n    None = 0,\n    Read = 1,\n    Write = 1 << 1,\n    All = Read | Write\n}\n",
        expected: [],
    },
    {
        rule: "style/useLiteralEnumMembers",
        file: "a.ts",
        source: 'enum E { A = 1 + 2, B = "a" + "b", C = A, D = E.A, F = ~1, G = -A, H = `t`, I = (1), J = A * 2, K = Math.PI }\n',
        expected: [
            "1:101 The enum member should be initialized with a literal value such as a number or a string.",
        ],
    },
    {
        rule: "style/useNodejsImportProtocol",
        file: "a.js",
        source: "import fs from 'fs';\n",
        expected: [
            "1:16 A Node.js builtin module should be imported with the node: protocol.",
        ],
    },
    {
        rule: "style/useNodejsImportProtocol",
        file: "a.js",
        source: "import os from 'os';\n",
        expected: [
            "1:16 A Node.js builtin module should be imported with the node: protocol.",
        ],
    },
    {
        rule: "style/useNodejsImportProtocol",
        file: "a.js",
        source: "import path from 'path';\n",
        expected: [
            "1:18 A Node.js builtin module should be imported with the node: protocol.",
        ],
    },
    {
        rule: "style/useNodejsImportProtocol",
        file: "a.js",
        source: "import fs from 'node:fs';\n\nimport os from 'node:os';\n\nimport path from 'node:path';\n",
        expected: [],
    },
    {
        rule: "style/useShorthandFunctionType",
        file: "a.ts",
        source: "interface Example {\n  (): string;\n}\n",
        expected: ["2:3 Use a function type instead of a call signature."],
    },
    {
        rule: "style/useShorthandFunctionType",
        file: "a.ts",
        source: "function foo(example: { (): number }): number {\n  return example();\n}\n",
        expected: ["1:25 Use a function type instead of a call signature."],
    },
    {
        rule: "style/useShorthandFunctionType",
        file: "a.ts",
        source: "type Example = () => string;\n",
        expected: [],
    },
    {
        rule: "style/useShorthandFunctionType",
        file: "a.ts",
        source: "function foo(example: () => number): number {\n  return bar();\n}\n",
        expected: [],
    },
    {
        rule: "style/useShorthandFunctionType",
        file: "a.ts",
        source: "// returns the function itself, not the `this` argument.\ntype ReturnsSelf2 = (arg: string) => ReturnsSelf;\n",
        expected: [],
    },
    {
        rule: "style/useShorthandFunctionType",
        file: "a.ts",
        source: "interface Foo {\n  bar: string;\n}\ninterface Bar extends Foo {\n  (): void;\n}\n",
        expected: [],
    },
    {
        rule: "style/useShorthandFunctionType",
        file: "a.ts",
        source: "// multiple call signatures (overloads) is allowed:\ninterface Overloaded {\n  (data: string): number;\n  (id: number): string;\n}\n// this is equivalent to Overloaded interface.\ntype Intersection = ((data: string) => number) & ((id: number) => string);\n",
        expected: [],
    },
    {
        rule: "style/useTemplate",
        file: "a.js",
        source: 'const s = foo + "baz";\n',
        expected: [
            "1:11 Template literals are preferred over string concatenation.",
        ],
    },
    {
        rule: "style/useTemplate",
        file: "a.js",
        source: 'const s = 1 + 2 + "foo" + 3;\n',
        expected: [
            "1:11 Template literals are preferred over string concatenation.",
        ],
    },
    {
        rule: "style/useTemplate",
        file: "a.js",
        source: 'const s = 1 * 2 + "foo";\n',
        expected: [
            "1:11 Template literals are preferred over string concatenation.",
        ],
    },
    {
        rule: "style/useTemplate",
        file: "a.js",
        source: 'const s = 1 + "foo" + 2 + "bar" + "baz" + 3;\n',
        expected: [
            "1:11 Template literals are preferred over string concatenation.",
        ],
    },
    {
        rule: "style/useTemplate",
        file: "a.js",
        source: 'let s = "foo" + "bar" + `baz`;\n',
        expected: [],
    },
    {
        rule: "style/useTemplate",
        file: "a.js",
        source: "let s = `value: ${1}`;\n",
        expected: [],
    },
    {
        rule: "suspicious/noApproximativeNumericConstant",
        file: "a.js",
        source: "let x = 3.141;\n",
        expected: ["1:9 Prefer constants from the standard library."],
    },
    {
        rule: "suspicious/noApproximativeNumericConstant",
        file: "a.js",
        source: "let x = 2.302;\n",
        expected: ["1:9 Prefer constants from the standard library."],
    },
    {
        rule: "suspicious/noApproximativeNumericConstant",
        file: "a.js",
        source: "let x = Math.PI;\nlet y = 3.14;\n",
        expected: [],
    },
    {
        rule: "suspicious/noApproximativeNumericConstant",
        file: "a.js",
        source: "let x = Math.LN10;\n",
        expected: [],
    },
    {
        rule: "suspicious/noApproximativeNumericConstant",
        file: "a.js",
        source: "let p1 = 3.1416; let p2 = 3.1415; let p3 = 2.718; let p4 = 0.693; let p9 = 31.41; let p11 = 0.4343; let p12 = 3.1;\n",
        expected: [
            "1:10 Prefer constants from the standard library.",
            "1:27 Prefer constants from the standard library.",
            "1:44 Prefer constants from the standard library.",
            "1:60 Prefer constants from the standard library.",
            "1:93 Prefer constants from the standard library.",
        ],
    },
    {
        rule: "suspicious/noAssignInExpressions",
        file: "a.ts",
        source: "let a, b;\na = (b = 1) + 1;\n",
        expected: ["2:6 The assignment should not be in an expression."],
    },
    {
        rule: "suspicious/noAssignInExpressions",
        file: "a.ts",
        source: "let a;\nif (a = 1) {\n}\n",
        expected: ["2:5 The assignment should not be in an expression."],
    },
    {
        rule: "suspicious/noAssignInExpressions",
        file: "a.ts",
        source: "function f(a) {\n    return a = 1;\n}\n",
        expected: ["2:12 The assignment should not be in an expression."],
    },
    {
        rule: "suspicious/noAssignInExpressions",
        file: "a.ts",
        source: "let a;\na = 1;\n",
        expected: [],
    },
    {
        rule: "suspicious/noAssignInExpressions",
        file: "a.ts",
        source: "let a = 0;\nconst f = b => a += b;\n",
        expected: [],
    },
    {
        rule: "suspicious/noAsyncPromiseExecutor",
        file: "a.js",
        source: "new Promise(async function foo(resolve, reject) {})\n",
        expected: ["1:13 Promise executor functions should not be `async`."],
    },
    {
        rule: "suspicious/noAsyncPromiseExecutor",
        file: "a.js",
        source: "  new Promise(async (resolve, reject) => {})\n",
        expected: ["1:15 Promise executor functions should not be `async`."],
    },
    {
        rule: "suspicious/noAsyncPromiseExecutor",
        file: "a.js",
        source: "  new Promise(((((async () => {})))))\n",
        expected: ["1:19 Promise executor functions should not be `async`."],
    },
    {
        rule: "suspicious/noAsyncPromiseExecutor",
        file: "a.js",
        source: "  new Promise((resolve, reject) => {})\n  new Promise((resolve, reject) => {}, async function unrelated() {})\n  new Foo(async (resolve, reject) => {})\n  new Foo((( (resolve, reject) => {} )))\n",
        expected: [],
    },
    {
        rule: "suspicious/noCatchAssign",
        file: "a.js",
        source: "try {\n\n} catch (e) {\n  e;\n  e = 10;\n}\n",
        expected: ["5:3 Reassigning a catch parameter is confusing."],
    },
    {
        rule: "suspicious/noCatchAssign",
        file: "a.js",
        source: "try {\n\n} catch (e) {\n  let e = 10;\n  e = 100;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noClassAssign",
        file: "a.js",
        source: "class A {}\nA = 0;\n",
        expected: ["2:1 The class 'A' is reassigned."],
    },
    {
        rule: "suspicious/noClassAssign",
        file: "a.js",
        source: "A = 0;\nclass A {}\n",
        expected: ["1:1 The class 'A' is reassigned."],
    },
    {
        rule: "suspicious/noClassAssign",
        file: "a.js",
        source: "class A {\n\tb() {\n\t\tA = 0;\n\t}\n}\n",
        expected: ["3:3 The class 'A' is reassigned."],
    },
    {
        rule: "suspicious/noClassAssign",
        file: "a.js",
        source: "let A = class A {\n\tb() {\n\t\tA = 0;\n\t\t// `let A` is shadowed by the class name.\n\t}\n}\n",
        expected: ["3:3 The class 'A' is reassigned."],
    },
    {
        rule: "suspicious/noClassAssign",
        file: "a.js",
        source: "let A = class A {}\nA = 0; // A is a variable.\n",
        expected: [],
    },
    {
        rule: "suspicious/noClassAssign",
        file: "a.js",
        source: "let A = class {\n    b() {\n        A = 0; // A is a variable.\n    }\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noClassAssign",
        file: "a.js",
        source: "class A {\n\tb(A) {\n\t\tA = 0; // A is a parameter.\n\t}\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noCommentText",
        file: "a.jsx",
        source: "<div>// comment</div>;\n",
        expected: ["1:6 Wrap comments inside children within braces."],
    },
    {
        rule: "suspicious/noCommentText",
        file: "a.jsx",
        source: "<div>/* comment */</div>;\n",
        expected: ["1:6 Wrap comments inside children within braces."],
    },
    {
        rule: "suspicious/noCommentText",
        file: "a.jsx",
        source: "<div>/** comment */</div>;\n",
        expected: ["1:6 Wrap comments inside children within braces."],
    },
    {
        rule: "suspicious/noCommentText",
        file: "a.jsx",
        source: "<div>text /* comment */</div>;\n",
        expected: ["1:11 Wrap comments inside children within braces."],
    },
    {
        rule: "suspicious/noCommentText",
        file: "a.jsx",
        source: "<div>/* comment */ text</div>;\n",
        expected: ["1:6 Wrap comments inside children within braces."],
    },
    {
        rule: "suspicious/noCommentText",
        file: "a.jsx",
        source: "<div>\n    text\n    // comment\n</div>;\n",
        expected: ["3:5 Wrap comments inside children within braces."],
    },
    {
        rule: "suspicious/noCommentText",
        file: "a.jsx",
        source: "<div>\n    // comment\n   text\n</div>;\n",
        expected: ["2:5 Wrap comments inside children within braces."],
    },
    {
        rule: "suspicious/noCommentText",
        file: "a.jsx",
        source: "<div>\n    /* comment */\n    text\n</div>;\n",
        expected: ["2:5 Wrap comments inside children within braces."],
    },
    {
        rule: "suspicious/noCommentText",
        file: "a.jsx",
        source: '<>\n   <div>{/* comment */}</div>;\n   <div>{/** comment */}</div>;\n   <div className={"cls" /* comment */}></div>;\n   <div>text {/* comment */}</div>;\n   <div>{/* comment */} text</div>;\n</>\n',
        expected: [],
    },
    {
        rule: "suspicious/noCommentText",
        file: "a.jsx",
        source: "<div>http://example.com</div>;\n<div>a // b {c}</div>;\n",
        expected: ["2:8 Wrap comments inside children within braces."],
    },
    {
        rule: "suspicious/noCompareNegZero",
        file: "a.js",
        source: "(1 >= -0)\n",
        expected: ["1:2 Do not use the >= operator to compare against -0."],
    },
    {
        rule: "suspicious/noCompareNegZero",
        file: "a.js",
        source: "(1 >= 0)\n",
        expected: [],
    },
    {
        rule: "suspicious/noConfusingLabels",
        file: "a.js",
        source: "label: f();\n",
        expected: ["1:1 Unexpected label."],
    },
    {
        rule: "suspicious/noConfusingLabels",
        file: "a.js",
        source: "label: {\n    f();\n    break label;\n}\n",
        expected: ["1:1 Unexpected label."],
    },
    {
        rule: "suspicious/noConfusingLabels",
        file: "a.js",
        source: "label: if (a) {\n    f()\n    break label;\n}\n",
        expected: ["1:1 Unexpected label."],
    },
    {
        rule: "suspicious/noConfusingLabels",
        file: "a.js",
        source: "label: switch (a) {\n    case 0:\n        break label;\n}\n",
        expected: ["1:1 Unexpected label."],
    },
    {
        rule: "suspicious/noConfusingLabels",
        file: "a.js",
        source: "outer: while (a) {\n    while(b) {\n        break outer;\n    }\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noConfusingLabels",
        file: "a.js",
        options: { allowedLabels: ["DEV"] },
        source: "DEV: assertSomeCondition();\n",
        expected: [],
    },
    {
        rule: "suspicious/noConfusingVoidType",
        file: "a.ts",
        source: "let foo: void;\n",
        expected: [
            "1:10 void is confusing outside a return type or a type parameter.",
        ],
    },
    {
        rule: "suspicious/noConfusingVoidType",
        file: "a.ts",
        source: "function logSomething(thing: void) {}\n",
        expected: [
            "1:30 void is confusing outside a return type or a type parameter.",
        ],
    },
    {
        rule: "suspicious/noConfusingVoidType",
        file: "a.ts",
        source: "interface Interface {\n    prop: void;\n}\n",
        expected: [
            "2:11 void is confusing outside a return type or a type parameter.",
        ],
    },
    {
        rule: "suspicious/noConfusingVoidType",
        file: "a.ts",
        source: "type PossibleValues = number | void;\n",
        expected: ["1:32 void is confusing inside a union type."],
    },
    {
        rule: "suspicious/noConfusingVoidType",
        file: "a.ts",
        source: "function foo(): void {};\n",
        expected: [],
    },
    {
        rule: "suspicious/noConfusingVoidType",
        file: "a.ts",
        source: "function doSomething(this: void) {}\n",
        expected: [],
    },
    {
        rule: "suspicious/noConfusingVoidType",
        file: "a.ts",
        source: "function printArg<T = void>(arg: T) {}\n",
        expected: [],
    },
    {
        rule: "suspicious/noConfusingVoidType",
        file: "a.ts",
        source: "function f(): void | Promise<void> {}\ntype G = Promise<void | number>;\ntype A1 = void | Promise<void>;\ntype A5 = () => Promise<V | void> | V | void;\ninterface I<R extends void | Promise<void>> {}\ninterface J<R extends void> {}\ntype A9 = void | never;\ntype M = { [K in string]: void };\n",
        expected: [
            "2:18 void is confusing inside a union type.",
            "4:29 void is confusing inside a union type.",
            "6:23 void is confusing outside a return type or a type parameter.",
            "8:27 void is confusing outside a return type or a type parameter.",
        ],
    },
    {
        rule: "suspicious/noConstEnum",
        file: "a.ts",
        source: "const enum Status {\n  Open,\n  Close,\n}\n",
        expected: ["1:1 The enum declaration should not be const"],
    },
    {
        rule: "suspicious/noConstEnum",
        file: "a.ts",
        source: "enum Status {\n  Open,\n  Close,\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noControlCharactersInRegex",
        file: "a.js",
        source: " var pattern1 = /\\x00/;\n",
        expected: [
            "1:18 Unexpected control character in a regular expression.",
        ],
    },
    {
        rule: "suspicious/noControlCharactersInRegex",
        file: "a.js",
        source: " var pattern2 = /\\x0C/;\n",
        expected: [
            "1:18 Unexpected control character in a regular expression.",
        ],
    },
    {
        rule: "suspicious/noControlCharactersInRegex",
        file: "a.js",
        source: " var pattern3 = /\\x1F/;\n",
        expected: [
            "1:18 Unexpected control character in a regular expression.",
        ],
    },
    {
        rule: "suspicious/noControlCharactersInRegex",
        file: "a.js",
        source: " var pattern4 = /\\u000C/;\n",
        expected: [
            "1:18 Unexpected control character in a regular expression.",
        ],
    },
    {
        rule: "suspicious/noControlCharactersInRegex",
        file: "a.js",
        source: " var pattern5 = /\\u{C}/u;\n",
        expected: [
            "1:18 Unexpected control character in a regular expression.",
        ],
    },
    {
        rule: "suspicious/noControlCharactersInRegex",
        file: "a.js",
        source: "var pattern1 = /\\x20/;\nvar pattern2 = /\\u0020/;\nvar pattern3 = /\\u{20}/u;\nvar pattern4 = /\\t/;\nvar pattern5 = /\\n/;\n",
        expected: [],
    },
    {
        rule: "suspicious/noControlCharactersInRegex",
        file: "a.js",
        source: 'var r1 = /\\x00\\x01 \\u0002/;\nvar r2 = new RegExp("\\\\x0C");\n',
        expected: [
            "1:11 Unexpected control character in a regular expression.",
            "1:15 Unexpected control character in a regular expression.",
            "1:20 Unexpected control character in a regular expression.",
        ],
    },
    {
        rule: "suspicious/noDebugger",
        file: "a.js",
        source: "debugger;\n",
        expected: ["1:1 This is an unexpected use of the debugger statement."],
    },
    {
        rule: "suspicious/noDebugger",
        file: "a.js",
        source: "const test = { debugger: 1 };\ntest.debugger;\n",
        expected: [],
    },
    {
        rule: "suspicious/noDocumentCookie",
        file: "a.js",
        source: 'document.cookie = "foo=bar";\n',
        expected: [
            "1:1 Direct assigning to document.cookie is not recommended.",
        ],
    },
    {
        rule: "suspicious/noDocumentCookie",
        file: "a.js",
        source: 'document.cookie += "; foo=bar";\n',
        expected: [
            "1:1 Direct assigning to document.cookie is not recommended.",
        ],
    },
    {
        rule: "suspicious/noDocumentCookie",
        file: "a.js",
        source: 'const array = document.cookie.split("; ");\n',
        expected: [],
    },
    {
        rule: "suspicious/noDocumentCookie",
        file: "a.js",
        source: 'await cookieStore\n  .set({\n    name: "foo",\n    value: "bar",\n    expires: Date.now() + 24 * 60 * 60,\n    domain: "example.com",\n})\n',
        expected: [],
    },
    {
        rule: "suspicious/noDocumentCookie",
        file: "a.js",
        source: "import Cookies from 'js-cookie';\n\nCookies.set('foo', 'bar');\n",
        expected: [],
    },
    {
        rule: "suspicious/noDoubleEquals",
        file: "a.js",
        source: "foo == bar\n",
        expected: [
            "1:5 Using == may be unsafe if you are relying on type coercion.",
        ],
    },
    {
        rule: "suspicious/noDoubleEquals",
        file: "a.js",
        source: "foo == null\n",
        expected: [],
    },
    {
        rule: "suspicious/noDoubleEquals",
        file: "a.js",
        source: "foo != null\n",
        expected: [],
    },
    {
        rule: "suspicious/noDoubleEquals",
        file: "a.js",
        source: "null == foo\n",
        expected: [],
    },
    {
        rule: "suspicious/noDoubleEquals",
        file: "a.js",
        source: "null != foo\n",
        expected: [],
    },
    {
        rule: "suspicious/noDoubleEquals",
        file: "a.json",
        source: '{\n    "//":"...",\n    "options": {\n        "ignoreNull": true\n    }\n}\n',
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateCase",
        file: "a.js",
        source: "switch (a) {\n    case 1:\n        break;\n    case 1:\n        break;\n    default:\n        break;\n}\n",
        expected: ["4:10 Duplicate case label."],
    },
    {
        rule: "suspicious/noDuplicateCase",
        file: "a.js",
        source: "switch (a) {\n    case one:\n        break;\n    case one:\n        break;\n    default:\n        break;\n}\n",
        expected: ["4:10 Duplicate case label."],
    },
    {
        rule: "suspicious/noDuplicateCase",
        file: "a.js",
        source: 'switch (a) {\n    case "1":\n        break;\n    case "1":\n        break;\n    default:\n        break;\n}\n',
        expected: ["4:10 Duplicate case label."],
    },
    {
        rule: "suspicious/noDuplicateCase",
        file: "a.js",
        source: "switch (a) {\n    case 1:\n        break;\n    case 2:\n        break;\n    default:\n        break;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateCase",
        file: "a.js",
        source: "switch (a) {\n    case one:\n        break;\n    case two:\n        break;\n    default:\n        break;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateCase",
        file: "a.js",
        source: 'switch (a) {\n    case "1":\n        break;\n    case "2":\n        break;\n    default:\n        break;\n}\n',
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateClassMembers",
        file: "a.js",
        source: "class Foo {\n  bar() { }\n  bar() { }\n}\n",
        expected: ["3:3 Duplicate class member name bar."],
    },
    {
        rule: "suspicious/noDuplicateClassMembers",
        file: "a.js",
        source: "class Foo {\n  bar() { }\n  get bar() { }\n}\n",
        expected: ["3:3 Duplicate class member name bar."],
    },
    {
        rule: "suspicious/noDuplicateClassMembers",
        file: "a.js",
        source: "class Foo {\n  bar;\n  bar() { }\n}\n",
        expected: ["3:3 Duplicate class member name bar."],
    },
    {
        rule: "suspicious/noDuplicateClassMembers",
        file: "a.js",
        source: "class Foo {\n  static bar() { }\n  static bar() { }\n}\n",
        expected: ["3:3 Duplicate class member name bar."],
    },
    {
        rule: "suspicious/noDuplicateClassMembers",
        file: "a.js",
        source: "class Foo {\n  bar() { }\n  qux() { }\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateClassMembers",
        file: "a.js",
        source: "class Foo {\n  set bar(value) { }\n  get bar() { }\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateClassMembers",
        file: "a.js",
        source: "class Foo {\n  bar;\n  qux;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateClassMembers",
        file: "a.js",
        source: "class Foo {\n  bar;\n  qux() { }\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateClassMembers",
        file: "a.js",
        source: "class Foo {\n  static bar() { }\n  bar() { }\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateElseIf",
        file: "a.js",
        source: "if (a) {\n    foo();\n} else if (b) {\n    bar();\n} else if (b) {\n    baz();\n}\n",
        expected: [
            "5:12 This condition is a duplicate of, or is covered by, previous conditions in the if-else-if chain.",
        ],
    },
    {
        rule: "suspicious/noDuplicateElseIf",
        file: "a.js",
        source: "if (a) {\n    foo();\n} else if (b) {\n    bar();\n} else if (c) {\n    baz();\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateEnumValues",
        file: "a.ts",
        source: "enum E {\n  A = 0,\n  B = 0,\n}\n",
        expected: ["3:3 Duplicate enum member value."],
    },
    {
        rule: "suspicious/noDuplicateEnumValues",
        file: "a.ts",
        source: "enum E {\n  A = \"A\",\n  B = 'A',\n  C = `A`,\n}\n",
        expected: ["3:3 Duplicate enum member value."],
    },
    {
        rule: "suspicious/noDuplicateEnumValues",
        file: "a.ts",
        source: "enum E {\n  A = 0,\n  B = 1,\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateEnumValues",
        file: "a.ts",
        source: "enum E {\n  A = \"A\",\n  B = 'B',\n  C = `C`,\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateEnumValues",
        file: "a.ts",
        source: "enum E { A = 1, B = 1, C = 1, D = 2, F = 2 }\nenum E2 { A = 1, B = 1.0, C = -1, D = -1, F = `x`, G = `x` }\n",
        expected: [
            "1:17 Duplicate enum member value.",
            "2:18 Duplicate enum member value.",
        ],
    },
    {
        rule: "suspicious/noDuplicateJsxProps",
        file: "a.jsx",
        source: '<Hello name="John" name="John" />\n',
        expected: ["1:8 This JSX property is assigned multiple times."],
    },
    {
        rule: "suspicious/noDuplicateJsxProps",
        file: "a.jsx",
        source: '<label xml:lang="en-US" xml:lang="en-US"></label>\n',
        expected: ["1:8 This JSX property is assigned multiple times."],
    },
    {
        rule: "suspicious/noDuplicateJsxProps",
        file: "a.jsx",
        source: '<Hello firstname="John" lastname="Doe" />\n',
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateJsxProps",
        file: "a.jsx",
        source: '<label xml:lang="en-US" lang="en-US"></label>\n',
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateObjectKeys",
        file: "a.js",
        source: "const obj = {\n\t\ta: 1,\n\t\ta: 2,\n}\n",
        expected: [
            "2:3 This property is later overwritten by an object member with the same name.",
        ],
    },
    {
        rule: "suspicious/noDuplicateObjectKeys",
        file: "a.js",
        source: "const obj = {\n\t\tset a(v) {},\n\t\ta: 2,\n}\n",
        expected: [
            "2:3 This setter is later overwritten by an object member with the same name.",
        ],
    },
    {
        rule: "suspicious/noDuplicateObjectKeys",
        file: "a.js",
        source: "const obj = {\n\t\ta: 1,\n\t\tb: 2,\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateObjectKeys",
        file: "a.js",
        source: "const obj = {\n\t\tget a() { return 1; },\n\t\tset a(v) {},\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noDuplicateParameters",
        file: "a.js",
        source: "var f = function(a, b, b) {}\n",
        expected: ["1:24 Duplicate parameter name."],
    },
    {
        rule: "suspicious/noDuplicateParameters",
        file: "a.js",
        source: "function b(a, b, b) {}\n",
        expected: ["1:18 Duplicate parameter name."],
    },
    {
        rule: "suspicious/noDuplicateParameters",
        file: "a.js",
        source: "function i(i, b, c) {}\nvar j = function (j, b, c) {};\nfunction k({ k, b }, { c, d }) {}\nfunction l([, l]) {}\nfunction foo([[a, b], [c, d]]) {}\n",
        expected: [],
    },
    {
        rule: "suspicious/noEmptyInterface",
        file: "a.ts",
        source: "interface A {}\n",
        expected: ["1:1 An empty interface is equivalent to {}."],
    },
    {
        rule: "suspicious/noEmptyInterface",
        file: "a.ts",
        source: 'interface A {\n  prop: string;\n}\n\n// Allow empty interfaces that extend a type.\ninterface B extends A {}\n\n// Allow empty interfaces in ambient modules\ndeclare module "mod" {\n  interface C {}\n}\n',
        expected: [],
    },
    {
        rule: "suspicious/noExplicitAny",
        file: "a.ts",
        source: "let variable: any = 1;\n",
        expected: ["1:15 Unexpected any. Specify a different type."],
    },
    {
        rule: "suspicious/noExplicitAny",
        file: "a.ts",
        source: "class SomeClass {\n   message: Array<Array<any>>;\n}\n",
        expected: ["2:25 Unexpected any. Specify a different type."],
    },
    {
        rule: "suspicious/noExplicitAny",
        file: "a.ts",
        source: "function fn(param: Array<any>): void {}\n",
        expected: ["1:26 Unexpected any. Specify a different type."],
    },
    {
        rule: "suspicious/noExplicitAny",
        file: "a.ts",
        source: "let variable: number = 1;\nlet variable2 = 1;\n",
        expected: [],
    },
    {
        rule: "suspicious/noExplicitAny",
        file: "a.ts",
        source: "class SomeClass<T extends any> {\n   message: Array<Array<unknown>>;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noExplicitAny",
        file: "a.ts",
        source: "function fn(param: Array<Array<unknown>>): Array<unknown> {}\n",
        expected: [],
    },
    {
        rule: "suspicious/noExtraNonNullAssertion",
        file: "a.ts",
        source: "const bar = foo!!.bar;\n",
        expected: ["1:13 Forbidden extra non-null assertion."],
    },
    {
        rule: "suspicious/noExtraNonNullAssertion",
        file: "a.ts",
        source: "function fn(bar?: { n: number }) {\n  return bar!?.n;\n}\n",
        expected: ["2:10 Forbidden extra non-null assertion."],
    },
    {
        rule: "suspicious/noExtraNonNullAssertion",
        file: "a.ts",
        source: "function fn(bar?: { n: number }) {\n  return ((bar!))?.();\n}\n",
        expected: ["2:12 Forbidden extra non-null assertion."],
    },
    {
        rule: "suspicious/noExtraNonNullAssertion",
        file: "a.ts",
        source: "const bar = foo!.bar;\n\nobj?.string!.trim();\n\nfunction fn(key: string | null) {\n  const obj = {};\n  return obj?.[key!];\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noFallthroughSwitchClause",
        file: "a.js",
        source: "switch (bar) {\n\tcase 0:\n\t\ta();\n\tcase 1:\n\t\tb();\n}\n",
        expected: ["2:2 This case is falling through to the next case."],
    },
    {
        rule: "suspicious/noFallthroughSwitchClause",
        file: "a.js",
        source: "switch (foo) {\n\tcase 1:\n    case 2:\n\t\tdoSomething();\n\t\tbreak;\n    case 3: {\n        if (cond) {\n            break;\n        } else {\n            break;\n        }\n    }\n\tcase 4:\n\t\tdoSomething();\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noFocusedTests",
        file: "a.js",
        source: 'describe.only("foo", () => {});\n',
        expected: ["1:10 Don't focus the test."],
    },
    {
        rule: "suspicious/noFocusedTests",
        file: "a.js",
        source: 'test.only("foo", () => {});\n',
        expected: ["1:6 Don't focus the test."],
    },
    {
        rule: "suspicious/noFocusedTests",
        file: "a.js",
        source: 'test.only.each([["a"]])("%s", (a) => {});\n',
        expected: ["1:6 Don't focus the test."],
    },
    {
        rule: "suspicious/noFocusedTests",
        file: "a.js",
        source: 'test("foo", () => {});\n',
        expected: [],
    },
    {
        rule: "suspicious/noFocusedTests",
        file: "a.js",
        source: 'test.each([["a"]])("%s", (a) => {});\n',
        expected: [],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "function foo() { };\nfoo = bar;\n",
        expected: ["1:10 Do not reassign a function declaration."],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "function foo() {\n    foo = bar;\n }\n",
        expected: ["1:10 Do not reassign a function declaration."],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "foo = bar;\nfunction foo() { };\n",
        expected: ["2:10 Do not reassign a function declaration."],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "[foo] = bar;\nfunction foo() { };\n",
        expected: ["2:10 Do not reassign a function declaration."],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "({ x: foo = 0 } = bar);\nfunction foo() { };\n",
        expected: ["2:10 Do not reassign a function declaration."],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "function foo() {\n    [foo] = bar;\n }\n",
        expected: ["1:10 Do not reassign a function declaration."],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "(function () {\n    ({ x: foo = 0 } = bar);\n    function foo() { };\n })();\n",
        expected: ["3:14 Do not reassign a function declaration."],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "function foo() {\n    var foo = bar;\n }\n",
        expected: [],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "function foo(foo) {\n    foo = bar;\n }\n",
        expected: [],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "function foo() {\n    var foo;\n    foo = bar;\n }\n",
        expected: [],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "var foo = () => {};\nfoo = bar;\n",
        expected: [],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "var foo = function() {};\nfoo = bar;\n",
        expected: [],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "var foo = function() {\n    foo = bar;\n };\n",
        expected: [],
    },
    {
        rule: "suspicious/noFunctionAssign",
        file: "a.js",
        source: "import bar from 'bar';\nfunction foo() {\n    var foo = bar;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noGlobalAssign",
        file: "a.js",
        source: "Object = null;\n",
        expected: ["1:1 A global variable should not be reassigned."],
    },
    {
        rule: "suspicious/noGlobalAssign",
        file: "a.js",
        source: "window = {};\n",
        expected: ["1:1 A global variable should not be reassigned."],
    },
    {
        rule: "suspicious/noGlobalAssign",
        file: "a.js",
        source: "undefined = true;\n",
        expected: ["1:1 A global variable should not be reassigned."],
    },
    {
        rule: "suspicious/noGlobalAssign",
        file: "a.js",
        source: "a = 0;\n",
        expected: [],
    },
    {
        rule: "suspicious/noGlobalAssign",
        file: "a.js",
        source: "let window;\nwindow = {};\n",
        expected: [],
    },
    {
        rule: "suspicious/noGlobalAssign",
        file: "a.js",
        source: "process = 1; console = 1; document = 1; globalThis = 1; require = 1; NaN = 1; Infinity++; JSON += 1; [Math] = a; ({ a: Date } = b);\n",
        expected: [
            "1:1 A global variable should not be reassigned.",
            "1:103 A global variable should not be reassigned.",
            "1:120 A global variable should not be reassigned.",
            "1:14 A global variable should not be reassigned.",
            "1:27 A global variable should not be reassigned.",
            "1:41 A global variable should not be reassigned.",
            "1:57 A global variable should not be reassigned.",
            "1:70 A global variable should not be reassigned.",
            "1:79 A global variable should not be reassigned.",
            "1:91 A global variable should not be reassigned.",
        ],
    },
    {
        rule: "suspicious/noGlobalIsFinite",
        file: "a.js",
        source: "isFinite(false); // true\n",
        expected: ["1:1 Use Number.isFinite instead of the global isFinite."],
    },
    {
        rule: "suspicious/noGlobalIsFinite",
        file: "a.js",
        source: "Number.isFinite(false); // false\n",
        expected: [],
    },
    {
        rule: "suspicious/noGlobalIsNan",
        file: "a.js",
        source: "isNaN({}); // true\n",
        expected: ["1:1 Use Number.isNaN instead of the global isNaN."],
    },
    {
        rule: "suspicious/noGlobalIsNan",
        file: "a.js",
        source: "Number.isNaN({}); // false\n",
        expected: [],
    },
    {
        rule: "suspicious/noImplicitAnyLet",
        file: "a.ts",
        source: "var a;\na = 2;\n",
        expected: ["1:5 This variable implicitly has the any type."],
    },
    {
        rule: "suspicious/noImplicitAnyLet",
        file: "a.ts",
        source: "let b;\nb = 1\n",
        expected: ["1:5 This variable implicitly has the any type."],
    },
    {
        rule: "suspicious/noImplicitAnyLet",
        file: "a.ts",
        source: "var a = 1;\nlet a:number;\nvar b: number\nvar b =10;\n",
        expected: [],
    },
    {
        rule: "suspicious/noImportAssign",
        file: "a.js",
        source: 'import x from "y";\nx = 1;\n',
        expected: ["2:1 The imported variable x is read-only"],
    },
    {
        rule: "suspicious/noImportAssign",
        file: "a.js",
        source: 'import y from "y";\n[y] = 1;\n',
        expected: ["2:2 The imported variable y is read-only"],
    },
    {
        rule: "suspicious/noImportAssign",
        file: "a.js",
        source: 'import z from "y";\n({ z } = 1);\n',
        expected: ["2:4 The imported variable z is read-only"],
    },
    {
        rule: "suspicious/noImportAssign",
        file: "a.js",
        source: 'import a from "y";\n[...a] = 1;\n',
        expected: ["2:5 The imported variable a is read-only"],
    },
    {
        rule: "suspicious/noImportAssign",
        file: "a.js",
        source: 'import b from "y";\n({ ...b } = 1);\n',
        expected: ["2:7 The imported variable b is read-only"],
    },
    {
        rule: "suspicious/noImportAssign",
        file: "a.js",
        source: 'import c from "y";\nfor (c in y) {};\n',
        expected: ["2:6 The imported variable c is read-only"],
    },
    {
        rule: "suspicious/noImportAssign",
        file: "a.js",
        source: 'import d from "y";\nd += 1;\n',
        expected: ["2:1 The imported variable d is read-only"],
    },
    {
        rule: "suspicious/noImportAssign",
        file: "a.js",
        source: 'import * as e from "y";\ne = 1;\n',
        expected: ["2:1 The imported variable e is read-only"],
    },
    {
        rule: "suspicious/noIrregularWhitespace",
        file: "a.js",
        source: "let\u000bcount;\n",
        expected: ["1:4 Irregular whitespaces found."],
    },
    {
        rule: "suspicious/noIrregularWhitespace",
        file: "a.js",
        source: "let\u2001foo;\n",
        expected: ["1:4 Irregular whitespaces found."],
    },
    {
        rule: "suspicious/noIrregularWhitespace",
        file: "a.js",
        source: "const count = 1;\n",
        expected: [],
    },
    {
        rule: "suspicious/noIrregularWhitespace",
        file: "a.js",
        source: "const foo = '\u000b';\n",
        expected: [],
    },
    {
        rule: "suspicious/noLabelVar",
        file: "a.js",
        source: 'const x1 = "test";\nx1: expr;\n',
        expected: ["2:1 Do not use the x1 variable name as a label"],
    },
    {
        rule: "suspicious/noLabelVar",
        file: "a.js",
        source: 'const x = "test";\nz: expr;\n',
        expected: [],
    },
    {
        rule: "suspicious/noMisleadingInstantiator",
        file: "a.ts",
        source: "interface I {\n  new (): I;\n  constructor(): void;\n}\n",
        expected: ["2:3 Don't use the new method in interfaces."],
    },
    {
        rule: "suspicious/noMisleadingInstantiator",
        file: "a.ts",
        source: "class C {\n  new(): C;\n}\n",
        expected: ["2:3 Don't use the new method in classes."],
    },
    {
        rule: "suspicious/noMisleadingInstantiator",
        file: "a.ts",
        source: "declare class C {\n  constructor();\n}\n\ninterface I {\n  new (): C;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noMisleadingInstantiator",
        file: "a.ts",
        source: "interface I1 { new (): I1; constructor(): I1; }\ntype T1 = { constructor(): void; new (): T1 };\nclass C1 { new(): C1 { return this; } }\ninterface I2 { new (): string; }\n",
        expected: [
            "1:16 Don't use the new method in interfaces.",
            "2:13 Don't use the constructor method in type aliases.",
        ],
    },
    {
        rule: "suspicious/noMisrefactoredShorthandAssign",
        file: "a.js",
        source: "a += a + b\n",
        expected: [
            "1:1 Variable appears on both sides of an assignment operation.",
        ],
    },
    {
        rule: "suspicious/noMisrefactoredShorthandAssign",
        file: "a.js",
        source: "a -= a - b\n",
        expected: [
            "1:1 Variable appears on both sides of an assignment operation.",
        ],
    },
    {
        rule: "suspicious/noMisrefactoredShorthandAssign",
        file: "a.js",
        source: "a *= a * b\n",
        expected: [
            "1:1 Variable appears on both sides of an assignment operation.",
        ],
    },
    {
        rule: "suspicious/noMisrefactoredShorthandAssign",
        file: "a.js",
        source: "a += b\n",
        expected: [],
    },
    {
        rule: "suspicious/noMisrefactoredShorthandAssign",
        file: "a.js",
        source: "a = a + b\n",
        expected: [],
    },
    {
        rule: "suspicious/noMisrefactoredShorthandAssign",
        file: "a.js",
        source: "a = a - b\n",
        expected: [],
    },
    {
        rule: "suspicious/noMisrefactoredShorthandAssign",
        file: "a.js",
        source: "a += 1 + a;\na ||= a || b;\na.b += a.b + 1;\na **= a ** 2;\n",
        expected: [
            "3:1 Variable appears on both sides of an assignment operation.",
            "4:1 Variable appears on both sides of an assignment operation.",
        ],
    },
    {
        rule: "suspicious/noNonNullAssertedOptionalChain",
        file: "a.ts",
        source: "obj?.prop!;\n",
        expected: ["1:1 Forbidden non-null assertion after optional chaining."],
    },
    {
        rule: "suspicious/noNonNullAssertedOptionalChain",
        file: "a.ts",
        source: "obj?.method()!.prop;\n",
        expected: ["1:1 Forbidden non-null assertion after optional chaining."],
    },
    {
        rule: "suspicious/noNonNullAssertedOptionalChain",
        file: "a.ts",
        source: "obj?.[key]!.method();\n",
        expected: ["1:1 Forbidden non-null assertion after optional chaining."],
    },
    {
        rule: "suspicious/noNonNullAssertedOptionalChain",
        file: "a.ts",
        source: "obj?.prop;\n",
        expected: [],
    },
    {
        rule: "suspicious/noNonNullAssertedOptionalChain",
        file: "a.ts",
        source: "obj!.prop?.method();\n",
        expected: [],
    },
    {
        rule: "suspicious/noNonNullAssertedOptionalChain",
        file: "a.ts",
        source: "obj?.prop ?? defaultValue;\n",
        expected: [],
    },
    {
        rule: "suspicious/noOctalEscape",
        file: "a.js",
        source: 'const foo = "Copyright \\251";\n',
        expected: ["1:24 Don't use deprecated octal escape sequences."],
    },
    {
        rule: "suspicious/noOctalEscape",
        file: "a.js",
        source: 'const foo = "Copyright \\u00A9"; // unicode escape\nconst bar = "Copyright \\xA9"; // hexadecimal escape\n',
        expected: [],
    },
    {
        rule: "suspicious/noOctalEscape",
        file: "a.js",
        source: 'const o1 = "\\0";\nconst o2 = "\\00";\nconst o3 = "\\08";\nconst o4 = "\\1";\nconst o5 = "\\377";\n',
        expected: [
            "2:13 Don't use deprecated octal escape sequences.",
            "4:13 Don't use deprecated octal escape sequences.",
            "5:13 Don't use deprecated octal escape sequences.",
        ],
    },
    {
        rule: "suspicious/noProto",
        file: "a.js",
        source: "obj.__proto__ = a;\n",
        expected: ["1:1 Avoid use of the deprecated __proto__ accessor."],
    },
    {
        rule: "suspicious/noProto",
        file: "a.js",
        source: "const b = obj.__proto__;\n",
        expected: ["1:11 Avoid use of the deprecated __proto__ accessor."],
    },
    {
        rule: "suspicious/noProto",
        file: "a.js",
        source: "const a = Object.getPrototypeOf(obj);\n",
        expected: [],
    },
    {
        rule: "suspicious/noProto",
        file: "a.js",
        source: "Object.setPrototypeOf(obj, b);\n",
        expected: [],
    },
    {
        rule: "suspicious/noProto",
        file: "a.js",
        source: "// This sets `foo`'s prototype to `null` (similar to `Object.create`), and is\n// well-defined across browsers.\nconst foo = {\n  __proto__: null,\n  a: 1,\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noProto",
        file: "a.js",
        source: 'a.__proto__.b = 1;\na["__proto__"];\n',
        expected: [
            "1:1 Avoid use of the deprecated __proto__ accessor.",
            "2:1 Avoid use of the deprecated __proto__ accessor.",
        ],
    },
    {
        rule: "suspicious/noPrototypeBuiltins",
        file: "a.js",
        source: 'var invalid = foo.hasOwnProperty("bar");\n',
        expected: [
            "1:19 Do not access Object.prototype method 'hasOwnProperty' from target object.",
        ],
    },
    {
        rule: "suspicious/noPrototypeBuiltins",
        file: "a.js",
        source: "var invalid = foo.isPrototypeOf(bar);\n",
        expected: [
            "1:19 Do not access Object.prototype method 'isPrototypeOf' from target object.",
        ],
    },
    {
        rule: "suspicious/noPrototypeBuiltins",
        file: "a.js",
        source: 'var invalid = foo.propertyIsEnumerable("bar");\n',
        expected: [
            "1:19 Do not access Object.prototype method 'propertyIsEnumerable' from target object.",
        ],
    },
    {
        rule: "suspicious/noPrototypeBuiltins",
        file: "a.js",
        source: 'Object.hasOwnProperty.call(foo, "bar");\n',
        expected: [
            "1:1 Do not access Object.prototype method 'hasOwnProperty' from target object.",
        ],
    },
    {
        rule: "suspicious/noPrototypeBuiltins",
        file: "a.js",
        source: 'var valid = Object.hasOwn(foo, "bar");\nvar valid = Object.prototype.isPrototypeOf.call(foo, bar);\nvar valid = {}.propertyIsEnumerable.call(foo, "bar");\n',
        expected: [],
    },
    {
        rule: "suspicious/noRedeclare",
        file: "a.js",
        source: "var a = 3;\nvar a = 10;\n",
        expected: ["2:5 'a' is redeclared in the same scope."],
    },
    {
        rule: "suspicious/noRedeclare",
        file: "a.js",
        source: "let a = 3;\nlet a = 10;\n",
        expected: ["2:5 'a' is redeclared in the same scope."],
    },
    {
        rule: "suspicious/noRedeclare",
        file: "a.js",
        source: "function f() {}\nfunction f() {}\n",
        expected: ["2:10 'f' is redeclared in the same scope."],
    },
    {
        rule: "suspicious/noRedeclare",
        file: "a.js",
        source: "class C {\n    static {\n        var c = 3;\n        var c = 10;\n    }\n}\n",
        expected: ["4:13 'c' is redeclared in the same scope."],
    },
    {
        rule: "suspicious/noRedeclare",
        file: "a.ts",
        source: "type Person = { name: string; }\nclass Person { name: string; }\n",
        expected: ["2:7 'Person' is redeclared in the same scope."],
    },
    {
        rule: "suspicious/noRedeclare",
        file: "a.js",
        source: "var a = 3;\na = 10;\n",
        expected: [],
    },
    {
        rule: "suspicious/noRedeclare",
        file: "a.ts",
        source: "class Foo {\n    bar(a: A);\n    bar(a: A, b: B);\n    bar(a: A, b: B) {}\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noSelfCompare",
        file: "a.js",
        source: "if (x === x) {}\n",
        expected: [
            "1:5 This comparison uses the same expression on both sides.",
        ],
    },
    {
        rule: "suspicious/noSelfCompare",
        file: "a.js",
        source: "if (a.b.c() !== a.b .c()) {}\n",
        expected: [
            "1:5 This comparison uses the same expression on both sides.",
        ],
    },
    {
        rule: "suspicious/noShadowRestrictedNames",
        file: "a.js",
        source: "function NaN() {}\n",
        expected: ['1:10 Do not shadow the global "NaN" property.'],
    },
    {
        rule: "suspicious/noShadowRestrictedNames",
        file: "a.js",
        source: "let Set;\n",
        expected: ['1:5 Do not shadow the global "Set" property.'],
    },
    {
        rule: "suspicious/noShadowRestrictedNames",
        file: "a.js",
        source: "try {\t} catch(Object) {}\n",
        expected: ['1:15 Do not shadow the global "Object" property.'],
    },
    {
        rule: "suspicious/noShadowRestrictedNames",
        file: "a.js",
        source: "function Array() {}\n",
        expected: ['1:10 Do not shadow the global "Array" property.'],
    },
    {
        rule: "suspicious/noShadowRestrictedNames",
        file: "a.js",
        source: "function test(JSON) {console.log(JSON)}\n",
        expected: ['1:15 Do not shadow the global "JSON" property.'],
    },
    {
        rule: "suspicious/noSparseArray",
        file: "a.js",
        source: "[1,,2]\n",
        expected: ["1:1 This array contains an empty slots.."],
    },
    {
        rule: "suspicious/noSparseArray",
        file: "a.js",
        source: "[1, undefined, 2]\n",
        expected: [],
    },
    {
        rule: "suspicious/noSuspiciousSemicolonInJsx",
        file: "a.jsx",
        source: "const Component = () => {\n  return (\n    <div>\n      <div />;\n    </div>\n );\n}\n",
        expected: ["4:14 There is a suspicious semicolon in the JSX element."],
    },
    {
        rule: "suspicious/noSuspiciousSemicolonInJsx",
        file: "a.jsx",
        source: "const Component = () => {\n  return (\n    <div>\n      <div />\n      ;\n    </div>\n  );\n}\nconst Component2 = () => {\n  return (\n    <div>\n      <span>;</span>\n    </div>\n  );\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noSuspiciousSemicolonInJsx",
        file: "a.jsx",
        source: "<div><span />;text</div>;\n<div><span></span>;</div>;\n",
        expected: [],
    },
    {
        rule: "suspicious/noTemplateCurlyInString",
        file: "a.js",
        source: 'const a = "Hello ${name}!";\n',
        expected: ["1:18 Unexpected template string placeholder."],
    },
    {
        rule: "suspicious/noTemplateCurlyInString",
        file: "a.js",
        source: "const a = 'Hello ${name}!';\n",
        expected: ["1:18 Unexpected template string placeholder."],
    },
    {
        rule: "suspicious/noTemplateCurlyInString",
        file: "a.js",
        source: 'const a = "Time: ${12 * 60 * 60 * 1000}";\n',
        expected: ["1:18 Unexpected template string placeholder."],
    },
    {
        rule: "suspicious/noTemplateCurlyInString",
        file: "a.js",
        source: "const a = `Hello ${name}!`;\nconst a = `Time: ${12 * 60 * 60 * 1000}`;\n\nconst a = templateFunction`Hello ${name}`;\n",
        expected: [],
    },
    {
        rule: "suspicious/noTemplateCurlyInString",
        file: "a.js",
        source: 'const t1 = "${";\nconst t2 = "$ {a}";\nconst t3 = "${a} ${b}";\n',
        expected: ["3:13 Unexpected template string placeholder."],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "export {then};\n",
        expected: ["1:9 This export exposes the name then."],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "const foo = {\n    then() {}\n};\n",
        expected: ["2:5 This object defines a then property."],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "const foo = {\n    get then() {}\n};\n",
        expected: ["2:9 This object defines a then property."],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "const foo = {\n   get then() {}\n};\n",
        expected: ["2:8 This object defines a then property."],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "foo.then = function () {}\n",
        expected: ["1:1 This object defines a then property."],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "class Foo {\n    then() {}\n}\n",
        expected: ["2:5 This class defines a then member."],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "class Foo {\n    static then() {}\n}\n",
        expected: ["2:12 This class defines a then member."],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "export {then as success};\n",
        expected: [],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "const foo = {\n    success() {}\n};\n",
        expected: [],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "class Foo {\n    success() {}\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/noThenProperty",
        file: "a.js",
        source: "const foo = bar.then;\n",
        expected: [],
    },
    {
        rule: "suspicious/noTsIgnore",
        file: "a.ts",
        source: "// @ts-ignore\nlet foo;\n",
        expected: [
            "1:4 Unsafe use of the @ts-ignore directive found in this comment.",
        ],
    },
    {
        rule: "suspicious/noTsIgnore",
        file: "a.ts",
        source: "// @ts-expect-error\nlet foo;\n",
        expected: [],
    },
    {
        rule: "suspicious/noUnsafeDeclarationMerging",
        file: "a.ts",
        source: "interface Foo {\n    f(): void\n}\n\nclass Foo {}\n\nconst foo = new Foo();\nfoo.f(); // Runtime Error: Cannot read properties of undefined.\n",
        expected: ["5:7 This class is unsafely merged with an interface."],
    },
    {
        rule: "suspicious/noUnsafeDeclarationMerging",
        file: "a.ts",
        source: "interface Foo {}\nclass Bar implements Foo {}\n",
        expected: [],
    },
    {
        rule: "suspicious/noUnsafeDeclarationMerging",
        file: "a.ts",
        source: "namespace Baz {}\nnamespace Baz {}\nenum Baz {}\n",
        expected: [],
    },
    {
        rule: "suspicious/noUnsafeDeclarationMerging",
        file: "a.ts",
        source: "interface Foo2 {}\ndeclare class Foo2 {}\nclass Foo3 {}\ninterface Foo3 {}\nexport class Foo4 {}\nexport interface Foo4 {}\n",
        expected: [
            "3:7 This class is unsafely merged with an interface.",
            "5:14 This class is unsafely merged with an interface.",
        ],
    },
    {
        rule: "suspicious/noUnsafeNegation",
        file: "a.js",
        source: "!1 in [1,2];\n",
        expected: [
            "1:1 The negation operator is used unsafely on the left side of this binary expression.",
        ],
    },
    {
        rule: "suspicious/noUnsafeNegation",
        file: "a.js",
        source: "/**test*/!/** test*/1 instanceof [1,2];\n",
        expected: [
            "1:10 The negation operator is used unsafely on the left side of this binary expression.",
        ],
    },
    {
        rule: "suspicious/noUnsafeNegation",
        file: "a.js",
        source: "-1 in [1,2];\n~1 in [1,2];\ntypeof 1 in [1,2];\nvoid 1 in [1,2];\ndelete 1 in [1,2];\n+1 instanceof [1,2];\n",
        expected: [],
    },
    {
        rule: "suspicious/noUselessEscapeInString",
        file: "a.js",
        source: 'const s = "\\a";\n',
        expected: ["1:13 The character doesn't need to be escaped."],
    },
    {
        rule: "suspicious/noUselessEscapeInString",
        file: "a.js",
        source: 'const o = {\n    "\\a": 0,\n};\n',
        expected: ["2:7 The character doesn't need to be escaped."],
    },
    {
        rule: "suspicious/noUselessEscapeInString",
        file: "a.js",
        source: "const s = `${0}\\a`;\n",
        expected: ["1:17 The character doesn't need to be escaped."],
    },
    {
        rule: "suspicious/noUselessEscapeInString",
        file: "a.js",
        source: 'const s = "\\n";\n',
        expected: [],
    },
    {
        rule: "suspicious/noUselessEscapeInString",
        file: "a.js",
        source: "const s = `\\${0}`;\n",
        expected: [],
    },
    {
        rule: "suspicious/noUselessEscapeInString",
        file: "a.js",
        source: "const s = tagged`\\a`;\n",
        expected: [],
    },
    {
        rule: "suspicious/noUselessEscapeInString",
        file: "a.jsx",
        source: '<div attr="str\\a"/>;\n',
        expected: [],
    },
    {
        rule: "suspicious/noUselessEscapeInString",
        file: "a.js",
        source: 'const s1 = "\\\'";\nconst s4 = `\\\'`;\nconst s7 = `$\\{a}`;\nconst c = `\\$`;\nconst d = `\\${a}`;\nconst i = `\\a${x}\\/`;\nconst j = "\\0 \\n \\x41";\n',
        expected: [
            "1:14 The character doesn't need to be escaped.",
            "2:14 The character doesn't need to be escaped.",
            "4:13 The character doesn't need to be escaped.",
            "6:13 The character doesn't need to be escaped.",
        ],
    },
    {
        rule: "suspicious/noWith",
        file: "a.cjs",
        source: "function f() {\n  with (point) {\n    r = Math.sqrt(x * x + y * y); // is r a member of point?\n  }\n}\n",
        expected: ["2:3 Unexpected use of with statement."],
    },
    {
        rule: "suspicious/useAdjacentOverloadSignatures",
        file: "a.ts",
        source: "type Foo = {\n  foo_type(s: string): void;\n  foo_type(n: number): void;\n  bar_type(): void;\n  foo_type(sn: string | number): void;\n};\n",
        expected: ["5:3 All foo_type signatures must be adjacent."],
    },
    {
        rule: "suspicious/useAdjacentOverloadSignatures",
        file: "a.ts",
        source: "interface Foo {\n  foo_interface(s: string): void;\n  foo_interface(n: number): void;\n  bar_interface(): void;\n  foo_interface(sn: string | number): void;\n}\n",
        expected: ["5:3 All foo_interface signatures must be adjacent."],
    },
    {
        rule: "suspicious/useAdjacentOverloadSignatures",
        file: "a.ts",
        source: "class A {\n  fooA(s: string): void;\n  fooA(n: number): void;\n  barA(): void {};\n  fooA(sn: string | number): void {};\n}\n",
        expected: ["5:3 All fooA signatures must be adjacent."],
    },
    {
        rule: "suspicious/useAdjacentOverloadSignatures",
        file: "a.ts",
        source: "declare namespace Foo {\n  export function foo_declare(s: string): void;\n  export function foo_declare(n: number): void;\n  export function foo_declare(sn: string | number): void;\n  export function bar_declare(): void;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/useAdjacentOverloadSignatures",
        file: "a.ts",
        source: "type Foo = {\n  foo_type(s: string): void;\n  foo_type(n: number): void;\n  foo_type(sn: string | number): void;\n  bar_type(): void;\n};\n",
        expected: [],
    },
    {
        rule: "suspicious/useAdjacentOverloadSignatures",
        file: "a.ts",
        source: "interface Foo {\n  foo_interface(s: string): void;\n  foo_interface(n: number): void;\n  foo_interface(sn: string | number): void;\n  bar_interface(): void;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/useAdjacentOverloadSignatures",
        file: "a.ts",
        source: "class A {\n  fooA(s: string): void;\n  fooA(n: number): void;\n  fooA(sn: string | number): void {}\n  barA(): void {}\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/useAdjacentOverloadSignatures",
        file: "a.ts",
        source: "class D { a(): void; b(): void; a(x: number): void {} static a(): void {} }\n",
        expected: ["1:33 All a signatures must be adjacent."],
    },
    {
        rule: "suspicious/useDefaultSwitchClauseLast",
        file: "a.js",
        source: "switch (foo) {\n    default:\n        break;\n    case 0:\n        break;\n}\n",
        expected: ["2:5 The default clause should be the last switch clause."],
    },
    {
        rule: "suspicious/useDefaultSwitchClauseLast",
        file: "a.js",
        source: "switch (foo) {\n    default:\n        f();\n    case 0:\n        break;\n}\n",
        expected: ["2:5 The default clause should be the last switch clause."],
    },
    {
        rule: "suspicious/useDefaultSwitchClauseLast",
        file: "a.js",
        source: "switch (foo) {\n    case 0:\n        break;\n    default:\n    case 1:\n        break;\n}\n",
        expected: ["4:5 The default clause should be the last switch clause."],
    },
    {
        rule: "suspicious/useDefaultSwitchClauseLast",
        file: "a.js",
        source: "switch (foo) {\n    case 0:\n        break;\n    case 1:\n    default:\n        break;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/useDefaultSwitchClauseLast",
        file: "a.js",
        source: "switch (foo) {\n    case 0:\n        break;\n}\n",
        expected: [],
    },
    {
        rule: "suspicious/useGetterReturn",
        file: "a.js",
        source: "class Person {\n    get firstName() {}\n}\n",
        expected: ["2:5 This getter should return a value."],
    },
    {
        rule: "suspicious/useGetterReturn",
        file: "a.js",
        source: "const obj = {\n    get firstName() {\n        return;\n    }\n}\n",
        expected: [
            "3:9 This return should return a value because it is located in a getter.",
        ],
    },
    {
        rule: "suspicious/useGetterReturn",
        file: "a.js",
        source: "class Option {\n    get value() {\n        if (this.hasValue) {\n            log();\n        } else {\n            return null;\n        }\n    }\n}\n",
        expected: ["2:5 This getter should return a value."],
    },
    {
        rule: "suspicious/useGetterReturn",
        file: "a.js",
        source: 'class Person {\n    get firstName() {\n        return this.fullname.split(" ")[0];\n    }\n}\n',
        expected: [],
    },
    {
        rule: "suspicious/useGetterReturn",
        file: "a.js",
        source: 'const obj = {\n    get firstName() {\n        return this.fullname.split(" ")[0];\n    }\n}\n',
        expected: [],
    },
    {
        rule: "suspicious/useIsArray",
        file: "a.js",
        source: "const xs = [];\nif (xs instanceof Array) {}\n",
        expected: ["2:5 Use Array.isArray() instead of instanceof Array."],
    },
    {
        rule: "suspicious/useIsArray",
        file: "a.js",
        source: "const xs = [];\nif (Array.isArray(xs)) {}\n",
        expected: [],
    },
    {
        rule: "suspicious/useIterableCallbackReturn",
        file: "a.js",
        source: "[].map(() => {\n    // Missing return value\n});\n",
        expected: [
            "1:4 This callback passed to map() iterable method should always return a value.",
        ],
    },
    {
        rule: "suspicious/useIterableCallbackReturn",
        file: "a.js",
        source: "[].forEach(() => {\n    // No return value, which is correct\n});\n",
        expected: [],
    },
    {
        rule: "suspicious/useIterableCallbackReturn",
        file: "a.js",
        source: "[].filter(() => {\n    // Missing required return value\n});\n",
        expected: [
            "1:4 This callback passed to filter() iterable method should always return a value.",
        ],
    },
    {
        rule: "suspicious/useIterableCallbackReturn",
        file: "a.js",
        source: "[].map(() => {\n    return 1; // Correctly returns a value\n});\n",
        expected: [],
    },
    {
        rule: "suspicious/useIterableCallbackReturn",
        file: "a.js",
        source: "[].forEach(() => void null); // Void return value, which doesn't trigger the rule\n",
        expected: [],
    },
    {
        rule: "suspicious/useIterableCallbackReturn",
        file: "a.js",
        options: { checkForEach: false },
        source: "[1, 2, 3].forEach((el) => {\n    return el * 2;\n});\n",
        expected: [],
    },
    {
        rule: "suspicious/useIterableCallbackReturn",
        file: "a.js",
        options: { allowImplicit: true },
        source: ";[1, 2, 3].map((it) => {\n    if (it % 2 === 0) {\n        return it;\n    }\n    if (it > 2) {\n        return it ** 2;\n    }\n    return;\n}).filter(Boolean);\n",
        expected: [],
    },
    {
        rule: "suspicious/useIterableCallbackReturn",
        file: "a.js",
        source: "[1].forEach((el) => el * 2);\n[1].forEach((el) => { if (a) return; });\n[1].map((el) => { if (a) return 1; });\n[1].map(function (el) { throw new Error(); });\nArray.from(a, (x) => { x; });\n[1].map(async () => {});\nx.map((el) => { switch (el) { case 1: return 1; default: return 2; } });\n",
        expected: [
            "1:5 This callback passed to forEach() iterable method should not return a value.",
            "3:5 This callback passed to map() iterable method should always return a value.",
            "5:7 This callback passed to Array.from() method should always return a value.",
        ],
    },
    {
        rule: "suspicious/useNamespaceKeyword",
        file: "a.ts",
        source: "module Example {}\n",
        expected: [
            "1:1 Use the namespace keyword instead of the outdated module keyword.",
        ],
    },
    {
        rule: "suspicious/useNamespaceKeyword",
        file: "a.ts",
        source: "namespace Example {}\n",
        expected: [],
    },
    {
        rule: "suspicious/useNamespaceKeyword",
        file: "a.ts",
        source: 'declare module "foo" {}\n',
        expected: [],
    },
];

describe("lintero", () => {
    describe("reports like Biome", () => {
        test.each(biome)(
            "$rule in $file: $source",
            ({ rule, file, options, source, expected }) => {
                const received = new Lintero(
                    settings(only(rule, { level: "on", options })),
                )
                    .lint(source, file)
                    .map((d) => `${d.line}:${d.column} ${d.message}`);
                expect(received.sort()).toEqual(expected);
            },
        );
    });

    describe("settings", () => {
        test("the recommended preset is the default, nursery and domain rules are not in it", () => {
            const names = new Lintero(settings()).active.map(
                ({ rule }) => rule.name,
            );
            expect(names).toContain("noDebugger");
            expect(names).not.toContain("noFocusedTests");
            expect(
                new Lintero(settings({ preset: "none" })).active,
            ).toHaveLength(0);
            expect(
                new Lintero(settings({ recommended: false })).active,
            ).toHaveLength(0);
        });

        test("groups and rules take a level or a configuration with options", () => {
            expect(lint("debugger;", "a.js", { suspicious: "off" })).toEqual(
                [],
            );
            expect(lint("debugger;", "a.js", { suspicious: "warn" })).toEqual([
                "1:1 lint/suspicious/noDebugger This is an unexpected use of the debugger statement.",
            ]);
            const lintero = new Lintero(
                settings({
                    suspicious: {
                        noDebugger: "info",
                        noDoubleEquals: {
                            level: "on",
                            options: { ignoreNull: false },
                        },
                    },
                }),
            );
            expect(lintero.lint("debugger;", "a.js")[0]?.severity).toBe("info");
            expect(lintero.lint("a == null;", "a.js")).toHaveLength(1);
        });

        test("domains are enabled by dependencies or settings", () => {
            const source = "test.only('a', () => {});";
            const lintero = (rules: object, manifest = {}) =>
                new Lintero(settings(rules), manifest)
                    .lint(source, "a.js")
                    .map((d) => d.category);
            expect(lintero({})).toEqual([]);
            expect(
                lintero({}, { devDependencies: { jest: "^30.5.2" } }),
            ).toEqual(["lint/suspicious/noFocusedTests"]);
            expect(
                lintero({}, { devDependencies: { jest: "^25.0.0" } }),
            ).toEqual([]);
            expect(lintero({ domains: { test: "recommended" } })).toEqual([
                "lint/suspicious/noFocusedTests",
            ]);
            expect(
                lintero(
                    { domains: { test: "none" } },
                    { dependencies: { vitest: "1.0.0" } },
                ),
            ).toEqual([]);
        });

        test("the linter, languages and files can be turned off", () => {
            expect(lint("debugger;", "a.js", { enabled: false })).toEqual([]);
            expect(
                lint("debugger;", "a.js", { javascript: { enabled: false } }),
            ).toEqual([]);
            expect(
                lint('{ "a": 1, "a": 2 }', "a.json", {
                    json: { enabled: false },
                }),
            ).toEqual([]);
            expect(
                lint("debugger;", "src/a.js", { includes: ["lib/**"] }),
            ).toEqual([]);
            expect(
                lint("debugger;", "src/a.js", { includes: ["**", "!src"] }),
            ).toEqual([]);
            expect(lint("debugger;", "a.md")).toEqual([]);
        });
    });

    describe("scopes", () => {
        // the expected diagnostics are Biome's, but for rules lintero does not implement
        test("types and values, declarations and their uses are told apart", () => {
            const source = [
                'import type { Shape } from "./shape";',
                'import { area, unused } from "./area";',
                "export enum Kind { Circle = 1, Square = Circle + 1 }",
                "export namespace Shapes { export const all: Shape[] = []; const hidden = 1; }",
                "type Pair<T, U> = [T, U];",
                "interface Box<T> extends Pair<T, T> { value: T; [key: string]: unknown }",
                "export class Store<T> implements Box<T> {",
                "    #items = new Map<string, T>();",
                "    static create<V>(this: void): Store<V> { return new Store<V>(); }",
                "    constructor(private readonly name: string, public value: T) {}",
                "    get size(): number { return this.#items.size; }",
                "    *[Symbol.iterator]() { yield* this.#items.values(); }",
                "    find(predicate: (item: T, index: number) => boolean): T | undefined {",
                "        for (const [key, item] of this.#items) if (predicate(item, Number(key))) return item;",
                "    }",
                "}",
                "export function measure<S extends Shape>({ kind, ...rest }: S, scale = 1): number {",
                "    let total = 0;",
                "    total += area(rest) * scale;",
                "    const label = `${kind}`;",
                '    return typeof label === "string" ? total : 0;',
                "}",
                "declare global { interface Window { store: Store<number> } }",
                "type Keys<T> = { [K in keyof T]: T[K] extends infer V ? V : never };",
                "export type { Keys };",
            ].join("\n");
            expect(lint(source)).toEqual([
                "2:16 lint/correctness/noUnusedImports Several of these imports are unused.",
                "4:65 lint/correctness/noUnusedVariables This variable hidden is unused.",
            ]);
        });

        test("assignments, updates and redeclarations are tracked", () => {
            const source = [
                "const a = 1;",
                "a = 2;",
                "let b = 0;",
                "b++;",
                "var c = 1;",
                "var c = 2;",
                "function f(d) { var d = 3; return d; }",
                "class E {}",
                "E = null;",
                "try { f(c); } catch (error) { error = 1; }",
                "label: for (;;) { break label; }",
            ].join("\n");
            expect(lint(source, "a.js")).toEqual([
                "1:7 lint/correctness/noUnusedVariables This variable a is unused.",
                "2:1 lint/correctness/noConstAssign Can't assign a because it's a constant.",
                "3:5 lint/correctness/noUnusedVariables This variable b is unused.",
                "5:5 lint/correctness/noUnusedVariables This variable c is unused.",
                "6:5 lint/suspicious/noRedeclare 'c' is redeclared in the same scope.",
                "7:12 lint/correctness/noUnusedFunctionParameters This parameter d is unused.",
                "7:21 lint/suspicious/noRedeclare 'd' is redeclared in the same scope.",
                "8:7 lint/correctness/noUnusedVariables This class E is unused.",
                "9:1 lint/suspicious/noClassAssign The class 'E' is reassigned.",
                "10:22 lint/correctness/noUnusedVariables This variable error is unused.",
                "10:31 lint/suspicious/noCatchAssign Reassigning a catch parameter is confusing.",
                "11:25 lint/complexity/noUselessLabel Unnecessary label.",
            ]);
        });
    });

    describe("files", () => {
        test("JSON objects have no duplicate keys", () => {
            expect(
                lint('{ "a": 1, "b": { "a": 2 }, "a": 3 }', "a.json"),
            ).toEqual([
                "1:28 lint/suspicious/noDuplicateObjectKeys The key a was already declared.",
            ]);
        });

        test("syntax errors are reported", () => {
            expect(lint("const = ;")).toEqual([
                expect.stringMatching(/^1:7 parse /),
            ]);
        });
    });

    describe("suppressions", () => {
        test("a comment suppresses rules on the line of the next token", () => {
            expect(
                lint(
                    "// biome-ignore lint/suspicious/noDebugger: testing\ndebugger;",
                    "a.js",
                ),
            ).toEqual([]);
            expect(
                lint(
                    "// biome-ignore lint/suspicious: testing\ndebugger;",
                    "a.js",
                ),
            ).toEqual([]);
            expect(
                lint("// lintero-ignore lint: testing\ndebugger;", "a.js"),
            ).toEqual([]);
            // a trailing comment suppresses the following line
            expect(
                lint(
                    "debugger; // biome-ignore lint: testing\nlet a = 1;",
                    "a.js",
                ),
            ).toEqual([
                "1:1 lint/suspicious/noDebugger This is an unexpected use of the debugger statement.",
            ]);
        });

        test("whole files and ranges are suppressed", () => {
            expect(
                lint(
                    "// biome-ignore-all lint/suspicious/noDebugger: testing\ndebugger;\ndebugger;",
                    "a.js",
                ),
            ).toEqual([]);
            expect(
                lint(
                    "// biome-ignore-start lint/suspicious/noDebugger: testing\ndebugger;\n// biome-ignore-end lint/suspicious/noDebugger: testing\ndebugger;",
                    "a.js",
                ),
            ).toEqual([
                "4:1 lint/suspicious/noDebugger This is an unexpected use of the debugger statement.",
            ]);
        });

        test("unused and malformed suppressions are reported", () => {
            expect(
                lint(
                    "// biome-ignore lint/suspicious/noDebugger: testing\nfoo();",
                    "a.js",
                ),
            ).toEqual([
                "1:1 suppressions/unused Suppression comment has no effect. Remove the suppression or make sure you are suppressing the correct rule.",
            ]);
            expect(
                lint(
                    "// biome-ignore lint/suspicious/noDebugger\ndebugger;",
                    "a.js",
                ),
            ).toEqual([
                "1:17 suppressions/parse Unexpected token, expected one of ':', '(' or whitespace. Example of suppression: // biome-ignore lint: reason",
                "2:1 lint/suspicious/noDebugger This is an unexpected use of the debugger statement.",
            ]);
            expect(
                lint("// biome-ignore lint/suspicous: testing\nfoo();", "a.js"),
            ).toEqual([
                expect.stringContaining(
                    'suppressions/parse Failed to parse category "lint/suspicous".',
                ),
            ]);
        });
    });

    describe("fixes", () => {
        test("safe fixes apply with write, unsafe ones only when asked", () => {
            const lintero = new Lintero(settings());
            const source = "let a = 1;\nif (a == 2) debugger;\n";
            expect(lintero.fix(source, "a.js")).toBe(
                "const a = 1;\nif (a == 2) debugger;\n",
            );
            expect(lintero.fix(source, "a.js", true)).toBe(
                "const a = 1;\nif (a === 2) {}\n",
            );
        });

        test("a rule's fix can be turned off", () => {
            const lintero = new Lintero(
                settings({ style: { useConst: { level: "on", fix: "none" } } }),
            );
            expect(lintero.fix("let a = 1;\nfoo(a);\n", "a.js")).toBe(
                "let a = 1;\nfoo(a);\n",
            );
        });

        test("fixes keep the code valid", () => {
            const lintero = new Lintero(settings());
            expect(
                lintero.fix(
                    'import { foo as foo } from "fs";\nfoo();\n',
                    "a.js",
                    true,
                ),
            ).toBe('import { foo } from "node:fs";\nfoo();\n');
            expect(lintero.fix("const x = !!a ? 1 : 2;\n", "a.js")).toBe(
                "const x = a ? 1 : 2;\n",
            );
            expect(
                lintero.fix('a["b"] = c?.["d"] + e[ "f" ];\n', "a.js", true),
            ).toBe("a.b = c?.d + e.f;\n");
        });
    });
});
