# Khrystyna Skotte Photography

Marketing site for **khrystynaskotte.com**, a San Diego wedding and elopement
photographer. Static HTML and CSS, no build step, no framework, no package.json.

---

## Stack & Deployment

| Thing | Detail |
|---|---|
| Pages | Hand written `.html` at repo root |
| Styles | 5 files in `css/`, loaded in fixed order |
| Scripts | One `js/main.js`, vanilla JS in an IIFE |
| Host | Vercel |
| Forms | formsubmit.co to `khrystynaskotte@gmail.com`, redirects to `/thanks` |
| Analytics | GA4 `G-JWHEWK95P6` and Microsoft Clarity `vpam3cgxpy` |

`vercel.json` sets `cleanUrls: true` and `trailingSlash: false`. That is why
links and the sitemap use `/weddings` while the file on disk is `weddings.html`.
Always link to the extensionless form in nav and sitemap, and keep the `.html`
suffix only when referencing the file itself.

### Local preview

```bash
python3 -m http.server 8000    # then open http://localhost:8000/index.html
vercel dev                      # honors cleanUrls, use when testing nav links
```

Plain `http.server` does **not** apply `cleanUrls`, so extensionless links will
404 there. Use `vercel dev` when the thing you are verifying is navigation.

---

## Page Inventory

**In nav and sitemap:** index, weddings, pricing, services, portfolio, about,
contact, elopements, proposals. (estate-weddings and engagements were deleted 2026-08-06; their URLs 301 via vercel.json.)

**Unlisted (deliberately absent from nav and sitemap):**

- `elopementspecial.html` promotional landing page
- `hotels.html` hotel photography landing page

Do not add the unlisted pages to the nav or `sitemap.xml` without being asked.
They are standalone landing targets.

---

## Writing Rules

### Never use em dashes

Not the character, not `&mdash;`, not anywhere, not ever. This applies to page
copy, alt text, meta descriptions, and commit messages. The site is currently
at zero occurrences and it stays that way. Use a comma, a colon, parentheses, or
two sentences instead.

Verify before committing:

```bash
grep -n '—\|&mdash;' *.html    # must return nothing
```

`&middot;` is fine and is used intentionally as a separator in package names
such as `Photo &middot; Elopement`.

---

## The Funnel: One Proposals Door

History: the site used to split pre-yes (`picnic-proposals.html`) and post-yes
(`engagements.html`) into two pages. On 2026-08-06 Petey had `engagements.html`
deleted outright (visitor testing showed people confidently converting on the
wrong page) and `picnic-proposals.html` renamed to `proposals.html`.

- **`proposals.html` (served at `/proposals`) is the only proposal page.** It
  owns all proposal content: the $650 photography product, the styled scenes,
  the estimator, and the highlight film.
- **Engagement sessions are still a product** but have no landing page. They
  are sold via `pricing.html` ("Photo · Proposal & Engagement", $650) and the
  "Engagement Session" option on the contact form.
- `vercel.json` 301-redirects `/engagements` and `/picnic-proposals` to
  `/proposals`. Do not remove those redirects; both old URLs are indexed.
- Do not recreate an engagements page or re-add it to nav/sitemap without
  being asked.

---

## Hidden Picnics Partnership (referred to as "HP")

Hidden Picnics is a partner business that designs and builds picnic proposal
setups. They also handle park permits, offered for an added charge. This
attribution boundary caused three separate correction commits, so it is worth
being precise about.

### Problem

Hidden Picnics imagery and credit leaked outside the partnership sections, and
in one case the site implied Khrystyna had photographed setups that were
actually Hidden Picnics' own images.

### Root Cause

Both businesses appear on the same page, so it is easy to reach for whichever
image is nearby without tracking who owns it.

### Solution

- **Hidden Picnics imagery no longer appears anywhere on the site.** The
  "Styled Scene" and "Setups by Hidden Picnics" sections were removed from
  `proposals.html` on 2026-08-09 at Petey's request, and `img/picnics/` was
  deleted with them. The picnic *product* is still sold through the
  estimator, the package cards, and the FAQ; only the showcase imagery is
  gone. Do not re-add HP imagery without being asked.
- **Everything on the site is Khrystyna's photography.**
- **Never claim Khrystyna shot the HP setups.** The gallery label is plainly
  "Setups by Hidden Picnics" with no photographer attribution.
- The pricing estimator has a photography-only path that returns exactly $650
  with no HP tax and no permit flags, and clears HP add-ons when the user
  switches to no setup.

### Key Learning

Before using any image on the picnic or engagement pages, confirm whose work it
is. Default to Khrystyna's photography and treat HP imagery as the exception
confined to those two sections.

---

## Conventions

**CSS cache busting.** `components.css?v=5` and `responsive.css?v=6` carry
version query strings. All 15 pages currently agree. When you edit either file,
bump the number in **every** page in the same commit, or returning visitors get
stale CSS on some pages and fresh CSS on others.

```bash
grep -c 'components.css?v=5' *.html    # all pages should report 1
```

**Header behavior.** `js/main.js` keys off `document.querySelector('.hero')`.
Pages with a dark hero video get the transparent header with the white logo.
Pages without one (portfolio, about, services) stay solid, because the white
logo would vanish against a light background. If you add a page with a light
top section, do not give it a `.hero` element.

**Inquiry copy to Supabase.** Since 2026-10-09 the contact form posts to
FormSubmit as before (that is the email) and `contact.html` also sends a JSON
copy of the inquiry, with the stored click ID and first-touch source, to
`https://wurikcpajrkvmnohungl.supabase.co/functions/v1/site-inquiry` with
`fetch(..., {keepalive: true})` and a `text/plain` body (no preflight). It
lands in `public.site_inquiries`. The source values come from
`initTouchCapture()` in `js/main.js` (`ks_first_touch` in localStorage,
`ks_session_touch` in sessionStorage). If the endpoint is down the form still
submits; only the database copy is lost. Function source and README live in
`ads-data/thumbtack-webhook/` (gitignored). `thanks.html` sets the
`generate_lead` value per inquiry type; import that event into Google Ads as
the only primary conversion.

**Conversion tracking.** `initConversionTracking()` fires GA4 events on click,
with assigned values: `contact_phone` ($30), `contact_email` ($15),
`book_appointment` ($40, Calendly links). These are event based, so no `AW-`
`send_to` is needed. Mark them as key events in GA4 or import them into Google
Ads. `initGclidCapture()` persists the Google Ads click ID for 90 days, matching
the conversion window, so the inquiry form can attach it to the lead email.

**Gallery order: newest shoot shows first.** `.gallery-grid` is CSS columns,
so code order runs *down* each column, not across the top row. Phones and
tablets show two columns, desktop (1024px+) shows three. When adding a shoot:

- Small galleries (index "Featured Weddings", weddings "A Day, Beautifully
  Told"): put the new shoot in slot 1 and at the top of every other column in
  both layouts (column 2 of two, columns 2 and 3 of three). Column breaks
  depend on image heights, so measure in headless Chrome at 500px and 1400px
  wide instead of counting. Keeping the left column the tallest makes the
  breaks land predictably.
- `portfolio.html`: the newest shoot goes first as a group inside the wedding
  items. Only the left column leads with it. Too many items to place column
  tops by hand.
- New files go in `img/weddings-portfolio/` as `couple-names-NN.jpg`, 2000px
  long edge, JPG quality 82, metadata stripped.

**Media.** Roughly 380 images in `img/` and four hero videos in `video/`. Videos
are large (up to 24MB) and committed directly to git. When swapping a hero
video, delete the old file in the same commit as the source change so the repo
does not accumulate unused multi-megabyte assets.

---

## Verification

There is no test suite. Before claiming a change works:

1. `grep -n '—\|&mdash;' *.html` returns nothing.
2. Serve the site and load the changed page, do not just read the diff.
3. If nav or links changed, verify under `vercel dev` so `cleanUrls` applies.
4. If CSS changed, confirm the `?v=` bump landed on every page.
5. If an image or video changed, confirm the file actually exists at the new
   path and the old one is gone.
