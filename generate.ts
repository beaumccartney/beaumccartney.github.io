#!/usr/bin/env -S bun run

import { opendir } from "node:fs/promises";

import path from "node:path";
import process from "node:process";
import fs from "node:fs/promises";

import { micromark } from "micromark";
import { math, mathHtml } from "micromark-extension-math";
import {
  gfmStrikethrough,
  gfmStrikethroughHtml,
} from "micromark-extension-gfm-strikethrough";

import * as cheerio from "cheerio";

import hljs from "highlight.js/lib/common";

import Handlebars from "handlebars";

import { $ } from "bun";

process.chdir(import.meta.dir);

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

const page_content_template = Handlebars.compile(`{{{content}}}
{{#if footnotes}}
<hr/>
<ol style="list-style-type: none; padding-left: 0;">
  {{#each footnotes}}
  <li id="{{> footnote_id_template ix=@index}}"><p><sup><a href="#{{> footnote_link_id_template ix=@index}}">{{footnote_number @index}}.</a></sup> {{{this}}}</p></li>
  {{/each}}
</ol>
{{/if}}`);

const complete_page_template = Handlebars.compile(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>{{title}}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <meta name="author" content="Beau McCartney">
    <meta name="description" content="Beau McCartney - a new graduate software engineer specializing in graphics programming and compilers. Looking for opportunities in game dev and graphics">
    <meta
      name="keywords"
      content="personal, portfolio, website, beau, mccartney, Beau McCartney, software, engineer, computer, graphics, computer graphics, gamedev, game developer, low-level, low level programming systems, program, programming, code, coding, developer, C programming, job"
    >
    <meta name="robots" content="index, follow">

    <link rel="stylesheet" href="/{{css_dir}}/{{katex_css_out}}">

    <link rel="stylesheet" href="/{{css_dir}}/sakura-dark.css" media="screen and (prefers-color-scheme: dark)">

    <link rel="stylesheet" href="/{{css_dir}}/{{highlight_css_out}}">

    <link rel="alternate" type="application/rss+xml" title="RSS" href="/{{rss_file}}">
    <script data-goatcounter="https://beaumccartney.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
  </head>
  <body>
    <main>
    {{{content}}}
    </main>
  </body>
</html>`);

// helper for computing the footnote number in the template
function footnote_number(ix: number): number {
  return ix + 1;
}
Handlebars.registerHelper("footnote_number", footnote_number);

const footnote_link_id_template = Handlebars.compile("fn_link-{{ix}}");
Handlebars.registerPartial(
  "footnote_link_id_template",
  footnote_link_id_template,
);

const footnote_id_template = Handlebars.compile("fn-{{ix}}");
Handlebars.registerPartial("footnote_id_template", footnote_id_template);

const time_element_template = Handlebars.compile(
  '<time datetime="{{thedate}}">{{thedate}}</time>',
);
Handlebars.registerPartial("time_element_template", time_element_template);

const footnote_link_template = Handlebars.compile(
  '<sup id="{{> footnote_link_id_template}}"><a href="#{{> footnote_id_template }}">{{footnote_number ix}}</a></sup>',
);

async function process_markdown_content(file: Bun.BunFile) {
  const markdown = await file.bytes();
  const converted_html = micromark(markdown, {
    allowDangerousHtml: true,
    extensions: [math(), gfmStrikethrough({ singleTilde: false })],
    htmlExtensions: [mathHtml(), gfmStrikethroughHtml()],
  });

  const $page = cheerio.load(converted_html, {}, false);
  $page('*[class^="language-"]').each(function () {
    const $code = $page(this);
    const html = $code.html();
    if (html === null) {
      throw new Error(); // REVIEW: how can this happen and what's a decent message?
    }

    const lang_class = $code.attr("class");
    if (lang_class === undefined) {
      throw new Error("couldn't find language for code block");
    }
    const language = lang_class.slice("language-".length);

    const highlighted = hljs.highlight(html, { language }).value;

    $code.html(
      cheerio
        .load(highlighted, { xml: { encodeEntities: false } }, false) // don't put html escapes into the highlighted html
        .html(),
    );
  });

  const footnotes = $page("fn")
    .map(function (ix) {
      const $footnote = $page(this);
      const footnote = $footnote.html();
      $footnote.replaceWith(footnote_link_template({ ix }));
      return footnote;
    })
    .toArray();

  return {
    content: page_content_template({ footnotes, content: $page.html() }),
    title: $page("h1").text(),
  };
}

type Post = {
  title: string;
  folder: string;
  publish_date: string;
  html: string;
};
const posts: Post[] = [];
for await (const dirent of await opendir(path.join(src_dir, blog_dir))) {
  if (!dirent.isFile() || path.extname(dirent.name) != markdown_extension) {
    throw new Error("non-markdown entry in blog");
  }

  const post_content = await process_markdown_content(
    Bun.file(path.join(dirent.parentPath, dirent.name)),
  );
  const $post = cheerio.load(post_content.content, {}, false);

  const pub_date_elem = "publish-date";
  const $pubdate = $post(pub_date_elem);
  const publish_date = $pubdate.text();
  if (publish_date.length !== 0) {
    $pubdate.replaceWith(
      `<strong>${time_element_template({ thedate: publish_date })}</strong>`,
    );
  }

  let post = {
    title: post_content.title,
    folder: path.join(
      blog_dir,
      dirent.name.slice(0, -markdown_extension.length),
    ),
    publish_date,
    html: $post.html(),
  };
  posts.push(post);

  const post_page = complete_page_template({
    title: post.title,
    content: post.html,
    css_dir,
    katex_css_out,
    highlight_css_out,
    rss_file,
  });

  Bun.write(path.join(build_dir, post.folder, "index.html"), post_page);
}

{
  const home = await process_markdown_content(
    Bun.file(path.join(src_dir, `index${markdown_extension}`)),
  );
  const blog_toc_template = Handlebars.compile(`<ul class="unstyled-ol">
  {{#each posts}}
  <li>{{> time_element_template thedate=this.publish_date }} - <a href="/{{ this.folder }}">{{ this.title }}</a></li>
  {{/each}}
</ul>
<a href="/rss.xml">RSS Feed</a>`);
  posts.sort((a, b) => b.publish_date.localeCompare(a.publish_date));
  const $home = cheerio.load(home.content, {}, false);
  $home("#blog-entries").html(blog_toc_template({ posts }));

  const home_page = complete_page_template({
    title: home.title,
    content: $home.html(),
    css_dir,
    katex_css_out,
    highlight_css_out,
    rss_file,
  });

  Bun.write(path.join(build_dir, "index.html"), home_page);
}

const rss_template = Handlebars.compile(`<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">

<channel>
  <title>Beau McCartney</title>
  <link>{{ website_url }}</link>
  <description>Beau McCartney's website and blog</description>
  <language>en-us</language>
  <atom:link href="{{ website_url }}/rss.xml" rel="self" type="application/rss+xml" />
  {{#each rss_posts}}
  <item>
    <title>{{this.title}}</title>
    <link>{{this.web_url}}</link>
    <guid>{{this.web_url}}</guid>
    <pubDate>{{this.rss_publish_date}}</pubDate>
    <description><![CDATA[{{{this.html}}}]]></description>
  </item>
  {{/each}}
</channel>

</rss>`);

const website_url = "https://beaumccartney.com"
const rss_posts = posts.map((post) => {
  const date = new Date(post.publish_date);
  const rss_publish_date = date.toUTCString();

  return {
    title: post.title,
    web_url: path.join(website_url, post.folder),
    rss_publish_date,
    html: post.html,
  };
});
const rss_feed = rss_template({ website_url, rss_posts });
Bun.write(path.join(build_dir, rss_file), rss_feed);
