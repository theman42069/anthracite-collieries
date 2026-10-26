/* Helpers shared by every page. Links between pages depend on slugify being the same everywhere. */
(function () {
  'use strict';

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

  // Company names: the "operators" list if given,
  // otherwise the "operator" text split at semicolons with (dates) removed.
  function operatorsOf(props) {
    var list = Array.isArray(props.operators) ? props.operators : (props.operators ? [props.operators] : []);
    if (!list.length && props.operator) {
      list = String(props.operator).split(';').map(function (s) {
        return s.replace(/\([^)]*\)/g, '').replace(/[,\s]+$/, '');
      });
    }
    return list.map(function (s) { return String(s == null ? '' : s).trim(); }).filter(Boolean);
  }

  // Lowercase, accents and punctuation removed, so "St. Nicholas" and "st nicholas" match.
  function plain(text) {
    return String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Fewest typing mistakes (letters added, missed, changed or swapped) between the query
  // and any part of the text. 0 means the query appears exactly.
  function typoDistance(query, text) {
    var n = query.length, m = text.length;
    var prev2 = null, prev = new Array(m + 1).fill(0), row;
    for (var i = 1; i <= n; i++) {
      row = new Array(m + 1);
      row[0] = i;
      for (var j = 1; j <= m; j++) {
        var cost = query[i - 1] === text[j - 1] ? 0 : 1;
        row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 && query[i - 1] === text[j - 2] && query[i - 2] === text[j - 1]) {
          row[j] = Math.min(row[j], prev2[j - 2] + 1); // swapped letters
        }
      }
      prev2 = prev;
      prev = row;
    }
    return Math.min.apply(null, prev); // the match may start and end anywhere in the text
  }

  // Mistakes a search of this length may contain: about one per four letters, none when short.
  function typosAllowed(query) {
    return query.length < 4 ? 0 : Math.max(1, Math.floor(query.length / 4));
  }

  // Typing mistakes between two whole words.
  function wordDistance(a, b) {
    var prev = [], row, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      row = [i];
      for (j = 1; j <= b.length; j++) {
        row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = row;
    }
    return prev[b.length];
  }

  // How well a plain() search matches a plain() person's name: every searched word must match
  // the start of a word in the name, or a whole word with a few mistakes ("kowalski" finds
  // Kowalskie and Kowalsky, not Sekowski). Returns the number of mistakes, or -1 for no match.
  function nameMatch(query, name) {
    var words = name.split(' ');
    var total = 0;
    var ok = query.split(' ').every(function (q) {
      var best = Infinity;
      words.forEach(function (w) { best = Math.min(best, w.indexOf(q) === 0 ? 0 : wordDistance(q, w)); });
      total += best;
      return best <= typosAllowed(q);
    });
    return ok ? total : -1;
  }

  // Pin color for each coal field (lowercase, without "Field").
  var FIELD_COLORS = {
    'northern': '#f2b63c', 'eastern middle': '#4cc3d9', 'western middle': '#ef5b5b', 'southern': '#b28dff'
  };

  // Offline support (sw.js). Browsers only allow it on https:// pages and on this computer.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* the site still works online */ });
    });
  }

  window.CollieryUtil = {
    escapeHtml: escapeHtml, slugify: slugify, isHttpUrl: isHttpUrl,
    operatorsOf: operatorsOf, FIELD_COLORS: FIELD_COLORS,
    plain: plain, typoDistance: typoDistance, typosAllowed: typosAllowed, nameMatch: nameMatch
  };
})();
