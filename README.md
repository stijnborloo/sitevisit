# AV Site Visit App

Professionele AV site visit applicatie voor het documenteren van vergaderruimtes.

---

## Deployen

### Optie 1: Vercel (aanbevolen — gratis)

1. Maak een account op [vercel.com](https://vercel.com)
2. Installeer Vercel CLI:
   ```bash
   npm install -g vercel
   ```
3. Unzip dit project en ga naar de map:
   ```bash
   cd av-site-visit
   npm install
   ```
4. Deploy:
   ```bash
   vercel
   ```
5. Je krijgt een URL zoals `https://av-site-visit.vercel.app`

**Of via GitHub:**
1. Push dit project naar een GitHub repository
2. Ga naar [vercel.com/new](https://vercel.com/new)
3. Importeer de repository
4. Vercel detecteert Vite automatisch — klik Deploy

---

### Optie 2: Netlify (gratis)

1. Ga naar [app.netlify.com](https://app.netlify.com)
2. Sleep de `dist/` map (na `npm run build`) naar Netlify
3. Of koppel je GitHub repo en stel in:
   - Build command: `npm run build`
   - Publish directory: `dist`

---

### Optie 3: Elke webserver

```bash
npm install
npm run build
```

Upload de inhoud van de `dist/` map naar je webserver.

---

## Lokaal testen

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in je browser.

---

## PWA installatie op telefoon

1. Open de URL in Chrome (Android) of Safari (iOS)
2. **Android:** Tik op "Toevoegen aan startscherm" in het browsermenu
3. **iOS:** Tik op het deel-icoon → "Zet op beginscherm"

De app werkt dan als een native app, inclusief offline functionaliteit.

---

## Functies

- 📱 Mobile-first ontwerp
- 📷 Camera integratie voor foto's
- ✅ Technische checklist per ruimte
- 📊 Site visit dashboard met voortgang
- 📄 Professioneel rapport genereren
- 💾 Offline data opslag (localStorage)
- 📦 Export/import van data (JSON backup)
- 🔍 Zoekfunctie
- 📋 Room templates
