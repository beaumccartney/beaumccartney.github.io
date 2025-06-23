Plugin.require_version("5.0.0")

local custom_options        = soupault_config.custom_options
local website_url           = custom_options.website_url

local use_section           = config.use_section
local date_formats          = config.date_formats
local time_zone             = config.time_zone
local publish_date_selector = config.publish_date_selector

local entries = {}

local count = size(site_index)
local i = 1
while (i <= count) do
	ix_entry = site_index[i]
	page_url = website_url..ix_entry.url

	parsed_html = HTML.parse(ix_entry.html_content)
	publish_date_elem = HTML.select_one(parsed_html, publish_date_selector) -- TODO: deduplicate with soupault.toml
	if not publish_date_elem then
		Plugin.fail("blog entry "..index_entry.url.." does not have a publish date")
	end
	entry_date = HTML.inner_html(publish_date_elem)

	entries[i] = {
		title = ix_entry.title,
		guid = page_url,
		link = page_url,
		description = String.render_template("<![CDATA[{{html_content}}]]>", {html_content = ix_entry.html_content}),
		pubdate = Date.reformat(entry_date, date_formats, "%a, %d %b %Y 12:00:00") .. " " .. time_zone,
	}
	i = i + 1
end

data = {
	website_url = website_url,
	entries = entries,
}

-- TODO:
--  channel lastBuildDate
--  channel pubDate

rss_template = [[
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">

<channel>
  <title>Beau McCartney</title>
  <link>{{website_url}}</link>
  <description>Beau McCartney's website and blog</description>
  <language>en-us</language>
  <atom:link href="{{website_url}}/rss.xml" rel="self" type="application/rss+xml" />
  {%- for e in entries|reverse %}
  <item>
    <title>{{e.title}}</title>
    <link>{{e.link}}</link>
    <guid>{{e.guid}}</guid>
    <pubDate>{{e.pubdate}}</pubDate>
    <description>{{e.description}}</description>
  </item>
  {% endfor -%}
</channel>

</rss>
]]

rss = String.render_template(rss_template, data)

rss_path = Sys.join_path(build_dir, "rss.xml")
Sys.write_file(rss_path, String.trim(rss))
