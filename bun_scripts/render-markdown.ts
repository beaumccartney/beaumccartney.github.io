import { micromark } from "micromark";
import { math, mathHtml } from "micromark-extension-math";
import {
  gfmStrikethrough,
  gfmStrikethroughHtml,
} from "micromark-extension-gfm-strikethrough";

const md_file = Bun.argv[2];

if (md_file === undefined) {
  throw new Error("missing file to convert to html");
}

const markdown = await Bun.file(md_file).text();

const html = micromark(markdown, {
  allowDangerousHtml: true,
  extensions: [math(), gfmStrikethrough({ singleTilde: false })],
  htmlExtensions: [mathHtml(), gfmStrikethroughHtml()],
});

console.log(html);
