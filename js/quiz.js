/* Colliery Quiz.
   Questions come from two places:
   1. Built automatically from data/collieries.geojson (years, other names, operators, ...),
      so new sites add new questions with no extra work.
   2. Hand-written ones in data/quiz-extra.json, drawn from the colliery histories.
   Each round picks 10 at random. */
(function () {
  'use strict';

  // Questions per round, from Menu → Settings → Quiz.
  var ROUND = window.CollierySettings ? window.CollierySettings.load().quizLength : 10;
  var BEST_KEY = 'collieries:quizBest';
  var box = document.getElementById('quiz');

  // ---------- Helpers ----------

  var escapeHtml = window.CollieryUtil.escapeHtml;
  var slugify = window.CollieryUtil.slugify;

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function toYear(v) { var n = parseInt(v, 10); return isFinite(n) ? n : null; }

  function readBest() {
    try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; }
  }
  function saveBest(n) {
    try { localStorage.setItem(BEST_KEY, String(n)); } catch (e) { /* storage blocked */ }
  }

  // Year questions are skipped when the dates are approximate or disputed.
  function yearsAreSolid(site) {
    var text = String(site.p.years_active || '');
    var conf = String(site.p.confidence || '');
    if (site.p.closed_estimated || site.p.opened_estimated) return false;
    return !/\bc\.|\bby\b|early|unknown|\d\/\d/i.test(text) && !/^low|mixed|not certain|unverified/i.test(conf.trim());
  }

  function firstPhoto(p) {
    if (p.photo_url) return p.photo_url;
    var list = Array.isArray(p.photos) ? p.photos : [];
    var first = list[0];
    return first ? (typeof first === 'string' ? first : first.url) : '';
  }

  // ---------- Question builders ----------

  // Each returns { text, answer, wrong:[3], explain, site } or null.

  function openedQuestions(sites) {
    var dated = sites.filter(function (s) { return s.opened !== null && yearsAreSolid(s); });
    return dated.map(function (s) {
      var sameYear = sites.filter(function (o) { return o.opened === s.opened; });
      if (sameYear.length > 1) return null; // answer must be unique
      // Wrong answers only from sites whose opening year is known; an undated site might be right.
      var others = shuffle(sites.filter(function (o) { return o !== s && o.opened !== null; })).slice(0, 3);
      if (others.length < 3) return null;
      return {
        kind: 'opened',
        text: 'Which colliery opened in ' + s.opened + '?',
        answer: s.name,
        wrong: others.map(function (o) { return o.name; }),
        explain: s.name + ' opened in ' + s.opened + '. Years active: ' + s.p.years_active + '.',
        site: s
      };
    });
  }

  function closedQuestions(sites) {
    var allYears = sites.map(function (s) { return s.closed; }).filter(function (y) { return y !== null; });
    return sites.filter(function (s) { return s.closed !== null && yearsAreSolid(s); }).map(function (s) {
      // Leave out any year that also appears in this site's own dates, so no wrong answer is half-right.
      var ownText = String(s.p.years_active || '') + ' ' + String(s.p.status || '');
      var pool = allYears.concat([s.closed - 7, s.closed + 6, s.closed - 15, s.closed + 13, s.closed - 25])
        .filter(function (y, i, arr) { return y !== s.closed && arr.indexOf(y) === i && ownText.indexOf(String(y)) === -1; });
      var wrong = shuffle(pool).slice(0, 3);
      if (wrong.length < 3) return null;
      return {
        kind: 'closed',
        text: 'In what year did ' + s.name + ' stop working?',
        answer: String(s.closed),
        wrong: wrong.map(String),
        explain: s.name + ': ' + s.p.status + '.',
        site: s
      };
    });
  }

  function otherNameQuestions(sites) {
    var out = [];
    sites.forEach(function (s) {
      (Array.isArray(s.p.other_names) ? s.p.other_names : []).forEach(function (alias) {
        // Skip names that give the answer away ("Sioux Mine" for Sioux Colliery).
        var a = String(alias).toLowerCase().replace(/[^a-z]/g, '');
        var n = s.name.toLowerCase().replace(/[^a-z]/g, '');
        var firstWord = s.name.toLowerCase().split(' ')[0];
        if (a.indexOf(n.replace('colliery', '')) === 0 || String(alias).toLowerCase().indexOf(firstWord) !== -1) return;
        var others = shuffle(sites.filter(function (o) { return o !== s; })).slice(0, 3);
        if (others.length < 3) return;
        out.push({
          kind: 'alias',
          text: 'Which colliery was also known as “' + alias + '”?',
          answer: s.name,
          wrong: others.map(function (o) { return o.name; }),
          explain: s.name + ' was also known as ' + s.p.other_names.join(', ') + '.',
          site: s
        });
      });
    });
    return out;
  }

  function operatorQuestions(sites) {
    var everyOperator = [];
    sites.forEach(function (s) {
      s.operators.forEach(function (o) { if (everyOperator.indexOf(o) === -1) everyOperator.push(o); });
    });
    return sites.filter(function (s) { return s.operators.length; }).map(function (s) {
      var answer = pick(s.operators);
      var wrong = shuffle(everyOperator.filter(function (o) { return s.operators.indexOf(o) === -1; })).slice(0, 3);
      if (wrong.length < 3) return null;
      return {
        kind: 'operator',
        text: 'Which company ran ' + s.name + '?',
        answer: answer,
        wrong: wrong,
        explain: s.name + ' was run by ' + s.operators.join('; ') + '.',
        site: s
      };
    });
  }

  function oldestQuestions(sites) {
    var dated = sites.filter(function (s) { return s.opened !== null && yearsAreSolid(s); });
    var out = [];
    for (var round = 0; round < 4 && dated.length >= 4; round++) {
      var four = shuffle(dated).slice(0, 4);
      var years = four.map(function (s) { return s.opened; });
      var min = Math.min.apply(null, years);
      if (years.filter(function (y) { return y === min; }).length > 1) continue;
      var oldest = four.filter(function (s) { return s.opened === min; })[0];
      out.push({
        kind: 'oldest',
        text: 'Which of these collieries opened first?',
        answer: oldest.name,
        wrong: four.filter(function (s) { return s !== oldest; }).map(function (s) { return s.name; }),
        explain: four.slice().sort(function (a, b) { return a.opened - b.opened; })
          .map(function (s) { return s.name + ' (' + s.opened + ')'; }).join(', ') + '.',
        site: oldest
      });
    }
    return out;
  }

  function countyQuestions(sites) {
    var countyOf = function (s) { return String(s.p.county || '').split(' (')[0].trim(); };
    return sites.map(function (s) {
      var county = countyOf(s);
      // Skip sites on a county line ("Schuylkill / Northumberland / …"): no single right answer.
      if (!county || county.indexOf('/') !== -1) return null;
      if (sites.filter(function (o) { return countyOf(o) === county; }).length !== 1) return null;
      var others = shuffle(sites.filter(function (o) { return o !== s && countyOf(o).indexOf('/') === -1; })).slice(0, 3);
      if (others.length < 3) return null;
      var otherCounties = others.map(countyOf).filter(function (c, i, a) { return a.indexOf(c) === i; });
      return {
        kind: 'county',
        text: 'Which colliery was in ' + county + '?',
        answer: s.name,
        wrong: others.map(function (o) { return o.name; }),
        explain: s.name + ' was in ' + s.p.county + '. The other choices were in ' + otherCounties.join(' and ') + '.',
        site: s
      };
    });
  }

  // "Which colliery is this?" from a photo. Photos whose caption quotes printed text are left out,
  // since the name is usually printed on the picture itself.
  function photoQuestions(sites) {
    var out = [];
    sites.forEach(function (s) {
      var list = (s.p.photo_url ? [{ url: s.p.photo_url, caption: s.p.photo_caption }] : [])
        .concat(Array.isArray(s.p.photos) ? s.p.photos : []);
      var first = s.name.toLowerCase().split(' ')[0];
      list.forEach(function (ph) {
        if (!ph) return;
        var url = typeof ph === 'string' ? ph : ph.url;
        var cap = String((ph && ph.caption) || '');
        if (!url || /["“”]/.test(cap) || cap.toLowerCase().indexOf(first) !== -1 || /engraving|lithograph|aerial|warning|notice/i.test(cap)) return;
        var others = shuffle(sites.filter(function (o) { return o !== s; })).slice(0, 3);
        if (others.length < 3) return;
        out.push({
          kind: 'photo',
          text: 'Which colliery is in this picture?',
          figure: '<img class="quiz-photo" src="' + escapeHtml(url) + '" alt="A colliery photograph">',
          answer: s.name,
          wrong: others.map(function (o) { return o.name; }),
          explain: 'This is ' + s.name + (cap ? ': ' + cap.replace(/\.$/, '') : '') + '.',
          site: s,
          noPhoto: true
        });
      });
    });
    return out;
  }

  // "Which colliery is at the marked dot?" on a small sketch map with a few towns for bearings.
  var TOWNS = [
    ['Trevorton', 40.7812, -76.6730], ['Shamokin', 40.7890, -76.5588], ['Kulpmont', 40.7934, -76.4730],
    ['Mount Carmel', 40.7970, -76.4119], ['Centralia', 40.8040, -76.3405], ['Ashland', 40.7815, -76.3460],
    ['Shenandoah', 40.8201, -76.2008], ['Mahanoy City', 40.8126, -76.1416]
  ];

  // A window about 26 km across around the marked site (shifted a little at random, so the answer
  // isn't always dead center), with the towns in it for bearings.
  function sketchMap(sites, target) {
    var W = 560, H = 260, KM = 26;
    var kmPerLng = 111 * Math.cos(target.lat * Math.PI / 180);
    var cx = target.lng + (Math.random() - 0.5) * 8 / kmPerLng;
    var cy = target.lat + (Math.random() - 0.5) * 4 / 111;
    var pxPerKm = W / KM;
    var X = function (lng) { return W / 2 + (lng - cx) * kmPerLng * pxPerKm; };
    var Y = function (lat) { return H / 2 - (lat - cy) * 111 * pxPerKm; };
    var inside = function (lat, lng) { var x = X(lng), y = Y(lat); return x > -20 && x < W + 20 && y > -20 && y < H + 20; };
    var s = '<svg class="quiz-map" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Sketch map of nearby collieries and towns, with one colliery marked">';
    TOWNS.forEach(function (t) {
      if (!inside(t[1], t[2])) return;
      s += '<rect class="town-dot" x="' + (X(t[2]) - 3).toFixed(1) + '" y="' + (Y(t[1]) - 3).toFixed(1) + '" width="6" height="6"/>' +
        '<text class="town" x="' + X(t[2]).toFixed(1) + '" y="' + (Y(t[1]) - 8).toFixed(1) + '" text-anchor="middle">' + t[0] + '</text>';
    });
    sites.forEach(function (o) {
      if (o !== target && inside(o.lat, o.lng)) s += '<circle class="site" cx="' + X(o.lng).toFixed(1) + '" cy="' + Y(o.lat).toFixed(1) + '" r="4"/>';
    });
    s += '<text class="scale" x="' + (W - 12) + '" y="' + (H - 10) + '" text-anchor="end">5 km</text>' +
      '<line class="scale" x1="' + (W - 12 - 5 * pxPerKm) + '" x2="' + (W - 12) + '" y1="' + (H - 26) + '" y2="' + (H - 26) + '"/>';
    s += '<circle class="target-ring" cx="' + X(target.lng).toFixed(1) + '" cy="' + Y(target.lat).toFixed(1) + '" r="11"/>' +
      '<circle class="target" cx="' + X(target.lng).toFixed(1) + '" cy="' + Y(target.lat).toFixed(1) + '" r="5"/>';
    return s + '</svg>';
  }

  function mapQuestions(sites) {
    var placed = sites.filter(function (s) { return isFinite(s.lat) && isFinite(s.lng); });
    var km = function (a, b) {
      var dy = (a.lat - b.lat) * 111, dx = (a.lng - b.lng) * 111 * Math.cos(a.lat * Math.PI / 180);
      return Math.sqrt(dx * dx + dy * dy);
    };
    return placed.map(function (s) {
      // Wrong answers at least 4 km away, so the dot can't be read as one of them.
      var others = shuffle(placed.filter(function (o) { return o !== s && km(o, s) > 4; })).slice(0, 3);
      if (others.length < 3) return null;
      return {
        kind: 'map',
        text: 'Which colliery is at the marked dot?',
        figure: sketchMap(placed, s),
        answer: s.name,
        wrong: others.map(function (o) { return o.name; }),
        explain: s.name + ' was ' + (s.p.nearest_town ? 'at ' + s.p.nearest_town : 'here') + '.',
        site: s
      };
    });
  }

  // hard: true → only the bonus round's hard questions; false → only the normal ones.
  function curatedQuestions(extra, bySlug, hard) {
    return (Array.isArray(extra) ? extra : []).map(function (q) {
      if (!q || !!q.hard !== !!hard) return null;
      if (!q.question || !q.answer || !Array.isArray(q.wrong) || q.wrong.length < 3) return null;
      return {
        kind: 'history',
        text: q.question,
        answer: q.answer,
        wrong: q.wrong.slice(0, 3),
        explain: q.explain || '',
        site: bySlug[q.colliery] || null
      };
    });
  }

  // ---------- Build a round ----------

  function buildRound(sites, extra) {
    var bySlug = {};
    sites.forEach(function (s) { bySlug[s.slug] = s; });

    var groups = [
      curatedQuestions(extra, bySlug, false),
      openedQuestions(sites),
      closedQuestions(sites),
      otherNameQuestions(sites),
      operatorQuestions(sites),
      oldestQuestions(sites),
      countyQuestions(sites),
      photoQuestions(sites),
      mapQuestions(sites)
    ].map(function (g) { return shuffle(g.filter(Boolean)); });

    // Take questions from each kind in turn, so a round is a good mix.
    var round = [];
    var usedText = {};
    var i = 0;
    while (round.length < ROUND && groups.some(function (g) { return g.length; })) {
      var g = groups[i % groups.length];
      var q = g.shift();
      if (q && !usedText[q.text]) {
        usedText[q.text] = true;
        q.options = shuffle([q.answer].concat(q.wrong));
        round.push(q);
      }
      i++;
    }
    return shuffle(round);
  }

  // ---------- Screens ----------

  var sitesCache = null;
  var extraCache = null;
  var state = null;

  function buildBonus(sites, extra) {
    var bySlug = {};
    sites.forEach(function (s) { bySlug[s.slug] = s; });
    return shuffle(curatedQuestions(extra, bySlug, true).filter(Boolean)).map(function (q) {
      q.options = shuffle([q.answer].concat(q.wrong));
      return q;
    });
  }

  function start(bonus) {
    state = {
      questions: bonus ? buildBonus(sitesCache, extraCache) : buildRound(sitesCache, extraCache),
      index: 0, score: 0, answers: [], bonus: !!bonus
    };
    if (!state.questions.length) {
      box.innerHTML = '<div class="quiz-card"><p>Not enough colliery data yet to make a quiz.</p></div>';
      return;
    }
    showQuestion();
  }

  function showQuestion() {
    var q = state.questions[state.index];
    var total = state.questions.length;
    box.innerHTML = '' +
      '<div class="quiz-card">' +
        (state.bonus ? '<p class="bonus-tag">⭐ Superintendent\'s bonus round: the hard ones</p>' : '') +
        '<div class="quiz-progress"><span>Question ' + (state.index + 1) + ' of ' + total + '</span><span>Score: ' + state.score + '</span></div>' +
        '<div class="quiz-bar"><span style="width:' + (state.index / total * 100) + '%"></span></div>' +
        '<p class="quiz-question">' + escapeHtml(q.text) + '</p>' +
        (q.figure ? '<div class="quiz-figure">' + q.figure + '</div>' : '') +
        '<div class="quiz-options">' +
          q.options.map(function (opt, i) {
            return '<button type="button" class="quiz-option" data-i="' + i + '">' +
              '<span class="letter">' + 'ABCD'.charAt(i) + '</span><span>' + escapeHtml(opt) + '</span></button>';
          }).join('') +
        '</div>' +
        '<div id="quiz-after"></div>' +
      '</div>';
    var first = box.querySelector('.quiz-option');
    if (first) first.focus();
  }

  function answer(i) {
    var q = state.questions[state.index];
    var chosen = q.options[i];
    var right = chosen === q.answer;
    if (right) state.score++;
    state.answers.push({ q: q, chosen: chosen, right: right });

    Array.prototype.forEach.call(box.querySelectorAll('.quiz-option'), function (btn, j) {
      btn.disabled = true;
      if (q.options[j] === q.answer) btn.classList.add('correct');
      else if (j === i) btn.classList.add('wrong');
    });

    var photo = q.site && !q.noPhoto ? firstPhoto(q.site.p) : '';
    var last = state.index === state.questions.length - 1;
    document.getElementById('quiz-after').innerHTML = '' +
      '<div class="quiz-feedback">' +
        '<strong>' + (right ? '✓ Correct!' : '✗ Not quite. The answer is ' + escapeHtml(q.answer) + '.') + '</strong>' +
        '<p>' + escapeHtml(q.explain) + '</p>' +
        (photo ? '<img src="' + escapeHtml(photo) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
      '</div>' +
      '<div class="quiz-actions">' +
        '<button type="button" class="button primary" id="quiz-next">' + (last ? 'See my score' : 'Next question →') + '</button>' +
        (q.site ? '<a class="button" href="index.html#' + escapeHtml(q.site.slug) + '" target="_blank" rel="noopener">See it on the map</a>' : '') +
      '</div>';
    document.getElementById('quiz-next').focus();
  }

  function next() {
    state.index++;
    if (state.index < state.questions.length) showQuestion();
    else showScore();
  }

  function showScore() {
    var total = state.questions.length;
    var ratio = state.score / total;
    var perfect = ratio === 1;
    var rank, scoreNote, extra = '';

    if (state.bonus) {
      rank = perfect ? 'Every hard one right. The whole valley answers to you.'
        : ratio >= 0.5 ? 'Not bad at all. These are the deep-shaft questions.'
        : 'Tough round. These are the deep-shaft questions.';
      scoreNote = 'Bonus round';
    } else {
      var best = readBest();
      var newBest = state.score > best;
      if (newBest) saveBest(state.score);
      rank = perfect ? 'Mine superintendent! A perfect score.'
        : ratio >= 0.8 ? 'Fire boss. You know these mines well.'
        : ratio >= 0.5 ? 'Miner. A solid shift.'
        : ratio >= 0.3 ? 'Laborer. Keep digging.'
        : 'Breaker boy. Everyone starts somewhere.';
      scoreNote = newBest ? 'New best score!' : 'Your best: ' + Math.max(best, state.score) + ' / ' + total;
      if (perfect) {
        extra =
          '<div class="certificate-box">' +
            '<p><strong>🎖️ You\'ve earned a certificate.</strong> Put your name on it:</p>' +
            '<div class="cert-row">' +
              '<label class="visually-hidden" for="cert-name">Your name</label>' +
              '<input id="cert-name" type="text" maxlength="40" placeholder="Your name" autocomplete="name">' +
              '<button type="button" class="button" id="cert-save">Save certificate</button>' +
            '</div>' +
            '<canvas id="cert-canvas" width="1200" height="850" aria-label="Mine Superintendent certificate"></canvas>' +
          '</div>';
      }
    }

    box.innerHTML = '' +
      '<div class="quiz-card quiz-score">' +
        '<div class="big">' + state.score + ' / ' + total + '</div>' +
        '<p><strong>' + rank + '</strong></p>' +
        '<p class="section-intro">' + scoreNote + '</p>' +
        extra +
        '<div class="quiz-actions" style="justify-content:center">' +
          (perfect && !state.bonus ? '<button type="button" class="button primary" id="quiz-bonus">⭐ Bonus round: the hard ones</button>' : '') +
          '<button type="button" class="button' + (perfect && !state.bonus ? '' : ' primary') + '" id="quiz-again">Play again (new questions)</button>' +
          '<a class="button" href="index.html">Explore the map</a>' +
        '</div>' +
        '<ul class="quiz-review">' +
          state.answers.map(function (a) {
            return '<li><span class="mark ' + (a.right ? 'ok">✓' : 'no">✗') + '</span>' + escapeHtml(a.q.text) +
              '<br><span class="section-intro">Answer: ' + escapeHtml(a.q.answer) +
              (a.right ? '' : ' (you said ' + escapeHtml(a.chosen) + ')') + '</span></li>';
          }).join('') +
        '</ul>' +
      '</div>';

    if (perfect && !state.bonus) {
      if (window.CollierySecrets) CollierySecrets.markFound('superintendent');
      var input = document.getElementById('cert-name');
      try { input.value = localStorage.getItem('collieries:certName') || ''; } catch (e) { /* storage blocked */ }
      drawCertificate(input.value, total);
      input.addEventListener('input', function () {
        try { localStorage.setItem('collieries:certName', input.value); } catch (e) { /* storage blocked */ }
        drawCertificate(input.value, total);
      });
    }
  }

  // ---------- Superintendent certificate ----------

  function drawCertificate(name, total) {
    var c = document.getElementById('cert-canvas');
    if (!c) return;
    var g = c.getContext('2d');
    var W = c.width, H = c.height;
    var serif = '"Libre Baskerville", Georgia, serif';

    g.fillStyle = '#f5ecd7';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3b2f1e';
    g.lineWidth = 10; g.strokeRect(30, 30, W - 60, H - 60);
    g.lineWidth = 2;  g.strokeRect(52, 52, W - 104, H - 104);

    // A little headframe at the top
    g.save();
    g.translate(W / 2, 140);
    g.strokeStyle = '#3b2f1e'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-40, 50); g.lineTo(-12, -50); g.lineTo(12, -50); g.lineTo(40, 50);
    g.moveTo(-30, 15); g.lineTo(30, 15);
    g.moveTo(-12, -50); g.lineTo(12, 15); g.moveTo(12, -50); g.lineTo(-12, 15);
    g.stroke();
    g.beginPath(); g.arc(0, -56, 12, 0, Math.PI * 2); g.stroke();
    g.restore();

    g.fillStyle = '#3b2f1e';
    g.textAlign = 'center';
    g.font = '24px ' + serif;
    g.fillText('ANTHRACITE COLLIERIES OF PENNSYLVANIA', W / 2, 250);
    g.font = 'bold 64px ' + serif;
    g.fillText('Mine Superintendent', W / 2, 340);
    g.font = 'italic 26px ' + serif;
    g.fillText('This certifies that', W / 2, 410);

    g.font = 'bold 52px ' + serif;
    g.fillStyle = '#7a3e12';
    g.fillText(String(name || '').trim() || '______________________', W / 2, 490, W - 200);

    g.fillStyle = '#3b2f1e';
    g.font = '26px ' + serif;
    g.fillText('answered all ' + total + ' questions of the colliery quiz correctly,', W / 2, 560);
    g.fillText('and is hereby placed in charge of every shaft, slope and breaker on the map.', W / 2, 600, W - 160);

    var d = new Date();
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    g.font = '22px ' + serif;
    g.beginPath(); g.moveTo(160, 720); g.lineTo(480, 720); g.moveTo(W - 480, 720); g.lineTo(W - 160, 720);
    g.lineWidth = 2; g.stroke();
    g.fillText(months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(), 320, 710);
    g.fillText('Date', 320, 750);
    g.font = 'italic 30px ' + serif;
    g.fillText('The Fire Boss', W - 320, 708);
    g.font = '22px ' + serif;
    g.fillText('Signed', W - 320, 750);
  }

  function saveCertificate() {
    var c = document.getElementById('cert-canvas');
    if (!c) return;
    var a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'mine-superintendent-certificate.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  box.addEventListener('click', function (e) {
    if (e.target.id === 'quiz-bonus') { start(true); return; }
    if (e.target.id === 'cert-save') { saveCertificate(); return; }
    var opt = e.target.closest('.quiz-option');
    if (opt && !opt.disabled) { answer(Number(opt.dataset.i)); return; }
    if (e.target.id === 'quiz-next') next();
    if (e.target.id === 'quiz-again') start(false);
  });

  // Keys 1–4 or A–D answer; Enter goes on.
  document.addEventListener('keydown', function (e) {
    if (!state || e.target.tagName === 'INPUT') return;
    var k = e.key.toLowerCase();
    var idx = '1234'.indexOf(k) !== -1 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
    var opts = box.querySelectorAll('.quiz-option:not(:disabled)');
    if (idx !== -1 && opts.length && opts[idx]) answer(idx);
  });

  // ---------- Load data ----------

  Promise.all([
    fetch('data/collieries.geojson', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
    fetch('data/quiz-extra.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
  ]).then(function (results) {
    sitesCache = (results[0].features || [])
      .filter(function (f) { return f.geometry && f.geometry.type === 'Point'; })
      .map(function (f) {
        var p = f.properties || {};
        var ops = window.CollieryUtil.operatorsOf(p);
        return {
          p: p,
          name: p.name || 'Unnamed colliery',
          slug: slugify(p.id) || slugify(p.name),
          opened: toYear(p.year_opened),
          closed: toYear(p.year_closed),
          operators: ops,
          lng: f.geometry.coordinates[0],
          lat: f.geometry.coordinates[1]
        };
      });
    extraCache = results[1];
    start();
  }).catch(function (err) {
    console.error(err);
    var el = document.getElementById('status');
    el.innerHTML = '<strong>The quiz could not load.</strong> Open this page through a web server (see README.md), not directly from disk.';
    el.hidden = false;
    el.style.position = 'static';
    el.style.transform = 'none';
  });
})();
