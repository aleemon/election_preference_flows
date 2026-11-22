# Preference Flows in Australian Federal Politics

An interactive dashboard showing how preferences flowed in every Australian federal House of Representatives election from 1901 to 2025: nationally, by state, and count by count in every seat.

It is a static site (plain HTML, CSS and JavaScript, no build step), so it runs on GitHub Pages as-is.

## What's in it

- **Overall party preference flows.** A timeline of Labor and non-Labor vote shares since 1901, and for each election a Sankey diagram from first preferences to the final two-party-preferred result, a state breakdown (2004–2025), votes versus seats, and a flow table.
- **Preference flows by seat.** Every seat at every election: a count-by-count table and a Sankey diagram of where each excluded candidate's ballots went. Click a candidate to highlight their flows.
- Series on every chart can be switched on and off, and every chart and table exports to PNG and CSV.

## Publish it on GitHub Pages

1. Create a new repository on GitHub (for example `australian-preference-flows`). It can be public, or private if your plan supports Pages for private repositories.
2. Upload **everything in this folder** to the root of the repository, keeping the folder structure: `index.html`, `.nojekyll`, `assets/` and `data/`. In the web interface use **Add file → Upload files** and drag the folder contents in. `.nojekyll` is a hidden file on macOS: press **Cmd + Shift + .** in Finder to show it so it gets uploaded too.
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose your branch (usually `main`) and the **/ (root)** folder, and click **Save**.
4. After a minute or two the site will be live at `https://<your-username>.github.io/<repository-name>/`. The address is shown at the top of the Pages settings.

## Preview it on your computer

The page loads its data with `fetch`, which browsers block when you open `index.html` directly from disk. Run a small local web server from this folder instead:

```bash
cd australian-preference-flows
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Folder layout

```
index.html              page structure
assets/style.css        styles (light and dark themes)
assets/app.js           all charts and interactions (no libraries)
assets/favicon.svg      tab icon
data/elections.json     national results, 2PP and party flows for all 48 elections
data/states.json        state 2PP flows by party, 2004–2025
data/seats.json         count-by-count results for every seat, 1901–2025
data/seat-data-review.csv   seat records flagged for manual checking
data/README.md          data formats
.nojekyll               tells GitHub Pages to serve the files as they are
```

## Links to a view

Each view has its own address, so you can link straight to it:

- `#e2022`: the 2022 election, national flows
- `#e2022-wa`: the 2022 election, Western Australia
- `#seats-1969-vic`: every Victorian seat in 1969

## How the data was built

- **First preferences and seats** come from Adam Carr's Psephos archive (national summaries). Small differences between the archive's party votes and its stated formal totals were resolved by using the sum of the party figures. The 2025 "Others" figure was replaced using the AEC's formal-vote total.
- **2004–2025 flows** are the AEC's counted two-party-preferred flows by party, nationally and by state.
- **1949–2001 national flows** are modelled. The official AEC two-party-preferred totals are used, and minor-party votes are split using typical historical preference rates adjusted to match those totals exactly. **1940–1946** use widely cited unofficial two-party estimates. **1919–1937** have no national two-party figure, and **1901–1917** were first past the post.
- **Seat counts 2004–2025** are the AEC's distribution of preferences by division. **1901–2001** were parsed from the count-by-count results in Adam Carr's Psephos archive. Before 1984 counts normally stopped once a candidate had an absolute majority.
- **Known gaps:** 16 seats show first preferences only because their counts couldn't be read reliably, 15 have totals that change between counts in the source, two deferred elections (Dickson 1993, Newcastle 1998) are missing, and the archive lists 74 of 75 seats for 1914 and 147 of 148 for 1996. All of these are listed in `data/seat-data-review.csv`.

## Updating the data

The site reads only the three JSON files in `data/`. To correct a seat after checking it against the source, edit its entry in `data/seats.json` (the format is described in `data/README.md`), commit the change, and GitHub Pages will republish automatically.

## Sources and credit

- Adam Carr, *Psephos: Adam Carr's Election Archive*, http://psephos.adam-carr.net/
- Australian Electoral Commission, *AEC Tally Room*, https://results.aec.gov.au/ (AEC material is generally published under a Creative Commons Attribution licence; check the AEC's copyright page for current terms)
- AEC national two-party-preferred series 1949–2001, as tabulated by AustralianPolitics.com

Please keep these credits if you publish or reuse the data.
