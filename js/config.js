// SAÉ 303-2 · config.js
// Réglages communs et état de la page. Chargé avant les autres scripts.

"use strict";

// Un indicateur par bouton : libellé affiché, bornes des 5 classes de couleur, plage du curseur
const METRICS = {
  fresh_fv:    { label: "Fresh fruit & veg", breaks: [3.2, 3.6, 4.0, 4.5],     slider: [3, 6, 0.1] },
  total:       { label: "All food at home",  breaks: [34.5, 36.5, 38.5, 41.0], slider: [33, 43.5, 0.5] },
  convenience: { label: "Convenience foods", breaks: [11.6, 12.2, 13.0, 14.0], slider: [11, 15, 0.2] },
  eating_out:  { label: "Eating out",        breaks: [10.2, 12.1, 13.3, 14.5], slider: [8.5, 18, 0.5] }
};

// Rouges du plus clair (dépense faible) au plus foncé (dépense forte)
const COLORS = ["#FEE2E2", "#FCA5A5", "#F87171", "#EF4444", "#B91C1C"];

const UK_VIEW = { center: [54.6, -2.8], zoom: 5.4 };

// État partagé par la carte, les contrôles et le graphique
const state = {
  map: null,
  regionsLayer: null,
  capitalsLayer: null,
  info: null,
  legend: null,
  bars: {},          // barres Snap.svg, rangées par catégorie
  regions: {},       // nom de région -> { props, layer }
  averages: {},      // moyennes des 12 régions, calculées au chargement
  metric: "fresh_fv",
  selected: "London",
  threshold: 6
};

function colorFor(value, metric) {
  const breaks = METRICS[metric].breaks;
  let level = 0;
  while (level < breaks.length && value >= breaks[level]) level++;
  return COLORS[level];
}

function gbp(value) {
  return "£" + Number(value).toFixed(2);
}
