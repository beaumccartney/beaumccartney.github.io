#!/usr/bin/env sh

bun install
soupault
cp node_modules/highlight.js/styles/base16/gruvbox-dark-medium.min.css build/css/highlight.css
