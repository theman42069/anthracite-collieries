# Anthracite Collieries of Pennsylvania

An interactive satellite map of former anthracite collieries in Pennsylvania's four coal fields
(Northern, Eastern Middle, Western Middle, Southern). Click a marker to see a photo, key facts,
a short history and sources.

Plain HTML, CSS and JavaScript with no build step, made to be hosted for free on GitHub Pages.

```
index.html               the map page
sources.html             every citation and photo credit, built automatically from the data
about.html               about the project, using the map, corrections, visiting sites safely
settings.html            per-visitor settings (starting map, marker size, text size, ...)
quiz.html                the Colliery Quiz (10 random questions per round)
stats.html               By the Numbers: charts of the memorial names and the collieries
print.html               printable one-page sheet for a colliery (print.html#<id>)
contribute.html          Send a Correction: turns a form into a pre-filled GitHub issue
manifest.webmanifest     lets phones install the site as an app
sw.js                    offline support: keeps the pages, data and seen photos
data/glossary.json       mining words explained in the histories and on the About page; edit freely
data/railroads.geojson   railroad lines: from OpenStreetMap (ODbL), plus breaker tracks traced from old USGS maps
data/quiz-extra.json     hand-written quiz questions; edit or add your own (see below)
css/style.css            all styling (map, side panel / phone bottom sheet, sources and about pages)
js/app.js                map logic: layers, markers, filters, timeline, list, search, location, share links
js/sources.js            builds the sources page
js/menu.js               the Menu button (Map, Sources, About, Settings) on every page
js/settings-store.js     saves/loads settings in the visitor's browser; used by every page
js/settings-page.js      the settings form
js/quiz.js               builds quiz questions from the data + quiz-extra.json
js/stats.js              draws the By the Numbers charts (plain SVG, no chart library)
js/print.js              builds the printable colliery sheet (styles in css/print-sheet.css)
js/contribute.js         the Send a Correction form
data/collieries.geojson  ALL site data — the only file you edit to add sites
icons/headframe.svg      site icon
icons/social-card.jpg    preview image shown when the link is shared (Facebook, texts, etc.)
icons/no-photo.svg       fallback image when a photo is missing or broken
photos/                  your own photo files (referenced from the data as photos/name.webp)
serve.ps1                optional local web server for Windows (no Python/Node/admin needed)
serve-phone.bat          double-click to serve the site to your phone on the same Wi-Fi
credits-report.bat       double-click to rebuild CREDITS-TODO.md, the photo-credits checklist
CREDITS-TODO.md          which photos still need a credit or permission (for you; no need to upload)
```

**Menu and Settings:** every page has a **Menu** button (top right) with Map, Sources, About and
Settings. To add a page to the menu, add it to the `PAGES` list in `js/menu.js`. Settings are saved
in each visitor's own browser (nothing is sent anywhere), so they don't affect anyone else.

**Phone or computer:** on a visitor's first visit, a box asks "Phone or Computer?" (with the likely
answer marked *Suggested*). The phone layout has bigger buttons and a details sheet that slides up
from the bottom. Tap or swipe its handle up for full screen, or swipe down to shrink or close it.
The choice is saved and can be changed under **Menu → Settings → Device**. Until someone chooses,
the layout is guessed from screen width. To test the box again, clear the site's data in your browser.

**Getting around:**
- **Search** forgives typos ("henery clay", "burnsde") and also finds former names and towns.
- **Names beside pins** appear when you zoom in close (switch off under Settings → Markers).
- **The Collieries list** can be sorted A–Z, oldest or newest first, closed most recently, or nearest
  to you. The order you pick is remembered.
- **Tap any photo** for a full-screen viewer: swipe or ←/→ for the next photo, pinch, double-tap or
  scroll to zoom, drag to look around, and swipe down or Esc to close.

**Photo credits checklist:** double-click `credits-report.bat` to rebuild `CREDITS-TODO.md`. It sorts
every photo into *needs permission* (watermarks, modern photos, artwork), *needs a source* and
*ready*. It also flags photo files that are missing, unused, or used for two different sites. Run it
before each upload.

**Fun extras:**
- **▶ on the timeline** (Filter map → Years) plays through the years. Collieries appear and vanish
  as they open and close, with a big year and a count of collieries known to be working.
- **The dice button** next to the Collieries list flies to a random colliery.
- **Quiz** (Menu → Quiz): most questions are built automatically from the data (opening and closing
  years, other names, operators, county, which is oldest), so adding collieries adds questions.
  Questions skip approximate or disputed dates. The rest come from `data/quiz-extra.json`. To add
  one, copy an entry there:
  ```json
  {
    "question": "Your question?",
    "answer": "The right answer",
    "wrong": ["Wrong 1", "Wrong 2", "Wrong 3"],
    "explain": "One or two sentences shown after answering.",
    "colliery": "id-of-the-colliery-it-is-about"
  }
  ```

**Your location:** the target button under the zoom buttons shows a blue dot where you are (tap
again to turn it off). Browsers only allow this on `https://` pages, so it works on the published
GitHub Pages site and on `http://localhost`, but not over the home-network address.

**Sharing previews:** the `og:` tags at the top of `index.html`, `sources.html` and `about.html`
give the link a title, description and `icons/social-card.jpg` image when it's posted. They contain
the full site address (`https://theman42069.github.io/anthracite-collieries/`). If the address
ever changes, update it there too. Facebook caches previews, so after a change paste the link into
<https://developers.facebook.com/tools/debug/> and click "Scrape Again".

**On the map:** pin color shows the coal field, and the symbol inside the pin shows the site type.
The **Filter map** box has filters for coal field, site type (once there's more than one type),
year, operator and present-day condition. **Show everything** clears them all. The
**Collieries** button lists every site that's currently visible.

**In Memoriam:** `memorial.html` lists the people killed at the collieries on the map, from
`data/memorial.json`. Each row is `[date, name, age, job, colliery id, what happened, source key,
note]`; the source keys are explained at the top of the file. Each colliery's panel links to its
names. The list only covers the years whose inspector reports are online so far (listed in the
file's `years_searched`). Add names the same way, always with a source.

**Secrets:** the site hides five easter eggs. All the code is in `js/secrets.js` (spoilers at the
top of the file), and a perfect quiz score is handled in `js/quiz.js`. Found secrets are listed on
`secret.html` ("The Canary's Nest"), which isn't in the menu. The St. Barbara's Day
remembrance turns on by itself December 1–7; on other days, search "St. Barbara", type BARBARA
on the map, or add `?stbarbara` to the map's address. Bonus quiz questions
in `data/quiz-extra.json` have `"hard": true` and only appear in the bonus round.

---

## Run it locally

Browsers won't load `data/collieries.geojson` when you double-click `index.html` (the `file://`
protocol blocks it), so serve the folder over HTTP. Pick whichever runtime you have:

**Windows (PowerShell, nothing to install):**

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

**Python 3:**

```bash
python -m http.server 8000
```

**Node.js:**

```bash
npx serve -l 8000
```

Then open <http://localhost:8000>. The VS Code "Live Server" extension works too.

---

## Testing on your phone

1. **Double-click `serve-phone.bat`.** A black window opens and prints a line like:
   ```
   On your phone:     http://192.168.4.58:8000/
   ```
   Leave this window open while you test. Closing it stops the server.
2. **Connect your phone to the same Wi-Fi as the computer** (not mobile data). It also works if
   the computer is plugged into the same router by cable.
3. **On the phone, type that address exactly**, including `http://` and `:8000`. Your edits show
   up when you reload the page.

The number can change after a router restart. Each time you start the server, use the address it
prints. To print it yourself, run `ipconfig` and look for "IPv4 Address".

Prefer the command line? This does the same thing:

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1 -Lan
```

### If the phone can't connect (Windows firewall)

Windows blocks other devices unless your network is set as **Private** (a home network you trust).
You only need to do this once.

**Step 1: Mark your home network as Private**

1. Press the **Windows key**, type `Settings` and press Enter.
2. Click **Network & internet**.
3. Click **Ethernet** (or **Wi-Fi** if the computer uses Wi-Fi). Then click your network's name, if
   you see it listed.
4. Under **Network profile type**, choose **Private network**.

**Step 2: Allow the server through the firewall**

The first time you run `serve-phone.bat`, Windows may show a box titled **"Windows Security
Alert"** that says the firewall blocked "Windows PowerShell".

1. Tick **Private networks**. Leave **Public networks** unticked.
2. Click **Allow access**. If Windows asks for permission to make changes, click **Yes**.

**If no box appeared, or you clicked Cancel by mistake:**

1. Press the **Windows key**, type `Allow an app through Windows Firewall`, and press Enter.
2. Click **Change settings**.
3. Scroll to **Windows PowerShell**. If it isn't listed, click **Allow another app… → Browse**,
   open `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe`, then click **Add**.
4. Tick the box in the **Private** column for Windows PowerShell, and click **OK**.

**Still not working?**
- Check that the phone isn't on mobile data or a "guest" Wi-Fi network. Guest networks often block
  devices from seeing each other.
- Make sure the server window is still open.
- Some VPN apps block local addresses. Pause the VPN while you test.

---

## Add a colliery

Open `data/collieries.geojson` and add a new object to the `features` array. Put a comma between
features, and don't leave one after the last feature.

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [-76.0000, 40.0000] },
  "properties": {
    "id": "example-colliery",
    "name": "Example Colliery",
    "type": "colliery",
    "field": "Western Middle",
    "county": "Example County",
    "nearest_town": "Example Town",
    "operator": "Example Coal Company (1872–1920); Other Coal Company (1920–1955)",
    "operators": ["Example Coal Company", "Other Coal Company"],
    "years_active": "1870s–1950s",
    "year_opened": 1872,
    "year_closed": 1955,
    "status": "Breaker demolished; culm bank remains",
    "status_tags": ["demolished", "culm bank remains"],
    "related": [
      { "id": "other-colliery", "note": "One sentence on how the two are connected." }
    ],
    "history": "Two to four sentences summarizing the colliery's history.",
    "photo_url": "photos/example-colliery.jpg",
    "photo_caption": "Breaker, about 1935.",
    "photo_credit": "Library of Congress, HAER PA-000 — public domain",
    "sources": [
      "Author, Title of book (Publisher, Year), p. 00.",
      "https://example.org/a-source-page",
      { "title": "A source with a nicer link label", "url": "https://example.org/another" }
    ]
  }
}
```

(The values above are only there to show the format. They aren't real data.)

### Field reference

| Property | Required | Notes |
|---|---|---|
| `geometry.coordinates` | yes | **`[longitude, latitude]`**, longitude first. In PA the longitude is negative (around −75 to −77) and the latitude is around 40–42. If a pin lands in the ocean, you've swapped them. |
| `name` | yes | Shown as the panel title, in tooltips and in search. |
| `id` | no | Sets the share link: `index.html#example-colliery`. If you leave it out, it's built from the name, so "Alaska Colliery" becomes `#alaska-colliery`. Lowercase letters, numbers and hyphens only. Once you've shared a link, don't change its `id`. |
| `field` | yes | One of `Northern`, `Eastern Middle`, `Western Middle`, `Southern` (sets the marker color). Anything else shows as gray "Other / unknown". |
| `other_names` | no | Earlier or alternate names, e.g. `["Cameron Colliery"]`. Shown as "Also known as" in the panel, and search finds the site under them. |
| `type` | no | What kind of coal site this is, which sets the symbol inside the pin. Use one of: `colliery` (the default if left out), `breaker` (also for washeries and cleaning plants), `shaft` (also for slopes and drifts) or `culm bank`. Anything else gets a plain dot and shows as "Other coal site". The **Site types** filter appears once your data has more than one type. |
| `county`, `nearest_town`, `operator`, `years_active`, `status` | no | Shown in the facts table, as written. Empty values are hidden. |
| `operators` | no | A list of company names for the **Operator** filter, e.g. `["Lehigh Valley Coal Company"]`. Spell each company the same way every time, or it shows up twice in the filter. If you leave it out, the names are taken from `operator`: the text is split at semicolons and anything in (parentheses) is dropped. |
| `status_tags` | no | Short words for the **Today** filter. Suggested words: `demolished`, `strip-mined`, `redeveloped`, `reclaimed`, `culm bank remains`, `structures standing`, `mining continues`, `nothing remains`. Other words work too and show as written. `status` stays the full sentence people read. |
| `related` | no | Other sites to link at the bottom of the panel. Each entry is an `id`, or `{ "id": "...", "note": "..." }`. Links work both ways, so add a link on one site only and it appears on both. |
| `year_opened`, `year_closed` | no | Plain numbers with no quotes, e.g. `1874`. They drive the **Years** timeline in the "Filter map" box. `years_active` is still the text people read in the panel. Use `null` if a date isn't known. A colliery with neither year always shows on the map, whatever year is picked. If only one year is known, it's treated as open-ended on the other side. |
| `history` | no | Plain text, 2–4 sentences. |
| `confidence` | no | How solid the research is, e.g. which dates rest on a single source. Shown in a box under the history, headed "How sure is this?". |
| `photo_url` | no | A relative path (e.g. `photos/name.jpg`, with the file in a `photos/` folder) or a full `https://` URL. If it's missing or fails to load, the fallback image is shown. |
| `photo_caption`, `photo_credit` | no | The credit should name the source *and* the license. |
| `photos` | no | More photos for the same site, as a list of `{ "url": "photos/name.webp", "caption": "...", "credit": "..." }`. They show after `photo_url` in a gallery: arrows, a "2 / 5" counter, and swiping on phones. Every photo's credit is also listed on the Sources page. |
| `sources` | no | A list. Each item can be a citation string, a URL (which becomes a link), or `{ "title", "url" }`. The **Sources** page combines every site's list. A source used by several sites (same URL) is listed once, with all of them. |
| `sample` | no | `true` shows a red "SAMPLE — replace with real data" banner. Delete it from real entries. |

Tips:
- To get coordinates in Google Maps, right-click the spot and the first menu item gives you
  `lat, lng`. **Reverse them** for GeoJSON.
- Check your file with <https://geojson.io> or <https://jsonlint.com>. If the file has a JSON
  error, the map shows a "Colliery data could not be loaded" message.
- Features with missing or invalid coordinates are skipped, with a warning in the browser
  console (F12).

---

## Photo licensing tips

Only use photos you have the right to publish, and always fill in `photo_credit`.

- **Good free sources:**
  - Library of Congress HABS/HAER/HALS surveys. These cover many PA collieries and breakers and
    are generally public domain.
  - Wikimedia Commons. Check each file's license.
  - Flickr Commons.
  - PA State Archives and university digital collections. Check each item's rights statement.
- **Public domain** (most U.S. federal government works, and works published in the U.S. before
  1930): you can use these freely. Crediting the source is still good practice.
- **Creative Commons:** CC0, CC BY and CC BY-SA are fine to use with attribution. Your credit
  needs the author, a link to the source, the license name, and a note if you edited the image.
  Example: `Photo: Jane Doe, Wikimedia Commons, CC BY-SA 4.0`. Avoid "NC" (non-commercial) and
  "ND" (no derivatives) licenses unless you're sure your use qualifies.
- **"All rights reserved"** (most newspaper, museum and Facebook-group photos): ask for written
  permission first.
- Your own photos: say so, and pick a license, e.g. `Photo by the author, CC BY 4.0`.
- Hotlinking images from other sites can break or be blocked. It's safer to download images you
  have rights to into a `photos/` folder. Resize them to about 1200px wide and keep JPGs under
  ~300 KB so the map stays fast on phones.

---

## Publish on GitHub Pages

You don't need to install anything. Everything below happens in your web browser.

**1. Make a GitHub account** (skip this if you have one)
Go to <https://github.com/signup> and follow the steps. Your username becomes part of your
public link.

**2. Create a repository** (a "repo" is a project folder on GitHub)
1. Go to <https://github.com/new>.
2. **Repository name:** `anthracite-collieries`, or any name you like. It becomes part of the
   link.
3. Choose **Public**. Free GitHub Pages sites need a public repo.
4. Leave everything else as it is and click **Create repository**.

**3. Upload the files**
1. On the new repo's page, click the link **"uploading an existing file"**. Or go to
   **Add file → Upload files**.
2. Open this project folder in File Explorer and select everything inside it: `index.html`,
   `sources.html`, `about.html`, `settings.html`, `quiz.html`, `memorial.html`, `stats.html`, `print.html`, `contribute.html`, `manifest.webmanifest`, `sw.js`, `README.md`, and the `css`, `js`, `data`, `icons` and `photos` folders. Drag them all into the browser
   window.
   - Drag the folder's **contents**, not the folder itself. `index.html` must sit at the top level
     of the repo, or Pages will show a 404.
   - Folders keep their structure when you drag them in Chrome or Edge.
   - `serve.ps1`, `serve-phone.bat` and the hidden `.claude` folder are only for local testing.
     Uploading them is harmless, but you don't need to.
3. Scroll down and click **Commit changes**.

**4. Turn on GitHub Pages**
1. In the repo, click **Settings** (the top tab with the gear icon).
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.
5. Wait 1–3 minutes, then refresh the page. A box appears at the top: **"Your site is live at
   …"**. Click **Visit site**.

Your public link will be:

```
https://YOUR-USERNAME.github.io/anthracite-collieries/
```

and links to a single colliery look like
`https://YOUR-USERNAME.github.io/anthracite-collieries/#alaska-colliery`.

**Updating the site later**
- **Small edits:** open a file on GitHub, such as `data/collieries.geojson`, and click the
  ✏️ pencil icon. Edit it, then click **Commit changes**.
- **New or changed files:** use **Add file → Upload files** again. Files with the same name are
  replaced.

The live site updates on its own about a minute after each commit. If you still see the old
version, force-refresh: Ctrl+F5 on a PC, or pull down to reload on a phone.

Anything in a public repo can be seen by anyone, so don't upload private notes or passwords.

*Already use git?* Then `git push` to the repo's `main` branch works the same way.

---

## Map tiles and attribution

- **Satellite:** Esri World Imagery. Free for non-commercial use with attribution, no API key.
- **Place labels:** Esri World Boundaries & Places overlay. You can toggle it.
- **Old USGS topo maps:** scanned USGS paper topographic maps, served by Esri (© 2013 National
  Geographic Society, i-cubed). Each area shows whichever quad edition was scanned, so dates vary
  (mostly mid-to-late 1900s). It shows old strip mines, culm banks and rail lines well. Detail
  stops at zoom level 15, and closer in it just enlarges.
- **Topographic (modern):** OpenTopoMap (CC-BY-SA).
- **Street map:** OpenStreetMap standard tiles. Follow the
  [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/), which allows
  light, non-commercial traffic like this.

Attribution for whichever layer is active is shown automatically in the bottom-right corner.
Don't remove it.

Libraries: [Leaflet 1.9.4](https://leafletjs.com) and
[Leaflet.markercluster 1.5.3](https://github.com/Leaflet/Leaflet.markercluster), both loaded from
the unpkg CDN.
