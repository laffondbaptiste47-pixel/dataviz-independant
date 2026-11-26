// SAÉ 303-2 · interactions_notees.js
// Partie évaluée : niveaux 1 à 4 du barème Leaflet.

"use strict";

// ---------------------------------------------------------------------------
// Niveau 1 : carte Leaflet et ses trois interactions
// ---------------------------------------------------------------------------

function initMap() {
    // [Leaflet] L.map() crée la carte dans <div id="uk-map">
    state.map = L.map("uk-map", {
        center: UK_VIEW.center,
        zoom: UK_VIEW.zoom,
        zoomSnap: 0.2,
        minZoom: 4.5,
        maxZoom: 9,
        scrollWheelZoom: false
    });

    // [Leaflet] L.tileLayer() charge un fond de carte 
    const grey = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { attribution: "Tiles &copy; Esri", maxZoom: 16 }
    ).addTo(state.map);
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19
    });

    state.capitalsLayer = L.layerGroup().addTo(state.map);

    // Interaction 3 : [Leaflet] L.control.layers() ajoute le menu des fonds et des calques
    L.control.layers({ "Light grey": grey, "OpenStreetMap": osm }, { "Regional capitals": state.capitalsLayer }).addTo(state.map);

    // [Leaflet] L.control() : panneau d'information en haut à gauche, rempli au survol
    state.info = L.control({ position: "topleft" });
    state.info.onAdd = function() {
        this.div = L.DomUtil.create("div", "leaflet-info-box");
        this.update();
        return this.div;
    };
    state.info.update = function(p) {
        this.div.innerHTML = p ?
            "<h4>" + p.name + "</h4>" +
            '<div class="info-metric">' + gbp(p[state.metric]) + "</div>" +
            '<div class="info-hint">' + METRICS[state.metric].label + ", £ per person per week<br>Fresh produce rank: " + p.rank_fv + " / 12</div>" :
            '<h4>UK food spend</h4><div class="info-hint">Hover over or click a region.</div>';
    };
    state.info.addTo(state.map);

    // Légende en bas à droite, réécrite à chaque changement d'indicateur
    state.legend = L.control({ position: "bottomright" });
    state.legend.onAdd = function() {
        this.div = L.DomUtil.create("div", "leaflet-legend-box");
        this.update();
        return this.div;
    };
    state.legend.update = function() {
        const b = METRICS[state.metric].breaks;
        const labels = ["Under " + gbp(b[0])];
        for (let i = 1; i < b.length; i++) labels.push(gbp(b[i - 1]) + " to " + gbp(b[i]));
        labels.push(gbp(b[b.length - 1]) + " and over");

        let html = "<strong>" + METRICS[state.metric].label + " (£/wk)</strong>";
        labels.forEach(function(text, i) {
            html += '<div><span class="legend-swatch" style="background:' + COLORS[i] + '"></span>' + text + "</div>";
        });
        this.div.innerHTML = html;
    };
    state.legend.addTo(state.map);
}

// Style d'une région : couleur selon l'indicateur, bordure épaisse si sélectionnée, pâle si au-dessus du seuil
function regionStyle(feature) {
    const p = feature.properties;
    const shown = p[state.metric] <= state.threshold;
    const selected = p.name === state.selected;
    return {
        fillColor: colorFor(p[state.metric], state.metric),
        fillOpacity: shown ? 0.85 : 0.22,
        color: selected ? "#121212" : "#FFFFFF",
        weight: selected ? 3.2 : 1.4,
        dashArray: shown ? "" : "3"
    };
}

// [Leaflet] setStyle() recolore toutes les régions
function refreshMap() {
    if (state.regionsLayer) state.regionsLayer.setStyle(regionStyle);
}

// Contenu HTML de la popup qui s'ouvre au clic sur une région
function popupHTML(p) {
    const rows = [
        ["Fresh fruit &amp; veg", p.fresh_fv],
        ["All food at home", p.total],
        ["Convenience foods", p.convenience],
        ["Ready meals", p.ready_meals],
        ["Eating out", p.eating_out]
    ];
    let html = '<div class="indy-popup"><div class="indy-popup-title">' + p.name + " (" + p.capital + ')</div><div class="indy-popup-grid">';
    rows.forEach(function(r) { html += "<span>" + r[0] + "</span><strong>" + gbp(r[1]) + "</strong>"; });
    return html + '</div><div class="indy-popup-note">' + p.note + "</div></div>";
}

// Appelée par L.geoJSON pour chaque région : popup et évènements
function setupRegion(feature, layer) {
    const p = feature.properties;
    state.regions[p.name] = { props: p, layer: layer };
    layer.bindPopup(popupHTML(p));

    // Interaction 1 : survol (surbrillance et panneau d'information)
    layer.on("mouseover", function() {
        layer.setStyle({ weight: 3, color: "#121212", fillOpacity: 0.95 });
        layer.bringToFront();
        state.info.update(p);
    });
    layer.on("mouseout", function() {
        state.regionsLayer.resetStyle(layer);
        state.info.update();
    });

    // Interaction 2 : clic (zoom et popup)
    layer.on("click", function() {
        selectRegion(p.name, true);
    });
}

// [Leaflet] L.circleMarker() : un point par capitale régionale
function addCapitals(features) {
    features.forEach(function(f) {
        const p = f.properties;
        L.circleMarker(p.capital_coords, { radius: 5, fillColor: "#121212", fillOpacity: 0.9, color: "#FFFFFF", weight: 2 })
            .bindTooltip(p.capital + " (" + p.name + ")", { direction: "top" })
            .on("click", function() { selectRegion(p.name, true); })
            .addTo(state.capitalsLayer);
    });
}

// ---------------------------------------------------------------------------
// Niveau 2 : contrôles HTML placés hors de la carte et qui la modifient
// ---------------------------------------------------------------------------

const slider = document.getElementById("threshold-slider");
const regionSelect = document.getElementById("region-select");

function bindControls() {
    document.querySelectorAll(".filter-btn").forEach(function(btn) {
        btn.addEventListener("click", function() { setMetric(btn.dataset.metric); });
    });

    regionSelect.addEventListener("change", function() {
        if (regionSelect.value) selectRegion(regionSelect.value, true);
        else resetView();
    });

    slider.addEventListener("input", function() {
        state.threshold = parseFloat(slider.value);
        showThreshold();
        refreshMap();
    });

    document.getElementById("reset-view-btn").addEventListener("click", resetView);
}

// Change l'indicateur affiché (boutons et graphique Snap.svg)
function setMetric(metric) {
    state.metric = metric;
    const m = METRICS[metric];

    document.querySelectorAll(".filter-btn").forEach(function(btn) {
        const on = btn.dataset.metric === metric;
        btn.classList.toggle("active", on);
        btn.setAttribute("aria-pressed", on);
    });
    document.getElementById("map-panel-title").textContent =
        "Figure 2. Weekly spend per person by region: " + m.label.toLowerCase();

    slider.min = m.slider[0];
    slider.max = m.slider[1];
    slider.step = m.slider[2];
    slider.value = m.slider[1];
    state.threshold = m.slider[1];
    showThreshold();

    refreshMap();
    state.legend.update();
    updateChart();
}

// Sélectionne une région ; si zoom vaut true, [Leaflet] fitBounds() cadre la région et ouvre sa popup
function selectRegion(name, zoom) {
    const region = state.regions[name];
    if (!region) return;
    state.selected = name;
    regionSelect.value = name;
    refreshMap();
    if (zoom) {
        state.map.fitBounds(region.layer.getBounds(), { padding: [45, 45], maxZoom: 7 });
        region.layer.openPopup();
    }
    updateChart(); // niveau 4 : Leaflet vers Snap.svg
}

// Retour à la vue de départ
function resetView() {
    state.threshold = METRICS[state.metric].slider[1];
    slider.value = state.threshold;
    regionSelect.value = "";
    showThreshold();
    state.map.closePopup();
    state.map.setView(UK_VIEW.center, UK_VIEW.zoom);
    refreshMap();
}

// Texte à côté du curseur
function showThreshold() {
    const max = METRICS[state.metric].slider[1];
    document.getElementById("threshold-output").textContent =
        state.threshold >= max ? "All (" + gbp(max) + ")" : "≤ " + gbp(state.threshold);
}

// ---------------------------------------------------------------------------
// Niveau 3 : graphique Snap.svg animé
// ---------------------------------------------------------------------------

// Une ligne par catégorie. maxVal = valeur d'une barre pleine, mapMetric = bouton de la carte lié (null : aucun)
const CHART_ROWS = [
    { key: "total", label: "All food at home", maxVal: 46, color: "#121212", mapMetric: "total" },
    { key: "eating_out", label: "Eating out", maxVal: 20, color: "#5F6368", mapMetric: "eating_out" },
    { key: "convenience", label: "Convenience foods", maxVal: 16, color: "#7F1D1D", mapMetric: "convenience" },
    { key: "fresh_fv", label: "Fresh fruit & veg", maxVal: 6.5, color: "#E01A22", mapMetric: "fresh_fv" },
    { key: "ready_meals", label: "Ready meals", maxVal: 3.6, color: "#9CA3AF", mapMetric: null }
];

const FONT = { fontFamily: "Inter, Arial, sans-serif", fontSize: 12, fontWeight: 600, fill: "#121212" };
const BAR_X = 12,
    BAR_W = 415;

// Dessine la partie fixe du graphique, une fois les données chargées
function initChart() {
    // [Snap.svg] Snap() sélectionne le <svg> ; text(), rect(), line() dessinent, attr() stylise
    const s = Snap("#snap-basket-chart");
    s.clear();

    s.text(12, 18, "Click a bar to show that category on the map").attr(Object.assign({}, FONT, { fill: "#5F6368" }));
    s.rect(12, 30, 12, 10).attr({ fill: "#E01A22" });
    s.text(30, 39, "Selected region (£/wk)").attr(FONT);
    s.line(185, 35, 205, 35).attr({ stroke: "#121212", strokeWidth: 2, strokeDasharray: "4 2" });
    s.text(212, 39, "Average of the 12 regions").attr(Object.assign({}, FONT, { fill: "#5F6368" }));

    CHART_ROWS.forEach(function(row, i) {
        const y = 74 + i * 52;
        const clickable = row.mapMetric ? "pointer" : "default";

        const bg = s.rect(4, y - 22, 512, 46).attr({ fill: "transparent" });
        const label = s.text(BAR_X, y - 6, row.label + (row.mapMetric ? " →" : "")).attr(Object.assign({}, FONT, { fontWeight: 700 }));
        const track = s.rect(BAR_X, y + 2, BAR_W, 16).attr({ fill: "#F3F4F6" });
        const bar = s.rect(BAR_X, y + 2, 0, 16).attr({ fill: row.color }); // largeur 0, animée ensuite
        const avgX = BAR_X + Math.min(state.averages[row.key] / row.maxVal, 1) * BAR_W;
        const avg = s.line(avgX, y - 2, avgX, y + 23).attr({ stroke: "#121212", strokeWidth: 2, strokeDasharray: "3 2" });
        const value = s.text(BAR_X + BAR_W + 10, y + 16, "").attr(Object.assign({}, FONT, { fontSize: 13, fontWeight: 800 }));

        const group = s.g(bg, label, track, bar, avg, value).attr({ cursor: clickable });

        // [Snap.svg] hover() : fond rosé au survol de la ligne
        group.hover(
            function() { bg.animate({ fill: "#FEF2F2" }, 150); },
            function() { bg.animate({ fill: rowFill(row) }, 150); }
        );

        // Niveau 4 : [Snap.svg] click() sur une barre change l'indicateur de la carte
        if (row.mapMetric) group.click(function() { setMetric(row.mapMetric); });

        state.bars[row.key] = { bar: bar, value: value, bg: bg };
    });

    // Niveau 4 : boutons SVG vers la région la plus haute et la plus basse
    const ranked = Object.values(state.regions).map(function(r) { return r.props; })
        .sort(function(a, b) { return b.fresh_fv - a.fresh_fv; });
    const top = ranked[0],
        bottom = ranked[ranked.length - 1];
    jumpButton(s, 12, top.name + " (highest: " + gbp(top.fresh_fv) + ")", top.name, "#E01A22");
    jumpButton(s, 266, bottom.name + " (lowest: " + gbp(bottom.fresh_fv) + ")", bottom.name, "#121212");
}

function rowFill(row) {
    return row.mapMetric === state.metric ? "#FFF1F2" : "transparent";
}

// Bouton SVG qui zoome la carte sur une région
function jumpButton(s, x, text, regionName, color) {
    const rect = s.rect(x, 342, 240, 34).attr({ fill: color });
    const label = s.text(x + 120, 363, text).attr(Object.assign({}, FONT, { textAnchor: "middle", fill: "#FFFFFF", fontWeight: 700 }));
    const btn = s.g(rect, label).attr({ cursor: "pointer" });
    btn.hover(
        function() { rect.animate({ opacity: 0.85 }, 140); },
        function() { rect.animate({ opacity: 1 }, 140); }
    );
    btn.click(function() { selectRegion(regionName, true); });
}

// Met à jour le graphique pour la région sélectionnée
function updateChart() {
    const region = state.regions[state.selected];
    if (!region) return;
    const p = region.props;

    document.getElementById("snap-region-name").textContent = p.name;
    document.getElementById("snap-region-rank").textContent =
        "Rank " + p.rank_fv + " / 12 for fresh produce (" + (p.vs_uk_avg_fv_pct >= 0 ? "+" : "") + p.vs_uk_avg_fv_pct + "% vs average)";
    document.getElementById("snap-region-note").textContent = p.note;

    CHART_ROWS.forEach(function(row) {
        const item = state.bars[row.key];
        const width = Math.max(8, Math.min(p[row.key] / row.maxVal, 1) * BAR_W);
        // [Snap.svg] animate() : la barre glisse en 420 ms (mina.easeinout : départ et arrivée en douceur)
        item.bar.animate({ width: width }, 420, mina.easeinout);
        item.value.attr({ text: gbp(p[row.key]) });
        item.bg.attr({ fill: rowFill(row) });
    });
}