/* Free tools: courthouse planner (#chPlanner), wedding day timeline (#dayTimeline), golden hour finder (#goldenHour).
   County facts in the planner are the ones stated on san-diego-courthouse-wedding-guide.html; change both together. */
(function () {
  'use strict';
  var TZ = 'America/Los_Angeles', DAY = 86400000;
  var SAN_DIEGO = [32.7157, -117.1611];

  /* ---------- dates (calendar days as UTC midnights) ---------- */
  function parseDay(v) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null; }
  function today() {
    var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = +x.value; });
    return Date.UTC(p.year, p.month - 1, p.day);
  }
  function fmtDay(t, short) {
    return new Intl.DateTimeFormat('en-US', short ? { timeZone: 'UTC', month: 'long', day: 'numeric' }
      : { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(t));
  }
  function iso(t) { return new Date(t).toISOString().slice(0, 10); }
  function addBusinessDays(t, n) { while (n > 0) { t += DAY; var d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) n--; } return t; }
  function fmtClock(date) { return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(date); }
  function fmtMin(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60; return ((h + 11) % 12 + 1) + ':' + (mm < 10 ? '0' : '') + mm + (h < 12 ? ' am' : ' pm'); }
  function money(n) { return '$' + (n % 1 ? n.toFixed(2) : n.toLocaleString('en-US')); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function track(name, params) { try { if (window.gtag) window.gtag('event', name, params || {}); } catch (e) {} }
  function val(root, name) { var el = root.querySelector('[name="' + name + '"]:checked') || root.querySelector('[name="' + name + '"]'); return el ? el.value : ''; }

  /* ---------- sun position (NOAA solar calculator equations) ---------- */
  function rad(d) { return d * Math.PI / 180; } function deg(r) { return r * 180 / Math.PI; }
  function sunParams(T) {
    var L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
    var M = rad(357.52911 + T * (35999.05029 - 0.0001537 * T));
    var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    var C = Math.sin(M) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M) * (0.019993 - 0.000101 * T) + Math.sin(3 * M) * 0.000289;
    var omega = rad(125.04 - 1934.136 * T);
    var lambda = rad(L0 + C - 0.00569 - 0.00478 * Math.sin(omega));
    var eps = rad(23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega));
    var y = Math.tan(eps / 2); y *= y;
    var L = rad(L0);
    var eq = 4 * deg(y * Math.sin(2 * L) - 2 * e * Math.sin(M) + 4 * e * y * Math.sin(M) * Math.cos(2 * L) - 0.5 * y * y * Math.sin(4 * L) - 1.25 * e * e * Math.sin(2 * M));
    return { decl: Math.asin(Math.sin(eps) * Math.sin(lambda)), eq: eq };
  }
  /* Time the sun crosses `elev` degrees on the local calendar day `t` (UTC midnight of that day). Returns a Date or null. */
  function sunEvent(t, lat, lon, elev, evening) {
    var jd0 = t / DAY + 2440587.5, mins = 720 - 4 * lon;
    for (var i = 0; i < 3; i++) {
      var p = sunParams((jd0 + mins / 1440 - 2451545) / 36525);
      var cosH = (Math.sin(rad(elev)) - Math.sin(rad(lat)) * Math.sin(p.decl)) / (Math.cos(rad(lat)) * Math.cos(p.decl));
      if (cosH > 1 || cosH < -1) return null;
      var H = deg(Math.acos(cosH));
      mins = 720 - 4 * (lon + (evening ? -H : H)) - p.eq;
    }
    return new Date(t + mins * 60000);
  }
  function sunset(t, ll) { return sunEvent(t, ll[0], ll[1], -0.833, true); }
  function goldenStart(t, ll) { return sunEvent(t, ll[0], ll[1], 6, true); }
  function clockMinutes(date) {
    var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(date).forEach(function (x) { p[x.type] = +x.value; });
    return p.hour * 60 + p.minute;
  }
  window.ksTools = { sunset: sunset, goldenStart: goldenStart, parseDay: parseDay, fmtClock: fmtClock, addBusinessDays: addBusinessDays };

  /* Fill the page's inquiry form with what the visitor already chose, the same as typing it. */
  function carry(link, date, venue) {
    if (!link) return;
    link.addEventListener('click', function (e) {
      var d = document.getElementById('inq-date'), v = document.getElementById('inq-venue');
      var target = document.getElementById('inquire'), head = document.getElementById('header');
      if (target) {
        // Same re-aim as main.js: lazy images above the form load during the scroll and push it down.
        e.preventDefault();
        var top = function () { return target.getBoundingClientRect().top - (head ? head.offsetHeight : 0); };
        var go = function () { window.scrollTo({ top: top() + window.pageYOffset, behavior: 'smooth' }); };
        var tries = 0, settle = setInterval(function () { if (Math.abs(top()) < 4 || ++tries > 8) return clearInterval(settle); go(); }, 700);
        go();
      }
      if (d && date && !d.value) { d.value = date; d.dispatchEvent(new Event('change', { bubbles: true })); }
      if (v && venue && !v.value) { v.value = venue; v.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  }

  /* ---------- 1. Courthouse planner ---------- */
  var FEE = { public: 129, confidential: 144, ceremony: 107, witness: 58, card: 2.5 };
  var SATURDAYS_2026 = ['2026-01-10', '2026-02-14', '2026-03-21', '2026-04-18', '2026-05-16', '2026-06-13', '2026-07-18', '2026-08-15', '2026-09-19', '2026-10-17', '2026-11-14', '2026-12-12'];
  function initPlanner() {
    var root = document.getElementById('chPlanner'); if (!root) return;
    var out = root.querySelector('.tool-out'), dateEl = root.querySelector('[name="cp-date"]'), used = false;
    dateEl.min = iso(today());
    function render() {
      var t = parseDay(dateEl.value), now = today();
      var lic = val(root, 'cp-license'), wit = val(root, 'cp-witness'), pay = val(root, 'cp-pay');
      root.querySelector('[data-witness]').hidden = lic !== 'public';
      if (t === null) { out.innerHTML = ''; return; }
      if (t < now) { out.innerHTML = '<p class="tool-warn">That date has passed. Pick a date from today on.</p>'; return; }
      var dow = new Date(t).getUTCDay(), days = Math.round((t - now) / DAY), h = '', warn = '';
      if (dow === 0) {
        warn = 'The Clerk\'s marriage appointments are on weekdays, plus one Saturday a month in Santee. For a Sunday, bring your own officiant to a beach or park and use a license from any weekday appointment. <a href="best-places-to-elope-in-san-diego.html">See the elopement spots</a>.';
      } else if (dow === 6) {
        var i = SATURDAYS_2026.indexOf(iso(t));
        if (i > -1) warn = iso(t) === '2026-02-14' ? 'This is one of the Clerk\'s Saturday dates. On February 14 the ceremonies are downtown at the County Administration Center, Suite 273.' : 'This is one of the Clerk\'s Saturday dates. Only the Santee office is open, 9am to 3pm, by appointment.';
        else if (new Date(t).getUTCFullYear() === 2026) {
          var next = SATURDAYS_2026.filter(function (s) { return parseDay(s) > t; })[0], prev = SATURDAYS_2026.filter(function (s) { return parseDay(s) < t && parseDay(s) >= now; }).pop();
          warn = 'The Clerk is closed this Saturday. Santee opens one Saturday a month' + (prev || next ? ': the nearest ' + (prev && next ? 'are ' + fmtDay(parseDay(prev), 1) + ' and ' + fmtDay(parseDay(next), 1) : 'is ' + fmtDay(parseDay(prev || next), 1)) : '') + '. Any weekday works at all four offices.';
        } else warn = 'Santee opens one Saturday a month, and this guide lists the 2026 dates only. Ask the Clerk at (619) 237-0502 whether this Saturday is one of them. Any weekday works at all four offices.';
      }
      var opens = t - 49 * DAY, licFrom = t - 90 * DAY;
      var fee = FEE[lic] + FEE.ceremony + (lic === 'public' && wit === 'clerk' ? FEE.witness : 0) + (pay === 'card' ? FEE.card : 0);
      h += '<h3>Your plan for ' + fmtDay(t) + '</h3>';
      if (warn) h += '<p class="tool-warn">' + warn + '</p>';
      h += '<div class="tool-big">' +
        '<div class="tool-stat"><span>Book the appointment</span><strong>' + (opens > now ? fmtDay(opens, 1) : 'Now') + '</strong><small>' + (opens > now ? 'The scheduler opens this date 7 weeks ahead' : 'This date is already open in the scheduler') + '</small></div>' +
        '<div class="tool-stat"><span>County fees</span><strong>' + money(fee) + '</strong><small>License and ceremony' + (pay === 'card' ? ', paid by card' : '') + '</small></div>' +
        '<div class="tool-stat"><span>Days to go</span><strong>' + days + '</strong><small>' + (opens > now ? 'Booking opens in ' + Math.round((opens - now) / DAY) + ' days' : 'Booking is open now') + '</small></div></div>';
      if (days <= 7) h += '<p class="tool-warn">The Clerk usually books about seven weeks out, so a date this close is often full. A County Clerk-commissioned notary or officiant can issue a confidential license and marry you the same day. <a href="sms:+16195776091">Text (619) 577-6091</a> and I can point you to one.</p>';
      h += '<ul>' +
        '<li><strong>Appointment:</strong> ' + (opens > now ? 'on ' + fmtDay(opens) + ', open the scheduler on the Clerk\'s marriage page and choose "License and Ceremony".' : 'open the scheduler on the Clerk\'s marriage page today and choose "License and Ceremony". A greyed-out date is full.') + ' The phone line is (619) 237-0502.</li>' +
        '<li><strong>License:</strong> the "License and Ceremony" appointment covers both in one visit. If you pick up the license separately, do it ' + (licFrom > now ? 'on or after ' + fmtDay(licFrom, 1) : 'any day from now') + ': it is valid for 90 days with no extensions.</li>' +
        '<li><strong>Fees:</strong> ' + money(FEE[lic]) + ' for the ' + lic + ' license, ' + money(FEE.ceremony) + ' for the ceremony' + (lic === 'public' && wit === 'clerk' ? ', ' + money(FEE.witness) + ' for the Clerk\'s witness' : '') + (pay === 'card' ? ', ' + money(FEE.card) + ' card surcharge' : '') + '. License fees are not refundable.</li>' +
        '<li><strong>Bring:</strong> both of you in person, each with current government photo ID (a passport works)' + (lic === 'public' ? (wit === 'own' ? ', and your witness' : '') : ', and no witness is needed') + '. If a previous marriage ended in the last 90 days, bring the final judgment.</li>' +
        (lic === 'confidential' ? '<li><strong>Confidential license:</strong> you must already be living together and will sign a statement saying so.</li>' : '') +
        '<li><strong>After:</strong> the Clerk can take up to 10 business days to register the license, so plan to order your certified copy from about ' + fmtDay(addBusinessDays(t, 10), 1) + '.</li></ul>' +
        '<p class="tool-hint">Fees and rules are from the San Diego County Clerk as of October 16, 2026. Confirm them when you book.</p>' +
        '<div class="tool-cta"><p>Want ' + fmtDay(t, 1) + ' photographed? One hour of courthouse coverage is $750: before, the ceremony, and portraits after.</p>' +
        '<a href="#inquire" class="btn btn-primary" data-carry>Check This Date</a><br><a href="sms:+16195776091" class="sms">Or text your ceremony time: (619) 577-6091</a></div>';
      out.innerHTML = h;
      carry(out.querySelector('[data-carry]'), iso(t), 'San Diego County Clerk');
      if (!used) { used = true; track('tool_used', { tool: 'courthouse_planner' }); }
    }
    root.addEventListener('change', render); root.addEventListener('input', render); render();
  }

  /* ---------- 2. Wedding day timeline ---------- */
  var COLLECTIONS = [[4, 'Wedding &middot; Basic', 'Starting at $2,200'], [6, 'Wedding &middot; Gold', 'Starting at $3,000'], [8, 'Wedding &middot; Premium', 'Starting at $3,800']];
  function initTimeline() {
    var root = document.getElementById('dayTimeline'); if (!root) return;
    var out = root.querySelector('.tool-out'), dateEl = root.querySelector('[name="tl-date"]'), sunEl = root.querySelector('[name="tl-sunset"]'), used = false, sunAuto = true;
    function num(name, d) { var n = parseFloat(val(root, name)); return isFinite(n) && n >= 0 ? n : d; }
    function clock(name) { var m = /^(\d{1,2}):(\d{2})$/.exec(val(root, name)); return m ? +m[1] * 60 + +m[2] : null; }
    dateEl.addEventListener('change', function () {
      var t = parseDay(dateEl.value); if (t === null || !sunAuto) return;
      var s = sunset(t, SAN_DIEGO); if (!s) return;
      var m = clockMinutes(s); sunEl.value = ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2);
    });
    sunEl.addEventListener('input', function () { sunAuto = false; });
    function render() {
      var C = clock('tl-ceremony'); if (C === null) { out.innerHTML = ''; return; }
      var len = num('tl-length', 30), first = val(root, 'tl-first') === 'yes', ready = val(root, 'tl-ready') === 'yes', cocktail = val(root, 'tl-cocktail') === 'yes';
      var groups = num('tl-groups', 8), party = val(root, 'tl-party') === 'yes', end = val(root, 'tl-end'), recHours = num('tl-reception', 4), travel = num('tl-travel', 0);
      var M = { ready: num('m-ready', 45), couple: num('m-couple', 30), party: num('m-party', 30), group: num('m-group', 3), tuck: num('m-tuck', 30), cocktail: num('m-cocktail', 60), golden: num('m-golden', 20), open: num('m-open', 45), dinner: num('m-dinner', 60), cake: num('m-cake', 20) };
      var fam = Math.round(groups * M.group), rows = [], pre = [], t;
      if (ready) pre.push([M.ready, 'Getting ready: details, final touches, getting dressed', 1]);
      if (ready && travel) pre.push([travel, 'Travel to the ceremony', 0]);
      if (first) {
        pre.push([M.couple, 'First look and portraits of the two of you', 1]);
        if (party) pre.push([M.party, 'Wedding party photos', 1]);
        if (fam) pre.push([fam, 'Family photos, ' + groups + ' groupings', 1]);
      }
      pre.push([M.tuck, 'You are tucked away while guests arrive. Photos of the ceremony site and guests', 1]);
      t = C; for (var i = pre.length - 1; i >= 0; i--) { t -= pre[i][0]; pre[i].push(t); }
      pre.forEach(function (r) { rows.push({ at: r[3], mins: r[0], what: r[1], on: r[2] }); });
      rows.push({ at: C, mins: len, what: 'Ceremony', on: 1 }); t = C + len;
      var after = [];
      if (!first) { if (fam) after.push([fam, 'Family photos, ' + groups + ' groupings']); if (party) after.push([M.party, 'Wedding party photos']); after.push([M.couple, 'Portraits of the two of you']); }
      var afterLen = after.reduce(function (a, r) { return a + r[0]; }, 0), gap = Math.max(cocktail ? M.cocktail : 0, afterLen);
      after.forEach(function (r) { rows.push({ at: t, mins: r[0], what: r[1] + (cocktail ? ' (guests are at cocktail hour)' : ''), on: 1 }); t += r[0]; });
      if (gap > afterLen) rows.push({ at: t, mins: gap - afterLen, what: cocktail ? (afterLen ? 'You join cocktail hour. Candids of guests' : 'Cocktail hour. Candids of guests and the reception room') : 'Break', on: 1 });
      var R = C + len + gap, recEnd = R + recHours * 60; t = R;
      var rec = [[M.open, 'Grand entrance, first dance, and toasts'], [M.dinner, 'Dinner. Table photos and candids'], [M.cake, 'Cake cutting and parent dances']];
      if (travel) { rows.push({ at: t, mins: travel, what: 'Travel to the reception', on: 0 }); t += travel; recEnd += travel; }
      var recStart = t, coverEnd = null;
      rec.forEach(function (r, k) { if (t + r[0] > recEnd) return; rows.push({ at: t, mins: r[0], what: r[1], on: 1, k: k }); t += r[0]; });
      if (recEnd > t) rows.push({ at: t, mins: recEnd - t, what: 'Open dancing' + (end === 'exit' ? ', then your send-off' : ''), on: 1, k: 3 });
      var afterToasts = Math.min(recEnd, recStart + M.open), afterCake = Math.min(recEnd, recStart + M.open + M.dinner + M.cake + 30);
      coverEnd = end === 'toasts' ? afterToasts : end === 'cake' ? afterCake : recEnd;
      rows.slice().forEach(function (r) {
        if (r.at >= coverEnd) r.on = 0;
        else if (r.on && r.at + r.mins > coverEnd) { rows.push({ at: coverEnd, mins: r.at + r.mins - coverEnd, what: r.what.replace(/, then your send-off$/, ''), on: 0 }); r.mins = coverEnd - r.at; }
      });
      var coverStart = rows.filter(function (r) { return r.on; })[0].at;
      var S = clock('tl-sunset'), notes = [];
      if (S !== null) {
        var g0 = S - M.golden - 10, inCer = S > C && S <= C + len + 10;
        if (S <= coverStart) notes.push('Sunset is at ' + fmtMin(S) + ', before your photos begin. Everything will be lit, so plan a few night portraits.');
        else if (S < C) notes.push('Sunset is at ' + fmtMin(S) + ', before your ceremony. With a first look, your portraits get the daylight' + (first ? '.' : '. Without one, the photos after the ceremony will be lit.'));
        else if (inCer) notes.push('Sunset is at ' + fmtMin(S) + ', during or right after your ceremony. The ceremony gets the best light of the day. Moving it 30 minutes earlier leaves light for portraits after.');
        else if (g0 < C + len) notes.push('Sunset is at ' + fmtMin(S) + ', soon after your ceremony. Go straight into portraits after the ceremony to catch golden hour.');
        else if (g0 >= coverEnd) notes.push('Sunset is at ' + fmtMin(S) + ', after photo coverage ends. Extending coverage to ' + fmtMin(S) + ' adds golden hour portraits.');
        else { rows.push({ at: g0, mins: M.golden, what: 'Golden hour: step out for ' + M.golden + ' minutes of portraits (sunset is ' + fmtMin(S) + ')', on: 1, gold: 1 }); }
      }
      rows.sort(function (a, b) { return a.at - b.at || (a.gold ? 1 : -1); });
      var hrs = Math.ceil((coverEnd - coverStart) / 30) / 2, fit = COLLECTIONS.filter(function (c) { return hrs <= c[0]; })[0];
      var h = '<h3>Your wedding day, hour by hour</h3><div class="tool-big">' +
        '<div class="tool-stat"><span>Photos begin</span><strong>' + fmtMin(coverStart) + '</strong></div>' +
        '<div class="tool-stat"><span>Photos end</span><strong>' + fmtMin(coverEnd) + '</strong></div>' +
        '<div class="tool-stat"><span>Coverage you need</span><strong>' + hrs + ' hours</strong><small>' + (fit ? 'Fits the ' + fit[0] + '-hour collection' : 'Longer than a full 8-hour day') + '</small></div></div>';
      notes.forEach(function (n) { h += '<p class="tool-warn">' + n + '</p>'; });
      if (coverStart < 0) h += '<p class="tool-warn">This plan starts before midnight the day before. Move the ceremony later or trim the morning.</p>';
      h += '<table class="tool-table"><thead><tr><th>Time</th><th>What happens</th><th>Min</th></tr></thead><tbody>';
      rows.forEach(function (r) { h += '<tr' + (r.on ? '' : ' class="off"') + '><td>' + fmtMin(r.at) + '</td><td>' + esc(r.what) + (r.on ? '' : ' (no photographer needed)') + '</td><td>' + Math.round(r.mins) + '</td></tr>'; });
      h += '</tbody></table><div class="tool-actions"><button type="button" class="tool-link" data-print>Print or save this timeline</button></div>' +
        '<div class="tool-cta"><p>' + (fit ? 'This day is ' + hrs + ' hours of photography. In San Diego that is the ' + fit[1] + ' collection: ' + fit[0] + ' hours of coverage, ' + fit[2] + '.' : 'This day runs past 8 hours of photography. Coverage beyond 8 hours is quoted with your date.') + '</p>' +
        '<a href="#inquire" class="btn btn-primary" data-carry>Check Your Date</a><br><a href="pricing.html" class="sms">See every collection and price</a></div>';
      out.innerHTML = h;
      carry(out.querySelector('[data-carry]'), dateEl.value, '');
      out.querySelector('[data-print]').addEventListener('click', function () { track('tool_print', { tool: 'day_timeline' }); window.print(); });
      if (!used) { used = true; track('tool_used', { tool: 'day_timeline' }); }
    }
    root.addEventListener('change', render); root.addEventListener('input', render); render();
  }

  /* ---------- 3. Golden hour finder (elopement spots) ---------- */
  var SPOTS = [
    ['Sunset Cliffs Natural Park', 32.7157, -117.2553, 'Best light here is the last 90 minutes before sunset.', 1],
    ['The Wedding Bowl, Cuvier Park', 32.8443, -117.2775, 'The bowl faces west, so golden hour lands right on it.', 0],
    ['Scripps Park and La Jolla Cove', 32.8504, -117.2729, 'Late afternoon to sunset is the window here.', 0],
    ['Calumet Park, Bird Rock', 32.8083, -117.2686, 'This is a sunset spot.', 0],
    ['Windansea Beach', 32.8300, -117.2810, 'A sunset spot, and often clear when the Cove is grey.', 0],
    ['Coronado Central Beach', 32.6835, -117.1870, 'Evening light here is soft and wide.', 0],
    ['Torrey Pines State Beach', 32.9200, -117.2536, 'Sunset below the bluffs is the look.', 1],
    ['Balboa Park gardens', 32.7341, -117.1446, 'The gardens are best in morning or late afternoon shade.', 0],
    ['Mount Soledad', 32.8399, -117.2447, 'Sunset from the top covers the whole coast.', 0],
    ['Cardiff and Encinitas beaches', 33.0142, -117.2812, 'These are sunset beaches.', 0],
    ['County Administration Center waterfront', 32.7222, -117.1722, 'Afternoon on the bay side is best here. The Clerk\'s office closes at 5pm, so portraits follow the ceremony instead of the sunset.', 0]
  ];
  function initGolden() {
    var root = document.getElementById('goldenHour'); if (!root) return;
    var out = root.querySelector('.tool-out'), dateEl = root.querySelector('[name="gh-date"]'), spotEl = root.querySelector('[name="gh-spot"]'), used = false;
    SPOTS.forEach(function (s, i) { var o = document.createElement('option'); o.value = i; o.textContent = s[0]; spotEl.appendChild(o); });
    dateEl.min = iso(today());
    function render() {
      var t = parseDay(dateEl.value); if (t === null) { out.innerHTML = ''; return; }
      var s = SPOTS[+spotEl.value || 0], ll = [s[1], s[2]], set = sunset(t, ll), gold = goldenStart(t, ll), hrs = +val(root, 'gh-hours') || 2;
      if (!set || !gold) { out.innerHTML = ''; return; }
      var month = new Date(t).getUTCMonth(), start = hrs === 2 ? new Date(set.getTime() - 120 * 60000) : hrs === 1 ? new Date(set.getTime() - 75 * 60000) : null;
      var h = '<h3>' + esc(s[0]) + ' on ' + fmtDay(t) + '</h3><div class="tool-big">' +
        '<div class="tool-stat"><span>' + (start ? 'We start at' : 'Start time') + '</span><strong>' + (start ? fmtClock(start) : 'Set together') + '</strong><small>' + (hrs === 2 ? 'Two hours before sunset' : hrs === 1 ? '75 minutes before sunset' : 'Three hours is planned around your day') + '</small></div>' +
        '<div class="tool-stat"><span>Golden hour begins</span><strong>' + fmtClock(gold) + '</strong><small>Sun about 6 degrees above the horizon</small></div>' +
        '<div class="tool-stat"><span>Sunset</span><strong>' + fmtClock(set) + '</strong><small>San Diego time</small></div></div><ul>' +
        '<li>' + s[3] + '</li>';
      if (s[4]) h += '<li>Low tide opens the ledges and sand here, so check the <a href="https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=9410230" target="_blank" rel="noopener">La Jolla tide table</a> for your date. The tide can move the start time as much as the sun does.</li>';
      if (month >= 4 && month <= 6) h += '<li>From May into early July the marine layer sits on the coast in the morning and usually burns off by early afternoon. When it stays, the light is soft and even.</li>';
      if (month === 11) h += '<li>In December the light on the Pacific goes flat after about 3 p.m. and comes back for the last half hour, so the ceremony sits closer to sunset than it would in June.</li>';
      h += '</ul><div class="tool-cta"><p>Want ' + fmtDay(t, 1) + ' at ' + esc(s[0]) + ' photographed? ' + (hrs === 1 ? 'One hour is $750.' : hrs === 2 ? 'Two hours at sunset is $1,100.' : 'Three hours is $1,450.') + ' Up to 15 guests, and I sign as your witness.</p>' +
        '<a href="#inquire" class="btn btn-primary" data-carry>Check This Date</a><br><a href="sms:+16195776091" class="sms">Or text your date and spot: (619) 577-6091</a></div>';
      out.innerHTML = h;
      carry(out.querySelector('[data-carry]'), iso(t), s[0]);
      if (!used) { used = true; track('tool_used', { tool: 'golden_hour' }); }
    }
    root.addEventListener('change', render); root.addEventListener('input', render); render();
  }

  function init() { initPlanner(); initTimeline(); initGolden(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
