/*
 * Multi-Site Panel für Home Assistant
 * Eigene, app-artige Oberfläche für mehrere Standorte. Wird über panel_custom geladen.
 * Keine Build-Schritte und keine externen Abhängigkeiten: Icons kommen von <ha-icon> aus Home Assistant.
 */
const VERSION = '0.1.0';

/* ---------- Hilfsfunktionen ---------- */
const nf1 = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 1, maximumFractionDigits: 1});
const nf0 = new Intl.NumberFormat('de-DE', {maximumFractionDigits: 0});
const f1 = v => nf1.format(v);
const f0 = v => nf0.format(v);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const ic = (icon, cls = '') => `<ha-icon class="i ${cls}" icon="${esc(icon)}"></ha-icon>`;
const arr = v => Array.isArray(v) ? v : v == null ? [] : [v];
const lc = s => String(s ?? '').toLowerCase().trim();
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const domainOf = eid => eid.slice(0, eid.indexOf('.'));
const temp = v => v == null ? '—' : `${f1(v)}°`;
const fmtPower = kw => kw == null ? '—' : Math.abs(kw) < 1 ? `${f0(kw * 1000)} W` : `${f1(kw)} kW`;
const fmtEnergy = kwh => kwh == null ? '—' : `${Math.abs(kwh) < 10 ? f1(kwh) : f0(kwh)} kWh`;
const hhmm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const powerFactor = u => u === 'W' ? 0.001 : u === 'MW' ? 1000 : 1;
const energyFactor = u => u === 'Wh' ? 0.001 : u === 'MWh' ? 1000 : 1;
function powerKW(st){ if (!st) return null; const v = num(st.state); return v == null ? null : v * powerFactor(st.attributes.unit_of_measurement); }
function energyKWh(st){ if (!st) return null; const v = num(st.state); return v == null ? null : v * energyFactor(st.attributes.unit_of_measurement); }
function duration(iso){
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (!Number.isFinite(m) || m < 1) return null;
  if (m < 60) return `${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} Std.`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? 'Tag' : 'Tagen'}`;
}
const sinceText = iso => { const d = duration(iso); return d ? `seit ${d}` : 'gerade eben'; };
const agoText = iso => { const d = duration(iso); return d ? `vor ${d}` : 'gerade eben'; };
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } };

/* ---------- Konstanten ---------- */
const TABS = [
  {id: 'start', label: 'Start', icon: 'mdi:home-outline', iconOn: 'mdi:home'},
  {id: 'orte', label: 'Orte', icon: 'mdi:home-group', iconOn: 'mdi:home-group'},
  {id: 'heizung', label: 'Heizung', icon: 'mdi:thermostat', iconOn: 'mdi:thermostat'},
  {id: 'versorgung', label: 'Versorgung', icon: 'mdi:lightning-bolt-outline', iconOn: 'mdi:lightning-bolt'},
  {id: 'sicherheit', label: 'Sicherheit', icon: 'mdi:shield-home-outline', iconOn: 'mdi:shield-home'},
];
const ART = {
  strom: {icon: 'mdi:lightning-bolt', color: '--c-power', group: 'Strom', short: 'Strom'},
  gas: {icon: 'mdi:meter-gas', color: '--c-gas', group: 'Wärme', short: 'Gas'},
  holz: {icon: 'mdi:fireplace', color: '--c-wood', group: 'Wärme', short: 'Holz'},
  oel: {icon: 'mdi:barrel', color: '--c-oil', group: 'Wärme', short: 'Öl'},
  waerme: {icon: 'mdi:radiator', color: '--c-heat', group: 'Wärme', short: 'Wärme'},
  waermepumpe: {icon: 'mdi:heat-pump', color: '--c-heat', group: 'Wärme', short: 'Wärmepumpe'},
  wasser: {icon: 'mdi:water', color: '--c-water', group: 'Wasser', short: 'Wasser'},
  brunnen: {icon: 'mdi:water-well', color: '--c-well', group: 'Wasser', short: 'Brunnen'},
  internet: {icon: 'mdi:web', color: '--c-net', group: 'Internet', short: 'Internet'},
  sonstiges: {icon: 'mdi:transmission-tower', color: '--c-net', group: 'Sonstiges', short: 'Anschluss'},
};
const GROUP_ORDER = ['Strom', 'Wärme', 'Wasser', 'Internet', 'Sonstiges'];
const HEAT_ARTS = new Set(['gas', 'holz', 'oel', 'waerme', 'waermepumpe']);
const MESSUNG = {
  voll: {label: 'Gemessen', cls: 'ok', icon: 'mdi:check-circle'},
  teilweise: {label: 'Teilweise gemessen', cls: 'warn', icon: 'mdi:alert'},
  therme: {label: 'Über die Therme', cls: 'ok', icon: 'mdi:check-circle'},
  keine: {label: 'Nicht gemessen', cls: 'muted', icon: 'mdi:minus'},
  geplant: {label: 'In Vorbereitung', cls: 'muted', icon: 'mdi:clock-outline'},
  offen: {label: 'Noch nicht angebunden', cls: 'muted', icon: 'mdi:clock-outline'},
};
const SUPPLY_KEYS = ['leistung', 'solar', 'netz', 'verbrauch_heute', 'solar_heute', 'einspeisung_heute', 'bezug_heute', 'status'];
const APPL_ICON = {waschmaschine: 'mdi:washing-machine', trockner: 'mdi:tumble-dryer', spuelmaschine: 'mdi:dishwasher', backofen: 'mdi:stove', kaffeemaschine: 'mdi:coffee-maker'};
const RUN = ['run', 'running', 'läuft', 'laeuft', 'in betrieb', 'active', 'aktiv', 'washing', 'drying', 'rinsing', 'spinning', 'cleaning', 'waschen', 'trocknen', 'spülen', 'schleudern', 'reinigen'];
const DONE = ['finished', 'fertig', 'end', 'done', 'complete', 'completed', 'beendet', 'programm beendet', 'programmende'];
const WEATHER = {
  'sunny': ['sonnig', 'mdi:weather-sunny'], 'clear-night': ['klar', 'mdi:weather-night'],
  'partlycloudy': ['teils bewölkt', 'mdi:weather-partly-cloudy'], 'cloudy': ['bewölkt', 'mdi:weather-cloudy'],
  'rainy': ['Regen', 'mdi:weather-rainy'], 'pouring': ['Starkregen', 'mdi:weather-pouring'],
  'snowy': ['Schnee', 'mdi:weather-snowy'], 'snowy-rainy': ['Schneeregen', 'mdi:weather-snowy-rainy'],
  'fog': ['Nebel', 'mdi:weather-fog'], 'hail': ['Hagel', 'mdi:weather-hail'],
  'lightning': ['Gewitter', 'mdi:weather-lightning'], 'lightning-rainy': ['Gewitter', 'mdi:weather-lightning-rainy'],
  'windy': ['windig', 'mdi:weather-windy'], 'windy-variant': ['windig', 'mdi:weather-windy-variant'],
  'exceptional': ['Unwetter', 'mdi:alert'],
};
const ROOM_ICONS = [
  [/küche|kueche/i, 'mdi:stove'], [/wohn/i, 'mdi:sofa'], [/schlaf/i, 'mdi:bed'], [/kind/i, 'mdi:teddy-bear'],
  [/bad|wc|dusch/i, 'mdi:shower'], [/büro|buero|office/i, 'mdi:desk'], [/werkstatt/i, 'mdi:tools'],
  [/halle|lager/i, 'mdi:warehouse'], [/stadel|scheune/i, 'mdi:barn'], [/gewächs|gärtner|gaertner/i, 'mdi:flower'],
  [/garten|hof|außen|aussen|terrasse/i, 'mdi:tree'], [/heiz/i, 'mdi:fire'], [/wasch/i, 'mdi:washing-machine'],
  [/keller/i, 'mdi:stairs-down'], [/flur|diele|gang/i, 'mdi:door'], [/garage/i, 'mdi:garage'],
  [/ess/i, 'mdi:silverware-fork-knife'], [/besprech|meeting/i, 'mdi:account-group'],
];
const CLASS_DOMAINS = new Set(['light', 'switch', 'fan', 'cover', 'climate', 'media_player', 'sensor', 'lock', 'camera']);
const UNASSIGNED_KINDS = ['light', 'switch', 'cover', 'climate', 'media', 'gate', 'lock', 'camera'];
const KIND_LABEL = {light: 'Licht', switch: 'Schalter', cover: 'Rollläden', climate: 'Heizung', media: 'Medien', gate: 'Tore', lock: 'Schlösser', camera: 'Kameras'};
const STEP_MS = 15 * 60 * 1000;

function classify(dom, st){
  const dc = st.attributes.device_class;
  switch (dom){
    case 'light': return 'light';
    case 'switch': case 'fan': return 'switch';
    case 'cover': return ['garage', 'gate', 'door'].includes(dc) ? 'gate' : 'cover';
    case 'climate': return 'climate';
    case 'media_player': return 'media';
    case 'sensor': return dc === 'temperature' ? 'temp' : dc === 'humidity' ? 'hum' : null;
    case 'lock': return 'lock';
    case 'camera': return 'camera';
    default: return null;
  }
}

/* Zeitgewichteter Mittelwert pro Zeitfenster aus einer Zustandsreihe. */
function bucketize(pts, t0, t1, step){
  const n = Math.max(1, Math.ceil((t1 - t0) / step));
  const out = [];
  let i = 0, val = null;
  while (i < pts.length && pts[i].t <= t0){ val = pts[i].v; i++; }
  for (let b = 0; b < n; b++){
    const s = t0 + b * step, e = Math.min(t0 + (b + 1) * step, t1);
    let acc = 0, dur = 0, t = s;
    while (i < pts.length && pts[i].t < e){
      if (val != null){ acc += val * (pts[i].t - t); dur += pts[i].t - t; }
      t = pts[i].t; val = pts[i].v; i++;
    }
    if (val != null){ acc += val * (e - t); dur += e - t; }
    out.push(dur > 0 ? acc / dur : null);
  }
  return out;
}

/* ---------- Konfiguration ---------- */
function normConfig(raw){
  const c = raw && typeof raw === 'object' ? raw : {};
  const asObj = (v, key) => typeof v === 'string' ? {[key]: v} : (v || {});
  const sites = arr(c.standorte).map((s, i) => {
    const id = String(s.id ?? `standort_${i + 1}`);
    const name = String(s.name ?? id);
    return {
      id, name, short: String(s.kurz ?? name), tag: String(s.kuerzel ?? s.kurz ?? name), role: String(s.rolle ?? ''),
      icon: s.icon || 'mdi:home',
      floors: arr(s.etagen).map(f => typeof f === 'object' ? {ref: String(f.id ?? f.name), name: f.name} : {ref: String(f)}),
      areas: arr(s.bereiche).map(String),
      extraName: s.bereiche_titel || 'Weitere Bereiche',
    };
  });
  return {
    sites,
    weather: c.wetter || null,
    outside: c.aussentemperatur || null,
    favLabel: lc(c.favoriten_label ?? 'favorit'),
    favs: arr(c.favoriten),
    hidden: new Set(arr(c.ausblenden)),
    scenes: arr(c.szenen).filter(s => s && s.entity).map(s => ({name: s.name || '', desc: s.beschreibung || '', entity: s.entity, site: s.standort ? String(s.standort) : null, icon: s.icon || 'mdi:play-circle-outline'})),
    supplies: arr(c.versorgung).map((s, i) => ({
      ...s, id: String(s.id ?? `versorgung_${i + 1}`), art: ART[s.art] ? s.art : 'sonstiges', name: s.name || `Anschluss ${i + 1}`,
      sites: arr(s.standorte).map(String), versorgt: arr(s.versorgt), werte: arr(s.werte), geplant: arr(s.geplant),
    })),
    appliances: arr(c.geraete).filter(g => g && (g.status || g.leistung)).map((g, i) => ({
      id: `geraet_${i + 1}`, name: g.name || 'Gerät', art: APPL_ICON[g.art] ? g.art : 'waschmaschine',
      area: g.bereich || null, site: g.standort ? String(g.standort) : null,
      status: g.status || null, power: g.leistung || null, threshold: num(g.schwelle) ?? 5,
      remain: g.restzeit || null, program: g.programm || null, progress: g.fortschritt || null, notify: g.mitteilung || null,
      run: arr(g.laeuft).map(lc), done: arr(g.fertig).map(lc),
    })),
    access: arr(c.zugang).map(a => asObj(a, 'entity')).filter(a => a.entity).map(a => ({entity: a.entity, name: a.name || null, site: a.standort ? String(a.standort) : null, art: a.art || null, status: a.status || null})),
    cameras: arr(c.kameras).map(a => asObj(a, 'entity')).filter(a => a.entity).map(a => ({entity: a.entity, name: a.name || null, site: a.standort ? String(a.standort) : null})),
    events: arr(c.ereignisse),
    season: c.heizsaison ? asObj(c.heizsaison, 'entity') : null,
    users: arr(c.benutzer).map(u => ({name: u.name ?? null, id: u.id ?? null, sites: arr(u.standorte).map(String)})),
    menuButton: c.menue_knopf !== false,
  };
}

/* ---------- Gestaltung ---------- */
const CSS = `
:host{
  display:block;position:relative;height:100vh;height:100dvh;
  --bg:#F1F3F0; --card:#FFFFFF; --sheet:#F6F7F5; --bar:rgba(246,247,245,.86);
  --fill:#E5E8E3; --fill-2:#D6DBD4;
  --fg:#111512; --fg-2:#565E58; --fg-3:#858D87; --sep:rgba(17,21,18,.10);
  --accent:#1C6A54; --accent-fg:#FFFFFF; --accent-tint:#DAECE4;
  --tile-on:#FFFFFF; --tile-on-fg:#111512; --tile-on-sub:#565E58;
  --tile-off:#E2E6E0; --tile-off-fg:#2F3631; --tile-off-sub:#78807A;
  --ink-on-color:#FFFFFF; --knob:#FFFFFF;
  --c-light:#EDA000; --c-switch:#178A99; --c-cover:#5A7F9C; --c-heat:#E4572E; --c-tv:#5856D6; --c-appl:#178A99;
  --c-power:#D99A00; --c-gas:#2F6FDB; --c-water:#1590B0; --c-well:#0E8478; --c-wood:#9C5B24; --c-oil:#6B5741;
  --c-net:#6153D0; --c-sun:#EB6834;
  --ok:#1A7F45; --ok-bg:#DCF0E3; --warn:#8F5300; --warn-bg:#FBE7C2; --crit:#B9332E; --crit-bg:#F9DCD9; --muted-bg:#E5E8E3;
  --s1:#2a78d6; --s2:#eb6834; --grid:#E3E6E1; --axis:#C3C8C1; --cam-bg:#2D352F; --cam-ink:#FFFFFF;
  --shadow:0 1px 2px rgba(17,21,18,.05),0 3px 12px rgba(17,21,18,.06);
  --shadow-strong:0 6px 24px rgba(17,21,18,.16);
  --font-ui:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
  --font-num:ui-rounded,"SF Pro Rounded",-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",sans-serif;
  --r-tile:18px; --r-card:16px; --tabbar-h:58px;
  --top-inset:env(safe-area-inset-top,0px); --bottom-inset:env(safe-area-inset-bottom,0px);
  color:var(--fg);font-family:var(--font-ui);font-size:15px;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;
}
:host([dark]){
  --bg:#0D0F0E; --card:#1A1D1B; --sheet:#171A18; --bar:rgba(20,23,21,.86);
  --fill:#252926; --fill-2:#323732;
  --fg:#F1F3F0; --fg-2:#A9B1AB; --fg-3:#737B75; --sep:rgba(241,243,240,.10);
  --accent:#5BC3A0; --accent-fg:#06190F; --accent-tint:#163228;
  --tile-on:#ECEFEA; --tile-on-fg:#111512; --tile-on-sub:#545C56;
  --tile-off:#1E2220; --tile-off-fg:#DCE1DC; --tile-off-sub:#8A928C;
  --c-light:#FFB61C; --c-switch:#36B3C3; --c-cover:#82A8C6; --c-heat:#FF7A4D; --c-tv:#8B88F0; --c-appl:#36B3C3;
  --c-power:#F0B321; --c-gas:#6C9AF0; --c-water:#3BB5D5; --c-well:#33B1A3; --c-wood:#CF8A4B; --c-oil:#B49B7D;
  --c-net:#988DF0; --c-sun:#F07A45;
  --ok:#52CF85; --ok-bg:#15331F; --warn:#F3B640; --warn-bg:#3A2909; --crit:#FF6E66; --crit-bg:#3C1614; --muted-bg:#252926;
  --s1:#3987e5; --s2:#d95926; --grid:#262A27; --axis:#3B403C; --cam-bg:#1E2420;
  --shadow:none; --shadow-strong:0 8px 28px rgba(0,0,0,.5);
  color-scheme:dark;
}
*{box-sizing:border-box}
button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:left;-webkit-touch-callout:none}
button:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
h1,h2,h3,p{margin:0}
.i{--mdc-icon-size:24px;display:inline-flex;flex:none}
.app{position:absolute;inset:0;background:var(--bg);overflow:hidden;isolation:isolate}
.screen{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;padding-bottom:calc(var(--tabbar-h) + var(--bottom-inset) + 28px);scrollbar-width:none;-webkit-overflow-scrolling:touch}
.screen::-webkit-scrollbar{display:none}
.topscrim{position:absolute;top:0;left:0;right:0;height:var(--top-inset);background:var(--bar);-webkit-backdrop-filter:saturate(1.8) blur(18px);backdrop-filter:saturate(1.8) blur(18px);z-index:15;pointer-events:none;opacity:0;transition:opacity .2s}
.app.root.scrolled .topscrim{opacity:1}

.tabbar{position:absolute;left:0;right:0;bottom:0;z-index:20;height:calc(var(--tabbar-h) + var(--bottom-inset));padding:6px 4px var(--bottom-inset);background:var(--bar);-webkit-backdrop-filter:saturate(1.8) blur(20px);backdrop-filter:saturate(1.8) blur(20px);border-top:.5px solid var(--sep)}
.tabbar-in{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));max-width:560px;height:100%;margin:0 auto}
.tab{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--fg-3);font-size:10.5px;font-weight:600;letter-spacing:.01em;border-radius:12px}
.tab .i{--mdc-icon-size:26px}
.tab.active{color:var(--accent)}

.lt{display:flex;flex-direction:column;gap:6px;padding-top:calc(var(--top-inset) + 14px)}
.lt.pushed{padding-top:2px}
.lt-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:34px}
.lt-left{display:flex;align-items:center;gap:8px;min-width:0}
.menu{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;color:var(--fg-2);margin-left:-6px;flex:none}
.eyebrow{font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
h1{font-size:32px;line-height:1.1;font-weight:700;letter-spacing:-.02em;text-wrap:balance}
.site-btn{display:inline-flex;align-items:center;gap:3px;padding:6px 8px 6px 7px;border-radius:999px;background:var(--card);box-shadow:var(--shadow);font-size:14px;font-weight:600;max-width:60%;min-width:0;flex:none}
.site-btn span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.site-btn .i{--mdc-icon-size:18px;color:var(--accent)}
.site-btn .i.dim{color:var(--fg-3)}
.nav{position:sticky;top:0;z-index:10;padding:calc(var(--top-inset) + 4px) 8px 6px;transition:background .2s}
.nav-in{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;max-width:792px;margin:0 auto}
.app.scrolled .nav{background:var(--bar);-webkit-backdrop-filter:saturate(1.8) blur(18px);backdrop-filter:saturate(1.8) blur(18px);box-shadow:0 .5px 0 var(--sep)}
.back{display:inline-flex;align-items:center;gap:1px;color:var(--accent);font-size:16px;padding:6px 6px 6px 2px;justify-self:start;max-width:100%;min-width:0}
.back span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.back .i{--mdc-icon-size:24px}
.nav-title{font-size:16px;font-weight:600;opacity:0;transition:opacity .2s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px}
.app.scrolled .nav-title{opacity:1}

.view{padding-inline:16px;display:flex;flex-direction:column;gap:28px;max-width:792px;margin:0 auto;width:100%}
.anim-push{animation:pushIn .32s cubic-bezier(.2,.8,.2,1)}
.anim-pop{animation:popIn .28s cubic-bezier(.2,.8,.2,1)}
.anim-tab{animation:fadeIn .18s ease-out}
@keyframes pushIn{from{transform:translateX(36px);opacity:.35}to{transform:none;opacity:1}}
@keyframes popIn{from{transform:translateX(-24px);opacity:.5}to{transform:none;opacity:1}}
@keyframes fadeIn{from{opacity:.4}to{opacity:1}}
.sec{display:flex;flex-direction:column;gap:10px}
.sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
h2{font-size:20px;font-weight:700;letter-spacing:-.01em}
.link{color:var(--accent);font-size:15px;font-weight:500;white-space:nowrap}
.hint{font-size:13px;color:var(--fg-3);line-height:1.35}
.card{background:var(--card);border-radius:var(--r-card);box-shadow:var(--shadow)}
.empty{padding:18px 16px;font-size:14px;color:var(--fg-2);line-height:1.45}
.empty code,.hint code,.row-sub code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;background:var(--fill);padding:1px 5px;border-radius:5px;word-break:break-all}

.chips{display:flex;gap:8px;overflow-x:auto;margin-inline:-16px;padding:2px 16px 6px;scrollbar-width:none}
.chips::-webkit-scrollbar{display:none}
.chip{flex:none;display:flex;align-items:center;gap:9px;padding:8px 14px 8px 8px;border-radius:14px;background:var(--card);box-shadow:var(--shadow)}
.chip-ic{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--c);color:var(--ink-on-color)}
.chip-ic .i{--mdc-icon-size:18px}
.chip-txt{display:flex;flex-direction:column;line-height:1.2}
.chip-l{font-size:12px;color:var(--fg-2)}
.chip-v{font-size:14px;font-weight:600;white-space:nowrap}

.alerts{display:flex;flex-direction:column;gap:8px}
.alert{display:flex;align-items:center;gap:12px;padding:12px 12px 12px 14px;border-radius:var(--r-card);background:var(--card);box-shadow:var(--shadow)}
.alert-ic{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;flex:none}
.alert.warn .alert-ic{background:var(--warn-bg);color:var(--warn)}
.alert.ok .alert-ic{background:var(--ok-bg);color:var(--ok)}
.alert.crit .alert-ic{background:var(--crit-bg);color:var(--crit)}
.alert-ic .i{--mdc-icon-size:20px}
.alert-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.alert-txt strong{font-size:15px;font-weight:600}
.alert-txt span{font-size:13px;color:var(--fg-2)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 16px;border-radius:999px;background:var(--accent);color:var(--accent-fg);font-size:15px;font-weight:600;white-space:nowrap;transition:transform .12s;flex:none}
.btn:active{transform:scale(.96)}
.btn .i{--mdc-icon-size:20px}
.btn.sm{padding:7px 13px;font-size:14px}
.btn.ghost{background:var(--fill);color:var(--fg)}
.btn.wide{width:100%;padding:14px}
.btn[disabled]{opacity:.4;pointer-events:none}

.scenes{display:flex;gap:10px;overflow-x:auto;margin-inline:-16px;padding:2px 16px 6px;scrollbar-width:none}
.scenes::-webkit-scrollbar{display:none}
.scene{flex:none;width:152px;display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:var(--r-tile);background:var(--card);box-shadow:var(--shadow);transition:transform .12s}
.scene:active{transform:scale(.97)}
.scene .i{--mdc-icon-size:22px;color:var(--accent)}
.scene strong{font-size:15px;font-weight:600}
.scene span{font-size:12.5px;color:var(--fg-2);line-height:1.3}

.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.tile{display:flex;flex-direction:column;justify-content:space-between;gap:12px;min-height:106px;padding:12px;border-radius:var(--r-tile);background:var(--tile-off);color:var(--tile-off-fg);transition:background .2s,transform .12s,box-shadow .2s;user-select:none;-webkit-user-select:none;touch-action:manipulation;min-width:0}
.tile:active{transform:scale(.965)}
.tile.on{background:var(--tile-on);color:var(--tile-on-fg);box-shadow:var(--shadow)}
.tile.unav{opacity:.55}
.tile-ic{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:var(--fill-2);color:var(--tile-off-sub);transition:background .2s,color .2s}
.tile.on .tile-ic{background:var(--c);color:var(--ink-on-color)}
.tile-ic .i{--mdc-icon-size:21px}
.tile-txt{display:flex;flex-direction:column;gap:1px;min-width:0}
.tile-ctx{font-size:12px;color:var(--tile-off-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile-name{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile-sub{font-size:13px;color:var(--tile-off-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile.on .tile-ctx,.tile.on .tile-sub{color:var(--tile-on-sub)}

.runs{display:flex;flex-direction:column;gap:8px}
.run{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--r-card);background:var(--card);box-shadow:var(--shadow);width:100%}
.run-ic{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--c);color:var(--ink-on-color);flex:none}
.run-ic .i{--mdc-icon-size:22px}
.run-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.run-top{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.run-top strong{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.run-top span{font-size:14px;font-weight:600;color:var(--fg-2);font-variant-numeric:tabular-nums;white-space:nowrap}
.run-sub{font-size:13px;color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prog{height:6px;border-radius:3px;background:var(--fill);overflow:hidden;display:block}
.prog span{display:block;height:100%;border-radius:3px;background:var(--c-appl)}

.flow{display:flex;flex-direction:column;gap:12px;padding:14px;width:100%}
.flow-top{display:flex;justify-content:space-between;align-items:center}
.flow-t{font-size:13px;font-weight:600;color:var(--fg-2)}
.chev{color:var(--fg-3);--mdc-icon-size:20px}
.flow-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.node{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0}
.node-ic{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:var(--c);color:var(--ink-on-color)}
.node-ic .i{--mdc-icon-size:18px}
.node-v{font-family:var(--font-num);font-size:22px;font-weight:700;letter-spacing:-.01em;white-space:nowrap}
.node-l{font-size:12.5px;color:var(--fg-2)}
.flow-say{font-size:14px;line-height:1.4;color:var(--fg);padding-top:10px;border-top:.5px solid var(--sep)}
.ecard{display:flex;align-items:center;gap:12px;padding:14px;width:100%;font-size:14px;line-height:1.4;color:var(--fg-2)}

.sites{display:flex;flex-direction:column;gap:10px}
.scard{display:flex;align-items:center;gap:14px;padding:14px;border-radius:var(--r-card);background:var(--card);box-shadow:var(--shadow);width:100%}
.scard-ic{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--accent-tint);color:var(--accent);flex:none}
.scard-ic .i{--mdc-icon-size:26px}
.scard-ic.soft{background:var(--fill);color:var(--fg-2)}
.scard-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.scard-name{font-size:16px;font-weight:600}
.scard-role{font-size:13px;color:var(--fg-2)}
.scard-meta{font-size:13px;color:var(--fg)}
.sup-icons{display:flex;gap:4px;margin-top:4px;flex-wrap:wrap}
.sup-dot{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:var(--c);color:var(--ink-on-color)}
.sup-dot .i{--mdc-icon-size:14px}

.rtile{display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:var(--r-tile);background:var(--card);box-shadow:var(--shadow);min-width:0;transition:transform .12s}
.rtile:active{transform:scale(.97)}
.rtile-ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--fill);color:var(--fg-2)}
.rtile.lit .rtile-ic{background:var(--c-light);color:var(--ink-on-color)}
.rtile-ic .i{--mdc-icon-size:20px}
.rtile-name{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rtile-meta{font-size:13px;color:var(--fg-2);font-variant-numeric:tabular-nums}

.list{background:var(--card);border-radius:var(--r-card);overflow:hidden;box-shadow:var(--shadow)}
.row{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;min-height:56px;position:relative}
.row+.row::before{content:"";position:absolute;top:0;left:60px;right:0;border-top:.5px solid var(--sep)}
.row-ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:var(--c);color:var(--ink-on-color);flex:none}
.row-ic .i{--mdc-icon-size:20px}
.row-ic.lg{width:44px;height:44px;border-radius:13px}
.row-ic.lg .i{--mdc-icon-size:26px}
.row-ic.soft{background:var(--fill);color:var(--fg-2)}
.row-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.row-title{font-size:16px;font-weight:600;overflow-wrap:anywhere}
.row-sub{font-size:13px;color:var(--fg-2);line-height:1.35;overflow-wrap:anywhere}
.row-end{display:flex;flex-direction:column;align-items:flex-end;gap:4px;text-align:right;flex:none}
.row-val{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.row-val.dim{color:var(--fg-3);font-weight:500}
.kv{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;min-height:46px;position:relative;font-size:15px}
.kv+.kv::before{content:"";position:absolute;top:0;left:14px;right:0;border-top:.5px solid var(--sep)}
.kv>span{color:var(--fg-2);display:flex;align-items:center;gap:8px;min-width:0}
.kv>span .i{--mdc-icon-size:18px;color:var(--fg-3)}
.kv b{font-weight:600;font-variant-numeric:tabular-nums;text-align:right}
.kv b.dim{color:var(--fg-3);font-weight:500}

.pills{display:flex;gap:6px;flex-wrap:wrap}
.pill{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:3px 9px 3px 7px;border-radius:999px;white-space:nowrap}
.pill .i{--mdc-icon-size:14px}
.pill.ok{background:var(--ok-bg);color:var(--ok)}
.pill.warn{background:var(--warn-bg);color:var(--warn)}
.pill.crit{background:var(--crit-bg);color:var(--crit)}
.pill.muted{background:var(--muted-bg);color:var(--fg-2)}
.pill.accent{background:var(--accent-tint);color:var(--accent)}

.sup-head{display:flex;align-items:center;gap:12px}
.sup-head>div{display:flex;flex-direction:column;gap:4px;min-width:0}
.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.kpis.two{grid-template-columns:repeat(2,minmax(0,1fr))}
.kpis.one{grid-template-columns:minmax(0,1fr)}
.kpi{background:var(--card);border-radius:14px;padding:11px 12px;display:flex;flex-direction:column;gap:3px;box-shadow:var(--shadow);min-width:0}
.kpi-l{font-size:12px;color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi-v{font-family:var(--font-num);font-size:23px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lede{font-size:15px;line-height:1.45;color:var(--fg)}
.note{display:flex;gap:10px;align-items:flex-start;padding:13px 14px;border-radius:var(--r-card);background:var(--fill);font-size:14px;line-height:1.45;color:var(--fg)}
.note .i{--mdc-icon-size:20px;color:var(--fg-2)}

.chart-card{padding:12px 10px 8px 12px}
.legend{display:flex;gap:16px;font-size:13px;color:var(--fg-2);padding:0 0 6px 2px;flex-wrap:wrap}
.legend span{display:inline-flex;align-items:center;gap:6px}
.legend i{width:10px;height:10px;border-radius:3px;display:inline-block}
.legend b{color:var(--fg);font-weight:600;font-variant-numeric:tabular-nums}
.echart{position:relative}
.echart svg{display:block;width:100%;height:auto;touch-action:pan-y;overflow:visible}
.ax{fill:var(--fg-3);font-size:10px;font-family:var(--font-ui);font-variant-numeric:tabular-nums}
.gl{stroke:var(--grid);stroke-width:1}
.base{stroke:var(--axis);stroke-width:1}
.pv-area{fill:var(--s2);fill-opacity:.16}
.pv-line{fill:none;stroke:var(--s2);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.ld-line{fill:none;stroke:var(--s1);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.now-line{stroke:var(--fg-3);stroke-width:1;stroke-dasharray:3 3}
.dot{stroke:var(--card);stroke-width:2}
.dot.pv{fill:var(--s2)} .dot.ld{fill:var(--s1)}
.cross{stroke:var(--fg-2);stroke-width:1}
.tip{position:absolute;top:-6px;transform:translateX(-50%);background:var(--card);border:.5px solid var(--sep);box-shadow:var(--shadow-strong);border-radius:10px;padding:7px 10px;font-size:12px;line-height:1.5;pointer-events:none;white-space:nowrap;z-index:2}
.tip b{font-variant-numeric:tabular-nums}
.tip i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px}
.tip-t{color:var(--fg-2);font-weight:600}

.bars{display:flex;flex-direction:column;gap:12px;padding:14px}
.bar-row{display:grid;grid-template-columns:minmax(0,7.5em) minmax(0,1fr) 4.6em;align-items:center;gap:10px;font-size:14px}
.bar-l{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-track{height:10px;display:block}
.bar-fill{display:block;height:100%;background:var(--s1);border-radius:0 4px 4px 0;min-width:2px}
.bar-v{text-align:right;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.bar-v.dim{color:var(--fg-3);font-weight:500}

.season{padding:14px;display:flex;flex-direction:column;gap:12px}
.season-txt{display:flex;flex-direction:column;gap:2px}
.season-txt strong{font-size:16px}
.season-txt span{font-size:13px;color:var(--fg-2)}
.seg{display:grid;grid-auto-columns:minmax(0,1fr);grid-auto-flow:column;gap:2px;padding:2px;border-radius:11px;background:var(--fill)}
.seg button{display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 6px;border-radius:9px;font-size:14px;font-weight:600;color:var(--fg-2);transition:background .2s;min-width:0}
.seg button .i{--mdc-icon-size:18px}
.seg button.sel{background:var(--card);color:var(--fg);box-shadow:var(--shadow)}
.seg button[disabled]{cursor:default}

.ctile{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:var(--r-tile);background:var(--card);box-shadow:var(--shadow);min-width:0;transition:transform .12s}
.ctile:active{transform:scale(.97)}
.ctile-top{display:flex;flex-direction:column;gap:1px;min-width:0}
.ctile-room{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctile-site{font-size:12px;color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ctile-temp{font-family:var(--font-num);font-size:34px;font-weight:700;letter-spacing:-.02em;line-height:1}
.ctile-sub{display:flex;align-items:center;gap:4px;font-size:13px;color:var(--fg-2);font-weight:500;min-width:0}
.ctile-sub .i{--mdc-icon-size:16px}
.ctile.heating .ctile-sub{color:var(--c-heat)}
.wide-span{grid-column:1 / -1}

.statusbox{display:flex;align-items:center;gap:12px;padding:14px;border-radius:var(--r-card)}
.statusbox.ok{background:var(--ok-bg);color:var(--ok)}
.statusbox.warn{background:var(--warn-bg);color:var(--warn)}
.statusbox .i{--mdc-icon-size:28px}
.statusbox strong{font-size:16px;display:block}
.statusbox span{font-size:13px;opacity:.9}
.cams{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.cam{position:relative;aspect-ratio:16/10;max-width:100%;border-radius:14px;overflow:hidden;display:block;width:100%;color:var(--cam-ink);background:var(--cam-bg)}
.cam img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.cam-ph{position:absolute;inset:0;display:grid;place-items:center;opacity:.45}
.cam::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgba(0,0,0,.55))}
.cam-name{position:absolute;left:10px;bottom:8px;z-index:1;font-size:13px;font-weight:600}
.cam.big{aspect-ratio:16/9;border-radius:16px}

.toast{position:absolute;left:50%;bottom:calc(var(--tabbar-h) + var(--bottom-inset) + 12px);transform:translateX(-50%);z-index:30;background:var(--fg);color:var(--bg);font-size:14px;font-weight:600;padding:10px 16px;border-radius:999px;box-shadow:var(--shadow-strong);max-width:calc(100% - 32px);text-align:center;animation:toastIn .25s ease-out}
@keyframes toastIn{from{transform:translate(-50%,10px);opacity:0}to{transform:translate(-50%,0);opacity:1}}

.sheet-layer{position:absolute;inset:0;z-index:40}
.backdrop{position:absolute;inset:0;background:rgba(0,0,0,.34);opacity:0;transition:opacity .25s}
.sheet-layer.open .backdrop{opacity:1}
.sheet{position:absolute;left:0;right:0;bottom:0;max-width:600px;margin:0 auto;max-height:calc(100% - var(--top-inset) - 10px);overflow-y:auto;background:var(--sheet);border-radius:16px 16px 0 0;padding:6px 16px calc(22px + var(--bottom-inset));transform:translateY(100%);transition:transform .32s cubic-bezier(.2,.8,.2,1);display:flex;flex-direction:column;gap:18px;overscroll-behavior:contain}
.sheet-layer.open .sheet{transform:translateY(0)}
.grab{width:38px;height:5px;border-radius:3px;background:var(--fill-2);margin:2px auto 0;flex:none}
.sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;touch-action:none}
.sheet-head>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.sheet-eyebrow{font-size:13px;color:var(--fg-2)}
.sheet-head h3{font-size:22px;font-weight:700;letter-spacing:-.01em}
.x{width:32px;height:32px;border-radius:50%;background:var(--fill);display:grid;place-items:center;color:var(--fg-2);flex:none}
.x .i{--mdc-icon-size:20px}

.vwrap{display:flex;flex-direction:column;align-items:center;gap:12px;padding-top:4px}
.vslider{position:relative;width:118px;height:280px;border-radius:30px;background:var(--fill-2);overflow:hidden;touch-action:none;cursor:ns-resize}
.vfill{position:absolute;left:0;right:0;bottom:0;background:var(--c,var(--c-light));transition:height .08s}
.vslider .vicon{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);--mdc-icon-size:32px;color:var(--ink-on-color);z-index:1}
.vslider.off .vicon{color:var(--fg-3)}
.vval{font-family:var(--font-num);font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}
.btnrow{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:8px}

.therm{position:relative;width:240px;max-width:100%;margin:0 auto}
.therm svg{display:block;width:100%;height:auto}
.therm-track{fill:none;stroke:var(--fill-2);stroke-width:14;stroke-linecap:round}
.therm-val{fill:none;stroke:var(--c-heat);stroke-width:14;stroke-linecap:round;transition:all .2s}
.therm-val.idle{stroke:var(--accent)}
.therm-cur{fill:var(--card);stroke:var(--fg);stroke-width:2.5}
.therm-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding-top:6px}
.therm-state{font-size:13px;font-weight:600;color:var(--fg-2)}
.therm-state.heating{color:var(--c-heat)}
.therm-target{font-family:var(--font-num);font-size:54px;font-weight:700;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.therm-now{font-size:13px;color:var(--fg-2)}
.therm-ctrl{display:flex;justify-content:center;gap:40px;margin-top:-28px}
.round{width:56px;height:56px;border-radius:50%;background:var(--card);box-shadow:var(--shadow);display:grid;place-items:center;transition:transform .12s}
.round:active{transform:scale(.92)}
.round .i{--mdc-icon-size:28px}
.round.xl{width:84px;height:84px}
.round.xl .i{--mdc-icon-size:40px}
.round.on{background:var(--accent);color:var(--accent-fg)}
.round[disabled]{opacity:.35;pointer-events:none}
.center{display:flex;justify-content:center}
.vol{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px}
.vol-mid{display:flex;flex-direction:column;align-items:center}
.vol-l{font-size:13px;color:var(--fg-2)}
.vol-v{font-family:var(--font-num);font-size:28px;font-weight:700;font-variant-numeric:tabular-nums}
.vol .round{width:46px;height:46px;background:var(--fill);box-shadow:none}
.srcs{display:flex;flex-wrap:wrap;gap:8px}
.src{padding:9px 14px;border-radius:999px;background:var(--card);box-shadow:var(--shadow);font-size:14px;font-weight:600}
.src.sel{background:var(--accent);color:var(--accent-fg)}
.src[disabled]{opacity:.4;pointer-events:none}
.h4{font-size:15px;font-weight:600;color:var(--fg-2)}
.ring-wrap{position:relative;width:180px;margin:0 auto}
.ring-wrap svg{display:block;width:100%;height:auto}
.ring-bg{fill:none;stroke:var(--fill-2);stroke-width:12}
.ring-fg{fill:none;stroke:var(--c-appl);stroke-width:12;stroke-linecap:round}
.ring-mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ring-mid b{font-family:var(--font-num);font-size:38px;font-weight:700;line-height:1}
.ring-mid span{font-size:13px;color:var(--fg-2)}
.done-ic{width:84px;height:84px;border-radius:50%;display:grid;place-items:center;background:var(--ok-bg);color:var(--ok);margin:4px auto 0}
.done-ic .i{--mdc-icon-size:44px}
.switch{width:51px;height:31px;border-radius:999px;background:var(--fill-2);position:relative;flex:none;transition:background .2s}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:var(--knob);box-shadow:0 2px 4px rgba(0,0,0,.22);transition:transform .2s}
.switch.on{background:var(--accent)}
.switch.on::after{transform:translateX(20px)}
.ha-link{display:flex;align-items:center;justify-content:center;gap:6px;color:var(--accent);font-size:15px;font-weight:500;padding:6px}
.ha-link .i{--mdc-icon-size:18px}
.issue{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;position:relative;font-size:14px;line-height:1.4}
.issue+.issue::before{content:"";position:absolute;top:0;left:44px;right:0;border-top:.5px solid var(--sep)}
.issue .i{--mdc-icon-size:20px;margin-top:-1px}
.issue.error .i{color:var(--crit)} .issue.warn .i{color:var(--warn)} .issue.info .i{color:var(--fg-3)}
@media (prefers-reduced-motion: reduce){ *,*::before,*::after{animation:none!important;transition:none!important} }
`;

/* ---------- Panel ---------- */
class MultisitePanel extends HTMLElement {
  constructor(){
    super();
    this._root = this.attachShadow({mode: 'open'});
    this._root.innerHTML = `<style>${CSS}</style><div class="app root" id="app"><div class="screen" id="screen"></div><div class="topscrim" aria-hidden="true"></div><nav class="tabbar" id="tabbar" aria-label="Bereiche"></nav><div class="toast" id="toast" role="status" aria-live="polite" hidden></div><div class="sheet-layer" id="layer" hidden><div class="backdrop" data-act="sheet-close"></div><section class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle"></section></div></div>`;
    const $ = id => this._root.getElementById(id);
    this.$app = $('app'); this.$screen = $('screen'); this.$tabbar = $('tabbar'); this.$toast = $('toast'); this.$layer = $('layer'); this.$sheet = $('sheet');
    this._st = {tab: 'start', site: 'alle', stacks: {start: [], orte: [], heizung: [], versorgung: [], sicherheit: []}, rootScroll: {}, anim: null, sheet: null};
    this._opt = new Map(); this._prev = {}; this._hist = {}; this._log = null; this._camUrl = {};
    this._lastRender = 0; this._lastScroll = 0;
    this._bind();
  }

  /* Von Home Assistant gesetzt */
  set panel(p){ this._panel = p; this._cfg = normConfig(p && p.config); this._index = null; this._queue(); }
  get panel(){ return this._panel; }
  set narrow(n){ if (this._narrow !== n){ this._narrow = n; this._queue(); } }
  get narrow(){ return this._narrow; }
  set route(r){ this._route = r; }
  get route(){ return this._route; }
  set hass(h){
    const first = !this._hass;
    this._hass = h;
    if (!this._cfg) this._cfg = normConfig(this._panel && this._panel.config);
    if (first){ const saved = lsGet(this._lsKey('site')); if (saved) this._st.site = saved; }
    if (!h.floors && !this._floorsReq && h.callWS){
      // Ältere Frontends liefern die Etagen nicht im hass-Objekt mit
      this._floorsReq = true;
      h.callWS({type: 'config/floor_registry/list'}).then(list => { this._floorsWS = Object.fromEntries(arr(list).map(f => [f.floor_id, f])); this._index = null; this._queue(); }).catch(() => {});
    }
    const regs = [h.areas, h.floors, h.entities, h.devices];
    if (!this._regs || regs.some((r, i) => r !== this._regs[i])){ this._regs = regs; this._index = null; this._queue(); return; }
    const dark = !!(h.themes && h.themes.darkMode);
    if (dark !== this.hasAttribute('dark')){ this._queue(); return; }
    if (!this._index){ this._queue(); return; }
    for (const eid of this._index.relevant){ if (h.states[eid] !== this._prev[eid]){ this._queue(); return; } }
  }
  get hass(){ return this._hass; }

  connectedCallback(){
    this._tick = setInterval(() => this._queue(), 30000);
    this._camTick = setInterval(() => this._refreshCams(), 2500);
    this._camN = 0;
  }
  disconnectedCallback(){ clearInterval(this._tick); clearInterval(this._camTick); }

  /* ---------- Rendern ---------- */
  /* Gebündeltes Neuzeichnen: höchstens alle 500 ms, nicht während Scrollen oder Antippen.
     Bewusst setTimeout statt requestAnimationFrame, damit nichts hängen bleibt, wenn der Browser keine Frames liefert. */
  _queue(){
    if (this._wait) return;
    const now = Date.now();
    const delay = this._busy ? 300 : Math.max(16, 300 - (now - this._lastScroll), 500 - (now - this._lastRender));
    this._wait = setTimeout(() => {
      this._wait = null;
      const t = Date.now();
      if (this._busy || t - this._lastScroll < 300){ this._queue(); return; }
      this._render();
    }, delay);
  }
  _lsKey(k){ const u = this._hass && this._hass.user; return `msp-${k}-${u ? u.id : 'x'}`; }
  _render(){
    const h = this._hass;
    if (!h || !this._cfg) return;
    this._lastRender = Date.now();
    this.toggleAttribute('dark', !!(h.themes && h.themes.darkMode));
    if (!this._index) this._index = this._buildIndex();
    this._sites = this._allowedSites();
    const st = this._st;
    if (this._sites.length === 1) st.site = this._sites[0].id;
    else if (st.site !== 'alle' && !this._sites.some(s => s.id === st.site)) st.site = 'alle';
    if (!this._cfg.sites.length){
      this.$tabbar.hidden = true;
      this.$screen.innerHTML = `<div class="view">${this._rootHeader('Noch nicht eingerichtet', 'Multi-Site Panel', {noSite: true})}<div class="card empty">In der Konfiguration ist noch kein Standort angelegt. Trage unter <code>panel_custom → config</code> mindestens einen Eintrag bei <code>standorte</code> ein und starte Home Assistant neu. Ein Beispiel liegt im Repository unter <code>beispiel/multisite-panel.yaml</code>.</div></div>`;
      return;
    }
    this.$tabbar.hidden = false;
    const stack = st.stacks[st.tab], top = stack[stack.length - 1];
    let out;
    try { out = top ? this._page(top) : this._rootPage(st.tab); }
    catch (e){ console.error('[multisite-panel]', e); out = {nav: top ? this._navBar('Fehler') : '', body: `<div class="card empty">Diese Seite konnte nicht angezeigt werden: ${esc(e.message)}</div>`}; }
    this.$screen.innerHTML = (out.nav || '') + `<div class="view ${st.anim ? 'anim-' + st.anim : ''}">${out.body}</div>`;
    this.$app.classList.toggle('root', !top);
    st.anim = null;
    this._renderTabbar();
    if (st.sheet && !this._dragging) this._renderSheet();
    this._bindCharts();
    for (const eid of this._index.relevant) this._prev[eid] = h.states[eid];
    this._onScroll();
    if (out.after) out.after();
  }
  _renderTabbar(){
    this.$tabbar.innerHTML = `<div class="tabbar-in">${TABS.map(t => { const a = this._st.tab === t.id; return `<button class="tab ${a ? 'active' : ''}" data-act="tab" data-tab="${t.id}" aria-current="${a ? 'page' : 'false'}">${ic(a ? t.iconOn : t.icon)}<span>${t.label}</span></button>`; }).join('')}</div>`;
  }
  _rootPage(tab){ return {start: () => this._pStart(), orte: () => this._pOrte(), heizung: () => this._pHeizung(), versorgung: () => this._pVersorgung(), sicherheit: () => this._pSicherheit()}[tab](); }
  _page(e){
    switch (e.page){
      case 'site': return this._pSite(e.id);
      case 'room': return this._pRoom(e.id);
      case 'supply': return this._pSupply(e.id);
      case 'unassigned': return this._pUnassigned();
      case 'check': return this._pCheck();
      default: return this._rootPage(this._st.tab);
    }
  }

  /* ---------- Index aus den Registern von Home Assistant ---------- */
  _buildIndex(){
    const h = this._hass, cfg = this._cfg;
    const floors = this._floors(), areas = h.areas || {}, ents = h.entities || {}, devs = h.devices || {};
    const issues = [], relevant = new Set();
    const findFloor = ref => floors[ref] || Object.values(floors).find(f => lc(f.name) === lc(ref));
    const findArea = ref => areas[ref] || Object.values(areas).find(a => lc(a.name) === lc(ref));
    const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'de');
    const areaSite = {}, groups = {}, usedFloors = new Set();
    if (!cfg.sites.length) issues.push({level: 'error', text: 'Kein Standort in der Konfiguration (standorte:).'});
    for (const s of cfg.sites){
      const g = [];
      for (const f of s.floors){
        const fl = findFloor(f.ref);
        if (!fl){ issues.push({level: 'warn', text: `Etage „${f.ref}“ (Standort ${s.short}) gibt es in Home Assistant nicht.`}); continue; }
        usedFloors.add(fl.floor_id);
        const list = Object.values(areas).filter(a => a.floor_id === fl.floor_id).sort(byName).map(a => a.area_id);
        list.forEach(a => { if (!areaSite[a]) areaSite[a] = s.id; });
        g.push({name: f.name || fl.name, areas: list});
      }
      const extra = [];
      for (const ref of s.areas){
        const a = findArea(ref);
        if (!a){ issues.push({level: 'warn', text: `Raum „${ref}“ (Standort ${s.short}) gibt es in Home Assistant nicht.`}); continue; }
        if (!areaSite[a.area_id]) areaSite[a.area_id] = s.id;
        extra.push(a.area_id);
      }
      if (extra.length) g.push({name: s.extraName, areas: extra});
      groups[s.id] = g;
      if (!g.some(x => x.areas.length)) issues.push({level: 'info', text: `${s.short} hat noch keine Räume. Lege in Home Assistant Etagen und Räume an und trage die Etagen hier ein.`});
    }
    Object.values(floors).filter(f => !usedFloors.has(f.floor_id)).forEach(f => issues.push({level: 'info', text: `Etage „${f.name}“ (ID ${f.floor_id}) ist keinem Standort zugeordnet.`}));
    Object.values(areas).filter(a => !areaSite[a.area_id]).forEach(a => issues.push({level: 'info', text: `Raum „${a.name}“ (ID ${a.area_id}) gehört zu keinem Standort${a.floor_id ? '' : ' und hat keine Etage'}.`}));

    // Entitäten aus der Konfiguration
    const refs = [];
    const add = (eid, where) => { if (!eid) return; refs.push([eid, where]); relevant.add(eid); };
    add(cfg.weather, 'wetter'); add(cfg.outside, 'aussentemperatur'); add(cfg.season && cfg.season.entity, 'heizsaison');
    cfg.scenes.forEach(s => add(s.entity, `Szene ${s.name}`));
    cfg.supplies.forEach(s => {
      SUPPLY_KEYS.forEach(k => add(s[k], `${s.name} → ${k}`));
      s.versorgt.forEach(v => { add(v.leistung, `${s.name} → versorgt ${v.name}`); add(v.energie_heute, `${s.name} → versorgt ${v.name}`); });
      s.werte.forEach(w => add(w && w.entity, `${s.name} → werte`));
    });
    cfg.appliances.forEach(a => ['status', 'power', 'remain', 'program', 'progress', 'notify'].forEach(k => add(a[k], `${a.name} → ${k}`)));
    cfg.access.forEach(a => { add(a.entity, 'zugang'); add(a.status, 'zugang → status'); });
    cfg.cameras.forEach(c => add(c.entity, 'kameras'));
    cfg.events.forEach(e => add(e, 'ereignisse'));
    cfg.favs.forEach(e => add(e, 'favoriten'));
    for (const [eid, where] of refs) if (!h.states[eid]) issues.push({level: 'warn', text: `Die Entität ${eid} gibt es nicht (${where}).`});
    for (const s of [...cfg.scenes, ...cfg.access, ...cfg.cameras, ...cfg.appliances]){
      const site = s.site;
      if (site && !cfg.sites.some(x => x.id === site)) issues.push({level: 'warn', text: `Standort „${site}“ ist nicht angelegt (bei ${s.name || s.entity}).`});
    }

    const special = new Set([...cfg.hidden]);
    cfg.appliances.forEach(a => ['status', 'power', 'remain', 'program', 'progress', 'notify'].forEach(k => a[k] && special.add(a[k])));
    cfg.access.forEach(a => { special.add(a.entity); if (a.status) special.add(a.status); });
    cfg.cameras.forEach(c => special.add(c.entity));

    const empty = () => ({light: [], switch: [], cover: [], climate: [], media: [], temp: [], hum: [], gate: [], lock: [], camera: []});
    const byArea = {}, entArea = {}, entSite = {}, unassigned = [];
    const areaOf = eid => { const r = ents[eid]; if (!r) return null; return r.area_id || (r.device_id && devs[r.device_id] ? devs[r.device_id].area_id : null) || null; };
    for (const eid of Object.keys(h.states)){
      const dom = domainOf(eid);
      if (!CLASS_DOMAINS.has(dom)) continue;
      const reg = ents[eid];
      if (reg && (reg.hidden || reg.entity_category)) continue;
      const area = areaOf(eid);
      if (area){ entArea[eid] = area; if (areaSite[area]) entSite[eid] = areaSite[area]; }
      if (special.has(eid)) continue;
      const kind = classify(dom, h.states[eid]);
      if (!kind) continue;
      if (area && areaSite[area]){ (byArea[area] || (byArea[area] = empty()))[kind].push(eid); relevant.add(eid); }
      else if (UNASSIGNED_KINDS.includes(kind)) unassigned.push(eid);
    }
    // Areas der Konfig-Entitäten (Geräte, Zugang, Kameras) für die Standortzuordnung
    for (const [eid] of refs){ const a = areaOf(eid); if (a){ entArea[eid] = a; if (areaSite[a]) entSite[eid] = areaSite[a]; } }
    const nameOf = eid => (h.states[eid] && h.states[eid].attributes.friendly_name) || eid;
    const sortN = (a, b) => nameOf(a).localeCompare(nameOf(b), 'de');
    Object.values(byArea).forEach(b => Object.values(b).forEach(l => l.sort(sortN)));
    unassigned.sort(sortN);

    const favs = new Set(cfg.favs.filter(e => h.states[e]));
    if (cfg.favLabel) for (const eid in ents){ const r = ents[eid]; if (r.labels && r.labels.some(l => lc(l) === cfg.favLabel) && h.states[eid]) favs.add(eid); }
    favs.forEach(e => relevant.add(e));

    const appls = cfg.appliances.map(a => {
      const ar = a.area ? findArea(a.area) : null;
      const areaId = ar ? ar.area_id : (entArea[a.status] || entArea[a.power] || null);
      if (a.area && !ar) issues.push({level: 'warn', text: `Raum „${a.area}“ bei ${a.name} gibt es nicht.`});
      return {...a, areaId, siteId: a.site || (areaId && areaSite[areaId]) || null};
    });

    return {areaSite, groups, byArea, entArea, entSite, unassigned, favs: [...favs], appls, issues, relevant};
  }

  /* ---------- Zugriff ---------- */
  _floors(){ return this._hass.floors || this._floorsWS || {}; }
  _allowedSites(){
    const u = this._hass.user || {};
    const rule = this._cfg.users.find(r => (r.id && r.id === u.id) || (r.name && lc(r.name) === lc(u.name)));
    return rule ? this._cfg.sites.filter(s => rule.sites.includes(s.id)) : this._cfg.sites;
  }
  _site(id){ return this._cfg.sites.find(s => s.id === id); }
  _siteMatch(id){ return this._st.site === 'alle' ? this._sites.some(s => s.id === id) : this._st.site === id; }
  _areasOfSite(id){ const out = new Set(); (this._index.groups[id] || []).forEach(g => g.areas.forEach(a => out.add(a))); return [...out]; }
  _ents(kind, siteId = null){
    const out = new Set();
    for (const s of this._sites){
      if (siteId ? s.id !== siteId : !this._siteMatch(s.id)) continue;
      for (const a of this._areasOfSite(s.id)){ const b = this._index.byArea[a]; if (b) b[kind].forEach(e => out.add(e)); }
    }
    return [...out];
  }
  _areaName(aid){ const a = this._hass.areas && this._hass.areas[aid]; return a ? a.name : ''; }
  _areaIcon(aid){ const a = this._hass.areas && this._hass.areas[aid]; if (a && a.icon) return a.icon; const n = a ? a.name : ''; const m = ROOM_ICONS.find(([re]) => re.test(n)); return m ? m[1] : 'mdi:door'; }
  _groupOf(aid){ const s = this._index.areaSite[aid]; const g = (this._index.groups[s] || []).find(x => x.areas.includes(aid)); return g ? g.name : ''; }
  _name(eid, ctxName){
    const st = this._hass.states[eid];
    let n = (st && st.attributes.friendly_name) || eid;
    if (ctxName && lc(n).startsWith(lc(ctxName) + ' ')) n = n.slice(ctxName.length + 1);
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  _entIcon(eid){ const st = this._hass.states[eid]; const r = this._hass.entities && this._hass.entities[eid]; return (st && st.attributes.icon) || (r && r.icon) || null; }
  _isOn(eid){
    const st = this._hass.states[eid]; if (!st) return false;
    const dom = domainOf(eid); let real;
    if (dom === 'media_player') real = !['off', 'standby', 'unavailable', 'unknown'].includes(st.state);
    else if (dom === 'cover') real = !['closed', 'unavailable', 'unknown'].includes(st.state);
    else real = st.state === 'on';
    const o = this._opt.get(eid);
    if (o && o.on != null){ if (Date.now() < o.until && o.on !== real) return o.on; o.on = null; }
    return real;
  }
  _bri(eid){
    const o = this._opt.get(eid); if (o && o.bri != null && Date.now() < o.until) return o.bri;
    const st = this._hass.states[eid]; const b = st && st.attributes.brightness;
    return b == null ? null : Math.max(1, Math.round(b / 255 * 100));
  }
  _dimmable(eid){ const st = this._hass.states[eid]; const m = st && st.attributes.supported_color_modes; return !!(st && (st.attributes.brightness != null || (m && m.some(x => x !== 'onoff')))); }
  _setOpt(eid, patch){ this._opt.set(eid, {...(this._opt.get(eid) || {}), ...patch, until: Date.now() + 4000}); }
  _climate(eid){
    const st = this._hass.states[eid]; if (!st) return null;
    const a = st.attributes, o = this._opt.get(eid);
    const target = o && o.target != null && Date.now() < o.until ? o.target : num(a.temperature);
    const cur = num(a.current_temperature);
    const action = a.hvac_action;
    const off = st.state === 'off';
    const heating = action ? action === 'heating' : (!off && cur != null && target != null && cur < target - 0.2);
    return {st, cur, target, mode: st.state, action, off, heating, eco: lc(a.preset_mode) === 'eco', presets: a.preset_modes || [], modes: a.hvac_modes || [], min: num(a.min_temp) ?? 5, max: num(a.max_temp) ?? 30, step: num(a.target_temp_step) ?? 0.5, unav: st.state === 'unavailable'};
  }
  _climText(c){
    if (c.unav) return 'Nicht erreichbar';
    if (c.off) return 'Aus';
    if (c.heating) return c.target != null ? `Heizt auf ${f1(c.target)}°` : 'Heizt';
    if (c.eco) return c.target != null ? `Eco · ${f1(c.target)}°` : 'Eco';
    if (c.target == null) return c.mode === 'auto' ? 'Automatik' : 'Bereit';
    return `Hält ${f1(c.target)}°`;
  }
  _roomTemp(aid){
    const b = this._index.byArea[aid]; if (!b) return null;
    for (const c of b.climate){ const v = this._climate(c); if (v && v.cur != null) return v.cur; }
    for (const t of b.temp){ const v = num(this._hass.states[t] && this._hass.states[t].state); if (v != null) return v; }
    return null;
  }
  _roomHum(aid){ const b = this._index.byArea[aid]; if (!b) return null; for (const t of b.hum){ const v = num(this._hass.states[t] && this._hass.states[t].state); if (v != null) return v; } return null; }
  _avgTemp(siteId){
    const v = this._areasOfSite(siteId).filter(a => !/garten|hof|außen|aussen|terrasse/i.test(this._areaName(a))).map(a => this._roomTemp(a)).filter(x => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  _lightsOn(siteId = null){ return this._ents('light', siteId).filter(e => this._isOn(e)); }
  _outside(){
    const h = this._hass; const w = this._cfg.weather && h.states[this._cfg.weather];
    let t = this._cfg.outside ? num(h.states[this._cfg.outside] && h.states[this._cfg.outside].state) : null;
    if (t == null && w) t = num(w.attributes.temperature);
    const cond = w ? WEATHER[w.state] : null;
    if (t == null && !cond) return null;
    return {t, label: cond ? cond[0] : '', icon: cond ? cond[1] : 'mdi:thermometer'};
  }
  _season(){
    const s = this._cfg.season; const st = s && s.entity && this._hass.states[s.entity];
    if (st){ const v = lc(st.state); if (v.includes('winter')) return 'winter'; if (v.includes('sommer') || v.includes('summer')) return 'sommer'; }
    const m = new Date().getMonth();
    return (m >= 9 || m <= 3) ? 'winter' : 'sommer';
  }
  _seasonActive(s){ return !s.saison || lc(s.saison) === this._season(); }

  /* Geräte (Waschmaschine & Co.) */
  _appl(a){
    const h = this._hass;
    const st = a.status && h.states[a.status], pw = a.power && h.states[a.power];
    let state = 'idle';
    if (st){
      const s = lc(st.state);
      if ((a.run.length ? a.run : RUN).includes(s)) state = 'run';
      else if ((a.done.length ? a.done : DONE).includes(s)) state = 'done';
      else if (s === 'unavailable') state = 'unav';
    }
    if ((state === 'idle' || state === 'unav') && pw){ const k = powerKW(pw); if (k != null) state = k * 1000 > a.threshold ? 'run' : 'idle'; }
    let remain = null; const rs = a.remain && h.states[a.remain];
    if (rs && state === 'run'){
      const v = rs.state;
      if (rs.attributes.device_class === 'timestamp' || /^\d{4}-\d\d-\d\dT/.test(v)){ const t = Date.parse(v); if (!isNaN(t)) remain = Math.max(0, Math.round((t - Date.now()) / 60000)); }
      else { const n = num(v), u = rs.attributes.unit_of_measurement; if (n != null) remain = Math.round(u === 'h' ? n * 60 : u === 's' ? n / 60 : n); }
    }
    let progress = null; const ps = a.progress && h.states[a.progress];
    if (ps){ const n = num(ps.state); if (n != null) progress = Math.max(0, Math.min(1, n / 100)); }
    const pr = a.program && h.states[a.program];
    const program = pr && !['unknown', 'unavailable', ''].includes(pr.state) ? (h.formatEntityState ? h.formatEntityState(pr) : pr.state) : null;
    const since = st ? st.last_changed : (pw ? pw.last_changed : null);
    const dismissed = state === 'done' && lsGet(`msp-done-${a.id}`) === since;
    const nt = a.notify && h.states[a.notify];
    return {state, remain, progress, program, since, dismissed, notify: nt ? nt.state === 'on' : null};
  }
  _applsInFilter(){ return this._index.appls.filter(a => a.siteId ? this._siteMatch(a.siteId) : this._st.site === 'alle'); }

  /* Ohne siteId gilt der Standortfilter, mit siteId nur dieser Standort. */
  _matcher(siteId){ return id => id ? (siteId ? id === siteId : this._siteMatch(id)) : (!siteId && this._st.site === 'alle'); }

  /* Zugang (Türen, Tore, Schlösser) */
  _access(siteId = null){
    const h = this._hass, out = [], seen = new Set(), match = this._matcher(siteId);
    for (const a of this._cfg.access){
      const st = h.states[a.entity]; if (!st) continue;
      const site = a.site || this._index.entSite[a.entity] || null;
      if (!match(site)) continue;
      out.push(this._accessModel(a.entity, a, site)); seen.add(a.entity);
    }
    for (const s of this._sites){
      if (!match(s.id)) continue;
      for (const kind of ['gate', 'lock']) this._ents(kind, s.id).forEach(e => { if (!seen.has(e)){ seen.add(e); out.push(this._accessModel(e, {}, s.id)); } });
    }
    return out;
  }
  _accessModel(eid, conf, site){
    const h = this._hass, st = h.states[eid], dom = domainOf(eid);
    const name = conf.name || st.attributes.friendly_name || eid;
    let open = false, label = st.state, action = null;
    const kind = conf.art || (dom === 'cover' ? 'tor' : 'tuer');
    if (dom === 'cover'){
      open = !['closed', 'unavailable', 'unknown'].includes(st.state);
      label = {open: 'Offen', opening: 'Öffnet …', closing: 'Schließt …', closed: 'Geschlossen'}[st.state] || st.state;
      action = open ? {label: 'Schließen', svc: ['cover', 'close_cover']} : {label: 'Öffnen', svc: ['cover', 'open_cover']};
    } else if (dom === 'lock'){
      open = ['unlocked', 'open', 'opening', 'unlocking'].includes(st.state);
      label = {locked: 'Verriegelt', unlocked: 'Entriegelt', open: 'Offen', opening: 'Öffnet …', locking: 'Verriegelt …', unlocking: 'Entriegelt …', jammed: 'Blockiert'}[st.state] || st.state;
      action = open ? {label: 'Abschließen', svc: ['lock', 'lock']} : {label: 'Öffnen', svc: ['lock', 'unlock']};
    } else if (dom === 'button'){
      const ss = conf.status && h.states[conf.status];
      open = ss ? ss.state === 'on' : false;
      label = ss ? (open ? 'Offen' : 'Geschlossen') : '';
      action = {label: 'Öffnen', svc: ['button', 'press']};
    } else if (dom === 'switch' || dom === 'input_boolean'){
      open = st.state === 'on'; label = open ? 'Offen' : 'Geschlossen';
      action = {label: open ? 'Schließen' : 'Öffnen', svc: [dom, 'toggle']};
    } else if (dom === 'binary_sensor'){
      open = st.state === 'on'; label = open ? 'Offen' : 'Geschlossen';
    }
    const since = (conf.status && h.states[conf.status] && h.states[conf.status].last_changed) || st.last_changed;
    return {eid, dom, name, site, open, label, action, kind, since, unav: st.state === 'unavailable'};
  }
  _cams(siteId = null){
    const h = this._hass, out = [], seen = new Set(), match = this._matcher(siteId);
    for (const c of this._cfg.cameras){
      if (!h.states[c.entity]) continue;
      const site = c.site || this._index.entSite[c.entity] || null;
      if (!match(site)) continue;
      out.push({eid: c.entity, name: c.name || h.states[c.entity].attributes.friendly_name || c.entity, site}); seen.add(c.entity);
    }
    for (const s of this._sites){ if (!match(s.id)) continue; this._ents('camera', s.id).forEach(e => { if (!seen.has(e)){ seen.add(e); out.push({eid: e, name: this._name(e), site: s.id}); } }); }
    return out;
  }

  /* Versorgung */
  _supplies(){ return this._cfg.supplies.filter(s => this._st.site === 'alle' ? (s.sites.length === 0 || s.sites.some(id => this._sites.some(x => x.id === id))) : s.sites.includes(this._st.site)); }
  _supply(id){ return this._cfg.supplies.find(s => s.id === id); }
  _messung(s){
    if (s.messung && MESSUNG[s.messung]) return MESSUNG[s.messung];
    return SUPPLY_KEYS.some(k => s[k]) ? MESSUNG.voll : MESSUNG.keine;
  }
  _now(s){
    const h = this._hass, g = k => s[k] && h.states[s[k]];
    const solar = powerKW(g('solar'));
    let grid = powerKW(g('netz')); if (grid != null && s.netz_umkehren) grid = -grid;
    let load = powerKW(g('leistung'));
    if (load == null && grid != null && solar != null) load = grid + solar;
    if (grid == null && load != null && solar != null) grid = load - solar;
    return {solar, grid, load};
  }
  _statusText(st){
    if (!st) return '—';
    if (domainOf(st.entity_id) === 'binary_sensor' && st.attributes.device_class === 'connectivity') return st.state === 'on' ? 'Online' : 'Offline';
    return this._hass.formatEntityState ? this._hass.formatEntityState(st) : `${st.state}${st.attributes.unit_of_measurement ? ' ' + st.attributes.unit_of_measurement : ''}`;
  }
  _supplyVal(s){
    const h = this._hass, n = this._now(s);
    if (n.load != null) return fmtPower(n.load);
    const vh = energyKWh(s.verbrauch_heute && h.states[s.verbrauch_heute]);
    if (vh != null) return `${fmtEnergy(vh)} heute`;
    if (s.status && h.states[s.status]) return this._statusText(h.states[s.status]);
    if (s.saison) return this._seasonActive(s) ? 'Aktiv' : 'Pause';
    return '—';
  }
  _supplySub(s){
    if (s.beschreibung) return s.beschreibung;
    const tags = s.sites.map(id => this._site(id)).filter(Boolean).map(x => x.tag);
    const parts = [];
    if (s.ort) parts.push(s.ort);
    if (tags.length) parts.push(tags.length > 3 ? `versorgt ${tags.length} Standorte` : `versorgt ${tags.join(', ')}`);
    return parts.join(' · ');
  }

  /* ---------- Bausteine ---------- */
  _siteBtn(){
    if (this._sites.length <= 1) return '';
    const label = this._st.site === 'alle' ? 'Alle Standorte' : (this._site(this._st.site) || {}).short;
    return `<button class="site-btn" data-act="site-sheet" aria-haspopup="dialog">${ic('mdi:map-marker')}<span>${esc(label)}</span>${ic('mdi:chevron-down', 'dim')}</button>`;
  }
  _rootHeader(title, eyebrow, opts = {}){
    const menu = this._narrow && this._cfg.menuButton ? `<button class="menu" data-act="menu" aria-label="Home-Assistant-Menü öffnen">${ic('mdi:menu')}</button>` : '';
    return `<header class="lt"><div class="lt-row"><span class="lt-left">${menu}<span class="eyebrow">${esc(eyebrow)}</span></span>${opts.noSite ? '' : this._siteBtn()}</div><h1>${esc(title)}</h1></header>`;
  }
  _pushedHeader(title, eyebrow){ return `<header class="lt pushed"><span class="eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1></header>`; }
  _pageTitle(e){
    if (!e) return TABS.find(t => t.id === this._st.tab).label;
    if (e.page === 'site') return (this._site(e.id) || {}).short || 'Standort';
    if (e.page === 'room') return this._areaName(e.id) || 'Raum';
    if (e.page === 'supply') return (this._supply(e.id) || {}).name || 'Anschluss';
    if (e.page === 'unassigned') return 'Nicht zugeordnet';
    if (e.page === 'check') return 'Einrichtung';
    return '';
  }
  _navBar(title){
    const st = this._st.stacks[this._st.tab];
    const prev = this._pageTitle(st[st.length - 2]);
    return `<div class="nav"><div class="nav-in"><button class="back" data-act="back" aria-label="Zurück zu ${esc(prev)}">${ic('mdi:chevron-left')}<span>${esc(prev)}</span></button><span class="nav-title">${esc(title)}</span><span></span></div></div>`;
  }
  _sec(title, inner, right = ''){ return `<section class="sec"><div class="sec-head"><h2>${esc(title)}</h2>${right}</div>${inner}</section>`; }
  _grid(items, fn){ return items.length ? `<div class="tiles">${items.map(fn).join('')}</div>` : ''; }
  _pill(m){ return `<span class="pill ${m.cls}">${ic(m.icon)}${esc(m.label)}</span>`; }
  _kpi(label, value){ return `<div class="kpi"><span class="kpi-l">${esc(label)}</span><span class="kpi-v">${esc(value)}</span></div>`; }
  _kvList(rows){ return `<div class="list">${rows.map(r => `<div class="kv"><span>${r.icon ? ic(r.icon) : ''}${esc(r.label)}</span><b class="${r.dim ? 'dim' : ''}">${esc(r.value)}</b></div>`).join('')}</div>`; }
  _note(text, icon = 'mdi:information-outline'){ return `<div class="note">${ic(icon)}<p>${esc(text)}</p></div>`; }

  _tile(eid, opts = {}){
    const h = this._hass, st = h.states[eid]; if (!st) return '';
    const dom = domainOf(eid), unav = st.state === 'unavailable', on = !unav && this._isOn(eid);
    const aid = this._index.entArea[eid], aName = aid ? this._areaName(aid) : '';
    let icon, color, sub;
    if (dom === 'light'){ icon = this._entIcon(eid) || (on ? 'mdi:lightbulb' : 'mdi:lightbulb-outline'); color = '--c-light'; const b = this._bri(eid); sub = on ? (b != null ? `${b} %` : 'An') : 'Aus'; }
    else if (dom === 'switch' || dom === 'fan' || dom === 'input_boolean'){ icon = this._entIcon(eid) || (dom === 'fan' ? 'mdi:fan' : 'mdi:power-socket-de'); color = '--c-switch'; sub = on ? 'An' : 'Aus'; }
    else if (dom === 'cover'){ const pos = st.attributes.current_position; icon = this._entIcon(eid) || (on ? 'mdi:window-shutter-open' : 'mdi:window-shutter'); color = '--c-cover'; sub = st.state === 'opening' ? 'Öffnet …' : st.state === 'closing' ? 'Schließt …' : on ? (pos != null && pos < 100 ? `${pos} % offen` : 'Offen') : 'Geschlossen'; }
    else if (dom === 'media_player'){ icon = this._entIcon(eid) || (st.attributes.device_class === 'speaker' ? 'mdi:speaker' : 'mdi:television'); color = '--c-tv'; sub = on ? (st.attributes.media_title || st.attributes.source || 'An') : 'Aus'; }
    else { icon = this._entIcon(eid) || 'mdi:toggle-switch-outline'; color = '--c-switch'; sub = on ? 'An' : 'Aus'; }
    if (unav) sub = 'Nicht erreichbar';
    let ctx = '';
    if (opts.ctx){
      const site = this._index.entSite[eid];
      ctx = [aName, this._st.site === 'alle' && site && this._sites.length > 1 ? (this._site(site) || {}).tag : ''].filter(Boolean).join(' · ');
    }
    return `<button class="tile ${on ? 'on' : ''} ${unav ? 'unav' : ''}" data-tile="${esc(eid)}" style="--c:var(${color})" aria-pressed="${on}"><span class="tile-ic">${ic(icon)}</span><span class="tile-txt">${ctx ? `<span class="tile-ctx">${esc(ctx)}</span>` : ''}<span class="tile-name">${esc(this._name(eid, aName))}</span><span class="tile-sub">${esc(sub)}</span></span></button>`;
  }
  _applTile(a){
    const m = this._appl(a);
    const on = m.state === 'run';
    const sub = m.state === 'run' ? (m.remain != null ? `noch ${m.remain} Min.` : 'Läuft') : m.state === 'done' ? 'Fertig' : m.state === 'unav' ? 'Nicht erreichbar' : 'Bereit';
    return `<button class="tile ${on ? 'on' : ''}" data-act="appl" data-id="${a.id}" style="--c:var(--c-appl)"><span class="tile-ic">${ic(APPL_ICON[a.art])}</span><span class="tile-txt"><span class="tile-name">${esc(a.name)}</span><span class="tile-sub">${esc(sub)}</span></span></button>`;
  }
  _climTile(eid, showSite){
    const c = this._climate(eid); if (!c) return '';
    const aid = this._index.entArea[eid], site = this._index.entSite[eid];
    const icon = c.heating ? 'mdi:fire' : c.eco ? 'mdi:leaf' : c.off ? 'mdi:power' : 'mdi:check';
    return `<button class="ctile ${c.heating ? 'heating' : ''}" data-act="therm" data-id="${esc(eid)}"><span class="ctile-top"><span class="ctile-room">${esc(aid ? this._areaName(aid) : this._name(eid))}</span>${showSite && site ? `<span class="ctile-site">${esc((this._site(site) || {}).short || '')}</span>` : ''}</span><span class="ctile-temp">${temp(c.cur)}</span><span class="ctile-sub">${ic(icon)}<span>${esc(this._climText(c))}</span></span></button>`;
  }
  _supplyRow(s){
    const a = ART[s.art], m = this._messung(s), val = this._supplyVal(s);
    return `<button class="row" data-act="push" data-page="supply" data-id="${esc(s.id)}"><span class="row-ic" style="--c:var(${a.color})">${ic(s.icon || a.icon)}</span><span class="row-main"><span class="row-title">${esc(s.name)}</span><span class="row-sub">${esc(this._supplySub(s))}</span></span><span class="row-end"><span class="row-val ${val === '—' ? 'dim' : ''}">${esc(val)}</span><span class="pill ${m.cls}">${esc(m.label)}</span></span></button>`;
  }
  _supDots(siteId){
    const list = this._cfg.supplies.filter(s => s.sites.includes(siteId));
    return list.length ? `<span class="sup-icons">${list.map(s => `<span class="sup-dot" style="--c:var(${ART[s.art].color})" title="${esc(s.name)}">${ic(s.icon || ART[s.art].icon)}</span>`).join('')}</span>` : '';
  }
  _flowSentence(n){
    if (n.solar == null || n.load == null || n.load <= 0) return '';
    if (n.solar >= n.load) return 'Gerade läuft alles mit eigenem Solarstrom. Der Überschuss geht ins Netz.';
    return `${Math.round(n.solar / n.load * 100)} % des Verbrauchs kommen gerade vom eigenen Dach.`;
  }
  _energyCard(){
    const list = this._supplies();
    const withSolar = list.find(s => this._now(s).solar != null);
    if (withSolar){
      const n = this._now(withSolar);
      const node = (icon, c, v, l) => `<span class="node"><span class="node-ic" style="--c:var(${c})">${ic(icon)}</span><span class="node-v">${esc(v)}</span><span class="node-l">${esc(l)}</span></span>`;
      const g = n.grid;
      const say = this._flowSentence(n);
      return `<button class="card flow" data-act="push" data-page="supply" data-id="${esc(withSolar.id)}"><span class="flow-top"><span class="flow-t">${esc(withSolar.ort || withSolar.name)} · jetzt</span>${ic('mdi:chevron-right', 'chev')}</span><span class="flow-grid">${node('mdi:solar-power', '--c-sun', fmtPower(n.solar), 'Solar')}${node('mdi:home-lightning-bolt', '--c-power', fmtPower(n.load), 'Verbrauch')}${g != null ? node('mdi:transmission-tower', '--c-net', fmtPower(Math.abs(g)), g < 0 ? 'ins Netz' : 'aus dem Netz') : ''}</span>${say ? `<span class="flow-say">${esc(say)}</span>` : ''}</button>`;
    }
    const withLoad = list.find(s => this._now(s).load != null);
    if (withLoad) return `<button class="card ecard" data-act="push" data-page="supply" data-id="${esc(withLoad.id)}">${ic('mdi:lightning-bolt')}<span>${esc(withLoad.name)}: <b>${esc(fmtPower(this._now(withLoad).load))}</b> gerade</span></button>`;
    return '';
  }
  _camTile(c, cls = ''){
    const st = this._hass.states[c.eid];
    const src = this._camSrc(c.eid);
    return `<button class="cam ${cls}" data-act="cam" data-id="${esc(c.eid)}" aria-label="Kamera ${esc(c.name)} öffnen">${src && st && st.state !== 'unavailable' ? `<img data-cam="${esc(c.eid)}" src="${esc(src)}" alt="">` : `<span class="cam-ph">${ic('mdi:cctv-off')}</span>`}<span class="cam-name">${esc(c.name)}</span></button>`;
  }
  _camSrc(eid, fresh = false){
    const st = this._hass.states[eid]; const pic = st && st.attributes.entity_picture;
    if (!pic) return null;
    if (!fresh && this._camUrl[eid] && this._camUrl[eid].pic === pic) return this._camUrl[eid].url;
    const base = this._hass.hassUrl ? this._hass.hassUrl(pic) : pic;
    const url = `${base}${base.includes('?') ? '&' : '?'}_t=${Date.now()}`;
    if (!this._camUrl[eid] || this._camUrl[eid].pic !== pic) this._camUrl[eid] = {pic, url};
    return url;
  }
  _refreshCams(){
    if (!this._hass || document.hidden) return;
    this._camN = (this._camN + 1) % 4;
    const sheetCam = this._st.sheet && this._st.sheet.type === 'cam' ? this._st.sheet.id : null;
    const imgs = [...this._root.querySelectorAll('img[data-cam]')];
    const ids = new Set(imgs.map(i => i.dataset.cam).filter(id => id === sheetCam || this._camN === 0));
    ids.forEach(eid => {
      const url = this._camSrc(eid, true); if (!url) return;
      const pic = this._hass.states[eid].attributes.entity_picture;
      const pre = new Image();
      pre.onload = () => { this._camUrl[eid] = {pic, url}; this._root.querySelectorAll(`img[data-cam="${CSS_ESC(eid)}"]`).forEach(i => { i.src = url; }); };
      pre.src = url;
    });
  }

  /* ---------- Seiten ---------- */
  _pStart(){
    const now = new Date(), hr = now.getHours();
    const greet = hr < 5 ? 'Gute Nacht' : hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Guten Tag' : 'Guten Abend';
    const date = new Intl.DateTimeFormat('de-DE', {weekday: 'long', day: 'numeric', month: 'long'}).format(now);
    const lightsOn = this._lightsOn();
    const access = this._access();
    const open = access.filter(a => a.open);
    const clims = this._ents('climate').map(e => this._climate(e)).filter(Boolean);
    const heating = clims.filter(c => c.heating);
    const chip = (icon, color, label, value, act = '') => `<${act ? 'button' : 'div'} class="chip" ${act}><span class="chip-ic" style="--c:var(${color})">${ic(icon)}</span><span class="chip-txt"><span class="chip-l">${esc(label)}</span><span class="chip-v">${esc(value)}</span></span></${act ? 'button' : 'div'}>`;
    const chips = [];
    const out = this._outside();
    if (out) chips.push(chip(out.icon, '--c-water', 'Außen', [out.t != null ? `${f0(out.t)}°` : '', out.label].filter(Boolean).join(' · ')));
    chips.push(chip('mdi:lightbulb', '--c-light', 'Licht', lightsOn.length ? `${lightsOn.length} an` : 'Alle aus', 'data-act="lights-sheet"'));
    if (access.length) chips.push(chip(open.length ? 'mdi:alert' : 'mdi:lock', open.length ? '--warn' : '--ok', 'Türen & Tore', open.length ? `${open.length} offen` : 'Alles zu', 'data-act="tab" data-tab="sicherheit"'));
    const solarSup = this._supplies().find(s => this._now(s).solar != null);
    if (solarSup) chips.push(chip('mdi:solar-power', '--c-sun', 'Solar', fmtPower(this._now(solarSup).solar), `data-act="push" data-page="supply" data-id="${esc(solarSup.id)}"`));
    if (clims.length) chips.push(chip('mdi:thermostat', '--c-heat', 'Heizung', heating.length ? `${heating.length} ${heating.length === 1 ? 'Raum heizt' : 'Räume heizen'}` : 'Alles warm', 'data-act="tab" data-tab="heizung"'));

    const alerts = [];
    const alert = (tone, icon, title, sub, btn) => `<div class="alert ${tone}"><span class="alert-ic">${ic(icon)}</span><div class="alert-txt"><strong>${esc(title)}</strong><span>${esc(sub)}</span></div>${btn || ''}</div>`;
    for (const s of this._supplies()){
      const st = s.status && this._hass.states[s.status];
      if (st && st.attributes.device_class === 'connectivity' && st.state === 'off') alerts.push(alert('crit', 'mdi:web-off', `${s.name} ist offline`, sinceText(st.last_changed), ''));
    }
    for (const a of open){
      if (a.dom === 'lock' && Date.now() - Date.parse(a.since) < 120000) continue;
      const site = a.site ? (this._site(a.site) || {}).short : '';
      alerts.push(alert('warn', a.kind === 'tor' ? 'mdi:gate-open' : 'mdi:door-open', a.dom === 'lock' ? `${a.name} ist nicht abgeschlossen` : `${a.name} ist offen`, [site, sinceText(a.since)].filter(Boolean).join(' · '), a.action ? `<button class="btn sm" data-act="access" data-id="${esc(a.eid)}">${esc(a.action.label)}</button>` : ''));
    }
    for (const a of this._applsInFilter()){
      const m = this._appl(a);
      if (m.state !== 'done' || m.dismissed) continue;
      alerts.push(alert('ok', APPL_ICON[a.art], `${a.name} ist fertig`, [a.areaId ? this._areaName(a.areaId) : '', m.since ? agoText(m.since) : ''].filter(Boolean).join(' · '), `<button class="btn sm ghost" data-act="appl-done" data-id="${a.id}">Erledigt</button>`));
    }

    const scenes = this._cfg.scenes.filter(s => !s.site || this._siteMatch(s.site)).filter(s => this._hass.states[s.entity]);
    const sceneHtml = scenes.map(s => `<button class="scene" data-act="scene" data-id="${esc(s.entity)}">${ic(s.icon)}<strong>${esc(s.name || this._name(s.entity))}</strong><span>${esc(s.desc)}</span></button>`).join('')
      + `<button class="scene" data-act="lights-sheet">${ic('mdi:power')}<strong>Alle Lichter aus</strong><span>${esc(this._st.site === 'alle' ? 'Übersicht, was noch an ist' : (this._site(this._st.site) || {}).short)}</span></button>`;

    const favs = this._index.favs.filter(e => { const s = this._index.entSite[e]; return s ? this._siteMatch(s) : this._st.site === 'alle'; });
    const runs = [];
    for (const a of this._applsInFilter()){ const m = this._appl(a); if (m.state === 'run') runs.push(this._runCard(a, m)); }
    for (const e of this._ents('media')) if (this._isOn(e)) runs.push(this._mediaRun(e));
    const energy = this._energyCard();

    return {body: [
      this._rootHeader(greet, date),
      `<div class="chips">${chips.join('')}</div>`,
      alerts.length ? this._sec('Hinweise', `<div class="alerts">${alerts.join('')}</div>`) : '',
      this._sec('Szenen', `<div class="scenes">${sceneHtml}</div>`),
      favs.length ? this._sec('Favoriten', this._grid(favs, e => this._tile(e, {ctx: true})) + '<p class="hint">Tippen schaltet. Gedrückt halten öffnet die Einstellungen.</p>')
        : (this._hass.user && this._hass.user.is_admin && !this._index.favs.length ? this._sec('Favoriten', `<div class="card empty">Noch keine Favoriten. Gib Geräten in Home Assistant das Label <code>${esc(this._cfg.favLabel)}</code>, dann erscheinen sie hier.</div>`) : ''),
      runs.length ? this._sec('Läuft gerade', `<div class="runs">${runs.join('')}</div>`) : '',
      energy ? this._sec('Energie', energy) : '',
    ].join('')};
  }
  _runCard(a, m){
    const p = m.progress != null ? m.progress : null;
    const site = a.siteId ? (this._site(a.siteId) || {}).short : '';
    return `<button class="run" data-act="appl" data-id="${a.id}"><span class="run-ic" style="--c:var(--c-appl)">${ic(APPL_ICON[a.art])}</span><span class="run-main"><span class="run-top"><strong>${esc(a.name)}</strong><span>${m.remain != null ? `noch ${m.remain} Min.` : 'läuft'}</span></span>${p != null ? `<span class="prog" role="progressbar" aria-valuenow="${Math.round(p * 100)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.round(p * 100)}%"></span></span>` : ''}<span class="run-sub">${esc([m.program, a.areaId ? this._areaName(a.areaId) : '', site].filter(Boolean).join(' · '))}</span></span></button>`;
  }
  _mediaRun(eid){
    const st = this._hass.states[eid], aid = this._index.entArea[eid], site = this._index.entSite[eid];
    return `<button class="run" data-act="open" data-id="${esc(eid)}"><span class="run-ic" style="--c:var(--c-tv)">${ic(this._entIcon(eid) || (st.attributes.device_class === 'speaker' ? 'mdi:speaker' : 'mdi:television'))}</span><span class="run-main"><span class="run-top"><strong>${esc(this._name(eid, this._areaName(aid)))}</strong><span>${esc(st.attributes.source || '')}</span></span><span class="run-sub">${esc([st.attributes.media_title, this._areaName(aid), site ? (this._site(site) || {}).short : ''].filter(Boolean).join(' · '))}</span></span></button>`;
  }

  _pOrte(){
    const total = this._sites.reduce((n, s) => n + this._areasOfSite(s.id).length, 0);
    const cards = this._sites.map(s => {
      const on = this._lightsOn(s.id).length, rooms = this._areasOfSite(s.id).length, avg = this._avgTemp(s.id);
      const meta = [on ? `${on} ${on === 1 ? 'Licht' : 'Lichter'} an` : 'Licht aus', avg != null ? `${temp(avg)} innen` : ''].filter(Boolean).join(' · ');
      return `<button class="scard" data-act="push" data-page="site" data-id="${esc(s.id)}"><span class="scard-ic">${ic(s.icon)}</span><span class="scard-main"><span class="scard-name">${esc(s.name)}</span><span class="scard-role">${esc([s.role, `${rooms} ${rooms === 1 ? 'Raum' : 'Räume'}`].filter(Boolean).join(' · '))}</span><span class="scard-meta">${esc(meta)}</span>${this._supDots(s.id)}</span>${ic('mdi:chevron-right', 'chev')}</button>`;
    }).join('');
    const admin = this._hass.user && this._hass.user.is_admin;
    let extra = '';
    if (admin){
      const ix = this._index;
      const warn = ix.issues.filter(i => i.level !== 'info').length;
      extra = this._sec('Einrichtung', `<div class="list">
        <button class="row" data-act="push" data-page="unassigned"><span class="row-ic soft">${ic('mdi:map-marker-question-outline')}</span><span class="row-main"><span class="row-title">Nicht zugeordnet</span><span class="row-sub">Geräte ohne Raum oder ohne Standort</span></span><span class="row-end"><span class="row-val">${ix.unassigned.length}</span></span>${ic('mdi:chevron-right', 'chev')}</button>
        <button class="row" data-act="push" data-page="check"><span class="row-ic soft">${ic('mdi:clipboard-check-outline')}</span><span class="row-main"><span class="row-title">Einrichtung prüfen</span><span class="row-sub">Etagen, Räume und Entitäten aus der Konfiguration</span></span><span class="row-end">${warn ? `<span class="pill warn">${ic('mdi:alert')}${warn}</span>` : `<span class="pill ok">${ic('mdi:check')}OK</span>`}</span>${ic('mdi:chevron-right', 'chev')}</button>
      </div><p class="hint">Nur für Admins sichtbar.</p>`);
    }
    return {body: this._rootHeader('Orte', `${this._sites.length} ${this._sites.length === 1 ? 'Standort' : 'Standorte'} · ${total} Räume`, {noSite: true}) + `<div class="sites">${cards}</div>${this._cfg.supplies.length ? '<p class="hint">Die farbigen Symbole zeigen, welche Anschlüsse einen Standort versorgen.</p>' : ''}` + extra};
  }

  _pSite(id){
    const s = this._site(id);
    if (!s) return {nav: this._navBar('Standort'), body: '<div class="card empty">Diesen Standort gibt es nicht mehr.</div>'};
    const on = this._lightsOn(id);
    const avg = this._avgTemp(id);
    const access = this._access(id);
    const open = access.filter(a => a.open);
    const pills = `<div class="pills"><span class="pill ${on.length ? 'accent' : 'muted'}">${ic('mdi:lightbulb')}${on.length ? `${on.length} an` : 'Licht aus'}</span>${avg != null ? `<span class="pill muted">${ic('mdi:thermometer')}${temp(avg)} innen</span>` : ''}${access.length ? (open.length ? `<span class="pill warn">${ic('mdi:alert')}${open.length} offen</span>` : `<span class="pill ok">${ic('mdi:lock')}Alles zu</span>`) : ''}</div>`;
    const groups = (this._index.groups[id] || []).filter(g => g.areas.length).map(g => this._sec(g.name, `<div class="tiles">${g.areas.map((aid, i, a) => {
      const lit = (this._index.byArea[aid] ? this._index.byArea[aid].light : []).filter(e => this._isOn(e)).length;
      const t = this._roomTemp(aid);
      const span = a.length % 2 === 1 && i === 0 ? 'wide-span' : '';
      const meta = [t != null ? temp(t) : '', lit ? `${lit} ${lit === 1 ? 'Licht' : 'Lichter'} an` : ''].filter(Boolean).join(' · ') || ' ';
      return `<button class="rtile ${lit ? 'lit' : ''} ${span}" data-act="push" data-page="room" data-id="${esc(aid)}"><span class="rtile-ic">${ic(this._areaIcon(aid))}</span><span class="rtile-name">${esc(this._areaName(aid))}</span><span class="rtile-meta">${esc(meta)}</span></button>`;
    }).join('')}</div>`)).join('');
    const sups = this._cfg.supplies.filter(x => x.sites.includes(id));
    return {
      nav: this._navBar(s.short),
      body: this._pushedHeader(s.name, s.role || 'Standort') + pills
        + (on.length ? `<button class="btn ghost wide" data-act="lights-off-site" data-id="${esc(id)}">${ic('mdi:power')}Alle Lichter hier aus</button>` : '')
        + (groups || `<div class="card empty">Für diesen Standort sind in Home Assistant noch keine Räume hinterlegt. Lege unter Einstellungen → Bereiche eine Etage mit Räumen an und trage die Etage in der Konfiguration bei <code>${esc(s.id)}</code> ein.</div>`)
        + (sups.length ? this._sec('Versorgt durch', `<div class="list">${sups.map(x => this._supplyRow(x)).join('')}</div>`) : ''),
    };
  }

  _pRoom(aid){
    const b = this._index.byArea[aid] || {light: [], switch: [], cover: [], climate: [], media: [], temp: [], hum: [], gate: [], lock: [], camera: []};
    const name = this._areaName(aid) || 'Raum';
    const site = this._site(this._index.areaSite[aid]);
    const parts = [this._pushedHeader(name, [site && site.short, this._groupOf(aid)].filter(Boolean).join(' · '))];
    if (b.light.length) parts.push(this._sec('Licht', this._grid(b.light, e => this._tile(e)), b.light.some(e => this._isOn(e)) ? `<button class="link" data-act="lights-off-room" data-id="${esc(aid)}">Alle aus</button>` : ''));
    if (b.climate.length) parts.push(this._sec('Heizung', `<div class="tiles">${b.climate.map(e => this._climTile(e, false)).join('')}</div>`));
    if (b.cover.length) parts.push(this._sec('Rollläden', this._grid(b.cover, e => this._tile(e))));
    const appls = this._index.appls.filter(a => a.areaId === aid);
    if (b.media.length || appls.length) parts.push(this._sec('Geräte', `<div class="tiles">${b.media.map(e => this._tile(e)).join('')}${appls.map(a => this._applTile(a)).join('')}</div>`));
    if (b.switch.length) parts.push(this._sec('Schalter', this._grid(b.switch, e => this._tile(e))));
    const t = this._roomTemp(aid), hu = this._roomHum(aid);
    const kv = [];
    if (t != null) kv.push({icon: 'mdi:thermometer', label: 'Temperatur', value: `${f1(t)} °C`});
    if (hu != null) kv.push({icon: 'mdi:water-percent', label: 'Luftfeuchte', value: `${f0(hu)} %`});
    if (kv.length) parts.push(this._sec('Raumklima', this._kvList(kv)));
    if (parts.length === 1) parts.push('<div class="card empty">In diesem Raum ist noch nichts. Sobald in Home Assistant Geräte diesem Raum zugeordnet sind, erscheinen sie hier.</div>');
    return {nav: this._navBar(name), body: parts.join('')};
  }

  _pHeizung(){
    const sources = this._supplies().filter(s => HEAT_ARTS.has(s.art));
    const clims = this._ents('climate');
    const heating = clims.filter(e => { const c = this._climate(e); return c && c.heating; }).length;
    const seasonal = sources.filter(s => s.saison);
    let season = '';
    if (seasonal.length){
      const cur = this._season();
      const ent = this._cfg.season && this._cfg.season.entity && this._hass.states[this._cfg.season.entity];
      const label = v => { const l = seasonal.filter(s => lc(s.saison) === v).map(s => ART[s.art].short); return `${v === 'winter' ? 'Winter' : 'Sommer'}${l.length ? ' · ' + l.join(', ') : ''}`; };
      const btn = v => `<button role="radio" aria-checked="${cur === v}" class="${cur === v ? 'sel' : ''}" ${ent ? `data-act="season" data-v="${v}"` : 'disabled'}>${ic(v === 'winter' ? 'mdi:snowflake' : 'mdi:white-balance-sunny')}${esc(label(v))}</button>`;
      const cs = this._cfg.season || {};
      season = `<div class="card season"><div class="season-txt"><strong>${esc(cs.titel || 'Heizbetrieb')}</strong><span>${esc(cs.text || (ent ? 'Welche Heizung gerade läuft' : 'Wechselt automatisch: Oktober bis April ist Winter'))}</span></div><div class="seg" role="radiogroup" aria-label="Heizbetrieb">${btn('winter')}${btn('sommer')}</div></div>`;
    }
    return {body: [
      this._rootHeader('Heizung', clims.length ? (heating ? `${heating} ${heating === 1 ? 'Raum heizt' : 'Räume heizen'} gerade` : 'Alle Räume sind warm') : 'Wärme & Thermostate'),
      sources.length ? this._sec('Wärmequellen', `<div class="list">${sources.map(s => this._supplyRow(s)).join('')}</div>`) : '',
      season,
      this._sec('Räume', clims.length ? `<div class="tiles">${clims.map(e => this._climTile(e, this._st.site === 'alle')).join('')}</div>` : '<div class="card empty">Hier gibt es noch keine Thermostate. Thermostate erscheinen, sobald sie in Home Assistant einem Raum zugeordnet sind.</div>'),
    ].join('')};
  }

  _pVersorgung(){
    const list = this._supplies();
    const groups = GROUP_ORDER.map(g => { const items = list.filter(s => ART[s.art].group === g); return items.length ? this._sec(g, `<div class="list">${items.map(s => this._supplyRow(s)).join('')}</div>`) : ''; }).join('');
    const measured = list.filter(s => ['voll', 'therme', 'teilweise'].includes(s.messung || (SUPPLY_KEYS.some(k => s[k]) ? 'voll' : 'keine'))).length;
    return {body: [
      this._rootHeader('Versorgung', list.length ? `${list.length} Anschlüsse · ${measured} gemessen` : 'Anschlüsse'),
      this._energyCard(),
      groups || '<div class="card empty">Noch keine Anschlüsse eingetragen. Lege sie in der Konfiguration unter <code>versorgung</code> an.</div>',
    ].join('')};
  }

  _pSupply(id){
    const s = this._supply(id);
    if (!s) return {nav: this._navBar('Anschluss'), body: '<div class="card empty">Diesen Anschluss gibt es nicht mehr.</div>'};
    const h = this._hass, a = ART[s.art], m = this._messung(s), n = this._now(s);
    const seasonPill = s.saison ? (this._seasonActive(s) ? `<span class="pill accent">${ic('mdi:check')}${lc(s.saison) === 'winter' ? 'Winterbetrieb' : 'Sommerbetrieb'} · aktiv</span>` : `<span class="pill muted">${lc(s.saison) === 'winter' ? 'Winterbetrieb' : 'Sommerbetrieb'} · Pause</span>`) : '';
    const parts = [`<header class="lt pushed"><div class="sup-head"><span class="row-ic lg" style="--c:var(${a.color})">${ic(s.icon || a.icon)}</span><div><span class="eyebrow">${esc([a.group, s.ort].filter(Boolean).join(' · '))}</span><h1>${esc(s.name)}</h1></div></div></header><div class="pills">${this._pill(m)}${seasonPill}</div>`];
    if (s.hinweis) parts.push(this._note(s.hinweis));
    // Jetzt
    const k = [];
    if (n.solar != null) k.push(this._kpi('Solar jetzt', fmtPower(n.solar)));
    if (n.load != null) k.push(this._kpi('Verbrauch', fmtPower(n.load)));
    if (n.grid != null) k.push(this._kpi(n.grid < 0 ? 'Ins Netz' : 'Aus dem Netz', fmtPower(Math.abs(n.grid))));
    const stS = s.status && h.states[s.status];
    if (stS) k.unshift(this._kpi('Status', this._statusText(stS)));
    if (k.length){ const say = this._flowSentence(n); parts.push(`<section class="sec"><div class="kpis ${k.length === 1 ? 'one' : k.length === 2 ? 'two' : ''}">${k.slice(0, 3).join('')}</div>${say ? `<p class="lede">${esc(say)}</p>` : ''}</section>`); }
    // Heute
    const hasChart = !!(s.solar || s.leistung || s.netz);
    const today = [];
    const eh = key => energyKWh(s[key] && h.states[s[key]]);
    if (eh('solar_heute') != null) today.push(this._kpi('Solar', fmtEnergy(eh('solar_heute'))));
    if (eh('verbrauch_heute') != null) today.push(this._kpi('Verbrauch', fmtEnergy(eh('verbrauch_heute'))));
    if (eh('einspeisung_heute') != null) today.push(this._kpi('Eingespeist', fmtEnergy(eh('einspeisung_heute'))));
    if (eh('bezug_heute') != null && today.length < 3) today.push(this._kpi('Bezogen', fmtEnergy(eh('bezug_heute'))));
    if (hasChart || today.length){
      let chart = '';
      if (hasChart){
        const c = this._hist[s.id];
        if (c && c.err) chart = `<div class="card empty">Der Verlauf konnte nicht geladen werden (${esc(c.err)}).</div>`;
        else if (c && (c.solar || c.load)) chart = `<div class="card chart-card">${this._chart(c)}</div>`;
        else chart = '<div class="card empty">Verlauf wird geladen …</div>';
      }
      parts.push(this._sec('Heute', chart + (today.length ? `<div class="kpis ${today.length === 1 ? 'one' : today.length === 2 ? 'two' : ''}">${today.slice(0, 3).join('')}</div>` : '')));
    }
    // Nach Gebäude
    const measured = s.versorgt.filter(v => v.leistung && h.states[v.leistung]).map(v => ({name: v.name || this._name(v.leistung), kw: powerKW(h.states[v.leistung])})).filter(v => v.kw != null);
    if (measured.length){
      const sum = measured.reduce((x, v) => x + v.kw, 0);
      const rest = n.load != null ? n.load - sum : null;
      const max = Math.max(...measured.map(v => v.kw), rest > 0 ? rest : 0, 0.001);
      const bar = (label, kw, faint) => `<div class="bar-row"><span class="bar-l">${esc(label)}</span><span class="bar-track">${kw > 0 ? `<span class="bar-fill" style="width:${(kw / max * 100).toFixed(1)}%${faint ? ';opacity:.45' : ''}"></span>` : ''}</span><span class="bar-v">${esc(fmtPower(kw))}</span></div>`;
      const rows = measured.sort((x, y) => y.kw - x.kw).map(v => bar(v.name, v.kw)).join('') + (rest != null && rest > 0.01 ? bar('Nicht zugeordnet', rest, true) : '');
      parts.push(this._sec('Nach Gebäude', `<div class="card bars">${rows}</div>`));
    }
    // Werte
    const werte = s.werte.filter(w => w && w.entity && h.states[w.entity]).map(w => ({icon: w.icon || null, label: w.name || this._name(w.entity), value: this._statusText(h.states[w.entity])}));
    if (werte.length) parts.push(this._sec(s.werte_titel || 'Werte', this._kvList(werte)));
    if (s.geplant.length) parts.push(this._sec('Geplant', this._kvList(s.geplant.map(g => ({icon: 'mdi:clock-outline', label: String(g), value: 'Geplant', dim: true})))));
    // Versorgt
    let rows;
    if (s.versorgt.length){
      rows = s.versorgt.map(v => {
        const st = v.leistung && h.states[v.leistung], en = v.energie_heute && h.states[v.energie_heute];
        const val = st ? fmtPower(powerKW(st)) : en ? `${fmtEnergy(energyKWh(en))} heute` : (v.hinweis || 'nicht gemessen');
        return {label: v.name || '—', site: v.standort ? String(v.standort) : null, val, dim: !st && !en && !v.hinweis};
      });
    } else rows = s.sites.map(sid => ({label: (this._site(sid) || {}).name || sid, site: sid, val: ''}));
    if (rows.length) parts.push(this._sec('Versorgt', `<div class="list">${rows.map(r => {
      const site = r.site && this._site(r.site);
      const inner = `<span class="row-ic soft">${ic(site ? site.icon : 'mdi:home')}</span><span class="row-main"><span class="row-title">${esc(r.label)}</span>${site && site.name !== r.label ? `<span class="row-sub">${esc(site.short)}</span>` : ''}</span>${r.val ? `<span class="row-end"><span class="row-val ${r.dim ? 'dim' : ''}">${esc(r.val)}</span></span>` : ''}`;
      return site && this._sites.some(x => x.id === site.id) ? `<button class="row" data-act="push" data-page="site" data-id="${esc(site.id)}">${inner}${ic('mdi:chevron-right', 'chev')}</button>` : `<div class="row">${inner}</div>`;
    }).join('')}</div>`));
    return {nav: this._navBar(s.name), body: parts.join(''), after: hasChart ? () => this._loadHistory(s) : null};
  }

  _pSicherheit(){
    const access = this._access(), cams = this._cams();
    const open = access.filter(a => a.open);
    const status = !access.length ? '' : open.length
      ? `<div class="statusbox warn">${ic('mdi:alert')}<div><strong>${esc(open.length === 1 ? `${open[0].name} ist offen` : `${open.length} Türen oder Tore offen`)}</strong><span>${esc(open.length === 1 ? [open[0].site ? (this._site(open[0].site) || {}).short : '', sinceText(open[0].since)].filter(Boolean).join(' · ') : 'Unten tippen zum Schließen')}</span></div></div>`
      : `<div class="statusbox ok">${ic('mdi:check-circle')}<div><strong>Alles verschlossen</strong><span>${access.length} ${access.length === 1 ? 'Tür oder Tor' : 'Türen und Tore'}</span></div></div>`;
    const rows = access.map(a => {
      const icon = a.kind === 'tor' ? (a.open ? 'mdi:gate-open' : 'mdi:gate') : (a.open ? 'mdi:door-open' : 'mdi:door-closed-lock');
      const site = a.site ? (this._site(a.site) || {}).short : '';
      const btn = a.action && !a.unav ? `<button class="btn sm ${a.open ? '' : 'ghost'}" data-act="access" data-id="${esc(a.eid)}">${esc(a.action.label)}</button>` : '';
      return `<div class="row"><span class="row-ic" style="--c:var(${a.unav ? '--fg-3' : a.open ? '--warn' : '--ok'})">${ic(icon)}</span><span class="row-main"><span class="row-title">${esc(a.name)}</span><span class="row-sub">${esc([site, a.unav ? 'Nicht erreichbar' : a.label].filter(Boolean).join(' · '))}</span></span>${btn}</div>`;
    }).join('');
    const camHtml = cams.map((c, i) => this._camTile(c, cams.length % 2 === 1 && i === 0 && cams.length > 1 ? 'wide-span' : '')).join('');
    const log = this._log;
    let events = '';
    if (log && log.items && log.items.length) events = this._sec('Heute', `<div class="list">${log.items.map(e => `<div class="row"><span class="row-ic soft">${ic(e.icon)}</span><span class="row-main"><span class="row-title">${esc(e.title)}</span><span class="row-sub">${esc(e.sub)}</span></span><span class="row-end"><span class="row-val dim">${esc(e.time)}</span></span></div>`).join('')}</div>`);
    return {
      body: [
        this._rootHeader('Sicherheit', 'Zugang · Kameras'),
        status,
        access.length ? this._sec('Türen & Tore', `<div class="list">${rows}</div>`) : '',
        cams.length ? this._sec('Kameras', `<div class="cams">${camHtml}</div>`) : '',
        events,
        !access.length && !cams.length ? '<div class="card empty">Hier ist noch nichts eingetragen. Türen, Tore und Kameras erscheinen, sobald sie einem Raum zugeordnet oder in der Konfiguration unter <code>zugang</code> und <code>kameras</code> eingetragen sind.</div>' : '',
      ].join(''),
      after: () => this._loadLog(access),
    };
  }

  _pUnassigned(){
    const ix = this._index, h = this._hass;
    const groups = {};
    ix.unassigned.forEach(e => { const k = classify(domainOf(e), h.states[e]); (groups[k] || (groups[k] = [])).push(e); });
    const body = UNASSIGNED_KINDS.filter(k => groups[k]).map(k => {
      const list = groups[k];
      const shown = list.slice(0, 60);
      return this._sec(`${KIND_LABEL[k]} (${list.length})`, `<div class="list">${shown.map(e => { const a = ix.entArea[e]; return `<button class="row" data-act="more" data-id="${esc(e)}"><span class="row-main"><span class="row-title">${esc(this._name(e))}</span><span class="row-sub"><code>${esc(e)}</code>${a ? ` · Raum „${esc(this._areaName(a))}“ gehört zu keinem Standort` : ''}</span></span>${ic('mdi:chevron-right', 'chev')}</button>`; }).join('')}</div>${list.length > shown.length ? `<p class="hint">… und ${list.length - shown.length} weitere.</p>` : ''}`);
    }).join('');
    return {nav: this._navBar('Nicht zugeordnet'), body: this._pushedHeader('Nicht zugeordnet', `${ix.unassigned.length} Geräte`) + this._note('Diese Geräte haben keinen Raum oder ihr Raum gehört zu keinem Standort. Tippe ein Gerät an und weise ihm in Home Assistant unter Einstellungen einen Raum zu. Danach erscheint es automatisch in der App.') + (body || '<div class="card empty">Alles zugeordnet.</div>')};
  }

  _pCheck(){
    const ix = this._index, h = this._hass;
    const icon = {error: 'mdi:close-circle', warn: 'mdi:alert', info: 'mdi:information-outline'};
    const order = ['error', 'warn', 'info'];
    const issues = [...ix.issues].sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
    const floors = Object.values(this._floors()).sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || String(a.name).localeCompare(b.name, 'de'));
    const areas = Object.values(h.areas || {});
    const floorRows = floors.map(f => { const list = areas.filter(a => a.floor_id === f.floor_id).map(a => a.name).sort((x, y) => x.localeCompare(y, 'de')); return `<div class="row"><span class="row-main"><span class="row-title">${esc(f.name)}</span><span class="row-sub"><code>${esc(f.floor_id)}</code> · ${list.length ? esc(list.join(', ')) : 'keine Räume'}</span></span></div>`; }).join('');
    return {nav: this._navBar('Einrichtung'), body: [
      this._pushedHeader('Einrichtung prüfen', `Multi-Site Panel ${VERSION}`),
      this._sec('Hinweise', issues.length ? `<div class="list">${issues.map(i => `<div class="issue ${i.level}">${ic(icon[i.level])}<span>${esc(i.text)}</span></div>`).join('')}</div>` : '<div class="card empty">Alles in Ordnung.</div>'),
      this._sec('Etagen in Home Assistant', floors.length ? `<div class="list">${floorRows}</div><p class="hint">Diese IDs (oder die Namen) trägst du in der Konfiguration bei <code>etagen</code> ein.</p>` : '<div class="card empty">In Home Assistant sind noch keine Etagen angelegt (Einstellungen → Bereiche → Etage hinzufügen).</div>'),
    ].join('')};
  }

  /* ---------- Diagramm ---------- */
  _chart(c){
    const W = 340, H = 190, ml = 30, mr = 10, mt = 16, mb = 22, pw = W - ml - mr, ph = H - mt - mb;
    const stepH = STEP_MS / 3600000;
    const nowH = (Date.now() - c.t0) / 3600000;
    const vals = [...(c.solar || []), ...(c.load || [])].filter(v => v != null);
    const vmax = Math.max(0.1, ...vals);
    const step = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200].find(s => vmax / s <= 4) || 500;
    const ymax = Math.ceil(vmax / step) * step;
    const x = t => ml + t / 24 * pw, y = v => mt + ph - v / ymax * ph;
    let g = '';
    for (let v = 0; v <= ymax + 1e-9; v += step){ const vv = +v.toFixed(3); g += `<line class="${vv === 0 ? 'base' : 'gl'}" x1="${ml}" x2="${W - mr}" y1="${y(vv)}" y2="${y(vv)}"/><text class="ax" x="${ml - 6}" y="${y(vv) + 3.5}" text-anchor="end">${String(vv).replace('.', ',')}${Math.abs(vv - ymax) < 1e-9 ? ' kW' : ''}</text>`; }
    [0, 6, 12, 18, 24].forEach(t => { g += `<text class="ax" x="${x(t)}" y="${H - 6}" text-anchor="${t === 0 ? 'start' : t === 24 ? 'end' : 'middle'}">${t === 24 ? '24 Uhr' : t}</text>`; });
    const path = a => { let d = '', pen = false; a.forEach((v, i) => { if (v == null){ pen = false; return; } d += `${pen ? 'L' : 'M'}${x((i + .5) * stepH).toFixed(1)} ${y(v).toFixed(1)}`; pen = true; }); return d; };
    const last = a => { if (!a) return null; for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return {i, v: a[i]}; return null; };
    let marks = '', legend = '';
    if (c.solar){
      const d = path(c.solar), lv = last(c.solar);
      const area = lv ? `${d}L${x((lv.i + .5) * stepH).toFixed(1)} ${y(0)}L${x(.5 * stepH).toFixed(1)} ${y(0)}Z` : '';
      marks += `<path class="pv-area" d="${area}"/><path class="pv-line" d="${d}"/>`;
      if (lv) marks += `<circle class="dot pv" cx="${x((lv.i + .5) * stepH)}" cy="${y(lv.v)}" r="4.5"/>`;
      legend += `<span><i style="background:var(--s2)"></i>Solar</span>`;
    }
    if (c.load){
      const lv = last(c.load);
      marks += `<path class="ld-line" d="${path(c.load)}"/>`;
      if (lv) marks += `<circle class="dot ld" cx="${x((lv.i + .5) * stepH)}" cy="${y(lv.v)}" r="4.5"/>`;
      legend += `<span><i style="background:var(--s1)"></i>Verbrauch</span>`;
    }
    const nx = x(Math.min(24, nowH));
    this._chartData = {c, W, ml, pw, stepH, x, y};
    return `<div class="legend">${legend}</div><div class="echart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf heute">${g}${marks}<line class="now-line" x1="${nx}" x2="${nx}" y1="${mt}" y2="${mt + ph}"/><text class="ax" x="${Math.min(nx + 4, W - 24)}" y="${mt + 2}">jetzt</text><line class="cross" x1="0" x2="0" y1="${mt}" y2="${mt + ph}" visibility="hidden"/><circle class="dot pv hdot-pv" r="4.5" visibility="hidden"/><circle class="dot ld hdot-ld" r="4.5" visibility="hidden"/><rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="transparent"/></svg><div class="tip" hidden></div></div>`;
  }
  _bindCharts(){
    const wrap = this.$screen.querySelector('.echart'); if (!wrap || !this._chartData) return;
    const svg = wrap.querySelector('svg'), tip = wrap.querySelector('.tip');
    const cross = svg.querySelector('.cross'), dp = svg.querySelector('.hdot-pv'), dl = svg.querySelector('.hdot-ld');
    const {c, W, ml, pw, stepH, x, y} = this._chartData;
    const n = Math.max((c.solar || []).length, (c.load || []).length);
    const hide = () => { tip.hidden = true; [cross, dp, dl].forEach(e => e.setAttribute('visibility', 'hidden')); };
    const move = ev => {
      const r = svg.getBoundingClientRect();
      const t = ((ev.clientX - r.left) / r.width * W - ml) / pw * 24;
      if (t < 0 || t > 24){ hide(); return; }
      const i = Math.max(0, Math.min(n - 1, Math.floor(t / stepH)));
      const sv = c.solar ? c.solar[i] : null, lv = c.load ? c.load[i] : null;
      if (sv == null && lv == null){ hide(); return; }
      const px = x((i + .5) * stepH);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
      if (sv != null){ dp.setAttribute('cx', px); dp.setAttribute('cy', y(sv)); dp.setAttribute('visibility', 'visible'); } else dp.setAttribute('visibility', 'hidden');
      if (lv != null){ dl.setAttribute('cx', px); dl.setAttribute('cy', y(lv)); dl.setAttribute('visibility', 'visible'); } else dl.setAttribute('visibility', 'hidden');
      const from = new Date(c.t0 + i * STEP_MS);
      tip.innerHTML = `<div class="tip-t">${hhmm(from)} Uhr</div>${sv != null ? `<div><i style="background:var(--s2)"></i>Solar <b>${esc(fmtPower(sv))}</b></div>` : ''}${lv != null ? `<div><i style="background:var(--s1)"></i>Verbrauch <b>${esc(fmtPower(lv))}</b></div>` : ''}`;
      tip.hidden = false;
      tip.style.left = `${Math.max(22, Math.min(78, px / W * 100))}%`;
    };
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', hide);
  }

  /* ---------- Daten nachladen ---------- */
  async _loadHistory(s){
    const c = this._hist[s.id];
    if (c && (c.loading || Date.now() - c.at < 300000)) return;
    this._hist[s.id] = {...(c || {}), loading: true};
    const ids = [s.solar, s.leistung, s.netz].filter(e => e && this._hass.states[e]);
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const t1 = Date.now();
    try {
      const res = ids.length ? await this._hass.callWS({type: 'history/history_during_period', start_time: t0.toISOString(), end_time: new Date(t1).toISOString(), entity_ids: ids, minimal_response: true, no_attributes: true, significant_changes_only: false}) : {};
      const series = id => {
        if (!id || !this._hass.states[id]) return null;
        const f = powerFactor(this._hass.states[id].attributes.unit_of_measurement);
        const pts = (res[id] || []).map(e => {
          const t = e.lu != null ? e.lu * 1000 : Date.parse(e.last_updated || e.last_changed);
          const v = num(e.s !== undefined ? e.s : e.state);
          return {t, v: v == null ? null : v * f};
        }).filter(p => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
        return bucketize(pts, t0.getTime(), t1, STEP_MS);
      };
      const solar = series(s.solar);
      let load = series(s.leistung), grid = series(s.netz);
      if (grid && s.netz_umkehren) grid = grid.map(v => v == null ? null : -v);
      if (!load && grid && solar) load = grid.map((g, i) => g == null || solar[i] == null ? null : g + solar[i]);
      this._hist[s.id] = {at: Date.now(), t0: t0.getTime(), solar, load};
    } catch (e){
      this._hist[s.id] = {at: Date.now(), err: String((e && e.message) || (e && e.code) || e)};
    }
    this._queue();
  }
  async _loadLog(access){
    if (this._log && (this._log.loading || Date.now() - this._log.at < 60000)) return;
    const h = this._hass;
    const ids = [...new Set([...access.map(a => a.eid), ...this._cfg.access.map(a => a.status).filter(Boolean), ...this._cfg.events])].filter(e => h.states[e]);
    if (!ids.length){ this._log = {at: Date.now(), items: []}; return; }
    this._log = {...(this._log || {}), loading: true};
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    try {
      const res = await h.callWS({type: 'logbook/get_events', start_time: t0.toISOString(), end_time: new Date().toISOString(), entity_ids: ids});
      const items = (res || []).map(e => {
        const st = h.states[e.entity_id]; if (!st) return null;
        const dom = domainOf(e.entity_id), dc = st.attributes.device_class;
        let text = null, icon = 'mdi:information-outline';
        if (dom === 'binary_sensor'){
          if (['door', 'garage_door', 'opening', 'window'].includes(dc)){ text = e.state === 'on' ? 'geöffnet' : 'geschlossen'; icon = 'mdi:door'; }
          else if (e.state === 'on'){ text = 'erkannt'; icon = dc === 'motion' ? 'mdi:motion-sensor' : 'mdi:account'; }
        } else if (dom === 'cover'){ text = {open: 'geöffnet', closed: 'geschlossen'}[e.state] || null; icon = 'mdi:gate'; }
        else if (dom === 'lock'){ text = {unlocked: 'entriegelt', locked: 'verriegelt', open: 'geöffnet'}[e.state] || null; icon = 'mdi:lock'; }
        else if (dom === 'event'){ text = 'ausgelöst'; icon = 'mdi:bell-ring'; }
        else if (e.state){ text = e.state; }
        if (!text || !e.when) return null;
        return {when: e.when, time: hhmm(new Date(e.when * 1000)), title: st.attributes.friendly_name || e.entity_id, sub: text, icon};
      }).filter(Boolean).sort((a, b) => b.when - a.when).slice(0, 15);
      this._log = {at: Date.now(), items};
    } catch (e){ this._log = {at: Date.now(), items: []}; }
    if (this._st.tab === 'sicherheit') this._queue();
  }

  /* ---------- Bottom-Sheets ---------- */
  _sheetHead(eyebrow, title){ return `<div class="sheet-head" data-drag><div><span class="sheet-eyebrow">${esc(eyebrow)}</span><h3 id="sheetTitle">${esc(title)}</h3></div><button class="x" data-act="sheet-close" aria-label="Schließen">${ic('mdi:close')}</button></div>`; }
  _haLink(eid){ return `<button class="ha-link" data-act="more" data-id="${esc(eid)}">${ic('mdi:open-in-new')}Mehr in Home Assistant</button>`; }
  _ctxOf(eid){ const aid = this._index.entArea[eid], site = this._index.entSite[eid]; return [aid ? this._areaName(aid) : '', site ? (this._site(site) || {}).short : ''].filter(Boolean).join(' · '); }
  _sheetHtml(type, id){
    const h = this._hass;
    switch (type){
      case 'site': {
        const opts = [{id: 'alle', name: 'Alle Standorte', role: 'Alles auf einen Blick', icon: 'mdi:map-marker-multiple'}, ...this._sites];
        return this._sheetHead('Anzeigen für', 'Standort wählen') + `<div class="list">${opts.map(o => `<button class="row" data-act="set-site" data-id="${esc(o.id)}" role="radio" aria-checked="${this._st.site === o.id}"><span class="row-ic soft">${ic(o.icon)}</span><span class="row-main"><span class="row-title">${esc(o.name)}</span><span class="row-sub">${esc(o.role)}</span></span>${this._st.site === o.id ? `<span style="color:var(--accent)">${ic('mdi:check')}</span>` : ''}</button>`).join('')}</div>`;
      }
      case 'lights': {
        const on = this._lightsOn();
        const title = on.length ? `${on.length} ${on.length === 1 ? 'Licht' : 'Lichter'} an` : 'Alle Lichter sind aus';
        return this._sheetHead(this._st.site === 'alle' ? 'Alle Standorte' : (this._site(this._st.site) || {}).short, title)
          + (on.length ? `<div class="list">${on.map(e => `<div class="row"><span class="row-ic" style="--c:var(--c-light)">${ic('mdi:lightbulb')}</span><span class="row-main"><span class="row-title">${esc(this._name(e, this._areaName(this._index.entArea[e])))}</span><span class="row-sub">${esc(this._ctxOf(e))}</span></span><button class="switch on" role="switch" aria-checked="true" aria-label="Ausschalten" data-act="toggle" data-id="${esc(e)}"></button></div>`).join('')}</div><button class="btn wide" data-act="lights-off-filter">${ic('mdi:power')}Alle ausschalten</button>` : '<p class="lede">Nirgends brennt mehr Licht.</p>');
      }
      case 'light': {
        const st = h.states[id]; if (!st) return '';
        const on = this._isOn(id), dim = this._dimmable(id), v = on ? (this._bri(id) ?? 100) : 0;
        return this._sheetHead(this._ctxOf(id), this._name(id, this._areaName(this._index.entArea[id])))
          + (dim ? `<div class="vwrap"><div class="vslider ${on ? '' : 'off'}" id="vslider" data-kind="light" role="slider" tabindex="0" aria-label="Helligkeit" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" style="--c:var(--c-light)"><div class="vfill" style="height:${v}%"></div>${ic('mdi:lightbulb', 'vicon')}</div><div class="vval" id="vval">${on ? v + ' %' : 'Aus'}</div></div>` : `<div class="center"><button class="round xl ${on ? 'on' : ''}" data-act="toggle" data-id="${esc(id)}" aria-label="${on ? 'Ausschalten' : 'Einschalten'}">${ic('mdi:lightbulb')}</button></div>`)
          + (dim ? `<button class="btn wide ${on ? 'ghost' : ''}" data-act="toggle" data-id="${esc(id)}">${on ? 'Ausschalten' : 'Einschalten'}</button>` : '') + this._haLink(id);
      }
      case 'cover': {
        const st = h.states[id]; if (!st) return '';
        const pos = num(st.attributes.current_position);
        return this._sheetHead(this._ctxOf(id), this._name(id, this._areaName(this._index.entArea[id])))
          + (pos != null ? `<div class="vwrap"><div class="vslider" id="vslider" data-kind="cover" role="slider" tabindex="0" aria-label="Öffnung" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pos}" style="--c:var(--c-cover)"><div class="vfill" style="height:${pos}%"></div>${ic('mdi:window-shutter-open', 'vicon')}</div><div class="vval" id="vval">${pos} % offen</div></div>` : '')
          + `<div class="btnrow"><button class="btn ghost" data-act="cover" data-v="open_cover" data-id="${esc(id)}">${ic('mdi:arrow-up')}Auf</button><button class="btn ghost" data-act="cover" data-v="stop_cover" data-id="${esc(id)}">${ic('mdi:stop')}Stopp</button><button class="btn ghost" data-act="cover" data-v="close_cover" data-id="${esc(id)}">${ic('mdi:arrow-down')}Zu</button></div>` + this._haLink(id);
      }
      case 'therm': {
        const c = this._climate(id); if (!c) return '';
        const A0 = Math.PI * 0.75, SW = Math.PI * 1.5;
        const ang = v => A0 + (Math.min(c.max, Math.max(c.min, v)) - c.min) / (c.max - c.min) * SW;
        const P = (a) => [120 + 92 * Math.cos(a), 116 + 92 * Math.sin(a)];
        const arc = (a0, a1) => { const [x0, y0] = P(a0), [x1, y1] = P(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A92 92 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
        const marker = c.cur != null ? (() => { const [mx, my] = P(ang(c.cur)); return `<circle class="therm-cur" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="6"/>`; })() : '';
        const stateText = c.unav ? 'Nicht erreichbar' : c.off ? 'Aus' : c.heating ? 'Heizt' : c.eco ? 'Eco' : 'Hält die Temperatur';
        const canStep = !c.off && !c.unav && c.target != null;
        const modes = [['heat', 'Heizen', 'mdi:fire'], ['auto', 'Automatik', 'mdi:calendar-clock'], ['off', 'Aus', 'mdi:power']].filter(([m]) => c.modes.includes(m));
        const hasEco = c.presets.map(lc).includes('eco');
        const seg = [...modes.map(([m, l, i]) => { const sel = !c.eco && c.mode === m; return `<button role="radio" aria-checked="${sel}" class="${sel ? 'sel' : ''}" data-act="therm-mode" data-v="${m}">${ic(i)}${l}</button>`; }), hasEco ? `<button role="radio" aria-checked="${c.eco}" class="${c.eco ? 'sel' : ''}" data-act="therm-eco">${ic('mdi:leaf')}Eco</button>` : ''].join('');
        const aid = this._index.entArea[id];
        const hum = aid ? this._roomHum(aid) : null;
        return this._sheetHead((this._site(this._index.entSite[id]) || {}).short || '', aid ? this._areaName(aid) : this._name(id))
          + `<div class="therm"><svg viewBox="0 0 240 210" aria-hidden="true"><path class="therm-track" d="${arc(A0, A0 + SW)}"/>${!c.off && c.target != null ? `<path class="therm-val ${c.heating ? '' : 'idle'}" d="${arc(A0, ang(c.target))}"/>` : ''}${marker}</svg><div class="therm-center"><span class="therm-state ${c.heating ? 'heating' : ''}">${esc(stateText)}</span><span class="therm-target" aria-live="polite">${c.off || c.target == null ? '—' : f1(c.target) + '°'}</span><span class="therm-now">${c.cur != null ? `Raum ${f1(c.cur)}°` : ''}${hum != null ? ` · ${f0(hum)} %` : ''}</span></div></div>`
          + `<div class="therm-ctrl"><button class="round" data-act="therm-step" data-d="-1" aria-label="Kälter" ${canStep ? '' : 'disabled'}>${ic('mdi:minus')}</button><button class="round" data-act="therm-step" data-d="1" aria-label="Wärmer" ${canStep ? '' : 'disabled'}>${ic('mdi:plus')}</button></div>`
          + (seg ? `<div class="seg" role="radiogroup" aria-label="Betriebsart">${seg}</div>` : '') + this._haLink(id);
      }
      case 'media': {
        const st = h.states[id]; if (!st) return '';
        const on = this._isOn(id), vol = num(st.attributes.volume_level), srcs = st.attributes.source_list || [];
        return this._sheetHead(this._ctxOf(id), this._name(id, this._areaName(this._index.entArea[id])))
          + `<div class="center"><button class="round xl ${on ? 'on' : ''}" data-act="toggle" data-id="${esc(id)}" aria-label="${on ? 'Ausschalten' : 'Einschalten'}">${ic('mdi:power')}</button></div>`
          + (vol != null || on ? `<div class="card vol"><button class="round" data-act="vol" data-d="-0.04" aria-label="Leiser" ${on ? '' : 'disabled'}>${ic('mdi:minus')}</button><div class="vol-mid"><span class="vol-l">Lautstärke</span><span class="vol-v">${on && vol != null ? Math.round(vol * 100) : '—'}</span></div><button class="round" data-act="vol" data-d="0.04" aria-label="Lauter" ${on ? '' : 'disabled'}>${ic('mdi:plus')}</button></div>` : '')
          + (srcs.length ? `<span class="h4">Quelle</span><div class="srcs">${srcs.slice(0, 12).map(s => `<button class="src ${on && st.attributes.source === s ? 'sel' : ''}" data-act="source" data-v="${esc(s)}" ${on ? '' : 'disabled'}>${esc(s)}</button>`).join('')}</div>` : '') + this._haLink(id);
      }
      case 'appl': {
        const a = this._index.appls.find(x => x.id === id); if (!a) return '';
        const m = this._appl(a);
        let body;
        if (m.state === 'run'){
          const p = m.progress;
          const rows = [];
          if (m.program) rows.push({icon: APPL_ICON[a.art], label: 'Programm', value: m.program});
          if (m.remain != null) rows.push({icon: 'mdi:clock-outline', label: 'Fertig um', value: `${hhmm(new Date(Date.now() + m.remain * 60000))} Uhr`});
          const C = 2 * Math.PI * 76;
          body = (m.remain != null || p != null ? `<div class="ring-wrap"><svg viewBox="0 0 180 180" aria-hidden="true"><circle class="ring-bg" cx="90" cy="90" r="76"/>${p != null ? `<circle class="ring-fg" cx="90" cy="90" r="76" stroke-dasharray="${(C * p).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 90 90)"/>` : ''}</svg><div class="ring-mid"><b>${m.remain != null ? m.remain : Math.round(p * 100)}</b><span>${m.remain != null ? 'Min. übrig' : '% geschafft'}</span></div></div>` : '<p class="lede">Läuft gerade.</p>') + (rows.length ? this._kvList(rows) : '');
        } else if (m.state === 'done'){
          body = `<div class="done-ic">${ic('mdi:check')}</div><p class="lede" style="text-align:center">${esc(['Fertig', m.since ? agoText(m.since) : '', m.program].filter(Boolean).join(' · '))}</p>${m.dismissed ? '' : `<button class="btn wide" data-act="appl-done" data-id="${a.id}">Erledigt, ausgeräumt</button>`}`;
        } else body = `<p class="lede">${m.state === 'unav' ? 'Gerade nicht erreichbar.' : 'Bereit.'}${m.program ? ` Zuletzt: ${esc(m.program)}.` : ''}</p>`;
        const notify = a.notify && h.states[a.notify] ? `<div class="list"><div class="row"><span class="row-ic" style="--c:var(--accent)">${ic('mdi:bell')}</span><span class="row-main"><span class="row-title">Mitteilung, wenn fertig</span><span class="row-sub">aufs iPhone</span></span><button class="switch ${m.notify ? 'on' : ''}" role="switch" aria-checked="${!!m.notify}" aria-label="Mitteilung, wenn fertig" data-act="toggle" data-id="${esc(a.notify)}"></button></div></div>` : '';
        return this._sheetHead([a.areaId ? this._areaName(a.areaId) : '', a.siteId ? (this._site(a.siteId) || {}).short : ''].filter(Boolean).join(' · '), a.name) + body + notify + (a.status ? this._haLink(a.status) : '');
      }
      case 'cam': {
        const st = h.states[id]; if (!st) return '';
        const name = (this._cfg.cameras.find(c => c.entity === id) || {}).name || st.attributes.friendly_name || id;
        return this._sheetHead(this._ctxOf(id) || 'Kamera', name) + this._camTile({eid: id, name}, 'big') + `<button class="btn wide" data-act="more" data-id="${esc(id)}">${ic('mdi:play')}Live-Bild öffnen</button>`;
      }
      default: return '';
    }
  }
  _openSheet(type, id){
    this._st.sheet = {type, id};
    this._renderSheet();
    this.$layer.hidden = false;
    void this.$layer.offsetWidth; // Layout erzwingen, damit die Einblend-Animation startet
    this.$layer.classList.add('open');
  }
  _closeSheet(){
    if (!this._st.sheet) return;
    this.$layer.classList.remove('open');
    this.$sheet.style.transform = '';
    this._st.sheet = null;
    setTimeout(() => { if (!this._st.sheet){ this.$layer.hidden = true; this.$sheet.innerHTML = ''; } }, 300);
  }
  _renderSheet(){
    if (!this._st.sheet) return;
    const {type, id} = this._st.sheet;
    const keep = this.$sheet.scrollTop;
    const html = this._sheetHtml(type, id);
    if (!html){ this._closeSheet(); return; }
    this.$sheet.innerHTML = `<div class="grab" data-drag aria-hidden="true"></div>${html}`;
    this.$sheet.scrollTop = keep;
    this._bindSlider();
  }
  _bindSlider(){
    const sl = this.$sheet.querySelector('#vslider'); if (!sl) return;
    const eid = this._st.sheet.id, kind = sl.dataset.kind;
    const fill = sl.querySelector('.vfill'), val = this.$sheet.querySelector('#vval');
    let cur = num(sl.getAttribute('aria-valuenow')) || 0;
    const set = pct => {
      cur = Math.max(0, Math.min(100, Math.round(pct)));
      fill.style.height = cur + '%';
      val.textContent = kind === 'light' ? (cur ? cur + ' %' : 'Aus') : `${cur} % offen`;
      sl.setAttribute('aria-valuenow', cur);
      sl.classList.toggle('off', kind === 'light' && !cur);
    };
    const commit = () => {
      if (kind === 'light'){
        this._setOpt(eid, {on: cur > 0, bri: cur || null});
        this._call('light', cur > 0 ? 'turn_on' : 'turn_off', cur > 0 ? {entity_id: eid, brightness_pct: cur} : {entity_id: eid});
      } else this._call('cover', 'set_cover_position', {entity_id: eid, position: cur});
    };
    const fromEv = ev => { const r = sl.getBoundingClientRect(); return (r.bottom - ev.clientY) / r.height * 100; };
    sl.addEventListener('pointerdown', ev => { this._dragging = true; sl.setPointerCapture(ev.pointerId); set(fromEv(ev)); });
    sl.addEventListener('pointermove', ev => { if (this._dragging) set(fromEv(ev)); });
    const end = () => { if (!this._dragging) return; this._dragging = false; commit(); };
    sl.addEventListener('pointerup', end); sl.addEventListener('pointercancel', end);
    sl.addEventListener('keydown', ev => {
      const d = ['ArrowUp', 'ArrowRight'].includes(ev.key) ? 10 : ['ArrowDown', 'ArrowLeft'].includes(ev.key) ? -10 : 0;
      if (!d) return; ev.preventDefault(); set(cur + d); commit();
    });
  }

  /* ---------- Navigation ---------- */
  _saveScroll(){ const st = this._st.stacks[this._st.tab]; if (st.length) st[st.length - 1].scroll = this.$screen.scrollTop; else this._st.rootScroll[this._st.tab] = this.$screen.scrollTop; }
  _restoreScroll(){ const st = this._st.stacks[this._st.tab]; this.$screen.scrollTop = st.length ? (st[st.length - 1].scroll || 0) : (this._st.rootScroll[this._st.tab] || 0); }
  _push(page, id){ this._saveScroll(); this._st.stacks[this._st.tab].push({page, id, scroll: 0}); this._st.anim = 'push'; this._render(); this.$screen.scrollTop = 0; }
  _back(){ const st = this._st.stacks[this._st.tab]; if (!st.length) return; st.pop(); this._st.anim = 'pop'; this._render(); this._restoreScroll(); }
  _switchTab(tab){
    if (tab === this._st.tab){
      if (this._st.stacks[tab].length){ this._st.stacks[tab] = []; this._st.anim = 'pop'; this._render(); this.$screen.scrollTop = 0; }
      else this.$screen.scrollTo({top: 0, behavior: 'smooth'});
      return;
    }
    this._saveScroll(); this._st.tab = tab; this._st.anim = 'tab'; this._render(); this._restoreScroll();
  }
  _onScroll(){ this.$app.classList.toggle('scrolled', this.$screen.scrollTop > 18); }

  /* ---------- Aktionen ---------- */
  _haptic(t = 'light'){ window.dispatchEvent(new CustomEvent('haptic', {detail: t})); }
  _toast(msg){
    const t = this.$toast; t.textContent = msg; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(this._toastT); this._toastT = setTimeout(() => { t.hidden = true; }, 2400);
  }
  _call(domain, service, data){
    this._haptic();
    return this._hass.callService(domain, service, data).catch(err => this._toast(`Das hat nicht geklappt: ${(err && err.message) || err}`)).finally(() => this._queue());
  }
  _moreInfo(eid){ this.dispatchEvent(new CustomEvent('hass-more-info', {detail: {entityId: eid}, bubbles: true, composed: true})); }
  _toggle(eid){
    const st = this._hass.states[eid]; if (!st) return;
    if (st.state === 'unavailable'){ this._toast(`${this._name(eid)} ist gerade nicht erreichbar`); return; }
    const dom = domainOf(eid), on = this._isOn(eid);
    this._setOpt(eid, {on: !on});
    if (dom === 'media_player') this._call(dom, on ? 'turn_off' : 'turn_on', {entity_id: eid});
    else if (dom === 'cover') this._call(dom, on ? 'close_cover' : 'open_cover', {entity_id: eid});
    else this._call(['light', 'switch', 'fan', 'input_boolean'].includes(dom) ? dom : 'homeassistant', 'toggle', {entity_id: eid});
    this._queue();
  }
  _lightsOff(list){
    if (!list.length){ this._toast('Es war schon alles aus'); return; }
    list.forEach(e => this._setOpt(e, {on: false}));
    this._call('light', 'turn_off', {entity_id: list});
    this._toast(`${list.length} ${list.length === 1 ? 'Licht' : 'Lichter'} ausgeschaltet`);
  }
  _openDevice(eid){
    const dom = domainOf(eid);
    if (dom === 'light') this._openSheet('light', eid);
    else if (dom === 'cover') this._openSheet('cover', eid);
    else if (dom === 'media_player') this._openSheet('media', eid);
    else if (dom === 'climate') this._openSheet('therm', eid);
    else this._moreInfo(eid);
  }

  _bind(){
    const app = this.$app;
    this.$screen.addEventListener('scroll', () => { this._lastScroll = Date.now(); this._onScroll(); }, {passive: true});
    // Langes Drücken auf Kacheln
    let lp = null, lpStart = null;
    this._longPressed = false;
    app.addEventListener('pointerdown', ev => {
      const t = ev.target.closest('[data-tile]'); if (!t) return;
      this._busy = true; this._longPressed = false; lpStart = [ev.clientX, ev.clientY];
      clearTimeout(lp);
      lp = setTimeout(() => { this._longPressed = true; this._haptic('medium'); this._openDevice(t.dataset.tile); }, 450);
    });
    app.addEventListener('pointermove', ev => { if (lpStart && (Math.abs(ev.clientX - lpStart[0]) > 8 || Math.abs(ev.clientY - lpStart[1]) > 8)){ clearTimeout(lp); lpStart = null; } });
    const release = () => { clearTimeout(lp); lpStart = null; this._busy = false; };
    app.addEventListener('pointerup', release); app.addEventListener('pointercancel', release);
    app.addEventListener('contextmenu', ev => { if (ev.target.closest('[data-tile]')) ev.preventDefault(); });
    // Sheet nach unten wischen
    let y0 = null, dy = 0;
    this.$sheet.addEventListener('pointerdown', ev => { if (!ev.target.closest('[data-drag]') || ev.target.closest('button')) return; y0 = ev.clientY; dy = 0; this.$sheet.style.transition = 'none'; this.$sheet.setPointerCapture(ev.pointerId); });
    this.$sheet.addEventListener('pointermove', ev => { if (y0 === null) return; dy = Math.max(0, ev.clientY - y0); this.$sheet.style.transform = `translateY(${dy}px)`; });
    const up = () => { if (y0 === null) return; y0 = null; this.$sheet.style.transition = ''; if (dy > 90) this._closeSheet(); else this.$sheet.style.transform = ''; };
    this.$sheet.addEventListener('pointerup', up); this.$sheet.addEventListener('pointercancel', up);
    this._root.addEventListener('keydown', ev => { if (ev.key === 'Escape') this._closeSheet(); });
    // Klicks
    app.addEventListener('click', ev => {
      const tile = ev.target.closest('[data-tile]');
      if (tile){
        if (this._longPressed){ this._longPressed = false; return; }
        const eid = tile.dataset.tile;
        if (domainOf(eid) === 'climate') this._openSheet('therm', eid); else this._toggle(eid);
        return;
      }
      const el = ev.target.closest('[data-act]'); if (!el) return;
      const {act, id} = el.dataset;
      const h = this._hass;
      switch (act){
        case 'tab': this._closeSheet(); this._switchTab(el.dataset.tab); break;
        case 'push': this._closeSheet(); this._push(el.dataset.page, id); break;
        case 'back': this._back(); break;
        case 'menu': this.dispatchEvent(new CustomEvent('hass-toggle-menu', {bubbles: true, composed: true})); break;
        case 'site-sheet': this._openSheet('site'); break;
        case 'lights-sheet': this._openSheet('lights'); break;
        case 'set-site': this._st.site = id; lsSet(this._lsKey('site'), id); this._closeSheet(); this._render(); this.$screen.scrollTop = 0; break;
        case 'sheet-close': this._closeSheet(); break;
        case 'open': this._openDevice(id); break;
        case 'therm': this._openSheet('therm', id); break;
        case 'appl': this._openSheet('appl', id); break;
        case 'cam': this._openSheet('cam', id); break;
        case 'more': this._closeSheet(); this._moreInfo(id); break;
        case 'toggle': this._toggle(id); break;
        case 'scene': { const dom = domainOf(id); this._call(dom === 'script' ? 'script' : dom === 'button' ? 'button' : 'scene', dom === 'button' ? 'press' : 'turn_on', {entity_id: id}); const sc = this._cfg.scenes.find(s => s.entity === id); this._toast(`${(sc && sc.name) || this._name(id)} gestartet`); break; }
        case 'access': {
          const a = this._access().find(x => x.eid === id);
          if (!a || !a.action) break;
          this._call(a.action.svc[0], a.action.svc[1], {entity_id: id});
          this._toast(`${a.name}: ${a.action.label === 'Schließen' ? 'wird geschlossen' : a.action.label === 'Abschließen' ? 'wird abgeschlossen' : 'wird geöffnet'}`);
          break;
        }
        case 'season': {
          const ent = this._cfg.season && this._cfg.season.entity, st = ent && h.states[ent];
          if (!st) break;
          const opt = (st.attributes.options || []).find(o => lc(o).includes(el.dataset.v) || (el.dataset.v === 'sommer' && lc(o).includes('summer')));
          if (opt) this._call(domainOf(ent), 'select_option', {entity_id: ent, option: opt}); else this._toast('In der Auswahl fehlt die Option „Winter“ oder „Sommer“');
          break;
        }
        case 'lights-off-site': this._lightsOff(this._lightsOn(id)); break;
        case 'lights-off-room': this._lightsOff(((this._index.byArea[id] || {}).light || []).filter(e => this._isOn(e))); break;
        case 'lights-off-filter': this._lightsOff(this._lightsOn()); break;
        case 'therm-step': {
          const tid = this._st.sheet && this._st.sheet.id, c = tid && this._climate(tid);
          if (!c || c.target == null) break;
          const v = Math.max(c.min, Math.min(c.max, Math.round((c.target + parseFloat(el.dataset.d) * c.step) * 10) / 10));
          this._setOpt(tid, {target: v});
          this._call('climate', 'set_temperature', {entity_id: tid, temperature: v});
          this._renderSheet();
          break;
        }
        case 'therm-mode': {
          const tid = this._st.sheet && this._st.sheet.id, c = tid && this._climate(tid); if (!c) break;
          if (c.eco){ const none = c.presets.find(p => ['none', 'home', 'comfort'].includes(lc(p))); if (none) this._call('climate', 'set_preset_mode', {entity_id: tid, preset_mode: none}); }
          this._call('climate', 'set_hvac_mode', {entity_id: tid, hvac_mode: el.dataset.v});
          break;
        }
        case 'therm-eco': { const tid = this._st.sheet && this._st.sheet.id, c = tid && this._climate(tid); if (!c) break; const eco = c.presets.find(p => lc(p) === 'eco'); if (eco) this._call('climate', 'set_preset_mode', {entity_id: tid, preset_mode: eco}); break; }
        case 'vol': { const mid = this._st.sheet && this._st.sheet.id, st = mid && h.states[mid]; if (!st) break; const v = Math.max(0, Math.min(1, (num(st.attributes.volume_level) || 0) + parseFloat(el.dataset.d))); this._call('media_player', 'volume_set', {entity_id: mid, volume_level: Math.round(v * 100) / 100}); break; }
        case 'source': { const mid = this._st.sheet && this._st.sheet.id; if (mid) this._call('media_player', 'select_source', {entity_id: mid, source: el.dataset.v}); break; }
        case 'cover': this._call('cover', el.dataset.v, {entity_id: id}); break;
        case 'appl-done': {
          const a = this._index.appls.find(x => x.id === id); if (!a) break;
          const m = this._appl(a); if (m.since) lsSet(`msp-done-${a.id}`, m.since);
          if (this._st.sheet && this._st.sheet.type === 'appl') this._closeSheet();
          this._toast(`${a.name}: erledigt`); this._render();
          break;
        }
        default: break;
      }
    });
  }
}
const CSS_ESC = s => (window.CSS && window.CSS.escape ? window.CSS.escape(s) : String(s).replace(/"/g, '\\"'));

/* ---------- Startseiten-Karte: leitet beim App-Start einmal ins Panel weiter ---------- */
class MultisiteStart extends HTMLElement {
  setConfig(c){ this._ziel = (c && c.ziel) || '/zuhause'; this._render(); }
  set hass(h){ this._hass = h; if (!this._tried){ this._tried = true; setTimeout(() => this._go(), 0); } }
  connectedCallback(){ this._render(); }
  getCardSize(){ return 1; }
  _go(){
    const params = new URLSearchParams(location.search);
    if (window.__multisiteRedirected || params.has('bleiben') || params.has('edit') || this.editMode || this.preview || this.closest && this.closest('hui-card-preview')) return;
    window.__multisiteRedirected = true;
    history.replaceState(null, '', this._ziel || '/zuhause');
    window.dispatchEvent(new CustomEvent('location-changed', {detail: {replace: true}}));
  }
  _render(){
    const ziel = esc(this._ziel || '/zuhause');
    this.innerHTML = `<ha-card style="padding:16px;line-height:1.5">Beim Öffnen der App geht es automatisch weiter zu <a href="${ziel}">${ziel}</a>. Um dieses Dashboard zu bearbeiten, hänge <code>?bleiben</code> an die Adresse.</ha-card>`;
  }
}

if (!customElements.get('multisite-panel')) customElements.define('multisite-panel', MultisitePanel);
if (!customElements.get('multisite-start')){
  customElements.define('multisite-start', MultisiteStart);
  window.customCards = window.customCards || [];
  window.customCards.push({type: 'multisite-start', name: 'Multi-Site Start', description: 'Leitet beim Öffnen der App einmal ins Multi-Site Panel weiter.'});
}
console.info(`%c MULTISITE-PANEL %c ${VERSION} `, 'background:#1C6A54;color:#fff;font-weight:700;border-radius:3px 0 0 3px', 'background:#DAECE4;color:#1C6A54;font-weight:700;border-radius:0 3px 3px 0');
