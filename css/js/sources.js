/* Sources page: builds a combined bibliography and photo-credit list from data/collieries.geojson. */
(function () {
  'use strict';

  var DATA_URL = 'data/collieries.geojson';
  var FIELD_COLORS = {
    'northern': '#f2b63c', 'eastern middle': '#4cc3d9', 'western middle': '#ef5b5b', 'southern': '#b28dff'
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Must match app.js so the links open the right panel.
  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
  }

  function colorFor(field) {
    return FIELD_COLORS[String(field || '').toLowerCase().replace(/\s+field$/, '').trim()] || '#9aa0a6';
  }

  // Sort key: ignore leading quotes so "Tiny Village…" sorts under T.
  function sortKey(title) {
    return String(title).replace(/^[\s"'“‘]+/, '').toLowerCase();
  }

  function siteChip(site) {
    return '<a class="chip" href="index.html#' + escapeHtml(site.slug) + '">' +
      '<span class="dot" style="background:' + colorFor(site.field) + '"></span>' +
      escapeHtml(site.name) + '</a>';
  }

  var citations = [];   // { title, url, sites: [] }
  var photos = [];      // { site, url, caption, credit }

  function build(geojson) {
    var byKey = {};
    var sites = [];

    ((geojson && geojson.features) || []).forEach(function (f, i) {
      var p = (f && f.properties) || {};
      var site = {
        name: p.name || 'Unnamed site',
        slug: slugify(p.id) || slugify(p.name) || 'colliery-' + (i + 1),
        field: p.field,
        mapped: !!(f.geometry && f.geometry.type === 'Point')
      };
      sites.push(site);

      var list = Array.isArray(p.sources) ? p.sources : (p.sources ? [p.sources] : []);
      list.forEach(function (src) {
        var title, url;
        if (src && typeof src === 'object') { title = src.title || src.url || ''; url = src.url || ''; }
        else if (isHttpUrl(src)) { title = src; url = src; }
        else { title = String(src || ''); url = ''; }
        if (!title.trim()) return;

        // The same source used by several sites is listed once.
        var key = url ? url.trim().toLowerCase() : title.trim().toLowerCase();
        if (!byKey[key]) {
          byKey[key] = { title: title, url: isHttpUrl(url) ? url : '', sites: [] };
          citations.push(byKey[key]);
        }
        if (byKey[key].sites.indexOf(site) === -1) byKey[key].sites.push(site);
      });

      if (p.photo_url) {
        photos.push({ site: site, url: p.photo_url, caption: p.photo_caption || '', credit: p.photo_credit || '' });
      }
      (Array.isArray(p.photos) ? p.photos : []).forEach(function (ph) {
        if (typeof ph === 'string') ph = { url: ph };
        if (ph && ph.url) photos.push({ site: site, url: ph.url, caption: ph.caption || '', credit: ph.credit || '' });
      });
    });

    citations.sort(function (a, b) { return sortKey(a.title).localeCompare(sortKey(b.title)); });
    photos.sort(function (a, b) { return a.site.name.localeCompare(b.site.name); });
    render('');
  }

  function render(query) {
    var q = query.trim().toLowerCase();
    var matches = function (text) { return !q || String(text).toLowerCase().indexOf(q) !== -1; };

    var shown = citations.filter(function (c) {
      return matches(c.title) || matches(c.url) || c.sites.some(function (s) { return matches(s.name); });
    });
    document.getElementById('cite-count').textContent =
      q ? '(' + shown.length + ' of ' + citations.length + ')' : '(' + citations.length + ')';

    document.getElementById('cite-list').innerHTML = shown.length
      ? shown.map(function (c) {
          var title = c.url
            ? '<a href="' + escapeHtml(c.url) + '" target="_blank" rel="noopener">' + escapeHtml(c.title) + '</a>'
            : escapeHtml(c.title);
          return '<li><div class="cite-title">' + title + '</div>' +
            '<div class="cite-meta">Cited for: ' + c.sites.map(siteChip).join('') + '</div></li>';
        }).join('')
      : '<li class="section-intro">No sources match.</li>';

    var shownPhotos = photos.filter(function (ph) {
      return matches(ph.site.name) || matches(ph.credit) || matches(ph.caption);
    });
    document.getElementById('photo-list').innerHTML = shownPhotos.length
      ? shownPhotos.map(function (ph) {
          var needsCredit = !ph.credit.trim() || /^todo\b/i.test(ph.credit.trim());
          // Web links or relative paths like photos/x.jpg only.
          var link = isHttpUrl(ph.url) || ph.url.indexOf(':') === -1
            ? ' <a href="' + escapeHtml(ph.url) + '" target="_blank" rel="noopener">view photo</a>'
            : '';
          return '<li><div class="cite-title">' +
              (needsCredit
                ? '<span class="credit-missing">Credit needed</span>' + (ph.credit ? ' — ' + escapeHtml(ph.credit) : '')
                : escapeHtml(ph.credit)) +
              link +
            '</div>' +
            '<div class="cite-meta">' + siteChip(ph.site) + (ph.caption ? ' ' + escapeHtml(ph.caption) : '') + '</div></li>';
        }).join('')
      : '<li class="section-intro">No photos yet.</li>';
  }

  document.getElementById('cite-filter').addEventListener('input', function (e) { render(e.target.value); });

  fetch(DATA_URL, { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(build)
    .catch(function (err) {
      console.error('Could not load colliery data:', err);
      var el = document.getElementById('status');
      el.innerHTML = '<strong>Sources could not be loaded.</strong> Open this page through a web server (see README.md), not directly from disk.';
      el.hidden = false;
      el.style.position = 'static';
      el.style.transform = 'none';
    });
})();
