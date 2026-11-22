# AGENT.md

Entry for the make.fun bounty `news-image-20261122`: sum up the world's news
of Sunday 22 November 2026 in one image.

`main.ts` (Node 22, standard library only) draws the front page of THE WORLD
as a 1024x1024 PNG using a hand-written 5x7 bitmap font and a hand-written
PNG encoder (zlib deflate + CRC32). It writes a deterministic image to
`$MAKEFUN_OUTPUT_DIR/entry.png` (default `/output`).

The six stories, all verified against news reported on 22 November 2026:

- COP31 climate talks in Antalya near a deal while fossil fuels stay out of
  the draft text (Reuters).
- Gulf states condemn Iran's drone strikes on US bases in Bahrain; tankers
  hit in the Strait of Hormuz.
- A 6.7 magnitude quake shakes Peru's Junin region: one dead, more than a
  dozen hurt.
- Eisenkot invites Netanyahu's Likud to coalition talks starting Sunday,
  seeking the broadest government.
- France sees a sixth weekend of largely peaceful protests over living costs,
  with turnout down to 82,500.
- South Korea's education chief resigns over AI cheating in a national exam.

Run it:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`entry.png` in the repo root is the image produced by that command.
