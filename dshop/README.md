# D's electronic repair & shop

Static website + admin panel. Runs free on GitHub Pages — no server or database.

## Deploy
1. Create a new GitHub repo (e.g. `d-electronics`) and upload every file in this folder (keep the `assets/` and `images/` folders).
2. Repo → **Settings → Pages** → Source: *Deploy from a branch* → `main` / `(root)` → Save.
3. Your site is live at `https://YOURNAME.github.io/d-electronics/` in about a minute.

## Using the admin panel
1. Make a token: GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate.
   - Repository access: **Only select repositories** → your shop repo
   - Permissions: **Contents → Read and write**
2. Open `yoursite/admin.html` (also linked in the footer), enter your username, repo, branch and token.
3. Edit items, prices, listing status, repair services, categories, business info, FAQ.
4. Click **Publish changes** — it commits `data.json` to the repo and the site updates in ~1 minute.

Image uploads in the admin are committed to the `images/` folder automatically.

**Security:** the admin page is public, but nobody can change anything without your token. Only use it on your own devices, and click *Sign out* on shared computers.

## Files
- `index.html` — the public shop
- `admin.html` — admin panel
- `data.json` — all your content (edited by the admin)
- `assets/` — styles and scripts
