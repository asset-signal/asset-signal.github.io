# The github-pages gem pins Jekyll and every plugin to exactly what
# GitHub Pages runs on its build servers. Use it rather than a bare
# `gem "jekyll"`, so a local build cannot succeed on a version the
# deployed build does not have.
source "https://rubygems.org"

gem "github-pages", group: :jekyll_plugins

# Not shipped by default on Ruby 3.x, and Jekyll's watch/serve needs it.
gem "webrick", "~> 1.8"
