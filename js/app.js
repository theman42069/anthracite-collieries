/* Anthracite Collieries of Pennsylvania — map app.
   All site data lives in data/collieries.geojson; nothing here needs editing to add a site. */
(function () {
  'use strict';

  // ---------- Configuration ----------

  var DATA_URL = 'data/collieries.geojson';
  var FALLBACK_PHOTO = 'icons/no-photo.svg';
  var START_VIEW = { center: [40.85, -76.45], zoom: 9 }; // Shamokin / Mount Carmel, all four fields in view
  var FOCUS_ZOOM = 15;
  // Phone or computer layout, as chosen on first visit or in Settings (guessed until then).
  function isPhone() {
    return document.documentElement.getAttribute('data-layout') === 'phone';
  }

  // This visitor's choices from Menu → Settings (js/settings-store.js), or the defaults.
  var STORE = window.CollierySettings;
  var SETTINGS = STORE.load();
  var U = window.CollieryUtil;
  var escapeHtml = U.escapeHtml, slugify = U.slugify, isHttpUrl = U.isHttpUrl, operatorsFor = U.operatorsOf;
  // Pins are a little bigger in the phone layout so they're easier to tap.
  var MARKER_SCALE = ({ small: 0.8, normal: 1, large: 1.3 }[SETTINGS.markerSize] || 1) * (isPhone() ? 1.15 : 1);

  // Coal fields, in legend order. The pin color shows the field.
  var FIELDS = [
    { key: 'Northern',       label: 'Northern Field' },
    { key: 'Eastern Middle', label: 'Eastern Middle Field' },
    { key: 'Western Middle', label: 'Western Middle Field' },
    { key: 'Southern',       label: 'Southern Field' }
  ];
  FIELDS.forEach(function (f) { f.color = U.FIELD_COLORS[f.key.toLowerCase()]; });
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
    'nothing remains': 'Nothing remains',
    'tourist mine': 'Tourist mine (open to visitors)'
  };

  // ---------- Map and base layers ----------

  // "Go back to where I left off" reopens the last saved view; otherwise the whole region.
  var savedView = SETTINGS.startView === 'last' ? STORE.loadView() : null;
  var hasSavedView = savedView && isFinite(savedView.lat) && isFinite(savedView.lng) && isFinite(savedView.zoom);

  var map = L.map('map', {
    center: hasSavedView ? [savedView.lat, savedView.lng] : START_VIEW.center,
    zoom: hasSavedView ? savedView.zoom : START_VIEW.zoom,
    minZoom: 6,
    zoomControl: true,
    // "Smooth animations" off: zoom and pan jump instead of gliding.
    zoomAnimation: SETTINGS.motion,
    fadeAnimation: SETTINGS.motion,
    markerZoomAnimation: SETTINGS.motion
  });

  window.CollieryMap = map; // for js/secrets.js

  // Glide to a place, or jump there when animations are turned off.
  function goTo(latlng, zoom, seconds) {
    if (SETTINGS.motion) map.flyTo(latlng, zoom, { duration: seconds || 1.2 });
    else map.setView(latlng, zoom, { animate: false });
  }

  map.on('zoomend', function () { updateMapLabels(); });

  if (SETTINGS.startView === 'last') {
    map.on('moveend', function () {
      var c = map.getCenter();
      STORE.saveView({ lat: +c.lat.toFixed(5), lng: +c.lng.toFixed(5), zoom: map.getZoom() });
    });
  }

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

  // The two old views are made by functions, so the then-and-now slider can have its own copies.
  // Scanned USGS paper topo maps (quad dates vary, mostly mid-to-late 1900s). Detail stops at zoom 15.
  function oldTopoLayer(pane) {
    return L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/USA_Topo_Maps/MapServer/tile/{z}/{y}/{x}', {
        pane: pane || 'tilePane',
        maxZoom: 19,
        maxNativeZoom: 15,
        attribution: 'Scanned USGS topographic maps &copy; 2013 National Geographic Society, i-cubed, via <a href="https://www.esri.com/">Esri</a>'
      });
  }
  var oldTopo = oldTopoLayer();

  var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM &mdash; Map style &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
  });

  var streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  // 1980s National High Altitude Photography (color infrared), served by PASDA as a plain map
  // image, not tiles, so each 256px tile is its own small export request.
  function aerial80sLayer(pane) {
    var layer = L.tileLayer('', {
      pane: pane || 'tilePane',
      maxZoom: 19,
      maxNativeZoom: 17,
      attribution: '1980s NHAP aerial photography via <a href="https://www.pasda.psu.edu/">PASDA</a>, Penn State'
    });
    layer.getTileUrl = function (c) {
      var size = 40075016.68 / Math.pow(2, c.z);
      var west = -20037508.34 + c.x * size, north = 20037508.34 - c.y * size;
      return 'https://imagery.pasda.psu.edu/arcgis/rest/services/pasda/PA_NHAP80s/MapServer/export' +
        '?bbox=' + [west, north - size, west + size, north].join(',') +
        '&bboxSR=3857&imageSR=3857&size=256,256&format=jpg&f=image';
    };
    return layer;
  }
  var aerial80s = aerial80sLayer();

  var BASE_LAYERS = { satellite: satellite, aerial80s: aerial80s, oldtopo: oldTopo, topo: topo, streets: streets };
  (BASE_LAYERS[SETTINGS.baseLayer] || satellite).addTo(map);
  if (SETTINGS.placeLabels) placeLabels.addTo(map);

  // Railroad lines from OpenStreetMap (data/railroads.geojson), loaded the first time they're shown.
  map.createPane('rails');
  map.getPane('rails').style.zIndex = 350;   // over the maps, under the pins
  var railroads = L.layerGroup();
  var railsLoaded = false;
  railroads.on('add', function () {
    if (railsLoaded) return;
    railsLoaded = true;
    fetch('data/railroads.geojson').then(function (r) { return r.json(); }).then(function (d) {
      L.geoJSON(d, {
        pane: 'rails',
        attribution: 'Railroads &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        style: function (f) {
          return f.properties.status === 'active'
            ? { color: '#f4efe6', weight: 2.5, opacity: 0.9 }
            : { color: '#e9a23b', weight: 2.5, opacity: 0.95, dashArray: '6 5' };
        },
        onEachFeature: function (f, layer) {
          var p = f.properties;
          layer.bindTooltip(
            '<b>' + escapeHtml(p.name || (p.status === 'active' ? 'Railroad' : 'Abandoned railroad')) + '</b>' +
            '<br>' + (p.status === 'active' ? 'Track still in use' : 'Abandoned or removed') +
            (p.note ? '<br>' + escapeHtml(p.note) : ''), { sticky: true, className: 'colliery-tooltip' });
        }
      }).addTo(railroads);
    }).catch(function () { railsLoaded = false; flash('The railroad lines could not load.'); });
  });

  L.control.layers(
    { 'Satellite': satellite, '1980s aerial photos (infrared)': aerial80s, 'Old USGS topo maps': oldTopo, 'Topographic (modern)': topo, 'Street map': streets },
    {
      'Place labels': placeLabels,
      'Railroads (<span class="rail-key active"></span>in use, <span class="rail-key old"></span>abandoned)': railroads
    },
    { position: 'topright' }
  ).addTo(map);

  // With "Group nearby sites" turned off in Settings, markers go straight onto the map.
  var clusters = SETTINGS.clustering ? L.markerClusterGroup({
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
  }) : L.featureGroup();
  clusters.addTo(map);

  // ---------- "Show my location" button ----------
  // Browsers only share location with https:// pages (like GitHub Pages) or http://localhost.

  var locateBtn = null;
  var locating = false;
  var firstFix = false;
  var youAreHere = null;
  var lastLocation = null;   // latest position, also used to sort the list by distance
  var accuracyCircle = null;

  var LocateControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      var bar = L.DomUtil.create('div', 'leaflet-bar locate-control');
      locateBtn = L.DomUtil.create('a', '', bar);
      locateBtn.href = '#';
      locateBtn.setAttribute('role', 'button');
      locateBtn.title = 'Show my location';
      locateBtn.setAttribute('aria-label', 'Show my location');
      locateBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
          '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>' +
        '</svg>';
      L.DomEvent.on(locateBtn, 'click', function (e) {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        if (locating) stopLocating(); else startLocating();
      });
      return bar;
    }
  });
  new LocateControl().addTo(map);

  // ---------- Then and now ----------
  // An old map in its own pane over the base map, clipped at a slider: old on the left of the
  // line, today's map on the right. Drag the handle to sweep between them.

  map.createPane('then');
  map.getPane('then').style.zIndex = 250;   // above the base tiles, below markers
  var THEN_LAYERS = {
    oldtopo: { label: 'Old USGS topo maps', make: oldTopoLayer },
    aerial80s: { label: '1980s aerial photos', make: aerial80sLayer }
  };
  var thenLayer = null;
  var thenKey = 'oldtopo';
  var swipeX = 0;
  var swipeBar = null;
  var compareBtn = null;

  function clipThen() {
    if (!thenLayer) return;
    var nw = map.containerPointToLayerPoint([0, 0]);
    var se = map.containerPointToLayerPoint(map.getSize());
    map.getPane('then').style.clip = 'rect(' + nw.y + 'px,' + (nw.x + swipeX) + 'px,' + se.y + 'px,' + nw.x + 'px)';
    swipeBar.style.left = swipeX + 'px';
  }

  function setThen(key) {
    thenKey = key;
    if (thenLayer) map.removeLayer(thenLayer);
    thenLayer = THEN_LAYERS[key].make('then').addTo(map);
    clipThen();
  }

  function startCompare() {
    var size = map.getSize();
    swipeX = Math.round(size.x / 2);
    swipeBar = L.DomUtil.create('div', 'swipe', map.getContainer());
    swipeBar.innerHTML =
      '<div class="swipe-line"></div>' +
      '<button type="button" class="swipe-handle" aria-label="Drag to compare the old map with today">&#8249;&#8250;</button>' +
      '<div class="swipe-tags"><label class="swipe-tag then">Then: <select aria-label="Old map">' +
        Object.keys(THEN_LAYERS).map(function (k) {
          return '<option value="' + k + '"' + (k === thenKey ? ' selected' : '') + '>' + THEN_LAYERS[k].label + '</option>';
        }).join('') +
      '</select></label><span class="swipe-tag now">Now</span></div>';
    L.DomEvent.disableClickPropagation(swipeBar);
    L.DomEvent.disableScrollPropagation(swipeBar);
    swipeBar.querySelector('select').addEventListener('change', function (e) { setThen(e.target.value); });

    var handle = swipeBar.querySelector('.swipe-handle');
    function drag(e) {
      var r = map.getContainer().getBoundingClientRect();
      swipeX = Math.max(0, Math.min(r.width, e.clientX - r.left));
      clipThen();
    }
    handle.addEventListener('pointerdown', function (e) {
      handle.setPointerCapture(e.pointerId);
      map.dragging.disable();
      handle.addEventListener('pointermove', drag);
    });
    handle.addEventListener('pointerup', function () {
      handle.removeEventListener('pointermove', drag);
      map.dragging.enable();
    });
    handle.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      swipeX = Math.max(0, Math.min(map.getSize().x, swipeX + (e.key === 'ArrowLeft' ? -30 : 30)));
      clipThen();
    });

    setThen(thenKey);
    map.on('move zoom resize', clipThen);
    compareBtn.classList.add('active');
    compareBtn.setAttribute('aria-pressed', 'true');
  }

  function stopCompare() {
    map.off('move zoom resize', clipThen);
    if (thenLayer) map.removeLayer(thenLayer);
    thenLayer = null;
    if (swipeBar) swipeBar.remove();
    swipeBar = null;
    compareBtn.classList.remove('active');
    compareBtn.setAttribute('aria-pressed', 'false');
  }

  var CompareControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      var bar = L.DomUtil.create('div', 'leaflet-bar compare-control');
      compareBtn = L.DomUtil.create('a', '', bar);
      compareBtn.href = '#';
      compareBtn.setAttribute('role', 'button');
      compareBtn.setAttribute('aria-pressed', 'false');
      compareBtn.title = 'Then and now: compare an old map with today';
      compareBtn.setAttribute('aria-label', 'Then and now: compare an old map with today');
      compareBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
          '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 2v20M8 10l-2 2 2 2M16 10l2 2-2 2"/>' +
        '</svg>';
      L.DomEvent.on(compareBtn, 'click', function (e) {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        if (thenLayer) stopCompare(); else startCompare();
      });
      return bar;
    }
  });
  new CompareControl().addTo(map);

  // ---------- Guided tour ----------
  // Flies from colliery to colliery in the order they opened, opening each one's panel.

  var TOUR_SECONDS = { slow: 14, normal: 10, fast: 6 }[SETTINGS.playSpeed] || 10;
  var tour = null;   // { stops, index, timer, paused, bar }
  var tourBtn = null;

  function tourStops() {
    return items.filter(function (it) { return it.opened !== null; }).sort(function (a, b) {
      return a.opened - b.opened || String(a.props.name).localeCompare(String(b.props.name));
    });
  }

  function tourShow(i) {
    if (!tour) return;
    tour.index = (i + tour.stops.length) % tour.stops.length;
    var it = tour.stops[tour.index];
    select(it, true);
    tour.bar.querySelector('.tour-where').innerHTML =
      '<span class="tour-count">' + (tour.index + 1) + ' of ' + tour.stops.length + '</span> ' +
      '<b>' + (it.props.opened_estimated ? 'c. ' : '') + it.opened + '</b> · ' + escapeHtml(it.props.name || '');
    tourSchedule();
  }

  function tourSchedule() {
    clearTimeout(tour.timer);
    tour.bar.querySelector('.tour-pause').textContent = tour.paused ? 'Play' : 'Pause';
    if (!tour.paused) tour.timer = setTimeout(function () { tourShow(tour.index + 1); }, TOUR_SECONDS * 1000);
  }

  function startTour() {
    if (tour) return;
    var stops = tourStops();
    if (!stops.length) return;
    var bar = L.DomUtil.create('div', 'tour-bar', document.body);
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Guided tour');
    bar.innerHTML =
      '<span class="tour-where" aria-live="polite"></span>' +
      '<span class="tour-buttons">' +
        '<button type="button" class="tour-prev" aria-label="Previous colliery">&#8249;</button>' +
        '<button type="button" class="tour-pause">Pause</button>' +
        '<button type="button" class="tour-next" aria-label="Next colliery">&#8250;</button>' +
        '<button type="button" class="tour-stop">End tour</button>' +
      '</span>';
    tour = { stops: stops, index: 0, timer: null, paused: false, bar: bar };
    bar.querySelector('.tour-prev').addEventListener('click', function () { tourShow(tour.index - 1); });
    bar.querySelector('.tour-next').addEventListener('click', function () { tourShow(tour.index + 1); });
    bar.querySelector('.tour-pause').addEventListener('click', function () { tour.paused = !tour.paused; tourSchedule(); });
    bar.querySelector('.tour-stop').addEventListener('click', stopTour);
    tourBtn.classList.add('active');
    document.body.classList.add('touring');
    tourShow(0);
  }

  function stopTour() {
    if (!tour) return;
    clearTimeout(tour.timer);
    tour.bar.remove();
    tour = null;
    tourBtn.classList.remove('active');
    document.body.classList.remove('touring');
  }

  var TourControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      var bar = L.DomUtil.create('div', 'leaflet-bar tour-control');
      tourBtn = L.DomUtil.create('a', '', bar);
      tourBtn.href = '#';
      tourBtn.setAttribute('role', 'button');
      tourBtn.title = 'Guided tour: visit every colliery in the order they opened';
      tourBtn.setAttribute('aria-label', 'Guided tour: visit every colliery in the order they opened');
      tourBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
      L.DomEvent.on(tourBtn, 'click', function (e) {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        if (tour) stopTour(); else startTour();
      });
      return bar;
    }
  });
  new TourControl().addTo(map);

  function flash(message) {
    var el = document.getElementById('status');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(flash.timer);
    flash.timer = setTimeout(function () { el.hidden = true; }, 7000);
  }

  // flyToMe: false when the list asks for a location just to sort by distance.
  function startLocating(flyToMe) {
    if (!navigator.geolocation || !window.isSecureContext) {
      flash('Your location only works on the published site (https://…) or on this computer, not over the home network.');
      return;
    }
    locating = true;
    firstFix = flyToMe !== false;
    locateBtn.classList.add('is-on', 'is-waiting');
    locateBtn.title = 'Stop showing my location';
    map.locate({ watch: true, enableHighAccuracy: true, setView: false, maximumAge: 10000 });
  }

  function stopLocating() {
    locating = false;
    map.stopLocate();
    locateBtn.classList.remove('is-on', 'is-waiting');
    locateBtn.title = 'Show my location';
    if (youAreHere) { map.removeLayer(youAreHere); youAreHere = null; }
    if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }
  }

  map.on('locationfound', function (e) {
    if (!locating) return;
    lastLocation = e.latlng;
    if (listSort === 'nearest') renderList();
    locateBtn.classList.remove('is-waiting');
    if (!youAreHere) {
      accuracyCircle = L.circle(e.latlng, {
        radius: e.accuracy, color: '#4ea1ff', weight: 1, fillColor: '#4ea1ff', fillOpacity: 0.12, interactive: false
      }).addTo(map);
      youAreHere = L.circleMarker(e.latlng, {
        radius: 8, color: '#ffffff', weight: 3, fillColor: '#2f80ff', fillOpacity: 1, interactive: false
      }).addTo(map);
    } else {
      youAreHere.setLatLng(e.latlng);
      accuracyCircle.setLatLng(e.latlng).setRadius(e.accuracy);
    }
    // Jump to you once; after that the dot follows you without moving the map.
    if (firstFix) {
      firstFix = false;
      goTo(e.latlng, Math.max(map.getZoom(), 15), 1);
    }
  });

  map.on('locationerror', function (e) {
    if (!locating) return;
    stopLocating();
    flash(e.code === 1
      ? 'Location is blocked. Allow location for this site in your browser settings, then try again.'
      : 'Could not find your location. Try again outdoors or with Wi-Fi turned on.');
    if (listSort === 'nearest') renderList();
  });

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

  // Short name for the label under a pin: "Henry Clay Colliery" -> "Henry Clay",
  // "Saint Nicholas Colliery / St. Nicholas Breaker" -> "St. Nicholas Breaker".
  function shortLabel(name) {
    var parts = String(name || '').split(' / ');
    return parts[parts.length - 1].replace(/\s*\([^)]*\)/g, '').replace(/\s+Colliery\b/, '').trim();
  }

  var LABEL_ZOOM = 13;
  function updateMapLabels() {
    map.getContainer().classList.toggle('show-labels', SETTINGS.mapLabels && map.getZoom() >= LABEL_ZOOM);
  }

  function iconFor(field, type, label) {
    var w = Math.round(34 * MARKER_SCALE);
    var h = Math.round(w * 42 / 34);
    return L.divIcon({
      className: 'colliery-marker',
      html: markerSvg(field.color, type, w) +
        (label ? '<span class="pin-label">' + escapeHtml(label) + '</span>' : ''),
      iconSize: [w, h],
      iconAnchor: [w / 2, h - 1],
      tooltipAnchor: [0, -(h - 4)]
    });
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
        icon: iconFor(item.field, item.type, shortLabel(props.name)),
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
    updateMapLabels();
    handleRoute();
    // "Show my location when the map opens": blue dot only, the map stays put.
    if (SETTINGS.autoLocate) startLocating(false);
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
      ? '<h4 class="legend-heading">Site types <span class="hint">pin symbol</span></h4>' + types.map(function (t) {
          return legendRow('types', t.key, t.label, markerSvg('#c9c2b4', t, 18),
            countWhere(function (it) { return it.type === t; }));
        }).join('')
      : '';

    var Legend = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd: function () {
        var details = L.DomUtil.create('details', 'legend');
        if (SETTINGS.filterBox === 'open' || (SETTINGS.filterBox === 'auto' && !isPhone())) details.open = true;

        details.innerHTML = '' +
          '<summary>Filter map <span class="summary-badge" hidden></span></summary>' +
          '<div class="legend-body">' +
            '<h4 class="legend-heading">Coal fields <span class="hint">pin color</span></h4>' + fieldRows +
            typeRows +
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
            stopPlaying();
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
            stopPlaying();
            filters.year = Number(range.value);
            applyFilters();
          });
          details.querySelector('#timeline-play').addEventListener('click', function () {
            if (playTimer) stopPlaying(); else startPlaying(Number(range.min), Number(range.max));
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

  // ---------- Timeline "play": step through the years like a time-lapse ----------

  var PLAY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
  var PAUSE_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z"/></svg>';
  var YEAR_STEP_MS = { slow: 300, normal: 140, fast: 60 }[SETTINGS.playSpeed] || 140;
  var playTimer = null;
  var yearOverlay = null;
  var overlayTimer = null;

  function showYearOverlay(year) {
    clearTimeout(overlayTimer);
    if (!yearOverlay) {
      yearOverlay = document.createElement('div');
      yearOverlay.className = 'year-overlay';
      yearOverlay.setAttribute('aria-hidden', 'true');
      document.querySelector('.stage').appendChild(yearOverlay);
    }
    // Count only sites known to be working: opening year known and reached, not yet closed.
    var working = items.filter(function (it) {
      return it.opened !== null && it.opened <= year && (it.closed === null || year <= it.closed) && fieldOk(it) && typeOk(it);
    }).length;
    yearOverlay.innerHTML = year + '<small>' + working + (working === 1 ? ' colliery' : ' collieries') + ' known working</small>';
  }

  function hideYearOverlay(delay) {
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(function () {
      if (yearOverlay) { yearOverlay.remove(); yearOverlay = null; }
    }, delay || 0);
  }

  function setPlayButton(playing) {
    var btn = document.getElementById('timeline-play');
    if (!btn) return;
    btn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    btn.classList.toggle('is-playing', playing);
    btn.setAttribute('aria-label', playing ? 'Pause' : 'Play through the years');
    btn.title = btn.getAttribute('aria-label');
  }

  function startPlaying(min, max) {
    // Start from the beginning unless we're paused partway through.
    var year = filters.year !== null && filters.year < max ? filters.year : min;
    setPlayButton(true);
    function tick() {
      filters.year = year;
      applyFilters();
      showYearOverlay(year);
      if (year >= max) { stopPlaying(); return; }
      year++;
    }
    tick();
    playTimer = setInterval(tick, YEAR_STEP_MS);
  }

  function stopPlaying() {
    if (!playTimer) return;
    clearInterval(playTimer);
    playTimer = null;
    setPlayButton(false);
    hideYearOverlay(1500);
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
        '<div class="timeline-controls">' +
          '<button type="button" class="play-btn" id="timeline-play" aria-label="Play through the years" title="Play through the years">' + PLAY_ICON + '</button>' +
          '<input type="range" id="timeline-range" min="' + min + '" max="' + max + '" step="1" value="' + start + '" aria-label="Year">' +
        '</div>' +
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
    stopPlaying();
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
    if (!activeIn(item, filters.year)) { stopPlaying(); filters.year = null; }
    if (!operatorOk(item)) filters.operator = '';
    if (!statusOk(item)) filters.status = '';
    applyFilters();
  }

  function applyFilters() {
    var visible = items.filter(isVisible).map(function (it) { return it.marker; });
    clusters.clearLayers();
    if (clusters.addLayers) clusters.addLayers(visible);
    else visible.forEach(function (m) { clusters.addLayer(m); });
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
      panelImg.title = 'View full screen';
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

  // Tap a photo to see it full screen.
  panelImg.addEventListener('click', function () {
    if (panelImg.dataset.fallback !== '1' && gallery.length) openLightbox(galleryIndex);
  });

  // ---------- Full-screen photo viewer ----------
  // Swipe or arrow keys to move between photos; pinch, double-tap or mouse wheel to zoom;
  // drag to look around a zoomed photo; swipe down or Esc to close.

  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lb-img');
  var lbStage = document.getElementById('lb-stage');
  var lbIndex = 0;
  var zoom = { scale: 1, x: 0, y: 0 };
  var lbReturnFocus = null;

  function applyZoom(animate) {
    lbImg.style.transition = animate ? 'transform 0.2s ease' : 'none';
    lbImg.style.transform = 'translate(' + zoom.x + 'px,' + zoom.y + 'px) scale(' + zoom.scale + ')';
    lb.classList.toggle('is-zoomed', zoom.scale > 1.01);
  }

  function resetZoom(animate) {
    zoom.scale = 1; zoom.x = 0; zoom.y = 0;
    applyZoom(animate);
  }

  // Zoom toward a point on screen, keeping that point under the finger or cursor.
  function zoomAt(newScale, clientX, clientY, animate) {
    newScale = Math.min(5, Math.max(1, newScale));
    var rect = lbStage.getBoundingClientRect();
    var cx = clientX - rect.left - rect.width / 2;
    var cy = clientY - rect.top - rect.height / 2;
    var ratio = newScale / zoom.scale;
    zoom.x = cx - (cx - zoom.x) * ratio;
    zoom.y = cy - (cy - zoom.y) * ratio;
    zoom.scale = newScale;
    if (newScale === 1) { zoom.x = 0; zoom.y = 0; }
    applyZoom(animate);
  }

  function showLightboxPhoto(index) {
    var count = gallery.length;
    lbIndex = (index + count) % count;
    var ph = gallery[lbIndex];
    resetZoom(false);
    lbImg.src = ph.url;
    lbImg.alt = ph.caption || 'Photo of ' + galleryName;
    document.getElementById('lb-caption').textContent = ph.caption || galleryName;
    document.getElementById('lb-credit').textContent = ph.credit ? 'Credit: ' + ph.credit : '';
    document.getElementById('lb-count').textContent = count > 1 ? (lbIndex + 1) + ' / ' + count : '';
    document.getElementById('lb-original').href = ph.url;
    document.getElementById('lb-prev').hidden = count < 2;
    document.getElementById('lb-next').hidden = count < 2;
    // Load the neighbors in the background so swiping feels instant.
    if (count > 1) {
      new Image().src = gallery[(lbIndex + 1) % count].url;
      new Image().src = gallery[(lbIndex - 1 + count) % count].url;
    }
  }

  function openLightbox(index) {
    lbReturnFocus = document.activeElement;
    lb.hidden = false;
    document.body.classList.add('lightbox-open');
    document.getElementById('lb-hint').textContent = isPhone()
      ? 'Swipe for more · pinch or double-tap to zoom'
      : '← → for more · scroll or double-click to zoom';
    showLightboxPhoto(index);
    document.getElementById('lb-close').focus();
  }

  function closeLightbox() {
    if (lb.hidden) return;
    lb.hidden = true;
    document.body.classList.remove('lightbox-open');
    showPhoto(lbIndex); // the panel follows along to the last photo viewed
    if (lbReturnFocus && lbReturnFocus.focus) lbReturnFocus.focus();
  }

  function lightboxStep(delta) {
    if (gallery.length > 1) showLightboxPhoto(lbIndex + delta);
  }

  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-prev').addEventListener('click', function () { lightboxStep(-1); });
  document.getElementById('lb-next').addEventListener('click', function () { lightboxStep(1); });

  // Clicking the dark background (not the photo) closes it.
  lbStage.addEventListener('click', function (e) {
    if (e.target === lbStage && zoom.scale === 1) closeLightbox();
  });

  lbImg.addEventListener('dblclick', function (e) {
    zoomAt(zoom.scale > 1.01 ? 1 : 2.5, e.clientX, e.clientY, true);
  });

  lbStage.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoomAt(zoom.scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY, false);
  }, { passive: false });

  // Touch and mouse: one finger swipes (or pans when zoomed); two fingers pinch.
  var pointers = {};
  var gesture = null;
  var lastTap = 0;

  function pointerList() { return Object.keys(pointers).map(function (k) { return pointers[k]; }); }

  lbStage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.lb-btn')) return;
    lbStage.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var pts = pointerList();
    if (pts.length === 2) {
      gesture = {
        type: 'pinch',
        startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        startScale: zoom.scale
      };
    } else if (pts.length === 1) {
      gesture = { type: 'drag', startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
    }
  });

  lbStage.addEventListener('pointermove', function (e) {
    if (!pointers[e.pointerId] || !gesture) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var pts = pointerList();
    if (gesture.type === 'pinch' && pts.length === 2) {
      var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomAt(gesture.startScale * dist / gesture.startDist, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, false);
    } else if (gesture.type === 'drag') {
      if (Math.abs(e.clientX - gesture.startX) > 6 || Math.abs(e.clientY - gesture.startY) > 6) gesture.moved = true;
      if (zoom.scale > 1.01) {
        zoom.x += e.clientX - gesture.lastX;
        zoom.y += e.clientY - gesture.lastY;
        applyZoom(false);
      } else {
        // Follow the finger a little so the swipe feels connected.
        lbImg.style.transition = 'none';
        lbImg.style.transform = 'translate(' + (e.clientX - gesture.startX) * 0.6 + 'px,' + Math.max(0, e.clientY - gesture.startY) * 0.6 + 'px)';
      }
      gesture.lastX = e.clientX;
      gesture.lastY = e.clientY;
    }
  });

  function endPointer(e) {
    if (!pointers[e.pointerId]) return;
    delete pointers[e.pointerId];
    if (!gesture) return;
    if (gesture.type === 'pinch') {
      if (pointerList().length === 0) gesture = null;
      if (zoom.scale < 1.05) resetZoom(true);
      return;
    }
    var dx = e.clientX - gesture.startX;
    var dy = e.clientY - gesture.startY;
    var wasMoved = gesture.moved;
    gesture = null;
    if (zoom.scale > 1.01) return;
    if (!wasMoved && e.pointerType === 'touch') {
      // Double-tap to zoom on touch screens.
      var now = Date.now();
      if (now - lastTap < 300) { zoomAt(2.5, e.clientX, e.clientY, true); lastTap = 0; return; }
      lastTap = now;
    }
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) lightboxStep(dx < 0 ? 1 : -1);
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) closeLightbox();
    else resetZoom(true); // snap back
  }
  lbStage.addEventListener('pointerup', endPointer);
  lbStage.addEventListener('pointercancel', endPointer);

  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'ArrowRight') { lightboxStep(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { lightboxStep(-1); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') zoomAt(zoom.scale * 1.4, innerWidth / 2, innerHeight / 2, true);
    else if (e.key === '-') zoomAt(zoom.scale / 1.4, innerWidth / 2, innerHeight / 2, true);
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

  // How many people data/memorial.json names at each colliery.
  // Loaded the first time a panel opens, so plain map visits skip the big file.
  // Also loaded the first time someone types a name into the search box.
  var memorialCounts = null;
  var memorialPeople = null;
  var memorialLoading = false;
  var panelId = null;

  function loadMemorialCounts() {
    if (memorialLoading) return;
    memorialLoading = true;
    fetch('data/memorial.json', { cache: 'no-cache' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        memorialCounts = {};
        memorialPeople = (d.people || []).map(function (r) {
          memorialCounts[r[4]] = (memorialCounts[r[4]] || 0) + 1;
          return { date: r[0], name: r[1], colliery: r[4], key: plain(r[1]) };
        });
      })
      .catch(function () { memorialCounts = {}; memorialPeople = []; /* the panel just won't show the link */ })
      .then(function () {
        if (panelId) showMemorialLink();
        if (document.activeElement === searchInput && searchInput.value.trim()) runSearch();
      });
  }

  function showMemorialLink() {
    if (!memorialCounts) { loadMemorialCounts(); return; }
    var n = memorialCounts[panelId] || 0;
    document.getElementById('panel-memorial-wrap').hidden = !n;
    var a = document.getElementById('panel-memorial');
    a.href = 'memorial.html#' + encodeURIComponent(panelId || '');
    a.textContent = 'The records found so far name ' + n + (n === 1 ? ' person' : ' people') + ' who died here. See their names →';
  }

  // ---------- Mining words (data/glossary.json) ----------
  // The first use of each glossary word in a history becomes a button that explains it.

  var glossary = [];   // [{ re, entry }], longest form first so "culm bank" wins over "culm"

  fetch('data/glossary.json').then(function (r) { return r.json(); }).then(function (d) {
    (d.terms || []).forEach(function (t) {
      if (t.link === false) return;   // explained on the About page only
      [t.term].concat(t.forms || []).forEach(function (form) {
        var src = String(form).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s-]+');
        glossary.push({ len: form.length, re: new RegExp('\\b' + src + '\\b', 'i'), entry: t });
      });
    });
    glossary.sort(function (a, b) { return b.len - a.len; });
    if (current) document.getElementById('panel-history').innerHTML = current.props.history ? linkTerms(current.props.history) : 'No history written yet.';
  }).catch(function () { /* histories just stay plain text */ });

  function linkTerms(text) {
    var marks = [];
    var used = {};
    glossary.forEach(function (g) {
      if (used[g.entry.term]) return;
      var m = g.re.exec(text);
      if (!m) return;
      var a = m.index, b = a + m[0].length;
      if (marks.some(function (k) { return a < k.b && b > k.a; })) return;
      marks.push({ a: a, b: b, entry: g.entry });
      used[g.entry.term] = true;
    });
    marks.sort(function (x, y) { return x.a - y.a; });
    var out = '', at = 0;
    marks.forEach(function (k) {
      out += escapeHtml(text.slice(at, k.a)) +
        '<button type="button" class="term" data-term="' + escapeHtml(k.entry.term) + '">' + escapeHtml(text.slice(k.a, k.b)) + '</button>';
      at = k.b;
    });
    return out + escapeHtml(text.slice(at));
  }

  var termPop = null;
  function closeTerm() { if (termPop) { termPop.remove(); termPop = null; } }
  document.getElementById('panel-history').addEventListener('click', function (e) {
    var btn = e.target.closest('.term');
    if (!btn) return;
    e.stopPropagation();
    var reopen = !termPop || termPop.dataset.term !== btn.dataset.term;
    closeTerm();
    if (!reopen) return;
    var entry = glossary.filter(function (g) { return g.entry.term === btn.dataset.term; })[0].entry;
    termPop = document.createElement('div');
    termPop.className = 'term-pop';
    termPop.dataset.term = entry.term;
    termPop.setAttribute('role', 'note');
    termPop.innerHTML = '<b>' + escapeHtml(entry.term) + '</b> ' + escapeHtml(entry.text);
    document.body.appendChild(termPop);
    var r = btn.getBoundingClientRect();
    var w = termPop.offsetWidth;
    termPop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    termPop.style.top = (r.bottom + 6 + termPop.offsetHeight > window.innerHeight ? r.top - termPop.offsetHeight - 6 : r.bottom + 6) + 'px';
  });
  document.addEventListener('click', closeTerm);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTerm(); });
  panel.addEventListener('scroll', closeTerm, { passive: true });

  // ---------- Old aerial photos (PennPilot) ----------
  // PennPilot's photo centers for the 1940s–1970s flights, one layer per decade. For each decade we
  // show the photo whose center is nearest the colliery; a photo is about 4.6 km square, so a
  // center within 2 km keeps the colliery in frame.
  var PENNPILOT = 'https://imagery.pasda.psu.edu/arcgis/rest/services/PennPilot/MapServer/';
  var AERIAL_MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  var aerialCache = {};

  function nearestPhoto(layer, latlng) {
    var url = PENNPILOT + layer + '/query?f=json&geometryType=esriGeometryPoint&inSR=4326&outSR=4326' +
      '&geometry=' + latlng.lng + ',' + latlng.lat + '&distance=2000&units=esriSRUnit_Meter&outFields=*&returnGeometry=true';
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      var best = null;
      (d.features || []).forEach(function (f) {
        var a = f.attributes || {};
        if (/^y/i.test(a.missing || a.photoIsMis || '')) return;
        // Every decade's record has an HTML snippet linking .../pennpilot/px/eraNNNN/<name>.jpg.
        var m = null;
        Object.keys(a).some(function (k) {
          m = /pennpilot\/px\/(era\d{4})\/([\w-]+)\.jpg/.exec(String(a[k]));
          return m;
        });
        if (!m) return;
        var dist = latlng.distanceTo([f.geometry.y, f.geometry.x]);
        if (!best || dist < best.dist) best = { dist: dist, era: m[1], name: m[2] };
      });
      if (!best) return null;
      // Names look like "schuylkill_100338_aqs_17_21": county, then the flight date as MMDDYY.
      var dm = /_(\d{2})(\d{2})(\d{2})_/.exec(best.name);
      var base = 'https://www.pasda.psu.edu/pennpilot/px/' + best.era + '/';
      return {
        full: base + best.name + '.jpg',
        thumb: base + 'JPEG/' + best.name + '.jpg',
        year: dm ? 1900 + +dm[3] : null,
        date: dm && +dm[1] >= 1 && +dm[1] <= 12 ? AERIAL_MONTHS[+dm[1] - 1] + ' ' + (+dm[2]) + ', 19' + dm[3] : best.era.slice(3) + 's'
      };
    }).catch(function () { return null; });
  }

  function showAerials(item) {
    var wrap = document.getElementById('panel-aerials-wrap');
    var list = document.getElementById('panel-aerials');
    var id = item.props.id;
    wrap.hidden = true;
    list.innerHTML = '';
    var pending = aerialCache[id] || (aerialCache[id] = Promise.all([0, 1, 2, 3].map(function (layer) {
      return nearestPhoto(layer, item.latlng);
    })));
    pending.then(function (photos) {
      if (panelId !== id) return;   // another site was opened meanwhile
      photos = photos.filter(Boolean).sort(function (a, b) { return (a.year || 0) - (b.year || 0); });
      wrap.hidden = !photos.length;
      list.innerHTML = photos.map(function (ph) {
        return '<li><a href="' + escapeHtml(ph.full) + '" target="_blank" rel="noopener">' +
          '<img src="' + escapeHtml(ph.thumb) + '" alt="Aerial photo, ' + escapeHtml(ph.date) + '" loading="lazy">' +
          '<span>' + escapeHtml(ph.date) + '</span></a></li>';
      }).join('');
    });
  }

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
      ['Opening year', p.opened_estimated && item.opened !== null ? 'c. ' + item.opened + ' (estimated)' : null],
      ['Closing year', p.closed_estimated && item.closed !== null ? 'c. ' + item.closed + ' (estimated)' : null],
      ['Status', p.status],
      ['Coordinates', item.latlng.lat.toFixed(5) + ', ' + item.latlng.lng.toFixed(5)]
    ];
    document.getElementById('panel-facts').innerHTML = facts
      .filter(function (f) { return f[1] != null && String(f[1]).trim() !== ''; })
      .map(function (f) { return '<dt>' + escapeHtml(f[0]) + '</dt><dd>' + escapeHtml(f[1]) + '</dd>'; })
      .join('');

    document.getElementById('panel-history').innerHTML = p.history ? linkTerms(p.history) : 'No history written yet.';
    document.getElementById('panel-confidence-wrap').hidden = !p.confidence || !SETTINGS.showConfidence;
    document.getElementById('panel-confidence').textContent = p.confidence || '';
    // Estimated dates are always explained, even with the confidence notes turned off.
    var notes = [];
    if (p.opened_estimated) notes.push(p.opened_estimate_note || 'No record gives this colliery\'s opening date; the year shown is an estimate.');
    if (p.closed_estimated) notes.push(p.closed_estimate_note || 'No record gives this colliery\'s closing date; the year shown is an estimate.');
    document.getElementById('panel-estimate-wrap').hidden = !notes.length;
    document.getElementById('panel-estimate-title').textContent = p.opened_estimated && p.closed_estimated
      ? 'Opening and closing years are estimates'
      : p.opened_estimated ? 'Opening year is an estimate' : 'Closing year is an estimate';
    document.getElementById('panel-estimate').textContent = notes.join(' ');

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

    panelId = p.id;
    showMemorialLink();
    showAerials(item);

    var sources = listOf(p.sources);
    document.getElementById('panel-sources').innerHTML = sources.length
      ? sources.map(renderSource).join('')
      : '<li class="none">No sources listed yet.</li>';

    copyBtn.textContent = 'Copy link to this site';
    document.getElementById('print-link').href = 'print.html#' + encodeURIComponent(p.id || item.slug);
    document.getElementById('contribute-link').href = 'contribute.html#' + encodeURIComponent(p.id || item.slug);
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
    if (fly) goTo(target, zoom);
    else map.panTo(target, { animate: SETTINGS.motion });
  }

  function closePanel() {
    if (!current) return;
    current = null;
    setExpanded(false);
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
    if (isPhone()) dy = panel.offsetHeight / 2;
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

  // ---------- Phone bottom sheet: tap or swipe for full screen ----------

  var sheetHandle = panel.querySelector('.sheet-handle');

  function setExpanded(on) {
    panel.classList.toggle('expanded', on);
    sheetHandle.setAttribute('aria-expanded', on ? 'true' : 'false');
    sheetHandle.setAttribute('aria-label', on ? 'Show less' : 'Show more details');
  }

  sheetHandle.addEventListener('click', function () {
    setExpanded(!panel.classList.contains('expanded'));
  });

  // Swipe up to fill the screen; swipe down to shrink it again, or to close when it's already small.
  // Only when the sheet is scrolled to the top, so normal scrolling inside it still works.
  var swipeY = null;
  panel.addEventListener('touchstart', function (e) {
    swipeY = isPhone() && panel.scrollTop <= 0 ? e.touches[0].clientY : null;
  }, { passive: true });
  panel.addEventListener('touchend', function (e) {
    if (swipeY === null) return;
    var dy = e.changedTouches[0].clientY - swipeY;
    swipeY = null;
    if (dy < -50 && !panel.classList.contains('expanded')) setExpanded(true);
    else if (dy > 70) {
      if (panel.classList.contains('expanded')) setExpanded(false);
      else closePanel();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!lb.hidden) { closeLightbox(); return; }
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

  // ---------- List order ----------

  var listSort = SETTINGS.listSort;
  var sortSelect = document.getElementById('list-sort');
  sortSelect.value = listSort;

  // Distance from you, in miles or kilometers (Settings → Map → Distances in).
  var UNIT = SETTINGS.units === 'km' ? { label: 'km', meters: 1000 } : { label: 'mi', meters: 1609.34 };
  function milesTo(it) {
    return lastLocation ? map.distance(lastLocation, it.latlng) / UNIT.meters : null;
  }

  // Unknown years go to the end in every year-based order.
  function byYear(key, newestFirst) {
    return function (a, b) {
      if (a[key] === null && b[key] === null) return 0;
      if (a[key] === null) return 1;
      if (b[key] === null) return -1;
      return newestFirst ? b[key] - a[key] : a[key] - b[key];
    };
  }

  function sortedForList(list) {
    var byName = function (a, b) { return String(a.props.name).localeCompare(String(b.props.name)); };
    var out = list.slice().sort(byName); // ties stay alphabetical
    if (listSort === 'oldest') out.sort(byYear('opened', false));
    else if (listSort === 'newest') out.sort(byYear('opened', true));
    else if (listSort === 'closed') out.sort(byYear('closed', true));
    else if (listSort === 'nearest' && lastLocation) out.sort(function (a, b) { return milesTo(a) - milesTo(b); });
    return out;
  }

  sortSelect.addEventListener('change', function () {
    listSort = sortSelect.value;
    var s = STORE.load(); s.listSort = listSort; STORE.save(s);
    if (listSort === 'nearest' && !lastLocation && !locating) startLocating(false);
    renderList();
  });

  function renderList() {
    var visible = sortedForList(items.filter(isVisible));
    document.getElementById('list-count').textContent = visible.length;

    var head = visible.length === items.length
      ? 'All ' + items.length + ' sites'
      : 'Showing ' + visible.length + ' of ' + items.length + ' (filters on)';
    if (listSort === 'nearest' && !lastLocation) head = locating ? 'Finding your location…' : 'Turn on your location to sort by distance';
    document.getElementById('list-head').textContent = head;

    listItems.innerHTML = visible.length
      ? visible.map(function (it) {
          var miles = listSort === 'nearest' ? milesTo(it) : null;
          var meta = [
            miles !== null ? (miles < 10 ? miles.toFixed(1) : Math.round(miles)) + ' ' + UNIT.label : '',
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

  // ---------- "Surprise me": fly to a random colliery ----------

  var surpriseBtn = document.getElementById('surprise');
  surpriseBtn.addEventListener('click', function () {
    var pool = items.filter(function (it) { return isVisible(it) && it !== current; });
    if (!pool.length) pool = items.filter(function (it) { return it !== current; });
    if (!pool.length) return;
    surpriseBtn.classList.remove('rolling');
    void surpriseBtn.offsetWidth; // restart the spin animation
    surpriseBtn.classList.add('rolling');
    closeList();
    select(pool[Math.floor(Math.random() * pool.length)], true);
  });

  // ---------- Search ----------

  var searchInput = document.getElementById('search-input');
  var resultsList = document.getElementById('search-results');
  var results = [];
  var activeIndex = -1;

  var plain = window.CollieryUtil.plain;
  var typoDistance = window.CollieryUtil.typoDistance;

  var PEOPLE_SHOWN = 5;

  // Names in the memorial, for family searches. Spellings in the records vary, so close spellings
  // count (see CollieryUtil.nameMatch). Returns person rows plus a "search the memorial" row.
  function peopleMatching(q) {
    if (q.length < 3) return [];
    if (!memorialPeople) { loadMemorialCounts(); return []; }
    var hits = [];
    memorialPeople.forEach(function (p) {
      var d = window.CollieryUtil.nameMatch(q, p.key);
      if (d >= 0 && bySlug[p.colliery]) hits.push({ p: p, score: d });
    });
    hits.sort(function (a, b) { return a.score - b.score || a.p.date.localeCompare(b.p.date); });
    var rows = hits.slice(0, PEOPLE_SHOWN).map(function (h) {
      return { kind: 'person', p: h.p, it: bySlug[h.p.colliery] };
    });
    if (hits.length > PEOPLE_SHOWN) rows.push({ kind: 'more' });
    return rows;
  }

  function runSearch() {
    var raw = searchInput.value.trim();
    var q = plain(raw).replace(/\bcolliery\b/g, '').trim();
    if (!q) { hideResults(); return; }
    // About one mistake per four letters; very short searches must match exactly.
    var allowed = q.length < 4 ? 0 : Math.max(1, Math.floor(q.length / 4));

    results = items.map(function (it) {
      var names = [it.props.name].concat(listOf(it.props.other_names));
      var best = Infinity;
      names.forEach(function (n) { best = Math.min(best, typoDistance(q, plain(n))); });
      // Towns only match exactly, so "shamokin" lists Shamokin-area sites without fuzzy noise.
      if (plain(it.props.nearest_town).indexOf(q) !== -1) best = Math.min(best, 0.5);
      return { it: it, score: best };
    }).filter(function (r) {
      return r.score <= allowed;
    }).sort(function (a, b) {
      return a.score - b.score || String(a.it.props.name).localeCompare(String(b.it.props.name));
    }).slice(0, 8).map(function (r) { return { kind: 'site', it: r.it }; });
    results = results.concat(peopleMatching(q));
    searchQuery = raw;

    activeIndex = results.length ? 0 : -1;
    renderResults();
  }

  var searchQuery = '';

  function resultHtml(r, i) {
    var open = '<li role="option" id="result-' + i + '" data-index="' + i + '" aria-selected="' + (i === activeIndex) + '"' +
      (r.kind === 'site' ? '' : ' class="person"') + '>';
    if (r.kind === 'more') {
      return open + '<span class="name">More names: search the memorial →</span></li>';
    }
    if (r.kind === 'person') {
      return open + '<span class="dot" style="background:' + r.it.field.color + '"></span>' +
        '<span class="person-text"><span class="name">' + escapeHtml(r.p.name) + '</span>' +
        '<span class="meta">' + escapeHtml(r.p.date.slice(0, 4) + ' · ' + (r.it.props.name || '')) + '</span></span></li>';
    }
    return open + '<span class="dot" style="background:' + r.it.field.color + '"></span>' +
      '<span class="name">' + escapeHtml(r.it.props.name || 'Unnamed site') + '</span>' +
      '<span class="meta">' + escapeHtml(r.it.field === OTHER_FIELD ? '' : r.it.field.key) + '</span></li>';
  }

  function renderResults() {
    var firstPerson = -1;
    results.some(function (r, i) { if (r.kind !== 'site') { firstPerson = i; return true; } return false; });
    resultsList.innerHTML = results.length
      ? results.map(function (r, i) {
          return (i === firstPerson ? '<li class="group" role="presentation">In memoriam</li>' : '') + resultHtml(r, i);
        }).join('')
      : '<li class="empty" role="option" aria-disabled="true">' +
        (!memorialPeople && plain(searchQuery).length >= 3 ? 'Looking up names…' : 'No sites or names match.') + '</li>';
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
    var r = results[index];
    if (!r) return;
    if (r.kind === 'more') {
      location.href = 'memorial.html?q=' + encodeURIComponent(searchQuery);
      return;
    }
    hideResults();
    searchInput.value = '';
    searchInput.blur();
    select(r.it, true);
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
