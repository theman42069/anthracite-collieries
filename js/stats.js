/* By the Numbers page: charts drawn as plain SVG/HTML from data/memorial.json and
   data/collieries.geojson. Charts are redrawn at the container's width so text stays readable. */
(function () {
  'use strict';

  var esc = window.CollieryUtil.escapeHtml;
  var tip = document.getElementById('chart-tip');
  var people = [];
  var sites = [];
  var names = {};

  // ---------- Grouping the record text ----------

  // Checked in order; the first match wins.
  var CAUSES = [
    { key: 'other', test: /natural|heart|coronary|pneumonia|ailment|sun ?stroke|illness|disease|atrophy|hernia|fainted/ },
    { key: 'explosion', test: /explo|blast|\bgas\b|fire ?damp|after-?damp|powder|dynamite|\bshot\b|squib|burn|smoke|premature/ },
    { key: 'other', test: /fell (down|into|from)|fall (down|into)|fell off|drown/ },
    { key: 'cars', test: /\bcars?\b|\btrip\b|locomotive|motor|mule|lokie|larry|\brope|cable|cage|bumper|sprag|wagon|run over|coupl|runaway|brak/ },
    { key: 'roof', test: /fall|fell|cav|squeez|struck by|rush|smother|slate|top coal|piece of|lump|clod|\brib\b|crushed|buried|coal|rock/ },
    { key: 'machine', test: /machin|breaker|\brolls?\b|belt|conveyor|gear|pulley|crusher|jig|scraper|electr|wire|shovel|dragline|truck|boiler|scald|steam|engine|shaft|chute|elevat|hoist/ }
  ];
  var CAUSE_LABELS = {
    roof: 'Falls of roof, coal and rock',
    cars: 'Mine cars and haulage',
    explosion: 'Explosions, blasts and gas',
    machine: 'Machinery, breakers and power',
    other: 'Other causes',
    none: 'Not recorded'
  };

  function causeOf(text) {
    var t = String(text || '').toLowerCase().trim();
    if (!t) return 'none';
    for (var i = 0; i < CAUSES.length; i++) if (CAUSES[i].test.test(t)) return CAUSES[i].key;
    return 'other';
  }

  var JOB_LABELS = {
    miner: 'Miners',
    laborer: 'Laborers and loaders',
    haulage: 'Drivers and haulage crews',
    boys: 'Slate pickers, door boys and breaker boys',
    other: 'Other jobs',
    none: 'Not recorded'
  };

  function jobOf(text) {
    var t = String(text || '').toLowerCase().trim();
    // Some register rows put a nationality where the job belongs.
    if (!t || /^(american|polish|irish|welsh|english|german|italian|slavic|lithuanian|hungarian|russian|austrian|scotch|bohemian)$/.test(t)) return 'none';
    if (/slate|picker|breaker boy|door ?(boy|tender)|\bboy\b/.test(t)) return 'boys';
    if (/^(contract )?miners?\b/.test(t)) return 'miner';
    if (/labou?rer|loader|helper/.test(t)) return 'laborer';
    if (/driver|runner|motor|spragger|brake|conductor|footman|bottom ?man|top ?man|starter|patcher|hoist|engineer|lokie|trip/.test(t)) return 'haulage';
    return 'other';
  }

  var AGE_BANDS = [
    { label: 'Under 15', max: 14 }, { label: '15–17', max: 17 }, { label: '18–24', max: 24 },
    { label: '25–34', max: 34 }, { label: '35–44', max: 44 }, { label: '45–54', max: 54 },
    { label: '55–64', max: 64 }, { label: '65 and over', max: Infinity }
  ];

  function ageOf(p) {
    var m = /\d+/.exec(p.age || '');
    return m && +m[0] > 5 && +m[0] < 100 ? +m[0] : null;
  }

  // A plausible year, or NaN for blanks (Number(null) would quietly give 0).
  function yearOf(v) {
    var n = parseInt(v, 10);
    return n > 1700 && n < 2100 ? n : NaN;
  }

  function countBy(list, fn) {
    var out = {};
    list.forEach(function (x) { var k = fn(x); out[k] = (out[k] || 0) + 1; });
    return out;
  }

  function pct(n, total) {
    var v = n / total * 100;
    return (v < 1 && v > 0 ? v.toFixed(1) : Math.round(v)) + '%';
  }

  // ---------- Tooltip ----------

  function showTip(html, e) {
    tip.innerHTML = html;
    tip.hidden = false;
    var x = e.clientX + 14, y = e.clientY + 14;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = Math.max(8, x) + 'px';
    tip.style.top = Math.max(8, y) + 'px';
  }
  function hideTip() { tip.hidden = true; }

  function bindTips(root) {
    root.querySelectorAll('[data-tip]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) { showTip(el.getAttribute('data-tip'), e); });
      el.addEventListener('pointerleave', hideTip);
    });
  }

  // ---------- Tables ----------

  function table(head, rows) {
    return '<table class="data-table"><thead><tr>' + head.map(function (h, i) {
      return '<th' + (i ? ' class="num"' : '') + '>' + esc(h) + '</th>';
    }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
      return '<tr>' + r.map(function (c, i) { return '<td' + (i ? ' class="num"' : '') + '>' + c + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table>';
  }

  // ---------- Column chart (years, ages) ----------

  // bars: [{ label, value, tip }]. opts: { tickEvery, band: { from, to, label } (indexes) }
  function columns(el, bars, opts) {
    opts = opts || {};
    var W = Math.max(280, el.clientWidth), H = opts.height || 220;
    var padL = 34, padR = 8, padT = 12, padB = 26;
    var max = Math.max.apply(null, bars.map(function (b) { return b.value; })) || 1;
    var step = niceStep(max);
    var top = Math.ceil(max / step) * step;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var slot = plotW / bars.length;
    var gap = slot > 6 ? 2 : (slot > 3 ? 1 : 0);
    var bw = Math.min(48, Math.max(1, slot - gap));   // thin marks, even with few columns
    var y = function (v) { return padT + plotH - v / top * plotH; };

    var s = '<svg width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(opts.label || '') + '">';
    if (opts.band) {
      var bx = padL + opts.band.from * slot, bwid = (opts.band.to - opts.band.from + 1) * slot;
      s += '<rect class="gap-band" x="' + bx + '" y="' + padT + '" width="' + bwid + '" height="' + plotH + '"/>';
      s += '<text class="gap-label" x="' + (bx + bwid / 2) + '" y="' + (padT + 12) + '" text-anchor="middle">' + esc(opts.band.label) + '</text>';
    }
    for (var v = 0; v <= top; v += step) {
      s += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      s += '<text class="axis" x="' + (padL - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>';
    }
    bars.forEach(function (b, i) {
      var x = padL + i * slot + (slot - bw) / 2;
      var h = b.value / top * plotH;
      if (b.value > 0) {
        // Rounded top, square base: a path keeps the data end anchored to the baseline.
        var r = Math.min(4, bw / 2, h);
        var yb = padT + plotH, yt = yb - h;
        s += '<path class="bar" d="M' + x + ',' + yb + 'V' + (yt + r) + 'Q' + x + ',' + yt + ' ' + (x + r) + ',' + yt +
          'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + yt + ' ' + (x + bw) + ',' + (yt + r) + 'V' + yb + 'Z"/>';
      }
      // Hit target covers the whole column, not just the bar.
      s += '<rect class="hit" x="' + (padL + i * slot) + '" y="' + padT + '" width="' + slot + '" height="' + plotH + '" data-tip="' + esc(b.tip) + '"/>';
      var every = opts.tickEvery || 1;
      if (every === 1 || (b.tick)) {
        s += '<text class="axis" x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(b.short || b.label) + '</text>';
      }
    });
    s += '<line class="baseline" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + plotH) + '" y2="' + (padT + plotH) + '"/>';
    el.innerHTML = s + '</svg>';
    bindTips(el);
  }

  function niceStep(max) {
    var raw = max / 4;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }

  // ---------- Line chart (collieries working) ----------

  function line(el, points, opts) {
    var W = Math.max(280, el.clientWidth), H = 220;
    var padL = 34, padR = 12, padT = 12, padB = 26;
    var max = Math.max.apply(null, points.map(function (p) { return p.value; })) || 1;
    var step = niceStep(max), top = Math.ceil(max / step) * step;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var x0 = points[0].x, x1 = points[points.length - 1].x;
    var X = function (x) { return padL + (x - x0) / (x1 - x0) * plotW; };
    var Y = function (v) { return padT + plotH - v / top * plotH; };

    var s = '<svg width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(opts.label) + '">';
    for (var v = 0; v <= top; v += step) {
      s += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(v) + '" y2="' + Y(v) + '"/>';
      s += '<text class="axis" x="' + (padL - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + v + '</text>';
    }
    var tickStep = plotW < 420 ? 25 : 10;
    for (var t = Math.ceil(x0 / tickStep) * tickStep; t <= x1; t += tickStep) {
      s += '<text class="axis" x="' + X(t) + '" y="' + (H - 8) + '" text-anchor="middle">' + t + '</text>';
    }
    var d = points.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ',' + Y(p.value).toFixed(1); }).join('');
    s += '<path class="area" d="' + d + 'L' + X(x1) + ',' + Y(0) + 'L' + X(x0) + ',' + Y(0) + 'Z"/>';
    s += '<path class="line" d="' + d + '"/>';
    s += '<line class="baseline" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(0) + '" y2="' + Y(0) + '"/>';
    s += '<line class="crosshair" id="xh" y1="' + padT + '" y2="' + (padT + plotH) + '" visibility="hidden"/>';
    s += '<circle class="dot" id="xd" r="4" visibility="hidden"/>';
    s += '<rect class="hit hit-plain" x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '"/>';
    el.innerHTML = s + '</svg>';

    var svg = el.querySelector('svg'), hit = el.querySelector('.hit');
    var xh = el.querySelector('#xh'), xd = el.querySelector('#xd');
    hit.addEventListener('pointermove', function (e) {
      var r = svg.getBoundingClientRect();
      var year = Math.round(x0 + (e.clientX - r.left - padL) / plotW * (x1 - x0));
      var p = points[Math.max(0, Math.min(points.length - 1, year - x0))];
      xh.setAttribute('x1', X(p.x)); xh.setAttribute('x2', X(p.x)); xh.setAttribute('visibility', 'visible');
      xd.setAttribute('cx', X(p.x)); xd.setAttribute('cy', Y(p.value)); xd.setAttribute('visibility', 'visible');
      showTip('<b>' + p.x + '</b><br>' + p.value + (p.value === 1 ? ' colliery' : ' collieries') + ' working', e);
    });
    hit.addEventListener('pointerleave', function () {
      xh.setAttribute('visibility', 'hidden'); xd.setAttribute('visibility', 'hidden'); hideTip();
    });
  }

  // ---------- Donut ----------

  // slices: [{ key, label, value, cls }] in display order; the "none" slice is drawn gray.
  function donut(el, slices, label) {
    var total = slices.reduce(function (a, s) { return a + s.value; }, 0);
    var R = 90, r = 56, C = 100;
    var a0 = -Math.PI / 2;
    var gapAngle = 0.012;   // a thin surface gap between slices
    var paths = slices.filter(function (s) { return s.value; }).map(function (s) {
      var a1 = a0 + s.value / total * Math.PI * 2;
      var g = Math.min(gapAngle, (a1 - a0) / 4);
      var p = arc(C, C, R, r, a0 + g, a1 - g);
      var tipText = '<b>' + esc(s.label) + '</b><br>' + s.value.toLocaleString() + ' names · ' + pct(s.value, total);
      a0 = a1;
      return '<path class="slice ' + s.cls + '" d="' + p + '" data-tip="' + esc(tipText) + '"/>';
    }).join('');
    el.innerHTML =
      '<svg class="donut" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="' + esc(label) + '">' + paths +
        '<text class="donut-total" x="100" y="98" text-anchor="middle">' + total.toLocaleString() + '</text>' +
        '<text class="donut-sub" x="100" y="118" text-anchor="middle">names</text>' +
      '</svg>' +
      '<ul class="chart-legend">' + slices.map(function (s) {
        return '<li><span class="swatch ' + s.cls + '"></span><span class="legend-label">' + esc(s.label) + '</span>' +
          '<span class="legend-val">' + pct(s.value, total) + '</span></li>';
      }).join('') + '</ul>';
    bindTips(el);
  }

  function arc(cx, cy, R, r, a0, a1) {
    var large = a1 - a0 > Math.PI ? 1 : 0;
    function pt(rad, a) { return (cx + rad * Math.cos(a)).toFixed(2) + ',' + (cy + rad * Math.sin(a)).toFixed(2); }
    return 'M' + pt(R, a0) + 'A' + R + ',' + R + ' 0 ' + large + ' 1 ' + pt(R, a1) +
      'L' + pt(r, a1) + 'A' + r + ',' + r + ' 0 ' + large + ' 0 ' + pt(r, a0) + 'Z';
  }

  // ---------- The page ----------

  function tiles() {
    var byYear = countBy(people, function (p) { return p.date.slice(0, 4); });
    var worst = Object.keys(byYear).sort(function (a, b) { return byYear[b] - byYear[a]; })[0];
    var kids = people.filter(function (p) { var a = ageOf(p); return a !== null && a < 16; }).length;
    var withNames = Object.keys(countBy(people, function (p) { return p.colliery; })).length;
    var years = people.map(function (p) { return +p.date.slice(0, 4); });
    var t = [
      [people.length.toLocaleString(), 'names found so far'],
      [withNames + ' of ' + sites.length, 'collieries with names'],
      [worst + ': ' + byYear[worst], 'the year with the most names'],
      [kids.toLocaleString(), 'boys under 16 among them'],
      [Math.min.apply(null, years) + '–' + Math.max.apply(null, years), 'years covered']
    ];
    document.getElementById('stat-tiles').innerHTML = t.map(function (x) {
      return '<div class="stat-tile"><div class="stat-num">' + esc(x[0]) + '</div><div class="stat-label">' + esc(x[1]) + '</div></div>';
    }).join('');
  }

  function drawYears() {
    var byYear = countBy(people, function (p) { return +p.date.slice(0, 4); });
    var yrs = Object.keys(byYear).map(Number);
    var from = Math.min.apply(null, yrs), to = Math.max.apply(null, yrs);
    var el = document.getElementById('chart-years');
    var tickEvery = el.clientWidth < 500 ? 25 : 10;
    var bars = [];
    for (var y = from; y <= to; y++) {
      var n = byYear[y] || 0;
      bars.push({ label: String(y), value: n, tick: y % tickEvery === 0, tip: '<b>' + y + '</b><br>' + n + (n === 1 ? ' name' : ' names') });
    }
    columns(el, bars, {
      label: 'Names found for each year, ' + from + ' to ' + to,
      tickEvery: tickEvery,
      band: { from: 1919 - from, to: 1923 - from, label: 'records missing' }
    });
    document.getElementById('years-note').textContent =
      'From 1899 on, most names come from the state accident registers, which are complete except for 1919–1923 (shaded), where only newspaper reports were found. Before 1899 the inspectors\' reports and genealogy lists are complete for some years and districts but not others, so low early bars partly reflect missing records.';
    document.getElementById('table-years').innerHTML = table(['Year', 'Names'],
      bars.filter(function (b) { return b.value; }).map(function (b) { return [esc(b.label), b.value]; }));
  }

  function drawDonut(id, tableId, counts, labels, order, label) {
    var slices = order.map(function (k, i) {
      return { key: k, label: labels[k], value: counts[k] || 0, cls: k === 'none' ? 's-none' : 's' + (i + 1) };
    });
    donut(document.getElementById(id), slices, label);
    var total = people.length;
    document.getElementById(tableId).innerHTML = table(['Group', 'Names', 'Share'],
      slices.map(function (s) { return [esc(s.label), s.value.toLocaleString(), pct(s.value, total)]; }));
  }

  function drawAges() {
    var counts = AGE_BANDS.map(function () { return 0; });
    var unknown = 0;
    people.forEach(function (p) {
      var a = ageOf(p);
      if (a === null) { unknown++; return; }
      for (var i = 0; i < AGE_BANDS.length; i++) if (a <= AGE_BANDS[i].max) { counts[i]++; break; }
    });
    var bars = AGE_BANDS.map(function (b, i) {
      return { label: b.label, value: counts[i], tip: '<b>' + b.label + '</b><br>' + counts[i] + ' names' };
    });
    columns(document.getElementById('chart-ages'), bars, { label: 'Names by age at death' });
    document.getElementById('ages-intro').textContent = 'Age at death, where the record gives one (' +
      (people.length - unknown).toLocaleString() + ' of ' + people.length.toLocaleString() + ' names).';
    document.getElementById('table-ages').innerHTML = table(['Age', 'Names'],
      bars.map(function (b) { return [esc(b.label), b.value]; }).concat([['Not recorded', unknown]]));
  }

  function drawCollieries() {
    var counts = countBy(people, function (p) { return p.colliery; });
    var ids = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var max = counts[ids[0]];
    var top = ids.slice(0, 15);
    document.getElementById('chart-collieries').innerHTML = top.map(function (id) {
      var n = counts[id];
      return '<a class="hbar" href="memorial.html#' + esc(id) + '" data-tip="' + esc('<b>' + esc(names[id] || id) + '</b><br>' + n + ' names') + '">' +
        '<span class="hbar-label">' + esc((names[id] || id).replace(/ Colliery$/, '')) + '</span>' +
        '<span class="hbar-track"><span class="hbar-fill" style="width:' + (n / max * 100).toFixed(1) + '%"></span></span>' +
        '<span class="hbar-val">' + n + '</span></a>';
    }).join('');
    bindTips(document.getElementById('chart-collieries'));
    document.getElementById('table-collieries').innerHTML = table(['Colliery', 'Names'],
      ids.map(function (id) { return ['<a href="memorial.html#' + esc(id) + '">' + esc(names[id] || id) + '</a>', counts[id]]; }));
  }

  function drawWorking() {
    var spans = sites.filter(function (s) { return isFinite(s.opened); });
    var from = Math.min.apply(null, spans.map(function (s) { return s.opened; }));
    var to = Math.min(new Date().getFullYear(), Math.max.apply(null, spans.map(function (s) { return isFinite(s.closed) ? s.closed : new Date().getFullYear(); })));
    var points = [];
    for (var y = from; y <= to; y++) {
      points.push({ x: y, value: spans.filter(function (s) { return s.opened <= y && (!isFinite(s.closed) || s.closed >= y); }).length });
    }
    line(document.getElementById('chart-working'), points, { label: 'Collieries on this map working each year, ' + from + ' to ' + to });
    var missing = sites.length - spans.length;
    document.getElementById('working-note').textContent = missing
      ? missing + (missing === 1 ? ' site has' : ' sites have') + ' no opening year and ' + (missing === 1 ? 'is' : 'are') + ' left out.'
      : '';
    document.getElementById('table-working').innerHTML = table(['Year', 'Collieries working'],
      points.filter(function (p) { return p.x % 5 === 0; }).map(function (p) { return [p.x, p.value]; }));
  }

  function drawAll() {
    hideTip();
    tiles();
    drawYears();
    drawDonut('chart-causes', 'table-causes', countBy(people, function (p) { return causeOf(p.cause); }),
      CAUSE_LABELS, ['roof', 'cars', 'explosion', 'machine', 'other', 'none'], 'Names by cause of death');
    drawDonut('chart-jobs', 'table-jobs', countBy(people, function (p) { return jobOf(p.job); }),
      JOB_LABELS, ['miner', 'laborer', 'haulage', 'boys', 'other', 'none'], 'Names by job');
    drawAges();
    drawCollieries();
    drawWorking();
  }

  Promise.all([
    fetch('data/memorial.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
    fetch('data/collieries.geojson', { cache: 'no-cache' }).then(function (r) { return r.json(); })
  ]).then(function (res) {
    people = (res[0].people || []).map(function (r) {
      return { date: r[0], name: r[1], age: r[2], job: r[3], colliery: r[4], cause: r[5] };
    });
    sites = (res[1].features || []).map(function (f) {
      var p = f.properties || {};
      names[p.id] = p.name || p.id;
      return { id: p.id, opened: yearOf(p.year_opened), closed: yearOf(p.year_closed) };
    });
    drawAll();
    var lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      if (Math.abs(window.innerWidth - lastW) < 20) return;
      lastW = window.innerWidth;
      drawAll();
    });
  }).catch(function (err) {
    console.error(err);
    var el = document.getElementById('status');
    el.innerHTML = '<strong>The charts could not load.</strong> Open this page through a web server (see README.md), not directly from disk.';
    el.hidden = false;
  });

  document.addEventListener('scroll', hideTip, { passive: true });
})();
