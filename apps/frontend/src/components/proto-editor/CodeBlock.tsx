import type { CodeToHtmlOptions } from "@llm-ui/code";
import {
  loadHighlighter,
  useCodeBlockToHtml,
  allLangs,
  allLangsAlias,
} from "@llm-ui/code";
import { bundledThemes } from "shiki/themes";
import { type LLMOutputComponent } from "@llm-ui/react";
import parseHtml from "html-react-parser";
import { createHighlighterCore } from "shiki/core";
import { bundledLanguagesInfo } from "shiki/langs";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

const highlighter = loadHighlighter(
  createHighlighterCore({
    langs: allLangs(bundledLanguagesInfo),
    langAlias: allLangsAlias(bundledLanguagesInfo),
    themes: Object.values(bundledThemes),
    engine: createOnigurumaEngine(() => import("shiki/wasm")),
  }),
);

const codeToHtmlOptions: CodeToHtmlOptions = {
  theme: "github-dark",
};

export const CodeBlock: LLMOutputComponent = ({ blockMatch }) => {
  const { html, code } = useCodeBlockToHtml({
    markdownCodeBlock: blockMatch.output,
    highlighter,
    codeToHtmlOptions,
  });

  if (!html) {
    return (
      <pre className="bg-node-input rounded p-4">
        <code className="text-node-foreground">{code}</code>
      </pre>
    );
  }

  return <div className="code-block">{parseHtml(html)}</div>;
};
