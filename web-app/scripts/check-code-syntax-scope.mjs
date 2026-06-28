import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

const outdir = join(tmpdir(), "quizcraft-code-syntax-test");
mkdirSync(outdir, { recursive: true });

const outfile = join(outdir, `CodeSyntaxScope-${Date.now()}.mjs`);
await esbuild.build({
  entryPoints: ["src/components/codeSyntaxRenderer.ts"],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  logLevel: "silent",
});

const module = await import(pathToFileURL(outfile).href);
const renderRichText = module.renderRichText;

assert.equal(typeof renderRichText, "function", "renderRichText must be exported");

const javaBlock = renderRichText("阅读代码：\n```java\nint a = 1;\nSystem.out.println(a);\n```");
assert.match(javaBlock, /qc-code-block/);
assert.match(javaBlock, /data-language="JAVA"/);
assert.match(javaBlock, /data-swipe-ignore="true"/);
assert.match(javaBlock, /System\.out/);

const backtickInline = renderRichText('已知 `String str = "Java";` 的结果');
assert.match(backtickInline, /qc-inline-code/);
assert.match(backtickInline, /String str/);

const nakedHtml = renderRichText("在HTML5中，<video>标签用于嵌入视频，<audio>用于音频。");
assert.match(nakedHtml, /qc-inline-code/, "naked HTML tags should render as inline code");
assert.match(nakedHtml, /qc-code-token--tag">video/);
assert.match(nakedHtml, /qc-code-token--tag">audio/);

const plainText = renderRichText("普通题干不应该被错误解析。");
assert.equal(plainText, "普通题干不应该被错误解析。");

const routerPrompt = renderRichText("<MSR>display ip routing-table 6.6.6.6");
assert.doesNotMatch(routerPrompt, /qc-inline-code/, "router prompts should not be treated as HTML tags");

writeFileSync(join(outdir, "last-output.html"), [javaBlock, backtickInline, nakedHtml, plainText].join("\n"));
