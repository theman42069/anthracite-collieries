/* Send a Correction page: turns the form into a pre-filled GitHub issue (or text to copy).
   contribute.html#<colliery-id> opens with that colliery chosen. Nothing is sent anywhere by this page. */
(function () {
  'use strict';

  var REPO = 'https://github.com/theman42069/anthracite-collieries/issues/new';
  var form = document.getElementById('contribute');
  var pick = document.getElementById('c-colliery');
  var what = document.getElementById('c-what');
  var photo = document.getElementById('c-photo');
  var source = document.getElementById('c-source');
  var status = document.getElementById('c-status');

  var PROMPTS = {
    correction: ['What should change?', 'For example: the closing year should be 1931, not 1929.', 'Correction'],
    photo: ['What does the photo show?', 'For example: the breaker about 1920, from my grandfather\'s album.', 'Photo'],
    name: ['Who is missing?', 'Name, date of death, age, job and how it happened, as far as you know.', 'Missing name'],
    other: ['What would you like to tell us?', '', 'Note']
  };

  function kind() { return form.querySelector('input[name="kind"]:checked').value; }

  function syncKind() {
    var k = PROMPTS[kind()];
    document.getElementById('c-what-label').textContent = k[0];
    what.placeholder = k[1];
    document.getElementById('c-photo-row').hidden = kind() !== 'photo';
  }

  function message() {
    var name = pick.value ? pick.options[pick.selectedIndex].textContent : '';
    var title = PROMPTS[kind()][2] + (name ? ': ' + name : '');
    var body = [
      '**' + PROMPTS[kind()][0] + '**', what.value.trim() || '(not filled in)', '',
      kind() === 'photo' && photo.value.trim() ? '**Photo:** ' + photo.value.trim() + '\n' : '',
      '**Source:** ' + (source.value.trim() || '(not given)'), '',
      name ? 'Colliery: ' + name + ' (' + pick.value + ')' : '',
      '_Sent from the Send a Correction page._'
    ].filter(function (line, i, all) { return line !== '' || all[i - 1] !== ''; }).join('\n');
    return { title: title, body: body };
  }

  form.addEventListener('change', function (e) { if (e.target.name === 'kind') syncKind(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!what.value.trim()) { what.focus(); status.textContent = 'Please fill in the main box first.'; return; }
    var m = message();
    window.open(REPO + '?title=' + encodeURIComponent(m.title) + '&body=' + encodeURIComponent(m.body), '_blank', 'noopener');
    status.textContent = 'GitHub opened in a new tab. Check the note there and press “Create” to send it.';
  });

  document.getElementById('c-copy').addEventListener('click', function () {
    if (!what.value.trim()) { what.focus(); status.textContent = 'Please fill in the main box first.'; return; }
    var m = message();
    var text = m.title + '\n\n' + m.body.replace(/\*\*|_/g, '');
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () {
      status.textContent = 'Copied. Paste it into a message to the map\'s keeper.';
    }, function () {
      status.textContent = 'Copying was blocked by the browser. Select the text in the boxes and copy it by hand.';
    });
  });

  fetch('data/collieries.geojson').then(function (r) { return r.json(); }).then(function (d) {
    (d.features || []).map(function (f) { return f.properties; })
      .sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); })
      .forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name;
        pick.appendChild(o);
      });
    var id = decodeURIComponent(location.hash.slice(1));
    if (id) pick.value = id;
  });

  syncKind();
})();
