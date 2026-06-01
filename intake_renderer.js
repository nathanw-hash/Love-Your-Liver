/* ============================================================================
 * intake_renderer.js — client-facing LYL intake form (testing app)
 *
 * Renders sections from intake_form.js, autosaves answers into
 * intake_submissions.answers (save/resume), and mirrors the promoted columns
 * (weight_lbs, sensitivity) on every save. No inline onclick (Vercel CSP),
 * no localStorage, strict-mode safe. Built into the lab-tracker index.html.
 *
 * Integration (host provides):
 *   LYLIntakeRenderer.mount({
 *     db: { select: dbSelect, insert: dbInsert, update: dbUpdate }, // app's REST helpers
 *     clientId,                  // resolved via getCurrentClientId() in the host
 *     mountEl,                   // DOM element to render into
 *     form: window.LYL_INTAKE,   // optional; defaults to window.LYL_INTAKE
 *     sectionIds: ['identity','chief_complaints','review_of_systems'], // optional
 *     onStatus: function (state, detail) {}  // 'loading'|'saving'|'saved'|'error'
 *   });
 *
 * db helper contract (matches the app's dbSelect/dbInsert/dbUpdate):
 *   select(table, filters)  -> Promise<{ data: rows[], error }>
 *   insert(table, row)      -> Promise<{ data: row,   error }>  (return=representation)
 *   update(table, id, row)  -> Promise<{ data,        error }>
 *
 * Pure model functions are exposed on LYLIntakeRenderer._model for tests.
 * ==========================================================================*/
(function (root) {
  'use strict';

  // ── pure model (no DOM, no network — unit-testable) ─────────────────────────
  function setScalar(answers, id, value) {
    if (value === '' || value === null || value === undefined) delete answers[id];
    else answers[id] = value;
    return answers;
  }

  function toggleMulti(answers, q, label, checked) {
    var arr = Array.isArray(answers[q.id]) ? answers[q.id].slice() : [];
    if (q.exclusive && label === q.exclusive) {
      if (checked) { arr = [label]; delete answers[q.id + '_other']; }
      else { arr = arr.filter(function (x) { return x !== label; }); }
    } else {
      if (checked) {
        if (q.exclusive) arr = arr.filter(function (x) { return x !== q.exclusive; });
        if (arr.indexOf(label) === -1) arr.push(label);
      } else {
        arr = arr.filter(function (x) { return x !== label; });
      }
    }
    if (arr.length) answers[q.id] = arr; else delete answers[q.id];
    return answers;
  }

  function setOther(answers, q, text) {
    var t = (text || '').trim();
    if (t) {
      answers[q.id + '_other'] = t;
      if (q.exclusive && Array.isArray(answers[q.id])) {
        var arr = answers[q.id].filter(function (x) { return x !== q.exclusive; });
        if (arr.length) answers[q.id] = arr; else delete answers[q.id];
      }
    } else {
      delete answers[q.id + '_other'];
    }
    return answers;
  }

  function kgToLbs(kg) { return Math.round(Number(kg) * 2.20462 * 10) / 10; }

  function computePromoted(form, answers) {
    var out = {};
    var p = (form && form.promoted) || {};
    Object.keys(p).forEach(function (col) {
      var spec = p[col];
      var raw = answers[spec.from];
      if (raw === null || raw === undefined || raw === '') { out[col] = null; return; }
      if (spec.toPounds) {
        var unit = answers[spec.unitFrom] || 'lbs';
        var n = Number(raw);
        out[col] = isFinite(n) ? (unit === 'kg' ? kgToLbs(n) : n) : null;
      } else if (spec.map) {
        out[col] = Object.prototype.hasOwnProperty.call(spec.map, raw) ? spec.map[raw] : null;
      } else {
        out[col] = raw;
      }
    });
    return out;
  }

  function buildSavePayload(form, answers) {
    return Object.assign({ answers: answers }, computePromoted(form, answers));
  }

  // ── store (app REST helpers, injected) ──────────────────────────────────────
  function loadOrCreateSubmission(db, clientId) {
    return db.select('intake_submissions', {
      client_id: 'eq.' + clientId, status: 'eq.in_progress',
      order: 'updated_at.desc', limit: '1'
    }).then(function (res) {
      if (res.error) throw res.error;
      var rows = res.data;
      if (Array.isArray(rows) && rows.length) return rows[0];
      return db.insert('intake_submissions', { client_id: clientId, status: 'in_progress', answers: {} })
        .then(function (ins) { if (ins.error) throw ins.error; return ins.data; });
    });
  }

  function persist(db, id, payload) {
    return db.update('intake_submissions', id, payload)
      .then(function (res) { if (res.error) throw res.error; return res; });
  }

  // ── view ───────────────────────────────────────────────────────────────────
  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  function mount(config) {
    var db = config.db;
    var clientId = config.clientId;
    var mountEl = config.mountEl;
    var form = config.form || (root && root.LYL_INTAKE);
    var sectionIds = config.sectionIds || ['identity', 'chief_complaints', 'review_of_systems'];
    var onStatus = config.onStatus || function () {};

    if (!db || !db.select || !db.insert || !db.update || !clientId || !mountEl || !form) {
      throw new Error('LYLIntakeRenderer.mount: db{select,insert,update}, clientId, mountEl, and form are required');
    }

    var answers = {};
    var submissionId = null;
    var saveTimer = null;

    function status(s, d) { onStatus(s, d); }

    function flush() {
      if (!submissionId) return Promise.resolve();
      status('saving');
      return persist(db, submissionId, buildSavePayload(form, answers))
        .then(function () { status('saved'); })
        .catch(function (e) { status('error', e); });
    }
    function scheduleSave() {
      if (saveTimer) clearTimeout(saveTimer);
      status('saving');
      saveTimer = setTimeout(flush, 800);
    }

    function reconcileMulti(wrap, q) {
      var current = Array.isArray(answers[q.id]) ? answers[q.id] : [];
      wrap.querySelectorAll('input[type="checkbox"]').forEach(function (c) {
        c.checked = current.indexOf(c.value) !== -1;
      });
    }

    function renderQuestion(q) {
      var wrap = el('div', { 'class': 'intake-q', 'data-qid': q.id });
      wrap.appendChild(el('label', { 'class': 'intake-q-label' + (q.required ? ' required' : '') }, q.label));
      if (q.help && q.help.text) {
        if (q.help.url) wrap.appendChild(el('a', { 'class': 'intake-help', href: q.help.url, target: '_blank', rel: 'noopener' }, q.help.text));
        else wrap.appendChild(el('span', { 'class': 'intake-help' }, q.help.text));
      }

      if (q.type === 'email' || q.type === 'text' || q.type === 'number') {
        var input = el('input', { type: q.type === 'number' ? 'number' : (q.type === 'email' ? 'email' : 'text'), id: 'iq_' + q.id });
        if (answers[q.id] != null) input.value = answers[q.id];
        input.addEventListener('input', function () {
          setScalar(answers, q.id, q.type === 'number' ? (input.value === '' ? '' : Number(input.value)) : input.value);
          scheduleSave();
        });
        wrap.appendChild(input);
        if (q.unitOptions) {
          var usel = el('select', { id: 'iq_' + q.id + '_unit', 'class': 'intake-unit' });
          q.unitOptions.forEach(function (u) {
            var o = el('option', { value: u }, u);
            if ((answers[q.id + '_unit'] || q.unit) === u) o.setAttribute('selected', 'selected');
            usel.appendChild(o);
          });
          if (!answers[q.id + '_unit']) answers[q.id + '_unit'] = q.unit || q.unitOptions[0];
          usel.addEventListener('change', function () { setScalar(answers, q.id + '_unit', usel.value); scheduleSave(); });
          wrap.appendChild(usel);
        }
      } else if (q.type === 'textarea') {
        var ta = el('textarea', { id: 'iq_' + q.id, rows: '3' });
        if (answers[q.id] != null) ta.value = answers[q.id];
        ta.addEventListener('input', function () { setScalar(answers, q.id, ta.value); scheduleSave(); });
        wrap.appendChild(ta);
      } else if (q.type === 'single') {
        q.options.forEach(function (opt) {
          var row = el('label', { 'class': 'intake-opt' });
          var r = el('input', { type: 'radio', name: 'iq_' + q.id, value: opt });
          if (answers[q.id] === opt) r.setAttribute('checked', 'checked');
          r.addEventListener('change', function () { if (r.checked) { setScalar(answers, q.id, opt); scheduleSave(); } });
          row.appendChild(r); row.appendChild(el('span', null, opt));
          wrap.appendChild(row);
        });
      } else if (q.type === 'multi') {
        var opts = q.options.slice();
        if (q.exclusive) opts.push(q.exclusive);
        opts.forEach(function (opt) {
          var row = el('label', { 'class': 'intake-opt' });
          var c = el('input', { type: 'checkbox', value: opt });
          if (Array.isArray(answers[q.id]) && answers[q.id].indexOf(opt) !== -1) c.setAttribute('checked', 'checked');
          c.addEventListener('change', function () { toggleMulti(answers, q, opt, c.checked); scheduleSave(); reconcileMulti(wrap, q); });
          row.appendChild(c); row.appendChild(el('span', null, opt));
          wrap.appendChild(row);
        });
        if (q.allowOther) {
          var orow = el('div', { 'class': 'intake-opt-other' });
          orow.appendChild(el('span', null, 'Other:'));
          var ot = el('input', { type: 'text', id: 'iq_' + q.id + '_other' });
          if (answers[q.id + '_other'] != null) ot.value = answers[q.id + '_other'];
          ot.addEventListener('input', function () { setOther(answers, q, ot.value); scheduleSave(); reconcileMulti(wrap, q); });
          orow.appendChild(ot);
          wrap.appendChild(orow);
        }
      }
      return wrap;
    }

    function renderSection(section) {
      var sec = el('section', { 'class': 'intake-section', 'data-section': section.id });
      sec.appendChild(el('h2', { 'class': 'intake-section-title' }, section.title));
      if (section.intro) sec.appendChild(el('p', { 'class': 'intake-section-intro' }, section.intro));
      section.questions.forEach(function (q) { sec.appendChild(renderQuestion(q)); });
      return sec;
    }

    function renderAll() {
      mountEl.innerHTML = '';
      sectionIds.forEach(function (sid) {
        var section = form.sections.filter(function (s) { return s.id === sid; })[0];
        if (section) mountEl.appendChild(renderSection(section));
      });
    }

    status('loading');
    return loadOrCreateSubmission(db, clientId)
      .then(function (sub) {
        submissionId = sub.id;
        answers = (sub.answers && typeof sub.answers === 'object') ? sub.answers : {};
        renderAll();
        status('saved');
        window.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
        return { submissionId: submissionId, flush: flush };
      })
      .catch(function (e) { status('error', e); throw e; });
  }

  var api = {
    mount: mount,
    _model: {
      setScalar: setScalar, toggleMulti: toggleMulti, setOther: setOther,
      kgToLbs: kgToLbs, computePromoted: computePromoted, buildSavePayload: buildSavePayload
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LYLIntakeRenderer = api;
})(typeof window !== 'undefined' ? window : null);
