// DOM HUD 헬퍼
const $ = (id) => document.getElementById(id);

export function showHud(on) { $('hud').classList.toggle('hidden', !on); }
export function setStage(n, total, name) { $('stage-num').textContent = `${n}/${total}`; $('stage-name').textContent = name; }
export function setOrder(text) { $('order-chip').textContent = text; }
export function setHint(text) { const h = $('hint'); if (h.textContent !== text) { h.textContent = text; placeHint(); } }
/** 힌트를 하단 조작 버튼 바로 위에 배치 (버튼이 두 줄이 되어도 겹치지 않게) */
let hintTop = false;
export function hintAtTop(on) { hintTop = on; placeHint(); }
export function placeHint() {
  const c = $('controls'), h = $('hint');
  if (hintTop) { h.style.bottom = 'auto'; h.style.top = 'calc(var(--safe-top) + 72px)'; return; }
  h.style.top = 'auto';
  const rect = c.getBoundingClientRect();
  const top = c.children.length ? Math.min(...[...c.children].map((e) => e.getBoundingClientRect().top)) : rect.bottom;
  h.style.bottom = `${Math.max(80, window.innerHeight - top + 10)}px`;
}
window.addEventListener('resize', () => placeHint());

export function setTimer(left, total) {
  const t = Math.max(0, Math.ceil(left));
  const txt = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const el = $('timer-text');
  if (el.textContent !== txt) el.textContent = txt;
  $('timer-ring').style.strokeDashoffset = String(97.4 * (1 - left / total));
  $('timer').classList.toggle('warn', left <= 30);
}

export function clearControls() { $('controls').innerHTML = ''; hintTop = false; }

/** 버튼 추가: {label, onClick, cls} */
export function addButton(label, onClick, cls = '') {
  const b = document.createElement('button');
  b.className = `btn ${cls}`;
  b.innerHTML = label;
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(b); });
  $('controls').appendChild(b);
  requestAnimationFrame(placeHint);
  return b;
}

/** 세그먼트 토글: options [{key,label}] */
export function addSegment(options, active, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'seg';
  const btns = options.map((o) => {
    const b = document.createElement('button');
    b.innerHTML = o.label; b.dataset.key = o.key;
    if (o.key === active) b.classList.add('on');
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      btns.forEach((x) => x.classList.toggle('on', x === b));
      onChange(o.key);
    });
    wrap.appendChild(b);
    return b;
  });
  wrap.select = (key) => btns.forEach((x) => x.classList.toggle('on', x.dataset.key === key));
  $('controls').appendChild(wrap);
  requestAnimationFrame(placeHint);
  return wrap;
}

export function clearMeters() { $('meters').innerHTML = ''; }
/** 게이지: zone=[lo,hi] (0~1 비율), 숨김 가능 */
export function addMeter(label, { zone = null } = {}) {
  const m = document.createElement('div');
  m.className = 'meter';
  m.innerHTML = `<span class="label">${label}</span><span class="bar">${zone ? `<span class="zone" style="left:${zone[0] * 100}%;width:${(zone[1] - zone[0]) * 100}%"></span>` : ''}<span class="fill"></span></span><span class="val"></span>`;
  $('meters').appendChild(m);
  const fill = m.querySelector('.fill'), val = m.querySelector('.val');
  return {
    el: m,
    set(frac, text) { fill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`; if (val.textContent !== text) val.textContent = text; },
    show(on) { m.style.display = on ? '' : 'none'; },
  };
}

export function showCard(html, actions = {}, { bottom = false } = {}) {
  const o = $('overlay');
  o.innerHTML = `<div class="card">${html}</div>`;
  o.classList.add('show');
  o.classList.toggle('bottom', bottom);
  o.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); actions[b.dataset.act]?.(b); });
  });
  return o.firstElementChild;
}
export function hideOverlay() { const o = $('overlay'); o.classList.remove('show'); o.innerHTML = ''; }

let toastTimer = 0;
export function toast(text, { bad = false, sub = '', ms = 1100 } = {}) {
  const t = $('toast');
  t.innerHTML = `${text}${sub ? `<span class="sub">${sub}</span>` : ''}`;
  t.classList.toggle('bad', bad);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
