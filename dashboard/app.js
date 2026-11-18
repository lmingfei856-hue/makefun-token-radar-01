// Token Radar dashboard: renders window.RADAR with no network at all.
// Sortable board, search + category + chain filters, pre-token / live tabs,
// a detail drawer with the value breakdown and farm plan, and a model sandbox
// that re-ranks the board live when the dials move.
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R) { document.body.innerHTML = '<p style="padding:20px">No radar data loaded.</p>'; return; }

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var fmtMoney = function (v) {
    if (v == null) return '—';
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + v;
  };
  var fmtPct = function (v) {
    if (v == null) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
  };
  var fmtAge = function (days) {
    if (days == null) return '—';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return days + 'd';
  };

  var state = { tab: 'pre', q: '', cat: '', chain: '', sort: 'rank', dir: 1, compScale: 1, growthWeight: 0.6, selected: null };
  var DEFAULT_GROWTH_WEIGHT = 0.6;

  // ---- header ----
  $('meta').textContent = 'Snapshot ' + R.as_of + ' · DefiLlama protocol index · model ' + R.model_version;
  $('footSource').textContent = 'Source: ' + R.source + ' · Watchlist floor $' + R.floor_usd.toLocaleString('en-US') + ' · Board generated from the sealed snapshot only.';
  var totalImplied = R.rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
  var top = R.rows[0];
  $('stats').innerHTML =
    '<div class="stat"><b>' + R.watchlist_size + ' / ' + R.watchlist_size + '</b><span>Watchlist covered</span></div>' +
    '<div class="stat"><b>' + R.board_size + '</b><span>Pre-token rows scored</span></div>' +
    '<div class="stat"><b>' + fmtMoney(totalImplied) + '</b><span>Total implied value</span></div>' +
    '<div class="stat"><b>' + R.live_size + '</b><span>Live-token protocols set aside</span></div>';
  $('modelFormula').innerHTML = 'Model <b>' + esc(R.model_version) + '</b>: implied = TVL × category comp (median mcap/TVL of live tokens) × growth × maturity × chains · global comp ' + R.global_comp.toFixed(2) + '×';

  // ---- filter options ----
  var cats = {}, chains = {};
  R.rows.concat(R.live).forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    (r.chains || []).forEach(function (c) { chains[c] = 1; });
  });
  Object.keys(cats).sort().forEach(function (c) { $('cat').appendChild(new Option(c, c)); });
  Object.keys(chains).sort().forEach(function (c) { $('chain').appendChild(new Option(c, c)); });

  // ---- sandbox ----
  var sandboxActive = function () { return state.compScale !== 1 || state.growthWeight !== DEFAULT_GROWTH_WEIGHT; };
  var sandboxValue = function (row) {
    var comp = row.comp_multiple * state.compScale;
    var growth = 1 + (row.growth_pct / 100) * state.growthWeight;
    return Math.max(1, Math.round(row.tvl_usd * comp * growth * row.maturity_multiplier * row.chain_multiplier));
  };
  var applySandbox = function () {
    $('compScaleVal').textContent = state.compScale.toFixed(2) + '×';
    $('growthWeightVal').textContent = state.growthWeight.toFixed(2);
    $('sandboxBadge').hidden = !sandboxActive();
    render();
  };
  $('compScale').addEventListener('input', function (e) { state.compScale = parseFloat(e.target.value); applySandbox(); });
  $('growthWeight').addEventListener('input', function (e) { state.growthWeight = parseFloat(e.target.value); applySandbox(); });
  $('sandboxReset').addEventListener('click', function () {
    state.compScale = 1; state.growthWeight = DEFAULT_GROWTH_WEIGHT;
    $('compScale').value = '1'; $('growthWeight').value = '0.6';
    applySandbox();
  });
  $('sandboxToggle').addEventListener('click', function () {
    var s = $('sandbox');
    s.hidden = !s.hidden;
    $('sandboxToggle').textContent = s.hidden ? 'Model sandbox' : 'Hide sandbox';
  });

  // ---- filtering + sorting ----
  var visibleRows = function () {
    var pool = state.tab === 'pre' ? R.rows.slice() : R.live.slice();
    var q = state.q.trim().toLowerCase();
    var out = pool.filter(function (r) {
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && !(r.chains || []).indexOf(state.chain) >= 0) return false;
      if (q) {
        var hay = (r.name + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    if (state.tab === 'pre' && sandboxActive()) {
      out.forEach(function (r) { r._sandbox = sandboxValue(r); });
      out.sort(function (a, b) { return b._sandbox - a._sandbox || (a.slug < b.slug ? -1 : 1); });
      out.forEach(function (r, i) { r._rank = i + 1; });
    } else if (state.tab === 'pre') {
      out.sort(function (a, b) { return a.rank - b.rank; });
      out.forEach(function (r) { r._rank = r.rank; r._sandbox = r.implied_value_usd; });
    } else {
      out.sort(function (a, b) { return (b.mcap_usd || 0) - (a.mcap_usd || 0); });
    }
    var key = state.sort, dir = state.dir;
    if (key !== 'rank' && state.tab === 'pre') {
      out.sort(function (a, b) {
        var av = a[key], bv = b[key];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'string') return dir * av.localeCompare(bv);
        return dir * (av - bv);
      });
    }
    return out;
  };

  var maxImplied = Math.max.apply(null, R.rows.map(function (r) { return r.implied_value_usd; }));
  var render = function () {
    var rows = visibleRows();
    $('count').textContent = rows.length + ' rows shown';
    var html = '';
    rows.forEach(function (r) {
      var isLive = state.tab === 'live';
      var value = isLive ? (r.mcap_usd || 0) : (r._sandbox != null ? r._sandbox : r.implied_value_usd);
      var pct = maxImplied > 0 ? Math.max(2, Math.round((value / maxImplied) * 100)) : 0;
      var chg = r.change_7d == null ? '<span class="flat">—</span>'
        : r.change_7d > 0 ? '<span class="up">+' + r.change_7d.toFixed(2) + '%</span>'
        : r.change_7d < 0 ? '<span class="down">' + r.change_7d.toFixed(2) + '%</span>'
        : '<span class="flat">0.00%</span>';
      var age = isLive ? '—' : fmtAge(r.age_days);
      var rank = isLive ? '—' : r._rank;
      html += '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="selected"' : '') + '>' +
        '<td class="rank">' + rank + '</td>' +
        '<td class="proto"><b>' + esc(r.name) + '</b><span>' + esc(r.category || 'Uncategorised') + ' on ' + esc((r.chains || []).slice(0, 2).join(', ') || '—') + '</span></td>' +
        '<td class="num">' + fmtMoney(r.tvl_usd) + '</td>' +
        '<td class="num">' + chg + '</td>' +
        '<td class="num">' + age + '</td>' +
        '<td><span class="bar"><i style="width:' + pct + '%"></i></span><span class="imp">' + fmtMoney(value) + '</span></td>' +
        '<td>' + (isLive ? '<span class="pill live">live token</span>' : '<span class="pill">● no token</span>') + '</td></tr>';
    });
    $('rows').innerHTML = html || '<tr><td colspan="7" style="text-align:center;color:var(--muted)">No protocols match these filters.</td></tr>';
    $('hint').textContent = state.tab === 'pre'
      ? 'Pre-token protocols, strongest implied value first. Select a row for its value breakdown and farm plan.'
      : 'Protocols whose token already trades, by market cap. They are set aside from the launch board — the radar watches what has not launched yet.';
  };

  // ---- detail drawer ----
  var showDetail = function (slug) {
    var row = null;
    for (var i = 0; i < R.rows.length; i++) if (R.rows[i].slug === slug) { row = R.rows[i]; break; }
    if (!row) { $('drawer').hidden = true; state.selected = null; return; }
    state.selected = slug;
    var m = row.model || null;
    var breakdown = 'TVL            ' + fmtMoney(row.tvl_usd) + '\n' +
      '× comp         ' + row.comp_multiple.toFixed(2) + '×  (median mcap/TVL of live ' + esc(row.category || 'uncategorised') + ' tokens)\n' +
      '× growth       ' + row.growth_multiplier.toFixed(2) + '×  (7d ' + fmtPct(row.growth_pct) + ', weight 0.60)\n' +
      '× maturity     ' + row.maturity_multiplier.toFixed(2) + '×  (' + fmtAge(row.age_days) + ' with no token)\n' +
      '× chains       ' + row.chain_multiplier.toFixed(2) + '×  (' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ')\n' +
      '= implied      <b>' + fmtMoney(row.implied_value_usd) + '</b>';
    var steps = row.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    $('detail').innerHTML =
      '<div class="detail"><h2>' + esc(row.name) + '</h2>' +
      '<div class="sub">Rank #' + row.rank + ' · ' + esc(row.category || 'Uncategorised') + ' · ' + esc(row.chains.join(', ') || '—') +
      ' · tracked since ' + esc(row.listed_at || 'unknown') + '</div>' +
      '<div class="kv">' +
      '<div><span>TVL</span><b>' + fmtMoney(row.tvl_usd) + '</b></div>' +
      '<div><span>7-day change</span><b>' + fmtPct(row.change_7d) + '</b></div>' +
      '<div><span>Age, no token</span><b>' + fmtAge(row.age_days) + '</b></div>' +
      '<div><span>Implied value</span><b>' + fmtMoney(row.implied_value_usd) + '</b></div>' +
      '</div>' +
      '<h3>How the value is built</h3><div class="breakdown">' + breakdown + '</div>' +
      '<h3>Farm plan — six steps</h3><ol class="steps">' + steps + '</ol>' +
      '<p style="color:var(--muted);font-size:13px;margin-top:14px">Records no token on DefiLlama — that is what the snapshot says, not proof it has none. Implied value is the model’s claim, not a price target.</p></div>';
    $('drawer').hidden = false;
    render();
  };
  $('drawerClose').addEventListener('click', function () { $('drawer').hidden = true; state.selected = null; render(); });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    if (state.tab === 'live') return;
    showDetail(tr.getAttribute('data-slug'));
  });

  // ---- controls ----
  $('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  var setTab = function (tab) {
    state.tab = tab;
    $('tabPre').classList.toggle('active', tab === 'pre');
    $('tabLive').classList.toggle('active', tab === 'live');
    $('drawer').hidden = true; state.selected = null;
    render();
  };
  $('tabPre').addEventListener('click', function () { setTab('pre'); });
  $('tabLive').addEventListener('click', function () { setTab('live'); });
  document.querySelectorAll('#board th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
      render();
    });
  });

  // ---- hash routing (for the three screenshots) ----
  var applyHash = function () {
    var h = (location.hash || '').replace(/^#/, '');
    var params = {};
    h.split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv[0]) params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    if (params.tab === 'live') setTab('live');
    if (params.cat) { state.cat = params.cat; $('cat').value = params.cat; }
    if (params.chain) { state.chain = params.chain; $('chain').value = params.chain; }
    if (params.q) { state.q = params.q; $('q').value = params.q; }
    render();
    if (params.detail) showDetail(params.detail);
  };
  applyHash();
})();
