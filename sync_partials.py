#!/usr/bin/env python3
"""Stamp the shared header (desktop nav + mobile menu) into every page.

The one source of truth for the nav is partials/header.html. Each page holds a
copy between <!-- shared-header:start --> and <!-- shared-header:end -->.

    python3 sync_partials.py          rewrite every page from the partial
    python3 sync_partials.py --check  exit 1 and list pages that are out of date

To add a nav item: edit partials/header.html, run this script, commit all pages.
To give a new page an active item: add it to ACTIVE below. Pages not listed
get no highlighted item, which is right for utility pages like thanks.html.

The inquiry form at the foot of landing pages is the second partial,
partials/inquiry-form.html, stamped between <!-- shared-form:start --> and
<!-- shared-form:end --> on every page listed in FORMS. Its logic lives in
js/main.js (initInquiryForm). Pages with their own bespoke form (contact,
courthouse, engagement, maternity, Temecula) are not in FORMS.
"""
import re, sys
from pathlib import Path

HERE = Path(__file__).parent
PARTIAL = HERE / "partials" / "header.html"
START, END = "  <!-- shared-header:start -->\n", "  <!-- shared-header:end -->\n"

ACTIVE = {
    "index.html": "home",
    "weddings.html": "weddings",
    "temecula-weddings.html": "weddings",
    "elopements.html": "elopements",
    "elopementspecial.html": "elopements",
    "courthouse-wedding.html": "courthouse",
    "san-diego-courthouse-wedding-guide.html": "courthouse",
    "where-to-propose-in-san-diego.html": "proposals",
    "best-places-to-elope-in-san-diego.html": "elopements",
    "san-diego-wedding-photography-cost.html": "pricing",
    "proposals.html": "proposals",
    "maternity.html": "maternity",
    "portfolio.html": "portfolio",
    "about.html": "about",
    "contact.html": "contact",
    "pricing.html": "pricing",
}

FORM_PARTIAL = HERE / "partials" / "inquiry-form.html"
FSTART, FEND = "  <!-- shared-form:start -->\n", "  <!-- shared-form:end -->\n"

# page: (section label, title, preset inquiry type or "")
FORMS = {
    "index.html": ("Weddings, Proposals &amp; Portraits", "Let's Talk About Your Day", ""),
    "weddings.html": ("Weddings", "Let's Talk About Your Day", "Wedding"),
    "elopements.html": ("Elopements", "Let's Talk About Your Day", "Elopement"),
    "elopementspecial.html": ("Elopements", "Let's Talk About Your Day", "Elopement"),
    "proposals.html": ("Surprise Proposals", "Tell Me About the Plan", "Surprise Proposal"),
    "pricing.html": ("Weddings, Proposals &amp; Portraits", "Check Your Date", ""),
    "services.html": ("Weddings, Proposals &amp; Portraits", "Let's Talk About Your Day", ""),
    "about.html": ("Weddings, Proposals &amp; Portraits", "Let's Talk About Your Day", ""),
    "portfolio.html": ("Weddings, Proposals &amp; Portraits", "Let's Talk About Your Day", ""),
    "hotels.html": ("Hotels &amp; Venues", "Let's Talk About Your Property", "Something Else"),
    "best-places-to-elope-in-san-diego.html": ("Elopements", "Let's Talk About Your Day", "Elopement"),
    "san-diego-courthouse-wedding-guide.html": ("Courthouse Weddings", "Check Your Date", "Elopement"),
    "san-diego-engagement-photo-locations.html": ("Engagement Sessions", "Let's Plan Your Session", "Engagement Session"),
    "san-diego-wedding-photography-cost.html": ("Weddings", "Check Your Date", "Wedding"),
    "where-to-propose-in-san-diego.html": ("Surprise Proposals", "Tell Me About the Plan", "Surprise Proposal"),
}

# First-run locator for the form: the photo CTA banner it replaces, or the footer.
LEGACY_CTA = re.compile(r'  <!-- CTA -->\n  <section class="cta-section".*?</section>\n', re.S)
FOOTER = re.compile(r'(?=  <!-- Footer -->\n|  <footer class="footer">)')
FMARKED = re.compile(re.escape(FSTART) + r".*?" + re.escape(FEND), re.S)


def render_form(page_name):
    label, title, preset = FORMS[page_name]
    html = FORM_PARTIAL.read_text().replace("{{label}}", label).replace("{{title}}", title).replace("{{type}}", preset)
    return FSTART + html + FEND


# First-run locator: the header comment through the end of the mobile menu.
LEGACY = re.compile(r'  <!-- Header -->\n  <header class="header(?: scrolled)?" id="header">.*?<nav class="mobile-menu" id="mobileMenu">.*?</nav>\n', re.S)
MARKED = re.compile(re.escape(START) + r".*?" + re.escape(END), re.S)


def render(page_name, src):
    key = ACTIVE.get(page_name, "")
    html = PARTIAL.read_text()
    # Pages whose body is not .hero-page or .home have a light top, so they
    # keep the solid header from first paint (see CLAUDE.md, Header behavior).
    transparent = re.search(r'<body[^>]*class="[^"]*\b(hero-page|home)\b', src) is not None
    html = html.replace("{{solid}}", "" if transparent else " scrolled")
    return START + re.sub(r"\{\{active:([a-z-]+)\}\}", lambda m: " active" if m.group(1) == key else "", html) + END


def main():
    check = "--check" in sys.argv
    stale, missing = [], []
    for page in sorted(HERE.glob("*.html")):
        src = page.read_text()
        want = render(page.name, src)
        if MARKED.search(src):
            new = MARKED.sub(lambda m: want, src, count=1)
        elif LEGACY.search(src):
            new = LEGACY.sub(lambda m: want, src, count=1)
        else:
            missing.append(page.name)
            continue
        if page.name in FORMS:
            want_form = render_form(page.name)
            if FMARKED.search(new):
                new = FMARKED.sub(lambda m: want_form, new, count=1)
            elif LEGACY_CTA.search(new):
                new = LEGACY_CTA.sub(lambda m: want_form, new, count=1)
            elif FOOTER.search(new):
                new = FOOTER.sub(lambda m: want_form, new, count=1)
            else:
                missing.append(page.name + " (form)")
        if new != src:
            stale.append(page.name)
            if not check:
                page.write_text(new)
    if missing:
        print("no header found in:", ", ".join(missing))
    if check:
        if stale or missing:
            if stale:
                print("out of date:", ", ".join(stale))
            sys.exit(1)
        print("all pages match partials/header.html and partials/inquiry-form.html")
    else:
        print("updated" if stale else "no changes needed", ", ".join(stale))


if __name__ == "__main__":
    main()
