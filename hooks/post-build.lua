local build_dir = soupault_config.settings.build_dir
local css_dir = "css"
local fonts_dir = Sys.join_path(css_dir, "fonts")

Sys.mkdir(Sys.join_path(build_dir, fonts_dir))

function install_file(dst_file, src_file)
	local src = Sys.read_file(src_file)
	Sys.write_file(Sys.join_path(build_dir, dst_file), src)
end

local katex_module = "node_modules/katex/dist"

install_file(Sys.join_path(css_dir, "highlight.css"), "node_modules/highlight.js/styles/base16/gruvbox-dark-medium.min.css")
install_file(Sys.join_path(css_dir, "katex.css"), Sys.join_path(katex_module, "katex.min.css"))

local katex_fonts = Sys.list_dir(Sys.join_path(katex_module, "fonts"))
local katex_fonts_ix = 1

while katex_fonts_ix <= size(katex_fonts) do
	local dir_entry = katex_fonts[katex_fonts_ix]
	if Sys.is_file(dir_entry) then
		local dst = Sys.join_path(fonts_dir, Sys.basename(dir_entry))
		install_file(dst, dir_entry)
	end


	katex_fonts_ix = katex_fonts_ix + 1
end
