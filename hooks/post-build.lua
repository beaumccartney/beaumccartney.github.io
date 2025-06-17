local highlight_css = Sys.read_file("node_modules/highlight.js/styles/base16/gruvbox-dark-medium.min.css")
if not highlight_css then
	Plugin.fail("syntax highlighting stylesheet not found")
end
