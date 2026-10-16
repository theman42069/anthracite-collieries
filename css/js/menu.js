/* Site menu (Map, Sources, About, Settings), built into <div id="site-menu"> on every page. */
(function () {
  'use strict';

  var host = document.getElementById('site-menu');
  if (!host) return;

  var ICONS = {
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    sources: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/>',
    about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17v.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
  };

  var PAGES = [
    { href: 'index.html', label: 'Map', note: 'Explore the collieries', icon: 'map' },
    { href: 'quiz.html', label: 'Quiz', note: 'Test what you know', icon: 'quiz' },
    { href: 'sources.html', label: 'Sources', note: 'Every citation and photo credit', icon: 'sources' },
    { href: 'about.html', label: 'About', note: 'The project and visiting safely', icon: 'about' },
    { href: 'settings.html', label: 'Settings', note: 'Customize the map', icon: 'settings' }
  ];

  function svg(name) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  var current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  host.innerHTML = '' +
    '<button type="button" class="menu-toggle" aria-expanded="false" aria-controls="site-menu-panel" aria-label="Menu">' +
      svg('menu') + '<span class="menu-toggle-text">Menu</span>' +
    '</button>' +
    '<nav class="menu-panel" id="site-menu-panel" aria-label="Pages" hidden><ul>' +
      PAGES.map(function (p) {
        return '<li><a href="' + p.href + '"' + (p.href === current ? ' aria-current="page"' : '') + '>' +
          svg(p.icon) +
          '<span class="menu-text"><span class="menu-label">' + p.label + '</span>' +
          '<span class="menu-note">' + p.note + '</span></span>' +
        '</a></li>';
      }).join('') +
    '</ul></nav>';

  var toggle = host.querySelector('.menu-toggle');
  var panel = host.querySelector('.menu-panel');

  function open() {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    var first = panel.querySelector('a');
    if (first) first.focus();
  }

  function close(refocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (refocus) toggle.focus();
  }

  toggle.addEventListener('click', function () {
    if (panel.hidden) open(); else close();
  });

  document.addEventListener('click', function (e) {
    if (!host.contains(e.target)) close();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) {
      e.stopPropagation();
      close(true);
    }
  }, true);

  // ---------- First visit: "Phone or Computer?" ----------
  // Asked once; the answer is saved and can be changed in Settings.

  var store = window.CollierySettings;
  if (!store || store.load().layout !== 'unset' || current === 'settings.html') return;

  var guess = store.guessLayout();
  var phoneSvg = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg>';
  var pcSvg = '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="12.5" rx="1.5"/><path d="M8.5 20.5h7M12 16.5v4"/></svg>';

  function option(value, svgMarkup, name, desc) {
    return '<button type="button" class="lc-option" data-layout="' + value + '">' +
      (value === guess ? '<span class="lc-suggested">Suggested</span>' : '') +
      svgMarkup +
      '<span class="lc-name">' + name + '</span>' +
      '<span class="lc-desc">' + desc + '</span>' +
    '</button>';
  }

  var chooser = document.createElement('div');
  chooser.className = 'layout-chooser';
  chooser.setAttribute('role', 'dialog');
  chooser.setAttribute('aria-modal', 'true');
  chooser.setAttribute('aria-labelledby', 'lc-title');
  chooser.innerHTML = '' +
    '<div class="lc-card">' +
      '<img src="icons/headframe.svg" alt="" width="44" height="44">' +
      '<h2 id="lc-title">Welcome</h2>' +
      '<p>Are you on a phone or a computer? The map will be set up to fit.</p>' +
      '<div class="lc-options">' +
        option('phone', phoneSvg, 'Phone', 'Bigger buttons; details slide up from the bottom') +
        option('pc', pcSvg, 'Computer', 'Details open beside the map; more on screen') +
      '</div>' +
      '<p class="lc-note">You can change this any time in Menu → Settings.</p>' +
    '</div>';
  document.body.appendChild(chooser);
  chooser.querySelector('.lc-option[data-layout="' + guess + '"]').focus();

  chooser.addEventListener('click', function (e) {
    var btn = e.target.closest('.lc-option');
    if (!btn) return;
    var s = store.load();
    s.layout = btn.dataset.layout;
    store.save(s);
    // Reload so the whole page is laid out for the chosen device.
    if (btn.dataset.layout !== guess) location.reload();
    else chooser.remove();
  });
})();
