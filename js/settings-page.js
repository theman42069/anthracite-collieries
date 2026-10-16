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
})();
