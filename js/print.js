/* Printable colliery sheet: print.html#<colliery-id>. Everything on one page from the same data
   files as the map, laid out for paper (see css/print-sheet.css). */
(function () {
  'use strict';

  var U = window.CollieryUtil;
  var esc = U.escapeHtml;
  var sheet = document.getElementById('sheet');
  var MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

  document.getElementById('print-btn').addEventListener('click', function () { window.print(); });

  function niceDate(d) {
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(d || '');
    if (!m) return d || '';
    return m[3] ? MONTHS[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : MONTHS[+m[2] - 1] + ' ' + m[1];
  }

  function firstPhoto(p) {
    if (p.photo_url) return { url: p.photo_url, caption: p.photo_caption, credit: p.photo_credit };
    var ph = (Array.isArray(p.photos) ? p.photos : [])[0];
    return ph ? (typeof ph === 'string' ? { url: ph } : ph) : null;
  }

  // A topographic map image centered on the site, about 3 km across, with a pin drawn over it.
  function mapImage(lat, lng) {
    var halfLng = 1.6 / (111 * Math.cos(lat * Math.PI / 180)), halfLat = 0.8 / 111;
    return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/export' +
      '?bbox=' + [lng - halfLng, lat - halfLat, lng + halfLng, lat + halfLat].join(',') +
      '&bboxSR=4326&imageSR=3857&size=800,400&format=png&f=image';
  }

  function render(f, people) {
    var p = f.properties;
    var lat = f.geometry.coordinates[1], lng = f.geometry.coordinates[0];
    document.title = (p.name || 'Colliery') + ' · Colliery sheet';
    document.getElementById('back').href = 'index.html#' + encodeURIComponent(p.id);

    var opened = p.year_opened ? (p.opened_estimated ? 'c. ' : '') + p.year_opened : '';
    var closed = p.year_closed ? (p.closed_estimated ? 'c. ' : '') + p.year_closed : '';
    var facts = [
      ['Also known as', (p.other_names || []).join('; ')],
      ['Coal field', p.field],
      ['County', p.county],
      ['Nearest town', p.nearest_town],
      ['Operator', p.operator],
      ['Years active', p.years_active],
      ['Opened / closed', opened || closed ? (opened || '?') + ' – ' + (closed || '?') : ''],
      ['Status', p.status],
      ['Location', lat.toFixed(5) + ', ' + lng.toFixed(5)]
    ].filter(function (x) { return x[1]; });

    var photo = firstPhoto(p);
    var notes = [p.opened_estimated && p.opened_estimate_note, p.closed_estimated && p.closed_estimate_note].filter(Boolean);
    var mine = people.filter(function (r) { return r[4] === p.id; }).sort(function (a, b) { return a[0].localeCompare(b[0]); });

    sheet.innerHTML =
      '<header class="sheet-head">' +
        '<p class="kicker">Anthracite Collieries of Pennsylvania · ' + esc(p.field || '') + ' Field</p>' +
        '<h1>' + esc(p.name || '') + '</h1>' +
      '</header>' +
      '<div class="top' + (photo ? '' : ' no-photo') + '">' +
        (photo ? '<figure class="photo"><img src="' + esc(photo.url) + '" alt="">' +
          '<figcaption>' + esc(photo.caption || '') + (photo.credit ? ' <span class="credit">' + esc(photo.credit) + '</span>' : '') + '</figcaption></figure>' : '') +
        '<dl class="facts">' + facts.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' +
      '</div>' +
      '<h2>History</h2><p class="history">' + esc(p.history || 'No history written yet.') + '</p>' +
      (notes.length ? '<p class="note"><b>About the dates:</b> ' + esc(notes.join(' ')) + '</p>' : '') +
      '<h2>Where it was</h2>' +
      '<figure class="map"><div class="map-frame"><img src="' + mapImage(lat, lng) + '" alt="Map of the colliery site"><span class="pin" aria-hidden="true"></span></div>' +
        '<figcaption>' + esc(p.location_note || '') + ' Map: Esri World Topographic Map.</figcaption></figure>' +
      (mine.length
        ? '<h2>In memoriam</h2><p class="intro">The ' + mine.length + (mine.length === 1 ? ' person' : ' people') +
          ' named so far in the records as killed at this colliery:</p>' +
          '<ol class="names">' + mine.map(function (r) {
            return '<li><b>' + esc(r[1]) + '</b>' + (r[2] ? ', ' + esc(r[2]) : '') + ' · ' + esc(niceDate(r[0])) + (r[5] ? ' · ' + esc(r[5]) : '') + '</li>';
          }).join('') + '</ol>'
        : '') +
      '<h2>Sources</h2><ol class="sources">' + (p.sources || []).map(function (s) {
        return '<li>' + esc(typeof s === 'string' ? s : (s.title || s.url || '')) + (s && s.url ? ' <span class="url">' + esc(s.url) + '</span>' : '') + '</li>';
      }).join('') + '</ol>' +
      '<footer>Printed from theman42069.github.io/anthracite-collieries/#' + esc(p.id) + ' on ' + new Date().toLocaleDateString() + '.</footer>';
  }

  var id = decodeURIComponent(location.hash.slice(1));
  Promise.all([
    fetch('data/collieries.geojson').then(function (r) { return r.json(); }),
    fetch('data/memorial.json').then(function (r) { return r.json(); })
  ]).then(function (res) {
    var f = (res[0].features || []).filter(function (x) { return x.properties.id === id; })[0];
    if (!f) {
      sheet.innerHTML = '<p>No colliery called “' + esc(id) + '” was found. Open a colliery on the map and use its “Print” button.</p>';
      return;
    }
    render(f, res[1].people || []);
  }).catch(function () {
    sheet.innerHTML = '<p>The sheet could not load. Open this page through a web server (see README.md), not directly from disk.</p>';
  });
})();
