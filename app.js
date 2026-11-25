/* Cuentas Claras — finanzas personales. Todo se guarda en el teléfono. */
(function () {
'use strict';

/* ---------- Utilidades ---------- */
const KEY = 'cuentas_claras_v1';
const MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MES3 = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIA = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const DAYS_MONTH = 365 / 12;
const COLORS = ['#534AB7','#D85A30','#378ADD','#BA7517','#993C1D','#D4537E','#0C447C','#888780','#7F77DD','#E24B4A','#5F5E5A','#EF9F27'];
const CAT_GASTO = ['Vivienda','Comida','Transporte','Servicios','Deudas','Salud','Educación','Gustos','Ropa','Hijos','Mascotas','Otros'];
const CAT_INGRESO = ['Sueldo','Extra','Negocio','Otros ingresos'];
const PERIODOS = {
  unica: { l: 'Una sola vez', f: 0 },
  semanal: { l: 'Semanal', f: 52 / 12 },
  quincenal: { l: 'Quincenal (día 15 y último)', f: 2 },
  mensual: { l: 'Mensual', f: 1 },
  bimestral: { l: 'Bimestral', f: 0.5 },
  anual: { l: 'Anual', f: 1 / 12 },
  dias: { l: 'Cada X días', f: null }
};

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const r2 = n => Math.round((+n || 0) * 100) / 100;
const fmtMX = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
const fmtMX2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = n => fmtMX.format(Math.round(+n || 0));
const moneyX = n => (Math.round(n) !== r2(n) ? fmtMX2 : fmtMX).format(r2(n));
const pct = (n, d = 1) => (isFinite(n) ? (n * 100).toFixed(d) : '0.0') + '%';
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => iso(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
const fdate = s => { const d = parse(s); return d.getDate() + ' ' + MES3[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''); };
const fdateLong = s => { const d = parse(s); return DIA[d.getDay()] + ' ' + d.getDate() + ' de ' + MES[d.getMonth()]; };
const monthFactor = it => it.periodo === 'dias' ? DAYS_MONTH / Math.max(1, +it.cadaDias || 1) : (PERIODOS[it.periodo] ? PERIODOS[it.periodo].f : 0);
const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
const APP_URL = '__APP_URL__';
const appUrl = () => APP_URL.indexOf('__') === 0 ? (location.protocol.startsWith('http') ? location.origin + location.pathname.replace(/index\.html$/, '') : '') : APP_URL;
const apkUrl = () => { const m = appUrl().match(/^https:\/\/([^.]+)\.github\.io\/([^/]+)/); return m ? `https://github.com/${m[1]}/${m[2]}/releases/latest/download/CuentasClaras.apk` : ''; };
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

/* ---------- Estado ---------- */
function blank() {
  return {
    v: 1, nombre: '', ingresos: [], gastosFijos: [], movimientos: [], presupuestos: {},
    deudas: [], metas: [], cfg: { metodo: 'avalancha', extraDeuda: 0, recordatorios: true },
    ui: { tab: 'inicio', per: 'mes', ref: today(), from: '', to: '', movFiltro: 'todos', calRef: today() }
  };
}
let S;
function load() {
  try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || 'null') || {}); }
  catch (e) { S = blank(); }
  S.cfg = Object.assign(blank().cfg, S.cfg); S.ui = Object.assign(blank().ui, S.ui);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar'); } }

/* ---------- Recurrencias ---------- */
function occurrences(it, from, to) {
  const out = []; if (!it.inicio || from > to) return out;
  const start = it.inicio, end = it.fin && it.fin < to ? it.fin : to;
  if (start > end) return out;
  const p = it.periodo;
  if (p === 'unica') { if (start >= from && start <= end) out.push(start); return out; }
  if (p === 'semanal' || p === 'dias') {
    const step = p === 'semanal' ? 7 : Math.max(1, +it.cadaDias || 1);
    let d = start;
    if (from > start) { const k = Math.ceil(diffDays(start, from) / step); d = addDays(start, k * step); }
    let guard = 0;
    while (d <= end && guard++ < 2000) { out.push(d); d = addDays(d, step); }
    return out;
  }
  if (p === 'quincenal') {
    const a = parse(from > start ? from : start), b = parse(end);
    let y = a.getFullYear(), m = a.getMonth(), guard = 0;
    while ((y < b.getFullYear() || (y === b.getFullYear() && m <= b.getMonth())) && guard++ < 600) {
      [15, lastDay(y, m)].forEach(dd => { const s = iso(new Date(y, m, dd)); if (s >= start && s >= from && s <= end) out.push(s); });
      m++; if (m > 11) { m = 0; y++; }
    }
    return out;
  }
  const step = p === 'mensual' ? 1 : p === 'bimestral' ? 2 : 12;
  const s0 = parse(start), day = s0.getDate();
  let y = s0.getFullYear(), m = s0.getMonth(), guard = 0;
  while (guard++ < 1200) {
    const s = iso(new Date(y, m, Math.min(day, lastDay(y, m))));
    if (s > end) break;
    if (s >= from) out.push(s);
    m += step; while (m > 11) { m -= 12; y++; }
  }
  return out;
}
/* Los ingresos y gastos fijos se registran solos cuando llega su fecha */
function materialize() {
  const t = today(); let n = 0;
  const run = (arr, tipo) => arr.forEach(it => {
    const from = it.genHasta ? addDays(it.genHasta, 1) : it.inicio;
    occurrences(it, from, t).forEach(f => {
      S.movimientos.push({ id: uid(), fecha: f, tipo, categoria: it.categoria, monto: +it.monto, nota: it.nombre, auto: true, origen: it.id, fijo: true });
      n++;
    });
    it.genHasta = t;
  });
  run(S.ingresos, 'ingreso'); run(S.gastosFijos, 'gasto');
  if (n) save();
}

/* ---------- Periodos ---------- */
function periodRange(per, ref) {
  const d = parse(ref), y = d.getFullYear(), m = d.getMonth();
  if (per === 'semana') { const dow = (d.getDay() + 6) % 7; const a = addDays(ref, -dow); return [a, addDays(a, 6)]; }
  if (per === 'quincena') return d.getDate() <= 15 ? [iso(new Date(y, m, 1)), iso(new Date(y, m, 15))] : [iso(new Date(y, m, 16)), iso(new Date(y, m, lastDay(y, m)))];
  if (per === 'anio') return [y + '-01-01', y + '-12-31'];
  if (per === 'custom') return [S.ui.from || iso(new Date(y, m, 1)), S.ui.to || ref];
  return [iso(new Date(y, m, 1)), iso(new Date(y, m, lastDay(y, m)))];
}
function shiftRef(per, ref, dir) {
  const d = parse(ref);
  if (per === 'semana') return addDays(ref, 7 * dir);
  if (per === 'quincena') { const [a, b] = periodRange(per, ref); return dir > 0 ? addDays(b, 1) : addDays(a, -1); }
  if (per === 'anio') return iso(new Date(d.getFullYear() + dir, 0, 1));
  return iso(new Date(d.getFullYear(), d.getMonth() + dir, 1));
}
function periodLabel(per, a, b) {
  const A = parse(a), B = parse(b);
  if (per === 'mes') return cap(MES[A.getMonth()]) + ' ' + A.getFullYear();
  if (per === 'anio') return 'Año ' + A.getFullYear();
  if (per === 'quincena') return (A.getDate() === 1 ? '1ª' : '2ª') + ' quincena de ' + MES[A.getMonth()];
  return fdate(a) + ' – ' + fdate(b);
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
function prevRange(a, b) { const len = diffDays(a, b) + 1; return [addDays(a, -len), addDays(a, -1)]; }

/* ---------- Cálculos ---------- */
function aportesEn(a, b) { let t = 0; S.metas.forEach(mt => (mt.aportes || []).forEach(x => { if (x.fecha >= a && x.fecha <= b) t += +x.monto; })); return t; }
function balance(a, b) {
  const mv = S.movimientos.filter(x => x.fecha >= a && x.fecha <= b);
  const ing = mv.filter(x => x.tipo === 'ingreso'), gas = mv.filter(x => x.tipo === 'gasto');
  const ingresos = sum(ing, x => +x.monto), gastos = sum(gas, x => +x.monto);
  const byCat = {};
  gas.forEach(x => { byCat[x.categoria] = (byCat[x.categoria] || 0) + +x.monto; });
  const cats = Object.keys(byCat).map(k => ({ cat: k, monto: byCat[k] })).sort((x, y) => y.monto - x.monto);
  const ingCat = {}; ing.forEach(x => { ingCat[x.categoria] = (ingCat[x.categoria] || 0) + +x.monto; });
  const fijos = sum(gas.filter(x => x.fijo || x.categoria === 'Deudas'), x => +x.monto);
  const apartado = aportesEn(a, b);
  const days = diffDays(a, b) + 1;
  // plan
  const plan = {};
  S.gastosFijos.forEach(g => { const n = occurrences(g, a, b).length; if (n) plan[g.categoria] = (plan[g.categoria] || 0) + n * +g.monto; });
  Object.keys(S.presupuestos).forEach(c => { const v = +S.presupuestos[c] || 0; if (v) plan[c] = (plan[c] || 0) + v * days / DAYS_MONTH; });
  S.deudas.forEach(dd => { if (+dd.saldo > 0 && dd.diaPago) { plan.Deudas = (plan.Deudas || 0) + occurrences({ inicio: '2000-01-' + pad(+dd.diaPago), periodo: 'mensual' }, a, b).length * +dd.pagoMinimo; } });
  Object.keys(plan).forEach(k => { plan[k] = Math.round(plan[k]); });
  const ingresoPlan = sum(S.ingresos, it => occurrences(it, a, b).length * +it.monto);
  return { a, b, days, mv, ingresos, gastos, bal: ingresos - gastos, cats, ingCat, fijos, variables: gastos - fijos, apartado, plan, ingresoPlan, deudaPagos: byCat.Deudas || 0 };
}
function mensual() {
  const ingreso = sum(S.ingresos, it => +it.monto * monthFactor(it));
  const fijos = sum(S.gastosFijos, it => +it.monto * monthFactor(it));
  const variables = sum(Object.values(S.presupuestos), v => +v || 0);
  const activas = S.deudas.filter(d => +d.saldo > 0);
  const minimos = sum(activas, d => +d.pagoMinimo || 0) + (activas.length ? +S.cfg.extraDeuda || 0 : 0);
  return { ingreso, fijos, variables, minimos, disponible: ingreso - fijos - variables - minimos };
}
function ahorrado(mt) { return sum(mt.aportes || [], x => +x.monto); }
function metaInfo(mt, semanalOverride) {
  const ah = ahorrado(mt), falta = Math.max(0, +mt.objetivo - ah), t = today();
  const info = { ah, falta, pct: +mt.objetivo ? Math.min(1, ah / +mt.objetivo) : 0, semanal: 0, fecha: null, done: falta <= 0 };
  if (info.done) return info;
  if (mt.fecha && mt.fecha > t && semanalOverride == null) {
    const semanas = Math.max(1, diffDays(t, mt.fecha) / 7);
    info.semanal = falta / semanas; info.fecha = mt.fecha; info.porFecha = true;
  } else {
    const w = semanalOverride != null ? semanalOverride : (+mt.aporteSemanal || 0);
    info.semanal = w;
    if (w > 0) info.fecha = addDays(t, Math.ceil(falta / w) * 7);
    if (mt.fecha && mt.fecha <= t) info.vencida = true;
  }
  return info;
}
function apartarSemana() { return sum(S.metas, mt => metaInfo(mt).semanal); }

/* Simulación de deudas mes a mes */
function simDeudas(deudas, extra, metodo, rollover = true) {
  let ds = deudas.filter(d => +d.saldo > 0).map(d => ({ id: d.id, nombre: d.nombre, saldo: +d.saldo, tasa: (+d.tasa || 0) / 1200, min: +d.pagoMinimo || 0, interes: 0, mes: null }));
  if (!ds.length) return { meses: 0, interes: 0, deudas: [], nunca: false };
  const orden = () => ds.filter(d => d.saldo > 0.005).sort((a, b) => metodo === 'bola' ? a.saldo - b.saldo : b.tasa - a.tasa || a.saldo - b.saldo);
  const presupuesto = sum(ds, d => d.min) + (+extra || 0);
  let mes = 0;
  while (ds.some(d => d.saldo > 0.005) && mes < 600) {
    mes++;
    ds.forEach(d => { if (d.saldo > 0.005) { const i = d.saldo * d.tasa; d.saldo += i; d.interes += i; } });
    let disp = rollover ? presupuesto : presupuesto;
    if (!rollover) {
      ds.forEach(d => { if (d.saldo > 0.005) { const p = Math.min(d.min, d.saldo); d.saldo -= p; } });
      const ex = orden()[0]; if (ex && extra) { ex.saldo -= Math.min(extra, ex.saldo); }
    } else {
      ds.forEach(d => { if (d.saldo > 0.005) { const p = Math.min(d.min, d.saldo); d.saldo -= p; disp -= p; } });
      for (const d of orden()) { if (disp <= 0) break; const p = Math.min(disp, d.saldo); d.saldo -= p; disp -= p; }
    }
    ds.forEach(d => { if (d.saldo <= 0.005 && d.mes == null) { d.saldo = 0; d.mes = mes; } });
  }
  const nunca = ds.some(d => d.mes == null);
  return { meses: nunca ? null : mes, interes: sum(ds, d => d.interes), deudas: ds, nunca };
}
const mesesATexto = (m, corto) => { if (m == null) return 'nunca (el pago no cubre los intereses)'; const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + m); return (corto ? cap(MES3[d.getMonth()]) : MES[d.getMonth()]) + ' ' + d.getFullYear(); };
function prevComparable(a, b) { const [pa, pb] = prevRange(a, b), t = today(); if (a <= t && t < b) { const e = diffDays(a, t); return [pa, addDays(pa, e) < pb ? addDays(pa, e) : pb, true]; } return [pa, pb, false]; }
const duracion = m => m == null ? '—' : m < 12 ? m + (m === 1 ? ' mes' : ' meses') : (Math.floor(m / 12) + (Math.floor(m / 12) === 1 ? ' año' : ' años') + (m % 12 ? ' ' + (m % 12) + ' m' : ''));

/* Próximos pagos y calendario */
function eventos(a, b) {
  const ev = [];
  S.ingresos.forEach(it => occurrences(it, a, b).forEach(f => ev.push({ fecha: f, tipo: 'in', nombre: it.nombre, monto: +it.monto })));
  S.gastosFijos.forEach(it => occurrences(it, a, b).forEach(f => ev.push({ fecha: f, tipo: 'out', nombre: it.nombre, monto: +it.monto })));
  S.deudas.filter(d => +d.saldo > 0).forEach(d => {
    const pseudo = { inicio: '2000-01-' + pad(Math.min(28, +d.diaPago || 1)), periodo: 'mensual' };
    if (d.diaPago) occurrences(Object.assign(pseudo, { inicio: '2000-01-' + pad(+d.diaPago) }), a, b).forEach(f => ev.push({ fecha: f, tipo: 'debt', nombre: 'Pago ' + d.nombre, monto: +d.pagoMinimo, deudaId: d.id }));
    if (d.diaCorte) occurrences({ inicio: '2000-01-' + pad(+d.diaCorte), periodo: 'mensual' }, a, b).forEach(f => ev.push({ fecha: f, tipo: 'corte', nombre: 'Corte ' + d.nombre, monto: null }));
  });
  return ev.sort((x, y) => x.fecha.localeCompare(y.fecha));
}

/* ---------- Gráficas ---------- */
function donut(items, total, size = 120) {
  const R = size / 2, r = R - 16, C = 2 * Math.PI * r; let off = 0;
  const segs = items.map((it, i) => {
    const frac = total ? it.monto / total : 0, len = frac * C;
    const s = `<circle cx="${R}" cy="${R}" r="${r}" fill="none" stroke="${it.color || COLORS[i % COLORS.length]}" stroke-width="16" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${R} ${R})"/>`;
    off += len; return s;
  }).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Distribución"><circle cx="${R}" cy="${R}" r="${r}" fill="none" stroke="var(--line)" stroke-width="16"/>${segs}</svg>`;
}
const catColor = (() => { const map = {}; return c => { if (!map[c]) { const i = CAT_GASTO.indexOf(c); map[c] = COLORS[(i >= 0 ? i : Object.keys(map).length + 3) % COLORS.length]; } return map[c]; }; })();

/* ---------- Lectura automática y salud ---------- */
function salud(B) {
  const tasa = B.ingresos ? B.bal / B.ingresos : 0;
  const carga = B.ingresos ? B.deudaPagos / B.ingresos : 0;
  const gastoMes = B.gastos / B.days * DAYS_MONTH;
  const totalAh = sum(S.metas, ahorrado);
  const colchon = gastoMes ? totalAh / gastoMes : 0;
  let pts = 0;
  pts += tasa >= 0.2 ? 2 : tasa >= 0.1 ? 1 : tasa >= 0 ? 0 : -2;
  pts += carga <= 0.2 ? 2 : carga <= 0.35 ? 1 : -1;
  pts += colchon >= 3 ? 2 : colchon >= 1 ? 1 : 0;
  const cal = pts >= 5 ? ['Excelente', ''] : pts >= 3 ? ['Buena', ''] : pts >= 1 ? ['Regular', 'warn'] : ['En riesgo', 'bad'];
  return { tasa, carga, colchon, cal, totalAh };
}
function parcialTxt(per) { const [a, b] = periodRange(per, S.ui.ref), t = today(); return per !== 'custom' && a <= t && t < b ? 'el mismo corte del periodo anterior' : null; }
function lectura(B, P, per) {
  const out = [];
  if (!B.ingresos && !B.gastos) return ['Aún no hay movimientos en este periodo. Agrega tus ingresos y gastos con el botón ＋.'];
  const nombre = { mes: 'el mes', semana: 'la semana', quincena: 'la quincena', anio: 'el año', custom: 'el periodo' }[per];
  const prevNombre = parcialTxt(per) || { mes: 'el mes anterior', semana: 'la semana anterior', quincena: 'la quincena anterior', anio: 'el año anterior', custom: 'el periodo anterior' }[per];
  if (B.ingresos > 0) {
    const t = B.bal / B.ingresos;
    let s = B.bal >= 0 ? `En ${nombre} te quedó el ${pct(t, 0)} de lo que percibiste (${money(B.bal)}).` : `En ${nombre} gastaste ${money(-B.bal)} más de lo que percibiste.`;
    if (P.ingresos > 0) { const dp = (t - P.bal / P.ingresos) * 100; if (Math.abs(dp) >= 1) s += ` Son ${Math.abs(dp).toFixed(0)} puntos ${dp > 0 ? 'más' : 'menos'} que ${prevNombre}.`; }
    out.push(s);
  } else out.push(`No registraste ingresos en ${nombre}, pero sí ${money(B.gastos)} en gastos.`);
  if (B.cats.length) {
    const top = B.cats.slice(0, 2).map(c => `${c.cat} (${pct(c.monto / B.gastos, 0)})`);
    out.push(`Lo que más se llevó tu dinero fue ${top.join(' y ')}.`);
  }
  const pasados = Object.keys(B.plan).map(c => ({ c, real: (B.cats.find(x => x.cat === c) || { monto: 0 }).monto, plan: B.plan[c] })).filter(x => x.plan > 0 && x.real > x.plan * 1.05 && x.real - x.plan >= 50).sort((x, y) => (y.real - y.plan) - (x.real - x.plan));
  if (pasados.length) out.push(pasados.slice(0, 2).map(x => `${x.c} se pasó ${money(x.real - x.plan)} del plan`).join('; ') + '.');
  if (B.ingresos && B.deudaPagos) {
    const c = B.deudaPagos / B.ingresos;
    out.push(c > 0.35 ? `Tus deudas se llevan el ${pct(c, 0)} de lo que ganas; arriba de 35% es una carga pesada, conviene atacarlas con el plan de Deudas.` : `Tus deudas se llevan el ${pct(c, 0)} de lo que ganas${c <= 0.2 ? ', un nivel sano' : ''}.`);
  }
  const mt = S.metas.find(m => !metaInfo(m).done);
  if (mt) {
    const mi = metaInfo(mt);
    const capSemanal = B.bal / B.days * 7;
    if (mi.semanal > 0) {
      if (capSemanal >= mi.semanal) out.push(`Para "${mt.nombre}" necesitas apartar ${money(mi.semanal)} por semana; a este ritmo te alcanza${mi.fecha ? ' y la completas en ' + MES[parse(mi.fecha).getMonth()] + ' de ' + parse(mi.fecha).getFullYear() : ''}.`);
      else out.push(`Para "${mt.nombre}" necesitas apartar ${money(mi.semanal)} por semana, pero en ${nombre} te quedaron ${money(Math.max(0, capSemanal))} por semana. Revisa el Simulador para ver dónde ajustar.`);
    }
  }
  return out;
}

/* ---------- UI genérica ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2400); }
function closeSheet() { const s = $('#sheet'); s.hidden = true; s.innerHTML = ''; }
function sheet(html, onMount) {
  const s = $('#sheet'); s.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`; s.hidden = false;
  s.onclick = e => { if (e.target === s) closeSheet(); };
  if (onMount) onMount(s.firstChild);
}
function field(f) {
  const id = 'f_' + f.k, v = f.value == null ? '' : f.value;
  let inp;
  if (f.type === 'select') inp = `<select id="${id}" name="${f.k}">${f.options.map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
  else inp = `<input id="${id}" name="${f.k}" type="${f.type || 'text'}" ${f.type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''} value="${esc(v)}" placeholder="${esc(f.ph || '')}">`;
  return `<div class="field" data-k="${f.k}" ${f.showIf ? 'data-showif="1"' : ''}><label for="${id}">${esc(f.label)}</label>${inp}${f.hint ? `<div class="hint">${esc(f.hint)}</div>` : ''}<div class="err" hidden></div></div>`;
}
function form({ title, fields, onSave, onDelete, saveLabel = 'Guardar', extra = '' }) {
  sheet(`<h2>${esc(title)}</h2><form id="frm" novalidate>${fields.map(field).join('')}${extra}
    <div class="btns" style="margin-top:6px"><button class="btn" type="submit" style="flex:1">${esc(saveLabel)}</button><button class="btn sec" type="button" id="frmCancel">Cancelar</button></div>
    ${onDelete ? '<button class="btn sec block" type="button" id="frmDel" style="margin-top:10px;color:var(--red)">Eliminar</button>' : ''}</form>`, el => {
    const fm = $('#frm', el);
    const vis = () => fields.forEach(f => { if (f.showIf) { const box = fm.querySelector(`[data-k="${f.k}"]`); box.hidden = !f.showIf(vals()); } });
    const vals = () => { const o = {}; fields.forEach(f => { const e = fm.elements[f.k]; o[f.k] = e ? e.value.trim() : ''; }); return o; };
    fm.addEventListener('input', e => { const b = e.target.closest('.field'); if (b) { const er = b.querySelector('.err'); er.hidden = true; } vis(); });
    fm.addEventListener('change', vis); vis();
    $('#frmCancel', el).onclick = closeSheet;
    if (onDelete) $('#frmDel', el).onclick = () => { if (confirm('¿Eliminar? No se puede deshacer.')) { onDelete(); closeSheet(); } };
    fm.onsubmit = e => {
      e.preventDefault(); const v = vals(); let ok = true;
      fields.forEach(f => {
        const box = fm.querySelector(`[data-k="${f.k}"]`); if (box.hidden) return;
        let msg = '';
        if (f.req && !v[f.k]) msg = 'Este dato es necesario';
        else if (f.type === 'number' && v[f.k] !== '' && (isNaN(+v[f.k]) || +v[f.k] < 0)) msg = 'Escribe un número válido';
        else if (f.positive && !(+v[f.k] > 0)) msg = 'Debe ser mayor a 0';
        else if (f.check) msg = f.check(v[f.k], v) || '';
        if (msg) { const er = box.querySelector('.err'); er.textContent = msg; er.hidden = false; ok = false; }
      });
      if (!ok) return;
      onSave(v); save(); closeSheet(); render();
    };
  });
}
const periodoOpts = Object.keys(PERIODOS).map(k => [k, PERIODOS[k].l]);
const periodoTxt = it => it.periodo === 'dias' ? 'Cada ' + it.cadaDias + ' días' : PERIODOS[it.periodo].l;

/* ---------- Formularios de datos ---------- */
function formMovimiento(tipo, mv) {
  const edit = !!mv; mv = mv || { tipo, fecha: today(), categoria: tipo === 'ingreso' ? 'Sueldo' : 'Comida', monto: '', nota: '' };
  const cats = (mv.tipo === 'ingreso' ? CAT_INGRESO : CAT_GASTO);
  form({
    title: (edit ? 'Editar ' : 'Nuevo ') + (mv.tipo === 'ingreso' ? 'ingreso' : 'gasto'),
    fields: [
      { k: 'monto', label: 'Monto', type: 'number', value: mv.monto, req: true, positive: true, ph: '0' },
      { k: 'categoria', label: 'Categoría', type: 'select', options: cats.includes(mv.categoria) ? cats : cats.concat(mv.categoria), value: mv.categoria },
      { k: 'nota', label: 'Descripción (opcional)', value: mv.nota, ph: mv.tipo === 'ingreso' ? 'Pago de la semana' : 'Súper, gasolina, comida…' },
      { k: 'fecha', label: 'Fecha', type: 'date', value: mv.fecha, req: true }
    ],
    extra: !edit && mv.tipo === 'gasto' ? '<p class="small muted" style="margin:-4px 0 10px">Puedes anotar cada gasto o un total del periodo. Si es un pago que se repite (renta, luz), mejor agrégalo en Más › Gastos fijos y se registrará solo.</p>' : '',
    onSave: v => { Object.assign(mv, { monto: r2(v.monto), categoria: v.categoria, nota: v.nota, fecha: v.fecha }); if (!edit) { mv.id = uid(); S.movimientos.push(mv); } toast(edit ? 'Cambios guardados' : 'Movimiento agregado'); },
    onDelete: edit ? () => { S.movimientos = S.movimientos.filter(x => x !== mv); save(); render(); toast('Movimiento eliminado'); } : null
  });
}
function formRecurrente(kind, it) {
  const isIng = kind === 'ingresos', edit = !!it;
  it = it || { nombre: '', monto: '', periodo: isIng ? 'semanal' : 'mensual', cadaDias: 10, inicio: today(), categoria: isIng ? 'Sueldo' : 'Vivienda' };
  form({
    title: (edit ? 'Editar ' : 'Nuevo ') + (isIng ? 'ingreso fijo' : 'gasto fijo'),
    fields: [
      { k: 'nombre', label: 'Nombre', value: it.nombre, req: true, ph: isIng ? 'Sueldo neto' : 'Renta, luz, internet…' },
      { k: 'monto', label: isIng ? 'Monto neto que recibes' : 'Monto', type: 'number', value: it.monto, req: true, positive: true },
      { k: 'periodo', label: 'Cada cuánto', type: 'select', options: periodoOpts, value: it.periodo },
      { k: 'cadaDias', label: 'Cada cuántos días', type: 'number', value: it.cadaDias, showIf: v => v.periodo === 'dias', check: v => +v >= 1 ? '' : 'Mínimo 1 día' },
      { k: 'inicio', label: 'Próxima fecha o fecha de inicio', type: 'date', value: it.inicio, req: true, hint: 'A partir de aquí se repite. Si ya pasó, se registran los pagos desde esa fecha.' },
      { k: 'categoria', label: 'Categoría', type: 'select', options: isIng ? CAT_INGRESO : CAT_GASTO, value: it.categoria }
    ],
    onSave: v => {
      const changedStart = !edit || v.inicio !== it.inicio || v.periodo !== it.periodo;
      Object.assign(it, { nombre: v.nombre, monto: r2(v.monto), periodo: v.periodo, cadaDias: +v.cadaDias || 1, inicio: v.inicio, categoria: v.categoria });
      if (!edit) { it.id = uid(); S[kind].push(it); }
      if (changedStart && edit) { it.genHasta = addDays(today(), 0); if (v.inicio > today()) it.genHasta = addDays(v.inicio, -1); }
      if (!edit && v.inicio > today()) it.genHasta = addDays(v.inicio, -1);
      materialize(); scheduleNotifs(); toast('Guardado');
    },
    onDelete: edit ? () => { S[kind] = S[kind].filter(x => x !== it); save(); render(); scheduleNotifs(); toast('Eliminado. Los registros pasados se conservan.'); } : null
  });
}
function formDeuda(d) {
  const edit = !!d; d = d || { nombre: '', saldo: '', tasa: '', pagoMinimo: '', diaPago: '', diaCorte: '' };
  form({
    title: edit ? 'Editar deuda' : 'Nueva deuda',
    fields: [
      { k: 'nombre', label: 'Nombre', value: d.nombre, req: true, ph: 'Tarjeta BBVA, préstamo…' },
      { k: 'saldo', label: 'Saldo que debes hoy', type: 'number', value: d.saldo, req: true, positive: true },
      { k: 'tasa', label: 'Tasa de interés anual (%)', type: 'number', value: d.tasa, hint: 'Viene en tu estado de cuenta. Si no tiene interés, pon 0.' },
      { k: 'pagoMinimo', label: 'Pago mensual (mínimo o fijo)', type: 'number', value: d.pagoMinimo, req: true, positive: true },
      { k: 'diaPago', label: 'Día límite de pago (1-31)', type: 'number', value: d.diaPago, check: v => !v || (+v >= 1 && +v <= 31) ? '' : 'Entre 1 y 31' },
      { k: 'diaCorte', label: 'Día de corte (opcional)', type: 'number', value: d.diaCorte, check: v => !v || (+v >= 1 && +v <= 31) ? '' : 'Entre 1 y 31' }
    ],
    onSave: v => { Object.assign(d, { nombre: v.nombre, saldo: r2(v.saldo), tasa: +v.tasa || 0, pagoMinimo: r2(v.pagoMinimo), diaPago: v.diaPago ? Math.round(+v.diaPago) : '', diaCorte: v.diaCorte ? Math.round(+v.diaCorte) : '' }); if (!edit) { d.id = uid(); d.saldoInicial = d.saldo; S.deudas.push(d); } scheduleNotifs(); toast('Deuda guardada'); },
    onDelete: edit ? () => { S.deudas = S.deudas.filter(x => x !== d); save(); render(); scheduleNotifs(); } : null
  });
}
function formAbono(d) {
  form({
    title: 'Abonar a ' + d.nombre, saveLabel: 'Registrar abono',
    fields: [
      { k: 'monto', label: 'Monto del abono', type: 'number', value: d.pagoMinimo, req: true, positive: true },
      { k: 'fecha', label: 'Fecha', type: 'date', value: today(), req: true }
    ],
    extra: '<p class="small muted" style="margin:-4px 0 10px">Se resta del saldo y se registra como gasto en la categoría Deudas.</p>',
    onSave: v => {
      const m = r2(v.monto); d.saldo = r2(Math.max(0, +d.saldo - m));
      S.movimientos.push({ id: uid(), fecha: v.fecha, tipo: 'gasto', categoria: 'Deudas', monto: m, nota: 'Abono ' + d.nombre, deudaId: d.id });
      toast(d.saldo <= 0 ? '¡Deuda liquidada!' : 'Abono registrado');
    }
  });
}
function formMeta(mt) {
  const edit = !!mt; mt = mt || { nombre: '', objetivo: '', fecha: '', aporteSemanal: '', aportes: [] };
  form({
    title: edit ? 'Editar meta' : 'Nueva meta de ahorro',
    fields: [
      { k: 'nombre', label: 'Nombre', value: mt.nombre, req: true, ph: 'Fondo de emergencia, vacaciones…' },
      { k: 'objetivo', label: 'Cuánto quieres juntar', type: 'number', value: mt.objetivo, req: true, positive: true },
      { k: 'fecha', label: 'Para cuándo (opcional)', type: 'date', value: mt.fecha, hint: 'Con fecha, la app te dice cuánto apartar por semana.' },
      { k: 'aporteSemanal', label: 'O cuánto puedes apartar por semana', type: 'number', value: mt.aporteSemanal, hint: 'Sin fecha, la app calcula cuándo la completas.' },
      ...(edit ? [] : [{ k: 'inicial', label: 'Lo que ya tienes ahorrado (opcional)', type: 'number', value: '' }])
    ],
    onSave: v => {
      Object.assign(mt, { nombre: v.nombre, objetivo: r2(v.objetivo), fecha: v.fecha, aporteSemanal: r2(v.aporteSemanal) });
      if (!edit) { mt.id = uid(); if (+v.inicial > 0) mt.aportes.push({ fecha: today(), monto: r2(v.inicial), nota: 'Saldo inicial' }); S.metas.push(mt); }
      toast('Meta guardada');
    },
    onDelete: edit ? () => { S.metas = S.metas.filter(x => x !== mt); save(); render(); } : null
  });
}
function formAporte(mt, retiro) {
  const mi = metaInfo(mt);
  form({
    title: (retiro ? 'Retirar de ' : 'Apartar para ') + mt.nombre, saveLabel: retiro ? 'Retirar' : 'Apartar',
    fields: [
      { k: 'monto', label: 'Monto', type: 'number', value: retiro ? '' : (mi.semanal ? Math.ceil(mi.semanal) : ''), req: true, positive: true, check: v => retiro && +v > mi.ah ? 'No puedes retirar más de lo ahorrado (' + money(mi.ah) + ')' : '' },
      { k: 'fecha', label: 'Fecha', type: 'date', value: today(), req: true }
    ],
    onSave: v => { mt.aportes = mt.aportes || []; mt.aportes.push({ fecha: v.fecha, monto: retiro ? -r2(v.monto) : r2(v.monto) }); toast(retiro ? 'Retiro registrado' : 'Apartado registrado'); }
  });
}

/* ---------- Pantallas ---------- */
const V = {};
V.inicio = () => {
  const t = today(), [a, b] = periodRange('mes', t), B = balance(a, b);
  const M = mensual(), w = apartarSemana();
  const capW = M.disponible * 12 / 52;
  const sem = !S.ingresos.length && !S.movimientos.length ? null
    : capW >= w && M.disponible >= 0 ? ['g', '●', `Vas bien: tu plan mensual deja ${money(M.disponible)} libres.`]
    : M.disponible >= 0 ? ['a', '●', `Tu plan deja ${money(capW)} por semana, pero tus metas piden ${money(w)}.`]
    : ['r', '●', `Tu plan gasta ${money(-M.disponible)} más de lo que ganas al mes.`];
  const prox = eventos(t, addDays(t, 7)).filter(e => e.tipo !== 'in');
  const ultimos = S.movimientos.slice().sort((x, y) => y.fecha.localeCompare(x.fecha)).slice(0, 5);
  const hola = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
  return `<h1>${hola}${S.nombre ? ', ' + esc(S.nombre) : ''}</h1><p class="sub">${cap(fdateLong(t))}</p>
  ${!S.ingresos.length && !S.movimientos.length ? `<div class="card"><h2>Empieza en 3 pasos</h2>
    <ol class="small" style="margin:0 0 12px;padding-left:18px;line-height:1.9"><li>Registra tu ingreso neto y cada cuánto te pagan.</li><li>Agrega tus gastos fijos (renta, servicios, gasolina…).</li><li>Crea una meta o registra tus deudas.</li></ol>
    <div class="btns"><button class="btn" data-act="addIngresoFijo">Agregar mi ingreso</button><button class="btn sec" data-act="demo">Ver con datos de ejemplo</button></div></div>` : ''}
  ${installBanner()}
  ${sem ? `<div class="sem ${sem[0]}"><b>${sem[1]}</b><span>${sem[2]}</span></div>` : ''}
  <div class="fab-row"><button class="btn in" data-act="addIngreso">＋ Ingreso</button><button class="btn out" data-act="addGasto">－ Gasto</button></div>
  <div class="card"><div class="row"><h2 style="margin:0">${cap(MES[parse(t).getMonth()])} hasta hoy</h2><button class="btn sec sm" data-tab="balance">Ver balance</button></div>
    <div class="kpis" style="margin:10px 0 0"><div class="kpi"><div class="l">Percibiste</div><div class="v">${money(B.ingresos)}</div></div>
    <div class="kpi"><div class="l">Gastaste</div><div class="v">${money(B.gastos)}</div></div>
    <div class="kpi ${B.bal >= 0 ? 'good' : 'bad'}"><div class="l">Te queda</div><div class="v">${money(B.bal)}</div></div></div></div>
  <div class="card"><div class="row"><h2 style="margin:0">Esta semana</h2><button class="btn sec sm" data-act="cal">Calendario</button></div>
    <p style="margin:8px 0 4px">Aparta <b>${money(w)}</b> para tus metas${S.metas.length ? '' : ' <span class="small muted">(aún no tienes metas)</span>'}.</p>
    ${prox.length ? `<ul class="list">${prox.slice(0, 6).map(e => `<li><span class="dot" style="background:${e.tipo === 'debt' ? 'var(--amb)' : e.tipo === 'corte' ? 'var(--txt3)' : 'var(--red)'}"></span><div class="grow"><div class="t">${esc(e.nombre)}</div><div class="m">${cap(fdateLong(e.fecha))}</div></div>${e.monto != null ? `<span class="amt">${money(e.monto)}</span>` : ''}${e.tipo === 'debt' ? `<button class="btn sm" data-act="pagar" data-id="${e.deudaId}">Pagué</button>` : ''}</li>`).join('')}</ul>` : '<p class="small muted" style="margin:4px 0 0">No tienes pagos en los próximos 7 días.</p>'}</div>
  <div class="card"><div class="row"><h2 style="margin:0">Últimos movimientos</h2><button class="btn sec sm" data-tab="movs">Ver todos</button></div>
    ${ultimos.length ? `<ul class="list">${ultimos.map(movLi).join('')}</ul>` : '<p class="small muted">Sin movimientos todavía.</p>'}</div>`;
};
function installBanner() {
  if (isNative() || isStandalone() || S.ui.noBanner) return '';
  const ua = navigator.userAgent, ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document), android = /Android/.test(ua);
  let body;
  if (ios) body = 'Instálala en tu iPhone: toca el botón <b>Compartir</b> de Safari y luego <b>Agregar a pantalla de inicio</b>. Funciona sin internet.';
  else if (android && apkUrl()) body = `Descarga la app para Android. <a class="btn sm" style="text-decoration:none;display:inline-block;margin-top:6px" href="${apkUrl()}">Descargar APK</a>`;
  else return '';
  return `<div class="card" style="background:var(--pri-l);border-color:transparent;color:var(--pri-t)"><div class="row" style="align-items:flex-start"><div class="small">${body}</div><button class="btn sec sm" data-act="noBanner" aria-label="Ocultar">✕</button></div></div>`;
}
async function compartirApp() {
  const url = appUrl(), apk = apkUrl();
  const text = 'Organiza tu dinero con Cuentas Claras: balance del mes, deudas y metas de ahorro. Gratis.' + (apk ? '\nAndroid: ' + apk : '') + (url ? '\niPhone (abre en Safari y agrégala a inicio): ' + url : '');
  try {
    if (isNative() && window.Capacitor.Plugins.Share) await window.Capacitor.Plugins.Share.share({ title: 'Cuentas Claras', text, dialogTitle: 'Compartir la app' });
    else if (navigator.share) await navigator.share({ title: 'Cuentas Claras', text });
    else { await navigator.clipboard.writeText(text); toast('Enlace copiado'); }
  } catch (e) { /* cancelado */ }
}
function movLi(m) {
  return `<li data-act="editMov" data-id="${m.id}" style="cursor:pointer"><span class="dot" style="background:${m.tipo === 'ingreso' ? 'var(--grn)' : catColor(m.categoria)}"></span><div class="grow"><div class="t">${esc(m.nota || m.categoria)}</div><div class="m">${esc(m.categoria)} · ${fdate(m.fecha)}${m.auto ? ' · fijo' : ''}</div></div><span class="amt ${m.tipo === 'ingreso' ? 'in' : 'out'}">${m.tipo === 'ingreso' ? '+' : '−'}${moneyX(m.monto)}</span></li>`;
}
V.movs = () => {
  const f = S.ui.movFiltro, [a, b] = periodRange(S.ui.per === 'custom' ? 'mes' : S.ui.per, S.ui.ref);
  let mv = S.movimientos.filter(x => x.fecha >= a && x.fecha <= b);
  if (f !== 'todos') mv = mv.filter(x => x.tipo === f);
  mv.sort((x, y) => y.fecha.localeCompare(x.fecha) || (y.id > x.id ? 1 : -1));
  const groups = {}; mv.forEach(m => { (groups[m.fecha] = groups[m.fecha] || []).push(m); });
  return `<h1>Movimientos</h1>${periodPicker(true)}
  <div class="seg">${[['todos', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos']].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="movFiltro" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="fab-row"><button class="btn in" data-act="addIngreso">＋ Ingreso</button><button class="btn out" data-act="addGasto">－ Gasto</button></div>
  ${mv.length ? Object.keys(groups).map(d => `<div class="card" style="padding:6px 16px"><div class="small muted" style="padding-top:6px">${cap(fdateLong(d))}</div><ul class="list">${groups[d].map(movLi).join('')}</ul></div>`).join('')
    : '<div class="card empty"><div class="big">⇅</div>No hay movimientos en este periodo.</div>'}`;
};
function periodPicker(noCustom) {
  const per = S.ui.per === 'custom' && noCustom ? 'mes' : S.ui.per, [a, b] = periodRange(per, S.ui.ref);
  const opts = [['semana', 'Semana'], ['quincena', 'Quincena'], ['mes', 'Mes'], ['anio', 'Año']].concat(noCustom ? [] : [['custom', 'Fechas']]);
  return `<div class="seg">${opts.map(([k, l]) => `<button class="${per === k ? 'on' : ''}" data-act="per" data-v="${k}">${l}</button>`).join('')}</div>
  ${per === 'custom' ? `<div class="grid2" style="margin-bottom:10px"><div class="field" style="margin:0"><label>Desde</label><input type="date" id="cFrom" value="${a}"></div><div class="field" style="margin:0"><label>Hasta</label><input type="date" id="cTo" value="${b}"></div></div>`
    : `<div class="pnav"><button data-act="prev" aria-label="Periodo anterior">‹</button><div class="lbl">${periodLabel(per, a, b)}</div><button data-act="next" aria-label="Periodo siguiente">›</button></div>`}`;
}
V.balance = () => {
  const per = S.ui.per, [a, b] = periodRange(per, S.ui.ref), B = balance(a, b), [pa, pb, parcial] = prevComparable(a, b), P = balance(pa, pb);
  const H = salud(B);
  const dIng = B.ingresos - P.ingresos;
  const items = B.cats.map(c => ({ cat: c.cat, monto: c.monto, color: catColor(c.cat) }));
  const libre = B.bal - B.apartado;
  const distTotal = Math.max(B.ingresos, B.gastos);
  const stack = items.map(i => `<i style="width:${distTotal ? i.monto / distTotal * 100 : 0}%;background:${i.color};display:block"></i>`).join('') + (B.bal > 0 && distTotal ? `<i style="width:${B.bal / distTotal * 100}%;background:#97C459;display:block"></i>` : '');
  const planRows = Object.keys(B.plan).concat(B.cats.map(c => c.cat)).filter((c, i, arr) => arr.indexOf(c) === i).map(c => ({ c, plan: B.plan[c] || 0, real: (B.cats.find(x => x.cat === c) || { monto: 0 }).monto })).filter(x => x.plan > 0).sort((x, y) => (y.real - y.plan) - (x.real - x.plan));
  // historial 6 meses
  const hist = []; const base = parse(S.ui.ref);
  for (let i = 5; i >= 0; i--) { const d = new Date(base.getFullYear(), base.getMonth() - i, 1), [ha, hb] = periodRange('mes', iso(d)), hb2 = balance(ha, hb); hist.push({ l: MES3[d.getMonth()], i: hb2.ingresos, g: hb2.gastos }); }
  const hmax = Math.max(1, ...hist.map(h => Math.max(h.i, h.g)));
  return `<h1>Balance</h1>${periodPicker()}
  <div class="kpis">
    <div class="kpi"><div class="l">Percibiste</div><div class="v">${money(B.ingresos)}</div><div class="d ${dIng >= 0 ? 'up' : 'down'}">${P.ingresos || B.ingresos ? (dIng >= 0 ? '+' : '−') + money(Math.abs(dIng)) + (parcial ? ' vs mismo corte' : ' vs ant.') : '&nbsp;'}</div></div>
    <div class="kpi"><div class="l">Gastaste</div><div class="v">${money(B.gastos)}</div><div class="d">${B.ingresos ? pct(B.gastos / B.ingresos) + ' del ingreso' : '&nbsp;'}</div></div>
    <div class="kpi ${B.bal >= 0 ? 'good' : 'bad'}"><div class="l">Te quedó</div><div class="v">${money(B.bal)}</div><div class="d">${B.ingresos ? pct(B.bal / B.ingresos) + ' del ingreso' : '&nbsp;'}</div></div>
  </div>
  <div class="card"><h2>Lectura del periodo</h2><div class="reading">${lectura(B, P, per).map(s => `<p>${esc(s)}</p>`).join('')}</div></div>
  <div class="card"><h2>Cómo se distribuyó tu dinero</h2>
    ${B.gastos || B.ingresos ? `<div class="stack">${stack}</div>
    <div class="donut-wrap">${donut(items.concat(B.bal > 0 ? [{ monto: B.bal, color: '#97C459' }] : []), sum(items, i => i.monto) + Math.max(0, B.bal), 108)}
      <div class="small" style="flex:1;min-width:0"><div class="row"><span>Gastos fijos</span><b>${money(B.fijos)}</b></div><div class="row"><span>Gastos variables</span><b>${money(B.variables)}</b></div><div class="row"><span>Apartado a metas</span><b>${money(B.apartado)}</b></div><div class="row"><span>Libre</span><b class="${libre >= 0 ? 'up' : 'down'}">${money(libre)}</b></div></div></div>
    <table class="t" style="margin-top:10px"><tr><th>Categoría</th><th>Monto</th><th>% gasto</th><th>% ingreso</th></tr>
    ${items.map(i => `<tr><td><span class="dot" style="background:${i.color};margin-right:6px"></span>${esc(i.cat)}</td><td>${money(i.monto)}</td><td>${pct(B.gastos ? i.monto / B.gastos : 0)}</td><td>${B.ingresos ? pct(i.monto / B.ingresos) : '—'}</td></tr>`).join('')}
    <tr><td><span class="dot" style="background:#97C459;margin-right:6px"></span><b>Te quedó</b></td><td><b>${money(B.bal)}</b></td><td>—</td><td>${B.ingresos ? pct(B.bal / B.ingresos) : '—'}</td></tr></table>
    ${Object.keys(B.ingCat).length > 1 ? `<p class="small muted" style="margin:10px 0 0">Ingresos: ${Object.keys(B.ingCat).map(k => esc(k) + ' ' + money(B.ingCat[k])).join(' · ')}</p>` : ''}`
    : '<p class="small muted">Sin datos en este periodo.</p>'}</div>
  <div class="card"><div class="row"><h2 style="margin:0">Planeado vs real</h2><button class="btn sec sm" data-act="presupuestos">Presupuestos</button></div>
    ${planRows.length ? `<table class="t" style="margin-top:8px"><tr><th>Categoría</th><th>Plan</th><th>Real</th><th>Diferencia</th></tr>${planRows.map(x => { const d = x.real - x.plan; return `<tr><td>${esc(x.c)}</td><td>${money(x.plan)}</td><td>${money(x.real)}</td><td class="${d > x.plan * 0.05 ? 'down' : d < 0 ? 'up' : ''}">${Math.abs(d) < 1 ? 'en plan' : (d > 0 ? '+' : '−') + money(Math.abs(d))}</td></tr>`; }).join('')}</table>`
    : '<p class="small muted" style="margin:8px 0 0">Define presupuestos para tus gastos variables (comida, gustos…) y agrega tus gastos fijos para compararlos aquí.</p>'}</div>
  <div class="card"><div class="row"><h2 style="margin:0">Salud financiera</h2><span class="badge ${H.cal[1]}">${H.cal[0]}</span></div>
    <ul class="list"><li><div class="grow"><div class="t">Tasa de ahorro</div><div class="m">Qué parte de lo que ganas se queda. Meta: 20% o más.</div></div><span class="amt ${H.tasa >= 0.2 ? 'up' : H.tasa < 0 ? 'down' : ''}">${pct(H.tasa)}</span></li>
    <li><div class="grow"><div class="t">Carga de deuda</div><div class="m">Pagos de deudas / ingreso. Sano: menos de 30%.</div></div><span class="amt ${H.carga > 0.35 ? 'down' : 'up'}">${pct(H.carga)}</span></li>
    <li><div class="grow"><div class="t">Meses de colchón</div><div class="m">Cuánto aguantas con tus ahorros (${money(H.totalAh)}). Meta: 3 a 6.</div></div><span class="amt ${H.colchon >= 3 ? 'up' : ''}">${H.colchon.toFixed(1)}</span></li></ul></div>
  <div class="card"><h2>Evolución (6 meses)</h2><div class="hist">${hist.map(h => `<div class="col"><div class="pair"><i style="height:${h.i / hmax * 100}px;background:var(--grn)"></i><i style="height:${h.g / hmax * 100}px;background:var(--red)"></i></div><div class="lb">${h.l}</div></div>`).join('')}</div>
    <div class="legend"><span><span class="dot" style="background:var(--grn)"></span> Ingresos</span><span><span class="dot" style="background:var(--red)"></span> Gastos</span></div></div>
  <button class="btn sec block" data-act="excel">Exportar este balance a Excel</button>`;
};
V.deudas = () => {
  const act = S.deudas.filter(d => +d.saldo > 0), pagadas = S.deudas.filter(d => !(+d.saldo > 0));
  const total = sum(act, d => +d.saldo), minimos = sum(act, d => +d.pagoMinimo);
  const plan = simDeudas(S.deudas, S.cfg.extraDeuda, S.cfg.metodo, true);
  const soloMin = simDeudas(S.deudas, 0, S.cfg.metodo, false);
  const ahorroInt = soloMin.nunca ? null : soloMin.interes - plan.interes;
  const ordenIds = plan.deudas.slice().sort((x, y) => (x.mes || 9999) - (y.mes || 9999));
  return `<h1>Deudas</h1><p class="sub">Tu plan para salir de deudas y cuánto te ahorras en intereses.</p>
  ${act.length ? `<div class="kpis"><div class="kpi bad"><div class="l">Debes en total</div><div class="v">${money(total)}</div></div><div class="kpi"><div class="l">Pagos al mes</div><div class="v">${money(minimos + (+S.cfg.extraDeuda || 0))}</div></div><div class="kpi good"><div class="l">Libre de deudas</div><div class="v" style="font-size:16px">${plan.nunca ? 'Revisa pagos' : mesesATexto(plan.meses, true)}</div></div></div>
  <div class="card"><h2>Tu estrategia</h2>
    <div class="seg"><button class="${S.cfg.metodo === 'avalancha' ? 'on' : ''}" data-act="metodo" data-v="avalancha">Avalancha</button><button class="${S.cfg.metodo === 'bola' ? 'on' : ''}" data-act="metodo" data-v="bola">Bola de nieve</button></div>
    <p class="small muted" style="margin:0 0 10px">${S.cfg.metodo === 'avalancha' ? 'Primero la de mayor interés: es la que menos dinero te cuesta.' : 'Primero la más chica: ves avances rápido y te motiva.'} Cuando liquidas una, su pago se suma a la siguiente.</p>
    <div class="field"><label>Extra que puedes abonar al mes: <b id="extraLbl">${money(+S.cfg.extraDeuda || 0)}</b></label><input type="range" id="extraDeuda" min="0" max="${Math.max(5000, Math.ceil(total / 10 / 500) * 500)}" step="100" value="${+S.cfg.extraDeuda || 0}"></div>
    <table class="t"><tr><th>Escenario</th><th>Terminas</th><th>Intereses</th></tr>
      <tr><td>Solo pagos mínimos</td><td>${soloMin.nunca ? 'Nunca' : duracion(soloMin.meses)}</td><td>${soloMin.nunca ? '—' : money(soloMin.interes)}</td></tr>
      <tr><td><b>Tu plan</b></td><td><b>${plan.nunca ? 'Nunca' : duracion(plan.meses)}</b></td><td><b>${plan.nunca ? '—' : money(plan.interes)}</b></td></tr></table>
    ${ahorroInt != null && ahorroInt > 1 ? `<p class="small" style="margin:10px 0 0;color:var(--grn)">Con tu plan te ahorras ${money(ahorroInt)} en intereses.</p>` : ''}
    ${plan.nunca ? '<p class="small" style="margin:10px 0 0;color:var(--red)">Algún pago no alcanza ni para los intereses: la deuda crecería. Sube el pago o el extra.</p>' : ''}</div>
  <div class="card"><h2>Orden de pago</h2><ul class="list">${ordenIds.map((p, i) => { const d = S.deudas.find(x => x.id === p.id); const ini = +d.saldoInicial || +d.saldo; const av = ini ? 1 - +d.saldo / ini : 0; return `<li style="flex-wrap:wrap"><span class="badge">${i + 1}</span><div class="grow" data-act="editDeuda" data-id="${d.id}" style="cursor:pointer"><div class="t">${esc(d.nombre)}</div><div class="m">${money(d.saldo)} · ${d.tasa || 0}% anual · ${money(d.pagoMinimo)}/mes${d.diaPago ? ' · paga el ' + d.diaPago : ''}</div></div><button class="btn sm" data-act="abonar" data-id="${d.id}">Abonar</button><div style="width:100%"><div class="bar"><i style="width:${Math.max(2, av * 100)}%"></i></div><div class="small muted" style="margin-top:3px">${pct(av, 0)} pagado · liquidas en ${p.mes ? mesesATexto(p.mes) : '—'}</div></div></li>`; }).join('')}</ul></div>`
    : `<div class="card empty"><div class="big">▤</div>${pagadas.length ? '¡No tienes deudas activas!' : 'Registra tus tarjetas y préstamos para armar tu plan de pago.'}</div>`}
  <button class="btn block" data-act="addDeuda">＋ Agregar deuda</button>
  ${pagadas.length ? `<div class="card" style="margin-top:12px"><h2>Liquidadas</h2><ul class="list">${pagadas.map(d => `<li data-act="editDeuda" data-id="${d.id}" style="cursor:pointer"><span class="badge">✓</span><div class="grow"><div class="t">${esc(d.nombre)}</div></div></li>`).join('')}</ul></div>` : ''}`;
};
V.metas = () => {
  const w = apartarSemana(), M = mensual(), capW = M.disponible * 12 / 52;
  return `<h1>Metas de ahorro</h1><p class="sub">Cuánto apartar por semana y cuándo llegas.</p>
  ${S.metas.length ? `<div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><div class="l">Apartar por semana</div><div class="v">${money(w)}</div><div class="d">${money(w * 52 / 12)} al mes</div></div><div class="kpi ${capW >= w ? 'good' : 'bad'}"><div class="l">Tu plan te deja</div><div class="v">${money(capW)}</div><div class="d">por semana</div></div></div>` : ''}
  ${S.metas.map(mt => { const mi = metaInfo(mt); return `<div class="card"><div class="row"><h2 style="margin:0;cursor:pointer" data-act="editMeta" data-id="${mt.id}">${esc(mt.nombre)} <span class="small muted">✎</span></h2>${mi.done ? '<span class="badge">Completada</span>' : mi.vencida ? '<span class="badge bad">Fecha vencida</span>' : ''}</div>
    <div class="row" style="margin:8px 0 4px"><span class="big-num">${money(mi.ah)}</span><span class="muted">de ${money(mt.objetivo)}</span></div>
    <div class="bar"><i style="width:${Math.max(1, mi.pct * 100)}%"></i></div>
    <p class="small" style="margin:8px 0 10px">${mi.done ? '¡Lo lograste!' : mi.semanal ? `Aparta <b>${money(mi.semanal)}</b> por semana (${money(mi.semanal * 52 / 12)} al mes)${mi.fecha ? ' → la completas el ' + fdateLong(mi.fecha) + ' de ' + parse(mi.fecha).getFullYear() : ''}.` : 'Ponle una fecha o un aporte semanal para calcular tu plan.'} ${!mi.done ? `Te faltan ${money(mi.falta)}.` : ''}</p>
    <div class="btns"><button class="btn sm" data-act="aportar" data-id="${mt.id}">Apartar</button><button class="btn sec sm" data-act="retirar" data-id="${mt.id}">Retirar</button></div></div>`; }).join('') || '<div class="card empty"><div class="big">◎</div>Crea tu primera meta: fondo de emergencia, un viaje, el enganche de algo…</div>'}
  <button class="btn block" data-act="addMeta">＋ Nueva meta</button>`;
};
V.mas = () => {
  const M = mensual();
  const it = (act, t, m) => `<li data-act="${act}"><div class="grow"><div class="t">${t}</div><div class="m">${m}</div></div><span class="chev">›</span></li>`;
  return `<h1>Más</h1>
  <div class="card"><h2>Tu plan mensual</h2><table class="t"><tr><td>Ingresos fijos</td><td class="up">${money(M.ingreso)}</td></tr><tr><td>Gastos fijos</td><td>−${money(M.fijos)}</td></tr><tr><td>Presupuesto variable</td><td>−${money(M.variables)}</td></tr><tr><td>Pagos de deudas (con extra)</td><td>−${money(M.minimos)}</td></tr><tr><td><b>Disponible</b></td><td class="${M.disponible >= 0 ? 'up' : 'down'}"><b>${money(M.disponible)}</b></td></tr><tr><td class="small muted">Por semana</td><td class="small muted">${money(M.disponible * 12 / 52)}</td></tr></table></div>
  <div class="card" style="padding:4px 16px"><ul class="list menu">
    ${it('ingresosFijos', 'Ingresos fijos', S.ingresos.length + ' registrados · tu neto y cada cuánto cobras')}
    ${it('gastosFijos', 'Gastos fijos', S.gastosFijos.length + ' registrados · se anotan solos cada periodo')}
    ${it('presupuestos', 'Presupuestos', 'Límite mensual para comida, gustos, etc.')}
    ${it('simulador', 'Simulador "¿y si…?"', '¿Qué pasa si me suben el sueldo o quito un gasto?')}
    ${it('cal', 'Calendario de la semana', 'Qué toca pagar y apartar cada día')}
  </ul></div>
  <div class="card" style="padding:4px 16px"><ul class="list menu">
    ${it('excel', 'Exportar a Excel', 'Balance, movimientos, deudas y metas')}
    ${it('respaldo', 'Respaldar datos', 'Guarda un archivo con toda tu información')}
    ${it('restaurar', 'Restaurar respaldo', 'Carga un archivo de respaldo')}
    ${it('ajustes', 'Ajustes', 'Tu nombre y recordatorios')}
    ${it('compartir', 'Compartir la app', 'Recomiéndala a tus amigos y conocidos')}
  </ul></div>
  <div class="card" style="padding:4px 16px"><ul class="list menu">
    ${it('demo', 'Cargar datos de ejemplo', 'Para probar la app (reemplaza tus datos)')}
    ${it('borrar', 'Borrar todos mis datos', 'Empieza de cero')}
  </ul></div>
  <p class="small muted" style="text-align:center">Cuentas Claras 1.0 · Tus datos se guardan solo en este teléfono.</p>`;
};

/* Sub-pantallas en hoja */
function listaRecurrentes(kind) {
  const isIng = kind === 'ingresos', arr = S[kind];
  sheet(`<div class="row"><h2 style="margin:0">${isIng ? 'Ingresos fijos' : 'Gastos fijos'}</h2><button class="btn sec sm" id="cl">Cerrar</button></div>
  <p class="small muted">${isIng ? 'Tu ingreso neto (lo que realmente te llega) y cada cuánto lo recibes.' : 'Pagos que se repiten. Cada vez que llega su fecha se registran solos como gasto.'}</p>
  <ul class="list">${arr.map(x => `<li data-id="${x.id}" style="cursor:pointer"><span class="dot" style="background:${isIng ? 'var(--grn)' : catColor(x.categoria)}"></span><div class="grow"><div class="t">${esc(x.nombre)}</div><div class="m">${periodoTxt(x)} · ${esc(x.categoria)} · ≈ ${money(x.monto * monthFactor(x))}/mes</div></div><span class="amt">${money(x.monto)}</span></li>`).join('') || '<li class="muted small">Nada registrado todavía.</li>'}</ul>
  <button class="btn block" id="add" style="margin-top:10px">＋ Agregar</button>`, el => {
    $('#cl', el).onclick = closeSheet; $('#add', el).onclick = () => formRecurrente(kind);
    el.querySelectorAll('li[data-id]').forEach(li => li.onclick = () => formRecurrente(kind, arr.find(x => x.id === li.dataset.id)));
  });
}
function presupuestos() {
  const prom = {}; const t = today(), a = addDays(t, -90);
  S.movimientos.filter(m => m.tipo === 'gasto' && !m.fijo && m.fecha >= a).forEach(m => { prom[m.categoria] = (prom[m.categoria] || 0) + m.monto / 3; });
  sheet(`<div class="row"><h2 style="margin:0">Presupuestos mensuales</h2><button class="btn sec sm" id="cl">Cerrar</button></div>
  <p class="small muted">Cuánto te permites gastar al mes en cada categoría variable. Los gastos fijos ya cuentan por su cuenta.</p>
  <form id="pf">${CAT_GASTO.filter(c => c !== 'Deudas').map(c => `<div class="field"><label>${c}${prom[c] ? ` <span class="muted">(promedio real: ${money(prom[c])})</span>` : ''}</label><input type="number" inputmode="decimal" min="0" step="any" name="${c}" value="${S.presupuestos[c] || ''}" placeholder="0"></div>`).join('')}
  <button class="btn block" type="submit">Guardar presupuestos</button></form>`, el => {
    $('#cl', el).onclick = closeSheet;
    $('#pf', el).onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); S.presupuestos = {}; for (const [k, v] of fd.entries()) if (+v > 0) S.presupuestos[k] = r2(v); save(); closeSheet(); render(); toast('Presupuestos guardados'); };
  });
}
function simulador() {
  const M = mensual(), mt = S.metas.find(m => !metaInfo(m).done);
  sheet(`<div class="row"><h2 style="margin:0">Simulador "¿y si…?"</h2><button class="btn sec sm" id="cl">Cerrar</button></div>
  <p class="small muted">Mueve los valores y mira cómo cambia tu plan. No modifica tus datos.</p>
  <div class="field"><label>Cambio en mi ingreso mensual: <b id="lIng"></b></label><input type="range" id="sIng" min="-10000" max="20000" step="250" value="0"></div>
  <div class="field"><label>Recortar mis gastos variables: <b id="lRec"></b></label><input type="range" id="sRec" min="0" max="50" step="5" value="0"></div>
  <div class="field"><label>Extra mensual a deudas: <b id="lDeu"></b></label><input type="range" id="sDeu" min="0" max="10000" step="250" value="${+S.cfg.extraDeuda || 0}"></div>
  ${S.gastosFijos.length ? `<div class="field"><label>Quitar gastos fijos</label>${S.gastosFijos.map(g => `<label class="chk"><input type="checkbox" value="${g.id}" class="sQ"><span style="flex:1">${esc(g.nombre)}</span><span class="small muted">${money(g.monto * monthFactor(g))}/mes</span></label>`).join('')}</div>` : ''}
  <div class="card" style="background:var(--bg)" id="sOut"></div>`, el => {
    $('#cl', el).onclick = closeSheet;
    const upd = () => {
      const dIng = +$('#sIng', el).value, rec = +$('#sRec', el).value / 100, ext = +$('#sDeu', el).value;
      const quit = [...el.querySelectorAll('.sQ:checked')].map(c => S.gastosFijos.find(g => g.id === c.value));
      const ahorroQuit = sum(quit, g => g.monto * monthFactor(g));
      $('#lIng', el).textContent = (dIng >= 0 ? '+' : '−') + money(Math.abs(dIng)); $('#lRec', el).textContent = (rec * 100) + '%'; $('#lDeu', el).textContent = money(ext);
      const hayDeuda = S.deudas.some(d => +d.saldo > 0), ext0 = hayDeuda ? +S.cfg.extraDeuda || 0 : 0;
      const disp0 = M.disponible;
      const disp = M.disponible + ext0 + dIng + M.variables * rec + ahorroQuit - (hayDeuda ? ext : 0);
      const sw = disp * 12 / 52;
      const d0 = simDeudas(S.deudas, S.cfg.extraDeuda, S.cfg.metodo), d1 = simDeudas(S.deudas, ext, S.cfg.metodo);
      let metaTxt = '';
      if (mt) {
        const base = metaInfo(mt, Math.max(0, disp0 * 12 / 52)), nuevo = metaInfo(mt, Math.max(0, sw));
        metaTxt = `<tr><td>"${esc(mt.nombre)}" usando todo lo libre</td><td>${base.fecha ? fdate(base.fecha) : '—'}</td><td><b>${nuevo.fecha ? fdate(nuevo.fecha) : 'no alcanza'}</b></td></tr>`;
      }
      $('#sOut', el).innerHTML = `<table class="t"><tr><th></th><th>Hoy</th><th>Simulado</th></tr>
        <tr><td>Libre al mes</td><td>${money(disp0)}</td><td class="${disp >= disp0 ? 'up' : 'down'}"><b>${money(disp)}</b></td></tr>
        <tr><td>Libre por semana</td><td>${money(disp0 * 12 / 52)}</td><td><b>${money(sw)}</b></td></tr>
        <tr><td>En un año juntas</td><td>${money(Math.max(0, disp0) * 12)}</td><td><b>${money(Math.max(0, disp) * 12)}</b></td></tr>
        ${S.deudas.some(d => +d.saldo > 0) ? `<tr><td>Libre de deudas</td><td>${d0.nunca ? 'Nunca' : duracion(d0.meses)}</td><td><b>${d1.nunca ? 'Nunca' : duracion(d1.meses)}</b></td></tr><tr><td>Intereses a pagar</td><td>${money(d0.interes)}</td><td><b>${money(d1.interes)}</b></td></tr>` : ''}
        ${metaTxt}</table>`;
    };
    el.addEventListener('input', upd); upd();
  });
}
function calendario() {
  const ref = S.ui.calRef, dow = (parse(ref).getDay() + 6) % 7, a = addDays(ref, -dow), b = addDays(a, 6), ev = eventos(a, b), t = today();
  const w = apartarSemana(), out = sum(ev.filter(e => e.tipo !== 'in' && e.monto), e => e.monto), inc = sum(ev.filter(e => e.tipo === 'in'), e => e.monto);
  let days = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(a, i), de = ev.filter(e => e.fecha === d);
    days += `<div class="cal-day ${d === t ? 'today' : ''}"><div class="h"><span>${cap(fdateLong(d))}</span>${d === t ? '<span class="badge">Hoy</span>' : ''}</div>${de.map(e => `<div class="cal-item ${e.tipo === 'corte' ? '' : e.tipo}"><span>${esc(e.nombre)}</span><span>${e.monto != null ? (e.tipo === 'in' ? '+' : '') + money(e.monto) : 'fecha de corte'}</span></div>`).join('') || '<div class="small muted">Sin pagos</div>'}</div>`;
  }
  sheet(`<div class="row"><h2 style="margin:0">Calendario de la semana</h2><button class="btn sec sm" id="cl">Cerrar</button></div>
  <div class="pnav" style="margin-top:10px"><button id="cp" aria-label="Semana anterior">‹</button><div class="lbl">${fdate(a)} – ${fdate(b)}</div><button id="cn" aria-label="Semana siguiente">›</button></div>
  <div class="sem g" style="margin-bottom:8px"><span>Esta semana toca apartar <b style="font-size:15px">${money(w)}</b> para tus metas${out ? ` y pagar <b style="font-size:15px">${money(out)}</b>` : ''}${inc ? `. Te entran ${money(inc)}` : ''}.</span></div>
  ${days}`, el => {
    $('#cl', el).onclick = closeSheet;
    $('#cp', el).onclick = () => { S.ui.calRef = addDays(a, -7); calendario(); };
    $('#cn', el).onclick = () => { S.ui.calRef = addDays(a, 7); calendario(); };
  });
}
function ajustes() {
  form({
    title: 'Ajustes',
    fields: [
      { k: 'nombre', label: 'Tu nombre', value: S.nombre, ph: 'Cómo quieres que te salude' },
      { k: 'rec', label: 'Recordatorios de pagos', type: 'select', options: [['1', 'Activados (avisos el día de pago)'], ['0', 'Desactivados']], value: S.cfg.recordatorios ? '1' : '0', hint: isNative() ? 'Te avisa a las 9:00 am el día de cada pago fijo, de deudas y de corte.' : 'Los avisos funcionan en la app instalada en Android. Aquí los verás en Inicio y en el Calendario.' }
    ],
    onSave: v => { S.nombre = v.nombre; S.cfg.recordatorios = v.rec === '1'; scheduleNotifs(true); toast('Ajustes guardados'); }
  });
}

/* ---------- Recordatorios (app Android) ---------- */
async function scheduleNotifs(ask) {
  try {
    if (!isNative() || !window.Capacitor.Plugins.LocalNotifications) return;
    const LN = window.Capacitor.Plugins.LocalNotifications;
    const pend = await LN.getPending(); if (pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
    if (!S.cfg.recordatorios) return;
    let perm = await LN.checkPermissions();
    if (perm.display !== 'granted') { if (!ask && perm.display === 'denied') return; perm = await LN.requestPermissions(); if (perm.display !== 'granted') return; }
    const t = today(), ev = eventos(t, addDays(t, 45)).filter(e => e.tipo !== 'in');
    const notifications = ev.slice(0, 60).map((e, i) => { const d = parse(e.fecha); d.setHours(9, 0, 0, 0); return { id: 1000 + i, title: e.tipo === 'corte' ? 'Hoy es tu fecha de corte' : 'Hoy toca pagar', body: e.nombre + (e.monto != null ? ': ' + money(e.monto) : ''), schedule: { at: d } }; }).filter(n => n.schedule.at > new Date());
    if (notifications.length) await LN.schedule({ notifications });
  } catch (e) { /* sin avisos */ }
}

/* ---------- Exportar / respaldo ---------- */
async function saveFile(name, b64, mime, textFallback) {
  if (isNative() && window.Capacitor.Plugins.Filesystem) {
    const FS = window.Capacitor.Plugins.Filesystem, SH = window.Capacitor.Plugins.Share;
    const r = await FS.writeFile({ path: name, data: b64, directory: 'CACHE' });
    if (SH) await SH.share({ title: name, url: r.uri, dialogTitle: 'Guardar o compartir' });
    else toast('Archivo guardado');
    return;
  }
  const bin = atob(b64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  const url = URL.createObjectURL(blob), aEl = document.createElement('a'); aEl.href = url; aEl.download = name; document.body.appendChild(aEl); aEl.click(); aEl.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function exportExcel() {
  if (!window.XLSX) return toast('No se pudo cargar el módulo de Excel');
  const per = S.ui.per, [a, b] = periodRange(per, S.ui.ref), B = balance(a, b), H = salud(B), [pa, pb] = prevComparable(a, b), P = balance(pa, pb);
  const wb = XLSX.utils.book_new();
  const res = [['Cuentas Claras — Balance', ''], ['Periodo', periodLabel(per, a, b)], ['Del', a], ['Al', b], [], ['Concepto', 'Monto'], ['Total percibido', r2(B.ingresos)], ['Total gastado', r2(B.gastos)], ['Balance (te quedó)', r2(B.bal)], ['% que te quedó', B.ingresos ? r2(B.bal / B.ingresos * 100) / 100 : 0], ['Gastos fijos', r2(B.fijos)], ['Gastos variables', r2(B.variables)], ['Apartado a metas', r2(B.apartado)], ['Libre', r2(B.bal - B.apartado)], [], ['Salud financiera', H.cal[0]], ['Tasa de ahorro', r2(H.tasa * 100) / 100], ['Carga de deuda', r2(H.carga * 100) / 100], ['Meses de colchón', r2(H.colchon)], [], ['Lectura del periodo']].concat(lectura(B, P, per).map(s => [s]));
  const ws1 = XLSX.utils.aoa_to_sheet(res); ws1['!cols'] = [{ wch: 30 }, { wch: 18 }];
  ['B10', 'B17', 'B18'].forEach(c => { if (ws1[c]) ws1[c].z = '0.0%'; });
  ['B7', 'B8', 'B9', 'B11', 'B12', 'B13', 'B14'].forEach(c => { if (ws1[c]) ws1[c].z = '"$"#,##0.00'; });
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');
  const cat = [['Categoría', 'Monto', '% del gasto', '% del ingreso', 'Planeado', 'Diferencia']].concat(B.cats.map(c => [c.cat, r2(c.monto), B.gastos ? c.monto / B.gastos : 0, B.ingresos ? c.monto / B.ingresos : 0, r2(B.plan[c.cat] || 0), r2(c.monto - (B.plan[c.cat] || 0))]));
  const ws2 = XLSX.utils.aoa_to_sheet(cat); ws2['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 13 }, { wch: 14 }, { wch: 14 }];
  for (let r = 2; r <= cat.length; r++) { ['B', 'E', 'F'].forEach(c => { if (ws2[c + r]) ws2[c + r].z = '"$"#,##0.00'; }); ['C', 'D'].forEach(c => { if (ws2[c + r]) ws2[c + r].z = '0.0%'; }); }
  XLSX.utils.book_append_sheet(wb, ws2, 'Por categoría');
  const mv = [['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Fijo']].concat(B.mv.slice().sort((x, y) => x.fecha.localeCompare(y.fecha)).map(m => [m.fecha, m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto', m.categoria, m.nota || '', m.tipo === 'ingreso' ? r2(m.monto) : -r2(m.monto), m.auto ? 'Sí' : 'No']));
  const ws3 = XLSX.utils.aoa_to_sheet(mv); ws3['!cols'] = [{ wch: 12 }, { wch: 9 }, { wch: 16 }, { wch: 28 }, { wch: 13 }, { wch: 6 }];
  for (let r = 2; r <= mv.length; r++) if (ws3['E' + r]) ws3['E' + r].z = '"$"#,##0.00';
  XLSX.utils.book_append_sheet(wb, ws3, 'Movimientos');
  const pl = simDeudas(S.deudas, S.cfg.extraDeuda, S.cfg.metodo);
  const de = [['Deuda', 'Saldo', 'Tasa anual %', 'Pago mensual', 'Día de pago', 'Liquidas en']].concat(S.deudas.map(d => { const p = pl.deudas.find(x => x.id === d.id); return [d.nombre, r2(d.saldo), +d.tasa || 0, r2(d.pagoMinimo), d.diaPago || '', p && p.mes ? mesesATexto(p.mes) : (+d.saldo > 0 ? '—' : 'Liquidada')]; }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(de), 'Deudas');
  const me = [['Meta', 'Objetivo', 'Ahorrado', 'Falta', 'Apartar por semana', 'Fecha estimada']].concat(S.metas.map(mt => { const mi = metaInfo(mt); return [mt.nombre, r2(mt.objetivo), r2(mi.ah), r2(mi.falta), r2(mi.semanal), mi.fecha || '']; }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(me), 'Metas');
  const b64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  try { await saveFile(`Balance_${a}_a_${b}.xlsx`, b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); } catch (e) { toast('No se pudo exportar'); }
}
async function respaldo() {
  const json = JSON.stringify(Object.assign({}, S, { ui: undefined }), null, 1);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  try { await saveFile(`CuentasClaras_respaldo_${today()}.json`, b64, 'application/json'); } catch (e) { toast('No se pudo crear el respaldo'); }
}
function restaurar() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.movimientos)) throw 0;
        if (!confirm('Esto reemplaza tus datos actuales con los del respaldo. ¿Continuar?')) return;
        const ui = S.ui; S = Object.assign(blank(), d); S.ui = ui; save(); materialize(); render(); toast('Respaldo restaurado');
      } catch (e) { toast('Ese archivo no es un respaldo válido'); }
    };
    rd.readAsText(f);
  };
  inp.click();
}

/* ---------- Datos de ejemplo ---------- */
function demo() {
  let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const t = today(), d0 = parse(t), ini = iso(new Date(d0.getFullYear(), d0.getMonth() - 5, 1));
  const firstFri = (() => { let x = ini; while (parse(x).getDay() !== 5) x = addDays(x, 1); return x; })();
  const keep = S.ui; S = blank(); S.ui = keep; S.ui.tab = 'inicio'; S.nombre = 'Marco';
  S.ingresos = [{ id: uid(), nombre: 'Sueldo neto', monto: 5500, periodo: 'semanal', inicio: firstFri, categoria: 'Sueldo' }];
  const gf = (nombre, monto, periodo, dia, categoria) => ({ id: uid(), nombre, monto, periodo, inicio: addDays(ini, dia - 1), categoria });
  S.gastosFijos = [gf('Renta', 5000, 'mensual', 1, 'Vivienda'), gf('Internet', 450, 'mensual', 8, 'Servicios'), gf('Celular', 300, 'mensual', 12, 'Servicios'), gf('Luz', 600, 'bimestral', 20, 'Servicios'), gf('Gasolina', 600, 'semanal', 2, 'Transporte'), gf('Streaming', 249, 'mensual', 15, 'Gustos')];
  S.presupuestos = { Comida: 2800, Gustos: 900, Salud: 400, Ropa: 500 };
  for (let d = ini; d <= t; d = addDays(d, 1)) {
    const wd = parse(d).getDay();
    if (wd === 6 || wd === 3) S.movimientos.push({ id: uid(), fecha: d, tipo: 'gasto', categoria: 'Comida', monto: Math.round(250 + rnd() * 260), nota: wd === 6 ? 'Súper' : 'Mandado' });
    if (wd === 5 && rnd() < 0.55) S.movimientos.push({ id: uid(), fecha: d, tipo: 'gasto', categoria: 'Gustos', monto: Math.round(150 + rnd() * 350), nota: 'Salida' });
    if (rnd() < 0.05) S.movimientos.push({ id: uid(), fecha: d, tipo: 'gasto', categoria: rnd() < 0.5 ? 'Salud' : 'Ropa', monto: Math.round(200 + rnd() * 500), nota: 'Varios' });
    if (parse(d).getDate() === 25 && rnd() < 0.6) S.movimientos.push({ id: uid(), fecha: d, tipo: 'ingreso', categoria: 'Extra', monto: Math.round(800 + rnd() * 1200), nota: 'Trabajo extra' });
  }
  S.deudas = [
    { id: uid(), nombre: 'Tarjeta de crédito', saldo: 18000, saldoInicial: 24000, tasa: 54, pagoMinimo: 1200, diaPago: 5, diaCorte: 15 },
    { id: uid(), nombre: 'Préstamo tienda', saldo: 6500, saldoInicial: 9000, tasa: 70, pagoMinimo: 700, diaPago: 20, diaCorte: '' }
  ];
  S.deudas.forEach(dd => { for (let d = ini; d <= t; d = addDays(d, 1)) if (parse(d).getDate() === dd.diaPago) S.movimientos.push({ id: uid(), fecha: d, tipo: 'gasto', categoria: 'Deudas', monto: dd.pagoMinimo, nota: 'Abono ' + dd.nombre, deudaId: dd.id }); });
  S.cfg.extraDeuda = 500;
  const f6 = new Date(d0.getFullYear(), d0.getMonth() + 6, 1);
  const ap = []; for (let d = firstFri; d <= t; d = addDays(d, 14)) ap.push({ fecha: d, monto: 800 });
  S.metas = [{ id: uid(), nombre: 'Fondo de emergencia', objetivo: 30000, fecha: iso(f6), aporteSemanal: '', aportes: ap },
    { id: uid(), nombre: 'Vacaciones', objetivo: 8000, fecha: '', aporteSemanal: 300, aportes: [{ fecha: t, monto: 1200 }] }];
  materialize(); save(); render(); toast('Datos de ejemplo cargados');
}

/* ---------- Render y eventos ---------- */
function render() {
  const tab = S.ui.tab;
  $('#view').innerHTML = (V[tab] || V.inicio)();
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const ex = $('#extraDeuda');
  if (ex) { ex.oninput = () => { $('#extraLbl').textContent = money(+ex.value); }; ex.onchange = () => { S.cfg.extraDeuda = +ex.value; save(); render(); }; }
  const cf = $('#cFrom'), ct = $('#cTo');
  if (cf) { const upd = () => { if (cf.value && ct.value && cf.value <= ct.value) { S.ui.from = cf.value; S.ui.to = ct.value; save(); render(); } }; cf.onchange = upd; ct.onchange = upd; }
}
function go(tab) { S.ui.tab = tab; save(); render(); window.scrollTo(0, 0); }
const ACT = {
  addIngreso: () => formMovimiento('ingreso'), addGasto: () => formMovimiento('gasto'),
  addIngresoFijo: () => formRecurrente('ingresos'),
  editMov: id => { const m = S.movimientos.find(x => x.id === id); if (m) formMovimiento(m.tipo, m); },
  movFiltro: (id, v) => { S.ui.movFiltro = v; save(); render(); },
  per: (id, v) => { S.ui.per = v; if (v === 'custom' && !S.ui.from) { const [a, b] = periodRange('mes', S.ui.ref); S.ui.from = a; S.ui.to = b; } save(); render(); },
  prev: () => { S.ui.ref = shiftRef(S.ui.per, S.ui.ref, -1); save(); render(); },
  next: () => { S.ui.ref = shiftRef(S.ui.per, S.ui.ref, 1); save(); render(); },
  metodo: (id, v) => { S.cfg.metodo = v; save(); render(); },
  addDeuda: () => formDeuda(), editDeuda: id => formDeuda(S.deudas.find(x => x.id === id)),
  abonar: id => formAbono(S.deudas.find(x => x.id === id)), pagar: id => formAbono(S.deudas.find(x => x.id === id)),
  addMeta: () => formMeta(), editMeta: id => formMeta(S.metas.find(x => x.id === id)),
  aportar: id => formAporte(S.metas.find(x => x.id === id)), retirar: id => formAporte(S.metas.find(x => x.id === id), true),
  ingresosFijos: () => listaRecurrentes('ingresos'), gastosFijos: () => listaRecurrentes('gastosFijos'),
  presupuestos, simulador, cal: () => { S.ui.calRef = today(); calendario(); }, ajustes,
  excel: exportExcel, respaldo, restaurar, compartir: compartirApp,
  noBanner: () => { S.ui.noBanner = true; save(); render(); },
  demo: () => { if (!S.movimientos.length || confirm('Esto reemplaza tus datos con datos de ejemplo. ¿Continuar?')) demo(); },
  borrar: () => { if (confirm('¿Borrar TODOS tus datos? No se puede deshacer.')) { const ui = S.ui; S = blank(); S.ui = ui; S.ui.tab = 'inicio'; save(); render(); scheduleNotifs(); toast('Datos borrados'); } }
};
document.addEventListener('click', e => {
  const tb = e.target.closest('[data-tab]'); if (tb && !e.target.closest('#sheet')) { go(tb.dataset.tab); return; }
  const el = e.target.closest('[data-act]'); if (!el || e.target.closest('#sheet')) return;
  const f = ACT[el.dataset.act]; if (f) f(el.dataset.id, el.dataset.v);
});
$('#btnAdd').onclick = () => sheet(`<h2>¿Qué quieres registrar?</h2><div class="fab-row"><button class="btn in" id="q1">＋ Ingreso</button><button class="btn out" id="q2">－ Gasto</button></div>
  <div class="btns"><button class="btn sec sm" id="q3">Gasto fijo</button><button class="btn sec sm" id="q4">Deuda</button><button class="btn sec sm" id="q5">Meta</button><button class="btn sec sm" id="q6">Apartar a meta</button></div>`, el => {
  $('#q1', el).onclick = () => formMovimiento('ingreso'); $('#q2', el).onclick = () => formMovimiento('gasto');
  $('#q3', el).onclick = () => formRecurrente('gastosFijos'); $('#q4', el).onclick = () => formDeuda(); $('#q5', el).onclick = () => formMeta();
  $('#q6', el).onclick = () => { if (!S.metas.length) { closeSheet(); go('metas'); toast('Primero crea una meta'); } else if (S.metas.length === 1) formAporte(S.metas[0]); else { closeSheet(); go('metas'); } };
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
  window.Capacitor.Plugins.App.addListener('backButton', () => { if (!$('#sheet').hidden) closeSheet(); else if (S.ui.tab !== 'inicio') go('inicio'); else window.Capacitor.Plugins.App.exitApp(); });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { materialize(); render(); } });

load(); materialize(); render(); scheduleNotifs();
window.__cc = { occurrences, balance, simDeudas, metaInfo, mensual, get S() { return S; } };
})();
