// SAÉ 303-2 · data_loader.js
// Charge les données, remplit le menu et le tableau, puis lance la page.

"use strict";

// Menu déroulant et tableau, classés par dépense en fruits et légumes frais
function fillMenuAndTable(features) {
  const tbody = document.getElementById("regional-table-body");
  const sorted = features.map(function (f) { return f.properties; })
    .sort(function (a, b) { return a.rank_fv - b.rank_fv; });

  sorted.forEach(function (p) {
    regionSelect.add(new Option(p.rank_fv + ". " + p.name + " (" + gbp(p.fresh_fv) + ")", p.name));

    const tr = tbody.insertRow();
    if (p.rank_fv === 1 || p.rank_fv >= 11) tr.className = "row-highlight"; // Londres et les deux plus bas
    tr.innerHTML =
      "<td>" + p.name + "</td>" +
      '<td class="num">' + gbp(p.total) + "</td>" +
      '<td class="num"><strong>' + gbp(p.fresh_fv) + "</strong></td>" +
      '<td class="num">' + gbp(p.convenience) + "</td>" +
      '<td class="num">' + gbp(p.eating_out) + "</td>" +
      '<td class="num">' + p.rank_fv + "</td>";
  });
}

// Moyenne simple des 12 régions pour chaque catégorie du graphique
function computeAverages(features) {
  CHART_ROWS.forEach(function (row) {
    const sum = features.reduce(function (total, f) { return total + f.properties[row.key]; }, 0);
    state.averages[row.key] = sum / features.length;
  });
}

function start(data) {
  state.regionsLayer = L.geoJSON(data, { style: regionStyle, onEachFeature: setupRegion }).addTo(state.map);
  addCapitals(data.features);
  fillMenuAndTable(data.features);
  computeAverages(data.features);
  initChart();
  selectRegion("London", false);
}

document.addEventListener("DOMContentLoaded", function () {
  initMap();
  bindControls();

  // Ouvert en double-clic (file://), le navigateur bloque fetch :
  // on se rabat alors sur la copie des données chargée par uk_regions_fallback.js
  fetch("data/uk_regions_food.geojson")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(start)
    .catch(function (err) {
      console.warn("Chargement local des données :", err.message);
      start(window.UK_REGIONS_FALLBACK);
    });
});
