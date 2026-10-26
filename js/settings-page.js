/* Settings page: fills the form from saved settings and saves every change straight away. */
(function () {
  'use strict';

  var store = window.CollierySettings;
  var form = document.getElementById('settings-form');
  var status = document.getElementById('save-status');
  var timer = null;

  function fill(s) {
    Object.keys(s).forEach(function (key) {
      var inputs = form.querySelectorAll('[name="' + key + '"]');
      Array.prototype.forEach.call(inputs, function (input) {
        if (input.type === 'checkbox') input.checked = !!s[key];
        else if (input.type === 'radio') input.checked = input.value === String(s[key]);
      });
    });
  }

  function say(message) {
    status.textContent = message;
    clearTimeout(timer);
    timer = setTimeout(function () { status.textContent = ''; }, 2500);
  }

  form.addEventListener('change', function (e) {
    var input = e.target;
    if (!input.name) return;
    var s = store.load();
    var value = input.type === 'checkbox' ? input.checked : input.value;
    if (typeof store.DEFAULTS[input.name] === 'number') value = Number(value); // e.g. quiz length
    s[input.name] = value;
    say(store.save(s) ? 'Saved ✓' : 'Couldn’t save. Your browser is blocking storage for this site.');
    // store.save() re-applies the layout, theme and text size, so this page updates on the spot.
  });

  document.getElementById('reset-settings').addEventListener('click', function () {
    fill(store.reset());
    say('Back to defaults ✓');
  });

  fill(store.load());

  // ---------- Use offline: store every photo the map uses (see sw.js) ----------
  var offlineBtn = document.getElementById('offline-save');
  var offlineStatus = document.getElementById('offline-status');
  if (!('caches' in window) || !('serviceWorker' in navigator)) {
    offlineBtn.disabled = true;
    offlineStatus.textContent = 'This browser can\'t keep the site for offline use.';
  }
  offlineBtn.addEventListener('click', function () {
    offlineBtn.disabled = true;
    offlineStatus.textContent = 'Finding photos…';
    fetch('data/collieries.geojson').then(function (r) { return r.json(); }).then(function (d) {
      var urls = [];
      (d.features || []).forEach(function (f) {
        var p = f.properties || {};
        [p.photo_url].concat((p.photos || []).map(function (ph) { return typeof ph === 'string' ? ph : ph && ph.url; }))
          .forEach(function (u) { if (u && /^photos\//.test(u) && urls.indexOf(u) === -1) urls.push(u); });
      });
      return caches.open('collieries-photos').then(function (cache) {
        var done = 0, failed = 0;
        // A few at a time, so a phone on a weak signal isn't swamped.
        function next() {
          var u = urls.shift();
          if (!u) return Promise.resolve();
          return cache.match(u).then(function (hit) {
            return hit || fetch(u).then(function (res) { if (!res.ok) throw new Error(res.status); return cache.put(u, res); });
          }).catch(function () { failed++; }).then(function () {
            done++;
            offlineStatus.textContent = 'Saving photos: ' + done + ' of ' + (done + urls.length) + '…';
            return next();
          });
        }
        return Promise.all([next(), next(), next(), next()]).then(function () {
          offlineStatus.textContent = failed
            ? 'Done, but ' + failed + ' photos could not be saved. Try again on a better connection.'
            : 'All ' + done + ' photos are saved for offline use ✓';
        });
      });
    }).catch(function () {
      offlineStatus.textContent = 'Couldn\'t save the photos. Check your connection and try again.';
    }).then(function () { offlineBtn.disabled = false; });
  });
})();
