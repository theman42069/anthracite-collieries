/* Display settings, saved in this browser only (localStorage). Loaded by every page.
   If the browser blocks storage, everything still works with the defaults. */
(function () {
  'use strict';

  var KEY = 'collieries:settings';
  var VIEW_KEY = 'collieries:lastView';

  var DEFAULTS = {
    layout: 'unset',          // unset (ask on first visit) | phone | pc
    theme: 'dark',            // dark | light | auto (match the device)
    motion: true,             // smooth map flights and transitions
    units: 'mi',              // mi | km
    autoLocate: false,        // show my location as soon as the map opens
    playSpeed: 'normal',      // slow | normal | fast (timeline playback)
    quizLength: 10,           // questions per quiz round
    baseLayer: 'satellite',   // satellite | oldtopo | topo | streets
    placeLabels: true,
    startView: 'region',      // region | last
    markerSize: 'normal',     // small | normal | large
    clustering: true,
    mapLabels: true,          // show site names beside pins when zoomed in
    listSort: 'name',         // name | oldest | newest | closed | nearest
    textSize: 'normal',       // normal | large | xlarge
    showConfidence: true,
    filterBox: 'closed'       // auto | open | closed (starts closed for new visitors)
  };

  var CHOICES = {
    layout: ['unset', 'phone', 'pc'],
    theme: ['dark', 'light', 'auto'],
    units: ['mi', 'km'],
    playSpeed: ['slow', 'normal', 'fast'],
    quizLength: [5, 10, 15],
    baseLayer: ['satellite', 'oldtopo', 'topo', 'streets'],
    startView: ['region', 'last'],
    markerSize: ['small', 'normal', 'large'],
    listSort: ['name', 'oldest', 'newest', 'closed', 'nearest'],
    textSize: ['normal', 'large', 'xlarge'],
    filterBox: ['auto', 'open', 'closed']
  };

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  // Saved values are checked against the defaults, so an old or broken entry can't break the map.
  function load() {
    var saved = read(KEY) || {};
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      var v = saved[k];
      var ok = typeof v === typeof DEFAULTS[k] && (!CHOICES[k] || CHOICES[k].indexOf(v) !== -1);
      out[k] = ok ? v : DEFAULTS[k];
    });
    return out;
  }

  // Until the visitor picks Phone or Computer, guess from the screen width.
  function guessLayout() {
    return window.matchMedia('(max-width: 720px)').matches ? 'phone' : 'pc';
  }

  // Runs in <head>, before the page draws, so the right layout shows from the start.
  function apply(s) {
    var root = document.documentElement;
    root.setAttribute('data-text-size', s.textSize);
    root.setAttribute('data-layout', s.layout === 'unset' ? guessLayout() : s.layout);
    var theme = s.theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : s.theme;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-motion', s.motion ? 'on' : 'off');
  }

  // "Match my device" follows the phone or computer switching between light and dark.
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
    if (load().theme === 'auto') apply(load());
  });

  function save(s) {
    var ok = write(KEY, s);
    apply(s);
    return ok;
  }

  function reset() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(VIEW_KEY);
    } catch (e) { /* storage blocked */ }
    var s = load();
    apply(s);
    return s;
  }

  window.CollierySettings = {
    DEFAULTS: DEFAULTS,
    load: load,
    save: save,
    reset: reset,
    guessLayout: guessLayout,
    isPhone: function () { return document.documentElement.getAttribute('data-layout') === 'phone'; },
    loadView: function () { return read(VIEW_KEY); },
    saveView: function (view) { write(VIEW_KEY, view); }
  };

  apply(load());
})();
