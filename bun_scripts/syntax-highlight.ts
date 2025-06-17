import hljs from "highlight.js/lib/common"

const element = await Bun.stdin.text()
const language = Bun.env.ATTR_CLASS!.slice("language-".length)

const highlighted = hljs.highlight(
  element,
  { language: language }
).value

console.log(highlighted.trim())
