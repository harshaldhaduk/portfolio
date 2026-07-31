# Project screenshots

Drop a screenshot per project here, then point the entry at it.

## How to add one

1. Save the image here, e.g. `public/shots/lattice.png`
2. Add one line to that project in `src/data/projects.ts`:

   ```ts
   {
     id: 'lattice',
     org: 'Lattice',
     image: '/shots/lattice.png',   // <- add this
     ...
   }
   ```

The leading `/` matters: everything in `public/` is served from the site root.

## Current state

| `id` | Project | file |
| --- | --- | --- |
| `overwatch` | Overwatch | `overwatch.jpg` — logo card, see below |
| `clarity` | Clarity | `clarity.jpg` |
| `lattice` | Lattice | `lattice.png` |
| `linewatch` | Linewatch | `linewatch.png` |
| `archai` | Archai | `archai.png` |
| `calmcampus` | CalmCampus | **still needed** |
| `echotrade` | EchoTrade | `echotrade.png` |

`overwatch.jpg` is a logo card rather than a screenshot, because the real
interface lists dealer names, IDs and addresses for tens of thousands of
entities. It was rendered from `overwatch-logo.html` (kept out of the repo) in a
headless browser rather than written as an SVG, because an SVG loaded through
`<img>` cannot fetch the Google Fonts stylesheet and the wordmark would fall
back to whatever sans the visitor happens to have installed.

## What works

- **The frame is 16:10** and uses `object-cover`, which is roughly the shape of
  a macOS window screenshot, so a normal `Cmd+Shift+4` window capture fits with
  minimal cropping. Anything far from that ratio gets centre-cropped rather than
  squashed — the image is never distorted.
- **Target ~1200px wide.** The frame renders about 416px across, so 1200px
  covers a retina display without shipping something needlessly large.
- **PNG for UI, JPEG for photo-heavy shots.** A UI screenshot compresses far
  better as PNG; a screenshot full of photography does better as JPEG.
- **Crop out browser chrome and your own tabs/bookmarks** before saving. A
  screenshot with a visible bookmarks bar reads as a screengrab; one cropped to
  the app itself reads as a product shot.

## If an entry has no image

The frame still renders, as an empty bordered box. That is deliberate: the frame
sits above the text and is the element every column aligns to, so dropping it for
one project would knock the whole row out of register. An empty frame reads as an
empty slot, which is what it is — but it is conspicuous, so it is worth filling.

## Art that is not already 16:10

16:9 art centre-crops by about 5% per side, which is enough to clip a corner
badge (Clarity's WINNER ribbon sits right in that band). Rather than crop, the
16:9 sources here were padded to 16:10 by stretching their own first and last
pixel row into bars — seamless for art whose edges are a flat colour or a
vertical gradient. A window screenshot near 16:10 needs none of this.
