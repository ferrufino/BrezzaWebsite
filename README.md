# Brezza website

Plain HTML, CSS and JavaScript. No Jekyll or YAML content configuration.

- `index.html`: landing page.
- `assets/site.css`, `assets/site.js`: design and reduced-motion-aware scroll effects.
- `f/index.html`, `assets/forecast.js`, `assets/forecast.css`: public forecast viewer.
- `r/index.html`: existing route links use the same viewer.
- `404.html`: GitHub Pages fallback for `/f/{id}` and `/r/{id}`.
- `policy.html`, `policy/index.html`: existing policy and compatibility URL.
- `.github/workflows/pages.yml`: publishes static files; no site build step.

Forecasts come from the production backend, not sample weather. A forecast link fixes the route, departure, speed/pace, stops and arrival times. The server updates weather at most hourly before departure; afterward the page labels it a past forecast. Shared pages do not include Health, readiness, gear or user identity.

## Content sources — checked 12 November 2026

Apple Canada lookup for app 6740043033: rating 4.95/5, 20 ratings. Reviews from Apple's Canada customer-review feed; excerpts retain their authors. Public route count: 732 rows with `is_public = true` in Brezza Supabase. This is a route count, not a count of customers or completed forecasts.

The current public App Store screenshots (02 and 03) and the existing mountain cycling image are used. Leaflet 1.9.4 is vendored with its license. Weather attribution uses Apple's public `/attribution/en` metadata; maps use attributed OpenStreetMap tiles.
