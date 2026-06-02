import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const templatesDir = path.join(rootDir, 'templates');
const distDir = path.join(rootDir, 'dist');
const siteUrl = 'https://hotelsofathens.com';

// Ensure dist directories exist
const dirs = ['dist', 'dist/athens-hotels', 'dist/hotel', 'dist/css', 'dist/images'];
dirs.forEach(dir => {
  const fullPath = path.join(rootDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Load templates
const layoutTemplate = fs.readFileSync(path.join(templatesDir, 'layout.html'), 'utf8');
const homeTemplate = fs.readFileSync(path.join(templatesDir, 'home.html'), 'utf8');
const neighborhoodTemplate = fs.readFileSync(path.join(templatesDir, 'neighborhood.html'), 'utf8');
const hotelTemplate = fs.readFileSync(path.join(templatesDir, 'hotel.html'), 'utf8');
const contactTemplate = fs.readFileSync(path.join(templatesDir, 'contact.html'), 'utf8');
const thankYouTemplate = fs.readFileSync(path.join(templatesDir, 'thank-you.html'), 'utf8');

// Load data
const allHotelsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'all-hotels.json'), 'utf8'));
const neighborhoodsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'neighborhoods.json'), 'utf8'));
const currentYear = new Date().getFullYear();
const lastUpdated = allHotelsData.lastUpdated || new Date().toISOString().split('T')[0];

// Helper: Wrap content in layout
function wrapInLayout(content, title, description, url, options = {}) {
  const fullTitle = title.includes('Hotels of Athens') ? title : `${title} | Hotels of Athens`;
  const schema = buildStructuredData(options.schema || []);
  const urlPath = url.replace(siteUrl, '') || '/';

  return layoutTemplate
    .replace(/\{\{HTML_LANG\}\}/g, options.lang || 'en')
    .replace(/\{\{PAGE_TITLE\}\}/g, title)
    .replace(/\{\{FULL_PAGE_TITLE\}\}/g, fullTitle)
    .replace(/\{\{PAGE_DESCRIPTION\}\}/g, description)
    .replace(/\{\{PAGE_URL\}\}/g, url)
    .replace('{{HREFLANG_LINKS}}', buildHreflangLinks(urlPath, options.lang || 'en'))
    .replace('{{LANGUAGE_SELECTOR}}', buildLanguageSelector(urlPath, options.lang || 'en'))
    .replace(/\{\{OG_TYPE\}\}/g, options.ogType || 'website')
    .replace('{{STRUCTURED_DATA}}', schema)
    .replace('{{CONTENT}}', content);
}

function localizedPath(lang, urlPath) {
  const cleanPath = urlPath === '/' ? '/' : `/${urlPath.replace(/^\/+/, '').replace(/\.html$/, '')}`;
  if (lang === 'en') return cleanPath;
  return cleanPath === '/' ? `/${lang}/` : `/${lang}${cleanPath}`;
}

function buildHreflangLinks(urlPath, activeLang = 'en') {
  const langs = [
    ['en', localizedPath('en', urlPath)],
    ['de', localizedPath('de', urlPath)],
    ['el', localizedPath('el', urlPath)]
  ];
  return [
    ...langs.map(([lang, href]) => `<link rel="alternate" hreflang="${lang}" href="${siteUrl}${href}">`),
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}${localizedPath('en', urlPath)}">`
  ].join('\n  ');
}

function buildLanguageSelector(urlPath, activeLang = 'en') {
  const languages = [
    ['en', 'English'],
    ['de', 'Deutsch'],
    ['el', 'Ελληνικά']
  ];
  return `
      <div class="language-selector" aria-label="Language selector">
        ${languages.map(([lang, label]) => {
          const active = lang === activeLang ? ' aria-current="true"' : '';
          return `<a href="${localizedPath(lang, urlPath)}" hreflang="${lang}" lang="${lang}"${active}>${label}</a>`;
        }).join('')}
      </div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildStructuredData(extraSchemas) {
  const base = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Hotels of Athens',
      url: siteUrl,
      description: 'Compare Athens hotels by neighborhood, price, Acropolis views, rooftop bars, and traveler fit.'
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Hotels of Athens',
      url: siteUrl,
      logo: `${siteUrl}/images/og.jpg`
    }
  ];

  return JSON.stringify(base.concat(extraSchemas), null, 2);
}

function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

function faqSchema(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

function itemListSchema(name, hotels, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    url,
    numberOfItems: hotels.length,
    itemListElement: hotels.map((hotel, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteUrl}/hotel/${hotel.slug}`,
      name: hotel.name
    }))
  };
}

function pageSchema(type, name, description, url) {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    name,
    description,
    url,
    dateModified: lastUpdated
  };
}

// Helper: Generate star rating
function generateStars(rating) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

// Helper: Get price tier
function getPriceTier(price) {
  if (price < 80) return 'budget';
  if (price < 150) return 'mid';
  if (price < 250) return 'upscale';
  return 'luxury';
}

function priceTierLabel(price) {
  const tier = getPriceTier(price);
  return {
    budget: 'Budget',
    mid: 'Mid-range',
    upscale: 'Upscale',
    luxury: 'Luxury'
  }[tier];
}

function uniqueHotels(hotels) {
  const seen = new Set();
  return hotels.filter(hotel => {
    if (seen.has(hotel.slug)) return false;
    seen.add(hotel.slug);
    return true;
  });
}

function hotelUrl(hotel) {
  return `/hotel/${hotel.slug}`;
}

function hotelsForNeighborhood(neighborhoodId) {
  return uniqueHotels(allHotelsData.hotels).filter(hotel => hotel.neighborhood === neighborhoodId);
}

function hotelFitLabel(hotel) {
  if (hotel.hasAcropolisView && hotel.hasRooftopBar) return 'Acropolis-view rooftop stay';
  if (hotel.hasAcropolisView) return 'Acropolis-view base';
  if (hotel.hasRooftopBar) return 'Rooftop bar stay';
  if (hotel.pricePerNight < 80) return 'Budget-friendly base';
  if (hotel.starRating >= 5) return 'Luxury city stay';
  return `${hotel.neighborhoodName || hotel.neighborhood} hotel`;
}

function chooseTopHotels(hotels, limit = 8) {
  return uniqueHotels(hotels)
    .sort((a, b) => {
      const score = h => (h.starRating * 8) + (h.hasAcropolisView ? 9 : 0) + (h.hasRooftopBar ? 8 : 0) + ((h.rooftopRating || 0) * 2) - (h.pricePerNight / 80);
      return score(b) - score(a);
    })
    .slice(0, limit);
}

function renderComparisonTable(rows, columns, caption) {
  return `
    <div class="table-wrap">
      <table class="comparison-table">
        <caption>${escapeHtml(caption)}</caption>
        <thead>
          <tr>${columns.map(col => `<th scope="col">${escapeHtml(col.label)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map(row => `
            <tr>
              ${columns.map((col, index) => `<td ${index === 0 ? 'data-label="' + escapeHtml(col.label) + '"' : 'data-label="' + escapeHtml(col.label) + '"'}>${row[col.key]}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderHotelComparisonTable(hotels, caption) {
  const rows = hotels.map(hotel => ({
    hotel: `<a href="${hotelUrl(hotel)}">${escapeHtml(hotel.name)}</a>`,
    neighborhood: `<a href="/athens-hotels/${hotel.neighborhood}">${escapeHtml(hotel.neighborhoodName || hotel.neighborhood)}</a>`,
    fit: escapeHtml(hotelFitLabel(hotel)),
    price: `€${hotel.pricePerNight} <span class="muted">/night signal</span>`,
    features: [
      `${hotel.starRating} star`,
      hotel.hasAcropolisView ? 'Acropolis view' : '',
      hotel.hasRooftopBar ? 'Rooftop bar' : ''
    ].filter(Boolean).map(escapeHtml).join('<br>')
  }));

  return renderComparisonTable(rows, [
    { key: 'hotel', label: 'Hotel' },
    { key: 'neighborhood', label: 'Area' },
    { key: 'fit', label: 'Best fit' },
    { key: 'price', label: 'Price' },
    { key: 'features', label: 'Visible signals' }
  ], caption);
}

function renderNeighborhoodMatrix() {
  const rows = neighborhoodsData.neighborhoods.map(hood => {
    const hotels = hotelsForNeighborhood(hood.id);
    return {
      area: `<a href="/athens-hotels/${hood.id}">${escapeHtml(hood.name)}</a>`,
      best: escapeHtml(hood.bestFor.join(', ')),
      price: `€${hood.avgPrice}`,
      count: `${hotels.length}`,
      signals: `${hotels.filter(h => h.hasAcropolisView).length} view / ${hotels.filter(h => h.hasRooftopBar).length} rooftop`
    };
  });

  return renderComparisonTable(rows, [
    { key: 'area', label: 'Area' },
    { key: 'best', label: 'Best for' },
    { key: 'price', label: 'Avg price' },
    { key: 'count', label: 'Tracked hotels' },
    { key: 'signals', label: 'View / rooftop' }
  ], 'Athens hotel neighborhoods compared by fit, price, and visible hotel features.');
}

function renderFaqDetails(faqs) {
  return `
    <div class="faq-list">
      ${faqs.map(faq => `
        <details class="faq-item">
          <summary>${escapeHtml(faq.question)}</summary>
          <p>${escapeHtml(faq.answer)}</p>
        </details>
      `).join('')}
    </div>
  `;
}

function renderGuideLinks(guides) {
  const links = guides.map(guide => [
    `      <a class="guide-link" href="/${guide.slug}">`,
    `        <span>${escapeHtml(guide.kicker || 'Guide')}</span>`,
    `        <strong>${escapeHtml(guide.label || guide.h1)}</strong>`,
    '      </a>'
  ].join('\n')).join('\n');

  return [
    '    <div class="guide-link-grid">',
    links,
    '    </div>'
  ].join('\n');
}

function renderBookingChecklist(items = []) {
  const checklist = items.length ? items : [
    'Confirm the exact room type, not only the hotel-level feature.',
    'Check whether breakfast, taxes, cancellation, and city fees change the final value.',
    'Verify the walking route or transfer time for the specific address.',
    'If a view, rooftop, pool, or ferry connection matters, confirm the access rules for your dates.'
  ];

  return `
    <div class="checklist-grid">
      ${checklist.map(item => `
        <div class="check-item">
          <span class="check-mark">✓</span>
          <p>${escapeHtml(item)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function renderAreaFitPanels(hotels, heading = 'Area Fit Notes') {
  const hoods = neighborhoodsData.neighborhoods
    .filter(hood => hotels.some(hotel => hotel.neighborhood === hood.id))
    .slice(0, 6);

  if (!hoods.length) return '';

  return `
    <section class="section">
      <div class="container">
        <h2 class="section-title">${escapeHtml(heading)}</h2>
        <div class="area-stack">
          ${hoods.map(hood => {
            const hoodHotels = hotels.filter(hotel => hotel.neighborhood === hood.id);
            const lowest = [...hoodHotels].sort((a, b) => a.pricePerNight - b.pricePerNight)[0];
            const viewCount = hoodHotels.filter(hotel => hotel.hasAcropolisView).length;
            const rooftopCount = hoodHotels.filter(hotel => hotel.hasRooftopBar).length;
            return `
              <article class="area-panel">
                <div>
                  <h3><a href="/athens-hotels/${hood.id}">${escapeHtml(hood.name)}</a></h3>
                  <p>${escapeHtml(hood.description)}</p>
                </div>
                <dl class="signal-list">
                  <div><dt>Best for</dt><dd>${escapeHtml(hood.bestFor.join(', '))}</dd></div>
                  <div><dt>Price signal</dt><dd>${lowest ? `from €${lowest.pricePerNight}` : `avg €${hood.avgPrice}`}</dd></div>
                  <div><dt>Acropolis</dt><dd>${escapeHtml(hood.walkToAcropolis)}</dd></div>
                  <div><dt>Signals</dt><dd>${viewCount} view / ${rooftopCount} rooftop</dd></div>
                </dl>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    </section>
  `;
}

function guideHotelLimit(guide) {
  return guide.limit || 12;
}

function sortByScore(hotels) {
  return [...hotels].sort((a, b) => {
    const score = h => (h.starRating * 8) + (h.hasAcropolisView ? 9 : 0) + (h.hasRooftopBar ? 8 : 0) + ((h.rooftopRating || 0) * 2) - (h.pricePerNight / 80);
    return score(b) - score(a);
  });
}

const ultraLuxuryGuide = {
  slug: 'ultra-luxury-athens-villas-suites',
  label: 'Ultra-Luxury Villas & Suites',
  kicker: 'Money-no-object',
  title: 'Ultra-Luxury Athens Villas & Presidential Suites',
  h1: 'Ultra-Luxury Athens Villas, Presidential Suites & Helicopter Transfers',
  description: 'Compare Athens trophy stays: presidential suites, private Riviera villas, Amanzoe Villa 20, helicopter transfers, and quote-only luxury.'
};

const intentGuides = [
  {
    slug: 'hotels-near-acropolis-athens',
    label: 'Hotels Near the Acropolis',
    kicker: 'Acropolis',
    title: 'Hotels Near Acropolis Athens',
    h1: 'Hotels Near the Acropolis in Athens',
    hero: 'Compare central Athens stays for short Acropolis access, historic sightseeing, and easy first-trip logistics.',
    quickH2: 'For Acropolis-first trips, compare Plaka, Koukaki, Monastiraki, and Syntagma before choosing a hotel.',
    quickP: 'These areas have the strongest combination of Acropolis access and hotel depth in the Hotels of Athens dataset. Plaka is the classic historic base, Koukaki is quieter and local, Monastiraki adds metro and nightlife, and Syntagma adds city-centre transport.',
    description: 'Compare hotels near the Acropolis in Athens by area, price signal, view signal, rooftop bar, and traveler fit.',
    caption: 'Central Athens hotels useful for Acropolis-focused trips.',
    filter: h => ['plaka', 'koukaki', 'monastiraki', 'syntagma'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Choose Plaka if', 'You want the most classic historic base and the shortest old-city feel around the Acropolis.'],
      ['Choose Koukaki if', 'You want quieter streets, better value signals, and easy access to the south side of the Acropolis.'],
      ['Choose Monastiraki if', 'You want Acropolis views plus metro, markets, rooftop bars, and nightlife.']
    ],
    faqs: [
      ['What Athens area is closest to the Acropolis?', 'Plaka and Koukaki are the closest areas in this dataset, with Monastiraki also strong for central access.'],
      ['Should I stay in Plaka or Koukaki near the Acropolis?', 'Choose Plaka for historic atmosphere and first-trip convenience; choose Koukaki for quieter value and a more residential feel.'],
      ['Do hotels near the Acropolis always have Acropolis views?', 'No. Proximity and view are separate signals, so confirm the room or rooftop view before booking.']
    ]
  },
  {
    slug: 'acropolis-view-hotels-athens',
    label: 'Acropolis View Hotels',
    kicker: 'Views',
    title: 'Acropolis View Hotels in Athens',
    h1: 'Athens Hotels with Acropolis Views',
    hero: 'Compare hotels with an Acropolis-view signal by neighborhood, price tier, rooftop bar, and traveler fit.',
    quickH2: 'The strongest Acropolis-view hotel signals cluster in Plaka, Monastiraki, Syntagma, Koukaki, and Kolonaki.',
    quickP: 'Use this page when the view matters more than a generic central location. Rooftop bars, room views, terraces, and restaurant views can differ, so confirm the exact view type before booking.',
    description: 'Compare Athens hotels with Acropolis-view signals by neighborhood, price, rooftop bar, star category, and traveler fit.',
    caption: 'Athens hotels with Acropolis-view signals in the Hotels of Athens dataset.',
    filter: h => h.hasAcropolisView,
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Best luxury direction', 'Syntagma, Plaka, and Kolonaki carry several premium view signals.'],
      ['Best value direction', 'Monastiraki and Koukaki include lower price signals with view flags.'],
      ['View caveat', 'A hotel-level view signal does not guarantee every room has the same view.']
    ],
    faqs: [
      ['Which Athens neighborhoods have Acropolis-view hotels?', 'Plaka, Monastiraki, Syntagma, Kolonaki, and Koukaki show Acropolis-view hotel signals in this dataset.'],
      ['Are rooftop views and room views the same thing?', 'No. A rooftop may have a view even when standard rooms do not, so confirm the exact room or terrace before booking.'],
      ['Are Acropolis-view hotels expensive?', 'Some are luxury-price stays, but the dataset also includes mid-range and budget price signals with Acropolis-view flags.']
    ]
  },
  {
    slug: '5-star-hotels-athens',
    label: '5-Star Hotels',
    kicker: 'Luxury',
    title: '5-Star Hotels in Athens',
    h1: '5-Star Hotels in Athens',
    hero: 'Compare Athens 5-star stays by neighborhood, price signal, Acropolis view, rooftop bar, and traveler fit.',
    quickH2: 'For 5-star stays, start with Syntagma, Plaka, Kolonaki, and Psyrri.',
    quickP: 'Syntagma carries the strongest classic luxury signals, Plaka works for historic luxury near the Acropolis, Kolonaki adds a polished hillside option, and Psyrri adds a design-forward city stay.',
    description: 'Compare 5-star hotels in Athens by area, price signal, Acropolis view, rooftop bar, amenities, and traveler fit.',
    caption: 'Athens 5-star hotels compared by visible site data.',
    filter: h => h.starRating >= 5,
    sort: hotels => [...hotels].sort((a, b) => b.pricePerNight - a.pricePerNight),
    notes: [
      ['Classic luxury', 'Syntagma is the strongest starting point for landmark city-centre luxury.'],
      ['Historic luxury', 'Plaka is the better fit when old-city atmosphere and Acropolis access matter.'],
      ['Confirm before booking', 'Live rates, view categories, and included amenities can change by date and room type.']
    ],
    faqs: [
      ['Which Athens area is best for 5-star hotels?', 'Syntagma has the strongest concentration of 5-star luxury signals in this dataset.'],
      ['Do 5-star Athens hotels have rooftop bars?', 'Several tracked 5-star hotels show rooftop-bar signals, but not all do.'],
      ['Are all 5-star hotels in Athens near the Acropolis?', 'No. Some are closer to Syntagma, Kolonaki, or Psyrri, so compare area fit as well as star category.']
    ]
  },
  {
    slug: 'boutique-hotels-athens',
    label: 'Boutique Hotels',
    kicker: 'Style',
    title: 'Boutique Hotels in Athens',
    h1: 'Boutique Hotels in Athens',
    hero: 'Compare smaller, design-led, and character-forward Athens hotel options from the tracked dataset.',
    quickH2: 'Boutique signals show up strongest in Plaka, Monastiraki, Kolonaki, and Psyrri.',
    quickP: 'Choose Plaka for historic atmosphere, Monastiraki for central energy, Kolonaki for polished design, and Psyrri for art and nightlife context.',
    description: 'Compare boutique hotels in Athens by neighborhood, price signal, view, rooftop bar, design fit, and nearby alternatives.',
    caption: 'Athens boutique and design-forward hotel starting points.',
    filter: h => (h.bestFor || []).some(x => /boutique|design|art/i.test(x)) || /boutique/i.test(h.name),
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Best for design', 'Kolonaki and Plaka are the cleanest starting points for a quieter boutique feel.'],
      ['Best for nightlife', 'Monastiraki and Psyrri make more sense if restaurants, bars, and evenings out are central to the trip.'],
      ['Style caveat', 'Boutique is treated as a visible style/fit signal, not an award or review score.']
    ],
    faqs: [
      ['What counts as a boutique hotel in this guide?', 'Hotels are included when their stored tags, name, or positioning indicate boutique, design, or art-led fit.'],
      ['Which Athens neighborhood is best for boutique hotels?', 'Plaka, Monastiraki, Kolonaki, and Psyrri are the best starting points in this dataset.'],
      ['Are boutique hotels in Athens always luxury hotels?', 'No. Boutique can describe style and scale, while price signals range from mid-range to luxury.']
    ]
  },
  {
    slug: 'hotels-in-athens-with-pool',
    label: 'Hotels with Pools',
    kicker: 'Pool',
    title: 'Hotels in Athens with Pool',
    h1: 'Hotels in Athens with a Pool',
    hero: 'Compare tracked Athens hotels where the amenities data includes a pool signal.',
    quickH2: 'Pool signals are concentrated in higher-price Athens hotels.',
    quickP: 'The Hotels of Athens dataset currently shows pool signals on a small set of premium hotels. Confirm whether the pool is rooftop, indoor, seasonal, or guest-only before booking.',
    description: 'Compare Athens hotels with pool signals by area, price, view, rooftop bar, amenities, and traveler fit.',
    caption: 'Athens hotels with pool signals in the dataset.',
    filter: h => (h.amenities || []).some(a => /pool/i.test(a)),
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Pool type matters', 'A rooftop pool, spa pool, and seasonal outdoor pool are different booking decisions.'],
      ['Price expectation', 'Pool signals in this dataset skew upscale and luxury.'],
      ['Confirm access', 'Check whether pool access is included for your room type and dates.']
    ],
    faqs: [
      ['Do many Athens hotels have pools?', 'In this dataset, pool signals are limited and mostly attached to premium hotels.'],
      ['Are Athens hotel pools usually rooftop pools?', 'Some are rooftop or view-oriented, but pool type must be confirmed with the hotel before booking.'],
      ['What area should I choose for a pool hotel in Athens?', 'Start with Plaka, Syntagma, and Kolonaki based on the current tracked pool signals.']
    ]
  },
  {
    slug: 'hotels-in-athens-city-centre',
    label: 'City Centre Hotels',
    kicker: 'Central',
    title: 'Hotels in Athens City Centre',
    h1: 'Hotels in Athens City Centre',
    hero: 'Compare central Athens hotel areas for sightseeing, metro access, nightlife, shopping, and first-trip convenience.',
    quickH2: 'For Athens city-centre hotels, start with Plaka, Monastiraki, Syntagma, Koukaki, Psyrri, and Kolonaki.',
    quickP: 'Those areas cover the strongest central use cases: old-city atmosphere, markets and metro, luxury transport connections, quieter Acropolis access, nightlife, and polished cafes/shopping.',
    description: 'Compare hotels in Athens city centre by neighborhood, price signal, Acropolis access, rooftop bar, and traveler fit.',
    caption: 'Central Athens hotels compared across the tracked city-centre neighborhoods.',
    filter: h => ['plaka', 'monastiraki', 'syntagma', 'psyrri', 'koukaki', 'kolonaki'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels).slice(0, 14),
    notes: [
      ['Most classic', 'Plaka is the most classic central sightseeing base.'],
      ['Most connected', 'Syntagma and Monastiraki are the best starting points for metro and movement.'],
      ['Quietest central feel', 'Koukaki and Kolonaki are better when you want a calmer base.']
    ],
    faqs: [
      ['What counts as Athens city centre?', 'For this guide, city centre means Plaka, Monastiraki, Syntagma, Psyrri, Koukaki, and Kolonaki.'],
      ['Is Piraeus in Athens city centre?', 'No. Piraeus is best treated as a port/ferry base rather than a central sightseeing base.'],
      ['Which central Athens area is best for first-timers?', 'Plaka is the classic first-timer choice, while Monastiraki and Syntagma are better for transit.']
    ]
  },
  {
    slug: 'cheap-hotels-in-athens',
    label: 'Cheap Hotels',
    kicker: 'Value',
    title: 'Cheap Hotels in Athens',
    h1: 'Cheap Hotels in Athens',
    hero: 'Compare lower price-signal Athens hotels by area, traveler fit, and tradeoffs.',
    quickH2: 'The strongest cheap-hotel signals are in Exarchia, Monastiraki, Koukaki, Piraeus, and Syntagma.',
    quickP: 'This page uses a wider value threshold than the budget guide: tracked hotels under €100/night. Confirm live taxes, room type, and cancellation terms before booking.',
    description: 'Compare cheap hotels in Athens under €100/night by neighborhood, price signal, star category, view, and traveler fit.',
    caption: 'Athens hotels under €100/night in the Hotels of Athens dataset.',
    filter: h => h.pricePerNight < 100,
    sort: hotels => [...hotels].sort((a, b) => a.pricePerNight - b.pricePerNight),
    notes: [
      ['Lowest visible signals', 'Athens Backpackers, City Circus Athens, Orion Hotel, Marble House, and Exarchion Hotel carry the lowest price signals.'],
      ['Best central value', 'Monastiraki, Koukaki, and Syntagma offer more central value tradeoffs than port-first stays.'],
      ['Confirm the true total', 'Taxes, breakfast, cancellation, and room type can change the final value.']
    ],
    faqs: [
      ['What is a cheap hotel in Athens on this page?', 'This guide includes tracked hotels under €100/night based on stored price signals.'],
      ['Which Athens area is cheapest in this dataset?', 'Exarchia has the strongest cluster of very low price signals.'],
      ['Can cheap hotels in Athens still be central?', 'Yes. Monastiraki, Koukaki, and Syntagma have lower-price signals in central areas.']
    ]
  },
  {
    slug: 'hotels-near-piraeus-port',
    label: 'Piraeus Port Hotels',
    kicker: 'Ferries',
    title: 'Hotels Near Piraeus Port',
    h1: 'Hotels Near Piraeus Port',
    hero: 'Compare Piraeus hotel options for early ferries, port logistics, seafood, and practical overnight stays.',
    quickH2: 'Stay near Piraeus Port when ferry timing matters more than central Athens sightseeing.',
    quickP: 'Piraeus is the practical base for early island departures and late ferry arrivals. If you also want Athens sightseeing, compare central neighborhoods before committing to a port stay.',
    description: 'Compare hotels near Piraeus Port by price signal, ferry convenience, sea-view signal, and traveler fit.',
    caption: 'Tracked Piraeus hotel options for port and ferry-focused trips.',
    filter: h => h.neighborhood === 'piraeus',
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Best for early ferries', 'Choose Piraeus when avoiding an early transfer from central Athens is the priority.'],
      ['Best for central sightseeing', 'Choose Syntagma or Monastiraki instead if the ferry is not the main constraint.'],
      ['Confirm terminal logistics', 'Piraeus has multiple gates and transfer times, so check the exact ferry terminal.']
    ],
    faqs: [
      ['Should I stay in Piraeus before an early ferry?', 'Yes, if reducing morning transfer risk matters more than staying in central Athens.'],
      ['Is Piraeus good for sightseeing in Athens?', 'It is less convenient for classic Athens sightseeing than Plaka, Monastiraki, or Syntagma.'],
      ['What should I confirm before booking a Piraeus hotel?', 'Confirm the exact ferry gate, transfer time, breakfast timing, and cancellation terms.']
    ]
  },
  {
    slug: 'syntagma-square-hotels',
    label: 'Syntagma Square Hotels',
    kicker: 'Syntagma',
    title: 'Syntagma Square Hotels',
    h1: 'Hotels Near Syntagma Square',
    hero: 'Compare Syntagma hotels for transport, Parliament/Syntagma access, shopping, and premium city-centre stays.',
    quickH2: 'Syntagma is the best Athens base for transport, classic luxury, and central city logistics.',
    quickP: 'Choose Syntagma if you want airport/metro convenience, shopping access, and a polished city-centre base. Choose Plaka or Monastiraki if old-city atmosphere matters more.',
    description: 'Compare Syntagma Square hotels by price signal, star category, Acropolis view, rooftop bar, and traveler fit.',
    caption: 'Tracked Syntagma hotels compared by visible site data.',
    filter: h => h.neighborhood === 'syntagma',
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Best for luxury', 'Hotel Grande Bretagne and King George Athens anchor the premium end of the tracked Syntagma set.'],
      ['Best for transport', 'Syntagma is the cleanest central area fit when metro and airport movement matter.'],
      ['Value note', 'Arethusa Hotel carries the lowest Syntagma price signal in the dataset.']
    ],
    faqs: [
      ['Is Syntagma Square a good area to stay in Athens?', 'Yes. It is central, connected, and practical, especially for transport and luxury stays.'],
      ['Is Syntagma better than Plaka?', 'Choose Syntagma for transport and city-centre logistics; choose Plaka for historic atmosphere.'],
      ['Are there budget hotels near Syntagma Square?', 'The dataset includes at least one lower price-signal Syntagma hotel, but confirm live rates before booking.']
    ]
  },
  {
    slug: 'hotels-near-acropolis-museum-athens',
    label: 'Acropolis Museum Hotels',
    kicker: 'Museum',
    title: 'Hotels Near Acropolis Museum Athens',
    h1: 'Hotels Near the Acropolis Museum in Athens',
    hero: 'Compare Plaka and Koukaki hotels for Acropolis Museum access, Acropolis walks, and quieter nearby stays.',
    quickH2: 'For the Acropolis Museum, compare Plaka for old-city atmosphere and Koukaki for quieter value.',
    quickP: 'Both Plaka and Koukaki work well for museum-focused stays. Plaka leans historic and central, while Koukaki can feel more local and residential.',
    description: 'Compare hotels near the Acropolis Museum in Athens by area, price signal, view, rooftop bar, and traveler fit.',
    caption: 'Plaka and Koukaki hotels useful for Acropolis Museum-focused stays.',
    filter: h => ['plaka', 'koukaki'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Choose Plaka if', 'You want the historic core and old-city streets around the museum trip.'],
      ['Choose Koukaki if', 'You want a quieter neighborhood feel near the south side of the Acropolis.'],
      ['Confirm route', 'Check the exact hotel address and walking route to the museum before booking.']
    ],
    faqs: [
      ['Which area is best near the Acropolis Museum?', 'Plaka and Koukaki are the strongest starting points in this dataset.'],
      ['Is Koukaki good for the Acropolis Museum?', 'Yes. Koukaki is a useful quieter base for the museum and south-side Acropolis access.'],
      ['Do Acropolis Museum hotels have Acropolis views?', 'Some do, but view and museum proximity should be checked separately.']
    ]
  },
  {
    slug: 'romantic-hotels-athens',
    label: 'Romantic Hotels',
    kicker: 'Couples',
    title: 'Romantic Hotels in Athens',
    h1: 'Romantic Hotels in Athens',
    hero: 'Compare Athens hotel starting points for couples, views, rooftops, boutique style, and special-occasion stays.',
    quickH2: 'For romantic Athens stays, prioritize view, neighborhood feel, and whether the hotel has a rooftop or boutique signal.',
    quickP: 'Plaka, Monastiraki, Syntagma, and Kolonaki offer the strongest mix of couples tags, Acropolis-view signals, rooftop signals, and premium stays in the dataset.',
    description: 'Compare romantic hotels in Athens by couples fit, neighborhood, price signal, Acropolis view, rooftop bar, and style.',
    caption: 'Athens hotels with couples, view, luxury, or boutique fit signals.',
    filter: h => (h.bestFor || []).some(x => /couples|views|luxury|boutique|design/i.test(x)) || h.hasAcropolisView,
    sort: hotels => sortByScore(hotels).slice(0, 12),
    notes: [
      ['Best for views', 'Acropolis-view and rooftop-bar signals matter more than star category alone.'],
      ['Best for quiet style', 'Kolonaki and Koukaki can be better if nightlife is not the priority.'],
      ['Best for classic setting', 'Plaka is the classic romantic Athens base for old-city atmosphere.']
    ],
    faqs: [
      ['What is the most romantic area to stay in Athens?', 'Plaka is the classic choice, while Kolonaki and Koukaki can suit quieter couples trips.'],
      ['Should couples choose a rooftop hotel in Athens?', 'A rooftop can be a strong fit if sunset views and on-site drinks matter, but confirm access and view type.'],
      ['Are romantic hotels in Athens always expensive?', 'No. The dataset includes both premium and mid-range price signals with couples or view fit.']
    ]
  },
  {
    slug: 'cheap-hotels-near-acropolis-athens',
    label: 'Cheap Near Acropolis',
    kicker: 'Value',
    title: 'Cheap Hotels Near Acropolis Athens',
    h1: 'Cheap Hotels Near the Acropolis in Athens',
    hero: 'Compare lower price-signal hotels in Acropolis-adjacent neighborhoods.',
    quickH2: 'For cheaper Acropolis access, compare Monastiraki, Koukaki, and lower-price Plaka options.',
    quickP: 'This page focuses on tracked hotels under €100/night in Plaka, Monastiraki, and Koukaki. Confirm live rates and the exact walking route before booking.',
    description: 'Compare cheap hotels near the Acropolis in Athens by area, price signal, view signal, and traveler fit.',
    caption: 'Tracked hotels under €100/night in Acropolis-adjacent Athens neighborhoods.',
    filter: h => h.pricePerNight < 100 && ['plaka', 'monastiraki', 'koukaki'].includes(h.neighborhood),
    sort: hotels => [...hotels].sort((a, b) => a.pricePerNight - b.pricePerNight),
    notes: [
      ['Lowest price signals', 'Hostel and pension-style options carry the lowest stored price signals.'],
      ['Best central tradeoff', 'Monastiraki is strong if you want price, metro, and central energy together.'],
      ['Quiet value tradeoff', 'Koukaki is better when you want a calmer area near the Acropolis.']
    ],
    faqs: [
      ['Can I stay near the Acropolis cheaply?', 'Yes, but the cheapest options involve tradeoffs such as simpler rooms, hostel formats, or fewer amenities.'],
      ['Which cheap area near the Acropolis should I compare first?', 'Start with Monastiraki and Koukaki, then compare lower-price Plaka options.'],
      ['Do cheap hotels near the Acropolis have views?', 'Some lower-price tracked hotels show view signals, but confirm the exact room or terrace view before booking.']
    ]
  },
  {
    slug: 'athens-hotels-with-rooftop-pool',
    label: 'Rooftop Pool Hotels',
    kicker: 'Rooftop pool',
    title: 'Athens Hotels with Rooftop Pool',
    h1: 'Athens Hotels with Rooftop Pool Signals',
    hero: 'Compare hotels where pool, rooftop, and view signals overlap in the tracked data.',
    quickH2: 'Rooftop-pool style signals are limited and mostly premium in central Athens.',
    quickP: 'Use this as a short list for further verification. Confirm whether the pool is rooftop, seasonal, guest-only, or tied to a specific room or spa policy before booking.',
    description: 'Compare Athens hotels with rooftop and pool signals by neighborhood, price, Acropolis view, and traveler fit.',
    caption: 'Athens hotels with both rooftop-bar and pool signals in the dataset.',
    filter: h => h.hasRooftopBar && (h.amenities || []).some(a => /pool/i.test(a)),
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Best for premium views', 'These options skew luxury and view-oriented.'],
      ['Verify pool access', 'Pool policies can vary by season, room type, and guest status.'],
      ['Compare alternatives', 'If pool access matters more than rooftop views, also compare all Athens pool hotels.']
    ],
    faqs: [
      ['Are there many Athens hotels with rooftop pools?', 'The tracked dataset shows only a small number of hotels where rooftop and pool signals overlap.'],
      ['Are rooftop pools in Athens open year-round?', 'That depends on the hotel and season; confirm directly before booking.'],
      ['Are rooftop pool hotels in Athens expensive?', 'The tracked rooftop-pool overlap skews upscale and luxury.']
    ]
  },
  {
    slug: 'luxury-hotels-in-plaka-athens',
    label: 'Luxury Plaka Hotels',
    kicker: 'Plaka luxury',
    title: 'Luxury Hotels in Plaka Athens',
    h1: 'Luxury Hotels in Plaka, Athens',
    hero: 'Compare premium Plaka hotel options for historic atmosphere, Acropolis access, and view or rooftop signals.',
    quickH2: 'Luxury Plaka is best when old-city atmosphere matters as much as the hotel itself.',
    quickP: 'The premium Plaka set is small, so compare these options against Syntagma luxury hotels if broader service infrastructure matters more than historic streets.',
    description: 'Compare luxury hotels in Plaka Athens by price signal, star category, Acropolis view, rooftop bar, and traveler fit.',
    caption: 'Premium Plaka hotel options in the Hotels of Athens dataset.',
    filter: h => h.neighborhood === 'plaka' && h.pricePerNight >= 150,
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Choose Plaka if', 'You want historic streets, old-city atmosphere, and short Acropolis access.'],
      ['Compare Syntagma if', 'You want a larger classic luxury cluster and transport connections.'],
      ['Verify view category', 'Premium Plaka hotels may have view signals, but not every room will share the same view.']
    ],
    faqs: [
      ['Is Plaka good for luxury hotels?', 'Yes, if you value historic setting and Acropolis access. Syntagma has a broader classic luxury cluster.'],
      ['Which Plaka luxury hotels have Acropolis-view signals?', 'The premium Plaka options shown on this page include Acropolis-view signals in the dataset.'],
      ['Should I choose Plaka or Syntagma for luxury?', 'Choose Plaka for atmosphere and Acropolis access; choose Syntagma for transport and classic city-centre luxury.']
    ]
  },
  {
    slug: 'hotels-in-athens-greece',
    label: 'Hotels in Athens Greece',
    kicker: 'Main hub',
    title: 'Hotels in Athens Greece: Compare Areas & Stays',
    h1: 'Hotels in Athens, Greece',
    hero: 'Compare Athens hotels by area, price signal, Acropolis access, views, rooftops, and traveler fit before opening booking tabs.',
    quickH2: 'For most Athens trips, compare the area first: Plaka, Monastiraki, Syntagma, Koukaki, Psyrri, Kolonaki, Piraeus, and Exarchia solve different hotel problems.',
    quickP: 'Large booking sites are useful for inventory, but they can flatten the city into one list. This guide starts with the decision that changes the stay: historic atmosphere, metro access, nightlife, ferry timing, quiet value, or luxury polish.',
    description: 'Compare hotels in Athens, Greece by neighborhood, price signal, Acropolis-view signal, rooftop bar, pool, and traveler fit.',
    caption: 'Athens hotels in the Hotels of Athens dataset compared by area, price, and visible booking signals.',
    filter: h => true,
    sort: hotels => sortByScore(hotels).slice(0, 16),
    limit: 16,
    notes: [
      ['Start with area, not brand', 'Plaka is classic, Monastiraki is energetic, Syntagma is connected, Koukaki is calmer, and Piraeus is a ferry base rather than a sightseeing base.'],
      ['Use signals carefully', 'Acropolis-view, rooftop-bar, pool, and price fields are hotel-level signals. Confirm the exact room, terrace, season, and rate before booking.'],
      ['Keep the shortlist tight', 'Pick two areas, then compare 4-6 hotels. Athens has too many similar-looking options if you start with every property at once.']
    ],
    faqs: [
      ['What is the best area for hotels in Athens, Greece?', 'Plaka is the easiest classic first-trip area, while Monastiraki and Syntagma are stronger for movement and Koukaki is better for quieter Acropolis access.'],
      ['Are Athens hotels expensive?', 'The tracked dataset ranges from budget signals under €80/night to luxury signals above €250/night. Live prices change by date, taxes, and room type.'],
      ['Should I stay in central Athens or Piraeus?', 'Stay central for sightseeing. Choose Piraeus mainly when ferry timing is the priority.']
    ]
  },
  {
    slug: 'best-area-to-stay-in-athens',
    label: 'Best Area to Stay',
    kicker: 'Area guide',
    title: 'Best Area to Stay in Athens by Trip Type',
    h1: 'Best Area to Stay in Athens',
    hero: 'Match your Athens base to the trip: first visit, Acropolis walks, nightlife, ferry transfer, luxury shopping, or lower-price stay.',
    quickH2: 'Plaka is the simplest default for first-timers; Monastiraki is better for energy; Syntagma is better for transport; Koukaki is better for quieter value.',
    quickP: 'There is no single best area for every traveler. The best area is the one that removes friction from your trip: walking, metro, evening plans, ferry timing, or budget.',
    description: 'Compare the best area to stay in Athens by trip type, neighborhood feel, Acropolis access, price signal, and hotel options.',
    caption: 'Hotels in the strongest Athens areas for first-time and decision-driven stays.',
    filter: h => ['plaka', 'monastiraki', 'syntagma', 'koukaki', 'psyrri', 'kolonaki', 'piraeus'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels).slice(0, 14),
    notes: [
      ['First trip', 'Choose Plaka if you want the old city to do most of the work for you. It is the simplest area to understand quickly.'],
      ['Transit-heavy trip', 'Choose Syntagma or Monastiraki when airport, metro, port transfer, or day-trip movement matters.'],
      ['Late nights or local feel', 'Choose Psyrri or Monastiraki for nights out; choose Koukaki or Kolonaki when calmer evenings matter more.']
    ],
    faqs: [
      ['What is the best area to stay in Athens for first-timers?', 'Plaka is the easiest first-timer base because it keeps the historic core and Acropolis context close.'],
      ['Is Monastiraki or Plaka better?', 'Choose Plaka for classic atmosphere and Monastiraki for markets, metro, nightlife, and rooftop energy.'],
      ['Is Piraeus a good area to stay in Athens?', 'Piraeus is useful for ferries, but it is not the best base for classic Athens sightseeing.']
    ]
  },
  {
    slug: 'best-neighborhood-to-stay-in-athens',
    label: 'Best Neighborhood',
    kicker: 'Neighborhoods',
    title: 'Best Neighborhood to Stay in Athens',
    h1: 'Best Neighborhood to Stay in Athens',
    hero: 'Compare Athens neighborhoods with hotel data, not just vibes: price signals, walk times, view flags, rooftop flags, and traveler fit.',
    quickH2: 'The best neighborhood depends on what you want close at 9 a.m. and what you want outside the hotel at 9 p.m.',
    quickP: 'Use Plaka for historic simplicity, Monastiraki for all-day energy, Syntagma for logistics, Koukaki for a calmer Acropolis-side base, Kolonaki for polished cafes, and Psyrri for nightlife.',
    description: 'Find the best neighborhood to stay in Athens with area-by-area hotel comparisons, price signals, and trip-fit notes.',
    caption: 'Athens neighborhoods compared through representative hotel options.',
    filter: h => ['plaka', 'monastiraki', 'syntagma', 'koukaki', 'kolonaki', 'psyrri', 'exarchia', 'piraeus'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels).slice(0, 14),
    notes: [
      ['Best classic neighborhood', 'Plaka has the strongest old-Athens signal and works well when you do not want to overthink location.'],
      ['Best connected neighborhood', 'Syntagma is the practical answer when metro access, shopping, and central city logistics matter.'],
      ['Best value neighborhood', 'Koukaki and Exarchia are worth comparing when the hotel budget matters more than polished tourist frontage.']
    ],
    faqs: [
      ['Which Athens neighborhood should I avoid for a first trip?', 'Avoid choosing only by low price. A cheap stay far from your plans can cost more in transfers and friction.'],
      ['What neighborhood is closest to the Acropolis?', 'Plaka and Koukaki are the closest areas in this dataset, with Monastiraki also strong for central access.'],
      ['Which Athens neighborhood is best for nightlife?', 'Psyrri and Monastiraki are the clearest nightlife-oriented neighborhoods in this guide.']
    ]
  },
  {
    slug: 'best-place-to-stay-in-athens',
    label: 'Best Place to Stay',
    kicker: 'Trip fit',
    title: 'Best Place to Stay in Athens: Area & Hotel Guide',
    h1: 'Best Place to Stay in Athens',
    hero: 'A practical answer for travelers who need one Athens base, not a giant undifferentiated hotel list.',
    quickH2: 'If you are stuck, choose Plaka for a first trip, Syntagma for transport, Monastiraki for energy, or Koukaki for quieter Acropolis value.',
    quickP: 'Those four bases cover most Athens hotel decisions. Add Kolonaki for luxury shopping, Psyrri for nightlife, and Piraeus only when ferry logistics beat sightseeing convenience.',
    description: 'Compare the best places to stay in Athens by neighborhood, hotel type, price signal, Acropolis access, and traveler fit.',
    caption: 'Athens hotel starting points for the most common stay decisions.',
    filter: h => ['plaka', 'syntagma', 'monastiraki', 'koukaki', 'kolonaki', 'psyrri', 'piraeus'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels).slice(0, 14),
    notes: [
      ['Need the simplest answer', 'Pick Plaka if the trip is mostly Acropolis, old streets, museums, and first-time Athens.'],
      ['Need movement', 'Pick Syntagma if airport, metro, taxis, shopping, and polished central logistics matter.'],
      ['Need atmosphere at night', 'Pick Monastiraki or Psyrri if evenings out are a major part of the trip.']
    ],
    faqs: [
      ['What is the best place to stay in Athens for two nights?', 'Plaka, Monastiraki, and Syntagma are the easiest short-stay bases because they reduce transit friction.'],
      ['Where should I stay in Athens before a ferry?', 'Choose Piraeus if the ferry is early. Otherwise stay central and plan the transfer carefully.'],
      ['Where should I stay in Athens for a quiet trip?', 'Koukaki and Kolonaki are better starting points than Monastiraki or Psyrri for quieter evenings.']
    ]
  },
  {
    slug: 'best-hotels-in-plaka-athens',
    label: 'Best Plaka Hotels',
    kicker: 'Plaka',
    title: 'Best Hotels in Plaka Athens',
    h1: 'Best Hotels in Plaka, Athens',
    hero: 'Compare Plaka hotels by old-city location, Acropolis-view signal, rooftop signal, price tier, and traveler fit.',
    quickH2: 'Plaka is the classic Athens hotel base, but the best Plaka hotel depends on whether you want luxury, value, a view, or a quieter small-hotel feel.',
    quickP: 'Use Electra Palace Athens for premium Plaka signals, AVA Hotel Athens for boutique-style fit, Plaka Hotel for value and location, and Central Athens Hotel or Philippos Hotel for practical central stays.',
    description: 'Compare the best hotels in Plaka Athens by price signal, Acropolis view, rooftop bar, star category, and traveler fit.',
    caption: 'Plaka hotels compared by visible Hotels of Athens data.',
    filter: h => h.neighborhood === 'plaka',
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Choose luxury', 'Electra Palace Athens has the strongest premium Plaka combination in the dataset: 5-star, pool, rooftop, and Acropolis-view signals.'],
      ['Choose value', 'Plaka Hotel carries a lower price signal while keeping the central Plaka location.'],
      ['Choose boutique feel', 'AVA Hotel Athens is the cleaner starting point when style and a smaller-hotel feel matter.']
    ],
    faqs: [
      ['Is Plaka the best area to stay in Athens?', 'Plaka is the best default for many first-timers because it is historic, central, and close to the Acropolis.'],
      ['Are Plaka hotels expensive?', 'They can be, but this dataset includes both luxury and lower price-signal Plaka options.'],
      ['Do Plaka hotels have Acropolis views?', 'Several tracked Plaka hotels have an Acropolis-view signal, but exact room views must be confirmed before booking.']
    ]
  },
  {
    slug: 'best-hotels-near-acropolis',
    label: 'Best Near Acropolis',
    kicker: 'Acropolis',
    title: 'Best Hotels Near the Acropolis Athens',
    h1: 'Best Hotels Near the Acropolis',
    hero: 'Compare the strongest Acropolis-adjacent hotel options by area, walking convenience, view signal, rooftop signal, and price.',
    quickH2: 'The best Acropolis hotel is not always the closest one. Compare Plaka for atmosphere, Koukaki for quieter access, Monastiraki for metro and views, and Syntagma for luxury logistics.',
    quickP: 'This page filters for the Athens areas that make Acropolis visits easiest, then separates view, rooftop, price, and neighborhood tradeoffs.',
    description: 'Compare the best hotels near the Acropolis by Athens area, price signal, view signal, rooftop bar, and traveler fit.',
    caption: 'Best-fit hotel options in Acropolis-adjacent Athens areas.',
    filter: h => ['plaka', 'koukaki', 'monastiraki', 'syntagma'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels).slice(0, 12),
    notes: [
      ['Closest feel', 'Plaka and Koukaki are the natural short-walk areas for Acropolis-focused trips.'],
      ['Best view tradeoff', 'Monastiraki often makes sense when rooftop and Acropolis-view signals matter as much as distance.'],
      ['Best luxury tradeoff', 'Syntagma is slightly less old-city atmospheric but stronger for classic luxury and transport.']
    ],
    faqs: [
      ['What area should I stay in to be near the Acropolis?', 'Start with Plaka and Koukaki, then compare Monastiraki and Syntagma depending on views, transit, and budget.'],
      ['Is it better to stay in Plaka or Koukaki near the Acropolis?', 'Choose Plaka for old-city atmosphere and Koukaki for a quieter, more residential feel.'],
      ['Do the best hotels near the Acropolis all have views?', 'No. A hotel can be close without a good view, and a rooftop can have a view even if standard rooms do not.']
    ]
  },
  {
    slug: 'best-luxury-hotels-in-athens',
    label: 'Best Luxury Hotels',
    kicker: 'Luxury',
    title: 'Best Luxury Hotels in Athens',
    h1: 'Best Luxury Hotels in Athens',
    hero: 'Compare premium Athens hotels by area, star category, price signal, Acropolis view, rooftop bar, pool, and traveler fit.',
    quickH2: 'For classic luxury, start with Syntagma. For historic luxury, compare Plaka. For polished neighborhood luxury, compare Kolonaki.',
    quickP: 'This guide uses visible hotel signals, not unsupported awards. It is strongest for deciding which luxury lane fits the trip before comparing live rates.',
    description: 'Compare the best luxury hotels in Athens by area, star category, price signal, Acropolis view, rooftop bar, amenities, and fit.',
    caption: 'Luxury and high-price Athens hotels compared by visible criteria.',
    filter: h => h.pricePerNight >= 200 || h.starRating >= 5,
    sort: hotels => [...hotels].sort((a, b) => b.starRating - a.starRating || b.pricePerNight - a.pricePerNight),
    notes: [
      ['Classic landmark luxury', 'Hotel Grande Bretagne, King George Athens, and NJV Athens Plaza anchor Syntagma luxury in this dataset.'],
      ['Historic luxury', 'Electra Palace Athens is the premium Plaka starting point when Acropolis access and old-city atmosphere matter.'],
      ['Quiet polish', 'St. George Lycabettus and Periscope Hotel make Kolonaki worth comparing for a less touristy luxury base.']
    ],
    faqs: [
      ['What is the best luxury area in Athens?', 'Syntagma has the strongest classic luxury cluster, while Plaka and Kolonaki suit different premium trip styles.'],
      ['Are luxury hotels in Athens near the Acropolis?', 'Some are, especially in Plaka and Syntagma, but Kolonaki and Riviera-style stays can trade proximity for setting.'],
      ['Should I choose a 5-star or boutique luxury hotel?', 'Choose 5-star for service infrastructure and amenities; choose boutique luxury for scale, design, and neighborhood feel.']
    ]
  },
  {
    slug: 'best-budget-hotels-in-athens',
    label: 'Best Budget Hotels',
    kicker: 'Budget',
    title: 'Best Budget Hotels in Athens',
    h1: 'Best Budget Hotels in Athens',
    hero: 'Compare lower-price Athens hotels by area tradeoff, traveler fit, Acropolis access, and what to verify before booking.',
    quickH2: 'The best budget choice is the cheapest hotel that still fits your route: Exarchia for low price, Koukaki for calmer Acropolis access, Monastiraki for central energy, Piraeus for ferries.',
    quickP: 'This guide keeps the tradeoffs visible. Low price can mean simpler rooms, fewer amenities, a busier area, or a port-first location.',
    description: 'Compare the best budget hotels in Athens by nightly price signal, area, star category, Acropolis access, and traveler fit.',
    caption: 'Budget and low-price-signal Athens hotels compared by fit and area.',
    filter: h => h.pricePerNight < 100,
    sort: hotels => [...hotels].sort((a, b) => a.pricePerNight - b.pricePerNight),
    notes: [
      ['Lowest price first', 'Athens Backpackers, City Circus Athens, Orion Hotel, Marble House, and Exarchion Hotel show the lowest stored price signals.'],
      ['Best central value', 'Monastiraki and Koukaki are better than Piraeus if sightseeing is the main reason for the trip.'],
      ['Best ferry value', 'Piraeus makes sense when an early ferry would otherwise require a stressful transfer.']
    ],
    faqs: [
      ['What is the best cheap area to stay in Athens?', 'Exarchia, Koukaki, Monastiraki, and Piraeus are the strongest low-price areas in the current dataset.'],
      ['Can budget hotels in Athens be central?', 'Yes. Monastiraki, Koukaki, Syntagma, and Plaka all have at least some lower price-signal options.'],
      ['Are budget hotels near the Acropolis worth it?', 'They can be, but confirm the exact location, room type, bathroom setup, and cancellation terms before booking.']
    ]
  },
  {
    slug: 'best-family-hotels-in-athens',
    label: 'Family Hotels',
    kicker: 'Families',
    title: 'Best Family Hotels in Athens',
    h1: 'Best Family Hotels in Athens',
    hero: 'Compare Athens hotel areas for families by walking friction, quieter streets, room-value signals, pools, and easy sightseeing.',
    quickH2: 'Families should usually start with Plaka, Koukaki, Syntagma, or Kolonaki, then verify room size, breakfast, elevator access, and transfer logistics.',
    quickP: 'The site does not invent family amenities. It uses visible hotel and area signals, then points out the practical checks families should confirm before booking.',
    description: 'Compare family-friendly Athens hotel starting points by area, price signal, pool signal, Acropolis access, and practical booking checks.',
    caption: 'Athens hotels that make practical sense for family-trip shortlists.',
    filter: h => ['plaka', 'koukaki', 'syntagma', 'kolonaki', 'monastiraki'].includes(h.neighborhood) && (h.starRating >= 3 || (h.amenities || []).some(a => /pool|breakfast|restaurant/i.test(a))),
    sort: hotels => sortByScore(hotels).slice(0, 12),
    notes: [
      ['Best easy sightseeing', 'Plaka keeps the Acropolis and old-city walks simple, which can matter more than shaving a few euros off the rate.'],
      ['Best calmer base', 'Koukaki and Kolonaki are better starting points when late-night noise is a concern.'],
      ['Best logistics', 'Syntagma is useful when airport transfers, taxis, metro, and shopping errands matter.']
    ],
    faqs: [
      ['What is the best Athens area for families?', 'Plaka is the easiest sightseeing base; Koukaki and Kolonaki can be calmer; Syntagma is strong for transport logistics.'],
      ['Should families stay near the Acropolis?', 'Usually yes for a first trip, because shorter walks and fewer transfers make the days easier.'],
      ['What should families confirm before booking in Athens?', 'Confirm room capacity, bed setup, elevator access, breakfast timing, cancellation rules, and the exact walking route.']
    ]
  },
  {
    slug: 'best-hotels-in-athens-with-pool',
    label: 'Best Pool Hotels',
    kicker: 'Pools',
    title: 'Best Hotels in Athens with Pool',
    h1: 'Best Hotels in Athens with a Pool',
    hero: 'Compare Athens pool hotels by area, price signal, rooftop/view overlap, and what kind of pool access to confirm.',
    quickH2: 'Pool hotels in central Athens skew premium, so compare the pool type before comparing the rate.',
    quickP: 'A rooftop pool, spa pool, seasonal outdoor pool, and pool-day-pass situation are different decisions. This page only uses hotels with pool signals in the dataset.',
    description: 'Compare the best hotels in Athens with a pool by area, price signal, rooftop or Acropolis-view signal, and practical booking checks.',
    caption: 'Athens hotels with pool signals compared by area and booking fit.',
    filter: h => (h.amenities || []).some(a => /pool/i.test(a)),
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Best view overlap', 'Electra Palace Athens and St. George Lycabettus are useful starting points when pool, premium stay, and view context all matter.'],
      ['Best central luxury overlap', 'Syntagma and Plaka are stronger than outer areas if sightseeing still matters.'],
      ['Confirm the details', 'Pool season, guest access, hours, renovation closures, and whether children can use the pool can all change.']
    ],
    faqs: [
      ['Do many Athens hotels have pools?', 'No. In this dataset, pool signals are concentrated in a smaller premium set.'],
      ['Are Athens pool hotels expensive?', 'They often skew upscale or luxury, though live rates vary by date.'],
      ['Is a rooftop pool the same as a hotel pool?', 'No. Confirm whether the pool is rooftop, indoor, outdoor, seasonal, spa-only, or guest-only.']
    ]
  },
  {
    slug: 'piraeus-port-hotels',
    label: 'Piraeus Port Hotels',
    kicker: 'Ferry port',
    title: 'Piraeus Port Hotels: Compare Ferry Stays',
    h1: 'Piraeus Port Hotels',
    hero: 'Compare Piraeus hotels for early ferries, late arrivals, port access, and the tradeoff against staying in central Athens.',
    quickH2: 'Book Piraeus when ferry timing is the risk. Book central Athens when sightseeing is the point.',
    quickP: 'Piraeus is practical, not romanticized here. It earns its place when a hotel near the port prevents a stressful early transfer or late-night cross-city ride.',
    description: 'Compare Piraeus Port hotels by ferry convenience, price signal, traveler fit, and when to choose central Athens instead.',
    caption: 'Tracked Piraeus hotel options for port and ferry trips.',
    filter: h => h.neighborhood === 'piraeus',
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Choose Piraeus if', 'Your ferry leaves early, arrives late, or luggage makes a morning transfer from central Athens annoying.'],
      ['Choose central Athens if', 'You have a normal sightseeing day before the ferry and do not need to sleep by the port.'],
      ['Confirm the terminal', 'Piraeus has multiple gates. A hotel can be near the port but not equally close to your exact ferry gate.']
    ],
    faqs: [
      ['Is it worth staying in Piraeus before a ferry?', 'Yes if the ferry time is early or stressful. Otherwise central Athens is better for sightseeing.'],
      ['Are Piraeus Port hotels cheaper than central Athens?', 'Some Piraeus options have lower price signals, but the value depends on ferry timing and transfer costs.'],
      ['What should I check before booking a Piraeus hotel?', 'Check the ferry gate, transfer time, breakfast hours, taxi availability, and whether the hotel suits late arrivals.']
    ]
  },
  {
    slug: 'athens-hotels-near-ferry-port',
    label: 'Near Ferry Port',
    kicker: 'Ferries',
    title: 'Athens Hotels Near the Ferry Port',
    h1: 'Athens Hotels Near the Ferry Port',
    hero: 'Decide whether to stay by Piraeus ferry port or keep a central Athens base and transfer on departure day.',
    quickH2: 'For the ferry port, Piraeus is the practical base; Syntagma and Monastiraki are the central alternatives when sightseeing still matters.',
    quickP: 'The right answer depends on departure time, luggage, ferry gate, and whether Athens sightseeing is part of the same stay.',
    description: 'Compare Athens hotels near the ferry port with Piraeus options and central alternatives for island departures.',
    caption: 'Piraeus and central Athens hotel options for ferry-focused trips.',
    filter: h => ['piraeus', 'syntagma', 'monastiraki'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Sleep in Piraeus', 'Choose this when the ferry leaves early or arrives late and your main goal is reducing transfer risk.'],
      ['Sleep central', 'Choose Syntagma or Monastiraki when you want Athens restaurants, sights, and metro access before the ferry.'],
      ['Do the gate math', 'Piraeus gate location matters. Confirm the exact gate and travel time instead of assuming every port hotel is equally convenient.']
    ],
    faqs: [
      ['What is the best Athens area near the ferry port?', 'Piraeus is the ferry-port area. Syntagma and Monastiraki are better if you want central Athens before transferring.'],
      ['Can I stay in Athens city centre before a ferry?', 'Yes, but plan the transfer around ferry time, luggage, strikes, and the exact departure gate.'],
      ['Are hotels near Piraeus ferry port good for sightseeing?', 'They are less convenient for classic Athens sightseeing than Plaka, Syntagma, or Monastiraki.']
    ]
  },
  {
    slug: 'hotels-near-syntagma-square-athens',
    label: 'Near Syntagma Square',
    kicker: 'Syntagma',
    title: 'Hotels Near Syntagma Square Athens',
    h1: 'Hotels Near Syntagma Square Athens',
    hero: 'Compare hotels around Syntagma for Parliament access, airport movement, metro connections, shopping, and classic luxury.',
    quickH2: 'Syntagma is the cleanest Athens base when transport and central logistics matter more than old-city atmosphere.',
    quickP: 'Use Syntagma for airport metro access, luxury hotels, shopping, taxis, and easy movement. Compare Plaka if atmosphere matters more than logistics.',
    description: 'Compare hotels near Syntagma Square Athens by price signal, star category, Acropolis view, rooftop bar, and traveler fit.',
    caption: 'Syntagma-area hotels compared by visible hotel signals.',
    filter: h => h.neighborhood === 'syntagma',
    sort: hotels => sortByScore(hotels),
    notes: [
      ['Best for classic luxury', 'Hotel Grande Bretagne and King George Athens anchor the high-end Syntagma set.'],
      ['Best for value', 'Arethusa Hotel is the lower price-signal Syntagma option in the dataset.'],
      ['Best for movement', 'Choose Syntagma when airport, metro, taxis, and shopping errands matter.']
    ],
    faqs: [
      ['Is Syntagma Square a good place to stay?', 'Yes. It is one of the most practical central Athens bases, especially for transport and luxury hotels.'],
      ['Is Syntagma better than Plaka?', 'Choose Syntagma for logistics and Plaka for historic atmosphere.'],
      ['Are hotels near Syntagma Square expensive?', 'Many are upscale or luxury, but the dataset includes a lower price-signal option too.']
    ]
  },
  {
    slug: 'affordable-hotels-in-athens-greece',
    label: 'Affordable Hotels',
    kicker: 'Value',
    title: 'Affordable Hotels in Athens Greece',
    h1: 'Affordable Hotels in Athens, Greece',
    hero: 'Compare Athens hotels that keep the nightly signal lower without forcing you into a bad area fit.',
    quickH2: 'Affordable Athens is about tradeoffs: price, walking route, room simplicity, ferry access, and how much centrality you need.',
    quickP: 'This page sits between cheap and budget. It includes lower-price and mid-range signals that can still work for a practical Athens stay.',
    description: 'Compare affordable hotels in Athens, Greece by area, price signal, Acropolis access, and booking tradeoffs.',
    caption: 'Affordable Athens hotels with lower or mid-range price signals.',
    filter: h => h.pricePerNight <= 120,
    sort: hotels => [...hotels].sort((a, b) => a.pricePerNight - b.pricePerNight).slice(0, 16),
    limit: 16,
    notes: [
      ['Best central value', 'Monastiraki, Koukaki, and parts of Syntagma are useful when you want a lower price without giving up central access.'],
      ['Best lowest-cost cluster', 'Exarchia has several of the lowest price signals in the dataset.'],
      ['Best ferry value', 'Piraeus can be good value when a port stay replaces an awkward transfer.']
    ],
    faqs: [
      ['What is an affordable hotel in Athens on this site?', 'This guide focuses on tracked hotels around €120/night or less, using stored price signals rather than live quotes.'],
      ['Can affordable Athens hotels be near the Acropolis?', 'Yes. Koukaki, Monastiraki, and some Plaka options can keep Acropolis access reasonable.'],
      ['What should I check on a cheaper Athens hotel?', 'Check room type, bathroom setup, cancellation terms, noise, taxes, and the exact walking route.']
    ]
  },
  {
    slug: 'where-to-stay-in-athens-for-first-timers',
    label: 'First-Timers',
    kicker: 'First trip',
    title: 'Where to Stay in Athens for First-Timers',
    h1: 'Where to Stay in Athens for First-Timers',
    hero: 'Choose an Athens base that makes the first trip easy: short walks, simple landmarks, safe-feeling routines, and fewer transit decisions.',
    quickH2: 'First-timers should start with Plaka, Monastiraki, Syntagma, or Koukaki.',
    quickP: 'Plaka is the easiest default, Monastiraki adds energy and metro, Syntagma simplifies movement, and Koukaki gives a calmer Acropolis-side stay.',
    description: 'Compare where to stay in Athens for first-timers by neighborhood, Acropolis access, transport, hotel price signal, and trip fit.',
    caption: 'First-timer-friendly Athens hotels and areas.',
    filter: h => ['plaka', 'monastiraki', 'syntagma', 'koukaki'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels).slice(0, 12),
    notes: [
      ['Most classic', 'Plaka keeps the first day simple because the streets, sights, and tourist infrastructure are close together.'],
      ['Most connected', 'Syntagma is better if your first trip includes airport movement, taxis, metro rides, or shopping stops.'],
      ['Best calmer first trip', 'Koukaki works when you want Acropolis access without being in the busiest old-city lanes.']
    ],
    faqs: [
      ['Where should first-timers stay in Athens?', 'Plaka is the simplest answer, with Monastiraki, Syntagma, and Koukaki as strong alternatives.'],
      ['Is Plaka too touristy?', 'It can be touristy, but that convenience is often useful on a first Athens trip.'],
      ['How many nights should first-timers stay in Athens?', 'Two to three nights is enough for many first visits, but the right length depends on museums, food plans, and island transfers.']
    ]
  },
  {
    slug: 'safe-areas-to-stay-in-athens',
    label: 'Safer-Feeling Areas',
    kicker: 'Safety',
    title: 'Safe Areas to Stay in Athens: Practical Hotel Base Guide',
    h1: 'Safe Areas to Stay in Athens',
    hero: 'A practical, non-alarmist guide to choosing an Athens hotel base when comfort, lighting, transit, and route simplicity matter.',
    quickH2: 'No hotel guide can guarantee safety, but Plaka, Syntagma, Koukaki, and Kolonaki are sensible starting points for easier-feeling routines.',
    quickP: 'Think in terms of route friction: how late you arrive, whether streets are busy or quiet, how far you walk, and whether you know the exact way back to the hotel.',
    description: 'Compare safer-feeling areas to stay in Athens with practical hotel-base notes, route caveats, and neighborhood tradeoffs.',
    caption: 'Athens hotel areas that are practical starting points for comfort-focused stays.',
    filter: h => ['plaka', 'syntagma', 'koukaki', 'kolonaki'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels).slice(0, 12),
    notes: [
      ['Comfort-first base', 'Plaka and Syntagma are practical because they are central, familiar to visitors, and easier to navigate on a short stay.'],
      ['Calmer-feeling base', 'Koukaki and Kolonaki can suit travelers who prefer less nightlife outside the hotel.'],
      ['Important caveat', 'Conditions vary block by block and time of night. Confirm recent local advice, arrival route, and transport plan before booking.']
    ],
    faqs: [
      ['What is the safest area to stay in Athens?', 'No area can be guaranteed safe, but Plaka, Syntagma, Koukaki, and Kolonaki are practical starting points for many comfort-focused travelers.'],
      ['Is Monastiraki safe to stay in?', 'Many travelers stay there, but it is busier and more nightlife-oriented than Plaka or Koukaki. Choose based on your comfort with crowds and late-night streets.'],
      ['What should I do before booking for comfort?', 'Check the exact street, arrival time, walking route, nearby metro/taxi options, and recent traveler feedback.']
    ]
  },
  {
    slug: 'where-to-stay-in-athens-solo-female',
    label: 'Solo Travelers',
    kicker: 'Solo',
    title: 'Where to Stay in Athens Solo Female Traveler Guide',
    h1: 'Where to Stay in Athens as a Solo Female Traveler',
    hero: 'A practical hotel-base guide focused on route simplicity, central areas, quieter evenings, and what to verify before booking.',
    quickH2: 'For many solo travelers, Plaka, Syntagma, Koukaki, and Kolonaki are easier starting points than nightlife-first areas.',
    quickP: 'This is not a safety guarantee. It is a friction-reduction guide: choose a hotel with a simple return route, useful transit, clear reception access, and an area feel that matches your evenings.',
    description: 'Compare where to stay in Athens as a solo female traveler with practical area notes, hotel signals, and booking checks.',
    caption: 'Athens hotel areas that reduce friction for many solo travelers.',
    filter: h => ['plaka', 'syntagma', 'koukaki', 'kolonaki', 'monastiraki'].includes(h.neighborhood),
    sort: hotels => sortByScore(hotels).slice(0, 12),
    notes: [
      ['Simplest first base', 'Plaka and Syntagma are easier to navigate for a short solo stay because central routines are straightforward.'],
      ['Quieter evenings', 'Koukaki and Kolonaki can be better if you do not want a nightlife-heavy street outside the hotel.'],
      ['Before booking', 'Check 24-hour reception, late-arrival process, exact street, taxi drop-off, and the route from metro or restaurant areas.']
    ],
    faqs: [
      ['Where should a solo female traveler stay in Athens?', 'Plaka, Syntagma, Koukaki, and Kolonaki are practical starting points, depending on budget and evening style.'],
      ['Is Psyrri good for solo travelers?', 'It can work for nightlife-oriented travelers, but those wanting quieter evenings may prefer Koukaki, Kolonaki, Plaka, or Syntagma.'],
      ['What hotel details matter most for solo travelers?', 'Reception access, late check-in, clear taxi drop-off, elevator access, street lighting, and the exact walk back at night matter more than generic area labels.']
    ]
  }
];

// Helper: Generate hotel card HTML
function generateHotelCard(hotel) {
  const badges = [];
  if (hotel.hasAcropolisView) badges.push('<span class="badge badge-view">Acropolis View</span>');
  if (hotel.hasRooftopBar) badges.push('<span class="badge badge-rooftop">Rooftop Bar</span>');
  
  return `
    <a href="/hotel/${hotel.slug}" class="hotel-card" data-tier="${getPriceTier(hotel.pricePerNight)}" data-view="${hotel.hasAcropolisView}">
      <div class="hotel-card-image hotel-card-image-${escapeHtml(hotel.neighborhood)}" aria-hidden="true"></div>
      <div class="hotel-card-content">
        <h3>${hotel.name}</h3>
        <div class="hotel-card-meta">
          <span>${generateStars(hotel.starRating)}</span>
          <span>•</span>
          <span>${hotel.neighborhoodName || hotel.neighborhood}</span>
        </div>
        <div class="hotel-card-badges">${badges.join('')}</div>
        <div class="hotel-card-price">
          <span class="from">from</span>
          <span class="price">€${hotel.pricePerNight}</span>
          <span class="per">/night</span>
        </div>
      </div>
    </a>
  `;
}

// Helper: Generate neighborhood card HTML
function generateNeighborhoodCard(hood) {
  return `
    <a href="/athens-hotels/${hood.id}" class="neighborhood-card">
      <span class="emoji">${hood.emoji}</span>
      <h3>${hood.name}</h3>
      <p class="price">from €${hood.avgPrice}/night</p>
      <p class="walk">${hood.walkToAcropolis} to Acropolis</p>
    </a>
  `;
}

// Generate Homepage
function generateHomepage() {
  console.log('📄 Generating homepage...');
  
  const neighborhoodsGrid = neighborhoodsData.neighborhoods
    .map(generateNeighborhoodCard)
    .join('');
  
  const siteHotels = uniqueHotels(allHotelsData.hotels);

  const acropolisViewHotels = siteHotels
    .filter(h => h.hasAcropolisView)
    .slice(0, 6)
    .map(generateHotelCard)
    .join('');
  
  const rooftopHotels = siteHotels
    .filter(h => h.hasRooftopBar && h.rooftopRating >= 4)
    .slice(0, 6)
    .map(generateHotelCard)
    .join('');
  
  let content = homeTemplate
    .replace(/\{\{TOTAL_HOTELS\}\}/g, allHotelsData.totalHotels)
    .replace('{{AVG_PRICE}}', allHotelsData.avgPrice)
    .replace('{{BUDGET_COUNT}}', allHotelsData.priceStats.budget.count)
    .replace('{{MID_COUNT}}', allHotelsData.priceStats.midRange.count)
    .replace('{{UPSCALE_COUNT}}', allHotelsData.priceStats.upscale.count)
    .replace('{{LUXURY_COUNT}}', allHotelsData.priceStats.luxury.count)
    .replace('{{NEIGHBORHOOD_MATRIX}}', renderNeighborhoodMatrix())
    .replace('{{POPULAR_GUIDES}}', renderGuideLinks([ultraLuxuryGuide, ...intentGuides]))
    .replace('{{NEIGHBORHOODS_GRID}}', neighborhoodsGrid)
    .replace('{{ACROPOLIS_VIEW_HOTELS}}', acropolisViewHotels)
    .replace('{{ROOFTOP_HOTELS}}', rooftopHotels);
  
  const title = 'Athens Hotels by Area & Budget';
  const description = `Compare ${allHotelsData.totalHotels} Athens hotels by neighborhood, nightly price signal, Acropolis view, rooftop bar, and traveler fit.`;
  const url = `${siteUrl}/`;

  const html = wrapInLayout(
    content,
    title,
    description,
    url,
    {
      schema: [
        pageSchema('CollectionPage', title, description, url),
        itemListSchema('Featured Athens hotels', chooseTopHotels(siteHotels, 10), url)
      ]
    }
  );
  
  fs.writeFileSync(path.join(distDir, 'index.html'), html);
}

// Generate Neighborhood Pages
function generateNeighborhoodPages() {
  console.log('📄 Generating neighborhood pages...');
  
  for (const hood of neighborhoodsData.neighborhoods) {
    const hoodData = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'hotels', `${hood.id}.json`), 'utf8')
    );
    
    const hoodHotels = hotelsForNeighborhood(hood.id);
    const hotelsGrid = hoodHotels
      .map(generateHotelCard)
      .join('');

    const fitHotels = chooseTopHotels(hoodHotels, Math.min(hoodHotels.length, 6));
    const fitTable = renderHotelComparisonTable(
      fitHotels,
      `${hood.name} hotels compared by price, traveler fit, Acropolis-view signal, and rooftop-bar signal.`
    );
    
    const vibeTags = hood.vibe
      .map(v => `<span class="vibe-tag">${v}</span>`)
      .join('');
    
    // Get nearby neighborhoods (exclude current)
    const nearby = neighborhoodsData.neighborhoods
      .filter(n => n.id !== hood.id)
      .slice(0, 4)
      .map(generateNeighborhoodCard)
      .join('');
    
    // FAQ content
    const cheapest = [...hoodHotels].sort((a, b) => a.pricePerNight - b.pricePerNight)[0];
    const viewCount = hoodHotels.filter(h => h.hasAcropolisView).length;
    const rooftopCount = hoodHotels.filter(h => h.hasRooftopBar).length;
    const quickAnswer = `${hood.name} is a ${hood.tagline.toLowerCase()} area with ${hoodHotels.length} tracked hotels averaging about €${hood.avgPrice}/night. In this dataset, ${viewCount} hotel${viewCount === 1 ? '' : 's'} show an Acropolis-view signal and ${rooftopCount} hotel${rooftopCount === 1 ? '' : 's'} show a rooftop-bar signal. The lowest tracked nightly price signal is ${cheapest ? `€${cheapest.pricePerNight} at ${cheapest.name}` : `around €${hood.avgPrice}`}.`;
    const faqGoodArea = `Yes. ${hood.name} is ${hood.description.split('.')[0].toLowerCase()}. It is especially useful for ${hood.bestFor.join(', ').toLowerCase()}.`;
    const faqDistance = `${hood.name} is listed as ${hood.walkToAcropolis} from the Acropolis in the Hotels of Athens neighborhood data. Exact walking time depends on the individual hotel address and entrance used.`;
    const faqPrice = `Tracked hotels in ${hood.name} average around €${hood.avgPrice} per night, with the visible dataset spanning ${hoodHotels.length} options. Confirm live rates before booking.`;
    const faqs = [
      { question: `Is ${hood.name} a good area to stay in Athens?`, answer: faqGoodArea },
      { question: `How far is ${hood.name} from the Acropolis?`, answer: `${hood.name} is ${hood.walkToAcropolis} walk from the Acropolis. ${faqDistance}` },
      { question: `What's the average hotel price in ${hood.name}?`, answer: `Hotels in ${hood.name} average around €${hood.avgPrice} per night. ${faqPrice}` }
    ];
    
    let content = neighborhoodTemplate
      .replace(/\{\{NAME\}\}/g, hood.name)
      .replace(/\{\{EMOJI\}\}/g, hood.emoji)
      .replace(/\{\{TAGLINE\}\}/g, hood.tagline)
      .replace(/\{\{DESCRIPTION\}\}/g, hood.description)
      .replace(/\{\{HOTEL_COUNT\}\}/g, hoodHotels.length)
      .replace(/\{\{AVG_PRICE\}\}/g, hood.avgPrice)
      .replace(/\{\{WALK_TIME\}\}/g, hood.walkToAcropolis)
      .replace('{{VIBE_TAGS}}', vibeTags)
      .replace(/\{\{BEST_FOR\}\}/g, hood.bestFor.join(', '))
      .replace('{{HOTELS_GRID}}', hotelsGrid)
      .replace('{{NEARBY_NEIGHBORHOODS}}', nearby)
      .replace('{{QUICK_ANSWER}}', quickAnswer)
      .replace('{{FIT_TABLE}}', fitTable)
      .replace('{{BEST_FOR_LOWER}}', hood.bestFor.join(', ').toLowerCase())
      .replace('{{FAQ_GOOD_AREA}}', faqGoodArea)
      .replace('{{FAQ_DISTANCE}}', faqDistance)
      .replace('{{FAQ_PRICE}}', faqPrice);

    const title = `Hotels in ${hood.name} Athens: Compare Stays`;
    const description = `Compare hotels in ${hood.name}, Athens by price, traveler fit, Acropolis-view signal, rooftop bar, and nearby alternatives. ${hoodHotels.length} tracked stays from about €${hood.avgPrice}/night.`;
    const url = `${siteUrl}/athens-hotels/${hood.id}`;
    
    const html = wrapInLayout(
      content,
      title,
      description,
      url,
      {
        schema: [
          pageSchema('CollectionPage', title, description, url),
          breadcrumbSchema([
            { name: 'Home', url: siteUrl },
            { name: 'Athens Hotels', url: `${siteUrl}/where-to-stay-in-athens` },
            { name: hood.name, url }
          ]),
          itemListSchema(`${hood.name} Athens hotels`, fitHotels, url),
          faqSchema(faqs)
        ]
      }
    );
    
    fs.writeFileSync(path.join(distDir, 'athens-hotels', `${hood.id}.html`), html);
  }
}

// Generate Hotel Pages
function generateHotelPages() {
  console.log('📄 Generating hotel pages...');
  
  for (const hotel of uniqueHotels(allHotelsData.hotels)) {
    const amenitiesHtml = (hotel.amenities || [])
      .map(a => `<span class="amenity">${a}</span>`)
      .join('');
    
    const prosHtml = (hotel.pros || ['Great location', 'Good value'])
      .map(p => `<li>${p}</li>`)
      .join('');
    
    const consHtml = (hotel.cons || ['Book early'])
      .map(c => `<li>${c}</li>`)
      .join('');
    
    const badges = [];
    if (hotel.hasAcropolisView) badges.push('<span class="hotel-badge">🏛️ Acropolis View</span>');
    if (hotel.hasRooftopBar) badges.push('<span class="hotel-badge">🍸 Rooftop Bar</span>');
    if (hotel.starRating >= 5) badges.push('<span class="hotel-badge">👑 Luxury</span>');
    
    const bestForTags = (hotel.bestFor || ['Travelers'])
      .map(b => `<span class="best-for-tag">${b}</span>`)
      .join('');

    const fitSummary = `${hotel.name} is a ${hotel.starRating}-star ${priceTierLabel(hotel.pricePerNight).toLowerCase()} price-signal hotel in ${hotel.neighborhoodName}, with ${hotel.hasAcropolisView ? 'an Acropolis-view signal' : 'no Acropolis-view signal in the current dataset'} and ${hotel.hasRooftopBar ? 'a rooftop-bar signal' : 'no rooftop-bar signal in the current dataset'}. It is tagged for ${(hotel.bestFor || ['travelers']).join(', ').toLowerCase()}.`;
    const rooftopLink = hotel.hasRooftopBar
      ? `Compare it with other <a href="/best-rooftop-bars-athens">Athens rooftop bar hotels</a>.`
      : `For rooftop stays, compare <a href="/best-rooftop-bars-athens">Athens rooftop bar hotels</a>.`;
    
    // Get similar hotels in same neighborhood
    const similarHotels = uniqueHotels(allHotelsData.hotels)
      .filter(h => h.neighborhood === hotel.neighborhood && h.id !== hotel.id)
      .slice(0, 3)
      .map(generateHotelCard)
      .join('');
    
    let content = hotelTemplate
      .replace(/\{\{NAME\}\}/g, hotel.name)
      .replace(/\{\{NEIGHBORHOOD_ID\}\}/g, hotel.neighborhood)
      .replace(/\{\{NEIGHBORHOOD_NAME\}\}/g, hotel.neighborhoodName || hotel.neighborhood)
      .replace('{{STARS}}', generateStars(hotel.starRating))
      .replace('{{STAR_RATING}}', hotel.starRating)
      .replace('{{BADGES}}', badges.join(''))
      .replace(/\{\{PRICE\}\}/g, hotel.pricePerNight)
      .replace('{{PRICE_MIN}}', Math.round(hotel.pricePerNight * 0.8))
      .replace('{{PRICE_MAX}}', Math.round(hotel.pricePerNight * 1.5))
      .replace('{{OVERVIEW}}', hotel.overview || `${hotel.name} is a ${hotel.starRating}-star hotel in ${hotel.neighborhoodName}, Athens.`)
      .replace('{{AMENITIES}}', amenitiesHtml)
      .replace('{{PROS}}', prosHtml)
      .replace('{{CONS}}', consHtml)
      .replace('{{LOCATION_DESC}}', `${hotel.distanceToAcropolis} walk to the Acropolis.`)
      .replace('{{DISTANCE_ACROPOLIS}}', hotel.distanceToAcropolis)
      .replace('{{DISTANCE_METRO}}', '5-10 min')
      .replace('{{HAS_VIEW}}', hotel.hasAcropolisView ? 'Yes ✓' : 'No')
      .replace('{{HAS_ROOFTOP}}', hotel.hasRooftopBar ? 'Yes ✓' : 'No')
      .replace('{{BEST_FOR_TAGS}}', bestForTags)
      .replace(/\{\{FIT_SUMMARY\}\}/g, fitSummary)
      .replace('{{ROOFTOP_LINK}}', rooftopLink)
      .replace('{{LAST_VERIFIED}}', hotel.lastVerified || lastUpdated)
      .replace('{{SIMILAR_HOTELS}}', similarHotels)
      .replace('{{BOOKING_URL}}', `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.name + ' Athens')}`);

    const title = `${hotel.name}: ${hotel.neighborhoodName} Hotel from €${hotel.pricePerNight}`;
    const description = `${hotel.name} is a ${hotel.starRating}-star hotel in ${hotel.neighborhoodName}, Athens with ${hotel.hasAcropolisView ? 'Acropolis-view' : 'neighborhood'} and ${hotel.hasRooftopBar ? 'rooftop-bar' : 'amenity'} signals. Compare fit, price, and nearby hotels.`;
    const url = `${siteUrl}/hotel/${hotel.slug}`;
    
    const html = wrapInLayout(
      content,
      title,
      description,
      url,
      {
        schema: [
          pageSchema('WebPage', title, description, url),
          breadcrumbSchema([
            { name: 'Home', url: siteUrl },
            { name: hotel.neighborhoodName, url: `${siteUrl}/athens-hotels/${hotel.neighborhood}` },
            { name: hotel.name, url }
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Hotel',
            name: hotel.name,
            url,
            starRating: {
              '@type': 'Rating',
              ratingValue: hotel.starRating
            },
            priceRange: `from €${hotel.pricePerNight}`,
            containedInPlace: {
              '@type': 'Place',
              name: `${hotel.neighborhoodName}, Athens`
            }
          }
        ]
      }
    );
    
    fs.writeFileSync(path.join(distDir, 'hotel', `${hotel.slug}.html`), html);
  }
}

// Generate Contact Page
function generateContactPage() {
  console.log('📄 Generating contact page...');
  
  const formspreeId = process.env.FORMSPREE_ID || 'xnjzokwn';
  
  const content = contactTemplate.replace('{{FORMSPREE_ID}}', formspreeId);
  
  const html = wrapInLayout(
    content,
    'Contact Us',
    'Questions about Athens hotels? Contact the Hotels of Athens team for personalized recommendations.',
    'https://hotelsofathens.com/contact'
  );
  
  fs.writeFileSync(path.join(distDir, 'contact.html'), html);
}

// Generate Thank You Page
function generateThankYouPage() {
  console.log('📄 Generating thank you page...');
  
  const html = wrapInLayout(
    thankYouTemplate,
    'Message Sent',
    'Thank you for contacting Hotels of Athens.',
    'https://hotelsofathens.com/thank-you'
  );
  
  fs.writeFileSync(path.join(distDir, 'thank-you.html'), html);
}

// Generate Guide Pages
function generateGuidePages() {
  console.log('📄 Generating guide pages...');

  const guideSchema = (title, description, url, hotels, faqs = []) => [
    pageSchema('CollectionPage', title, description, url),
    breadcrumbSchema([
      { name: 'Home', url: siteUrl },
      { name: title.replace(` (${currentYear})`, ''), url }
    ]),
    ...(hotels?.length ? [itemListSchema(title, hotels.slice(0, 12), url)] : []),
    ...(faqs.length ? [faqSchema(faqs)] : [])
  ];

  const siteHotels = uniqueHotels(allHotelsData.hotels);

  const neighborhoodHighlights = neighborhoodsData.neighborhoods.map(hood => {
    const hotels = siteHotels.filter(h => h.neighborhood === hood.id);
    const top = chooseTopHotels(hotels, 1)[0];
    return `
      <article class="area-panel">
        <div>
          <span class="area-emoji">${hood.emoji}</span>
          <h3><a href="/athens-hotels/${hood.id}">${hood.name}</a></h3>
          <p>${escapeHtml(hood.description)}</p>
        </div>
        <dl class="signal-list">
          <div><dt>Best for</dt><dd>${escapeHtml(hood.bestFor.join(', '))}</dd></div>
          <div><dt>Avg price</dt><dd>€${hood.avgPrice}/night</dd></div>
          <div><dt>Acropolis</dt><dd>${escapeHtml(hood.walkToAcropolis)}</dd></div>
          <div><dt>Starter pick</dt><dd>${top ? `<a href="${hotelUrl(top)}">${escapeHtml(top.name)}</a>` : 'See hotels'}</dd></div>
        </dl>
      </article>
    `;
  }).join('');

  // Where to Stay Guide
  const whereTitle = 'Where to Stay in Athens: Area Guide';
  const whereDescription = `Compare where to stay in Athens by neighborhood, budget, Acropolis access, nightlife, ferry transfers, and hotel fit. Includes ${allHotelsData.totalHotels} tracked hotels.`;
  const whereUrl = `${siteUrl}/where-to-stay-in-athens`;
  const whereFaqs = [
    {
      question: 'What is the best area to stay in Athens for first-timers?',
      answer: 'Plaka is the easiest first-timer base for historic atmosphere and short Acropolis access, while Monastiraki is better for markets and nightlife and Syntagma is better for transport connections.'
    },
    {
      question: 'Where should I stay in Athens for a ferry?',
      answer: 'Piraeus is the practical choice for early ferry departures. If you want central Athens first, choose Syntagma or Monastiraki and check the exact metro or taxi route before booking.'
    },
    {
      question: 'Which Athens neighborhoods are best for budget hotels?',
      answer: 'Exarchia, Koukaki, Piraeus, and parts of Monastiraki have the strongest budget signals in the Hotels of Athens dataset.'
    }
  ];
  const whereContent = `
    <section class="guide-hero">
      <div class="container">
        <nav class="breadcrumb"><a href="/">Home</a> → <span>Where to Stay in Athens</span></nav>
        <h1>Where to Stay in Athens</h1>
        <p>Compare Athens neighborhoods by traveler fit, price signal, Acropolis access, and the hotels tracked on this site.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>Choose Plaka for classic Athens, Monastiraki for energy, Syntagma for connections, and Koukaki for quieter value.</h2>
          <p>For most first trips, start with Plaka, Monastiraki, Syntagma, or Koukaki. Island hoppers should compare Piraeus, nightlife travelers should compare Psyrri and Monastiraki, and luxury travelers should compare Syntagma, Kolonaki, and Plaka.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Athens Areas Compared</h2>
        <p class="section-subtitle">This matrix uses the visible Hotels of Athens neighborhood and hotel data.</p>
        ${renderNeighborhoodMatrix()}
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">Neighborhood-by-Neighborhood Guide</h2>
        <div class="area-stack">${neighborhoodHighlights}</div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Best Area by Trip Type</h2>
        <div class="content-grid">
          <div class="info-panel"><h3>First-timers</h3><p><a href="/athens-hotels/plaka">Plaka</a> keeps the historic core close. <a href="/athens-hotels/monastiraki">Monastiraki</a> is a stronger pick if you want markets, metro, and nightlife.</p></div>
          <div class="info-panel"><h3>Luxury stays</h3><p><a href="/athens-hotels/syntagma">Syntagma</a>, <a href="/athens-hotels/kolonaki">Kolonaki</a>, and Plaka have the strongest upscale and luxury hotel signals in the dataset.</p></div>
          <div class="info-panel"><h3>Budget trips</h3><p><a href="/athens-hotels/exarchia">Exarchia</a>, <a href="/athens-hotels/koukaki">Koukaki</a>, Monastiraki, and <a href="/athens-hotels/piraeus">Piraeus</a> are the natural places to compare first.</p></div>
          <div class="info-panel"><h3>Rooftop views</h3><p>Compare <a href="/best-rooftop-bars-athens">Athens rooftop bar hotels</a> if sunset views and on-site rooftop dining matter more than neighborhood alone.</p></div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">FAQs: Where to Stay in Athens</h2>
        ${renderFaqDetails(whereFaqs)}
      </div>
    </section>
  `;

  fs.writeFileSync(
    path.join(distDir, 'where-to-stay-in-athens.html'),
    wrapInLayout(whereContent, whereTitle, whereDescription, whereUrl, {
      schema: guideSchema(whereTitle, whereDescription, whereUrl, siteHotels, whereFaqs)
    })
  );

  // Best Hotels Guide
  const bestHotels = chooseTopHotels(siteHotels, 14);
  const bestTitle = 'Best Hotels in Athens: Fit, Price & View';
  const bestDescription = `Compare the best Athens hotel starting points by criteria: neighborhood, price signal, star category, Acropolis view, rooftop bar, and traveler fit.`;
  const bestUrl = `${siteUrl}/best-hotels-athens`;
  const bestFaqs = [
    {
      question: 'How does Hotels of Athens choose top hotel picks?',
      answer: 'The guide uses visible site data including neighborhood, nightly price signal, star category, Acropolis-view flag, rooftop-bar flag, amenities, and traveler-fit tags. It does not use unsupported review scores.'
    },
    {
      question: 'What is the best Athens hotel area for Acropolis views?',
      answer: 'Plaka, Monastiraki, Syntagma, and Koukaki have the strongest Acropolis-view hotel signals in this dataset.'
    },
    {
      question: 'Should I book a luxury or boutique hotel in Athens?',
      answer: 'Choose luxury if you want larger service infrastructure and premium amenities; choose boutique if neighborhood character, design, and a smaller hotel feel matter more.'
    }
  ];
  const bestContent = `
    <section class="guide-hero">
      <div class="container">
        <nav class="breadcrumb"><a href="/">Home</a> → <span>Best Hotels in Athens</span></nav>
        <h1>Best Hotels in Athens</h1>
        <p>Criteria-based hotel picks using visible Hotels of Athens data, not unsupported ratings or copied listicles.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>Start with hotels that match your area, budget, and view priorities.</h2>
          <p>For luxury and landmark convenience, compare Hotel Grande Bretagne, King George Athens, and Electra Palace Athens. For rooftop views at a lower price signal, compare A for Athens, 360 Degrees Hotel, Herodion Hotel, and Plaka Hotel. For budget stays, compare Athens Backpackers, City Circus Athens, Marble House, Orion Hotel, and Attalos Hotel.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Top Athens Hotel Starting Points</h2>
        <p class="section-subtitle">Sorted by a transparent mix of visible star category, rooftop/view signals, traveler-fit tags, and price signal.</p>
        ${renderHotelComparisonTable(bestHotels, 'Criteria-based Athens hotel picks from the Hotels of Athens dataset.')}
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">Best Athens Hotels by Traveler Type</h2>
        <div class="content-grid">
          <div class="info-panel"><h3>Best for classic luxury</h3><p><a href="/hotel/hotel-grande-bretagne-athens">Hotel Grande Bretagne</a>, <a href="/hotel/king-george-athens-athens">King George Athens</a>, and <a href="/hotel/electra-palace-athens-athens">Electra Palace Athens</a> have the strongest luxury price/star signals.</p></div>
          <div class="info-panel"><h3>Best for rooftop views</h3><p><a href="/hotel/a-for-athens-athens">A for Athens</a>, <a href="/hotel/360-degrees-hotel-athens">360 Degrees Hotel</a>, and <a href="/hotel/herodion-hotel-athens">Herodion Hotel</a> combine rooftop and Acropolis-view signals.</p></div>
          <div class="info-panel"><h3>Best for budget</h3><p><a href="/hotel/athens-backpackers-athens">Athens Backpackers</a>, <a href="/hotel/city-circus-athens-athens">City Circus Athens</a>, and <a href="/hotel/marble-house-athens">Marble House</a> show the lowest nightly price signals.</p></div>
          <div class="info-panel"><h3>Best for location-first trips</h3><p>Compare <a href="/athens-hotels/plaka">Plaka</a>, <a href="/athens-hotels/monastiraki">Monastiraki</a>, and <a href="/athens-hotels/syntagma">Syntagma</a> when walking access and centrality matter most.</p></div>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Methodology</h2>
        <div class="methodology">
          <p>This page is a comparison guide, not a review-award list. Hotels are surfaced from the first-party dataset using visible criteria: neighborhood, price signal, star category, Acropolis-view flag, rooftop-bar flag, amenities, and traveler-fit tags. Live rates, room inventory, rooftop access, and policies can change, so confirm final details before booking.</p>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">FAQs: Best Hotels in Athens</h2>
        ${renderFaqDetails(bestFaqs)}
      </div>
    </section>
  `;

  fs.writeFileSync(
    path.join(distDir, 'best-hotels-athens.html'),
    wrapInLayout(bestContent, bestTitle, bestDescription, bestUrl, {
      schema: guideSchema(bestTitle, bestDescription, bestUrl, bestHotels, bestFaqs)
    })
  );

  // Budget Hotels Guide
  const budgetHotels = siteHotels
    .filter(h => h.pricePerNight < 80)
    .sort((a, b) => a.pricePerNight - b.pricePerNight);
  
  const budgetFaqs = [
    {
      question: 'What counts as a budget hotel in Athens on this site?',
      answer: 'Hotels of Athens labels hotels under €80/night as budget based on the visible nightly price signal stored in the dataset.'
    },
    {
      question: 'Which Athens neighborhoods have the most budget hotel signals?',
      answer: 'Exarchia has the most tracked budget options in this dataset, followed by Monastiraki, Koukaki, and Piraeus.'
    }
  ];
  const budgetTitle = 'Budget Hotels in Athens Under €80';
  const budgetDescription = `Compare budget hotels in Athens under €80/night by neighborhood, star category, traveler fit, and Acropolis or rooftop signals.`;
  const budgetUrl = `${siteUrl}/budget-hotels-athens`;
  const budgetContent = `
    <section class="guide-hero">
      <div class="container">
        <h1>Budget Hotels in Athens</h1>
        <p>Compare tracked Athens stays under €80/night by area, fit, and visible hotel features.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>The lowest price signals cluster in Exarchia, Monastiraki, Koukaki, and Piraeus.</h2>
          <p>Use this page when price is the first filter. For historic sightseeing, compare budget options in Monastiraki and Koukaki; for ferry logistics, compare Piraeus; for the lowest visible cluster, compare Exarchia.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Budget Hotel Comparison</h2>
        ${renderHotelComparisonTable(budgetHotels, 'Athens hotels under €80/night in the Hotels of Athens dataset.')}
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">Budget Booking Notes</h2>
        <div class="content-grid">
          <div class="info-panel"><h3>Check the exact location</h3><p>A lower rate can mean a longer walk, a busier nightlife area, or a port-first location. Compare the neighborhood page before booking.</p></div>
          <div class="info-panel"><h3>Compare cancellation terms</h3><p>The stored price signal is not a live quote. Confirm taxes, cancellation policy, and room type on the booking page.</p></div>
          <div class="info-panel"><h3>Watch view tradeoffs</h3><p>Budget hotels rarely combine low price, central location, and premium views. If the view matters, compare <a href="/best-rooftop-bars-athens">rooftop bar hotels</a>.</p></div>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">All Budget Picks</h2>
        <div class="hotels-grid">${budgetHotels.map(generateHotelCard).join('')}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">FAQs: Budget Hotels in Athens</h2>
        ${renderFaqDetails(budgetFaqs)}
      </div>
    </section>
  `;
  
  fs.writeFileSync(
    path.join(distDir, 'budget-hotels-athens.html'),
    wrapInLayout(budgetContent, budgetTitle, budgetDescription, budgetUrl, {
      schema: guideSchema(budgetTitle, budgetDescription, budgetUrl, budgetHotels, budgetFaqs)
    })
  );
  
  // Luxury Hotels Guide
  const luxuryHotels = siteHotels
    .filter(h => h.pricePerNight >= 200)
    .sort((a, b) => b.pricePerNight - a.pricePerNight);
  
  const luxuryFaqs = [
    {
      question: 'Which Athens neighborhoods are best for luxury hotels?',
      answer: 'Syntagma, Plaka, and Kolonaki have the strongest luxury hotel signals in the current Hotels of Athens dataset.'
    },
    {
      question: 'Do luxury Athens hotels usually have Acropolis views?',
      answer: 'Many tracked luxury-price hotels show an Acropolis-view signal, but it depends on room type and availability. Confirm the exact room view before booking.'
    }
  ];
  const luxuryTitle = 'Luxury Hotels in Athens: 5-Star Stays';
  const luxuryDescription = `Compare luxury hotels in Athens by neighborhood, price signal, Acropolis view, rooftop bar, amenities, and traveler fit.`;
  const luxuryUrl = `${siteUrl}/luxury-hotels-athens`;
  const luxuryContent = `
    <section class="guide-hero">
      <div class="container">
        <h1>Luxury Hotels in Athens</h1>
        <p>Compare premium Athens stays by area, view signal, rooftop signal, and traveler fit.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>Start with Syntagma, Plaka, and Kolonaki for the strongest luxury signals.</h2>
          <p>Hotel Grande Bretagne and King George Athens carry the highest nightly price signals in Syntagma. Electra Palace Athens anchors luxury Plaka with both Acropolis-view and rooftop-bar signals, while St. George Lycabettus gives Kolonaki a premium rooftop-view option.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Luxury Hotel Comparison</h2>
        ${renderHotelComparisonTable(luxuryHotels, 'Luxury-price Athens hotels compared by fit, area, view, and rooftop signals.')}
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">Luxury Decision Guide</h2>
        <div class="content-grid">
          <div class="info-panel"><h3>Choose Syntagma if</h3><p>You want classic city-center luxury, Parliament/Syntagma access, shopping, and strong transport links.</p></div>
          <div class="info-panel"><h3>Choose Plaka if</h3><p>You want historic atmosphere, Acropolis access, and a premium stay embedded in the old city.</p></div>
          <div class="info-panel"><h3>Choose Kolonaki if</h3><p>You want a more polished neighborhood base with boutiques, cafes, and Lycabettus-side atmosphere.</p></div>
        </div>
        <div class="fit-summary guide-callout">
          <p>Shopping above ordinary five-star luxury? Compare the <a href="/ultra-luxury-athens-villas-suites">ultra-luxury Athens villas and presidential suites guide</a> for Hotel Grande Bretagne Royal Suite, One&Only Aesthesis villas, Four Seasons Astir Palace, Amanzoe Villa 20, and helicopter-transfer planning.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">All Luxury Picks</h2>
        <div class="hotels-grid">${luxuryHotels.map(generateHotelCard).join('')}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">FAQs: Luxury Hotels in Athens</h2>
        ${renderFaqDetails(luxuryFaqs)}
      </div>
    </section>
  `;
  
  fs.writeFileSync(
    path.join(distDir, 'luxury-hotels-athens.html'),
    wrapInLayout(luxuryContent, luxuryTitle, luxuryDescription, luxuryUrl, {
      schema: guideSchema(luxuryTitle, luxuryDescription, luxuryUrl, luxuryHotels, luxuryFaqs)
    })
  );
  
  // Rooftop Bars Guide
  const rooftopHotels = siteHotels
    .filter(h => h.hasRooftopBar)
    .sort((a, b) => (b.rooftopRating || 0) - (a.rooftopRating || 0) || a.pricePerNight - b.pricePerNight);
  
  const rooftopRows = rooftopHotels.map(hotel => ({
    hotel: `<a href="${hotelUrl(hotel)}">${escapeHtml(hotel.name)}</a>`,
    area: `<a href="/athens-hotels/${hotel.neighborhood}">${escapeHtml(hotel.neighborhoodName)}</a>`,
    view: hotel.hasAcropolisView ? 'Acropolis-view signal' : 'City-view / confirm view',
    score: hotel.rooftopRating ? `${hotel.rooftopRating}/5 site rooftop signal` : 'Rooftop listed',
    price: `€${hotel.pricePerNight}`,
    fit: escapeHtml((hotel.bestFor || ['Travelers']).join(', '))
  }));
  const rooftopTable = renderComparisonTable(rooftopRows, [
    { key: 'hotel', label: 'Hotel' },
    { key: 'area', label: 'Area' },
    { key: 'view', label: 'View signal' },
    { key: 'score', label: 'Rooftop signal' },
    { key: 'price', label: 'Price' },
    { key: 'fit', label: 'Best for' }
  ], 'Athens hotels with rooftop-bar signals compared by view, area, and price.');

  const rooftopFaqs = [
    {
      question: 'Which Athens hotel areas are best for rooftop bars?',
      answer: 'Plaka, Monastiraki, Syntagma, Kolonaki, Psyrri, Koukaki, and Exarchia all have tracked rooftop-bar hotel signals in the dataset, with Plaka, Monastiraki, and Syntagma carrying the strongest central sightseeing context.'
    },
    {
      question: 'Do all rooftop bar hotels have Acropolis views?',
      answer: 'No. The page separates rooftop-bar signal from Acropolis-view signal because a hotel can have one without the other. Confirm the exact room, terrace, or restaurant view before booking.'
    },
    {
      question: 'Are Athens hotel rooftop bars open to non-guests?',
      answer: 'Access rules can change by property, date, and event. Confirm directly with the hotel before planning around a rooftop visit.'
    }
  ];
  const rooftopTitle = 'Athens Hotels with Rooftop Bars';
  const rooftopDescription = `Compare Athens hotels with rooftop-bar signals by neighborhood, Acropolis-view signal, rooftop score, price tier, and traveler fit.`;
  const rooftopUrl = `${siteUrl}/best-rooftop-bars-athens`;
  const rooftopContent = `
    <section class="guide-hero">
      <div class="container">
        <h1>Athens Hotels with Rooftop Bars</h1>
        <p>Compare rooftop-bar hotels by Acropolis-view signal, neighborhood, and nightly price signal.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>For rooftop plus Acropolis-view signals, start with Electra Palace Athens, A for Athens, Hotel Grande Bretagne, King George Athens, St. George Lycabettus, Herodion Hotel, AVA Hotel Athens, and 360 Degrees Hotel.</h2>
          <p>This guide separates three things travelers often mix together: whether a hotel has a rooftop bar, whether the data shows an Acropolis-view signal, and what nightly price tier it sits in.</p>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">Rooftop Hotel Comparison Table</h2>
        ${rooftopTable}
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">How to Choose a Rooftop Hotel in Athens</h2>
        <div class="content-grid">
          <div class="info-panel"><h3>View first</h3><p>Choose hotels with both rooftop-bar and Acropolis-view signals if the skyline is the priority. Confirm the exact terrace or room view before booking.</p></div>
          <div class="info-panel"><h3>Area first</h3><p>Plaka and Monastiraki are better for historic walks; Syntagma is better for central transport and luxury; Kolonaki is better for a polished neighborhood stay.</p></div>
          <div class="info-panel"><h3>Budget first</h3><p>Sort by the nightly price signal, then check whether the rooftop is a bar, restaurant, pool terrace, or seasonal space on the hotel’s booking page.</p></div>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">All Rooftop Bar Hotel Picks</h2>
        <div class="hotels-grid">${rooftopHotels.map(generateHotelCard).join('')}</div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">FAQs: Athens Rooftop Bar Hotels</h2>
        ${renderFaqDetails(rooftopFaqs)}
      </div>
    </section>
  `;
  
  fs.writeFileSync(
    path.join(distDir, 'best-rooftop-bars-athens.html'),
    wrapInLayout(rooftopContent, rooftopTitle, rooftopDescription, rooftopUrl, {
      schema: guideSchema(rooftopTitle, rooftopDescription, rooftopUrl, rooftopHotels, rooftopFaqs)
    })
  );

  // Ultra-luxury villas and presidential suites guide
  const ultraTitle = ultraLuxuryGuide.title;
  const ultraDescription = ultraLuxuryGuide.description;
  const ultraUrl = `${siteUrl}/${ultraLuxuryGuide.slug}`;
  const ultraFaqs = [
    {
      question: 'What is the most expensive stay near Athens?',
      answer: 'For pure shock value, Amanzoe Villa 20 near Porto Heli is the ceiling to compare: luxury-travel sources report roughly $45,000 to $55,000+ per night in peak season, while the official Aman page positions it as a quote/enquiry villa with nine bedrooms, 11 pools, and a private spa.'
    },
    {
      question: 'What is the most luxurious hotel suite in central Athens?',
      answer: 'Hotel Grande Bretagne Royal Suite is the central Athens trophy-suite benchmark because Marriott describes it as a 400-square-meter one-bedroom residence on the fifth floor. Four Seasons Astir Palace adds a Riviera alternative with its 210-square-meter Arion Presidential Suite, rooftop garden, plunge pool, and dedicated personal assistant service.'
    },
    {
      question: 'Can ultra-luxury travelers use helicopter transfers around Athens?',
      answer: 'Yes. Current luxury aviation pages advertise private helicopter access from Athens-area helipads to Greek resorts, with Fly G Aviation listing 35-90 minute resort transfers from EUR2,350 per aircraft. Exact routes, passenger limits, luggage limits, weather, and landing permissions need confirmation.'
    }
  ];
  const ultraSources = [
    ['One&Only Aesthesis Villa One', 'https://www.oneandonlyresorts.com/aesthesis/accommodation/villa-one'],
    ['One&Only Aesthesis Three-Bedroom Villa', 'https://www.oneandonlyresorts.com/aesthesis/private-homes/stays/three-bedroom'],
    ['Four Seasons Astir Palace Arion Presidential Suite', 'https://www.fourseasons.com/athens/accommodations/specialty-suites/arion-presidential-suite/'],
    ['Hotel Grande Bretagne Royal Suite', 'https://www.marriott.com/luxury/signature-accommodations/hotel-grande-bretagne-athens'],
    ['Amanzoe Villas', 'https://www.aman.com/resorts/amanzoe/accommodation/villas'],
    ['Amanzoe Villa 20', 'https://www.aman.com/resorts/amanzoe/accommodation/villa/villa-20'],
    ['Grand Resort Lagonissi Royal Villa', 'https://www.lagonissiresort.gr/accommodation/athens-luxury-royal-villa/'],
    ['Fly G Aviation helicopter resort transfers', 'https://flyg.gr/blog/6676-private-helicopter-access-to-greece%E2%80%99s-top-luxury-resorts.html'],
    ['Elite Traveler Villa 20 rate reference', 'https://elitetraveler.com/suites/17017/villa-20'],
    ['Suites & Villas Villa 20 rate reference', 'https://suitesandvillas.com/suites/villa/amanzoe-villa-20']
  ];
  const ultraRows = [
    {
      name: 'Amanzoe Villa 20',
      place: 'Porto Heli, helicopter/drive from Athens',
      flex: 'Nine bedrooms, 11 pools, private spa, Greek taverna, art-filled private-home scale.',
      money: 'Reported around $45k-$55k+ per night by luxury-suite publishers; official booking is enquiry-led.',
      source: '<a href="https://www.aman.com/resorts/amanzoe/accommodation/villa/villa-20">Official</a> / <a href="https://elitetraveler.com/suites/17017/villa-20">rate reference</a>'
    },
    {
      name: 'One&Only Aesthesis Villa One',
      place: 'Glyfada, Athenian Riviera',
      flex: 'Two-bedroom seafront villa, 519 sqm indoors, 922 sqm outdoors, central pool, private gym, staff quarters.',
      money: 'Date-dependent resort villa pricing; larger group configurations are handled by reservations.',
      source: '<a href="https://www.oneandonlyresorts.com/aesthesis/accommodation/villa-one">Official</a>'
    },
    {
      name: 'One&Only Aesthesis Three-Bedroom Villa',
      place: 'Glyfada, Athenian Riviera',
      flex: 'Outer-connected private homes for up to six guests, private pools, patios, gardens, kitchens, and sea-view positioning.',
      money: 'Quote/check-rate territory, especially for summer and multi-villa stays.',
      source: '<a href="https://www.oneandonlyresorts.com/aesthesis/private-homes/stays/three-bedroom">Official</a>'
    },
    {
      name: 'Four Seasons Astir Palace Arion Presidential Suite',
      place: 'Vouliagmeni, Athens Riviera',
      flex: '210 sqm penthouse with rooftop garden, plunge pool, sea views, dining for 10, office, walk-in closet.',
      money: 'Official page pushes check-rates; travel press has cited five-figure high-season suite pricing.',
      source: '<a href="https://www.fourseasons.com/athens/accommodations/specialty-suites/arion-presidential-suite/">Official</a>'
    },
    {
      name: 'Hotel Grande Bretagne Royal Suite',
      place: 'Syntagma Square, central Athens',
      flex: '400 sqm one-bedroom, two-bathroom residence with museum-quality antiques, fifth-floor position, and wine-cellar access.',
      money: 'Central-Athens trophy suite; confirm live rate, security needs, and VIP arrival privately.',
      source: '<a href="https://www.marriott.com/luxury/signature-accommodations/hotel-grande-bretagne-athens">Official</a>'
    },
    {
      name: 'Grand Resort Lagonissi Royal Villa',
      place: 'Athens Riviera, Lagonissi',
      flex: 'Two master bedrooms, indoor and outdoor heated pools, gym, steam bath, massage area, butler quarters, private path to the bay.',
      money: 'Quote/check-rate trophy villa; best for guests who want full seaside-resort privacy near Athens.',
      source: '<a href="https://www.lagonissiresort.gr/accommodation/athens-luxury-royal-villa/">Official</a>'
    }
  ];
  const ultraContent = `
    <section class="guide-hero luxe-hero">
      <div class="container">
        <nav class="breadcrumb"><a href="/">Home</a> → <span>Ultra-Luxury Athens</span></nav>
        <p class="guide-kicker">Money-no-object Athens</p>
        <h1>${escapeHtml(ultraLuxuryGuide.h1)}</h1>
        <p>The real flex is not just a five-star room. It is a Riviera villa with staff quarters, a central Athens royal suite, a quote-only Aman estate, and a helicopter plan that turns Athens into the launchpad for the Greek one-percent itinerary.</p>
        <div class="luxe-stat-grid">
          <div><strong>$55k+</strong><span>reported Villa 20 nightly ceiling</span></div>
          <div><strong>400 sqm</strong><span>Hotel Grande Bretagne Royal Suite</span></div>
          <div><strong>11 pools</strong><span>Amanzoe Villa 20 official feature</span></div>
          <div><strong>EUR2,350+</strong><span>published helicopter transfer floor</span></div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <div class="quick-answer">
          <p class="eyebrow">Quick answer</p>
          <h2>The Athens ultra-luxury ceiling is not a normal hotel room. It is Villa 20 at Amanzoe, Villa One at One&Only Aesthesis, Four Seasons Astir Palace suites, and Hotel Grande Bretagne's Royal Suite.</h2>
          <p>If the brief is "absolute top of the top", compare three lanes: central power-suite luxury at Hotel Grande Bretagne, Athens Riviera villas at One&Only Aesthesis or Grand Resort Lagonissi, and Amanzoe Villa 20 as the helicopter-away Greek trophy stay. Public rates are often hidden or date-sensitive, but luxury-suite publishers put Amanzoe Villa 20 in the roughly $45,000-$55,000+ per night conversation in peak season.</p>
          <div class="answer-links">
            <a href="#luxe-shortlist">Shortlist</a>
            <a href="#money-ladder">Money ladder</a>
            <a href="#transfer-flex">Helicopter flex</a>
            <a href="#sources">Sources</a>
          </div>
        </div>
      </div>
    </section>
    <section class="section section-alt" id="luxe-shortlist">
      <div class="container">
        <h2 class="section-title">Ultra-Luxury Athens Shortlist</h2>
        <p class="section-subtitle">The stays that actually feel headline-level, not just expensive.</p>
        <div class="table-wrap">
          <table class="comparison-table luxe-table">
            <thead>
              <tr>
                <th>Stay</th>
                <th>Where</th>
                <th>Eyeball Grabber</th>
                <th>Money Signal</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${ultraRows.map(row => `
                <tr>
                  <td data-label="Stay">${escapeHtml(row.name)}</td>
                  <td data-label="Where">${escapeHtml(row.place)}</td>
                  <td data-label="Eyeball Grabber">${escapeHtml(row.flex)}</td>
                  <td data-label="Money Signal">${escapeHtml(row.money)}</td>
                  <td data-label="Source">${row.source}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </section>
    <section class="section" id="money-ladder">
      <div class="container">
        <h2 class="section-title">How Expensive Can Athens Get?</h2>
        <div class="content-grid">
          <div class="info-panel luxe-panel">
            <p class="guide-kicker">Central power suite</p>
            <h3>Royal-suite Athens</h3>
            <p>Use Hotel Grande Bretagne Royal Suite or Four Seasons Arion Presidential Suite when the trip needs security, staff, driver logistics, and landmark address value more than a resort compound.</p>
          </div>
          <div class="info-panel luxe-panel">
            <p class="guide-kicker">Riviera villa</p>
            <h3>Private-pool resort living</h3>
            <p>Use One&Only Aesthesis, Four Seasons Astir Palace, or Grand Resort Lagonissi when the buyer wants Athens access plus sea, terraces, private pools, staffable space, and beach-club energy.</p>
          </div>
          <div class="info-panel luxe-panel">
            <p class="guide-kicker">Greek billionaire mode</p>
            <h3>Helicopter-away Aman</h3>
            <p>Use Amanzoe Villa 20 when the ask is the largest story: nine bedrooms, 11 pools, a private spa, a villa host/team model, and a reported peak-season price that can sit above many luxury yachts.</p>
          </div>
        </div>
      </div>
    </section>
    <section class="section section-alt" id="transfer-flex">
      <div class="container">
        <h2 class="section-title">The Transfer Flex: Helicopter, Yacht, or Armored Chauffeur?</h2>
        <div class="area-stack">
          <article class="area-panel">
            <div>
              <h3>Helicopter transfer</h3>
              <p>Athens-based resort transfers can become part of the trip itself. Fly G Aviation publishes Greece luxury-resort helicopter transfers of 35-90 minutes from EUR2,350 per aircraft, with aircraft, luggage, weather, and landing permissions to confirm.</p>
            </div>
            <dl class="signal-list">
              <div><dt>Best for</dt><dd>Amanzoe, island hops, tight schedules</dd></div>
              <div><dt>Check</dt><dd>Payload, luggage, helipad, VAT</dd></div>
            </dl>
          </article>
          <article class="area-panel">
            <div>
              <h3>Chauffeur and security</h3>
              <p>For central Athens, the smoother flex is often not a helicopter. It is a discreet airport arrival, luxury van or S-Class transfer, luggage advance, security coordination, and suite check-in without lobby friction.</p>
            </div>
            <dl class="signal-list">
              <div><dt>Best for</dt><dd>Grande Bretagne, King George, Syntagma</dd></div>
              <div><dt>Check</dt><dd>Arrival route, privacy, motorcade needs</dd></div>
            </dl>
          </article>
          <article class="area-panel">
            <div>
              <h3>Yacht day or sea transfer</h3>
              <p>Athens Riviera villas can layer in yacht days, Saronic island runs, and private beach-club logistics. Treat this as a separate quote because sea state, crew, fuel, berth, and catering can move the final bill fast.</p>
            </div>
            <dl class="signal-list">
              <div><dt>Best for</dt><dd>Riviera villas, Lagonissi, Vouliagmeni</dd></div>
              <div><dt>Check</dt><dd>Boat class, crew, fuel, route</dd></div>
            </dl>
          </article>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">What to Ask Before You Wire Serious Money</h2>
        <div class="fit-summary">
          <ul>
            <li>Is the quoted rate for the exact villa/suite, dates, taxes, service charge, and minimum stay?</li>
            <li>Does the villa include a dedicated host, chef, security coordination, daily breakfast, airport meet-and-greet, packing/unpacking, or massage credits?</li>
            <li>Are the private pool, rooftop garden, spa, gym, staff quarters, and beach access private or shared?</li>
            <li>What are the exact helicopter luggage limits, weather fallback, cancellation rules, and ground-transfer legs?</li>
            <li>For Acropolis or sea views, is the view from the bedroom, terrace, rooftop, restaurant, or only the property grounds?</li>
          </ul>
        </div>
      </div>
    </section>
    <section class="section section-alt" id="sources">
      <div class="container">
        <h2 class="section-title">Sources and Reality Check</h2>
        <div class="methodology">
          <p>This page uses official hotel/resort pages checked on May 30, 2026, plus current luxury-travel rate references where public property pages use enquiry or check-rate flows. Rate figures marked as reported should be treated as directional until confirmed directly with the property or a top-tier travel advisor.</p>
          <div class="answer-links guide-nearby-links">
            ${ultraSources.map(([label, url]) => `<a href="${url}">${escapeHtml(label)}</a>`).join('')}
          </div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h2 class="section-title">Keep Comparing</h2>
        <div class="guide-link-grid">
          <a class="guide-link" href="/luxury-hotels-athens"><span>Luxury hotels</span><strong>Compare tracked 5-star Athens hotels</strong></a>
          <a class="guide-link" href="/5-star-hotels-athens"><span>5-star</span><strong>5-Star Hotels in Athens</strong></a>
          <a class="guide-link" href="/acropolis-view-hotels-athens"><span>Views</span><strong>Acropolis View Hotels</strong></a>
          <a class="guide-link" href="/athens-hotels-with-rooftop-pool"><span>Pool</span><strong>Athens Hotels with Rooftop Pool Signals</strong></a>
        </div>
      </div>
    </section>
    <section class="section section-alt">
      <div class="container">
        <h2 class="section-title">FAQs: Ultra-Luxury Athens</h2>
        ${renderFaqDetails(ultraFaqs)}
      </div>
    </section>
  `;
  const ultraSchema = [
    pageSchema('CollectionPage', ultraTitle, ultraDescription, ultraUrl),
    breadcrumbSchema([
      { name: 'Home', url: siteUrl },
      { name: 'Ultra-Luxury Athens', url: ultraUrl }
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Ultra-luxury Athens villas and suites shortlist',
      url: ultraUrl,
      numberOfItems: ultraRows.length,
      itemListElement: ultraRows.map((row, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: row.name
      }))
    },
    faqSchema(ultraFaqs)
  ];

  fs.writeFileSync(
    path.join(distDir, `${ultraLuxuryGuide.slug}.html`),
    wrapInLayout(ultraContent, ultraTitle, ultraDescription, ultraUrl, {
      schema: ultraSchema
    })
  );

  // Keyword-driven intent guides
  for (const guide of intentGuides) {
    const picked = uniqueHotels(siteHotels.filter(guide.filter));
    const sorted = (guide.sort ? guide.sort(picked) : sortByScore(picked)).slice(0, guideHotelLimit(guide));
    const url = `${siteUrl}/${guide.slug}`;
    const faqs = guide.faqs.map(([question, answer]) => ({ question, answer }));
    const notes = guide.notes.map(([heading, body]) => `
      <div class="info-panel">
        <h3>${escapeHtml(heading)}</h3>
        <p>${escapeHtml(body)}</p>
      </div>
    `).join('');
    const nearbyLinks = neighborhoodsData.neighborhoods
      .filter(hood => sorted.some(hotel => hotel.neighborhood === hood.id))
      .map(hood => `<a href="/athens-hotels/${hood.id}">${escapeHtml(hood.name)} hotels</a>`)
      .join('');

    const content = `
      <section class="guide-hero">
        <div class="container">
          <nav class="breadcrumb"><a href="/">Home</a> → <span>${escapeHtml(guide.h1)}</span></nav>
          <h1>${escapeHtml(guide.h1)}</h1>
          <p>${escapeHtml(guide.hero)}</p>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <div class="quick-answer">
            <p class="eyebrow">Quick answer</p>
            <h2>${escapeHtml(guide.quickH2)}</h2>
            <p>${escapeHtml(guide.quickP)}</p>
            <div class="answer-links">
              <a href="#compare-hotels">Compare hotels</a>
              <a href="#how-to-choose">How to choose</a>
              <a href="#booking-checks">Booking checks</a>
              <a href="#faqs">FAQs</a>
            </div>
          </div>
        </div>
      </section>
      <section class="section section-alt" id="compare-hotels">
        <div class="container">
          <h2 class="section-title">${escapeHtml(guide.h1)} Compared</h2>
          <p class="section-subtitle">This table uses visible Hotels of Athens data: neighborhood, price signal, star category, Acropolis-view flag, rooftop-bar flag, amenities, and traveler-fit tags.</p>
          ${renderHotelComparisonTable(sorted, guide.caption)}
        </div>
      </section>
      <section class="section" id="how-to-choose">
        <div class="container">
          <h2 class="section-title">How to Choose</h2>
          <div class="content-grid">${notes}</div>
        </div>
      </section>
      ${renderAreaFitPanels(sorted, 'Area Fit for This Search')}
      <section class="section section-alt">
        <div class="container">
          <h2 class="section-title">Source and Selection Notes</h2>
          <div class="methodology">
            <p>Hotels are included when their Hotels of Athens fields match this page’s criteria. The page does not use unsupported review scores or invented live availability. Treat prices as directional signals and confirm live rates, room type, cancellation terms, access rules, and views before booking.</p>
          </div>
          <div class="answer-links guide-nearby-links">${nearbyLinks}</div>
        </div>
      </section>
      <section class="section" id="booking-checks">
        <div class="container">
          <h2 class="section-title">Booking Checks That Actually Matter</h2>
          <p class="section-subtitle">Use these checks before treating any hotel-level signal as a finished booking decision.</p>
          ${renderBookingChecklist(guide.checklist)}
        </div>
      </section>
      <section class="section">
        <div class="container">
          <h2 class="section-title">All Matching Hotels</h2>
          <div class="hotels-grid">${sorted.map(generateHotelCard).join('')}</div>
        </div>
      </section>
      <section class="section section-alt" id="faqs">
        <div class="container">
          <h2 class="section-title">FAQs: ${escapeHtml(guide.h1)}</h2>
          ${renderFaqDetails(faqs)}
        </div>
      </section>
    `;

    fs.writeFileSync(
      path.join(distDir, `${guide.slug}.html`),
      wrapInLayout(content, guide.title, guide.description, url, {
        schema: guideSchema(guide.title, guide.description, url, sorted, faqs)
      })
    );
  }
}

// Generate Sitemap
function generateSitemap() {
  console.log('📄 Generating sitemap...');
  
  const urls = [
    { loc: 'https://hotelsofathens.com/', priority: '1.0' },
    { loc: 'https://hotelsofathens.com/contact', priority: '0.5' },
    { loc: 'https://hotelsofathens.com/where-to-stay-in-athens', priority: '0.95' },
    { loc: 'https://hotelsofathens.com/best-hotels-athens', priority: '0.95' },
    { loc: 'https://hotelsofathens.com/budget-hotels-athens', priority: '0.8' },
    { loc: 'https://hotelsofathens.com/luxury-hotels-athens', priority: '0.8' },
    { loc: `https://hotelsofathens.com/${ultraLuxuryGuide.slug}`, priority: '0.86' },
    { loc: 'https://hotelsofathens.com/best-rooftop-bars-athens', priority: '0.8' },
    ...intentGuides.map(guide => ({
      loc: `https://hotelsofathens.com/${guide.slug}`,
      priority: '0.82'
    })),
    ...neighborhoodsData.neighborhoods.map(n => ({
      loc: `https://hotelsofathens.com/athens-hotels/${n.id}`,
      priority: '0.9'
    })),
    ...uniqueHotels(allHotelsData.hotels).map(h => ({
      loc: `https://hotelsofathens.com/hotel/${h.slug}`,
      priority: '0.7'
    }))
  ];
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap);
}

// Generate robots.txt
function generateRobots() {
  console.log('📄 Generating robots.txt...');
  
  const robots = `User-agent: *
Allow: /

Sitemap: https://hotelsofathens.com/sitemap.xml`;
  
  fs.writeFileSync(path.join(distDir, 'robots.txt'), robots);
}

// Generate _headers
function generateHeaders() {
  console.log('📄 Generating _headers...');
  
  const headers = `/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/images/*
  Cache-Control: public, max-age=31536000

/css/*
  Cache-Control: public, max-age=31536000`;
  
  fs.writeFileSync(path.join(distDir, '_headers'), headers);
}

// Generate _redirects
function generateRedirects() {
  console.log('📄 Generating _redirects...');
  
  const redirects = `/index.html  /  301
/area/*  /athens-hotels/:splat  301
/hotels-with-acropolis-view-athens  /acropolis-view-hotels-athens  301
/athens-hotels-with-view-of-acropolis  /acropolis-view-hotels-athens  301
/hotels-in-psiri-athens  /athens-hotels/psyrri  301
/psiri-athens-hotels  /athens-hotels/psyrri  301
/psyrri-athens-hotels  /athens-hotels/psyrri  301
/hotels-in-kolonaki-athens  /athens-hotels/kolonaki  301
/hotels-in-monastiraki-athens  /athens-hotels/monastiraki  301
/hotels-in-syntagma-athens  /athens-hotels/syntagma  301
/koukaki-athens-hotels  /athens-hotels/koukaki  301
/hotels-near-piraeus-ferry-terminal  /hotels-near-piraeus-port  301
/most-expensive-hotels-athens  /ultra-luxury-athens-villas-suites  301
/presidential-suite-athens  /ultra-luxury-athens-villas-suites  301
/luxury-villas-athens  /ultra-luxury-athens-villas-suites  301
/athens-presidential-suites  /ultra-luxury-athens-villas-suites  301
/hotels-in-athens-with-rooftop-pool  /athens-hotels-with-rooftop-pool  301`;
  
  fs.writeFileSync(path.join(distDir, '_redirects'), redirects);
}

// Main
async function main() {
  console.log('🏗️  Generating Hotels of Athens site...\n');
  
  generateHomepage();
  generateNeighborhoodPages();
  generateHotelPages();
  generateContactPage();
  generateThankYouPage();
  generateGuidePages();
  generateSitemap();
  generateRobots();
  generateHeaders();
  generateRedirects();
  
  console.log(`\n✅ Site generated! ${uniqueHotels(allHotelsData.hotels).length} hotel pages created.`);
  console.log(`   Output: ${distDir}`);
}

main().catch(console.error);
