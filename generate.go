package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"slices"
	"strings"

	"time"

	"io/fs"
	"path/filepath"

	"text/template"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	md_html "github.com/yuin/goldmark/renderer/html"

	"github.com/FurqanSoftware/goldmark-katex"
	"go.abhg.dev/goldmark/frontmatter"

	"github.com/PuerkitoBio/goquery"
)

const (
	WEBSITE_URL = "https://beaumccartney.com"

	BUILD_RELATIVE_TO_SRC_PATH = "../build/"
	SRC_PATH = "src/"
	BLOG_PATH = "blog/"

	RSS_FILE = "rss.xml"
	MD_EXTENSION = ".md"

	FOOTNOTE_PLACEHOLDER_ID = "footnotes-placeholder"
	FOOTNOTES_PLACEHOLDER = `<div id="` + FOOTNOTE_PLACEHOLDER_ID +`"></div>`
)

type Post struct {
	Title string
	Relative_url string
	Description string
	Pubdate string
	Html bytes.Buffer
}

func absolute_url(relative_url string) string {
	result := WEBSITE_URL
	if len(relative_url) > 0 && relative_url[0] != '/' {
		result += "/"
	}
	result += relative_url

	return result
}

// NOTE(beau): define indexing convention for footnote superscripts
func footnote_number(ix int) int { return ix + 1 }
func footnote_link_target_id(ix int) string {
	return fmt.Sprintf("fn-%d", ix)
}
func footnote_backlink_target_id(ix int) string {
	return fmt.Sprintf("fn_backlink_target-%d", ix)
}

func main() {
	md := goldmark.New(
		goldmark.WithRendererOptions(
			md_html.WithUnsafe(),
		),
		goldmark.WithExtensions(
			extension.Strikethrough,
			&frontmatter.Extender{},
			&katex.Extender{},
		),
	)
	os.Chdir(SRC_PATH)

	var (
		posts []Post
		index_page_html bytes.Buffer
	)

	err := filepath.WalkDir(".", func(src_relative_path string, d fs.DirEntry, err error) error {
		if d.Type().IsRegular() {
			if !strings.HasSuffix(src_relative_path, MD_EXTENSION) {
				dst_path := filepath.Join(BUILD_RELATIVE_TO_SRC_PATH, src_relative_path)

				var (
					src_file, dst_file *os.File
					err error
				)

				if src_file, err = os.Open(src_relative_path); err != nil {
					log.Fatal(err)
				}

				if err = os.MkdirAll(filepath.Dir(dst_path), 0755); err != nil {
					log.Fatal(err)
				}

				dst_file, err = os.Create(dst_path)


				if _, err := io.Copy(src_file, dst_file); err != nil {
					log.Fatal(err)
				}

				return nil
			}

			md_path := src_relative_path
			src_md, err := os.ReadFile(md_path)
			if err != nil {
				log.Fatalf("couldn't open [%s]\n", md_path)
			}

			var (
				converted_html bytes.Buffer
				fm map[string]string
			)
			{
				ctx := parser.NewContext()
				if err = md.Convert(src_md, &converted_html, parser.WithContext(ctx)); err != nil {
					log.Fatalf("couldn't convert [%s] to html", md_path)
				}
				d := frontmatter.Get(ctx)
				if d == nil {
					log.Fatal("no frontmatter")
				}
				if err = d.Decode(&fm); err != nil {
					log.Fatal(err)
				}
				fmt.Printf("converted for [%s]\n\n%s\n\n\n\n", md_path, &converted_html)
			}

			var (
				page_content string
				post Post
				title string
			)
			{
				doc, err := goquery.NewDocumentFromReader(bytes.NewReader(page_html))
				if err != nil {
					log.Fatal(err)
				}

				{
					h1 := doc.Find("h1")
					title = h1.Text()
					h1.Remove()
				}
			}

			description := fm["description"]
			var page_html bytes.Buffer
			isblog := strings.HasPrefix(md_path, BLOG_PATH)
			isindex := md_path == "index" + MD_EXTENSION
			if isblog {
				pubdate := fm["publish_date"]

				filename := filepath.Base(md_path)
				filename_no_ext := filename[:len(filename)-len(filepath.Ext(filename))]
				dst_relative_path := filepath.Join(BLOG_PATH, filename_no_ext, "index.html")
				post = Post{
					Title: title,
					Relative_url: dst_relative_path,
					Description: description,
					Pubdate: pubdate,
				}
				if err = blog_page(
					page_content,
					title,
					description,
					dst_relative_path,
					pubdate,
				).Render(context.Background(), &page_html); err != nil {
					log.Fatal(err)
				}
			} else if isindex {
				err = index_page(
					page_content,
					title,
					description,
				).Render(context.Background(), &page_html)
			} else {
				log.Fatal("markdown file that's not blog or index encountered")
			}
			if err != nil {
				log.Fatalf("couldn't render page template for [%s]", md_path)
			}

			var html_with_footnotes string
			{
				doc, err := goquery.NewDocumentFromReader(&page_html)
				h1 := doc.Find("h1")
				h1.Remove()

				var footnotes []string
				doc.Find("fn").Each(func(ix int, s *goquery.Selection) {
					note, err := s.Html()
					if err != nil { log.Fatal(err) }
					footnotes = append(footnotes, note)
					fn_link := fmt.Sprintf(
						"<sup id=\"%s\"><a href=\"#%s\">%d</a></sup>",
						footnote_backlink_target_id(ix),
						footnote_link_target_id(ix),
						footnote_number(ix),
					)
					s.ReplaceWithHtml(fn_link)
				})

				err = footnote_block(footnotes).Render(
					context.Background(),
					strings.NewWriter(bytes.NewBufferString(html_with_footnotes)),
				)
				if page_content, err = doc.Html(); err != nil {
					log.Fatal(err)
				}
				fmt.Printf("content for [%s]\n\n%s\n\n\n\n", md_path, page_content)
			}

			if isblog {
				post.Html = html_with_footnotes
				posts = append(posts, post)
			} else if isindex {
				index_page_html = html_with_footnotes
			}
		}

		return nil
	})
	if err != nil {
		log.Fatal("error with walking files", err)
	}


	// write index page
	{
		var doc *goquery.Document
		doc, err = goquery.NewDocumentFromReader(&index_page_html)
		if err != nil {
			log.Fatal(err)
		}
		slices.SortFunc(posts, func(a Post, b Post) int {
			result := 0
			if a.Pubdate < b.Pubdate {
				result = 1
			} else if a.Pubdate > b.Pubdate {
				result = -1
			}
			return result
		})
		var posts_index_html bytes.Buffer
		posts_index(posts).Render(context.Background(), &posts_index_html)
		doc.Find("#blog-entries").ReplaceWithHtml(posts_index_html.String())

		var final_index_html string
		if final_index_html, err = doc.Html(); err != nil {
			log.Fatal(err)
		}
		if err = os.MkdirAll(BUILD_RELATIVE_TO_SRC_PATH, 0755); err != nil {
			log.Fatal(err)
		}
		if err = os.WriteFile(
			filepath.Join(BUILD_RELATIVE_TO_SRC_PATH, "index.html"),
			[]byte(final_index_html),
			0644,
		); err != nil {
			log.Fatal(err)
		}
	}

	for _, post := range posts {
		dst_path := filepath.Join(BUILD_RELATIVE_TO_SRC_PATH, post.Relative_url)
		if err = os.MkdirAll(filepath.Dir(dst_path), 0755); err != nil {
			log.Fatal(err)
		}
		if err = os.WriteFile(
			dst_path,
			post.Html.Bytes(),
			0644,
		); err != nil {
			log.Fatal(err)
		}
	}

	// rss feed
	{
		rss_info := struct {
			Website_url string
			Rss_file string
			Posts []Post
		}{
			Website_url: WEBSITE_URL,
			Rss_file: RSS_FILE,
			Posts: slices.Clone(posts),
		}
		for ix := range rss_info.Posts {
			post := &rss_info.Posts[ix]
			// t, err := time.Parse(time.DateOnly, post.Pubdate)
			t, err := time.Parse(
				time.DateOnly + " 15:04 MST", // support automatic 12pm mst pub time
				post.Pubdate + " 12:00 MST",  // 12pm mst pub time
			)
			if err != nil {
				log.Fatal(err)
			}
			post.Pubdate = t.Format("Mon, 02 Jan 2006 15:04:05 MST")
		}
		tmpl, err := template.New("rss").Funcs(template.FuncMap{ "absolute_url": absolute_url }).Parse(`<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Beau McCartney</title>
  <link>{{ .Website_url }}</link>
  <description>Beau McCartney's website and blog</description>
  <language>en-us</language>
  <atom:link href="{{ absolute_url .Rss_file }}" rel="self" type="application/rss+xml" />
  {{ range .Posts }}
  <item>
      <title>{{ .Title }}</title>
      <link>{{ absolute_url .Relative_url }}</link>
      <guid isPermaLink="true">{{ absolute_url .Relative_url }}</guid>
      <pubDate>{{ .Pubdate }}</pubDate>
      <description>{{ .Description }}</description>
    </item>
  {{ end }}
</channel>
</rss>`)
		var rss_file *os.File
		if rss_file, err = os.Create(filepath.Join(BUILD_RELATIVE_TO_SRC_PATH, RSS_FILE)); err != nil {
			log.Fatal(err)
		}
		if err = tmpl.Execute(rss_file, rss_info); err != nil {
			log.Fatal(err)
		}
	}
}
