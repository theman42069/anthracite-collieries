/* Old Mine Maps page: click a spot, list every PA Mine Map Atlas sheet covering it, overlay one.
   Uses Penn State's public services: the Atlas index (ArcGIS MapServer, layers 2 and 3)
   and the georeferenced sheet images (MapServer WMS, one sheet per "mapid").
   minemaps.html?lat=..&lng=.. opens with that spot already clicked. */
(function () {
  'use strict';

  var INDEX = 'https://apps.pasda.psu.edu/arcgis/rest/services/MineMaps/MapServer/';
  var LAYERS = [{ id: 2, label: 'Mine Maps' }, { id: 3, label: 'WPA Mine Maps' }];
  var WMS = 'https://data2.pasda.psu.edu/ms3/mapserv.exe';
  var WMS_MAP = 'C:/mapserver/mapConfig/pasda/mineMaps.map';

  var listEl = document.getElementById('mm-list');
  var statusEl = document.getElementById('mm-status');
  var tools = document.getElementById('mm-tools');
  var filterEl = document.getElementById('mm-filter');
  var hideWbdo = document.getElementById('mm-hide-wbdo');
  var bar = document.getElementById('mm-overlay-bar');
  var barName = document.getElementById('mm-overlay-name');
  var opacityEl = document.getElementById('mm-opacity');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var map = L.map('mm-map', { center: [40.79, -76.40], zoom: 12, minZoom: 7 });
  var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19, attribution: 'Imagery &copy; Esri'
  });
  var streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  L.control.layers({ 'Street map': streets, 'Satellite': satellite }, null, { position: 'topright' }).addTo(map);

  // The site's collieries, as small pins for finding your way.
  fetch('data/collieries.geojson').then(function (r) { return r.json(); }).then(function (g) {
    (g.features || []).forEach(function (f) {
      var c = f.geometry && f.geometry.coordinates;
      if (!c) return;
      L.circleMarker([c[1], c[0]], { radius: 6, color: '#1f1c17', weight: 2, fillColor: '#d4a24c', fillOpacity: 1 })
        .bindTooltip(esc(f.properties.name), { direction: 'top' })
        .on('click', function (e) { L.DomEvent.stopPropagation(e); lookUp(e.latlng); })
        .addTo(map);
    });
  }).catch(function () { /* pins are optional */ });

  var clickMarker = null;
  var outline = L.geoJSON(null, { style: { color: '#e07a5f', weight: 2, fill: false, dashArray: '6 4' } }).addTo(map);
  var overlay = null;
  var overlayId = null;
  var sheets = [];
  var outlines = {};

  function query(layer, latlng) {
    var pt = JSON.stringify({ x: latlng.lng, y: latlng.lat, spatialReference: { wkid: 4326 } });
    var url = INDEX + layer.id + '/query?where=1%3D1&geometry=' + encodeURIComponent(pt) +
      '&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&inSR=4326&outSR=4326' +
      '&outFields=*&returnGeometry=true&geometryPrecision=5&f=json';
    return fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      return (j.features || []).map(function (f) {
        var a = f.attributes || {};
        return {
          id: a.geor_name || a.Local_Shee,
          code: a.Local_Shee || a.geor_name,
          collection: a.Collection || layer.label,
          zone: a.UTMzone || '18N',
          pdf: a.PDF_Path || '',
          rings: f.geometry && f.geometry.rings,
          area: Math.abs(a.Shape_Area || 0)
        };
      });
    });
  }

  function lookUp(latlng) {
    if (clickMarker) clickMarker.setLatLng(latlng);
    else clickMarker = L.marker(latlng).addTo(map);
    outline.clearLayers();
    listEl.innerHTML = '';
    tools.hidden = true;
    statusEl.textContent = 'Looking up mine maps at ' + latlng.lat.toFixed(5) + ', ' + latlng.lng.toFixed(5) + '…';
    history.replaceState(null, '', '?lat=' + latlng.lat.toFixed(5) + '&lng=' + latlng.lng.toFixed(5));
    Promise.all(LAYERS.map(function (l) { return query(l, latlng).catch(function () { return []; }); }))
      .then(function (res) {
        var seen = {};
        sheets = [].concat.apply([], res).filter(function (s) {
          if (!s.id || seen[s.id]) return false;
          seen[s.id] = true;
          return true;
        });
        outlines = {};
        sheets.forEach(function (s) { outlines[s.id] = s.rings; });
        tools.hidden = !sheets.length;
        render();
      });
  }

  function render() {
    var q = filterEl.value.trim().toLowerCase();
    var shown = sheets.filter(function (s) {
      if (hideWbdo.checked && /WBDO/i.test(s.id)) return false;
      return !q || (s.code + ' ' + s.collection).toLowerCase().indexOf(q) !== -1;
    });
    var hidden = sheets.length - shown.length;
    statusEl.textContent = sheets.length
      ? shown.length + ' map' + (shown.length === 1 ? '' : 's') + ' cover this spot' + (hidden ? ' (' + hidden + ' hidden by the filters)' : '') + '. Smaller sheets are usually the detailed ones.'
      : 'No Atlas maps cover this spot.';
    var groups = {};
    var order = [];
    shown.forEach(function (s) {
      if (!groups[s.collection]) { groups[s.collection] = []; order.push(s.collection); }
      groups[s.collection].push(s);
    });
    order.sort();
    listEl.innerHTML = order.map(function (c) {
      var rows = groups[c].sort(function (a, b) { return a.area - b.area || a.code.localeCompare(b.code); });
      return '<section class="mm-group"><h2>' + esc(c) + ' <span>' + rows.length + '</span></h2><ul>' +
        rows.map(function (s) {
          var on = s.id === overlayId;
          return '<li class="mm-sheet' + (on ? ' on' : '') + '" data-id="' + esc(s.id) + '">' +
            '<span class="mm-code">' + esc(s.code) + (s.id !== s.code ? ' <small>' + esc(s.id.replace(/^geor_/, '')) + '</small>' : '') + '</span>' +
            '<span class="mm-actions">' +
              '<button type="button" class="mm-btn mm-show">' + (on ? 'Showing' : 'Show on map') + '</button>' +
              (s.pdf ? '<a class="mm-btn" href="' + esc(s.pdf) + '" target="_blank" rel="noopener">Full scan (PDF)</a>' : '') +
            '</span></li>';
        }).join('') + '</ul></section>';
    }).join('');
  }

  function ringsToGeo(rings) {
    return { type: 'Feature', geometry: { type: 'Polygon', coordinates: rings } };
  }

  function showSheet(id) {
    var s = sheets.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    if (overlay) map.removeLayer(overlay);
    overlay = L.tileLayer.wms(WMS, {
      map: WMS_MAP, mapid: s.id, layers: s.zone, format: 'image/png', transparent: true,
      version: '1.3.0', maxZoom: 21, opacity: opacityEl.value / 100,
      attribution: 'Mine map: <a href="https://www.minemaps.psu.edu/">PA Mine Map Atlas</a>'
    }).addTo(map);
    overlayId = s.id;
    barName.textContent = s.code + ' · ' + s.collection;
    bar.hidden = false;
    outline.clearLayers();
    if (s.rings) {
      outline.addData(ringsToGeo(s.rings));
      map.fitBounds(outline.getBounds(), { padding: [20, 20], maxZoom: 17 });
    }
    render();
  }

  function hideSheet() {
    if (overlay) map.removeLayer(overlay);
    overlay = null;
    overlayId = null;
    bar.hidden = true;
    outline.clearLayers();
    render();
  }

  map.on('click', function (e) { lookUp(e.latlng); });

  listEl.addEventListener('click', function (e) {
    var li = e.target.closest('.mm-sheet');
    if (!li || !e.target.closest('.mm-show')) return;
    if (li.dataset.id === overlayId) hideSheet(); else showSheet(li.dataset.id);
  });
  listEl.addEventListener('mouseover', function (e) {
    var li = e.target.closest('.mm-sheet');
    if (!li || overlayId) return;
    outline.clearLayers();
    if (outlines[li.dataset.id]) outline.addData(ringsToGeo(outlines[li.dataset.id]));
  });
  listEl.addEventListener('mouseleave', function () { if (!overlayId) outline.clearLayers(); });

  filterEl.addEventListener('input', render);
  hideWbdo.addEventListener('change', render);
  opacityEl.addEventListener('input', function () { if (overlay) overlay.setOpacity(opacityEl.value / 100); });
  document.getElementById('mm-overlay-off').addEventListener('click', hideSheet);

  var p = new URLSearchParams(location.search);
  var lat = parseFloat(p.get('lat'));
  var lng = parseFloat(p.get('lng'));
  if (isFinite(lat) && isFinite(lng)) {
    map.setView([lat, lng], 15);
    lookUp(L.latLng(lat, lng));
  }
})();
