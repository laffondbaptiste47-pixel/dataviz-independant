/**
 * ============================================================================
 * SAÉ 303-2 — Carte de la crise alimentaire au Royaume-Uni (The Independent)
 * Librairies utilisées :
 *   - Leaflet.js (objet "L") : affiche et gère la carte interactive
 *   - Snap.svg (fonction "Snap" et objet "mina") : dessine et anime le graphique SVG
 * ============================================================================
 * Organisation du fichier :
 *   1. Réglages et variables globales
 *   2. Petites fonctions utiles (couleurs, prix)
 *   3. Création de la carte Leaflet (fonds, légende, boîte d'info)
 *   4. Style des régions, popups et points des capitales
 *   5. Graphique animé avec Snap.svg
 *   6. Fonctions qui synchronisent la carte, les boutons et le graphique
 *   7. Contrôles HTML (boutons, menu déroulant, curseur, tableau)
 *   8. Chargement des données et démarrage
 * ============================================================================
 */

"use strict";

/* ============================================================================
   1. RÉGLAGES ET VARIABLES GLOBALES
   ============================================================================ */

// Les 4 indicateurs qu'on peut afficher sur la carte.
// - breaks : les 4 seuils qui décident de la couleur d'une région
// - sliderMin / sliderMax / sliderStep : les réglages du curseur de filtre
const METRICS = {
    fresh_fv: {
        label: "Fresh Fruit & Veg",
        shortLabel: "Fresh Fruit & Veg",
        unit: "£/person/wk",
        breaks: [3.2, 3.6, 4.0, 4.5],
        sliderMin: 3.0,
        sliderMax: 6.0,
        sliderStep: 0.1
    },
    total: {
        label: "Total Household Food",
        shortLabel: "Total Household Food",
        unit: "£/person/wk",
        breaks: [34.5, 36.5, 38.5, 41.0],
        sliderMin: 33.0,
        sliderMax: 43.5,
        sliderStep: 0.5
    },
    convenience: {
        label: "Convenience & Processed",
        shortLabel: "Convenience & Processed",
        unit: "£/person/wk",
        breaks: [11.6, 12.2, 13.0, 14.0],
        sliderMin: 11.0,
        sliderMax: 15.0,
        sliderStep: 0.2
    },
    eating_out: {
        label: "Eating Out & Takeaways",
        shortLabel: "Eating Out",
        unit: "£/person/wk",
        breaks: [10.2, 12.1, 13.3, 14.5],
        sliderMin: 8.5,
        sliderMax: 18.0,
        sliderStep: 0.5
    }
};

// Moyennes du Royaume-Uni (£ par personne et par semaine) pour le graphique Snap.svg
const UK_AVERAGES = {
    total: 37.09,
    convenience: 12.55,
    eating_out: 12.31,
    fresh_fv: 3.94,
    ready_meals: 2.46
};

// Les 5 couleurs de la carte, du rouge très clair (faible) au rouge foncé (élevé)
const COLORS = ["#FEE2E2", "#FCA5A5", "#F87171", "#EF4444", "#B91C1C"];

// Position de départ de la carte : [latitude, longitude] et niveau de zoom
const UK_CENTER = [54.6, -2.8];
const UK_ZOOM = 5.4;

// Variables partagées dans tout le script
let map; // La carte Leaflet
let geojsonLayer; // Le calque Leaflet qui contient les 12 régions
let markersLayer; // Le calque Leaflet qui contient les points des capitales
let infoBox; // La boîte d'info en haut à gauche de la carte
let legendBox; // La légende en bas à droite de la carte

const snapBars = {}; // Stocke les barres Snap.svg pour pouvoir les animer plus tard
const featuresByName = {}; // Retrouve les données d'une région grâce à son nom
const layersByName = {}; // Retrouve la forme Leaflet d'une région grâce à son nom

let activeMetric = "fresh_fv"; // Indicateur actuellement affiché sur la carte
let selectedRegion = "London"; // Région actuellement sélectionnée
let thresholdValue = 6.0; // Valeur actuelle du curseur de filtre

/* ============================================================================
   2. PETITES FONCTIONS UTILES
   ============================================================================ */

// Choisit la couleur d'une région selon sa valeur et les 4 seuils de l'indicateur
function getColor(value, metricKey) {
    const seuils = METRICS[metricKey].breaks;
    let couleur = COLORS[0]; // Par défaut : la couleur la plus claire

    // On teste chaque seuil : plus la valeur est élevée, plus la couleur fonce
    for (let i = 0; i < seuils.length; i++) {
        if (value >= seuils[i]) {
            couleur = COLORS[i + 1];
        }
    }
    return couleur;
}

// Transforme un nombre en prix en livres : 3.9 -> "£3.90"
function formatGBP(value) {
    return "£" + Number(value).toFixed(2);
}

// Redessine le style de toutes les régions sur la carte
function refreshMapStyle() {
    if (geojsonLayer) {
        // [Leaflet] setStyle() réapplique la fonction de style sur toutes les régions
        geojsonLayer.setStyle(styleRegion);
    }
}

/* ============================================================================
   3. CRÉATION DE LA CARTE LEAFLET (NIVEAU 1)
   ============================================================================ */

function initLeafletMap() {
    // [Leaflet] L.map() crée la carte dans la <div id="uk-map"> de la page HTML
    map = L.map("uk-map", {
        center: UK_CENTER, // Point central de la carte
        zoom: UK_ZOOM, // Zoom de départ
        zoomSnap: 0.2, // Permet des zooms précis (par pas de 0.2)
        minZoom: 4.5, // Empêche de trop dézoomer
        maxZoom: 9, // Empêche de trop zoomer
        scrollWheelZoom: false // Désactive le zoom à la molette pour ne pas gêner le scroll de l'article
    });

    // [Leaflet] L.tileLayer() charge les images de fond de carte (les "tuiles")
    // .addTo(map) affiche directement ce fond sur la carte
    const cartoLight = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { attribution: "&copy; OpenStreetMap contributors &copy; CARTO", maxZoom: 19 }
    ).addTo(map);

    // Deuxième fond de carte (pas ajouté tout de suite, accessible dans le menu des calques)
    const osmStandard = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors", maxZoom: 19 }
    );

    // [Leaflet] L.layerGroup() crée un groupe vide pour ranger les points des capitales
    markersLayer = L.layerGroup().addTo(map);

    // [Leaflet] L.control.layers() ajoute le petit menu en haut à droite
    // 1er objet : fonds de carte (un seul à la fois)
    // 2e objet : calques optionnels (qu'on peut cocher/décocher)
    L.control.layers({ "Editorial Light (Carto)": cartoLight, "OpenStreetMap Standard": osmStandard }, { "Regional Capitals": markersLayer }, { collapsed: true }).addTo(map);

    initInfoBox();
    initLegendBox();
}

// Crée la boîte d'information en haut à gauche (se met à jour au survol d'une région)
function initInfoBox() {
    // [Leaflet] L.control() crée un bloc personnalisé posé par-dessus la carte
    infoBox = L.control({ position: "topleft" });

    // [Leaflet] onAdd() est appelée automatiquement par Leaflet quand on ajoute le contrôle à la carte
    infoBox.onAdd = function() {
        // [Leaflet] L.DomUtil.create() crée une balise <div> avec une classe CSS
        this._div = L.DomUtil.create("div", "leaflet-info-box");
        this.update();
        return this._div;
    };

    // Met à jour le texte de la boîte (si props est vide, affiche le message d'aide)
    infoBox.update = function(props) {
        if (!props) {
            this._div.innerHTML = `
        <h4>UK Food Spend</h4>
        <div class="info-hint">Hover over or click a UK region to inspect Defra 2024/25 figures.</div>
      `;
            return;
        }

        const m = METRICS[activeMetric];
        this._div.innerHTML = `
      <h4>${props.name}</h4>
      <div class="info-metric">${formatGBP(props[activeMetric])}</div>
      <div class="info-hint">${m.label} (${m.unit})<br>Fresh produce rank: #${props.rank_fv} / 12</div>
    `;
    };

    infoBox.addTo(map);
}

// Crée la légende des couleurs en bas à droite
function initLegendBox() {
    // [Leaflet] L.control() crée le bloc de légende en bas à droite
    legendBox = L.control({ position: "bottomright" });

    legendBox.onAdd = function() {
        this._div = L.DomUtil.create("div", "leaflet-legend-box");
        this.update();
        return this._div;
    };

    // Reconstruit les 5 tranches de la légende selon l'indicateur actif
    legendBox.update = function() {
        const m = METRICS[activeMetric];
        const b = m.breaks;

        // Tranches de prix
        const tranches = [
            `Under ${formatGBP(b[0])}`,
            `${formatGBP(b[0])} – ${formatGBP(b[1])}`,
            `${formatGBP(b[1])} – ${formatGBP(b[2])}`,
            `${formatGBP(b[2])} – ${formatGBP(b[3])}`,
            `${formatGBP(b[3])}+`
        ];

        let html = `<strong>${m.shortLabel} (£/wk)</strong>`;
        for (let i = 0; i < tranches.length; i++) {
            html += `<div><span class="legend-swatch" style="background:${COLORS[i]}"></span>${tranches[i]}</div>`;
        }
        this._div.innerHTML = html;
    };

    legendBox.addTo(map);
}

/* ============================================================================
   4. STYLE DES RÉGIONS, POPUPS ET POINTS DES CAPITALES
   ============================================================================ */

// Définit la couleur et la bordure d'une région sur la carte
function styleRegion(feature) {
    const props = feature.properties;
    const valeur = props[activeMetric];
    const estSelectionnee = props.name === selectedRegion;
    const sousLeSeuil = valeur <= thresholdValue;

    // Objet de style compris par Leaflet
    return {
        fillColor: getColor(valeur, activeMetric), // Couleur de remplissage
        weight: estSelectionnee ? 3.2 : 1.4, // Épaisseur de la bordure
        opacity: 1, // Opacité de la bordure
        color: estSelectionnee ? "#121212" : "#FFFFFF", // Couleur de la bordure (noire si sélectionnée)
        dashArray: sousLeSeuil ? "" : "3", // Bordure en pointillés si filtrée par le curseur
        fillOpacity: sousLeSeuil ? 0.85 : 0.22 // Région transparente si elle dépasse le seuil
    };
}

// Prépare le contenu HTML de la popup qui s'ouvre au clic sur une région
function createPopupHTML(props) {
    return `
    <div class="indy-popup">
      <div class="indy-popup-title">${props.name} (${props.capital})</div>
      <div class="indy-popup-grid">
        <span>Fresh Fruit &amp; Veg:</span><strong>${formatGBP(props.fresh_fv)}</strong>
        <span>Total Household Food:</span><strong>${formatGBP(props.total)}</strong>
        <span>Convenience &amp; Processed:</span><strong>${formatGBP(props.convenience)}</strong>
        <span>Ready Meals:</span><strong>${formatGBP(props.ready_meals)}</strong>
        <span>Eating Out:</span><strong>${formatGBP(props.eating_out)}</strong>
      </div>
      <div class="indy-popup-note">${props.note}</div>
    </div>
  `;
}

// Exécutée par Leaflet pour chaque région du fichier GeoJSON
function onEachRegion(feature, layer) {
    const props = feature.properties;

    // On garde la région en mémoire pour la retrouver facilement par son nom
    featuresByName[props.name] = feature;
    layersByName[props.name] = layer;

    // [Leaflet] bindPopup() attache une bulle d'info qui s'ouvrira au clic
    layer.bindPopup(createPopupHTML(props));

    // [Leaflet] layer.on("mouseover") détecte quand la souris passe sur la région
    layer.on("mouseover", function() {
        // [Leaflet] setStyle() met la région en surbrillance
        layer.setStyle({ weight: 3, color: "#121212", fillOpacity: 0.95 });
        // [Leaflet] bringToFront() passe la région devant ses voisines pour voir toute sa bordure
        layer.bringToFront();
        infoBox.update(props);
    });

    // [Leaflet] layer.on("mouseout") détecte quand la souris quitte la région
    layer.on("mouseout", function() {
        // [Leaflet] resetStyle() remet le style normal calculé par styleRegion()
        geojsonLayer.resetStyle(layer);
        infoBox.update();
    });

    // [Leaflet] layer.on("click") détecte un clic sur la région
    layer.on("click", function() {
        selectRegion(props.name, true);
    });
}

// Ajoute un petit rond noir sur chaque capitale régionale
function buildCapitalMarkers(features) {
    // [Leaflet] clearLayers() vide le groupe avant d'ajouter les points
    markersLayer.clearLayers();

    for (const feature of features) {
        const props = feature.properties;

        // [Leaflet] L.circleMarker() dessine un cercle à une position [latitude, longitude]
        const point = L.circleMarker(props.capital_coords, {
            radius: 5,
            fillColor: "#121212",
            color: "#FFFFFF",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        });

        // [Leaflet] bindTooltip() affiche le nom de la ville au survol du point
        point.bindTooltip(`${props.capital} (${props.name})`, {
            direction: "top",
            offset: [0, -6]
        });

        // Clic sur le point : sélectionne la région correspondante
        point.on("click", function() {
            selectRegion(props.name, true);
        });

        // Ajoute le point dans le groupe des capitales
        point.addTo(markersLayer);
    }
}

/* ============================================================================
   5. GRAPHIQUE ANIMÉ SNAP.SVG (NIVEAUX 3 ET 4)
   ============================================================================ */

// Les 5 catégories affichées en barres horizontales.
// - maxVal : valeur qui correspond à une barre pleine (100% de la largeur)
// - mapMetric : indicateur de la carte activé quand on clique sur la barre (null = pas cliquable)
const SNAP_CATEGORIES = [
    { key: "total", label: "Total Household Food", maxVal: 46, color: "#121212", mapMetric: "total" },
    { key: "eating_out", label: "Eating Out", maxVal: 20, color: "#6366F1", mapMetric: "eating_out" },
    { key: "convenience", label: "Convenience & Processed", maxVal: 16, color: "#E01A22", mapMetric: "convenience" },
    { key: "fresh_fv", label: "Fresh Fruit & Veg", maxVal: 6.5, color: "#10B981", mapMetric: "fresh_fv" },
    { key: "ready_meals", label: "Ready Meals", maxVal: 3.6, color: "#F59E0B", mapMetric: null }
];

const SNAP_FONT = "Inter, Arial, sans-serif";

// Renvoie un objet de style texte simple pour éviter de répéter fontFamily partout
function textStyle(size, weight, color) {
    return { fontFamily: SNAP_FONT, fontSize: size, fontWeight: weight, fill: color };
}

// Dessine la structure fixe du graphique SVG (titre, légende, rails, barres vides, boutons)
function initSnapChart() {
    // [Snap.svg] Snap() sélectionne la balise <svg id="snap-basket-chart"> pour dessiner dedans
    const s = Snap("#snap-basket-chart");
    // [Snap.svg] clear() efface tout le contenu du SVG
    s.clear();

    // [Snap.svg] text(x, y, texte) écrit du texte ; attr() applique les styles CSS/SVG
    s.text(12, 20, "CLICK ANY CATEGORY BAR TO SWITCH THE LEAFLET MAP INDICATOR")
        .attr(textStyle(10.5, 800, "#6B7280"))
        .attr({ letterSpacing: 0.6 });

    // Légende du graphique : [Snap.svg] rect(x, y, largeur, hauteur, arrondi) et line(x1, y1, x2, y2)
    s.rect(12, 30, 12, 10, 2).attr({ fill: "#E01A22" });
    s.text(30, 39, "Selected Region (£/wk)").attr(textStyle(11, 600, "#121212"));
    s.line(185, 35, 205, 35).attr({ stroke: "#121212", strokeWidth: 2.5, strokeDasharray: "4 2" });
    s.text(212, 39, "UK Regional Average").attr(textStyle(11, 600, "#4B5563"));

    // Dimensions des barres
    const barX = 12; // Début horizontal des barres
    const trackW = 415; // Largeur maximale d'une barre
    const startY = 74; // Position verticale de la 1re ligne
    const rowHeight = 52; // Espace entre deux lignes

    // On crée une ligne pour chacune des 5 catégories
    for (let i = 0; i < SNAP_CATEGORIES.length; i++) {
        const cat = SNAP_CATEGORIES[i];
        const y = startY + i * rowHeight;
        const cursor = cat.mapMetric ? "pointer" : "default";

        // 1. Fond invisible de la ligne (sert à afficher le surlignage au survol)
        const hitBg = s.rect(4, y - 22, 512, 46, 5).attr({ fill: "transparent", cursor: cursor });

        // 2. Nom de la catégorie (avec une petite flèche ↗ si elle pilote la carte)
        const titre = cat.mapMetric ? `${cat.label} ↗` : cat.label;
        const label = s.text(barX, y - 6, titre)
            .attr(textStyle(12.5, 700, "#121212"))
            .attr({ cursor: cursor });

        // 3. Rail gris en fond + barre colorée (largeur 0 au départ, elle sera animée ensuite)
        const track = s.rect(barX, y + 2, trackW, 18, 3).attr({ fill: "#F3F4F6", cursor: cursor });
        const bar = s.rect(barX, y + 2, 0, 18, 3).attr({ fill: cat.color, cursor: cursor });

        // 4. Trait vertical en pointillés qui montre la moyenne du Royaume-Uni
        const ratioMoyenne = Math.min(UK_AVERAGES[cat.key] / cat.maxVal, 1);
        const avgX = barX + ratioMoyenne * trackW;
        const avgLine = s.line(avgX, y - 2, avgX, y + 23)
            .attr({ stroke: "#121212", strokeWidth: 2, strokeDasharray: "3 2" });

        // 5. Prix affiché à droite de la barre
        const valText = s.text(barX + trackW + 10, y + 16, "£0.00").attr(textStyle(13, 800, "#121212"));

        // [Snap.svg] s.g() crée un groupe SVG pour rassembler tous les éléments de la ligne
        const row = s.g().attr({ id: "snap-row-" + cat.key });
        row.add(hitBg, label, track, bar, avgLine, valText);

        // [Snap.svg] hover(entree, sortie) anime la couleur de fond quand on survole la ligne
        row.hover(
            function() {
                // [Snap.svg] animate(proprietes, dureeEnMs) change une valeur en douceur
                hitBg.animate({ fill: "#FEF2F2" }, 150);
            },
            function() {
                // Si cette ligne est l'indicateur actif de la carte, elle reste légèrement rosée
                const fondNormal = cat.mapMetric === activeMetric ? "#FFF1F2" : "transparent";
                hitBg.animate({ fill: fondNormal }, 150);
            }
        );

        // NIVEAU 4 (Snap.svg -> Leaflet) : [Snap.svg] click() change l'indicateur de la carte
        if (cat.mapMetric) {
            row.click(function() {
                setActiveMetric(cat.mapMetric);
            });
        }

        // On mémorise les éléments de cette barre pour pouvoir les mettre à jour plus tard
        snapBars[cat.key] = {
            bar: bar,
            valText: valText,
            hitBg: hitBg,
            maxVal: cat.maxVal,
            trackW: trackW,
            mapMetric: cat.mapMetric
        };
    }

    // NIVEAU 4 (Snap.svg -> Leaflet) : deux boutons SVG pour sauter directement sur Londres ou le Pays de Galles
    createJumpButton(s, 12, 342, 238, "Jump to London (Max £5.77)", "London", "#E01A22");
    createJumpButton(s, 266, 342, 242, "Jump to Wales (Min £3.04)", "Wales", "#121212");
}

// Crée un bouton cliquable en SVG qui envoie la carte sur une région précise
function createJumpButton(s, x, y, width, text, regionName, bgColor) {
    const rect = s.rect(x, y, width, 34, 4).attr({ fill: bgColor });
    const label = s.text(x + width / 2, y + 21, text)
        .attr(textStyle(12, 700, "#FFFFFF"))
        .attr({ textAnchor: "middle" }); // Centre le texte horizontalement

    // [Snap.svg] On regroupe le rectangle et le texte pour qu'ils réagissent ensemble
    const button = s.g().attr({ cursor: "pointer" });
    button.add(rect, label);

    // Effet de transparence au survol
    button.hover(
        function() { rect.animate({ opacity: 0.85 }, 140); },
        function() { rect.animate({ opacity: 1 }, 140); }
    );

    // Au clic, on sélectionne la région et on zoome dessus sur la carte
    button.click(function() {
        selectRegion(regionName, true);
    });
}

// Met à jour les textes et anime les 5 barres pour la région choisie
function updateSnapChart(regionName) {
    const feature = featuresByName[regionName];
    if (!feature) return;
    const props = feature.properties;

    // Mise à jour de l'en-tête au-dessus du graphique
    const signe = props.vs_uk_avg_fv_pct >= 0 ? "+" : "";
    document.getElementById("snap-region-name").textContent = props.name;
    document.getElementById("snap-region-rank").textContent =
        `Rank #${props.rank_fv} / 12 in Fresh Produce (${signe}${props.vs_uk_avg_fv_pct}% vs UK avg)`;
    document.getElementById("snap-region-note").textContent = props.note;

    // Mise à jour et animation de chaque barre
    for (const cat of SNAP_CATEGORIES) {
        const item = snapBars[cat.key];
        const valeur = props[cat.key];

        // Calcul de la largeur cible en pixels (entre 8 px minimum et la largeur max du rail)
        const ratio = Math.min(1, valeur / item.maxVal);
        const largeurCible = Math.max(8, ratio * item.trackW);

        // [Snap.svg] animate() fait glisser la barre sur 420 ms
        // [Snap.svg] mina.easeinout est une courbe fluide (départ doux -> rapide -> arrivée douce)
        item.bar.animate({ width: largeurCible }, 420, mina.easeinout);

        // Met à jour le prix affiché à droite
        item.valText.attr({ text: formatGBP(valeur) });

        // Surligne la ligne si elle correspond à l'indicateur affiché sur la carte
        const couleurFond = item.mapMetric === activeMetric ? "#FFF1F2" : "transparent";
        item.hitBg.attr({ fill: couleurFond });
    }
}

/* ============================================================================
   6. SYNCHRONISATION (CARTE <-> CONTRÔLES HTML <-> GRAPHIQUE)
   ============================================================================ */

// Change l'indicateur actif et met tout à jour (boutons, titre, curseur, carte, légende, graphique)
function setActiveMetric(metricKey) {
    const m = METRICS[metricKey];
    if (!m) return;
    activeMetric = metricKey;

    // 1. Met le bon bouton en surbrillance ("active")
    const boutons = document.querySelectorAll(".filter-btn");
    for (const btn of boutons) {
        const estActif = btn.dataset.metric === metricKey;
        btn.classList.toggle("active", estActif);
        btn.setAttribute("aria-pressed", String(estActif));
    }

    // 2. Met à jour le titre au-dessus de la carte
    document.getElementById("map-panel-title").textContent =
        `Figure 2 — UK Regional Spend: ${m.label} (${m.unit})`;

    // 3. Adapte l'échelle du curseur au nouvel indicateur et le remet au maximum ("All")
    const slider = document.getElementById("threshold-slider");
    slider.min = m.sliderMin;
    slider.max = m.sliderMax;
    slider.step = m.sliderStep;
    slider.value = m.sliderMax;
    thresholdValue = m.sliderMax;
    updateThresholdLabel();

    // 4. Recolore la carte et met à jour la légende
    refreshMapStyle();
    if (legendBox) legendBox.update();

    // 5. Met à jour le surlignage dans le graphique Snap.svg
    updateSnapChart(selectedRegion);
}

// Sélectionne une région. Si zoomSurRegion vaut true, la carte zoome dessus et ouvre sa popup.
function selectRegion(regionName, zoomSurRegion) {
    if (!featuresByName[regionName]) return;
    selectedRegion = regionName;

    // Synchronise la liste déroulante HTML
    const select = document.getElementById("region-select");
    if (select) select.value = regionName;

    // Met à jour la bordure noire de la région sélectionnée
    refreshMapStyle();

    const layer = layersByName[regionName];
    if (layer && zoomSurRegion) {
        // [Leaflet] getBounds() récupère les limites géographiques de la région
        // [Leaflet] fitBounds() zoome automatiquement pour cadrer la région entière
        map.fitBounds(layer.getBounds(), { padding: [45, 45], maxZoom: 7 });
        // [Leaflet] openPopup() ouvre la bulle d'info de la région
        layer.openPopup();
    }

    // NIVEAU 4 (Leaflet -> Snap.svg) : anime le graphique pour cette région
    updateSnapChart(regionName);
}

// Met à jour le texte à côté du curseur de seuil ("All (£6.00)" ou "≤ £4.20")
function updateThresholdLabel() {
    const m = METRICS[activeMetric];
    const output = document.getElementById("threshold-output");

    if (thresholdValue >= m.sliderMax) {
        output.textContent = `All (${formatGBP(m.sliderMax)})`;
    } else {
        output.textContent = `≤ ${formatGBP(thresholdValue)}`;
    }
}

/* ============================================================================
   7. CONTRÔLES HTML (NIVEAU 2) ET TABLEAU DE DONNÉES
   ============================================================================ */

// Branche les événements sur les boutons, la liste déroulante et le curseur de la page
function bindExternalControls() {
    // 1. Les 4 boutons d'indicateurs (chaque bouton a un attribut HTML data-metric="...")
    const boutons = document.querySelectorAll(".filter-btn");
    for (const btn of boutons) {
        btn.addEventListener("click", function() {
            setActiveMetric(btn.dataset.metric);
        });
    }

    // 2. La liste déroulante des régions
    document.getElementById("region-select").addEventListener("change", function(event) {
        if (event.target.value) {
            selectRegion(event.target.value, true);
        } else {
            resetMapView();
        }
    });

    // 3. Le curseur de seuil : filtre visuellement les régions en temps réel
    document.getElementById("threshold-slider").addEventListener("input", function(event) {
        thresholdValue = parseFloat(event.target.value);
        updateThresholdLabel();
        refreshMapStyle();
    });

    // 4. Le bouton "Reset map"
    document.getElementById("reset-view-btn").addEventListener("click", resetMapView);
}

// Remet la carte, le curseur et la liste déroulante à leur état de départ
function resetMapView() {
    const m = METRICS[activeMetric];
    thresholdValue = m.sliderMax;
    document.getElementById("threshold-slider").value = m.sliderMax;
    document.getElementById("region-select").value = "";
    updateThresholdLabel();

    // [Leaflet] closePopup() ferme toute bulle ouverte ; setView() recentre la carte
    map.closePopup();
    map.setView(UK_CENTER, UK_ZOOM);
    refreshMapStyle();
}

// Remplit la liste déroulante et le tableau HTML, triés du 1er au 12e rang
function populateDropdownAndTable(features) {
    const select = document.getElementById("region-select");
    const tbody = document.getElementById("regional-table-body");
    const regionsMisesEnAvant = ["London", "Wales", "North East"];

    // On copie la liste des régions pour la trier par rang sans modifier l'original
    const regionsTriees = [...features];
    regionsTriees.sort(function(a, b) {
        return a.properties.rank_fv - b.properties.rank_fv;
    });

    for (const feature of regionsTriees) {
        const p = feature.properties;

        // Ajoute une option dans le menu déroulant <select>
        const option = document.createElement("option");
        option.value = p.name;
        option.textContent = `#${p.rank_fv} — ${p.name} (${formatGBP(p.fresh_fv)} F&V)`;
        select.appendChild(option);

        // Ajoute une ligne <tr> dans le tableau
        const tr = document.createElement("tr");
        if (regionsMisesEnAvant.includes(p.name)) {
            tr.className = "row-highlight";
        }
        tr.innerHTML = `
      <td>${p.name}</td>
      <td class="num">${formatGBP(p.total)}</td>
      <td class="num"><strong>${formatGBP(p.fresh_fv)}</strong></td>
      <td class="num">${formatGBP(p.convenience)}</td>
      <td class="num">${formatGBP(p.eating_out)}</td>
      <td class="num">#${p.rank_fv}</td>
    `;
        tbody.appendChild(tr);
    }
}

/* ============================================================================
   8. CHARGEMENT DES DONNÉES ET DÉMARRAGE DE L'APPLICATION
   ============================================================================ */

// Charge les données GeoJSON dans la carte, les marqueurs, le tableau et le graphique
function loadGeoJSONIntoApp(geojsonData) {
    // [Leaflet] L.geoJSON() dessine les formes des 12 régions à partir des données GeoJSON
    // - style : fonction qui choisit la couleur de chaque région
    // - onEachFeature : fonction qui branche la popup et les clics sur chaque région
    geojsonLayer = L.geoJSON(geojsonData, {
        style: styleRegion,
        onEachFeature: onEachRegion
    }).addTo(map);

    buildCapitalMarkers(geojsonData.features);
    populateDropdownAndTable(geojsonData.features);

    // Sélectionne Londres par défaut au démarrage (false = sans zoomer ni ouvrir la popup)
    selectRegion("London", false);
}

// Fonction principale lancée dès que la page HTML est prête
function initApp() {
    initLeafletMap();
    initSnapChart();
    bindExternalControls();

    // fetch() télécharge le fichier GeoJSON des régions du Royaume-Uni
    fetch("data/uk_regions_food.geojson")
        .then(function(response) {
            if (!response.ok) throw new Error("Erreur HTTP " + response.status);
            return response.json(); // Transforme le fichier texte en objet JavaScript
        })
        .then(loadGeoJSONIntoApp)
        .catch(function(err) {
            // Si on ouvre le site en local (file://), fetch est bloqué par le navigateur :
            // on utilise alors les données de secours chargées dans uk_regions_fallback.js
            console.warn("Fetch indisponible, utilisation des données de secours :", err);
            if (window.UK_REGIONS_FALLBACK) {
                loadGeoJSONIntoApp(window.UK_REGIONS_FALLBACK);
            }
        });
}

// Attend que tout le HTML soit chargé avant de lancer initApp()
document.addEventListener("DOMContentLoaded", initApp);