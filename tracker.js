(() => {
  const $ = id => document.getElementById(id);
  const IDLE_MS = 3000;           // gap with no interaction that counts as hesitation
  const RAGE_CLICKS = 3;          // clicks on the same target...
  const RAGE_WINDOW_MS = 1000;    // ...within this window
  let S = null, ticker = null;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const secs = ms => (ms / 1000).toFixed(1);

  function fresh() {
    const now = Date.now();
    return { start: now, end: null, last: now, events: [], recent: [], rageTargets: {}, deadTargets: {},
      clicks: 0, misclicks: 0, deadClicks: 0, rageClicks: 0, errors: 0, keys: 0,
      dist: 0, maxScroll: 0, idleMs: 0, idleGaps: 0, success: false, lx: null, ly: null };
  }

  function log(type, detail = {}) {
    if (!S || S.end) return;
    const now = Date.now();
    if (now - S.last > IDLE_MS) { S.idleMs += now - S.last; S.idleGaps++; }
    S.last = now;
    S.events.push({ t: now - S.start, type, ...detail });
  }

  const label = el => {
    const txt = (el.textContent || '').trim().slice(0, 24);
    return el.id || (txt ? `${el.tagName.toLowerCase()} "${txt}"` : el.tagName.toLowerCase());
  };
  const tracking = e => S && !S.end && !e.target.closest('#console, #results');

  // ---------- listeners ----------
  document.addEventListener('click', e => {
    if (!tracking(e)) return;
    const el = e.target, name = label(el), now = Date.now();
    S.clicks++;
    let type = 'click';
    if (el.closest('[data-decoy]')) { S.misclicks++; type = 'misclick'; }
    else if (!el.closest('button, a, input, select, label, textarea')) {
      S.deadClicks++; type = 'dead_click'; S.deadTargets[name] = (S.deadTargets[name] || 0) + 1;
    }
    S.recent = S.recent.filter(r => r.name === name && now - r.t < RAGE_WINDOW_MS);
    S.recent.push({ name, t: now });
    if (S.recent.length === RAGE_CLICKS) { S.rageClicks++; type = 'rage_click'; S.rageTargets[name] = (S.rageTargets[name] || 0) + 1; }
    log(type, { target: name, x: e.pageX, y: e.pageY });
  });

  document.addEventListener('mousemove', e => {
    if (!tracking(e)) return;
    if (S.lx !== null) S.dist += Math.hypot(e.pageX - S.lx, e.pageY - S.ly);
    S.lx = e.pageX; S.ly = e.pageY;
    log('move');
  });

  window.addEventListener('scroll', () => {
    if (!S || S.end) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0) S.maxScroll = Math.max(S.maxScroll, Math.round(scrollY / max * 100));
    log('scroll', { depth: S.maxScroll });
  }, { passive: true });

  document.addEventListener('keydown', e => { if (tracking(e)) { S.keys++; log('key'); } });

  $('regForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!S || S.end) return;
    const problems = [];
    if (!$('name').value.trim()) problems.push('Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test($('email').value)) problems.push('Enter an email like name@example.com.');
    if (!$('plan').value) problems.push('Choose a plan.');
    if (!$('terms').checked) problems.push('Accept the terms.');
    $('formMsg').textContent = problems.join(' ');
    if (problems.length) { S.errors++; log('form_error', { problems: problems.length }); }
    else { log('task_success'); finish(true); }
  });

  // ---------- session control ----------
  $('startBtn').onclick = () => {
    S = fresh(); resetHeatmap();
    $('regForm').reset(); $('formMsg').textContent = '';
    $('results').hidden = true; $('aiOut').textContent = '';
    $('startBtn').disabled = true; $('finishBtn').disabled = false;
    $('status').textContent = 'Recording. Complete the task on the right.';
    ticker = setInterval(renderLive, 500); renderLive();
  };
  $('finishBtn').onclick = () => finish(false);

  function finish(success) {
    if (!S || S.end) return;
    S.end = Date.now(); S.success = success; clearInterval(ticker);
    $('startBtn').disabled = false; $('finishBtn').disabled = true;
    $('startBtn').textContent = 'Start new session';
    $('status').textContent = success ? 'Task completed. Report below.' : 'Session ended. Report below.';
    renderLive(); renderReport();
  }

  // ---------- metrics and analysis ----------
  const duration = () => (S.end || Date.now()) - S.start;

  function metrics() {
    return { task_success: S.success, time_s: +secs(duration()), clicks: S.clicks, misclicks: S.misclicks,
      dead_clicks: S.deadClicks, rage_clicks: S.rageClicks, form_errors: S.errors, keystrokes: S.keys,
      cursor_distance_px: Math.round(S.dist), max_scroll_pct: S.maxScroll,
      idle_s: +secs(S.idleMs), idle_gaps: S.idleGaps };
  }

  function analyze() {
    const m = metrics(), f = [];
    const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0];
    const add = (sev, title, evidence, fix) => f.push({ sev, title, evidence, fix });

    if (!m.task_success) add('high', 'The task was not completed', 'The participant gave up before creating an account.', 'Find the first point of confusion in the event log and simplify that step.');
    if (m.misclicks > 0) {
      const ratio = m.misclicks / Math.max(m.clicks, 1);
      add(ratio > .25 ? 'high' : 'medium', 'Look-alike buttons are being clicked by mistake',
        `${m.misclicks} of ${m.clicks} clicks (${Math.round(ratio * 100)}%) landed on decoy buttons.`,
        'Give the main action a distinct style and remove or de-emphasise competing buttons.');
    }
    if (m.rage_clicks > 0) { const [t, n] = top(S.rageTargets); add('high', 'Users show frustration (rage clicks)', `${m.rage_clicks} burst(s) of ${RAGE_CLICKS}+ clicks within ${RAGE_WINDOW_MS / 1000}s, mostly on ${t} (${n}x).`, 'Make sure that element responds immediately, or explain why nothing happened.'); }
    if (m.dead_clicks >= 2) { const [t, n] = top(S.deadTargets); add('medium', 'Users click things that are not interactive', `${m.dead_clicks} clicks hit non-interactive areas, most often ${t} (${n}x).`, 'Make that element clickable, or style it so it no longer looks clickable.'); }
    if (m.form_errors >= 1) add(m.form_errors >= 2 ? 'medium' : 'low', 'Form validation tripped the user', `${m.form_errors} failed submit(s).`, 'Validate inline as the user types and say exactly what to fix.');
    if (m.idle_gaps >= 2 || m.idle_s > 8) add('medium', 'Signs of hesitation', `${m.idle_gaps} pause(s) over ${IDLE_MS / 1000}s, ${m.idle_s}s idle in total.`, 'Check the labels and layout around the step where the pauses happen.');
    if (m.time_s > 45) add(m.time_s > 90 ? 'high' : 'medium', 'The task took long for a four-field form', `${m.time_s}s on task.`, 'Cut fields, add defaults, or reorder the form.');
    if (m.cursor_distance_px > 6000) add('low', 'Long cursor path', `${m.cursor_distance_px}px of cursor travel.`, 'Group related controls closer together.');
    if (!f.length) add('ok', 'No friction detected', 'The task was completed quickly with no errors.', 'Test with more participants to confirm.');

    let score = 100;
    if (!m.task_success) score -= 30;
    score -= Math.min(30, Math.round(m.misclicks / Math.max(m.clicks, 1) * 40));
    score -= Math.min(20, m.rage_clicks * 10);
    score -= Math.min(10, m.dead_clicks * 2);
    score -= Math.min(10, m.form_errors * 5);
    score -= Math.min(10, Math.round(m.idle_s));
    score -= Math.min(10, Math.max(0, Math.round((m.time_s - 30) / 6)));
    score = Math.max(0, score);
    const grade = score >= 80 ? 'Smooth' : score >= 60 ? 'Some friction' : score >= 40 ? 'Frustrating' : 'Failing';
    return { score, grade, findings: f, metrics: m };
  }

  // ---------- rendering ----------
  const stat = (k, v) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`;
  function renderLive() {
    const m = metrics();
    $('live').innerHTML = stat('Time (s)', m.time_s) + stat('Clicks', m.clicks) + stat('Misclicks', m.misclicks) + stat('Rage clicks', m.rage_clicks);
  }

  function renderReport() {
    const a = analyze(), m = a.metrics;
    $('scoreBox').innerHTML = `<strong>${a.score}</strong>${a.grade}`;
    $('final').innerHTML = stat('Task', m.task_success ? 'Completed' : 'Not completed') + stat('Time (s)', m.time_s) + stat('Clicks', m.clicks) +
      stat('Misclicks', m.misclicks) + stat('Dead clicks', m.dead_clicks) + stat('Rage clicks', m.rage_clicks) + stat('Form errors', m.form_errors) +
      stat('Idle (s)', m.idle_s) + stat('Cursor (px)', m.cursor_distance_px) + stat('Max scroll %', m.max_scroll_pct);
    $('findings').innerHTML = a.findings.map(x => `<li class="${x.sev}"><b>${esc(x.title)}</b><small>${esc(x.evidence)}</small><small>Suggestion: ${esc(x.fix)}</small></li>`).join('');
    $('results').hidden = false;
    $('results').scrollIntoView({ behavior: 'smooth' });
  }

  // ---------- export ----------
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  $('jsonBtn').onclick = () => S && download('ux-session.json', JSON.stringify({ ...analyze(), events: S.events }, null, 2), 'application/json');
  $('csvBtn').onclick = () => {
    if (!S) return;
    const rows = ['t_ms,type,target,x,y'].concat(S.events.map(e => [e.t, e.type, `"${(e.target || '').replace(/"/g, '""')}"`, e.x ?? '', e.y ?? ''].join(',')));
    download('ux-events.csv', rows.join('\n'), 'text/csv');
  };

  // ---------- click heatmap (built from the saved x/y pixel positions) ----------
  let heatOn = false;
  function drawHeatmap() {
    let c = $('heatCanvas');
    if (!c) { c = document.createElement('canvas'); c.id = 'heatCanvas'; document.body.appendChild(c); }
    const w = document.documentElement.scrollWidth, h = document.documentElement.scrollHeight, R = 45;
    c.width = w; c.height = h; c.style.width = w + 'px'; c.style.height = h + 'px';
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    S.events.filter(e => e.x !== undefined).forEach(e => {           // every click has x and y
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, R);
      g.addColorStop(0, 'rgba(0,0,0,0.3)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(e.x - R, e.y - R, R * 2, R * 2);
    });
    const img = ctx.getImageData(0, 0, w, h), d = img.data;          // turn overlap density into colour
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const v = Math.min(1, d[i + 3] / 255 * 1.6);                   // 0 = cold, 1 = hot
      d[i] = Math.min(255, v * 2 * 255);
      d[i + 1] = (v < .5 ? v * 2 : 2 - v * 2) * 255;
      d[i + 2] = Math.max(0, 1 - v * 2) * 255;
      d[i + 3] = 70 + v * 140;
    }
    ctx.putImageData(img, 0, 0);
  }
  function resetHeatmap() {
    heatOn = false;
    const c = $('heatCanvas'); if (c) c.remove();
    $('heatBtn').textContent = 'Show heatmap on page';
  }
  $('heatBtn').onclick = () => {
    if (!S) return;
    if (heatOn) { resetHeatmap(); return; }
    if (!S.events.some(e => e.x !== undefined)) { $('heatNote').textContent = 'No clicks were recorded, so there is nothing to draw.'; return; }
    $('heatNote').textContent = '';
    drawHeatmap(); heatOn = true;
    $('heatBtn').textContent = 'Hide heatmap';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---------- optional AI report (user supplies their own Gemini API key) ----------
  $('aiBtn').onclick = async () => {
    const key = $('apiKey').value.trim(), out = $('aiOut');
    if (!S) return;
    if (!key) { out.textContent = 'Paste your API key first.'; return; }
    out.textContent = 'Writing report...';
    const a = analyze();
    const prompt = 'You are a UX researcher. Using only this usability session data, write a short report: what went wrong, why it likely happened, and 3 prioritised fixes. Do not invent facts.\n\n' +
      JSON.stringify({ score: a.score, metrics: a.metrics, findings: a.findings, first_events: S.events.filter(e => e.type !== 'move').slice(0, 40) });
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || res.status);
      out.textContent = data.candidates[0].content.parts.map(p => p.text || '').join('');
    } catch (err) { out.textContent = 'Could not generate the report: ' + err.message; }
  };
})();
