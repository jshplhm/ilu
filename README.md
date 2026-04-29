# ilü — Setup & Maintenance Guide

Everything you need to get this site live on GitHub + Netlify with your ilü.com domain.

---

## File Structure

```
ilu-site/
├── index.html          ← The page
├── css/
│   └── style.css       ← All styling
├── js/
│   └── main.js         ← Gallery logic
├── photos/
│   ├── 2022/           ← Drop photos here
│   ├── 2023/
│   ├── 2024/
│   ├── 2025/
│   └── 2026/
├── photos.json         ← IMPORTANT: list of filenames per year
├── netlify.toml        ← Netlify config (don't touch)
└── .gitignore
```

---

## STEP 1 — Push to GitHub

1. Open Terminal (Mac: Cmd+Space → "Terminal")
2. Navigate to the folder you downloaded:
   ```
   cd ~/Downloads/ilu-site
   ```
3. Initialize git and push to your existing repo:
   ```
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your actual GitHub info.

---

## STEP 2 — Deploy on Netlify

1. Go to https://netlify.com and sign up (free — use your GitHub login)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** → authorize Netlify → select your repo
4. Build settings — leave everything blank (this is a plain HTML site, no build step)
5. Click **"Deploy site"**

Netlify will give you a random URL like `silly-name-abc123.netlify.app`. Your site is live!

---

## STEP 3 — Connect ilü.com

Your domain `ilü.com` uses a special character (ü). The technical/punycode version is `xn--il-bma.com`. You may need to use the punycode version in some places.

### In Netlify:
1. Go to your site → **Domain management** → **Add custom domain**
2. Try typing `ilü.com` first. If that doesn't work, enter `xn--il-bma.com`
3. Netlify will show you DNS records to add

### At your domain registrar (wherever you bought ilü.com):
Netlify will give you one of two options:

**Option A — Use Netlify DNS (recommended, easier):**
- Point your domain's nameservers to Netlify's nameservers
- Netlify handles everything automatically including SSL

**Option B — Keep your current DNS provider:**
- Add a CNAME record:
  - Host/Name: `www`
  - Value: `your-site-name.netlify.app`
- Add an A record:
  - Host/Name: `@` (root)
  - Value: `75.2.60.5` (Netlify's load balancer)

SSL (HTTPS) is free and automatic — Netlify does it for you once DNS is connected.

DNS changes take 10 minutes to a few hours to fully propagate.

---

## STEP 4 — Adding Photos

### Photo specs (read this carefully)
- **Format:** JPEG (.jpg) — universal support, good compression
- **Size:** Resize to max **1800px on the longest side** before uploading
- **File size:** Aim for **150–400KB per photo** after compression
- **Naming:** Use simple names with no spaces or special characters
  - ✅ `beach-trip.jpg` or `IMG_4521.jpg`
  - ❌ `Beach Trip (1).jpg` or `mom's birthday!.jpg`

### Free compression tools:
- **squoosh.app** — Google's free tool, works in browser, excellent
- **imageoptim.com** — Mac app, batch compress a whole folder at once (recommended for bulk)
- Target: JPEG at 75–85% quality

### How to add photos:

**Step 1:** Put the photo file in the right folder:
```
photos/2024/beach-trip.jpg
```

**Step 2:** Add the filename to `photos.json`:
```json
{
  "2024": [
    "beach-trip.jpg",
    "existing-photo.jpg"
  ]
}
```
The order in photos.json doesn't matter — the site randomizes on every load.

**Step 3:** Commit and push:
```
git add .
git commit -m "add 2024 beach photos"
git push
```

Netlify auto-deploys within ~30 seconds of every push. That's it.

---

## Storage & Photo Limits

| | Free Tier |
|---|---|
| **GitHub repo size** | Recommended under 1GB |
| **Netlify bandwidth** | 100GB/month (plenty) |
| **Netlify deploys** | 300/month |

**How many photos can you fit?**

At ~250KB average per compressed photo:
- 100 photos per year × 5 years = 500 photos = ~125MB total
- That's well under limits and will load fast

Practical recommendation: **50–100 photos per year max** for a great experience. More than that and scrolling gets overwhelming anyway.

---

## STEP 5 — iPhone Home Screen Icon (Do This Later)

When you're ready to make it feel like a native app on her iPhone:

1. Create a 180×180px PNG of the ilü logo, save it as `apple-touch-icon.png` in the root folder
2. Push to GitHub
3. On her iPhone: open Safari → go to ilü.com → tap Share → "Add to Home Screen"

The site already has the meta tags in `index.html` to support this. It will launch full-screen without the Safari browser chrome.

---

## Making Changes to the Message

The headline text is in `index.html` around line 24:
```html
<p class="message">to the greatest mom, wife, and...</p>
<p class="signature">xo, tate &amp; daddy</p>
```
Edit directly, save, commit, push.

---

## Quick Reference — Common Commands

```bash
# Check what's changed
git status

# Add all changes and push
git add .
git commit -m "your message here"
git push

# Pull latest (if editing from multiple computers)
git pull
```
