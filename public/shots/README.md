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

## The five projects

| `id` | Project | suggested filename |
| --- | --- | --- |
| `overwatch` | Overwatch | `/shots/overwatch.png` |
| `clarity` | Clarity | `/shots/clarity.png` |
| `lattice` | Lattice | `/shots/lattice.png` |
| `calmcampus` | CalmCampus | `/shots/calmcampus.png` |
| `echotrade` | EchoTrade | `/shots/echotrade.png` |

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

The card renders alone with no empty frame beneath it — no placeholder, no
broken-image icon. Columns stay aligned because the text card absorbs the height
difference, so a partially-filled set does not look broken.
