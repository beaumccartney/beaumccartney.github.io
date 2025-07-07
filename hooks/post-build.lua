local highlight_theme = "node_modules/highlight.js/styles/base16/gruvbox-dark-medium.min.css"

local highlight_css = Sys.read_file(highlight_theme)

Sys.write_file("build/css/highlight.css", highlight_css)
