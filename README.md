# Nathane Pizza — site one-page

Site statique, sans framework : un HTML unique (CSS et JS inline), images AVIF/WebP responsives, police auto-hébergée.

## Modifier le contenu

Tout est centralisé dans `content/` :

- `content/restaurant.json` — nom, adresse, téléphone, note Google, horaires, textes SEO, **URL du site (`siteUrl`)**
- `content/menu.json` — pizzas : nom, prix, composition, photo (chemin dans `02_menu/`)

Ajouter une pizza = ajouter une ligne dans `menu.json` + sa photo dans `02_menu/`, puis relancer le build.

## Construire

```bash
npm install
npm run build        # génère dist/
npm run preview      # aperçu sur http://localhost:4173
```

L'URL de production peut aussi être passée à la volée : `SITE_URL=https://mon-domaine.fr npm run build`.

## Publier

**GitHub Pages (automatique)** : chaque `git push` sur `main` reconstruit et publie le site via `.github/workflows/deploy.yml`.
En ligne : https://rockandberg.github.io/nathane-pizza/

**Nom de domaine perso** : dans GitHub › Settings › Pages › Custom domain, puis mettre ce domaine dans `siteUrl` (`content/restaurant.json`) et pousser.

Autre hébergeur : déposer le contenu de `dist/` (Netlify, Cloudflare Pages, OVH, o2switch…).
Le fichier `dist/_headers` active un cache long sur les images/polices sur Netlify et Cloudflare Pages.

## Structure

- `build.mjs` — génération du HTML, JSON-LD (Restaurant + Menu), Open Graph, sitemap, robots, optimisation des images (sharp)
- `src/styles.css`, `src/main.js`, `src/favicon.svg` — styles, petit JS (ouvert/fermé, carte Google au clic, retour en haut, apparitions)
- `01_photos/` — couverture, kiosque, logo · `02_menu/` — photos des pizzas
