# Hotels of Athens

Athens hotel comparison guide - Compare 150+ hotels by neighborhood.

## 🏨 Live Site

[hotelsofathens.com](https://hotelsofathens.com)

## 🛠️ Development

```bash
# Install dependencies
npm install

# Fetch hotel data
npm run fetch

# Generate static site
npm run generate

# Build everything
npm run build
```

## 📁 Structure

```
├── data/               # Hotel JSON data
│   ├── neighborhoods.json
│   ├── all-hotels.json
│   └── hotels/         # Per-neighborhood data
├── templates/          # HTML templates
├── scripts/            # Build scripts
├── dist/               # Generated site (deployed)
└── .github/workflows/  # Automated updates
```

## 🔄 Automated Updates

The site updates automatically every Monday via GitHub Actions:
1. Fetches latest hotel data
2. Regenerates all pages
3. Commits and pushes to trigger Cloudflare Pages deploy

## 📊 Features

- 8 Athens neighborhoods covered
- Hotel comparison by price, views, amenities
- Acropolis view hotels highlighted
- Rooftop bar ratings
- Mobile-first responsive design
- SEO optimized URLs

## 🌐 Deployment

Hosted on Cloudflare Pages with automatic deploys from the `main` branch.
