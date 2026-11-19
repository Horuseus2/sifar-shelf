# Sifar's Shelf

A personal collection site for the books I have read, the games I have played and the movies and series I have watched.

Plain static files: no build step, no server. Open `index.html` in Chrome or Edge.

Live at https://horuseus2.github.io/sifar-shelf/ (GitHub Pages, `main` branch, root folder).

## Publishing changes

Edit locally first (curator mode, then **Save**), check it in the browser, then commit and push:

```
git add -A
git commit -m "Shelf: add new things"
git push
```

The live site rebuilds in about a minute. GitHub Pages caches files for up to 10 minutes, so a hard refresh (Ctrl+F5) shows the new data sooner.

## Adding things

### 1. Curator mode (easiest)

1. Open the site and press **Curator mode** in the footer (or open `index.html?curate`).
2. A dock appears at the bottom. Press **Add**.
3. Pick Book, Game, Movie or Series and search. Results come from Open Library (books), Wikipedia (games and movies) and TVmaze (series). Pick one and the title, year, cover and more fill in by themselves.
4. Add your rating, the date you finished, whether it is a favourite and your thoughts. Press **Add to shelf**.
5. Press **Save** in the dock. The first time, Chrome asks for a file: open the `sifar-shelf` folder, then `data`, pick `collection.js` and replace it. After that, Save writes straight into it.

Until you save, changes live in this browser only (they survive reloads). In browsers without file access (Firefox, Safari) Save downloads `collection.js` instead; put it in the `data` folder yourself.

Other dock options (the three dots): download the data file, remove all the sample entries, discard unsaved changes, exit curator mode. Open any item while in curator mode to **Edit** or **Delete** it.

### 2. By hand

Everything lives in `data/collection.js`. Each item looks like this:

```js
{
  "id": "dune",                 // unique, letters and dashes
  "type": "book",               // book | game | movie | series
  "title": "Dune",
  "by": "Frank Herbert",        // author, studio, director or network
  "year": 1965,                 // release year
  "cover": "covers/dune.jpg",   // a file in covers/ or any image link
  "color": "#b5772e",           // spine and glow colour (optional)
  "status": "finished",         // finished | current
  "finished": "2025-06",        // when you finished it: YYYY, YYYY-MM or YYYY-MM-DD
  "rating": 4.5,                // 0.5 to 5 (optional)
  "fav": true,                  // shows in the display case (optional)
  "genres": ["Science fiction"],
  "notes": "What stuck with me."
}
```

Extra fields per type:

| Type | Fields |
| --- | --- |
| book | `pages` |
| game | `platform`, `hours` |
| movie | `runtime` (minutes) |
| series | `seasons`, `episodes` |
| anything in progress | `"status": "current"`, `progress` (0 to 100), `progressNote` |

Bump `"updated"` at the top of the file whenever you edit by hand, so browsers with unsaved curator edits notice the change.

### 3. Ask Claude

"Add Elden Ring to my shelf, 5 stars, finished March 2025" works too.

## Samples

Items with `"sample": true` are placeholders so the site does not look empty. The four books are real (from the old site). Remove the samples with the dock's **Remove samples**, or delete them from the data file.

## Files

```
index.html            page structure
css/style.css         all styles
data/collection.js    the collection
covers/               cover images
js/core.js            helpers, icons, colour, sound, smooth scroll setup
js/store.js           data, local drafts, saving the file
js/objects.js         3D shelf objects (books, cases, box sets, the cat)
js/hero.js            loader, 3D cover ring, surprise pick
js/collection.js      filters, search, sort, wall view, shelf view
js/sections.js        right now, display case, numbers
js/modal.js           detail view
js/curator.js         add, edit, search sources, save
js/main.js            boot and navigation
js/vendor/            GSAP, ScrollTrigger, Flip, Lenis
tools/                headless checks (screenshots, curator flow, scroll performance)
```

## Smoothness rules

Everything animates `transform` and `opacity` only. Loops (the ring, the display case, the cat) run as CSS or Web Animations so they stay on the compositor. Scrolling goes through Lenis on the GSAP ticker. 3D layers only exist on the item you are hovering. Keep to that when adding anything new.

## Checks

These need Chrome and borrow puppeteer-core from `../dhaka-streets/tools/node_modules`.

```
node tools/shot.mjs <outDir> [width] [height] [steps]   screenshots + console errors
                                                        (URL=https://horuseus2.github.io/sifar-shelf/ checks the live site)
node tools/curate.mjs <outDir>                          curator flow with live search
node tools/perf.mjs [width] [height]                    frame times while scrolling
```
