(function () {
  'use strict';
  var sb = window.supabase.createClient(window.STUDIO.url, window.STUDIO.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  var $ = function (id) { return document.getElementById(id); };
  var STATUSES = ['Still talking', 'No reply', 'Booked', 'Not booked', 'I was unavailable', 'Not a real lead'];
  var JOBS = ['Courthouse Wedding', 'Elopement', 'Wedding', 'Proposal', 'Engagement', 'Maternity', 'Portrait or Family', 'Event', 'Other'];
  var SOURCES = ['Referral', 'Instagram', 'Thumbtack', 'Google search', 'Text or phone', 'Repeat client', 'Wedding vendor', 'Other'];
  var CLOSED = ['Not booked', 'I was unavailable', 'Not a real lead'];
  var FILTERS = [
    { id: 'action', label: 'Needs action', test: function (l) { return !l.status || l.status === 'Still talking'; } },
    { id: 'noreply', label: 'No reply', test: function (l) { return l.status === 'No reply'; } },
    { id: 'booked', label: 'Booked', test: function (l) { return l.status === 'Booked'; } },
    { id: 'closed', label: 'Closed', test: function (l) { return CLOSED.indexOf(l.status) > -1; } },
    { id: 'all', label: 'All', test: function () { return true; } }
  ];
  var state = { leads: [], other: [], filter: 'action', open: {} };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function money(v) { return '$' + Math.round(Number(v) || 0).toLocaleString('en-US'); }
  function today() { var d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86400000); }
  function isoDate(v) { var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || '')); return m ? m[1] : null; }
  function niceDate(iso) { return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function digits(p) { var d = String(p || '').replace(/\D/g, ''); if (d.length === 10) d = '1' + d; return d ? '+' + d : ''; }
  function show(view) { ['login', 'app', 'denied'].forEach(function (v) { $(v).hidden = v !== view; }); }
  function say(id, text, err) { var n = $(id); n.textContent = text || ''; n.className = 'msg' + (err ? ' err' : ''); }

  // ---------- sign in ----------
  function sendLink() {
    var email = $('loginEmail').value.trim().toLowerCase(), btn = $('loginLink');
    if (!email) { say('loginMsg', 'Type your email first.', true); $('loginEmail').focus(); return; }
    btn.disabled = true; say('loginMsg', 'Sending...');
    sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + '/studio' } }).then(function (r) {
      btn.disabled = false;
      if (r.error && /rate|seconds/i.test(r.error.message)) say('loginMsg', 'A link was just sent. Wait a minute before asking again.', true);
      else say('loginMsg', 'If that address has access, a sign-in link is on its way. It comes from Cake Concierge (hello@cakeconcierge.com). Open it on this device.');
    });
  }
  $('loginLink').addEventListener('click', sendLink);
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('loginEmail').value.trim().toLowerCase(), pass = $('loginPass').value, btn = e.target.querySelector('button[type="submit"]');
    if (!pass) { sendLink(); return; }
    btn.disabled = true; say('loginMsg', 'Signing in...');
    sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      btn.disabled = false;
      if (r.error) say('loginMsg', 'That email and password did not match.', true);
      else { $('loginPass').value = ''; say('loginMsg', ''); }
    });
  });
  function signOut() { sb.auth.signOut().then(function () { show('login'); }); }
  $('signOut').addEventListener('click', signOut);
  $('signOut2').addEventListener('click', signOut);

  // ---------- data ----------
  function load() {
    return Promise.all([
      sb.from('crm_users').select('user_id').limit(1),
      sb.from('lead_ledger').select('*').order('inquiry_id', { ascending: false }),
      sb.from('offline_bookings').select('*').order('id', { ascending: false })
    ]).then(function (r) {
      if (r[0].error || !r[0].data || !r[0].data.length) { show('denied'); return; }
      if (r[1].error || r[2].error) { show('app'); say('appMsg', 'Could not load the leads. Check the connection and reload.', true); return; }
      state.leads = r[1].data; state.other = r[2].data;
      show('app'); renderAll();
    });
  }

  function renderAll() { renderTiles(); renderChips(); renderCategories(); renderList(); renderOther(); renderByJob(); }

  function renderTiles() {
    var L = state.leads, booked = L.filter(function (l) { return l.status === 'Booked'; });
    var offline = state.other.reduce(function (s, o) { return s + Number(o.amount || 0); }, 0);
    var tiles = [
      [L.filter(function (l) { return !l.status; }).length, 'New, no status yet'],
      [L.filter(function (l) { return l.status === 'Still talking'; }).length, 'Still talking'],
      [booked.length + state.other.length, 'Booked, forms and other'],
      [money(booked.reduce(function (s, l) { return s + Number(l.amount || 0); }, 0) + offline), 'Booked revenue']
    ];
    var box = $('tiles'); box.textContent = '';
    tiles.forEach(function (t) { box.appendChild(el('div', { class: 'tile' }, [el('b', { text: String(t[0]) }), el('span', { text: t[1] })])); });
  }

  function renderChips() {
    var box = $('chips'); box.textContent = '';
    FILTERS.forEach(function (f) {
      var n = state.leads.filter(f.test).length;
      var b = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(state.filter === f.id), text: f.label + ' (' + n + ')' });
      b.addEventListener('click', function () { state.filter = f.id; renderChips(); renderList(); });
      box.appendChild(b);
    });
  }

  function renderCategories() {
    var sel = $('fCategory'), cur = sel.value, cats = {};
    state.leads.forEach(function (l) { cats[l.category || 'Other'] = 1; });
    sel.textContent = ''; sel.appendChild(el('option', { value: '', text: 'All job types' }));
    Object.keys(cats).sort().forEach(function (c) { sel.appendChild(el('option', { value: c, text: c })); });
    sel.value = cur;
  }
  $('fCategory').addEventListener('change', renderList);
  $('fSearch').addEventListener('input', renderList);

  function eventNote(l) {
    var iso = isoDate(l.event_date);
    if (!iso) return l.event_date ? { text: 'Event ' + l.event_date } : null;
    var d = daysBetween(today(), iso);
    if (d < 0) return { text: 'Event was ' + niceDate(iso) };
    if (d === 0) return { text: 'Event is today', soon: true };
    return { text: 'Event ' + niceDate(iso) + ' (' + d + (d === 1 ? ' day' : ' days') + ')', soon: d <= 14 };
  }

  function option(sel, value, label) { sel.appendChild(el('option', { value: value, text: label })); }
  function field(label, control, cls) { return el('div', { class: 'field' + (cls ? ' ' + cls : '') }, [el('label', { text: label }), control]); }

  function leadCard(l) {
    var received = String(l.received_pt || '').slice(0, 10), ago = received ? daysBetween(received, today()) : null, ev = eventNote(l);
    var statusClass = !l.status ? 'new' : l.status === 'Booked' ? 'booked' : CLOSED.indexOf(l.status) > -1 ? 'closed' : '';
    var meta = el('div', { class: 'meta' }, [
      el('span', { class: 'cat', text: l.category || 'Other' }),
      ev ? el('span', { class: ev.soon ? 'soon' : '', text: ev.text }) : null,
      ago !== null ? el('span', { text: ago === 0 ? 'Inquired today' : 'Inquired ' + ago + (ago === 1 ? ' day ago' : ' days ago') }) : null,
      l.contact_method ? el('span', { text: 'Prefers ' + String(l.contact_method).toLowerCase() }) : null,
      l.status === 'Booked' && Number(l.amount) ? el('span', { text: money(l.amount) }) : null
    ]);
    var card = el('details', { class: 'card' }, [el('summary', {}, [
      el('div', { class: 'line1' }, [el('span', { class: 'name', text: l.name || 'No name' }), el('span', { class: 'status ' + statusClass, text: l.status || 'New' })]), meta])]);
    if (state.open[l.inquiry_id]) card.open = true;
    card.addEventListener('toggle', function () { state.open[l.inquiry_id] = card.open; if (card.open && !card.dataset.built) { card.dataset.built = '1'; card.appendChild(leadBody(l)); } });
    if (card.open) { card.dataset.built = '1'; card.appendChild(leadBody(l)); }
    return card;
  }

  function leadBody(l) {
    var tel = digits(l.phone), actions = el('div', { class: 'actions' }, [
      tel ? el('a', { href: 'sms:' + tel, text: 'Text' }) : null,
      tel ? el('a', { href: 'tel:' + tel, text: 'Call' }) : null,
      l.email ? el('a', { href: 'mailto:' + encodeURIComponent(l.email).replace('%40', '@'), text: 'Email' }) : null]);
    var facts = el('dl', { class: 'facts' });
    [['Phone', l.phone], ['Email', l.email], ['Venue', l.venue], ['Guests', l.guest_count], ['Planner', l.planner], ['Coverage', l.coverage], ['They chose', l.visitor_type],
     ['Came from', l.source], ['Form on', l.form_page], ['Sent the form', l.submissions > 1 ? l.submissions + ' times' : null]].forEach(function (f) {
      if (f[1] === null || f[1] === undefined || f[1] === '') return;
      facts.appendChild(el('dt', { text: f[0] })); facts.appendChild(el('dd', { text: String(f[1]) }));
    });
    var status = el('select', {}); option(status, '', 'New, no status yet'); STATUSES.forEach(function (s) { option(status, s, s); }); status.value = l.status || '';
    var job = el('select', {}); option(job, '', 'Not booked yet'); JOBS.forEach(function (j) { option(job, j, j); }); job.value = l.booked_category || '';
    var price = el('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', placeholder: 'e.g. 900' }); if (Number(l.amount)) price.value = Math.round(Number(l.amount));
    var contact = el('input', { type: 'date' }); contact.value = l.last_contact_at || '';
    var todayBtn = el('button', { type: 'button', class: 'btn ghost', text: 'Today' }); todayBtn.addEventListener('click', function () { contact.value = today(); });
    var note = el('textarea', { placeholder: 'What happened, what is next' }); note.value = l.outcome_note || '';
    var save = el('button', { type: 'submit', class: 'btn', text: 'Save' }), saved = el('span', { class: 'saved', role: 'status' });
    var form = el('form', { class: 'edit' }, [field('Status', status), field('Job booked', job), field('Price ($)', price),
      field('Last contacted', el('div', { class: 'with-btn' }, [contact, todayBtn])), field('Notes', note, 'wide'), el('div', { class: 'save wide' }, [save, saved])]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var isBooked = status.value === 'Booked';
      if (isBooked && !(Number(price.value) > 0)) { saved.textContent = 'Add the price for a booked job.'; saved.className = 'saved err'; price.focus(); return; }
      if (isBooked && !job.value) { saved.textContent = 'Pick the job booked.'; saved.className = 'saved err'; job.focus(); return; }
      var row = { inquiry_id: l.inquiry_id, status: status.value || null, booked: isBooked, amount: isBooked ? Number(price.value) : 0,
        booked_category: job.value || null, note: note.value.trim() || null, last_contact_at: contact.value || null, updated_at: new Date().toISOString() };
      save.disabled = true; saved.textContent = 'Saving...'; saved.className = 'saved';
      sb.from('lead_outcomes').upsert(row, { onConflict: 'inquiry_id' }).then(function (r) {
        save.disabled = false;
        if (r.error) { saved.textContent = 'Not saved. Try again.'; saved.className = 'saved err'; return; }
        l.status = row.status; l.booked = row.booked; l.amount = row.amount; l.booked_category = row.booked_category; l.outcome_note = row.note; l.last_contact_at = row.last_contact_at;
        renderTiles(); renderChips(); renderList(); renderByJob();
      });
    });
    return el('div', { class: 'body' }, [actions, facts, l.message ? el('p', { class: 'message', text: l.message }) : null, form]);
  }

  function renderList() {
    var f = FILTERS.filter(function (x) { return x.id === state.filter; })[0], cat = $('fCategory').value, q = $('fSearch').value.trim().toLowerCase();
    var rows = state.leads.filter(function (l) {
      if (!f.test(l)) return false;
      if (cat && (l.category || 'Other') !== cat) return false;
      if (q && [l.name, l.phone, l.email, l.venue, l.outcome_note].join(' ').toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var box = $('list'); box.textContent = '';
    $('count').textContent = rows.length + (rows.length === 1 ? ' lead' : ' leads');
    rows.forEach(function (l) { box.appendChild(leadCard(l)); });
    if (!rows.length) box.appendChild(el('p', { class: 'muted', text: 'Nothing here.' }));
  }

  // ---------- other bookings ----------
  function otherForm(o) {
    o = o || {};
    var client = el('input', { type: 'text', required: true, maxlength: '120' }); client.value = o.client || '';
    var source = el('select', {}); option(source, '', 'Choose one'); SOURCES.forEach(function (s) { option(source, s, s); });
    if (o.source && SOURCES.indexOf(o.source) === -1) option(source, o.source, o.source); source.value = o.source || '';
    var job = el('select', {}); option(job, '', 'Choose one'); JOBS.forEach(function (j) { option(job, j, j); }); job.value = o.category || '';
    var price = el('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', required: true }); if (Number(o.amount)) price.value = Math.round(Number(o.amount));
    var booked = el('input', { type: 'date' }); booked.value = o.booked_at || '';
    var event = el('input', { type: 'date' }); event.value = o.event_date || '';
    var note = el('textarea', {}); note.value = o.note || '';
    var save = el('button', { type: 'submit', class: 'btn', text: 'Save' }), saved = el('span', { class: 'saved', role: 'status' });
    var form = el('form', { class: 'edit' }, [field('Client', client), field('How they found us', source), field('Job booked', job), field('Price ($)', price),
      field('Date booked', booked), field('Event date', event), field('Notes', note, 'wide'), el('div', { class: 'save wide' }, [save, saved])]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var row = { client: client.value.trim(), source: source.value || null, category: job.value || null, amount: Number(price.value) || 0,
        booked_at: booked.value || null, event_date: event.value || null, note: note.value.trim() || null, updated_at: new Date().toISOString() };
      save.disabled = true; saved.textContent = 'Saving...'; saved.className = 'saved';
      var q = o.id ? sb.from('offline_bookings').update(row).eq('id', o.id).select() : sb.from('offline_bookings').insert(row).select();
      q.then(function (r) {
        save.disabled = false;
        if (r.error || !r.data || !r.data.length) { saved.textContent = 'Not saved. Try again.'; saved.className = 'saved err'; return; }
        if (o.id) state.other = state.other.map(function (x) { return x.id === o.id ? r.data[0] : x; }); else state.other.unshift(r.data[0]);
        renderTiles(); renderOther(); renderByJob();
      });
    });
    return form;
  }
  function renderOther() {
    var box = $('otherList'); box.textContent = '';
    state.other.forEach(function (o) {
      var card = el('details', { class: 'card' }, [el('summary', {}, [
        el('div', { class: 'line1' }, [el('span', { class: 'name', text: o.client }), el('span', { class: 'status booked', text: money(o.amount) })]),
        el('div', { class: 'meta' }, [el('span', { class: 'cat', text: o.category || 'Job type not set' }), o.source ? el('span', { text: o.source }) : null,
          o.event_date ? el('span', { text: 'Event ' + niceDate(o.event_date) }) : null])])]);
      card.addEventListener('toggle', function () { if (card.open && !card.dataset.built) { card.dataset.built = '1'; card.appendChild(el('div', { class: 'body' }, [otherForm(o)])); } });
      box.appendChild(card);
    });
  }
  $('addOther').addEventListener('click', function () {
    var box = $('otherList'); if (box.firstChild && box.firstChild.dataset && box.firstChild.dataset.fresh) return;
    var card = el('div', { class: 'card', 'data-fresh': '1' }, [el('div', { class: 'body' }, [otherForm()])]);
    box.insertBefore(card, box.firstChild); card.querySelector('input').focus();
  });

  // ---------- by job type ----------
  function renderByJob() {
    var rows = {}, order = [];
    function row(k) { if (!rows[k]) { rows[k] = { leads: 0, booked: 0, rev: 0 }; order.push(k); } return rows[k]; }
    state.leads.forEach(function (l) {
      row(l.category || 'Other').leads++;
      if (l.status === 'Booked') { var b = row(l.booked_category || l.category || 'Other'); b.booked++; b.rev += Number(l.amount || 0); }
    });
    state.other.forEach(function (o) { var b = row(o.category || 'Job type not set'); b.booked++; b.rev += Number(o.amount || 0); });
    order.sort(function (a, b) { return rows[b].rev - rows[a].rev || rows[b].leads - rows[a].leads; });
    var t = el('table', {}, [el('thead', {}, [el('tr', {}, ['Job type', 'Form leads', 'Booked', 'Revenue'].map(function (h) { return el('th', { text: h }); }))])]);
    var body = el('tbody'), tot = { leads: 0, booked: 0, rev: 0 };
    order.forEach(function (k) { var r = rows[k]; tot.leads += r.leads; tot.booked += r.booked; tot.rev += r.rev;
      body.appendChild(el('tr', {}, [el('td', { text: k }), el('td', { text: String(r.leads) }), el('td', { text: String(r.booked) }), el('td', { text: money(r.rev) })])); });
    body.appendChild(el('tr', {}, [el('td', { text: 'Total' }), el('td', { text: String(tot.leads) }), el('td', { text: String(tot.booked) }), el('td', { text: money(tot.rev) })]));
    t.appendChild(body);
    var box = $('byJob'); box.textContent = '';
    box.appendChild(el('div', { class: 'tablewrap' }, [t]));
    box.appendChild(el('p', { class: 'muted small', text: 'Form leads counts what people asked about. Booked and revenue use the job actually booked, and include bookings with no form.' }));
  }

  // ---------- tabs ----------
  Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (x) { x.setAttribute('aria-selected', String(x === b)); });
      ['leads', 'other', 'byjob'].forEach(function (t) { $('tab-' + t).hidden = t !== b.dataset.tab; });
    });
  });

  // ---------- start ----------
  var started = false;
  function start(session) {
    if (!session) { show('login'); return; }
    if (started) return; started = true;
    $('whoEmail').textContent = session.user.email || '';
    if (window.location.hash || window.location.search) history.replaceState(null, '', window.location.pathname);
    load();
  }
  sb.auth.onAuthStateChange(function (event, session) { if (event === 'SIGNED_OUT') { started = false; show('login'); } else if (session) start(session); });
  sb.auth.getSession().then(function (r) { start(r.data.session); });
})();
