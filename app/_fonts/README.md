# Site fonts

Self-hosted with `next/font/local` (see `app/layout.tsx`) so that builds never
fetch from Google Fonts. `next/font/google` builds fail intermittently when
Google returns `fonts.gstatic.com/l/font?kit=…&skey=…` URLs, which Turbopack's
font loader cannot parse (vercel/next.js#99114).

| File                       | Family     | Weights (wght axis) | Characters                               |
| -------------------------- | ---------- | ------------------- | ---------------------------------------- |
| `Unbounded-Variable.woff2` | Unbounded  | 400–800             | Latin, plus `№`, arrows, `Λ`             |
| `Geist-Variable.woff2`     | Geist      | 400–800             | Latin + Latin Extended, plus `№`, arrows |
| `GeistMono-Variable.woff2` | Geist Mono | 400–600             | Latin + Latin Extended, plus `№`, arrows |

All three are SIL Open Font License 1.1 (`OFL-Unbounded.txt`, `OFL-Geist.txt`,
which also covers Geist Mono).

## Regenerating

The sources are the variable TTFs in [google/fonts](https://github.com/google/fonts)
(`ofl/unbounded/Unbounded[wght].ttf`, `ofl/geist/Geist[wght].ttf`,
`ofl/geistmono/GeistMono[wght].ttf`). With `pip install fonttools brotli`:

```sh
LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATINEXT="U+0100-02AF,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
EXTRAS="U+2116,U+2190-2195,U+0394,U+039B,U+03A3"
OPTS="--layout-features=* --no-hinting --desubroutinize --flavor=woff2"

# 1. Trim the weight axis to what the site uses
fonttools varLib.instancer "Unbounded[wght].ttf" wght=400:800 -o Unbounded.ttf
fonttools varLib.instancer "Geist[wght].ttf" wght=400:800 -o Geist.ttf
fonttools varLib.instancer "GeistMono[wght].ttf" wght=400:600 -o GeistMono.ttf

# 2. Subset to the characters above
pyftsubset Unbounded.ttf --unicodes="$LATIN,$EXTRAS" $OPTS --output-file=Unbounded-Variable.woff2
pyftsubset Geist.ttf --unicodes="$LATIN,$LATINEXT,$EXTRAS" $OPTS --output-file=Geist-Variable.woff2
pyftsubset GeistMono.ttf --unicodes="$LATIN,$LATINEXT,$EXTRAS" $OPTS --output-file=GeistMono-Variable.woff2
```

The display font (Unbounded) only ever renders the site's own copy, so it
carries Latin only; Geist also renders what visitors type into the contact form,
so it keeps Latin Extended. Anything else falls back to the system font stack in
`app/theme-variables.scss`.
