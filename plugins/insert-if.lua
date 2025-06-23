-- https://github.com/PataphysicalSociety/soupault-blueprints-blog/blob/main/plugins/insert-if.lua
-- Configuration
local snippet = config["html"]
local selector = config["selector"]
local check_selector = config["check_selector"]

-- Plugin code

if not snippet then
	Log.warning("Missing html option, using an empty string")
	snippet = ""
end

if (not selector) or (not check_selector) then
	Log.warning("selector and check_selector options must be configured")
else
	elem = HTML.select_one(page, check_selector)
	if elem then
		target = HTML.select_one(page, selector)
		if not target then
			Log.info("Page has no element matching selector " .. selector)
		else
			snippet_html = HTML.parse(snippet)
			HTML.append_child(target, snippet_html)
		end
	end
end
