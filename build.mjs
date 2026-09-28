// Build statique de nathane-pizza : node build.mjs  →  dist/
// Contenu éditable : content/restaurant.json et content/menu.json
import { readFile, writeFile, mkdir, rm, copyFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, "dist");
const IMG_OUT = path.join(OUT, "img");

const site = JSON.parse(await readFile(path.join(ROOT, "content/restaurant.json"), "utf8"));
const menu = JSON.parse(await readFile(path.join(ROOT, "content/menu.json"), "utf8"));
const SITE_URL = (process.env.SITE_URL || site.siteUrl).replace(/\/$/, "");

const PHOTOS = {
  hero: "01_photos/nathane_pizza_cover.jpeg",
  kiosk: "01_photos/kiosque_nathane_pizza.png",
  logo: "01_photos/logo_nathane_pizza.jpg",
};

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slugify = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const exists = (p) => access(p).then(() => true, () => false);
const hashOf = (buf, extra = "") => createHash("sha1").update(buf).update(extra).digest("hex").slice(0, 8);
const fmtTime = (t) => { const [h, m] = t.split(":"); return `${+h}h${m === "00" ? "" : m}`; };
const euro = (n) => `${n} €`;

/** Encode une image source en AVIF + WebP à plusieurs largeurs. Renvoie { avif, webp, fallback, width, height }. */
async function responsive(src, name, widths, { aspect, position = "centre", quality = { avif: 52, webp: 74 } } = {}) {
  const buf = await readFile(path.join(ROOT, src));
  const meta = await sharp(buf).metadata();
  const h = hashOf(buf, JSON.stringify({ widths, aspect, position, quality }));
  const out = { avif: [], webp: [] };
  let ratio = aspect || meta.width / meta.height;
  const usable = widths.filter((w) => w <= meta.width);
  if (usable.length < widths.length) usable.push(meta.width);
  const list = [...new Set(usable)];
  for (const w of list) {
    const hgt = Math.round(w / ratio);
    for (const fmt of ["avif", "webp"]) {
      const file = `${name}-${h}-${w}.${fmt}`;
      const dest = path.join(IMG_OUT, file);
      if (!(await exists(dest))) {
        let p = sharp(buf).rotate().resize(w, hgt, { fit: "cover", position });
        p = fmt === "avif" ? p.avif({ quality: quality.avif, effort: 6 }) : p.webp({ quality: quality.webp, effort: 6 });
        await p.toFile(dest);
      }
      out[fmt].push(`img/${file} ${w}w`);
    }
  }
  const largest = list[list.length - 1];
  const mid = list[Math.min(1, list.length - 1)];
  return {
    avif: out.avif.join(", "),
    webp: out.webp.join(", "),
    fallback: `img/${name}-${h}-${mid}.webp`,
    largest: `img/${name}-${h}-${largest}.webp`,
    width: list[0],
    height: Math.round(list[0] / ratio),
  };
}

const picture = (img, { alt, sizes, cls = "", loading = "lazy", priority = false }) =>
  `<picture${cls ? ` class="${cls}"` : ""}><source type="image/avif" srcset="${img.avif}" sizes="${sizes}"><source type="image/webp" srcset="${img.webp}" sizes="${sizes}"><img src="${img.fallback}" alt="${esc(alt)}" width="${img.width}" height="${img.height}" loading="${loading}" decoding="${priority ? "sync" : "async"}"${priority ? ' fetchpriority="high"' : ""}></picture>`;

/** Logo gris sur fond blanc → logo détouré (alpha) recoloré. */
async function logo(color, name) {
  const { data, info } = await sharp(path.join(ROOT, PHOTOS.logo)).greyscale().trim({ threshold: 12 }).extend({ top: 8, bottom: 8, left: 8, right: 8, background: "#ffffff" }).raw().toBuffer({ resolveWithObject: true });
  let min = 255;
  for (const v of data) if (v < min) min = v;
  const [r, g, b] = color.match(/\w\w/g).map((x) => parseInt(x, 16));
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    const a = Math.max(0, Math.min(255, Math.round(((255 - data[i]) / (255 - min)) * 255)));
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  const raw = sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } });
  const w = 280;
  const hgt = Math.round((info.height / info.width) * w);
  await raw.clone().resize(w).webp({ quality: 82, alphaQuality: 90 }).toFile(path.join(IMG_OUT, `${name}.webp`));
  await raw.clone().resize(w).png({ compressionLevel: 9, palette: true }).toFile(path.join(IMG_OUT, `${name}.png`));
  return { src: `img/${name}.webp`, png: `img/${name}.png`, width: w, height: hgt };
}

// ---------- icons ----------
const icon = {
  phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>`,
  route: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 19-9-9 19-2-8-8-2z"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8c0 5.6 6.9 11.4 7.2 11.6a1.3 1.3 0 0 0 1.6 0C13.1 21.4 20 15.6 20 10a8 8 0 0 0-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></svg>`,
  up: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>`,
};
const stars = (label) => `<span class="stars" role="img" aria-label="${esc(label)}">${icon.star.repeat(5)}</span>`;

// ---------- build ----------
await rm(OUT, { recursive: true, force: true });
await mkdir(IMG_OUT, { recursive: true });
await mkdir(path.join(OUT, "fonts"), { recursive: true });

console.log("• Images…");
const hero = await responsive(PHOTOS.hero, "nathane-pizza-four", [640, 960, 1280, 1600], { quality: { avif: 50, webp: 72 } });
const kiosk = await responsive(PHOTOS.kiosk, "nathane-pizza-propriano", [480, 800, 1200]);
const logoDark = await logo("191817", "logo-nathane-pizza");
const logoLight = await logo("f5f0e7", "logo-nathane-pizza-creme");

const pizzas = [];
for (const item of menu) {
  const slug = slugify(item.name);
  const img = await responsive(item.photo, `pizza-${slug}-propriano`, [320, 480, 720], { aspect: 4 / 5, quality: { avif: 46, webp: 68 } });
  pizzas.push({ ...item, slug, img });
}

// Open Graph 1200×630
const ogBuf = await readFile(path.join(ROOT, PHOTOS.hero));
const ogName = `og-nathane-pizza-${hashOf(ogBuf)}.jpg`;
await sharp(ogBuf).resize(1200, 630, { fit: "cover", position: "centre" }).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(IMG_OUT, ogName));

// Icônes
const favSvg = await readFile(path.join(ROOT, "src/favicon.svg"));
await writeFile(path.join(OUT, "favicon.svg"), favSvg);
await sharp(favSvg, { density: 600 }).resize(180, 180).flatten({ background: "#C94A32" }).png().toFile(path.join(OUT, "apple-touch-icon.png"));
await sharp(favSvg, { density: 300 }).resize(192, 192).png().toFile(path.join(OUT, "icon-192.png"));
await sharp(favSvg, { density: 600 }).resize(512, 512).png().toFile(path.join(OUT, "icon-512.png"));
await sharp(favSvg, { density: 150 }).resize(48, 48).png().toFile(path.join(OUT, "favicon-48.png"));

// Police (variable, sous-ensemble latin)
await copyFile(path.join(ROOT, "node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2"), path.join(OUT, "fonts/bricolage-latin-wght.woff2"));

// ---------- données dérivées ----------
const a = site.address;
const fullAddress = `${a.street}, ${a.postalCode} ${a.city}`;
const mapsQuery = encodeURIComponent(`${site.name}, ${fullAddress}`);
const links = {
  tel: `tel:${site.phone.tel}`,
  directions: `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`,
  maps: `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`,
  embed: `https://www.google.com/maps?q=${mapsQuery}&output=embed`,
};
const prices = menu.map((m) => m.price);
const minP = Math.min(...prices), maxP = Math.max(...prices);
const days = site.hours;
const daysShort = days.map((d) => d.day.slice(0, 3) + ".").join(" · ");
const sameHours = days.every((d) => d.open === days[0].open && d.close === days[0].close);
const hoursShort = sameHours ? `${daysShort} ${fmtTime(days[0].open)} – ${fmtTime(days[0].close)}` : daysShort;
const ratingLabel = `Note Google ${site.google.rating} sur 5`;
const year = new Date().getFullYear();
const daysLong = days.map((d) => d.day.toLowerCase());
const daysText = daysLong.length > 1 ? `${daysLong.slice(0, -1).join(", ")} et ${daysLong[daysLong.length - 1]}` : daysLong[0];
const hoursText = sameHours ? `le ${daysText}, de ${fmtTime(days[0].open)} à ${fmtTime(days[0].close)}` : days.map((d) => `${d.day.toLowerCase()} ${fmtTime(d.open)}–${fmtTime(d.close)}`).join(", ");
const cheapest = menu.find((m) => m.price === minP);
const veggie = menu.find((m) => /v[ée]g[ée]tarienne/i.test(m.name));
const faq = [
  { q: `Où se trouve la pizzeria ${site.name} à ${a.city} ?`, a: `L’adresse : ${a.place}, ${a.street}, ${a.postalCode} ${a.city} (${a.region}). Utilisez le bouton « Itinéraire » pour vous y rendre avec Google Maps.` },
  { q: `Quels sont les horaires de ${site.name} ?`, a: `${site.name} est ouvert ${hoursText}.` },
  { q: `Combien coûte une pizza chez ${site.name} ?`, a: `La carte compte ${menu.length} pizzas, de ${euro(minP)} (${cheapest.name}) à ${euro(maxP)}.` },
  ...(veggie ? [{ q: `Y a-t-il une pizza végétarienne ?`, a: `Oui : la ${veggie.name} (${euro(veggie.price)}) — ${veggie.ingredients.toLowerCase()}.` }] : []),
  { q: `Comment contacter ${site.name} ?`, a: `Par téléphone, au ${site.phone.display}.` },
  { q: `Quelle est la note de ${site.name} sur Google ?`, a: `${site.name} est noté ${site.google.rating}/5 sur Google, sur ${site.google.reviewCount} avis.` },
];
const intro = `${site.name} est une pizzeria à ${a.city}, en ${a.region}, ouverte ${hoursText}. Au menu : ${menu.length} pizzas, de ${euro(minP)} à ${euro(maxP)}.`;

// ---------- JSON-LD ----------
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Restaurant",
      "@id": `${SITE_URL}/#restaurant`,
      name: site.name,
      description: site.seo.description,
      url: `${SITE_URL}/`,
      telephone: site.phone.tel,
      image: [`${SITE_URL}/img/${ogName}`, `${SITE_URL}/${kiosk.largest}`],
      logo: `${SITE_URL}/${logoDark.png}`,
      servesCuisine: ["Pizza"],
      menu: `${SITE_URL}/#carte`,
      currenciesAccepted: "EUR",
      openingHours: sameHours ? [`${days.map((d) => d.schema.slice(0, 2)).join(",")} ${days[0].open}-${days[0].close}`] : days.map((d) => `${d.schema.slice(0, 2)} ${d.open}-${d.close}`),
      keywords: site.seo.keywords,
      priceRange: `${minP} € – ${maxP} €`,
      address: {
        "@type": "PostalAddress",
        streetAddress: `${a.place}, ${a.street}`,
        addressLocality: a.city,
        postalCode: a.postalCode,
        addressRegion: a.region,
        addressCountry: a.country,
      },
      hasMap: links.maps,
      areaServed: [a.city, a.region],
      openingHoursSpecification: sameHours
        ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: days.map((d) => d.schema), opens: days[0].open, closes: days[0].close }]
        : days.map((d) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: d.schema, opens: d.open, closes: d.close })),
      aggregateRating: { "@type": "AggregateRating", ratingValue: site.google.ratingValue, bestRating: 5, reviewCount: site.google.reviewCount },
      hasMenu: {
        "@type": "Menu",
        name: "La carte",
        inLanguage: "fr",
        hasMenuSection: {
          "@type": "MenuSection",
          name: "Pizzas",
          hasMenuItem: pizzas.map((p) => ({
            "@type": "MenuItem",
            "@id": `${SITE_URL}/#pizza-${p.slug}`,
            name: p.name,
            description: p.ingredients,
            image: `${SITE_URL}/${p.img.largest}`,
            offers: { "@type": "Offer", price: p.price.toFixed(2), priceCurrency: "EUR" },
          })),
        },
      },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: `${SITE_URL}/`,
      name: site.seo.title,
      description: site.seo.description,
      inLanguage: "fr-FR",
      isPartOf: { "@id": `${SITE_URL}/#website` },
      about: { "@id": `${SITE_URL}/#restaurant` },
      primaryImageOfPage: { "@type": "ImageObject", url: `${SITE_URL}/img/${ogName}`, width: 1200, height: 630 },
      dateModified: new Date().toISOString().slice(0, 10),
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      inLanguage: "fr-FR",
      mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: site.name, inLanguage: "fr-FR", publisher: { "@id": `${SITE_URL}/#restaurant` } },
  ],
};

// ---------- CSS / JS ----------
const minCss = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,>])\s*/g, "$1").replace(/;}/g, "}").replace(/ !important/g, "!important").trim();
const css = minCss(await readFile(path.join(ROOT, "src/styles.css"), "utf8"));
const js = (await readFile(path.join(ROOT, "src/main.js"), "utf8")).replace(/^\s*\/\/.*$/gm, "").replace(/\n\s+/g, "\n").trim();
const hoursJs = JSON.stringify(days.map(({ schema, open, close }) => ({ schema, open, close })));

// ---------- HTML ----------
const menuHtml = pizzas
  .map(
    (p, i) => `<li class="pizza reveal" id="pizza-${p.slug}">
${picture(p.img, { alt: `Pizza ${p.name} de Nathane Pizza à Propriano`, sizes: "(min-width:1200px) 290px, (min-width:860px) 31vw, (min-width:560px) 47vw, 38vw", cls: "pizza__img", loading: i < 2 ? "eager" : "lazy" })}
<div class="pizza__body"><div class="pizza__top"><h3>${esc(p.name)}</h3><span class="price">${euro(p.price)}</span></div><p>${esc(p.ingredients)}.</p></div>
</li>`
  )
  .join("\n");

const hoursHtml = days.map((d) => `<li data-day="${d.schema}"><span>${d.day}</span><span>${fmtTime(d.open)} – ${fmtTime(d.close)}</span></li>`).join("");

const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(site.seo.title)}</title>
<meta name="description" content="${esc(site.seo.description)}">
<meta name="keywords" content="${esc(site.seo.keywords)}">
<link rel="canonical" href="${SITE_URL}/">
<link rel="alternate" hreflang="fr-FR" href="${SITE_URL}/">
<link rel="alternate" hreflang="x-default" href="${SITE_URL}/">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<meta name="author" content="${esc(site.name)}">
<meta name="format-detection" content="telephone=yes">
<meta name="theme-color" content="#191817">
<meta name="geo.region" content="FR-2A">
<meta name="geo.placename" content="${esc(a.city)}">
<meta property="og:type" content="restaurant.restaurant">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(site.seo.title)}">
<meta property="og:description" content="${esc(site.seo.description)}">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:image" content="${SITE_URL}/img/${ogName}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Pizza sortant du four chez ${esc(site.name)} à ${esc(a.city)}">
<meta property="restaurant:contact_info:street_address" content="${esc(a.street)}">
<meta property="restaurant:contact_info:locality" content="${esc(a.city)}">
<meta property="restaurant:contact_info:postal_code" content="${esc(a.postalCode)}">
<meta property="restaurant:contact_info:country_name" content="France">
<meta property="restaurant:contact_info:phone_number" content="${esc(site.phone.tel)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(site.seo.title)}">
<meta name="twitter:description" content="${esc(site.seo.description)}">
<meta name="twitter:image" content="${SITE_URL}/img/${ogName}">
<meta name="twitter:image:alt" content="Pizza sortant du four chez ${esc(site.name)} à ${esc(a.city)}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="icon" href="favicon-48.png" type="image/png" sizes="48x48">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preload" href="fonts/bricolage-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" as="image" type="image/avif" imagesrcset="${hero.avif}" imagesizes="100vw" fetchpriority="high">
<style>${css}</style>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<a class="skip" href="#carte">Aller à la carte</a>

<header class="header">
<div class="wrap header__in">
<a class="brand" href="#top" aria-label="${esc(site.name)} — accueil"><img src="${logoDark.src}" alt="${esc(site.name)}" width="${logoDark.width}" height="${logoDark.height}"></a>
<nav class="nav" aria-label="Navigation principale">
<a href="#carte">Carte</a>
<a href="#horaires">Horaires</a>
<a href="#acces"><span class="nav__long">Nous trouver</span><span class="nav__short">Accès</span></a>
<a class="btn btn--tomato" href="${links.tel}">${icon.phone}Appeler</a>
</nav>
</div>
</header>

<main id="top">
<section class="hero" aria-labelledby="hero-title">
${picture(hero, { alt: `Pizza sortant du four chez ${site.name}, pizzeria à ${a.city}`, sizes: "100vw", cls: "hero__media", loading: "eager", priority: true })}
<div class="wrap hero__content">
<a class="rating-chip" href="${links.maps}" target="_blank" rel="noopener">${stars(ratingLabel)}<span><strong>${site.google.rating}</strong> Google — ${site.google.reviewCount} avis</span></a>
<h1 id="hero-title">${esc(site.name)}</h1>
<p class="hero__sub">${esc(site.tagline.replace(a.city, ""))}<span>${esc(a.city)}</span></p>
<div class="hero__ctas">
<a class="btn btn--tomato" href="#carte">${icon.menu}Voir la carte</a>
<a class="btn btn--ghost" href="${links.tel}">${icon.phone}Appeler</a>
</div>
<p class="hero__hours"><span>${hoursShort}</span><span class="status" data-status></span></p>
</div>
</section>

<section class="section" id="carte" aria-labelledby="carte-title">
<div class="wrap">
<div class="section__head">
<div><span class="eyebrow">Nos pizzas à ${esc(a.city)}</span><h2 id="carte-title">La carte</h2></div>
<p class="section__meta">${menu.length} pizzas, de ${euro(minP)} à ${euro(maxP)}</p>
</div>
<p class="intro">${esc(intro)}</p>
<ul class="menu">
${menuHtml}
<li class="menu__note reveal"><p>Une envie&nbsp;?<br><span>Appelez-nous au ${esc(site.phone.display)}</span></p><a class="btn btn--tomato" href="${links.tel}">${icon.phone}Appeler</a></li>
</ul>
</div>
</section>

<section class="section reviews" aria-labelledby="avis-title">
<div class="wrap reviews__in">
<div class="score reveal">
<span class="score__num" aria-hidden="true">${site.google.rating}</span>
<div class="score__side">${stars(ratingLabel)}<p><strong>${site.google.rating}/5</strong> sur Google<br>${site.google.reviewCount} avis</p></div>
</div>
<div class="reviews__text reveal">
<span class="eyebrow">Avis Google</span>
<h2 id="avis-title">Noté ${site.google.rating}/5 par nos clients</h2>
<p>Une note de ${site.google.rating}/5 sur ${site.google.reviewCount} avis Google. Merci à toutes celles et ceux qui passent nous voir à ${esc(a.city)}.</p>
<a class="btn btn--light" href="${links.maps}" target="_blank" rel="noopener">Voir les avis sur Google</a>
</div>
</div>
</section>

<section class="section" aria-labelledby="infos-title">
<div class="wrap">
<h2 id="infos-title" class="sr-only">Horaires et adresse de ${esc(site.name)} à ${esc(a.city)}</h2>
<div class="infos" id="horaires">
<div class="card reveal">
<span class="eyebrow">Horaires</span>
<h3>Ouvert le week-end</h3>
<ul class="hours">${hoursHtml}</ul>
<p class="status" data-status></p>
</div>
<figure class="photo-card reveal" style="margin:0">
${picture(kiosk, { alt: `La pizzeria ${site.name}, ${a.street} à ${a.city}`, sizes: "(min-width:860px) 50vw, 100vw" })}
<figcaption>${esc(a.place)} · ${esc(a.city)}</figcaption>
</figure>
</div>

<div class="infos" id="acces" style="margin-top:16px">
<div class="card reveal">
<span class="eyebrow">Nous trouver</span>
<h3>${esc(site.name)}</h3>
<address class="address">${esc(a.place)}<br>${esc(a.street)}<br>${esc(a.postalCode)} ${esc(a.city)}<small>${esc(a.region)}, Corse</small></address>
<div class="address-actions">
<a class="btn btn--tomato" href="${links.directions}" target="_blank" rel="noopener">${icon.route}Itinéraire</a>
<a class="btn btn--outline" href="${links.maps}" target="_blank" rel="noopener">Ouvrir Google Maps</a>
</div>
<p class="phone-line">Téléphone&nbsp;: <a href="${links.tel}">${esc(site.phone.display)}</a></p>
</div>
<div class="map reveal">
<button class="map__facade" type="button" data-map="${esc(links.embed)}" data-title="Plan d’accès à ${esc(site.name)}, ${esc(fullAddress)}">
<span class="map__pin">${icon.pin}</span>
<strong>Afficher le plan</strong>
<span>${esc(fullAddress)} — la carte Google Maps se charge au clic.</span>
</button>
</div>
</div>
</div>
</section>

<section class="section faq" id="faq" aria-labelledby="faq-title">
<div class="wrap faq__in">
<div><span class="eyebrow">Questions fréquentes</span><h2 id="faq-title">Bon à savoir</h2></div>
<div class="faq__list">
${faq.map((f, i) => `<details class="reveal"${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("\n")}
</div>
</div>
</section>

<section class="section cta" aria-labelledby="cta-title">
<div class="wrap">
<h2 id="cta-title">Une pizza ce soir&nbsp;?</h2>
<a class="cta__phone" href="${links.tel}">${esc(site.phone.display)}</a>
<p>${hoursShort} · ${esc(a.city)}</p>
<a class="btn btn--ink" href="${links.tel}">${icon.phone}Appeler maintenant</a>
</div>
</section>
</main>

<footer class="footer">
<div class="wrap">
<div class="footer__grid">
<div><img src="${logoLight.src}" alt="${esc(site.name)}" width="${logoLight.width}" height="${logoLight.height}" loading="lazy"><p style="margin-top:14px">${esc(site.tagline)}, ${esc(a.region)}.</p></div>
<div><h2 class="footer__title">Adresse</h2><address>${esc(a.place)}<br>${esc(a.street)}<br>${esc(a.postalCode)} ${esc(a.city)}</address><p style="margin-top:8px"><a href="${links.directions}" target="_blank" rel="noopener">Itinéraire →</a></p></div>
<div><h2 class="footer__title">Horaires</h2><ul>${days.map((d) => `<li>${d.day} ${fmtTime(d.open)} – ${fmtTime(d.close)}</li>`).join("")}</ul></div>
<div><h2 class="footer__title">Contact</h2><ul><li><a href="${links.tel}">${esc(site.phone.display)}</a></li><li><a href="${links.maps}" target="_blank" rel="noopener">Google&nbsp;: ${site.google.rating}/5 — ${site.google.reviewCount} avis</a></li><li><a href="#carte">La carte</a></li><li><a href="#faq">Questions fréquentes</a></li></ul></div>
</div>
<div class="footer__bottom"><span>© ${year} ${esc(site.name)} — Pizzeria à ${esc(a.city)}</span><span>${esc(fullAddress)}</span></div>
</div>
</footer>

<a class="to-top" href="#top" aria-label="Remonter en haut de la page" data-to-top>${icon.up}</a>
<nav class="bar" aria-label="Actions rapides">
<a class="btn btn--tomato" href="${links.tel}">${icon.phone}Appeler</a>
<a class="btn btn--light" href="${links.directions}" target="_blank" rel="noopener">${icon.route}Itinéraire</a>
</nav>

<script>window.__HOURS__=${hoursJs};</script>
<script>${js}</script>
</body>
</html>
`;

await writeFile(path.join(OUT, "index.html"), html.replace(/\n{2,}/g, "\n"));

// ---------- fichiers SEO / hébergement ----------
const today = new Date().toISOString().slice(0, 10);
await writeFile(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
await writeFile(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <image:image><image:loc>${SITE_URL}/img/${ogName}</image:loc></image:image>
${pizzas.map((p) => `    <image:image><image:loc>${SITE_URL}/${p.img.largest}</image:loc></image:image>`).join("\n")}
  </url>
</urlset>
`
);
await writeFile(
  path.join(OUT, "site.webmanifest"),
  JSON.stringify({ name: site.name, short_name: site.name, start_url: "./", display: "browser", background_color: "#F5F0E7", theme_color: "#191817", icons: [{ src: "icon-192.png", sizes: "192x192", type: "image/png" }, { src: "icon-512.png", sizes: "512x512", type: "image/png" }] }, null, 2)
);
await writeFile(path.join(OUT, ".nojekyll"), "");
await writeFile(
  path.join(OUT, "404.html"),
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page introuvable | ${esc(site.name)}</title><meta name="robots" content="noindex"><style>body{margin:0;min-height:100vh;display:grid;place-content:center;gap:16px;padding:24px;text-align:center;background:#f5f0e7;color:#191817;font:18px/1.5 system-ui,sans-serif}h1{font-size:2.4rem;margin:0;letter-spacing:-.03em}a{display:inline-block;margin:6px;padding:14px 22px;border-radius:999px;background:#c94a32;color:#fff;text-decoration:none;font-weight:600}a+a{background:#191817}</style></head><body><h1>Page introuvable</h1><p>Cette page n’existe pas, mais nos pizzas, si.</p><p><a href="${SITE_URL}/#carte">Voir la carte</a><a href="${links.tel}">Appeler ${esc(site.phone.display)}</a></p></body></html>\n`
);
await writeFile(
  path.join(OUT, "llms.txt"),
  `# ${site.name}\n\n> ${intro}\n\n- Adresse : ${a.place}, ${fullAddress} (${a.region})\n- Téléphone : ${site.phone.display}\n- Horaires : ${hoursText}\n- Google : ${site.google.rating}/5 (${site.google.reviewCount} avis)\n- Site : ${SITE_URL}/\n\n## Carte\n\n${menu.map((m) => `- ${m.name} — ${euro(m.price)} : ${m.ingredients}`).join("\n")}\n`
);
// Cache long pour les fichiers versionnés (Netlify / Cloudflare Pages). Ignoré ailleurs.
await writeFile(path.join(OUT, "_headers"), `/img/*\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);

console.log(`✓ Site généré dans dist/ (${SITE_URL})`);
