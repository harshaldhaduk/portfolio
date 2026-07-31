# Company logos

Drop logo files here, then point the matching entry at them. Nothing ships in
this folder by default — the only assets obtainable for these employers were
32–57px favicons, three had nothing usable, and six mismatched low-res marks
looked worse than the consistent monogram set that renders instead.

## How to add one

1. Put the file in this folder, e.g. `public/logos/ibm.svg`.
2. Add one line to that entry in `src/data/experience.ts`:

   ```ts
   {
     id: 'ibm',
     org: 'IBM',
     mark: 'IBM',
     logo: '/logos/ibm.svg',   // <- add this
     ...
   }
   ```

The leading `/` matters: it resolves from the site root, not the file. Anything
in `public/` is served at the root, so `public/logos/ibm.svg` is `/logos/ibm.svg`.

## The entries and the marks they currently show

| `id` | Company | current `mark` | suggested filename |
| --- | --- | --- | --- |
| `pwc` | PricewaterhouseCoopers | `PwC` | `/logos/pwc.svg` |
| `cox` | Cox Automotive | `CA` | `/logos/cox.svg` |
| `dell` | Dell Technologies | `Dell` | `/logos/dell.svg` |
| `kollegio` | Kollegio | `K` | `/logos/kollegio.svg` |
| `uci` | University of California, Irvine | `UCI` | `/logos/uci.svg` |
| `ibm` | IBM | `IBM` | `/logos/ibm.svg` |

Research and project entries can take a `logo` too — the field lives on the
shared `Entry` type — but only the Mission Log renders the tile today.

## What works

- **SVG is best.** The tile is 28×28 CSS px, so it renders at 56px on a retina
  screen; anything raster below ~112px will look soft. PNG and WebP work if
  they are large enough.
- **Transparent background.** The tile has its own dark background and a
  1px border. A logo with a baked-in white box will show as a white square.
- **Square-ish artwork.** It is fitted with `object-contain` inside 28px with
  4px padding, so a very wide wordmark shrinks to near-invisibility. Prefer a
  logomark (the symbol) over a full wordmark.
- **Light or single-colour marks read best** against the dark tile. A dark navy
  logo on the near-black tile will disappear.

## If a file is missing or fails to load

The tile falls back to the entry's `mark` automatically — no broken-image icon.
So a typo'd path degrades to the monogram rather than breaking the layout.

## Note on trademarks

These are other companies' marks. Using them to identify where you have worked
is ordinary practice on a personal résumé site, but they are not yours, so use
official artwork rather than redrawing it, and don't restyle it in ways the
brand guidelines forbid.
