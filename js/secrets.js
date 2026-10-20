/* Secrets. Spoilers below!
   1. Miner's lamp   – tap the headframe logo 7 times: the map goes dark and your cap lamp lights it.
   2. The canary     – hidden on the dark map (and on the About page); leads to secret.html.
   3. Superintendent – a perfect quiz score (handled in quiz.js).
   4. St. Barbara    – December 4, patron saint of miners: remembrance banner and candles.
                       On by itself Dec 1–7. Any day: search "St. Barbara", type BARBARA,
                       tap the candle on the Canary's Nest page, or add ?stbarbara.
   5. Mine tour      – type GLENBURN on the map (or "mine tour" in the search box).
   Found secrets are remembered in this browser only. */
(function () {
  'use strict';

  var KEY = 'collieries:secrets';
  var SECRETS = {
    lamp:           { name: "Miner's lamp",        hint: 'The headframe in the corner has seen a lot of shifts. Try knocking on it… a lot.' },
    canary:         { name: 'The canary',           hint: 'Miners carried one underground. Look somewhere dark, or somewhere quiet.' },
    superintendent: { name: 'Mine superintendent',  hint: 'Only a perfect quiz score gets you the corner office.' },
    barbara:        { name: "St. Barbara's Day",    hint: 'Visit the first week of December, or look up the patron saint of miners in the search box.' },
    minetour:       { name: 'The mine tour',        hint: 'Spell out the name of the colliery that gave public tours from 1968 to 1977.' }
  };

  function readFound() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }

  function toast(html) {
    var t = document.createElement('div');
    t.className = 'secret-toast';
    t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 20);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 400); }, 4200);
  }

  function markFound(key) {
    var found = readFound();
    if (found[key]) return;
    var d = new Date();
    found[key] = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    try { localStorage.setItem(KEY, JSON.stringify(found)); } catch (e) { /* storage blocked */ }
    var count = Object.keys(found).filter(function (k) { return SECRETS[k]; }).length;
    toast('🔓 <b>Secret found:</b> ' + SECRETS[key].name + ' <span>(' + count + ' of 5)</span>');
  }

  window.CollierySecrets = { SECRETS: SECRETS, readFound: readFound, markFound: markFound, toast: toast };

  // ---------- Hidden canaries on ordinary pages (About footer) ----------

  document.addEventListener('click', function (e) {
    var bird = e.target.closest('.hidden-canary');
    if (!bird) return;
    markFound('canary');
    setTimeout(function () { location.href = 'secret.html'; }, 900);
  });

  // Everything below only runs on the map page.
  var stage = document.querySelector('.stage');
  var mapEl = document.getElementById('map');
  if (!stage || !mapEl) return;

  var CANARY_SVG =
    '<svg viewBox="0 0 64 48" width="34" height="26" aria-hidden="true">' +
      '<ellipse cx="30" cy="28" rx="18" ry="13" fill="#ffd23f" stroke="#7a5b00" stroke-width="2"/>' +
      '<circle cx="46" cy="18" r="10" fill="#ffd23f" stroke="#7a5b00" stroke-width="2"/>' +
      '<path d="M55 17 L63 20 L55 22 Z" fill="#f28c28" stroke="#7a5b00" stroke-width="1.5"/>' +
      '<circle cx="48" cy="16" r="2" fill="#222"/>' +
      '<path d="M22 24 Q30 18 38 26" fill="none" stroke="#c99a00" stroke-width="2"/>' +
      '<path d="M12 28 L2 22 L6 32 Z" fill="#ffd23f" stroke="#7a5b00" stroke-width="1.5"/>' +
      '<path d="M28 40 v6 M34 40 v6" stroke="#7a5b00" stroke-width="2"/>' +
    '</svg>';

  // ---------- 1. Miner's lamp ----------

  var lamp = null;
  var canaryMarker = null;
  var taps = 0;
  var tapTimer = null;

  function moveLamp(x, y) {
    if (!lamp) return;
    lamp.style.setProperty('--lx', x + 'px');
    lamp.style.setProperty('--ly', y + 'px');
  }

  function onPointer(e) {
    var r = stage.getBoundingClientRect();
    moveLamp(e.clientX - r.left, e.clientY - r.top);
  }

  function lampOn() {
    lamp = document.createElement('div');
    lamp.className = 'lamp-overlay';
    lamp.innerHTML =
      '<div class="lamp-hint">⛏️ You\'re underground. Somewhere between Shamokin and Mount Carmel, a canary is singing…</div>' +
      '<button type="button" class="lamp-exit">Back to the surface</button>';
    stage.appendChild(lamp);
    var r = stage.getBoundingClientRect();
    moveLamp(r.width / 2, r.height / 2);
    document.body.classList.add('lamp-mode');
    stage.addEventListener('pointermove', onPointer);
    stage.addEventListener('pointerdown', onPointer);
    lamp.querySelector('.lamp-exit').addEventListener('click', lampOff);

    // The canary only shows up underground, and only in the lamp's light.
    if (window.L && window.CollieryMap && !canaryMarker) {
      canaryMarker = L.marker([40.7905, -76.4890], {
        icon: L.divIcon({ className: 'canary-marker', html: CANARY_SVG, iconSize: [34, 26], iconAnchor: [17, 13] }),
        title: 'A canary!',
        keyboard: false
      }).addTo(window.CollieryMap);
      canaryMarker.on('click', function () {
        markFound('canary');
        setTimeout(function () { location.href = 'secret.html'; }, 900);
      });
    }
    markFound('lamp');
  }

  function lampOff() {
    if (!lamp) return;
    lamp.remove();
    lamp = null;
    document.body.classList.remove('lamp-mode');
    stage.removeEventListener('pointermove', onPointer);
    stage.removeEventListener('pointerdown', onPointer);
    if (canaryMarker) { canaryMarker.remove(); canaryMarker = null; }
  }

  var logo = document.querySelector('.topbar .brand img');
  if (logo) {
    logo.addEventListener('click', function (e) {
      e.preventDefault(); // the logo counts taps; the title text still resets the map
      if (lamp) { lampOff(); return; }
      taps++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(function () { taps = 0; }, 2500);
      if (taps === 4) toast('🔦 Keep tapping…');
      if (taps >= 7) { taps = 0; lampOn(); }
    });
  }

  // ---------- 4. St. Barbara's Day (December 4) ----------
  // Turns on by itself December 1–7. Any other day: type BARBARA on the map,
  // search "St. Barbara", tap the candle on the Canary's Nest page, or add ?stbarbara.

  var today = new Date();
  var isFeast = today.getMonth() === 11 && today.getDate() === 4;
  var feastWeek = today.getMonth() === 11 && today.getDate() <= 7;
  var banner = null;

  function stBarbara() {
    document.body.classList.add('st-barbara');
    if (banner) return;
    banner = document.createElement('div');
    banner.className = 'barbara-banner';
    banner.innerHTML =
      '<button type="button" class="barbara-close" aria-label="Close">×</button>' +
      '<p class="barbara-title">🕯️ December 4 · St. Barbara\'s Day</p>' +
      '<p>' + (isFeast ? 'Today is' : 'December 4 is') + ' the feast of St. Barbara, patron saint of miners. A candle burns at every colliery on the map in memory of the men and boys who worked them, and those who never came home, among them:</p>' +
      '<ul>' +
        '<li><a href="#bancroft-pioneer-colliery">Pioneer (Bancroft slope), April 12, 1867</a>: 11 killed in a firedamp explosion</li>' +
        '<li><a href="#greenback-colliery">Greenback, August 21, 1884</a>: 8 killed</li>' +
        '<li><a href="#luke-fidler-colliery">Luke Fidler, October 1894</a>: 5 killed; <b>November 1902</b>: 4 more</li>' +
        '<li><a href="#reliance-colliery">Reliance (Beaverdale Shaft), September 2, 1926</a>: 4 killed</li>' +
      '</ul>' +
      '<p><a href="memorial.html">🕯️ Read the names of everyone known to have died at these collieries →</a></p>' +
      (feastWeek ? '' : '<p class="barbara-note">(This appears by itself December 1–7. Reload the page to put the candles out.)</p>');
    stage.appendChild(banner);
    banner.querySelector('.barbara-close').addEventListener('click', function () { banner.remove(); banner = null; });
    markFound('barbara');
  }

  if (feastWeek || /[?&]stbarbara\b/.test(location.search)) stBarbara();

  // ---------- 5. Mine tour: type GLENBURN ----------

  var typed = '';
  var touring = false;

  function mineTour() {
    if (touring) return;
    touring = true;
    var car = document.createElement('div');
    car.className = 'tour-car';
    car.setAttribute('aria-hidden', 'true');
    car.innerHTML =
      '<div class="tour-honk">HONK! 🚂 All aboard the Glen Burn Mine Tour!</div>' +
      '<svg viewBox="0 0 260 110" width="260" height="110">' +
        // riders in hard hats
        '<g>' +
          [40, 85, 130, 175].map(function (x) {
            return '<circle cx="' + x + '" cy="30" r="11" fill="#e8c9a0"/>' +
                   '<path d="M' + (x - 13) + ' 26 a13 11 0 0 1 26 0 z" fill="#f4f4f4" stroke="#999" stroke-width="1"/>' +
                   '<circle cx="' + (x + 4) + '" cy="31" r="1.6" fill="#333"/>';
          }).join('') +
        '</g>' +
        // car body
        '<rect x="10" y="40" width="230" height="44" rx="6" fill="#8d9499" stroke="#3d4246" stroke-width="3"/>' +
        '<rect x="22" y="48" width="206" height="10" fill="#6c7378"/>' +
        '<text x="125" y="76" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="#1f1c17">GLEN BURN MINE</text>' +
        // headlamp
        '<circle cx="243" cy="52" r="6" fill="#ffe680" stroke="#3d4246" stroke-width="2"/>' +
        // wheels
        '<g class="tour-wheel" style="transform-origin:55px 92px"><circle cx="55" cy="92" r="14" fill="#2b2f33"/><path d="M55 78 V106 M41 92 H69" stroke="#8d9499" stroke-width="3"/></g>' +
        '<g class="tour-wheel" style="transform-origin:195px 92px"><circle cx="195" cy="92" r="14" fill="#2b2f33"/><path d="M195 78 V106 M181 92 H209" stroke="#8d9499" stroke-width="3"/></g>' +
        // rail
        '<rect x="0" y="105" width="260" height="5" fill="#5a4a3a"/>' +
      '</svg>';
    stage.appendChild(car);
    markFound('minetour');
    setTimeout(function () { car.remove(); touring = false; }, 7600);
  }

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-8);
    if (typed === 'glenburn') { typed = ''; mineTour(); }
    if (typed.slice(-7) === 'barbara') { typed = ''; stBarbara(); }
  });

  // Phones have no keyboard on the map, so the search box works too.
  var search = document.getElementById('search-input');
  if (search) {
    search.addEventListener('input', function () {
      var word = search.value.toLowerCase().replace(/[^a-z]/g, '');
      if (word === 'minetour' || word === 'stbarbara' || word === 'saintbarbara') {
        search.value = '';
        search.blur();
        search.dispatchEvent(new Event('input'));
        if (word === 'minetour') mineTour(); else stBarbara();
      }
    });
  }
})();
