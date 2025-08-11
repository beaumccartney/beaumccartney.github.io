#!/usr/bin/env -S bun run

import { opendir } from "node:fs/promises";

import path from "node:path";
import process from "node:process";

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeExternalLinks from "rehype-external-links";
import rehypeFormat from "rehype-format";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import remarkFrontmatter from "remark-frontmatter";
import { matter } from "vfile-matter";

import type { ElementContent, Root } from "hast";

import * as cheerio from "cheerio";

import { $ } from "bun";

process.chdir(import.meta.dir);

const website_url = "https://beaumccartney.com";

const src_dir = "src";
const build_dir = "build";
const css_dir = "css";
const css_out_dir = path.join(build_dir, css_dir);
const fonts_out_dir = path.join(css_out_dir, "fonts");
const blog_dir = "blog";
const katex_css_out = "katex.css";
const highlight_css_out = "highlight.css";
const assets_dir = "assets";
const markdown_extension = ".md";
const rss_file = "rss.xml";

await $`rm -rf ${build_dir}`;
await $`mkdir -p ${fonts_out_dir}`;
await $`cp -r ${assets_dir}/* build`;

const node_modules_dir = "node_modules/";
await $`cp ${path.join(node_modules_dir, "highlight.js/styles/base16/gruvbox-dark-medium.min.css")} ${path.join(css_out_dir, highlight_css_out)}`;

const katex_module = path.join(node_modules_dir, "katex/dist");
await $`cp ${path.join(katex_module, "katex.min.css")} ${path.join(css_out_dir, katex_css_out)}`;
await $`cp ${path.join(katex_module, "fonts")}/* ${fonts_out_dir}`;

const complete_page_template = (
  title: string,
  content: string,
  description: string,
  url: string,
  og_type: string,
  og_extras: { property: string; content: string }[],
) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <meta name="author" content="Beau McCartney">
    <meta name="description" content="${description}">
    <meta
      name="keywords"
      content="personal, portfolio, website, beau, mccartney, Beau McCartney, software, engineer, computer, graphics, gamedev"
    >
    <meta name="robots" content="index, follow">
    <meta property="og:title" content="${title}">
    <meta property="og:url" content="${url}">
    <meta property="og:type" content="${og_type}">
    <meta property="og:description" content="${description}">
    ${og_extras.map((extra) => `<meta property="${extra.property}" content="${extra.content}">`).join("\n")}

    <link rel="stylesheet" href="${path.join("/", css_dir, katex_css_out)}">

    <link rel="stylesheet" href="${path.join("/", css_dir, "sakura-dark.css")}">

    <link rel="stylesheet" href="${path.join("/", css_dir, highlight_css_out)}">

    <link rel="alternate" type="application/rss+xml" title="RSS" href="/${rss_file}">
    <script data-goatcounter="https://beaumccartney.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
  </head>
  <body>
    <main>
    ${content}
    </main>
  </body>
</html>`;

// helper for computing the footnote number in the template
function footnote_number(ix: number): number {
  return ix + 1;
}

const footnote_link_id_template = (ix: number) => `fn_link-${ix}`;

const footnote_id_template = (ix: number) => `fn-${ix}`;

const time_element_template = (thedate: string) =>
  `<time datetime="${thedate}">${thedate}</time>`;

type Page = {
  content: string;
  title: string;
  description: string;
  publish_date: string | null;
};
async function process_markdown_content(file: Bun.BunFile): Promise<Page> {
  const markdown = await file.text();

  const file_out = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(() => (_, file_v) => { matter(file_v); })
    .use(remarkGfm, { singleTilde: false })
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex)
    .use(rehypeExternalLinks, { target: "_blank", rel: ["nofollow", "noopener", "noreferrer"] })
    .use(rehypeHighlight)
    .use(() => function(tree: Root) {
      const notes: ElementContent[][] = [];
      visit(tree, "element", (node, index, parent) => {
        if (node.tagName === "fn" && parent && typeof index === "number") {
          const ix = notes.length;
          const note_children = node.children;
          notes.push(note_children);
          parent.children[index] = {
            type: "element",
            tagName: "sup",
            properties: { id: footnote_link_id_template(ix) },
            children: [
              {
                type: "element",
                tagName: "a",
                properties: { href: `#${footnote_id_template(ix)}` },
                children: [{ type: "text", value: String(footnote_number(ix)) }],
              },
            ],
          };
        }
      });
      if (notes.length) {
        tree.children.push({ type: "element", tagName: "hr", properties: {}, children: [] });
        const ol_children: ElementContent[] = notes.map((note, ix) => ({
          type: "element",
          tagName: "li",
          properties: { id: footnote_id_template(ix) },
          children: [
            {
              type: "element",
              tagName: "p",
              properties: {},
              children: [
                {
                  type: "element",
                  tagName: "sup",
                  properties: {},
                  children: [
                    {
                      type: "element",
                      tagName: "a",
                      properties: { href: `#${footnote_link_id_template(ix)}` },
                      children: [{ type: "text", value: `${footnote_number(ix)}.` }],
                    },
                  ],
                },
                { type: "text", value: " " },
                ...note,
              ],
            },
          ],
        }));
        tree.children.push({
          type: "element",
          tagName: "ol",
          properties: { style: "list-style-type: none; padding-left: 0;" },
          children: ol_children,
        });
      }
    })
    .use(rehypeFormat)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  const html = String(file_out);
  const $page = cheerio.load(html, {}, false);

  const fm = file_out.data.matter as Record<string, unknown> | undefined;
  const description = fm?.description;
  if (!description || typeof description !== "string") {
    throw new Error(`page ${file.name} missing description frontmatter`);
  }
  const publish_date = fm?.publish_date;
  if (publish_date !== undefined && typeof publish_date !== "string") {
    throw new Error(`page ${file.name} gave invalid publish date`);
  }

  return {
    content: html,
    title: $page("h1").text(),
    description,
    publish_date: publish_date ?? null,
  };
}

type Post = {
  title: string;
  folder: string;
  url: string;
  publish_date: string;
  description: string;
};
const posts: Post[] = [];
for await (const dirent of await opendir(path.join(src_dir, blog_dir))) {
  if (!dirent.isFile() || path.extname(dirent.name) != markdown_extension) {
    throw new Error("non-markdown entry in blog");
  }

  const post_content = await process_markdown_content(
    Bun.file(path.join(dirent.parentPath, dirent.name)),
  );
  const $post = cheerio.load(
    `<article>\n${post_content.content}\n</article>`,
    {},
    false,
  );

  const publish_date = post_content.publish_date;
  if (!publish_date) {
    throw new Error(`post [${post_content.title}] has no publish date`);
  }
  $post("h1").after(
    `<p><strong>${time_element_template(publish_date)}</strong></p>`,
  );
  const folder = path.join(
    blog_dir,
    dirent.name.slice(0, -markdown_extension.length),
  );
  const post: Post = {
    title: post_content.title,
    folder,
    url: path.join(website_url, folder),
    publish_date,
    description: post_content.description,
  };
  posts.push(post);

  const post_page = complete_page_template(
    post.title,
    $post.html(),
    post.description,
    post.url,
    "article",
    [
      {
        property: "article:published_time",
        content: post.publish_date,
      },
    ],
  );

  Bun.write(path.join(build_dir, folder, "index.html"), post_page);
}

{
  const home = await process_markdown_content(
    Bun.file(path.join(src_dir, `index${markdown_extension}`)),
  );
  posts.sort((a, b) => b.publish_date.localeCompare(a.publish_date));
  const $home = cheerio.load(home.content, {}, false);
  $home("#blog-entries").html(`<ul>
  ${posts.map((post) => `<li>${time_element_template(post.publish_date)} - <a href="${path.join("/", post.folder)}">${post.title}</a></li>`).join("\n")}
</ul>
<a href="/rss.xml">RSS Feed</a>`);

  const home_page = complete_page_template(
    home.title,
    $home.html(),
    home.description,
    website_url,
    "profile",
    [
      {
        property: "profile:first_name",
        content: "Beau",
      },
      {
        property: "profile:last_name",
        content: "McCartney",
      },
    ],
  );

  Bun.write(path.join(build_dir, "index.html"), home_page);
}

const rss_feed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">

<channel>
  <title>Beau McCartney</title>
  <link>${website_url}</link>
  <description>Beau McCartney's website and blog</description>
  <language>en-us</language>
  <atom:link href="${website_url}/rss.xml" rel="self" type="application/rss+xml" />
  ${posts
    .map((post) => {
      const date = new Date(post.publish_date);
      const rss_publish_date = date.toUTCString();

      return `<item>
  <title>${post.title}</title>
  <link>${post.url}</link>
  <guid isPermaLink="true">${post.url}</guid>
  <pubDate>${rss_publish_date}</pubDate>
  <description>${post.description}</description>
</item>`;
    })
    .join("\n")}
</channel>
</rss>`;

Bun.write(path.join(build_dir, rss_file), rss_feed);
