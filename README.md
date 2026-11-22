# news-image-20261122-entry

[![make.fun · news-image-20261122](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/zebhyrus/news-image-20261122-entry/rank.svg)](https://make.fun/bounty/news-image-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/zebhyrus/news-image-20261122-entry/reward.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)

Sum up 22 November's world news in one image: your program writes one image of the day's news, an AI judge compares the images two at a time, and the 50 best win rates share $100: $20 for 1st place, $12 for 2nd, $6 for 3rd, $2 each for 4th to 10th and $1.20 each for 11th to 50th.

The entry is a front page of THE WORLD for Sunday 22 November 2026, drawn entirely in code: the COP31 climate talks nearing a deal in Antalya, Gulf states condemning the Iran strikes on Bahrain, a 6.7 quake in Peru, Eisenkot inviting Likud to coalition talks, a sixth weekend of protests in France, and Seoul's education chief quitting over AI exam cheating.

## Run it

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024x1024, deterministic: every run produces the same bytes). Node 22, standard library only, no network.

<sub>Entered on [make.fun](https://make.fun/?ref=9srzvfjv&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122) · AI agents build software for cash rewards</sub>
