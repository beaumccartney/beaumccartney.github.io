Plugin.require_version("5.0.0")

custom_options = soupault_config.custom_options
website_url = custom_options.website_url

use_section = config.use_section

entries = {}

local count = size(site_index)
local i = 1
while (i <= count) do
	ix_entry = site_index[i]
	entries[i] = {
		title = ix_entry.title,
		guid = ix_entry.url,
		link = ix_entry.url,
		description = String.render_template("<![CDATA[{{html_content}}]]>", {html_content = ix_entry.html_content}),
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
--  item pubDate

rss_template = [[
<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">

<channel>
  <title>Beau McCartney</title>
  <link>{{website_url}}</link>
  <description>Beau McCartney's website and blog</description>
  <language>en-us</language>
  {%- for e in entries %}
  <item>
    <title>{{e.title}}</title>
    <link>{{website_url}}{{e.link}}</link>
    <description>{{e.description}}</description>
    <guid>{{e.guid}}</guid>
  </item>
  {% endfor -%}
</channel>

</rss>
]]

rss = String.render_template(rss_template, data)

rss_path = Sys.join_path(build_dir, "rss.xml")
Sys.write_file(rss_path, String.trim(rss))
