/* In Memoriam page: names from data/memorial.json, grouped by colliery, year or age.
   memorial.html#<colliery-id> opens filtered to one colliery. */
(function () {
  'use strict';

  var MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

  var list = document.getElementById('memorial-list');
  var search = document.getElementById('mem-search');
  var pick = document.getElementById('mem-colliery');
  var group = document.getElementById('mem-group');

  var people = [];
  var sources = {};
  var names = {};   // colliery id -> name
  var offMap = {};  // colliery ids with no map pin

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function niceDate(d) {
    var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(d);
    if (!m) return d;
    return m[3] ? MONTHS[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1] : MONTHS[+m[2] - 1] + ' ' + m[1];
  }

  // Ages are recorded as text ("18", "about 40"); null when none is given.
  function ageOf(p) {
    var m = /\d+/.exec(p.age || '');
    return m ? +m[0] : null;
  }

  function personHtml(p, showColliery) {
    var bits = [];
    if (p.age) bits.push('age ' + esc(p.age));
    if (p.job) bits.push(esc(p.job));
    return '<li class="mem-person">' +
      '<div class="mem-name">' + esc(p.name) + (bits.length ? ' <span class="mem-meta">' + bits.join(', ') + '</span>' : '') + '</div>' +
      '<div class="mem-when">' + esc(niceDate(p.date)) +
        (showColliery ? ' · <a href="memorial.html#' + esc(p.colliery) + '">' + esc(names[p.colliery] || p.colliery) + '</a>' : '') + '</div>' +
      (p.cause ? '<div class="mem-cause">' + esc(p.cause) + '</div>' : '') +
      (p.note ? '<div class="mem-note">' + esc(p.note) + '</div>' : '') +
    '</li>';
  }

  function render() {
    var q = search.value.trim().toLowerCase();
    var only = pick.value;
    var byYear = group.value === 'year';
    var byAge = group.value === 'age';
    var shown = people.filter(function (p) {
      if (only && p.colliery !== only) return false;
      if (!q) return true;
      return (p.name + ' ' + p.job + ' ' + p.cause + ' ' + p.note + ' ' + (names[p.colliery] || '')).toLowerCase().indexOf(q) !== -1;
    });

    var groups = {};
    var order = [];
    shown.forEach(function (p) {
      var key = byAge ? (ageOf(p) === null ? 'unknown' : String(ageOf(p)))
        : byYear ? p.date.slice(0, 4) : p.colliery;
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(p);
    });
    if (byAge) order.sort(function (a, b) { return (a === 'unknown') - (b === 'unknown') || a - b; });
    else if (byYear) order.sort();
    else order.sort(function (a, b) { return (names[a] || a).localeCompare(names[b] || b); });

    if (!shown.length) {
      list.innerHTML = '<p class="section-intro">No names match.</p>';
      return;
    }
    list.innerHTML = order.map(function (key) {
      var rows = groups[key].sort(function (a, b) { return a.date.localeCompare(b.date) || a.name.localeCompare(b.name); });
      var title = byAge ? (key === 'unknown' ? 'Age not recorded' : 'Age ' + esc(key))
        : byYear ? esc(key)
        : offMap[key] ? esc(names[key]) + ' <span class="mem-meta">(not on the map)</span>'
        : '<a href="index.html#' + esc(key) + '">' + esc(names[key] || key) + '</a>';
      return '<section class="mem-group">' +
        '<h2>' + title + ' <span class="section-intro">' + rows.length + (rows.length === 1 ? ' name' : ' names') + '</span></h2>' +
        '<ul class="mem-list">' + rows.map(function (p) { return personHtml(p, byYear || byAge); }).join('') + '</ul>' +
      '</section>';
    }).join('');
  }

  function fromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    pick.value = names[id] ? id : '';
    render();
  }

  Promise.all([
    fetch('data/memorial.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
    fetch('data/collieries.geojson', { cache: 'no-cache' }).then(function (r) { return r.json(); })
  ]).then(function (res) {
    var data = res[0];
    (res[1].features || []).forEach(function (f) {
      var p = f.properties || {};
      if (p.id) names[p.id] = p.name || p.id;
    });
    // Collieries whose names are listed here but which have no pin on the map.
    Object.keys(data.off_map || {}).forEach(function (id) {
      if (!names[id]) { names[id] = data.off_map[id]; offMap[id] = true; }
    });
    sources = data.sources || {};
    people = (data.people || []).map(function (r) {
      return { date: r[0], name: r[1], age: r[2], job: r[3], colliery: r[4], cause: r[5], source: r[6], note: r[7] };
    });

    var counts = {};
    people.forEach(function (p) { counts[p.colliery] = (counts[p.colliery] || 0) + 1; });
    Object.keys(names).sort(function (a, b) { return names[a].localeCompare(names[b]); }).forEach(function (id) {
      if (!counts[id]) return;
      var o = document.createElement('option');
      o.value = id;
      o.textContent = names[id] + ' (' + counts[id] + ')';
      pick.appendChild(o);
    });

    document.getElementById('memorial-count').innerHTML =
      '<b>' + people.length.toLocaleString() + '</b> names at <b>' + Object.keys(counts).length + '</b> collieries, so far.';
    document.getElementById('memorial-years').textContent = data.years_searched || '';
    document.getElementById('memorial-unnamed').innerHTML = (data.known_but_unnamed || []).map(function (u) {
      return '<li><b>' + esc(names[u.colliery] || u.colliery) + ', ' + esc(niceDate(u.date)) + ':</b> ' + esc(u.text) + '</li>';
    }).join('');
    document.getElementById('memorial-sources').innerHTML = Object.keys(sources).map(function (k) {
      var s = sources[k];
      var n = people.filter(function (p) { return p.source === k; }).length;
      return '<li><div class="cite-title"><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.title) + '</a></div>' +
        '<div class="section-intro">' + n + (n === 1 ? ' name' : ' names') + '</div></li>';
    }).join('');

    fromHash();
    window.addEventListener('hashchange', fromHash);
  }).catch(function (err) {
    console.error(err);
    var el = document.getElementById('status');
    el.innerHTML = '<strong>The list could not load.</strong> Open this page through a web server (see README.md), not directly from disk.';
    el.hidden = false;
  });

  search.addEventListener('input', render);
  group.addEventListener('change', render);
  pick.addEventListener('change', function () {
    history.replaceState(null, '', pick.value ? '#' + pick.value : location.pathname);
    render();
  });
})();
