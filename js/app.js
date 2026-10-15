/* Anthracite Collieries of Pennsylvania — map app.
   All site data lives in data/collieries.geojson; nothing here needs editing to add a site. */
(function () {
  'use strict';

  // ---------- Configuration ----------

  var DATA_URL = 'data/collieries.geojson';
  var FALLBACK_PHOTO = 'icons/no-photo.svg';
  var START_VIEW = { center: [40.85, -76.45], zoom: 9 }; // Shamokin / Mount Carmel, all four fields in view
  var FOCUS_ZOOM = 15;
  var MOBILE_QUERY = window.matchMedia('(max-width: 720px)');

  // Coal fields, in legend order. The pin color shows the field.
  var FIELDS = [
    { key: 'Northern',       label: 'Northern Field',       color: '#f2b63c' },
    { key: 'Eastern Middle', label: 'Eastern Middle Field', color: '#4cc3d9' },
    { key: 'Western Middle', label: 'Western Middle Field', color: '#ef5b5b' },
    { key: 'Southern',       label: 'Southern Field',       color: '#b28dff' }
  ];
  var OTHER_FIELD = { key: 'Other', label: 'Other / unknown', color: '#9aa0a6' };

  // Kinds of coal infrastructure. The symbol inside the pin shows the type.
  // Each glyph is drawn in the pin's 34×42 box with a dark stroke.
  var TYPES = [
    { key: 'colliery', label: 'Colliery', glyph: function (c) {
      return '<path d="M11.2 25.5 L17 11 L22.8 25.5"/><path d="M17 11 V25.5"/>' +
             '<path d="M13 21 H21 M14.6 16.5 H19.4"/><circle cx="17" cy="9" r="2.6" fill="' + c + '"/>' +
             '<path d="M9.5 25.5 H24.5"/>';
    } },
    { key: 'breaker', label: 'Breaker or cleaning plant', glyph: function () {
      return '<path d="M9.5 25.5 V19 L13 16 V13 L17 9.5 L21 13 V16 L24.5 19 V25.5 Z"/>' +
             '<path d="M13 21.5 H15 M19 21.5 H21 M16 16.5 H18"/>';
    } },
    { key: 'shaft', label: 'Shaft, slope or drift', glyph: function () {
      return '<path d="M9 25.5 H25"/><path d="M11.5 25.5 V17.5 A5.5 5.5 0 0 1 22.5 17.5 V25.5"/>' +
             '<path d="M15 25.5 V20.5 H19 V25.5"/>';
    } },
    { key: 'culm bank', label: 'Culm bank', glyph: function () {
      return '<path d="M8.5 25.5 L15 13.5 L18.5 18.5 L20.5 16 L25.5 25.5 Z"/><path d="M12.5 22 H16 M18 23.5 H21"/>';
    } }
  ];
  var OTHER_TYPE = { key: 'other', label: 'Other coal site', glyph: function () {
    return '<circle cx="17" cy="17.5" r="4.5"/>';
  } };
  // Other words people might type for the same thing.
  var TYPE_ALIASES = {
    'washery': 'breaker', 'cleaning plant': 'breaker', 'cleaner': 'breaker', 'central breaker': 'breaker',
    'slope': 'shaft', 'drift': 'shaft', 'mine opening': 'shaft',
    'culm': 'culm bank', 'refuse bank': 'culm bank', 'culm pile': 'culm bank'
  };

  // Readable names for status_tags. Tags not listed here still work and show as written.
  var STATUS_LABELS = {
    'demolished': 'Demolished',
    'strip-mined': 'Strip-mined',
    'redeveloped': 'Redeveloped',
    'reclaimed': 'Reclaimed',
    'culm bank remains': 'Culm bank remains',
    'structures standing': 'Structures still standing',
    'mining continues': 'Mining or reprocessing continues',
    'nothing remains': 'Nothing remains'
  };

  // ---------- Map and base layers ----------

  var map = L.map('map', {
    center: START_VIEW.center,
    zoom: START_VIEW.zoom,
    minZoom: 6,
    zoomControl: true
  });

  var satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Imagery &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
    });

  var placeLabels = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Labels &copy; Esri'
    });

  // Scanned USGS paper topo maps (quad dates vary, mostly mid-to-late 1900s). Detail stops at zoom 15.
  var oldTopo = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/USA_Topo_Maps/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      maxNativeZoom: 15,
      attribution: 'Scanned USGS topographic maps &copy; 2013 National Geographic Society, i-cubed, via <a href="https://www.esri.com/">Esri</a>'
    });

  var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM &mdash; Map style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
  });

  var streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  satellite.addTo(map);
  placeLabels.addTo(map);

  L.control.layers(
    { 'Satellite': satellite, 'Old USGS topo maps': oldTopo, 'Topographic (modern)': topo, 'Street map': streets },
    { 'Place labels': placeLabels },
    { position: 'topright' }
  ).addTo(map);

  var clusters = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 45,
    disableClusteringAtZoom: FOCUS_ZOOM,
    iconCreateFunction: function (cluster) {
      return L.divIcon({
        html: '<span>' + cluster.getChildCount() + '</span>',
        className: 'colliery-cluster',
        iconSize: [40, 40]
      });
    }
  }).addTo(map);

  // ---------- State ----------

  var items = [];   // { slug, props, latlng, field, type, opened, closed, operators, statusTags, related, marker }
  var bySlug = {};
  var filters = {
    fields: {},     // field key -> false when hidden
    types: {},      // type key -> false when hidden
    year: null,     // null = all years
    operator: '',   // '' = any operator
    status: ''      // '' = any status
  };
  var current = null;      // the site whose panel is open
  var legendControl = null;

  // ---------- Helpers ----------

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

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

  function listOf(value) {
    if (Array.isArray(value)) return value.filter(function (v) { return v != null && v !== ''; });
    return value != null && value !== '' ? [value] : [];
  }

  function toYear(value) {
    var n = parseInt(value, 10);
    return isFinite(n) ? n : null;
  }

  function isDated(it) {
    return it.opened !== null || it.closed !== null;
  }

  // Undated sites always show; dated ones show if they were operating in the chosen year.
  function activeIn(it, year) {
    if (year === null || !isDated(it)) return true;
    return (it.opened === null || it.opened <= year) && (it.closed === null || year <= it.closed);
  }

  function fieldOk(it) { return filters.fields[it.field.key] !== false; }
  function typeOk(it) { return filters.types[it.type.key] !== false; }
  function operatorOk(it) { return !filters.operator || it.operators.indexOf(filters.operator) !== -1; }
  function statusOk(it) { return !filters.status || it.statusTags.indexOf(filters.status) !== -1; }

  function isVisible(it) {
    return fieldOk(it) && typeOk(it) && activeIn(it, filters.year) && operatorOk(it) && statusOk(it);
  }

  function anyFilterOn() {
    var off = function (obj) { return Object.keys(obj).some(function (k) { return obj[k] === false; }); };
    return off(filters.fields) || off(filters.types) || filters.year !== null || !!filters.operator || !!filters.status;
  }

  function fieldFor(value) {
    var wanted = String(value || '').toLowerCase().replace(/\s+field$/, '').trim();
    for (var i = 0; i < FIELDS.length; i++) {
      if (FIELDS[i].key.toLowerCase() === wanted) return FIELDS[i];
    }
    return OTHER_FIELD;
  }

  function typeFor(value) {
    var wanted = String(value || 'colliery').toLowerCase().trim();
    wanted = TYPE_ALIASES[wanted] || wanted;
    for (var i = 0; i < TYPES.length; i++) {
      if (TYPES[i].key === wanted) return TYPES[i];
    }
    return OTHER_TYPE;
  }

  // Company names for the operator filter: the "operators" list if given,
  // otherwise the "operator" text split at semicolons with (dates) removed.
  function operatorsFor(props) {
    var list = listOf(props.operators);
    if (!list.length && props.operator) {
      list = String(props.operator).split(';').map(function (s) {
        return s.replace(/\([^)]*\)/g, '').replace(/[,\s]+$/, '').trim();
      });
    }
    return list.map(function (s) { return String(s).trim(); }).filter(Boolean);
  }

  function statusLabel(tag) {
    return STATUS_LABELS[tag] || tag.charAt(0).toUpperCase() + tag.slice(1);
  }

  function markerSvg(color, type, size) {
    var w = size || 34;
    var h = Math.round(w * 42 / 34);
    return '' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 42" width="' + w + '" height="' + h + '" aria-hidden="true">' +
        '<path class="pin" d="M17 1.5C8.4 1.5 1.5 8.3 1.5 16.7 1.5 27.6 17 40.5 17 40.5S32.5 27.6 32.5 16.7C32.5 8.3 25.6 1.5 17 1.5z" ' +
          'fill="' + color + '" stroke="#16181b" stroke-width="1.5"/>' +
        '<g fill="none" stroke="#16181b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          (type || TYPES[0]).glyph(color) +
        '</g>' +
      '</svg>';
  }

  var iconCache = {};
  function iconFor(field, type) {
    var key = field.key + '|' + type.key;
    if (!iconCache[key]) {
      iconCache[key] = L.divIcon({
        className: 'colliery-marker',
        html: markerSvg(field.color, type),
        iconSize: [34, 42],
        iconAnchor: [17, 41],
        tooltipAnchor: [0, -38]
      });
    }
    return iconCache[key];
  }

  function showStatus(html) {
    var el = document.getElementById('status');
    el.innerHTML = html;
    el.hidden = false;
  }

  // ---------- Data loading ----------

  function load() {
    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(init)
      .catch(function (err) {
        console.error('Could not load colliery data:', err);
        var hint = location.protocol === 'file:'
          ? ' Browsers block data files opened directly from disk. Run a local web server (see README.md) and open <code>http://localhost:8000</code>.'
          : ' Check that <code>' + DATA_URL + '</code> exists and is valid JSON.';
        showStatus('<strong>Colliery data could not be loaded.</strong>' + hint);
      });
  }

  function init(geojson) {
    var features = (geojson && geojson.features) || [];

    features.forEach(function (feature, index) {
      var geom = feature && feature.geometry;
      var props = (feature && feature.properties) || {};
      if (!geom || geom.type !== 'Point' || !Array.isArray(geom.coordinates)) {
        console.warn('Skipping feature #' + index + ' (needs a Point geometry):', props.name);
        return;
      }
      var lng = Number(geom.coordinates[0]);
      var lat = Number(geom.coordinates[1]);
      if (!isFinite(lat) || !isFinite(lng)) {
        console.warn('Skipping feature #' + index + ' (bad coordinates):', props.name);
        return;
      }

      // Unique, URL-safe slug: explicit "id" wins, else derived from the name.
      var base = slugify(props.id) || slugify(props.name) || 'colliery-' + (index + 1);
      var slug = base;
      for (var n = 2; bySlug[slug]; n++) slug = base + '-' + n;

      var item = {
        slug: slug,
        props: props,
        latlng: L.latLng(lat, lng),
        field: fieldFor(props.field),
        type: typeFor(props.type),
        opened: toYear(props.year_opened),
        closed: toYear(props.year_closed),
        operators: operatorsFor(props),
        statusTags: listOf(props.status_tags).map(function (t) { return String(t).toLowerCase().trim(); }),
        related: []
      };

      item.marker = L.marker(item.latlng, {
        icon: iconFor(item.field, item.type),
        title: props.name || 'Unnamed site',
        alt: props.name || 'Unnamed site',
        keyboard: true,
        riseOnHover: true
      });
      item.marker.bindTooltip(escapeHtml(props.name || 'Unnamed site'), {
        direction: 'top',
        className: 'colliery-tooltip'
      });
      item.marker.on('click', function () { select(item, false); });
      item.marker.on('add', function () { syncActiveMarker(); });

      items.push(item);
      bySlug[slug] = item;
    });

    linkRelated();

    items.sort(function (a, b) {
      return String(a.props.name || '').localeCompare(String(b.props.name || ''));
    });

    buildLegend();
    applyFilters();
    handleRoute();
  }

  // "related" works both ways: listing B on A also shows A on B.
  // Entries can be an id string or { "id": "...", "note": "..." }.
  function linkRelated() {
    function add(a, b, note) {
      var existing = a.related.filter(function (r) { return r.item === b; })[0];
      if (existing) { if (note && !existing.note) existing.note = note; return; }
      a.related.push({ item: b, note: note });
    }
    items.forEach(function (it) {
      listOf(it.props.related).forEach(function (ref) {
        var id = typeof ref === 'string' ? ref : ref && ref.id;
        var note = (ref && typeof ref === 'object' && ref.note) || '';
        var target = bySlug[id] || bySlug[slugify(id)];
        if (!target || target === it) {
          console.warn('"' + it.props.name + '" lists a related site that does not exist:', id);
          return;
        }
        add(it, target, note);
        add(target, it, note);
      });
    });
  }

  // ---------- Legend + filters ----------

  function countWhere(test) {
    return items.filter(test).length;
  }

  function legendRow(group, key, label, svg, count) {
    return '' +
      '<label class="legend-row" data-group="' + group + '">' +
        '<input type="checkbox" checked value="' + escapeHtml(key) + '">' +
        svg +
        '<span class="label">' + escapeHtml(label) + '</span>' +
        '<span class="count">' + count + '</span>' +
      '</label>';
  }

  function buildLegend() {
    var fields = FIELDS.slice();
    if (items.some(function (it) { return it.field === OTHER_FIELD; })) fields.push(OTHER_FIELD);

    // Site types only appear once the data has more than one kind of site.
    var types = TYPES.concat([OTHER_TYPE]).filter(function (t) {
      return items.some(function (it) { return it.type === t; });
    });

    var fieldRows = fields.map(function (f) {
      return legendRow('fields', f.key, f.label, markerSvg(f.color, TYPES[0], 18),
        countWhere(function (it) { return it.field === f; }));
    }).join('');

    var typeRows = types.length > 1
      ? '<h4 class="legend-heading">Site types</h4>' + types.map(function (t) {
          return legendRow('types', t.key, t.label, markerSvg('#c9c2b4', t, 18),
            countWhere(function (it) { return it.type === t; }));
        }).join('')
      : '';

    var Legend = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd: function () {
        var details = L.DomUtil.create('details', 'legend');
        if (!MOBILE_QUERY.matches) details.open = true;

        details.innerHTML = '' +
          '<summary>Filter map <span class="summary-badge" hidden></span></summary>' +
          '<div class="legend-body">' +
            '<h4 class="legend-heading">Coal fields <span class="hint">pin color</span></h4>' + fieldRows +
            (typeRows ? typeRows.replace('Site types</h4>', 'Site types <span class="hint">pin symbol</span></h4>') : '') +
            timelineHtml() +
            moreFiltersHtml() +
            '<button type="button" class="reset-filters" hidden>Show everything</button>' +
            '<p class="legend-note"><span class="mini-cluster">3</span>Ringed numbers are groups of nearby sites. Zoom in or click to expand.</p>' +
          '</div>';

        details.addEventListener('change', function (e) {
          var t = e.target;
          var row = t.closest('.legend-row');
          if (row) {
            filters[row.dataset.group][t.value] = t.checked ? true : false;
            applyFilters();
          } else if (t.id === 'timeline-on') {
            filters.year = t.checked ? Number(details.querySelector('#timeline-range').value) : null;
            applyFilters();
          } else if (t.id === 'filter-operator') {
            filters.operator = t.value;
            applyFilters();
          } else if (t.id === 'filter-status') {
            filters.status = t.value;
            applyFilters();
          }
        });

        var range = details.querySelector('#timeline-range');
        if (range) {
          range.addEventListener('input', function () {
            filters.year = Number(range.value);
            applyFilters();
          });
        }

        details.querySelector('.reset-filters').addEventListener('click', resetFilters);

        L.DomEvent.disableClickPropagation(details);
        L.DomEvent.disableScrollPropagation(details);
        return details;
      }
    });

    legendControl = new Legend();
    legendControl.addTo(map);
  }

  function timelineHtml() {
    var years = [];
    items.forEach(function (it) {
      if (it.opened !== null) years.push(it.opened);
      if (it.closed !== null) years.push(it.closed);
    });
    if (!years.length) return '';

    var min = Math.floor(Math.min.apply(null, years) / 10) * 10;
    var max = Math.ceil(Math.max.apply(null, years) / 10) * 10;
    if (max === min) max = min + 10;
    var start = Math.round((min + max) / 20) * 10;
    var undated = countWhere(function (it) { return !isDated(it); });

    return '' +
      '<div class="timeline is-off">' +
        '<h4 class="legend-heading">Years</h4>' +
        '<label class="timeline-toggle">' +
          '<input type="checkbox" id="timeline-on">' +
          '<span>Only show sites working in</span>' +
          '<output id="timeline-year" for="timeline-range">' + start + '</output>' +
        '</label>' +
        '<input type="range" id="timeline-range" min="' + min + '" max="' + max + '" step="1" value="' + start + '" aria-label="Year">' +
        '<div class="timeline-scale"><span>' + min + '</span><span>' + max + '</span></div>' +
        (undated
          ? '<p class="timeline-note">' + undated + (undated === 1 ? ' site has' : ' sites have') + ' no dates yet and always ' + (undated === 1 ? 'shows' : 'show') + '.</p>'
          : '') +
      '</div>';
  }

  function moreFiltersHtml() {
    var operators = [];
    var tags = [];
    items.forEach(function (it) {
      it.operators.forEach(function (o) { if (operators.indexOf(o) === -1) operators.push(o); });
      it.statusTags.forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); });
    });
    operators.sort(function (a, b) { return a.localeCompare(b); });
    tags.sort(function (a, b) { return statusLabel(a).localeCompare(statusLabel(b)); });
    if (!operators.length && !tags.length) return '';

    function options(list, labelFor) {
      return list.map(function (v) {
        return '<option value="' + escapeHtml(v) + '">' + escapeHtml(labelFor(v)) + '</option>';
      }).join('');
    }

    return '' +
      '<div class="more-filters">' +
        '<h4 class="legend-heading">More filters</h4>' +
        (operators.length
          ? '<label class="select-row"><span>Operator</span>' +
              '<select id="filter-operator"><option value="">Any operator</option>' +
                options(operators, function (o) { return o; }) +
              '</select></label>'
          : '') +
        (tags.length
          ? '<label class="select-row"><span>Today</span>' +
              '<select id="filter-status"><option value="">Any condition</option>' +
                options(tags, statusLabel) +
              '</select></label>'
          : '') +
      '</div>';
  }

  // Make the legend's controls match the current filters.
  function syncLegend() {
    var box = legendControl && legendControl.getContainer();
    if (!box) return;

    Array.prototype.forEach.call(box.querySelectorAll('.legend-row'), function (row) {
      var input = row.querySelector('input');
      var on = filters[row.dataset.group][input.value] !== false;
      input.checked = on;
      row.classList.toggle('is-off', !on);
    });

    var timeline = box.querySelector('.timeline');
    if (timeline) {
      var yearOn = filters.year !== null;
      box.querySelector('#timeline-on').checked = yearOn;
      timeline.classList.toggle('is-off', !yearOn);
      if (yearOn) {
        box.querySelector('#timeline-range').value = filters.year;
        box.querySelector('#timeline-year').textContent = filters.year;
      }
    }

    var op = box.querySelector('#filter-operator');
    if (op) op.value = filters.operator;
    var st = box.querySelector('#filter-status');
    if (st) st.value = filters.status;

    var on = anyFilterOn();
    var badge = box.querySelector('.summary-badge');
    badge.hidden = !on;
    badge.textContent = filters.year !== null ? filters.year : 'On';
    box.querySelector('.reset-filters').hidden = !on;
  }

  function resetFilters() {
    filters.fields = {};
    filters.types = {};
    filters.year = null;
    filters.operator = '';
    filters.status = '';
    applyFilters();
  }

  // Clear only the filters that hide this site (used by share links, search and the list).
  function reveal(item) {
    if (isVisible(item)) return;
    if (!fieldOk(item)) filters.fields[item.field.key] = true;
    if (!typeOk(item)) filters.types[item.type.key] = true;
    if (!activeIn(item, filters.year)) filters.year = null;
    if (!operatorOk(item)) filters.operator = '';
    if (!statusOk(item)) filters.status = '';
    applyFilters();
  }

  function applyFilters() {
    clusters.clearLayers();
    clusters.addLayers(items.filter(isVisible).map(function (it) { return it.marker; }));
    syncLegend();
    renderList();
  }

  // ---------- Detail panel ----------

  var panel = document.getElementById('panel');
  var panelImg = document.getElementById('panel-img');
  var copyBtn = document.getElementById('copy-link');

  panelImg.addEventListener('error', function () {
    if (panelImg.dataset.fallback === '1') return;
    panelImg.dataset.fallback = '1';
    panelImg.title = '';
    panelImg.src = FALLBACK_PHOTO;
    panelImg.alt = 'No photo available';
    document.getElementById('panel-caption').textContent = 'Photo could not be loaded.';
  });

  // ---------- Photo gallery ----------

  var gallery = [];      // { url, caption, credit }
  var galleryIndex = 0;
  var galleryName = '';

  // photo_url/photo_caption/photo_credit come first, then anything in "photos".
  function photosFor(p) {
    var list = [];
    if (p.photo_url) list.push({ url: p.photo_url, caption: p.photo_caption || '', credit: p.photo_credit || '' });
    listOf(p.photos).forEach(function (ph) {
      if (typeof ph === 'string') ph = { url: ph };
      if (ph && ph.url) list.push({ url: ph.url, caption: ph.caption || '', credit: ph.credit || '' });
    });
    return list;
  }

  function showPhoto(index) {
    var count = gallery.length;
    var caption = document.getElementById('panel-caption');
    var credit = document.getElementById('panel-credit');

    if (!count) {
      panelImg.dataset.fallback = '1';
      panelImg.title = '';
      panelImg.src = FALLBACK_PHOTO;
      panelImg.alt = 'No photo available';
      caption.textContent = 'No photo yet.';
      credit.textContent = '';
    } else {
      galleryIndex = (index + count) % count;
      var ph = gallery[galleryIndex];
      panelImg.dataset.fallback = '0';
      panelImg.title = 'Open full size';
      panelImg.src = ph.url;
      panelImg.alt = ph.caption || 'Photo of ' + galleryName;
      caption.textContent = ph.caption;
      credit.textContent = ph.credit ? 'Credit: ' + ph.credit : '';
    }

    var many = count > 1;
    document.getElementById('photo-prev').hidden = !many;
    document.getElementById('photo-next').hidden = !many;
    var counter = document.getElementById('photo-count');
    counter.hidden = !many;
    counter.textContent = many ? (galleryIndex + 1) + ' / ' + count : '';
  }

  // Click a photo to see it full size.
  panelImg.addEventListener('click', function () {
    if (panelImg.dataset.fallback !== '1') window.open(panelImg.src, '_blank', 'noopener');
  });

  document.getElementById('photo-prev').addEventListener('click', function () { showPhoto(galleryIndex - 1); });
  document.getElementById('photo-next').addEventListener('click', function () { showPhoto(galleryIndex + 1); });

  // Swipe left/right on the photo on phones.
  var swipeStartX = null;
  var frame = document.getElementById('photo-frame');
  frame.addEventListener('touchstart', function (e) { swipeStartX = e.touches[0].clientX; }, { passive: true });
  frame.addEventListener('touchend', function (e) {
    if (swipeStartX === null || gallery.length < 2) return;
    var dx = e.changedTouches[0].clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(dx) > 40) showPhoto(galleryIndex + (dx < 0 ? 1 : -1));
  });

  function renderPanel(item) {
    var p = item.props;
    var name = p.name || 'Unnamed site';

    galleryName = name;
    gallery = photosFor(p);
    showPhoto(0);

    document.getElementById('panel-sample').hidden = !p.sample;

    var fieldTag = document.getElementById('panel-field');
    fieldTag.textContent = (item.field === OTHER_FIELD ? (p.field || 'Coal field unknown') : item.field.label) +
      ' · ' + (item.type === OTHER_TYPE ? (p.type || OTHER_TYPE.label) : item.type.label);
    fieldTag.style.setProperty('--field-color', item.field.color);

    document.getElementById('panel-name').textContent = name;

    var facts = [
      ['Also known as', listOf(p.other_names).join('; ')],
      ['Coal field', p.field],
      ['County', p.county],
      ['Nearest town', p.nearest_town],
      ['Operator', p.operator],
      ['Years active', p.years_active],
      ['Status', p.status],
      ['Coordinates', item.latlng.lat.toFixed(5) + ', ' + item.latlng.lng.toFixed(5)]
    ];
    document.getElementById('panel-facts').innerHTML = facts
      .filter(function (f) { return f[1] != null && String(f[1]).trim() !== ''; })
      .map(function (f) { return '<dt>' + escapeHtml(f[0]) + '</dt><dd>' + escapeHtml(f[1]) + '</dd>'; })
      .join('');

    document.getElementById('panel-history').textContent = p.history || 'No history written yet.';
    document.getElementById('panel-confidence-wrap').hidden = !p.confidence;
    document.getElementById('panel-confidence').textContent = p.confidence || '';

    var related = item.related.slice().sort(function (a, b) {
      return String(a.item.props.name).localeCompare(String(b.item.props.name));
    });
    document.getElementById('panel-related-wrap').hidden = !related.length;
    document.getElementById('panel-related').innerHTML = related.map(function (r) {
      return '<li><a href="#' + escapeHtml(r.item.slug) + '">' +
        '<span class="dot" style="background:' + r.item.field.color + '"></span>' +
        '<span class="related-text">' +
          '<span class="name">' + escapeHtml(r.item.props.name || 'Unnamed site') + '</span>' +
          (r.note ? '<span class="note">' + escapeHtml(r.note) + '</span>' : '') +
        '</span>' +
      '</a></li>';
    }).join('');

    var sources = listOf(p.sources);
    document.getElementById('panel-sources').innerHTML = sources.length
      ? sources.map(renderSource).join('')
      : '<li class="none">No sources listed yet.</li>';

    copyBtn.textContent = 'Copy link to this site';
  }

  // A source can be a plain citation string, a URL, or { "title": "...", "url": "..." }.
  function renderSource(src) {
    if (src && typeof src === 'object') {
      var title = src.title || src.url || '';
      return isHttpUrl(src.url)
        ? '<li><a href="' + escapeHtml(src.url) + '" target="_blank" rel="noopener">' + escapeHtml(title) + '</a></li>'
        : '<li>' + escapeHtml(title) + '</li>';
    }
    return isHttpUrl(src)
      ? '<li><a href="' + escapeHtml(src) + '" target="_blank" rel="noopener">' + escapeHtml(src) + '</a></li>'
      : '<li>' + escapeHtml(src) + '</li>';
  }

  function openPanel(item, fly) {
    current = item;
    reveal(item);
    renderPanel(item);
    panel.scrollTop = 0;
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('panel-open');
    document.title = (item.props.name || 'Site') + ' · Anthracite Collieries of Pennsylvania';
    syncActiveMarker();
    renderList();

    var zoom = fly ? Math.max(map.getZoom(), FOCUS_ZOOM) : map.getZoom();
    var target = offsetForPanel(item.latlng, zoom);
    if (fly) map.flyTo(target, zoom, { duration: 1.2 });
    else map.panTo(target);
  }

  function closePanel() {
    if (!current) return;
    current = null;
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('panel-open');
    document.title = 'Anthracite Collieries of Pennsylvania';
    syncActiveMarker();
    renderList();
    if (location.hash) history.pushState(null, '', location.pathname + location.search);
  }

  // Shift the map center so the marker sits in the visible area next to the panel/sheet.
  function offsetForPanel(latlng, zoom) {
    var dx = 0, dy = 0;
    if (MOBILE_QUERY.matches) dy = panel.offsetHeight / 2;
    else dx = panel.offsetWidth / 2;
    var point = map.project(latlng, zoom).add([dx, dy]);
    return map.unproject(point, zoom);
  }

  function syncActiveMarker() {
    items.forEach(function (it) {
      var el = it.marker.getElement();
      if (el) el.classList.toggle('is-active', it === current);
    });
  }

  panel.querySelector('.panel-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!listPanel.hidden) { closeList(true); return; }
    if (current && document.activeElement !== searchInput) closePanel();
  });

  copyBtn.addEventListener('click', function () {
    var url = location.href;
    var done = function () { copyBtn.textContent = 'Link copied!'; };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); });
    } else {
      window.prompt('Copy this link:', url);
    }
  });

  // ---------- Routing (shareable #slug links) ----------

  function select(item, fly) {
    if (location.hash !== '#' + item.slug) history.pushState(null, '', '#' + item.slug);
    openPanel(item, fly);
  }

  function handleRoute() {
    var slug = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!slug) { closePanel(); return; }
    var item = bySlug[slug] || bySlug[slugify(slug)];
    if (!item) {
      console.warn('No site matches #' + slug);
      return;
    }
    if (item !== current) openPanel(item, true);
  }

  window.addEventListener('hashchange', handleRoute);
  window.addEventListener('popstate', handleRoute);

  // ---------- Site list (drop-down in the header) ----------

  var listMenu = document.getElementById('list-menu');
  var listToggle = document.getElementById('list-toggle');
  var listPanel = document.getElementById('list-panel');
  var listItems = document.getElementById('list-items');

  function renderList() {
    var visible = items.filter(isVisible);
    document.getElementById('list-count').textContent = visible.length;

    var head = visible.length === items.length
      ? 'All ' + items.length + ' sites, A–Z'
      : 'Showing ' + visible.length + ' of ' + items.length + ' (filters on)';
    document.getElementById('list-head').textContent = head;

    listItems.innerHTML = visible.length
      ? visible.map(function (it) {
          var meta = [
            it.type === TYPES[0] ? '' : it.type.label,
            it.field === OTHER_FIELD ? '' : it.field.key,
            it.props.years_active
          ].filter(Boolean).join(' · ');
          return '<li><button type="button" data-slug="' + escapeHtml(it.slug) + '"' +
            (it === current ? ' aria-current="true"' : '') + '>' +
            '<span class="dot" style="background:' + it.field.color + '"></span>' +
            '<span class="list-text">' +
              '<span class="name">' + escapeHtml(it.props.name || 'Unnamed site') + '</span>' +
              '<span class="meta">' + escapeHtml(meta) + '</span>' +
            '</span>' +
          '</button></li>';
        }).join('')
      : '<li class="empty">No sites match the current filters.</li>';
  }

  function openList() {
    hideResults();
    renderList();
    listPanel.hidden = false;
    listToggle.setAttribute('aria-expanded', 'true');
    var active = listItems.querySelector('[aria-current="true"]');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function closeList(refocus) {
    listPanel.hidden = true;
    listToggle.setAttribute('aria-expanded', 'false');
    if (refocus) listToggle.focus();
  }

  listToggle.addEventListener('click', function () {
    if (listPanel.hidden) openList(); else closeList();
  });

  listItems.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-slug]');
    if (!btn) return;
    closeList();
    select(bySlug[btn.dataset.slug], true);
  });

  // Click anywhere else closes it.
  document.addEventListener('click', function (e) {
    if (!listPanel.hidden && !listMenu.contains(e.target)) closeList();
  });

  // ---------- Search ----------

  var searchInput = document.getElementById('search-input');
  var resultsList = document.getElementById('search-results');
  var results = [];
  var activeIndex = -1;

  function runSearch() {
    var q = searchInput.value.trim().toLowerCase();
    if (!q) { hideResults(); return; }

    var has = function (text) { return String(text || '').toLowerCase().indexOf(q) !== -1; };
    results = items.filter(function (it) {
      return has(it.props.name) || has(it.props.nearest_town) || listOf(it.props.other_names).some(has);
    }).slice(0, 8);
    activeIndex = results.length ? 0 : -1;
    renderResults();
  }

  function renderResults() {
    resultsList.innerHTML = results.length
      ? results.map(function (it, i) {
          return '<li role="option" id="result-' + i + '" data-index="' + i + '" aria-selected="' + (i === activeIndex) + '">' +
            '<span class="dot" style="background:' + it.field.color + '"></span>' +
            '<span class="name">' + escapeHtml(it.props.name || 'Unnamed site') + '</span>' +
            '<span class="meta">' + escapeHtml(it.field === OTHER_FIELD ? '' : it.field.key) + '</span>' +
          '</li>';
        }).join('')
      : '<li class="empty" role="option" aria-disabled="true">No sites match.</li>';
    resultsList.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    if (activeIndex >= 0) searchInput.setAttribute('aria-activedescendant', 'result-' + activeIndex);
    else searchInput.removeAttribute('aria-activedescendant');
  }

  function hideResults() {
    resultsList.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  function choose(index) {
    var item = results[index];
    if (!item) return;
    hideResults();
    searchInput.value = '';
    searchInput.blur();
    select(item, true);
  }

  searchInput.addEventListener('input', runSearch);
  searchInput.addEventListener('focus', function () {
    closeList();
    if (searchInput.value.trim()) runSearch();
  });
  searchInput.addEventListener('keydown', function (e) {
    if (resultsList.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      activeIndex = (activeIndex + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      renderResults();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === 'Escape') {
      hideResults();
    }
  });

  // mousedown (not click) so it fires before the input's blur hides the list.
  resultsList.addEventListener('mousedown', function (e) {
    var li = e.target.closest('li[data-index]');
    if (!li) return;
    e.preventDefault();
    choose(Number(li.dataset.index));
  });
  searchInput.addEventListener('blur', function () { setTimeout(hideResults, 100); });

  // ---------- Go ----------

  load();
})();
