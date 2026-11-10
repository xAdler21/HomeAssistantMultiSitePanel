/*
 * Editor für das Multi-Site Panel (Seitenleiste „Zuhause bearbeiten“, nur für Admins).
 * Links die Bereiche, in der Mitte die Formulare, rechts die echte App als Live-Vorschau.
 * Speichert über die Integration direkt in Home Assistant; die App auf allen Geräten aktualisiert sich sofort.
 * Keine Build-Schritte, keine Abhängigkeiten. Unbekannte Schlüssel bleiben beim Bearbeiten erhalten.
 */
const VERSION = '0.3.0';

/* ---------- Hilfsfunktionen ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const ic = (icon, cls = '') => `<ha-icon class="i ${cls}" icon="${esc(icon)}"></ha-icon>`;
const arr = v => Array.isArray(v) ? v : v == null ? [] : [v];
const lc = s => String(s ?? '').toLowerCase().trim();
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const domainOf = eid => String(eid).split('.')[0];
const pj = p => esc(JSON.stringify(p));
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* egal */ } };
const isEmpty = v => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
/* Anzeigename wie in HA: ab 2026.4 über formatEntityName, friendly_name ist zur Abkündigung vorgesehen */
function entName(h, st){
  if (!st) return '';
  if (h && typeof h.formatEntityName === 'function'){
    try { const n = h.formatEntityName(st, [{type: 'device'}, {type: 'entity'}], {separator: ' '}); if (n) return String(n); } catch (e) { /* ältere Frontends */ }
  }
  return st.attributes.friendly_name || st.entity_id;
}
const ENTITY_RE =/^(sensor|binary_sensor|switch|light|cover|climate|lock|camera|scene|script|button|input_[a-z_]+|select|weather|media_player|fan|event|number|counter|timer|person|update|valve|water_heater|alarm_control_panel)\.\w+$/;

/* Leere Werte entfernen, damit Konfiguration und YAML aufgeräumt bleiben */
function clean(v){
  if (Array.isArray(v)) return v.map(clean).filter(x => !isEmpty(x));
  if (v && typeof v === 'object'){
    const o = {};
    for (const [k, x] of Object.entries(v)){ const c = clean(x); if (!isEmpty(c)) o[k] = c; }
    return o;
  }
  return typeof v === 'string' && v.trim() === '' ? undefined : v;
}

/* Kurzformen aus YAML in die Form bringen, die die Formulare erwarten */
function prep(raw){
  const c = clone(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
  for (const k of ['standorte', 'versorgung', 'geraete', 'szenen', 'benutzer', 'zugang', 'kameras', 'ereignisse', 'favoriten', 'ausblenden', 'plaene']) if (c[k] != null) c[k] = arr(c[k]);
  arr(c.plaene).forEach(p => { if (p.punkte != null) p.punkte = arr(p.punkte); if (p.standort != null) p.standort = String(p.standort); });
  if (typeof c.heizsaison === 'string') c.heizsaison = {entity: c.heizsaison};
  for (const k of ['zugang', 'kameras']) if (c[k]) c[k] = c[k].map(x => typeof x === 'string' ? {entity: x} : x);
  arr(c.standorte).forEach(s => { if (s.id != null) s.id = String(s.id); for (const k of ['etagen', 'bereiche']) if (s[k] != null) s[k] = arr(s[k]); });
  arr(c.versorgung).forEach(s => { for (const k of ['versorgt', 'werte', 'geplant']) if (s[k] != null) s[k] = arr(s[k]); if (s.standorte != null) s.standorte = arr(s.standorte).map(String); });
  arr(c.geraete).forEach(g => { for (const k of ['laeuft', 'fertig']) if (g[k] != null) g[k] = arr(g[k]); });
  arr(c.benutzer).forEach(u => { if (u.standorte != null) u.standorte = arr(u.standorte).map(String); });
  return c;
}

/* Bildgröße ermitteln und sehr große Bilder verkleinern (Canvas, JPEG). iOS erlaubt nur kleinere Canvas, daher Stufen. */
const ladeBild = blob => new Promise((res, rej) => {
  const url = URL.createObjectURL(blob), im = new Image();
  im.onload = () => { URL.revokeObjectURL(url); res(im); };
  im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('das Bild lässt sich nicht öffnen')); };
  im.src = url;
});
async function bildVorbereiten(file){
  const im = await ladeBild(file), w = im.naturalWidth, h = im.naturalHeight;
  if (Math.max(w, h) <= 8192 && file.size <= 30 * 1024 * 1024) return {blob: file, w, h};
  for (const max of [8192, 6144, 4096]){
    const k = Math.min(1, max / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d'); if (!g) continue;
    g.drawImage(im, 0, 0, cw, ch);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    if (blob && blob.size <= 40 * 1024 * 1024) return {blob, w: cw, h: ch};
  }
  throw new Error('das Bild ist zu groß zum Verkleinern');
}

const getIn = (o, p) =>p.reduce((x, k) => x == null ? undefined : x[k], o);
function setIn(o, p, v){
  let x = o;
  for (let i = 0; i < p.length - 1; i++){
    if (x[p[i]] == null || typeof x[p[i]] !== 'object') x[p[i]] = typeof p[i + 1] === 'number' ? [] : {};
    x = x[p[i]];
  }
  const k = p[p.length - 1];
  if (isEmpty(v) && !Array.isArray(x)) delete x[k]; else x[k] = v;
}
function uniqueId(list, prefix){
  const ids = new Set(arr(list).map(x => String(x && x.id)));
  let n = arr(list).length + 1;
  while (ids.has(`${prefix}_${n}`)) n++;
  return `${prefix}_${n}`;
}
/* Verweise auf einen Standort umbenennen (to) oder entfernen (to = undefined) */
function relinkSite(c, from, to){
  const fix = v => String(v) === from ? to : v;
  const fixList = l => l.map(fix).filter(x => x !== undefined);
  const fixOne = x => { if (x && x.standort != null){ x.standort = fix(x.standort); if (x.standort === undefined) delete x.standort; } };
  arr(c.versorgung).forEach(s => { if (s.standorte) s.standorte = fixList(s.standorte); arr(s.versorgt).forEach(fixOne); });
  for (const k of ['geraete', 'szenen', 'zugang', 'kameras', 'plaene']) arr(c[k]).forEach(fixOne);
  arr(c.benutzer).forEach(u => { if (u.standorte) u.standorte = fixList(u.standorte); });
}

/* ---------- Auswahllisten ---------- */
const ART = [['strom', 'Strom', 'mdi:lightning-bolt', '--c-power'], ['gas', 'Gas', 'mdi:meter-gas', '--c-gas'], ['holz', 'Holz', 'mdi:fireplace', '--c-wood'], ['oel', 'Öl', 'mdi:barrel', '--c-oil'], ['waerme', 'Wärme', 'mdi:radiator', '--c-heat'], ['waermepumpe', 'Wärmepumpe', 'mdi:heat-pump', '--c-heat'], ['wasser', 'Wasser', 'mdi:water', '--c-water'], ['brunnen', 'Brunnen', 'mdi:water-well', '--c-well'], ['internet', 'Internet', 'mdi:web', '--c-net'], ['sonstiges', 'Sonstiges', 'mdi:transmission-tower', '--c-net']];
const GERAETE = [['waschmaschine', 'Waschmaschine', 'mdi:washing-machine'], ['trockner', 'Trockner', 'mdi:tumble-dryer'], ['spuelmaschine', 'Spülmaschine', 'mdi:dishwasher'], ['backofen', 'Backofen', 'mdi:stove'], ['kaffeemaschine', 'Kaffeemaschine', 'mdi:coffee-maker']];
const MESSUNG = [['', 'Automatisch'], ['voll', 'Gemessen'], ['teilweise', 'Teilweise gemessen'], ['therme', 'Über die Therme'], ['keine', 'Nicht gemessen'], ['geplant', 'In Vorbereitung'], ['offen', 'Noch nicht angebunden']];
const SAISON = [['', 'Ganzjährig'], ['winter', 'Nur im Winter'], ['sommer', 'Nur im Sommer']];
const ZUGANG_ART = [['', 'Automatisch'], ['tor', 'Tor'], ['tuer', 'Tür']];
const art = v => ART.find(a => a[0] === v) || ART[0];
const geraet = v => GERAETE.find(a => a[0] === v) || GERAETE[0];
const ICONS = ['home', 'home-variant', 'home-outline', 'home-city', 'home-group', 'office-building', 'domain', 'warehouse', 'factory', 'barn', 'garage', 'garage-variant', 'greenhouse', 'flower', 'tree', 'pine-tree', 'sprout', 'storefront', 'church', 'tent', 'sofa', 'bed', 'stove', 'fridge', 'shower', 'desk', 'tools', 'hammer-wrench', 'wrench', 'car', 'car-electric', 'ev-station', 'lightning-bolt', 'solar-power', 'solar-panel', 'battery', 'transmission-tower', 'meter-electric', 'meter-gas', 'fire', 'fireplace', 'radiator', 'heat-pump', 'thermometer', 'water', 'water-well', 'water-pump', 'water-thermometer', 'barrel', 'gas-cylinder', 'web', 'router-wireless', 'wifi', 'lan', 'cctv', 'camera', 'gate', 'door', 'door-closed', 'lock', 'shield-home', 'alarm-light', 'lightbulb', 'lightbulb-group', 'ceiling-light', 'floor-lamp', 'power-plug', 'power-socket-de', 'fan', 'air-conditioner', 'blinds', 'window-shutter', 'television', 'speaker', 'washing-machine', 'tumble-dryer', 'dishwasher', 'coffee-maker', 'play-circle-outline', 'weather-night', 'weather-sunny', 'sun-snowflake-variant', 'snowflake', 'bell', 'account', 'account-group', 'briefcase', 'calendar', 'clock-outline', 'chart-line', 'information-outline', 'star', 'heart'];

/* ---------- Felder ---------- */
const T = (k, l, o = {}) => ({t: 'text', k, l, ...o});
const E = (k, l, dom = '', o = {}) => ({t: 'entity', k, l, dom, ...o});
const S = (k, l, opts, o = {}) => ({t: 'select', k, l, opts, ...o});
const G = (l, fields, o = {}) => ({t: 'group', l, fields, ...o});
const isStrom = s => (s.art || 'strom') === 'strom';

const SECTIONS = [
  {id: 'allgemein', label: 'Allgemein', icon: 'mdi:tune-variant', tab: 'start', desc: 'Wetter, Favoriten und Darstellung der Startseite.'},
  {id: 'standorte', label: 'Standorte', icon: 'mdi:home-group', tab: 'orte', list: 'standorte', desc: 'Jeder Standort fasst Etagen und Räume aus Home Assistant zusammen.'},
  {id: 'plaene', label: 'Lagepläne', icon: 'mdi:map-outline', tab: 'orte', list: 'plaene', desc: 'Ein Luftbild oder eine Ansicht eures Areals, darauf die Lichter als Knöpfe. Das Bild bleibt in Home Assistant und ist nur angemeldet abrufbar.'},
  {id: 'versorgung', label: 'Versorgung', icon: 'mdi:transmission-tower', tab: 'versorgung', list: 'versorgung', desc: 'Ein Eintrag pro Anschluss: Strom, Gas, Wasser, Heizung, Internet.'},
  {id: 'heizung', label: 'Heizung', icon: 'mdi:thermostat', tab: 'heizung', desc: 'Umschalter zwischen Winter- und Sommerbetrieb.'},
  {id: 'geraete', label: 'Geräte', icon: 'mdi:washing-machine', tab: 'start', list: 'geraete', desc: 'Wasch- und Spülmaschine & Co. erscheinen auf der Startseite, solange sie laufen oder fertig sind.'},
  {id: 'szenen', label: 'Szenen', icon: 'mdi:play-circle-outline', tab: 'start', list: 'szenen', desc: 'Knöpfe auf der Startseite für Szenen, Skripte oder Taster.'},
  {id: 'sicherheit', label: 'Sicherheit', icon: 'mdi:shield-home-outline', tab: 'sicherheit', desc: 'Zusätzliche Türen, Tore, Kameras und Ereignisse.'},
  {id: 'benutzer', label: 'Benutzer', icon: 'mdi:account-multiple', tab: 'orte', list: 'benutzer', desc: 'Welcher Benutzer welche Standorte sieht. Benutzer ohne Regel sehen alles.'},
  {id: 'code', label: 'YAML', icon: 'mdi:code-braces', tab: null, desc: 'Die ganze Konfiguration als Text: zum Sichern, Kopieren oder für Felder, die der Editor nicht kennt.'},
];

const PAGES = {
  allgemein: [
    G('Startseite', [
      E('wetter', 'Wetter', 'weather', {help: 'Für Begrüßung und Wetter oben auf der Startseite'}),
      E('aussentemperatur', 'Außentemperatur', 'sensor', {help: 'Wird statt der Temperatur aus dem Wetter gezeigt'}),
    ]),
    G('Favoriten', [
      T('favoriten_label', 'Label für Favoriten', {ph: 'favorit', help: 'Geräte mit diesem Label erscheinen unter „Favoriten“'}),
      {t: 'entities', k: 'favoriten', l: 'Weitere Favoriten', dom: '', wide: true},
    ]),
    G('Darstellung', [
      {t: 'bool', k: 'menue_knopf', l: 'Menü-Symbol oben links (öffnet die Seitenleiste von Home Assistant)', def: true, wide: true},
      {t: 'entities', k: 'ausblenden', l: 'Ausblenden', dom: '', wide: true, help: 'Diese Geräte erscheinen nirgends in der App'},
    ]),
  ],
  heizung: [
    G('Heizbetrieb Winter/Sommer', [
      E(['heizsaison', 'entity'], 'Umschalter', 'input_select,select', {wide: true, help: 'Auswahl mit den Optionen „Winter“ und „Sommer“. Ohne Umschalter gilt Oktober bis April als Winter.'}),
      T(['heizsaison', 'titel'], 'Überschrift', {ph: 'Heizbetrieb'}),
      T(['heizsaison', 'text'], 'Beschreibung', {ph: 'Welche Heizung gerade läuft'}),
    ], {help: 'Erscheint unter Heizung, sobald ein Anschluss nur im Winter oder nur im Sommer läuft (Versorgung → Betrieb).'}),
  ],
  sicherheit: [
    G('Türen, Tore und Schlösser', [
      {t: 'rows', k: 'zugang', l: 'Zusätzlicher Zugang', add: 'Zugang hinzufügen', wide: true, fields: [
        E('entity', 'Entität', 'cover,lock,button,switch,input_boolean,binary_sensor'), T('name', 'Name', {ph: 'wie in Home Assistant'}),
        {t: 'site', k: 'standort', l: 'Standort'}, S('art', 'Art', ZUGANG_ART),
        E('status', 'Status offen/zu', 'binary_sensor', {help: 'Nur für Taster ohne eigenen Zustand'}),
      ]},
    ], {help: 'Tore (cover) und Schlösser (lock), die einem Raum zugeordnet sind, erscheinen automatisch. Hier nur Zusätzliches eintragen.'}),
    G('Kameras', [
      {t: 'rows', k: 'kameras', l: 'Zusätzliche Kameras', add: 'Kamera hinzufügen', wide: true, fields: [E('entity', 'Kamera', 'camera'), T('name', 'Name', {ph: 'wie in Home Assistant'}), {t: 'site', k: 'standort', l: 'Standort'}]},
    ], {help: 'Kameras, die einem Raum zugeordnet sind, erscheinen automatisch.'}),
    G('Ereignisse', [
      {t: 'entities', k: 'ereignisse', l: 'Für „Heute“ unter Sicherheit', dom: 'binary_sensor,cover,lock,event', wide: true, help: 'z. B. Personenerkennung, Türkontakte, Tore'},
    ]),
  ],
};

const LISTS = {
  standorte: {
    add: 'Standort',
    neu: c => ({id: uniqueId(c.standorte, 'standort'), name: 'Neuer Standort', icon: 'mdi:home'}),
    title: s => s.name || s.id || 'Standort',
    sub: s => { const n = arr(s.etagen).length; return [s.rolle, `${n} ${n === 1 ? 'Etage' : 'Etagen'}`].filter(Boolean).join(' · '); },
    icon: s => s.icon || 'mdi:home',
    fields: [
      G('Name', [
        T('name', 'Name', {req: true, ph: 'z. B. Lindenstraße 4'}),
        T('kurz', 'Kurzname', {ph: 'wie Name', help: 'Für Überschriften und Kacheln'}),
        T('kuerzel', 'Kürzel', {ph: 'wie Kurzname', help: 'Ganz kurz, z. B. „Firma“ oder „1a“'}),
        T('rolle', 'Rolle', {ph: 'z. B. Wohnhaus'}),
        {t: 'icon', k: 'icon', l: 'Symbol', ph: 'mdi:home'},
      ]),
      G('Räume', [
        {t: 'floors', k: 'etagen', l: 'Etagen', wide: true},
        {t: 'areas', k: 'bereiche', l: 'Weitere Räume ohne Etage', wide: true},
        T('bereiche_titel', 'Überschrift für die weiteren Räume', {ph: 'Weitere Bereiche'}),
      ], {help: 'Alle Räume der gewählten Etagen gehören zu diesem Standort. Etagen und Räume legst du in Home Assistant unter Einstellungen → Bereiche an.'}),
      G('Technisch', [T('id', 'ID', {siteId: true, help: 'Interner Name für Verweise aus Versorgung, Szenen und Benutzern. Beim Ändern werden alle Verweise mitgeändert.'})]),
    ],
  },
  plaene: {
    add: 'Lageplan',
    neu: c => ({id: uniqueId(c.plaene, 'plan'), name: 'Neuer Lageplan'}),
    title: p => p.name || 'Lageplan',
    sub: p => { const n = arr(p.punkte).length; return p.bild ? `${n} ${n === 1 ? 'Licht' : 'Lichter'}` : 'noch ohne Bild'; },
    icon: () => 'mdi:map-outline',
    fields: [
      G('Plan', [
        T('name', 'Name', {req: true, ph: 'z. B. Areal'}),
        {t: 'site', k: 'standort', l: 'Standort', help: 'Erscheint dann auch beim Standort. Ohne Standort nur in der Orte-Übersicht (und nur für Benutzer, die alles sehen).'},
      ]),
      G('Bild und Lichter', [{t: 'plan', l: 'Lageplan', wide: true}], {help: 'Ein Luftbild, Drohnenfoto oder eine Ansicht aus dem 3D-Modell. Gut sind 4000 bis 8000 Pixel Breite; größere Bilder werden beim Hochladen verkleinert.'}),
      G('Technisch', [T('id', 'ID')]),
    ],
  },
  versorgung: {
    add: 'Anschluss',
    neu: c => ({id: uniqueId(c.versorgung, 'anschluss'), art: 'strom', name: 'Neuer Anschluss'}),
    title: s => s.name || 'Anschluss',
    sub: s => [art(s.art)[1], s.ort].filter(Boolean).join(' · '),
    icon: s => s.icon || art(s.art)[2],
    color: s => art(s.art)[3],
    fields: [
      G('Anschluss', [
        S('art', 'Art', ART), T('name', 'Name', {req: true}),
        T('ort', 'Ort', {ph: 'z. B. Birkenweg 7'}), T('beschreibung', 'Untertitel', {ph: 'automatisch aus Ort und Standorten'}),
        {t: 'icon', k: 'icon', l: 'Symbol', phFrom: s => art(s.art)[2]},
        {t: 'sites', k: 'standorte', l: 'Gehört zu den Standorten', wide: true, help: 'Bestimmt, bei welchen Standorten der Anschluss erscheint'},
      ]),
      G('Status', [
        S('messung', 'Messung', MESSUNG), S('saison', 'Betrieb', SAISON),
        {t: 'area', k: 'hinweis', l: 'Hinweis', ph: 'z. B. was noch nicht gemessen wird'},
      ]),
      G('Werte jetzt', [
        E('leistung', 'Leistung', 'sensor', {help: 'W oder kW, das Panel rechnet um'}),
        E('solar', 'Solarleistung', 'sensor', {when: isStrom}),
        E('netz', 'Netzleistung', 'sensor', {when: isStrom, help: '+ Bezug, − Einspeisung'}),
        {t: 'bool', k: 'netz_umkehren', l: 'Vorzeichen der Netzleistung umdrehen', def: false, when: isStrom},
        E('status', 'Status', '', {help: 'z. B. Internet online/offline'}),
      ]),
      G('Heute', [
        E('verbrauch_heute', 'Verbrauch heute', 'sensor'),
        E('solar_heute', 'Solar heute', 'sensor', {when: isStrom}),
        E('einspeisung_heute', 'Eingespeist heute', 'sensor', {when: isStrom}),
        E('bezug_heute', 'Bezogen heute', 'sensor', {when: isStrom}),
      ], {help: 'Tageszähler in kWh, z. B. über den Helfer „Verbrauchszähler“ mit täglichem Zyklus.'}),
      G('Versorgt', [
        {t: 'rows', k: 'versorgt', l: 'Gebäude an diesem Anschluss', add: 'Gebäude hinzufügen', wide: true, fields: [
          T('name', 'Name'), {t: 'site', k: 'standort', l: 'Standort'},
          E('leistung', 'Leistung', 'sensor'), E('energie_heute', 'Energie heute', 'sensor'),
          T('hinweis', 'Text statt Wert', {ph: 'z. B. Winter'}),
        ]},
      ]),
      G('Weitere Werte', [
        T('werte_titel', 'Überschrift', {ph: 'Werte'}),
        {t: 'rows', k: 'werte', l: 'Werte', add: 'Wert hinzufügen', wide: true, fields: [T('name', 'Name'), E('entity', 'Entität', ''), {t: 'icon', k: 'icon', l: 'Symbol'}]},
        {t: 'strings', k: 'geplant', l: 'Geplant', ph: 'Zweite PV-Anlage'},
      ]),
      G('Technisch', [T('id', 'ID', {help: 'Interner Name; die App merkt sich darüber z. B. den Verlauf.'})]),
    ],
  },
  geraete: {
    add: 'Gerät',
    neu: () => ({name: 'Neues Gerät', art: 'waschmaschine'}),
    title: g => g.name || 'Gerät',
    sub: g => [geraet(g.art)[1], g.status || g.leistung ? '' : 'noch ohne Entität'].filter(Boolean).join(' · '),
    icon: g => geraet(g.art)[2],
    color: () => '--c-appl',
    fields: [
      G('Gerät', [
        T('name', 'Name', {req: true}), S('art', 'Art', GERAETE),
        {t: 'area1', k: 'bereich', l: 'Raum'},
        {t: 'site', k: 'standort', l: 'Standort', help: 'Nur nötig, wenn der Raum keinem Standort gehört'},
      ]),
      G('Erkennung', [
        E('status', 'Status', 'sensor,select,input_select', {help: 'z. B. „run“ oder „finished“'}),
        E('leistung', 'Leistung', 'sensor', {help: 'Alternativ über die Leistung am Zwischenstecker'}),
        {t: 'number', k: 'schwelle', l: 'Läuft ab (Watt)', ph: '5'},
        {t: 'strings', k: 'laeuft', l: 'Zustände für „läuft“', ph: 'run'},
        {t: 'strings', k: 'fertig', l: 'Zustände für „fertig“', ph: 'finished'},
      ], {help: 'Ein Status oder eine Leistung reicht.'}),
      G('Details', [
        E('restzeit', 'Restzeit', 'sensor'), E('fortschritt', 'Fortschritt (%)', 'sensor'),
        E('programm', 'Programm', 'sensor,select'), E('mitteilung', 'Schalter „Mitteilung, wenn fertig“', 'input_boolean'),
      ]),
    ],
  },
  szenen: {
    add: 'Szene',
    neu: () => ({name: 'Neue Szene', icon: 'mdi:play-circle-outline'}),
    title: s => s.name || s.entity || 'Szene',
    sub: s => s.entity ? s.beschreibung || s.entity : 'noch ohne Entität, erscheint erst danach',
    icon: s => s.icon || 'mdi:play-circle-outline',
    fields: [G('Szene', [
      T('name', 'Name', {req: true}), T('beschreibung', 'Beschreibung', {ph: 'z. B. Licht aus, Tore zu'}),
      E('entity', 'Startet', 'scene,script,button'),
      {t: 'site', k: 'standort', l: 'Standort', help: 'Ohne Standort erscheint die Szene überall'},
      {t: 'icon', k: 'icon', l: 'Symbol', ph: 'mdi:play-circle-outline'},
    ])],
  },
  benutzer: {
    add: 'Regel',
    neu: () => ({}),
    title: u => u.name || u.id || 'Benutzer wählen',
    sub: u => { const n = arr(u.standorte).length; return n ? `sieht ${n} ${n === 1 ? 'Standort' : 'Standorte'}` : 'sieht keinen Standort'; },
    icon: () => 'mdi:account',
    fields: [G('Regel', [
      {t: 'user', l: 'Benutzer', wide: true},
      {t: 'sites', k: 'standorte', l: 'Sieht diese Standorte', wide: true},
    ], {help: 'Nur ein Sichtfilter: Home Assistant kennt keine Rechte pro Gerät, technisch kann jeder angemeldete Benutzer alles schalten.'})],
  },
};

/* ---------- Gestaltung ---------- */
const CSS = `
:host{
  display:block;height:100vh;height:100dvh;
  --bg:#F1F3F0; --card:#FFFFFF; --side:#E9ECE7; --fill:#E5E8E3; --fill-2:#D6DBD4;
  --fg:#111512; --fg-2:#565E58; --fg-3:#858D87; --sep:rgba(17,21,18,.10); --line:rgba(17,21,18,.16);
  --accent:#1C6A54; --accent-fg:#FFFFFF; --accent-tint:#DAECE4;
  --ok:#1A7F45; --ok-bg:#DCF0E3; --warn:#8F5300; --warn-bg:#FBE7C2; --crit:#B9332E; --crit-bg:#F9DCD9;
  --c-power:#D99A00; --c-gas:#2F6FDB; --c-water:#1590B0; --c-well:#0E8478; --c-wood:#9C5B24; --c-oil:#6B5741; --c-net:#6153D0; --c-heat:#E4572E; --c-appl:#178A99;
  --shadow:0 1px 2px rgba(17,21,18,.05),0 3px 12px rgba(17,21,18,.06);
  --shadow-strong:0 8px 30px rgba(17,21,18,.18);
  --font-ui:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
  color:var(--fg);font-family:var(--font-ui);font-size:14px;-webkit-font-smoothing:antialiased;
}
:host([dark]){
  --bg:#0D0F0E; --card:#1A1D1B; --side:#141715; --fill:#252926; --fill-2:#323732;
  --fg:#F1F3F0; --fg-2:#A9B1AB; --fg-3:#737B75; --sep:rgba(241,243,240,.10); --line:rgba(241,243,240,.18);
  --accent:#5BC3A0; --accent-fg:#06190F; --accent-tint:#163228;
  --ok:#52CF85; --ok-bg:#15331F; --warn:#F3B640; --warn-bg:#3A2909; --crit:#FF6E66; --crit-bg:#3C1614;
  --c-power:#F0B321; --c-gas:#6C9AF0; --c-water:#3BB5D5; --c-well:#33B1A3; --c-wood:#CF8A4B; --c-oil:#B49B7D; --c-net:#988DF0; --c-heat:#FF7A4D; --c-appl:#36B3C3;
  --shadow:none; --shadow-strong:0 10px 34px rgba(0,0,0,.55);
  color-scheme:dark;
}
*{box-sizing:border-box}
[hidden]{display:none!important}
button,select,input,textarea{font:inherit;color:inherit}
button{background:none;border:0;padding:0;margin:0;cursor:pointer;text-align:left}
button[disabled]{opacity:.38;cursor:default}
button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
h1,h2,p{margin:0}
.i{--mdc-icon-size:20px;display:inline-flex;flex:none}

.ed{position:relative;height:100%;display:grid;grid-template-columns:212px minmax(0,1fr) 440px;grid-template-rows:58px minmax(0,1fr);grid-template-areas:"bar bar bar" "side main pv";background:var(--bg);overflow:hidden}
.bar{grid-area:bar;display:flex;align-items:center;gap:10px;padding:0 14px 0 16px;border-bottom:1px solid var(--sep);background:var(--card);z-index:7}
.bar-title{display:flex;flex-direction:column;min-width:0;flex:1}
.bar-title strong{font-size:16px;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.status{font-size:12px;color:var(--fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.status.dirty{color:var(--warn)}
.bar-act{display:flex;align-items:center;gap:6px}
.ib{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;color:var(--fg-2);flex:none}
.ib:hover:not([disabled]){background:var(--fill)}
.ib.sm{width:28px;height:28px;border-radius:8px}
.ib.sm .i{--mdc-icon-size:18px}
.ib.danger:hover:not([disabled]){color:var(--crit);background:var(--crit-bg)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 15px;border-radius:999px;background:var(--accent);color:var(--accent-fg);font-weight:600;white-space:nowrap;flex:none}
.btn .i{--mdc-icon-size:18px}
.btn.ghost{background:var(--fill);color:var(--fg)}
.btn.ghost.danger{color:var(--crit)}
.btn:hover:not([disabled]){filter:brightness(1.07)}
.pv-btn,.pv-close{display:none}

.side{grid-area:side;padding:12px 10px;display:flex;flex-direction:column;gap:2px;overflow-y:auto;border-right:1px solid var(--sep);background:var(--side)}
.nav-i{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;color:var(--fg-2);font-weight:600}
.nav-i:hover{background:var(--fill)}
.nav-i.on{background:var(--card);color:var(--fg);box-shadow:var(--shadow)}
.nav-i.on .i{color:var(--accent)}
.nav-i span{flex:1;white-space:nowrap}
.nav-i em{font-style:normal;font-size:12px;color:var(--fg-3);font-variant-numeric:tabular-nums}
.side-foot{margin-top:auto;padding:12px 10px 4px;font-size:11px;color:var(--fg-3)}

.main{grid-area:main;overflow-y:auto;overscroll-behavior:contain;position:relative}
.main-in{max-width:860px;margin:0 auto;padding:22px 24px 90px;display:flex;flex-direction:column;gap:16px}
.head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px 16px;flex-wrap:wrap}
.head h1{font-size:26px;font-weight:700;letter-spacing:-.02em;overflow-wrap:anywhere}
.head-t{display:flex;align-items:center;gap:12px;min-width:0}
.head-act{display:flex;gap:8px;flex-wrap:wrap}
.lead{color:var(--fg-2);margin-top:4px;line-height:1.45;max-width:62ch}
.crumb{display:inline-flex;align-items:center;gap:2px;color:var(--accent);font-weight:600;align-self:flex-start;margin:-4px 0 -6px -6px;padding:4px 6px;border-radius:8px}
.crumb:hover{background:var(--fill)}
.empty{padding:22px;border-radius:16px;background:var(--card);color:var(--fg-2);line-height:1.5;box-shadow:var(--shadow)}
.empty.err{color:var(--crit)}
.loading{padding:40px;color:var(--fg-3)}

.grp{padding:16px;border-radius:16px;background:var(--card);box-shadow:var(--shadow);display:flex;flex-direction:column;gap:12px;min-width:0}
.grp h2{font-size:15px;font-weight:700}
.grp>.help{margin-top:-8px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 14px;min-width:0}
.fld{display:flex;flex-direction:column;gap:5px;min-width:0}
.fld.wide{grid-column:1 / -1}
.lbl{font-size:12.5px;font-weight:600;color:var(--fg-2)}
.lbl i{color:var(--crit);font-style:normal}
.help{font-size:12px;color:var(--fg-3);line-height:1.4}
input[type=text],input[type=number],select,textarea{width:100%;height:38px;padding:0 11px;border-radius:10px;border:1px solid var(--line);background:var(--bg);outline:none;transition:border-color .15s,box-shadow .15s;min-width:0}
textarea{height:auto;padding:9px 11px;resize:vertical;line-height:1.45}
input:focus,select:focus,textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-tint)}
input::placeholder,textarea::placeholder{color:var(--fg-3)}
select{cursor:pointer}
.inp{position:relative}
.inp.icon ha-icon{position:absolute;left:10px;top:9px;--mdc-icon-size:20px;color:var(--fg-2);pointer-events:none}
.inp.icon input{padding-left:38px}
.vline{font-size:12px;line-height:1.35;overflow-wrap:anywhere}
.vline:empty{display:none}
.vline .ok{color:var(--fg-3)}
.vline .bad{color:var(--crit);display:inline-flex;align-items:center;gap:4px}
.vline .bad .i{--mdc-icon-size:14px}
.tgl{flex-direction:row;align-items:center;gap:10px;cursor:pointer;padding:4px 0;position:relative}
.tgl input{position:absolute;opacity:0;pointer-events:none}
.sw{width:42px;height:26px;border-radius:999px;background:var(--fill-2);position:relative;flex:none;transition:background .2s}
.sw::after{content:"";position:absolute;top:2px;left:2px;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .2s}
.tgl input:checked+.sw{background:var(--accent)}
.tgl input:checked+.sw::after{transform:translateX(16px)}
.tgl input:focus-visible+.sw{box-shadow:0 0 0 3px var(--accent-tint)}

.chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.chip{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px 0 9px;border-radius:999px;background:var(--fill);color:var(--fg-2);font-weight:600;font-size:13px;max-width:100%}
.chip .i{--mdc-icon-size:16px}
.chip.on{background:var(--accent-tint);color:var(--accent)}
.chip.bad{background:var(--crit-bg);color:var(--crit)}
span.chip{padding:0 3px 0 12px}
span.chip button{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:inherit;opacity:.65;flex:none}
span.chip button:hover{opacity:1;background:var(--fill-2)}
input.chip-add{width:auto;flex:1;min-width:170px;height:32px;border-radius:999px}
.add-sel{max-width:340px}
.mrows,.rowcs,.icards{display:flex;flex-direction:column;gap:8px}
.mrow{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 10px;border-radius:12px;background:var(--bg);border:1px solid var(--sep);flex-wrap:wrap}
.mrow.bad{border-color:var(--crit)}
.mrow-ic{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--fill);color:var(--fg-2);flex:none}
.mrow-main{display:flex;flex-direction:column;min-width:120px;flex:1}
.mrow-main b{font-weight:600}
.mrow-main small{font-size:12px;color:var(--fg-3)}
.mrow.bad .mrow-main small{color:var(--crit)}
.mrow input{max-width:220px}
.mv{display:flex;gap:2px;flex:none}
.rowc{display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:12px;background:var(--bg);border:1px solid var(--sep)}
.rowc .grid{flex:1}
.add{display:inline-flex;align-items:center;gap:6px;color:var(--accent);font-weight:600;padding:6px 8px 6px 4px;border-radius:8px;align-self:flex-start}
.add:hover{background:var(--fill)}
.icard{display:flex;align-items:center;gap:4px;padding:6px 8px 6px 4px;border-radius:14px;background:var(--card);box-shadow:var(--shadow);transition:box-shadow .15s}
.icard.dragging{opacity:.4}
.icard.drop-before{box-shadow:0 -3px 0 var(--accent)}
.icard.drop-after{box-shadow:0 3px 0 var(--accent)}
.grip{color:var(--fg-3);cursor:grab;display:grid;place-items:center;width:22px;flex:none}
.icard-main{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:6px 4px;border-radius:10px}
.icard-ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--c,var(--accent));color:#fff;flex:none}
:host([dark]) .icard-ic{color:#06190F}
.icard-ic.lg{width:44px;height:44px;border-radius:13px}
.icard-ic .i{--mdc-icon-size:22px}
.icard-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.icard-txt b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.icard-txt small{font-size:12.5px;color:var(--fg-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chev{color:var(--fg-3)}
.pill{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;padding:3px 9px 3px 7px;border-radius:999px;white-space:nowrap}
.pill .i{--mdc-icon-size:14px}
.pill.warn{background:var(--warn-bg);color:var(--warn)}

.pe{gap:10px}
.pe-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:200px;padding:24px;border:2px dashed var(--line);border-radius:14px;background:var(--bg);color:var(--fg-2);text-align:center;cursor:pointer}
.pe-drop:hover{border-color:var(--accent);color:var(--accent)}
.pe-drop .i{--mdc-icon-size:36px}
.pe-drop b{font-size:15px;color:var(--fg)}
.pe-drop span{font-size:12.5px;max-width:46ch}
.pe-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.pe-info{flex:1;font-size:12px;color:var(--fg-3);font-variant-numeric:tabular-nums}
.pe-scroll{max-height:70vh;overflow:auto;border-radius:12px;background:#1A1D1B;overscroll-behavior:contain}
.pe-canvas{position:relative;min-width:100%;user-select:none;-webkit-user-select:none;touch-action:none}
.pe-canvas.arming{cursor:crosshair}
.pe-canvas img{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
.pe-pts{position:absolute;inset:0}
.pe-pt{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:grab;touch-action:none}
.pe-pt .i{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#F0B321;color:#111;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);--mdc-icon-size:18px}
.pe-pt span{font-size:11px;font-weight:600;color:#fff;background:rgba(0,0,0,.65);padding:1px 6px;border-radius:6px;white-space:nowrap;position:absolute;top:100%;margin-top:2px;pointer-events:none}
.pe-pt.drag{cursor:grabbing;z-index:2}
.pe-pt.drag .i{transform:scale(1.15)}
.pe-pt.armed .i{background:var(--accent);color:var(--accent-fg);animation:pePulse 1s ease-in-out infinite}
.pe-pt.bad .i{background:var(--crit);color:#fff}
@keyframes pePulse{50%{box-shadow:0 0 0 8px var(--accent-tint)}}
.help.pe-armed{color:var(--accent);font-weight:600}
.mrow.armed{border-color:var(--accent)}
textarea.code{min-height:420px;height:min(62vh,680px);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.5;white-space:pre;tab-size:2}
.code-act{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.code-msg{font-size:13px;color:var(--fg-2)}
.code-msg.bad{color:var(--crit)}

.pv{grid-area:pv;display:flex;flex-direction:column;align-items:center;gap:12px;padding:14px 16px 16px;border-left:1px solid var(--sep);background:var(--side);min-height:0;z-index:6}
.pv-top{width:100%;max-width:392px;display:flex;flex-direction:column;gap:8px}
.pv-row{display:flex;align-items:center;gap:8px}
.pv-row strong{flex:1;font-size:14px}
.pv-row select{width:auto;height:32px;font-size:13px;padding:0 8px}
.hints{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;font-size:13px;font-weight:600}
.hints .i{--mdc-icon-size:18px}
.hints.warn{background:var(--warn-bg);color:var(--warn)}
.hints.ok{background:var(--ok-bg);color:var(--ok)}
.phone{position:relative;width:392px;max-width:100%;flex:1;min-height:0;max-height:852px;border-radius:46px;padding:10px;background:#0B0D0C;box-shadow:var(--shadow-strong)}
.phone multisite-panel{display:block;width:100%;height:100%;border-radius:36px;overflow:hidden;position:relative;isolation:isolate}
.phone-off{display:grid;place-items:center;height:100%;color:#8A928C;text-align:center;padding:24px}

.dd{position:absolute;z-index:50;max-height:320px;overflow-y:auto;background:var(--card);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-strong);padding:4px}
.dd-i{display:flex;flex-direction:column;gap:1px;padding:7px 10px;border-radius:8px;cursor:pointer}
.dd-i b{font-weight:600;font-size:13.5px}
.dd-i small{font-size:12px;color:var(--fg-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dd-i.act,.dd-i:hover{background:var(--accent-tint)}
.dd.icon .dd-i{flex-direction:row;align-items:center;gap:10px}
.toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:60;background:var(--fg);color:var(--bg);font-weight:600;padding:10px 16px;border-radius:999px;box-shadow:var(--shadow-strong);max-width:calc(100% - 32px);text-align:center;animation:toastIn .25s ease-out}
.toast.err{background:var(--crit);color:#fff}
@keyframes toastIn{from{transform:translate(-50%,10px);opacity:0}to{transform:translate(-50%,0);opacity:1}}

@media (max-width:1280px){
  .ed{grid-template-columns:200px minmax(0,1fr);grid-template-areas:"bar bar" "side main"}
  .pv{position:absolute;top:58px;right:0;bottom:0;width:440px;max-width:100%;transform:translateX(105%);transition:transform .25s cubic-bezier(.2,.8,.2,1);box-shadow:var(--shadow-strong)}
  .ed.pv-open .pv{transform:none}
  .pv-btn,.pv-close{display:grid}
}
@media (max-width:820px){
  .ed{grid-template-columns:minmax(0,1fr);grid-template-rows:58px auto minmax(0,1fr);grid-template-areas:"bar" "side" "main"}
  .side{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--sep);padding:8px 10px;gap:4px;scrollbar-width:none}
  .nav-i{flex:none;padding:7px 11px}
  .nav-i em,.side-foot,.hide-s{display:none}
  .grid{grid-template-columns:minmax(0,1fr)}
  .main-in{padding:16px 14px 90px}
  .pv{width:100%;top:0;z-index:8}
  .bar .btn{padding:0 12px}
}
@media (prefers-reduced-motion: reduce){ *,*::before,*::after{animation:none!important;transition:none!important} }
`;

/* ---------- Editor ---------- */
class MultisiteEditor extends HTMLElement {
  constructor(){
    super();
    this._root = this.attachShadow({mode: 'open'});
    this._root.innerHTML = `<style>${CSS}</style><div class="ed" id="ed"><header class="bar" id="bar"></header><nav class="side" id="side" aria-label="Bereiche"></nav><main class="main" id="main"><div class="loading">Wird geladen …</div></main><aside class="pv" id="pv" aria-label="Vorschau"><div class="pv-top" id="pvTop"></div><div class="phone" id="phone"></div></aside><div class="dd" id="dd" role="listbox" hidden></div><div class="toast" id="toast" role="status" aria-live="polite" hidden></div></div>`;
    const $ = id => this._root.getElementById(id);
    this.$ed = $('ed'); this.$bar = $('bar'); this.$side = $('side'); this.$main = $('main'); this.$pvTop = $('pvTop'); this.$phone = $('phone'); this.$dd = $('dd'); this.$toast = $('toast');
    this._sec = SECTIONS.some(s => s.id === lsGet('msp-editor-sec')) ? lsGet('msp-editor-sec') : 'allgemein';
    this._item = null; this._undo = []; this._redo = []; this._lastType = 0;
    this._users = null; this._pvUser = ''; this._pvOpen = false; this._hints = 0;
    this._bind();
  }

  /* Von Home Assistant gesetzt */
  set hass(h){
    this._hass = h;
    this.toggleAttribute('dark', !!(h.themes && h.themes.darkMode));
    if (this._preview && this._preview.panel) this._preview.hass = this._pvHass();
    if (!h.floors && !this._floorsReq && h.callWS){
      this._floorsReq = true;
      h.callWS({type: 'config/floor_registry/list'}).then(list => { this._floorsWS = Object.fromEntries(arr(list).map(f => [f.floor_id, f])); if (this._draft) this._renderMain(); }).catch(() => {});
    }
    this._start();
  }
  get hass(){ return this._hass; }
  set panel(p){ this._panel = p; this._start(); }
  get panel(){ return this._panel; }
  set narrow(n){ if (this._narrow !== n){ this._narrow = n; this._renderBar(); } }
  get narrow(){ return this._narrow; }
  set route(r){ this._route = r; }
  get route(){ return this._route; }

  connectedCallback(){
    this._onUnload = ev => { if (this._dirty()){ ev.preventDefault(); ev.returnValue = ''; } };
    this._onWinKey = ev => this._globalKey(ev);
    window.addEventListener('beforeunload', this._onUnload);
    window.addEventListener('keydown', this._onWinKey);
    if (this._started) this._subscribe();
  }
  disconnectedCallback(){
    window.removeEventListener('beforeunload', this._onUnload);
    window.removeEventListener('keydown', this._onWinKey);
    this._unsubscribe();
  }

  async _start(){
    if (this._started || !this._hass || !this._panel) return;
    this._started = true;
    this._renderAll();
    const mod = this._panel.config && this._panel.config.panel_modul;
    if (mod && !customElements.get('multisite-panel')){
      try { await import(mod); } catch (e){ console.error('[multisite-editor] Panel für die Vorschau konnte nicht geladen werden', e); }
    }
    if (customElements.get('multisite-panel')){
      this._preview = document.createElement('multisite-panel');
      this._preview.narrow = true;
      this._preview.addEventListener('hass-toggle-menu', ev => ev.stopPropagation());
      this._preview.addEventListener('msp-gerendert', () => this._renderHints());
      this.$phone.appendChild(this._preview);
    } else this.$phone.innerHTML = '<div class="phone-off">Die Vorschau ist nicht verfügbar.</div>';
    this._subscribe();
    this._loadUsers();
  }
  _subscribe(){
    if (this._sub || !this.isConnected || !this._hass || !this._hass.connection) return;
    const sub = this._sub = this._hass.connection.subscribeMessage(m => this._onConfig(m.config), {type: 'multisite_panel/subscribe'});
    sub.catch(e => { if (this._sub === sub) this._sub = null; this._loadErr = (e && e.message) || String(e); this._renderAll(); });
  }
  _unsubscribe(){
    if (!this._sub) return;
    this._sub.then(unsub => unsub()).catch(() => {});
    this._sub = null;
  }
  async _loadUsers(){
    try {
      const list = await this._hass.callWS({type: 'config/auth/list'});
      this._users = arr(list).filter(u => !u.system_generated && u.is_active !== false).map(u => ({id: u.id, name: u.name, admin: arr(u.group_ids).includes('system-admin')})).sort((a, b) => String(a.name).localeCompare(b.name, 'de'));
    } catch (e){ this._users = []; }
    this._renderPvTop();
    if (this._sec === 'benutzer' && this._draft) this._renderMain();
  }

  /* ---------- Konfiguration laden und speichern ---------- */
  _onConfig(raw){
    const incoming = prep(raw), key = JSON.stringify(clean(incoming));
    if (this._pending === key){ this._pending = null; this._saved = incoming; this._renderBar(); return; }
    if (this._saved && key === JSON.stringify(clean(this._saved))) return;
    const first = !this._saved;
    if (first || !this._dirty()){
      this._saved = incoming; this._draft = clone(incoming); this._external = false;
      if (first) this._restoreDraft(); else { this._undo = []; this._redo = []; }
      this._renderAll();
      this._syncPreview();
    } else {
      // Jemand hat woanders gespeichert, während hier noch ungespeicherte Änderungen sind
      this._saved = incoming; this._external = true; this._renderBar();
    }
  }
  _dirty(){ return !!(this._draft && this._saved) && JSON.stringify(clean(this._draft)) !== JSON.stringify(clean(this._saved)); }
  _draftKey(){ return `msp-editor-draft-${(this._hass && this._hass.user && this._hass.user.id) || 'x'}`; }
  _persistDraft(){
    clearTimeout(this._persistT);
    this._persistT = setTimeout(() => {
      if (this._dirty()) lsSet(this._draftKey(), JSON.stringify({base: JSON.stringify(clean(this._saved)), draft: this._draft}));
      else lsDel(this._draftKey());
    }, 500);
  }
  _restoreDraft(){
    try {
      const s = JSON.parse(lsGet(this._draftKey()) || 'null');
      if (s && s.draft && s.base === JSON.stringify(clean(this._saved))){ this._draft = prep(s.draft); if (this._dirty()) this._toast('Ungespeicherter Entwurf wiederhergestellt'); }
    } catch (e){ /* egal */ }
  }
  async _save(){
    if (this._saving || !this._dirty()) return;
    const payload = clean(this._draft);
    this._saving = true; this._pending = JSON.stringify(clean(prep(payload))); this._renderBar();
    try {
      await this._hass.callWS({type: 'multisite_panel/config/save', config: payload});
      this._saved = prep(payload); this._external = false;
      this._toast('Gespeichert – die App zeigt es sofort');
    } catch (e){
      this._pending = null;
      this._toast(`Speichern fehlgeschlagen: ${(e && e.message) || e}`, true);
    }
    this._saving = false; this._renderBar(); this._persistDraft();
  }

  /* ---------- Änderungen ---------- */
  /* Vor jeder Änderung den Stand für „Rückgängig“ merken; zusammenhängendes Tippen zählt als ein Schritt */
  _snap(typing = false){
    const now = Date.now();
    if (typing && now - this._lastType < 1200){ this._lastType = now; return; }
    this._lastType = typing ? now : 0;
    this._undo.push(JSON.stringify(this._draft));
    if (this._undo.length > 100) this._undo.shift();
    this._redo = [];
  }
  _changed(form = false){
    if (form){ this._renderSide(); this._renderMain(); }
    this._renderBar();
    this._schedulePreview();
    this._persistDraft();
  }
  _undoRedo(dir){
    const from = dir < 0 ? this._undo : this._redo, to = dir < 0 ? this._redo : this._undo;
    if (!from.length || !this._draft) return;
    to.push(JSON.stringify(this._draft));
    this._draft = JSON.parse(from.pop());
    this._lastType = 0; this._codeLoaded = false; this._peArmed = null;
    const s = this._section();
    if (s.list && this._item != null && !arr(this._draft[s.list])[this._item]) this._item = null;
    this._changed(true);
  }

  /* ---------- Vorschau ---------- */
  _schedulePreview(delay = 250){
    clearTimeout(this._pvT);
    this._pvT = setTimeout(() => this._applyPreview(), delay);
  }
  _applyPreview(){
    const p = this._preview;
    if (!p || !this._draft) return;
    p.panel = {url_path: 'vorschau', config: {...clean(this._draft), vorschau: true}};
    if (!p.hass) p.hass = this._pvHass();
    // zeige() fehlt, wenn noch die alte Panel-Datei (vor 0.2.0) im Browser geladen ist
    if (this._pvNav && typeof p.zeige === 'function'){ const n = this._pvNav; this._pvNav = null; p.zeige(n.tab, n.page, n.id); }
  }
  /* Die Vorschau zeigt passend zum Formular den richtigen Bereich */
  _syncPreview(){
    const s = this._section();
    if (s.tab){
      const it = s.list && this._item != null ? arr(this._draft[s.list])[this._item] : null;
      let page = null, id = null;
      if (it && s.list === 'standorte'){ page = 'site'; id = String(it.id ?? `standort_${this._item + 1}`); }
      if (it && s.list === 'versorgung'){ page = 'supply'; id = String(it.id ?? `versorgung_${this._item + 1}`); }
      if (it && s.list === 'plaene' && it.bild){ page = 'plan'; id = String(it.id ?? `plan_${this._item + 1}`); }
      this._pvNav = {tab: s.tab, page, id};
    }
    this._schedulePreview(0);
  }
  _pvHass(){
    const u = this._pvUser && arr(this._users).find(x => x.id === this._pvUser);
    return u ? {...this._hass, user: {...this._hass.user, id: u.id, name: u.name, is_admin: u.admin}} : this._hass;
  }
  _renderHints(){
    const n = arr(this._preview && this._preview.hinweise).filter(i => i.level !== 'info').length;
    if (n !== this._hints){ this._hints = n; this._renderPvTop(); }
  }

  /* ---------- Rendern ---------- */
  _section(){ return SECTIONS.find(s => s.id === this._sec) || SECTIONS[0]; }
  _renderAll(){ this._renderBar(); this._renderSide(); this._renderMain(); this._renderPvTop(); }
  _renderBar(){
    const dirty = this._dirty();
    const status = this._saving ? 'Speichert …'
      : this._loadErr && !this._draft ? 'Konnte nicht geladen werden'
      : !this._draft ? 'Wird geladen …'
      : dirty ? (this._external ? 'Inzwischen woanders gespeichert – Speichern überschreibt das' : 'Ungespeicherte Änderungen')
      : 'Alles gespeichert';
    this.$bar.innerHTML = `${this._narrow ? `<button class="ib" data-act="menu" title="Menü" aria-label="Menü">${ic('mdi:menu')}</button>` : ''}
      <div class="bar-title"><strong>Zuhause bearbeiten</strong><span class="status ${dirty ? 'dirty' : ''}">${esc(status)}</span></div>
      <div class="bar-act">
        <button class="ib hide-s" data-act="undo" title="Rückgängig (Strg+Z)" aria-label="Rückgängig" ${this._undo.length ? '' : 'disabled'}>${ic('mdi:undo')}</button>
        <button class="ib hide-s" data-act="redo" title="Wiederholen (Strg+Y)" aria-label="Wiederholen" ${this._redo.length ? '' : 'disabled'}>${ic('mdi:redo')}</button>
        <button class="ib pv-btn" data-act="pv-toggle" title="Vorschau" aria-label="Vorschau">${ic('mdi:cellphone')}</button>
        <button class="btn ghost hide-s" data-act="app">${ic('mdi:open-in-new')}App</button>
        <button class="btn ghost hide-s" data-act="discard" ${dirty ? '' : 'disabled'}>Verwerfen</button>
        <button class="btn" data-act="save" ${dirty && !this._saving ? '' : 'disabled'}>${ic('mdi:content-save-outline')}Speichern</button>
      </div>`;
  }
  _renderSide(){
    this.$side.innerHTML = SECTIONS.map(s => {
      const n = s.list && this._draft ? arr(this._draft[s.list]).length : null;
      return `<button class="nav-i ${this._sec === s.id ? 'on' : ''}" data-act="sec" data-sec="${s.id}" aria-current="${this._sec === s.id ? 'page' : 'false'}">${ic(s.icon)}<span>${esc(s.label)}</span>${n != null ? `<em>${n}</em>` : ''}</button>`;
    }).join('') + `<div class="side-foot">Multi-Site Panel ${VERSION}</div>`;
  }
  _renderPvTop(){
    const users = arr(this._users), n = this._hints;
    this.$pvTop.innerHTML = `<div class="pv-row"><strong>Vorschau</strong>${users.length ? `<select data-change="pv-user" aria-label="Vorschau als Benutzer"><option value="">als ich</option>${users.map(u => `<option value="${esc(u.id)}" ${this._pvUser === u.id ? 'selected' : ''}>als ${esc(u.name)}</option>`).join('')}</select>` : ''}<button class="ib pv-close" data-act="pv-toggle" title="Vorschau schließen" aria-label="Vorschau schließen">${ic('mdi:close')}</button></div>
      <button class="hints ${n ? 'warn' : 'ok'}" data-act="hints">${ic(n ? 'mdi:alert' : 'mdi:check-circle')}${n ? `${n} ${n === 1 ? 'Hinweis' : 'Hinweise'} zur Einrichtung` : 'Einrichtung in Ordnung'}</button>`;
  }
  _renderMain(){
    if (!this._draft){
      this.$main.innerHTML = `<div class="main-in">${this._loadErr ? `<div class="empty err">Die Konfiguration konnte nicht geladen werden: ${esc(this._loadErr)}<br>Ist die Integration „Multi-Site Panel“ eingerichtet?</div>` : '<div class="loading">Wird geladen …</div>'}</div>`;
      return;
    }
    const s = this._section(), key = `${s.id}:${this._item}`;
    const keep = key === this._mainKey ? this.$main.scrollTop : 0;
    let html;
    if (s.id === 'code') html = this._codeView(s);
    else if (s.list && this._item == null) html = this._listView(s);
    else if (s.list) html = this._itemView(s);
    else html = this._head(s) + this._fields(PAGES[s.id], []);
    this.$main.innerHTML = `<div class="main-in">${html}</div>`;
    this._mountImages();
    this.$main.scrollTop = keep;
    this._mainKey = key;
    if (s.id === 'code' && !this._codeLoaded) this._loadYaml();
  }
  _head(s, right = ''){ return `<div class="head"><div><h1>${esc(s.label)}</h1><p class="lead">${esc(s.desc)}</p></div>${right}</div>`; }

  _listView(s){
    const L = LISTS[s.list], items = arr(this._draft[s.list]);
    const cards = items.map((it, i) => {
      const bad = this._missing(it);
      return `<div class="icard" draggable="true" data-drag="${i}"><span class="grip" title="Ziehen zum Sortieren">${ic('mdi:drag-vertical')}</span><button class="icard-main" data-act="open" data-i="${i}"><span class="icard-ic" style="--c:var(${L.color ? L.color(it) : '--accent'})">${ic(L.icon(it))}</span><span class="icard-txt"><b>${esc(L.title(it))}</b><small>${esc(L.sub(it))}</small></span>${bad ? `<span class="pill warn" title="Entitäten, die es in Home Assistant nicht gibt">${ic('mdi:alert')}${bad}</span>` : ''}${ic('mdi:chevron-right', 'chev')}</button>${this._mv([s.list], i, items.length)}</div>`;
    }).join('');
    return this._head(s, `<button class="btn" data-act="new">${ic('mdi:plus')}${esc(L.add)}</button>`)
      + (items.length ? `<div class="icards">${cards}</div>` : `<div class="empty">Noch nichts angelegt. Mit „${esc(L.add)}“ geht es los.</div>`);
  }
  _itemView(s){
    const L = LISTS[s.list], it = arr(this._draft[s.list])[this._item];
    if (!it){ this._item = null; return this._listView(s); }
    return `<button class="crumb" data-act="back">${ic('mdi:chevron-left')}${esc(s.label)}</button>
      <div class="head"><div class="head-t"><span class="icard-ic lg" style="--c:var(${L.color ? L.color(it) : '--accent'})">${ic(L.icon(it))}</span><h1 id="itemTitle">${esc(L.title(it))}</h1></div>
      <div class="head-act"><button class="btn ghost" data-act="dup">${ic('mdi:content-copy')}Duplizieren</button><button class="btn ghost danger" data-act="del">${ic('mdi:delete-outline')}Löschen</button></div></div>
      ${this._fields(L.fields, [s.list, this._item])}`;
  }
  _codeView(s){
    return this._head(s) + `<textarea class="code" id="yaml" spellcheck="false" aria-label="Konfiguration als YAML">${esc(this._yaml ?? 'Wird geladen …')}</textarea>
      <div class="code-act"><button class="btn" data-act="yaml-apply">${ic('mdi:check')}Übernehmen</button><button class="btn ghost" data-act="yaml-reload">${ic('mdi:refresh')}Neu aus dem Entwurf</button><span class="code-msg ${this._yamlBad ? 'bad' : ''}" id="yamlMsg">${esc(this._yamlMsg || '')}</span></div>
      <p class="help">„Übernehmen“ ersetzt den Entwurf, gespeichert wird erst mit „Speichern“. Zum Sichern den Text kopieren; eine alte multisite-panel.yaml kannst du hier einfügen.</p>`;
  }
  async _loadYaml(){
    this._codeLoaded = true;
    try { this._yaml = (await this._hass.callWS({type: 'multisite_panel/yaml/dump', config: clean(this._draft)})).yaml; }
    catch (e){ this._yaml = JSON.stringify(clean(this._draft), null, 2); this._yamlMsg = 'YAML ist gerade nicht verfügbar, angezeigt wird JSON (geht genauso)'; }
    const ta = this._root.getElementById('yaml'); if (ta) ta.value = this._yaml;
    const m = this._root.getElementById('yamlMsg'); if (m) m.textContent = this._yamlMsg || '';
  }
  async _applyYaml(){
    const ta = this._root.getElementById('yaml'); if (!ta) return;
    try {
      const cfg = (await this._hass.callWS({type: 'multisite_panel/yaml/parse', yaml: ta.value})).config;
      this._snap(); this._draft = prep(cfg); this._yaml = ta.value;
      this._yamlMsg = 'Übernommen, noch nicht gespeichert'; this._yamlBad = false;
      this._changed(true);
    } catch (e){
      this._yamlMsg = `Fehler: ${(e && e.message) || e}`; this._yamlBad = true;
      const m = this._root.getElementById('yamlMsg'); if (m){ m.textContent = this._yamlMsg; m.classList.add('bad'); }
    }
  }

  /* ---------- Formularfelder ---------- */
  _fields(fields, base){
    const obj = getIn(this._draft, base) || {};
    return fields.filter(f => !f.when || f.when(obj)).map(f => this._field(f, base, obj)).join('');
  }
  _field(f, base, obj){
    if (f.t === 'group') return `<section class="grp"><h2>${esc(f.l)}</h2>${f.help ? `<p class="help">${esc(f.help)}</p>` : ''}<div class="grid">${this._fields(f.fields, base)}</div></section>`;
    const path = f.k == null ? base : [...base, ...[].concat(f.k)];
    const v = getIn(this._draft, path), P = pj(path), L = esc(f.l);
    const ph = f.phFrom ? f.phFrom(obj) : f.ph || '';
    const wrap = (inner, wide = f.wide) => `<div class="fld ${wide ? 'wide' : ''}"><span class="lbl">${L}${f.req ? ' <i>*</i>' : ''}</span>${inner}${f.help ? `<span class="help">${esc(f.help)}</span>` : ''}</div>`;
    switch (f.t){
      case 'text': return wrap(`<input type="text" data-path="${P}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" ${f.siteId ? 'data-site-id="1"' : ''} aria-label="${L}">`);
      case 'area': return wrap(`<textarea rows="3" data-path="${P}" placeholder="${esc(ph)}" aria-label="${L}">${esc(v ?? '')}</textarea>`, true);
      case 'number': return wrap(`<input type="number" step="any" data-path="${P}" data-type="number" value="${esc(v ?? '')}" placeholder="${esc(ph)}" aria-label="${L}">`);
      case 'select': {
        const known = f.opts.some(o => o[0] === String(v ?? ''));
        return wrap(`<select data-path="${P}" data-type="select" aria-label="${L}">${f.opts.map(o => `<option value="${esc(o[0])}" ${String(v ?? '') === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}${known ? '' : `<option value="${esc(v)}" selected>${esc(v)} (unbekannt)</option>`}</select>`);
      }
      case 'bool': { const on = v == null ? !!f.def : !!v; return `<label class="fld tgl ${f.wide ? 'wide' : ''}"><input type="checkbox" data-path="${P}" data-type="bool" data-def="${f.def ? 1 : 0}" ${on ? 'checked' : ''}><span class="sw"></span><span>${L}</span></label>`; }
      case 'entity': return wrap(`<div class="inp"><input type="text" data-path="${P}" data-pick="entity" data-dom="${esc(f.dom || '')}" value="${esc(v ?? '')}" placeholder="Suchen: Name oder ${esc((f.dom || 'sensor').split(',')[0])}.…" spellcheck="false" autocomplete="off" aria-label="${L}"></div><span class="vline">${this._entityLine(v)}</span>`);
      case 'icon': return wrap(`<div class="inp icon"><ha-icon icon="${esc(v || ph || 'mdi:help-circle-outline')}" data-ph="${esc(ph || 'mdi:help-circle-outline')}"></ha-icon><input type="text" data-path="${P}" data-pick="icon" value="${esc(v ?? '')}" placeholder="${esc(ph || 'mdi:…')}" spellcheck="false" autocomplete="off" aria-label="${L}"></div>`);
      case 'site': {
        const sites = arr(this._draft.standorte), known = !v || sites.some(s => String(s.id) === String(v));
        return wrap(`<select data-path="${P}" data-type="select" aria-label="${L}"><option value="">— keiner —</option>${sites.map(s => `<option value="${esc(s.id)}" ${String(s.id) === String(v ?? '') ? 'selected' : ''}>${esc(s.kurz || s.name || s.id)}</option>`).join('')}${known ? '' : `<option value="${esc(v)}" selected>${esc(v)} (gibt es nicht)</option>`}</select>`);
      }
      case 'sites': return wrap(this._sitesChips(path, arr(v)), true);
      case 'floors': return wrap(this._floorsEditor(path, arr(v)), true);
      case 'areas': return wrap(this._areasEditor(path, arr(v)), true);
      case 'area1': return wrap(this._areaSelect(path, v, L));
      case 'strings': return wrap(this._stringsEditor(path, arr(v), ph), true);
      case 'entities': return wrap(this._entitiesEditor(path, arr(v), f.dom), true);
      case 'rows': return wrap(this._rowsEditor(f, path, arr(v)), true);
      case 'user': return wrap(this._userSelect(base, obj), true);
      case 'plan': return this._planEditor(base, obj);
      default: return '';
    }
  }
  _fmt(st){ return this._hass.formatEntityState ? this._hass.formatEntityState(st) : `${st.state}${st.attributes.unit_of_measurement ? ' ' + st.attributes.unit_of_measurement : ''}`; }
  _entityLine(v){
    if (!v) return '';
    const st = this._hass.states[v];
    if (!st) return `<span class="bad">${ic('mdi:alert')}Gibt es in Home Assistant nicht</span>`;
    return `<span class="ok">${esc(entName(this._hass, st))} · ${esc(this._fmt(st))}</span>`;
  }
  _missing(o){
    let n = 0;
    const walk = v => { if (typeof v === 'string'){ if (ENTITY_RE.test(v) && !this._hass.states[v]) n++; } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
    walk(o);
    return n;
  }
  _mv(path, i, n){
    const P = pj(path);
    return `<span class="mv"><button class="ib sm" data-act="mv" data-path="${P}" data-i="${i}" data-d="-1" title="Nach oben" aria-label="Nach oben" ${i ? '' : 'disabled'}>${ic('mdi:chevron-up')}</button><button class="ib sm" data-act="mv" data-path="${P}" data-i="${i}" data-d="1" title="Nach unten" aria-label="Nach unten" ${i < n - 1 ? '' : 'disabled'}>${ic('mdi:chevron-down')}</button><button class="ib sm danger" data-act="rm" data-path="${P}" data-i="${i}" title="Entfernen" aria-label="Entfernen">${ic('mdi:close')}</button></span>`;
  }
  _floors(){ return this._hass.floors || this._floorsWS || {}; }
  _sitesChips(path, sel){
    const sites = arr(this._draft.standorte), P = pj(path);
    if (!sites.length) return '<p class="help">Lege zuerst einen Standort an.</p>';
    const ids = sites.map(s => String(s.id)), on = new Set(sel.map(String));
    const unknown = [...on].filter(x => !ids.includes(x));
    return `<div class="chips">${sites.map(s => { const id = String(s.id), o = on.has(id); return `<button class="chip ${o ? 'on' : ''}" data-act="chip" data-path="${P}" data-val="${esc(id)}" aria-pressed="${o}">${ic(s.icon || 'mdi:home')}${esc(s.kuerzel || s.kurz || s.name || id)}</button>`; }).join('')}${unknown.map(x => `<button class="chip bad" data-act="chip" data-path="${P}" data-val="${esc(x)}" title="Diesen Standort gibt es nicht, antippen zum Entfernen">${ic('mdi:alert')}${esc(x)}</button>`).join('')}</div>`;
  }
  _floorsEditor(path, refs){
    const floors = Object.values(this._floors()), areas = Object.values(this._hass.areas || {});
    const find = ref => floors.find(f => f.floor_id === ref) || floors.find(f => lc(f.name) === lc(ref));
    const used = new Set();
    const rows = refs.map((f, i) => {
      const obj = f && typeof f === 'object';
      const ref = String(obj ? f.id ?? f.name ?? '' : f), shown = obj && f.id != null ? f.name || '' : '';
      const fl = find(ref); if (fl) used.add(fl.floor_id);
      const n = fl ? areas.filter(a => a.floor_id === fl.floor_id).length : 0;
      return `<div class="mrow ${fl ? '' : 'bad'}"><span class="mrow-ic">${ic((fl && fl.icon) || 'mdi:floor-plan')}</span><span class="mrow-main"><b>${esc(fl ? fl.name : ref)}</b><small>${fl ? `${n} ${n === 1 ? 'Raum' : 'Räume'}` : 'gibt es in Home Assistant nicht'}</small></span><input type="text" data-path="${pj([...path, i])}" data-type="floorname" data-ref="${esc(ref)}" value="${esc(shown)}" placeholder="Anzeigename (optional)" aria-label="Anzeigename">${this._mv(path, i, refs.length)}</div>`;
    }).join('');
    const free = floors.filter(f => !used.has(f.floor_id)).sort((a, b) => (b.level ?? 0) - (a.level ?? 0) || String(a.name).localeCompare(b.name, 'de'));
    const add = free.length ? `<select class="add-sel" data-add="list" data-path="${pj(path)}" aria-label="Etage hinzufügen"><option value="">+ Etage hinzufügen …</option>${free.map(f => `<option value="${esc(f.floor_id)}">${esc(f.name)}</option>`).join('')}</select>` : floors.length ? '' : '<p class="help">In Home Assistant gibt es noch keine Etagen.</p>';
    return `<div class="mrows">${rows || '<p class="help">Noch keine Etage gewählt.</p>'}</div>${add}`;
  }
  _areasEditor(path, refs){
    const areaMap = this._hass.areas || {}, areas = Object.values(areaMap), floors = this._floors(), P = pj(path);
    const used = new Set();
    const chips = refs.map((r, i) => {
      const a = areaMap[r] || areas.find(x => lc(x.name) === lc(r)); if (a) used.add(a.area_id);
      return `<span class="chip on ${a ? '' : 'bad'}" title="${esc(a ? a.area_id : 'Diesen Raum gibt es nicht')}">${esc(a ? a.name : r)}<button data-act="rm" data-path="${P}" data-i="${i}" aria-label="Entfernen">${ic('mdi:close')}</button></span>`;
    }).join('');
    const free = areas.filter(a => !used.has(a.area_id)).sort((a, b) => (a.floor_id ? 1 : 0) - (b.floor_id ? 1 : 0) || String(a.name).localeCompare(b.name, 'de'));
    return `${chips ? `<div class="chips">${chips}</div>` : ''}<select class="add-sel" data-add="list" data-path="${P}" aria-label="Raum hinzufügen"><option value="">+ Raum hinzufügen …</option>${free.map(a => `<option value="${esc(a.area_id)}">${esc(a.name)} ${a.floor_id ? `(${esc((floors[a.floor_id] || {}).name || a.floor_id)})` : '(ohne Etage)'}</option>`).join('')}</select>`;
  }
  _areaSelect(path, v, L){
    const areaMap = this._hass.areas || {}, floors = this._floors();
    const areas = Object.values(areaMap).sort((a, b) => String(a.name).localeCompare(b.name, 'de'));
    const cur = v ? areaMap[v] || areas.find(a => lc(a.name) === lc(v)) : null;
    return `<select data-path="${pj(path)}" data-type="select" aria-label="${L}"><option value="">— keiner —</option>${areas.map(a => `<option value="${esc(a.area_id)}" ${cur && cur.area_id === a.area_id ? 'selected' : ''}>${esc(a.name)}${a.floor_id ? ` · ${esc((floors[a.floor_id] || {}).name || '')}` : ''}</option>`).join('')}${v && !cur ? `<option value="${esc(v)}" selected>${esc(v)} (gibt es nicht)</option>` : ''}</select>`;
  }
  _stringsEditor(path, items, ph){
    const P = pj(path);
    return `<div class="chips">${items.map((s, i) => `<span class="chip on">${esc(s)}<button data-act="rm" data-path="${P}" data-i="${i}" aria-label="Entfernen">${ic('mdi:close')}</button></span>`).join('')}<input type="text" class="chip-add" data-add="string" data-path="${P}" placeholder="${esc(ph ? `+ z. B. ${ph}, mit Enter` : '+ hinzufügen, mit Enter')}" aria-label="Eintrag hinzufügen"></div>`;
  }
  _entitiesEditor(path, items, dom){
    const P = pj(path);
    const chips = items.map((e, i) => { const st = this._hass.states[e]; return `<span class="chip on ${st ? '' : 'bad'}" title="${esc(st ? e : `${e} gibt es nicht`)}">${esc(st ? entName(this._hass, st) : e)}<button data-act="rm" data-path="${P}" data-i="${i}" aria-label="Entfernen">${ic('mdi:close')}</button></span>`; }).join('');
    return `${chips ? `<div class="chips">${chips}</div>` : ''}<div class="inp"><input type="text" data-add="entity" data-pick="entity" data-dom="${esc(dom || '')}" data-path="${P}" placeholder="+ Entität suchen und hinzufügen" spellcheck="false" autocomplete="off" aria-label="Entität hinzufügen"></div>`;
  }
  _rowsEditor(f, path, items){
    const rows = items.map((row, i) => `<div class="rowc"><div class="grid">${this._fields(f.fields, [...path, i])}</div>${this._mv(path, i, items.length)}</div>`).join('');
    return `${rows ? `<div class="rowcs">${rows}</div>` : ''}<button class="add" data-act="add-row" data-path="${pj(path)}">${ic('mdi:plus')}${esc(f.add || 'Hinzufügen')}</button>`;
  }
  _userSelect(base, obj){
    const users = this._users;
    if (users === null) return '<p class="help">Benutzer werden geladen …</p>';
    if (!users.length) return `<input type="text" data-path="${pj([...base, 'name'])}" value="${esc(obj.name ?? '')}" placeholder="Name wie in Home Assistant" aria-label="Benutzer">`;
    const cur = users.find(u => (obj.id && u.id === obj.id) || (obj.name && lc(u.name) === lc(obj.name)));
    return `<select data-path="${pj(base)}" data-type="user" aria-label="Benutzer"><option value="">— Benutzer wählen —</option>${users.map(u => `<option value="${esc(u.id)}" ${cur && cur.id === u.id ? 'selected' : ''}>${esc(u.name)}${u.admin ? ' (Admin)' : ''}</option>`).join('')}${!cur && (obj.name || obj.id) ? `<option value="" selected>${esc(obj.name || obj.id)} (unbekannt)</option>` : ''}</select>`;
  }

  /* ---------- Lageplan: Bild hochladen, Lichter platzieren ---------- */
  _planEditor(base, obj){
    const P = pj(base), pp = [...base, 'punkte'], pts = arr(obj.punkte), armed = this._peArmed;
    const upload = label => `<label class="btn ghost">${ic('mdi:image-plus')}${label}<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${P}" hidden></label>`;
    let top;
    if (this._uploading) top = '<div class="pe-drop"><b>Wird hochgeladen …</b><span>Große Bilder brauchen einen Moment.</span></div>';
    else if (!obj.bild) top = `<label class="pe-drop">${ic('mdi:image-plus')}<b>Bild hochladen</b><span>Luftbild, Drohnenfoto oder Ansicht des 3D-Modells · JPG, PNG oder WebP · bis 40 MB</span><input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${P}" hidden></label>`;
    else {
      const w = obj.breite || 4, h = obj.hoehe || 3, z = this._peZoom || 1;
      const name = pt => pt.name || (this._hass.states[pt.entity] ? entName(this._hass, this._hass.states[pt.entity]) : pt.entity);
      const markers = pts.map((pt, i) => `<div class="pe-pt ${armed === i ? 'armed' : ''} ${this._hass.states[pt.entity] ? '' : 'bad'}" data-pt="${i}" style="left:${Number(pt.x) || 0}%;top:${Number(pt.y) || 0}%">${ic(pt.icon || (domainOf(pt.entity) === 'light' ? 'mdi:lightbulb' : 'mdi:power-socket-de'))}<span>${esc(name(pt))}</span></div>`).join('');
      const hint = armed != null && pts[armed] ? `Jetzt ins Bild tippen, wo „${esc(name(pts[armed]))}“ sitzt. Esc bricht ab.` : 'Punkte mit der Maus verschieben. Neues Licht: unten suchen, dann ins Bild tippen.';
      top = `<div class="pe-bar"><button class="ib" data-act="pe-zoom" data-d="-1" title="Kleiner" aria-label="Kleiner" ${z > 1 ? '' : 'disabled'}>${ic('mdi:magnify-minus-outline')}</button><button class="ib" data-act="pe-zoom" data-d="1" title="Größer" aria-label="Größer" ${z < 4 ? '' : 'disabled'}>${ic('mdi:magnify-plus-outline')}</button><span class="pe-info">${w} × ${h} px</span>${upload('Bild ersetzen')}</div>
        <div class="pe-scroll"><div class="pe-canvas ${armed != null ? 'arming' : ''}" data-pe="${P}" style="width:${z * 100}%;aspect-ratio:${w} / ${h}"><img data-bild="${esc(obj.bild)}" alt="" draggable="false"><div class="pe-pts">${markers}</div></div></div>
        <p class="help ${armed != null ? 'pe-armed' : ''}">${hint}</p>`;
    }
    const rows = pts.map((pt, i) => {
      const st = this._hass.states[pt.entity];
      return `<div class="mrow ${st ? '' : 'bad'} ${armed === i ? 'armed' : ''}"><span class="mrow-ic">${ic(pt.icon || (domainOf(pt.entity) === 'light' ? 'mdi:lightbulb' : 'mdi:power-socket-de'))}</span><span class="mrow-main"><b>${esc(st ? entName(this._hass, st) : pt.entity)}</b><small>${st ? esc(pt.entity) : 'gibt es in Home Assistant nicht'}</small></span><input type="text" data-path="${pj([...pp, i, 'name'])}" value="${esc(pt.name ?? '')}" placeholder="Beschriftung (optional)" aria-label="Beschriftung">${obj.bild ? `<button class="btn ghost" data-act="pe-arm" data-i="${i}">${ic('mdi:crosshairs-gps')}Platzieren</button>` : ''}<button class="ib sm danger" data-act="rm" data-path="${pj(pp)}" data-i="${i}" title="Entfernen" aria-label="Entfernen">${ic('mdi:close')}</button></div>`;
    }).join('');
    return `<div class="fld wide pe">${top}${rows ? `<div class="mrows">${rows}</div>` : ''}<div class="inp"><input type="text" data-add="point" data-pick="entity" data-dom="light,switch,fan,input_boolean" data-path="${pj(pp)}" placeholder="+ Licht suchen und auf den Plan setzen" spellcheck="false" autocomplete="off" aria-label="Licht hinzufügen"></div></div>`;
  }
  /* Bilder der Lagepläne sind geschützt; <img> bekommt eine signierte Adresse */
  _bildUrl(file){
    this._signed = this._signed || {};
    if (!this._signed[file]) this._signed[file] = this._hass.callWS({type: 'auth/sign_path', path: `/api/multisite_panel/bild/${encodeURIComponent(file)}`, expires: 86400}).then(r => r.path).catch(e => { delete this._signed[file]; throw e; });
    return this._signed[file];
  }
  _mountImages(){
    for (const img of this.$main.querySelectorAll('img[data-bild]')){
      this._bildUrl(img.dataset.bild).then(u => { img.src = u; }).catch(() => { img.alt = 'Bild nicht gefunden'; });
    }
  }
  async _upload(file, base){
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)){ this._toast('Bitte ein JPG-, PNG- oder WebP-Bild wählen', true); return; }
    this._uploading = true; this._renderMain();
    try {
      let {blob, w, h} = await bildVorbereiten(file);
      if (blob.size > 40 * 1024 * 1024) throw new Error('auch verkleinert noch größer als 40 MB');
      const res = await this._hass.fetchWithAuth('/api/multisite_panel/bild', {method: 'POST', headers: {'Content-Type': blob.type}, body: blob});
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message || `Fehler ${res.status}`);
      const o = getIn(this._draft, base);
      if (o){ this._snap(); o.bild = j.datei; o.breite = w; o.hoehe = h; }
      this._toast('Bild hochgeladen – jetzt die Lichter platzieren');
    } catch (e){ this._toast(`Hochladen fehlgeschlagen: ${(e && e.message) || e}`, true); }
    this._uploading = false; this._peZoom = 1;
    this._changed(true);
  }
  /* Punkte ziehen bzw. das ausgewählte Licht per Tippen platzieren */
  _peDown(ev){
    const canvas = ev.target.closest('[data-pe]'); if (!canvas) return;
    const base = JSON.parse(canvas.dataset.pe), list = getIn(this._draft, [...base, 'punkte']);
    if (!Array.isArray(list)) return;
    const at = e => { const r = canvas.getBoundingClientRect(); return {x: Math.round(Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)) * 100) / 100, y: Math.round(Math.min(100, Math.max(0, (e.clientY - r.top) / r.height * 100)) * 100) / 100}; };
    const el = ev.target.closest('[data-pt]');
    if (this._peArmed != null && list[this._peArmed]){
      ev.preventDefault();
      this._snap(); Object.assign(list[this._peArmed], at(ev)); this._peArmed = null; this._changed(true);
      return;
    }
    if (!el) return;
    ev.preventDefault();
    const i = +el.dataset.pt; let moved = false;
    el.setPointerCapture(ev.pointerId); el.classList.add('drag');
    const move = e => {
      const p = at(e);
      if (!moved){ moved = true; this._snap(); }
      Object.assign(list[i], p); el.style.left = `${p.x}%`; el.style.top = `${p.y}%`;
    };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.classList.remove('drag'); if (moved) this._changed(); };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  /* ---------- Auswahlliste für Entitäten und Symbole ---------- */
  _openPick(inp){ this._pickInput = inp; this._pickAct = 0; this._updatePick(); }
  _closePick(){ this._pickInput = null; this._pickItems = null; this.$dd.hidden = true; }
  _updatePick(){
    const inp = this._pickInput;
    if (!inp || !inp.isConnected){ this._closePick(); return; }
    const q = lc(inp.value), kind = inp.dataset.pick;
    let items;
    if (kind === 'icon'){
      const qq = q.replace(/^mdi:/, '');
      items = ICONS.filter(n => n.includes(qq)).slice(0, 48).map(n => ({v: `mdi:${n}`, html: `${ic('mdi:' + n)}<span>${esc(n)}</span>`}));
      if (qq && !ICONS.includes(qq)) items.unshift({v: `mdi:${qq}`, html: `${ic('mdi:' + qq)}<span>mdi:${esc(qq)}</span>`});
    } else {
      const doms = (inp.dataset.dom || '').split(',').filter(Boolean), toks = q.split(/\s+/).filter(Boolean), states = this._hass.states;
      items = Object.keys(states)
        .filter(eid => !doms.length || doms.includes(domainOf(eid)))
        .map(eid => ({eid, name: entName(this._hass, states[eid])}))
        .filter(x => toks.every(t => x.eid.includes(t) || lc(x.name).includes(t)))
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
        .slice(0, 60)
        .map(x => ({v: x.eid, html: `<b>${esc(x.name)}</b><small>${esc(x.eid)} · ${esc(this._fmt(states[x.eid]))}</small>`}));
    }
    this._pickItems = items;
    if (!items.length){ this.$dd.hidden = true; return; }
    this._pickAct = Math.max(0, Math.min(this._pickAct || 0, items.length - 1));
    this.$dd.className = `dd ${kind}`;
    this.$dd.innerHTML = items.map((it, i) => `<div class="dd-i ${i === this._pickAct ? 'act' : ''}" data-pi="${i}" role="option">${it.html}</div>`).join('');
    const r = inp.getBoundingClientRect(), hr = this.$ed.getBoundingClientRect();
    const w = Math.min(Math.max(r.width, 300), hr.width - 16), h = Math.min(320, items.length * (kind === 'icon' ? 40 : 50) + 10);
    const below = hr.bottom - r.bottom, up = below < h + 12 && r.top - hr.top > below;
    Object.assign(this.$dd.style, {
      left: `${Math.max(8, Math.min(r.left - hr.left, hr.width - w - 8))}px`, width: `${w}px`,
      top: up ? '' : `${r.bottom - hr.top + 4}px`, bottom: up ? `${hr.bottom - r.top + 4}px` : '',
    });
    this.$dd.hidden = false;
  }
  _markPick(){
    this.$dd.querySelectorAll('.dd-i').forEach((el, i) => el.classList.toggle('act', i === this._pickAct));
    const a = this.$dd.querySelector('.dd-i.act'); if (a) a.scrollIntoView({block: 'nearest'});
  }
  _pick(i){
    const inp = this._pickInput, it = this._pickItems && this._pickItems[i];
    if (!inp || !it) return;
    if (inp.dataset.add === 'point'){
      // Licht auf den Plan: erst in die Mitte, dann wartet der Editor auf einen Tipp ins Bild
      const path = JSON.parse(inp.dataset.path), cur = arr(getIn(this._draft, path));
      this._closePick();
      this._snap(); setIn(this._draft, path, [...cur, {entity: it.v, x: 50, y: 50}]);
      const o = getIn(this._draft, path.slice(0, -1));
      this._peArmed = o && o.bild ? cur.length : null;
      this._changed(true);
      return;
    }
    if (inp.dataset.add === 'entity'){
      const path = JSON.parse(inp.dataset.path), cur = arr(getIn(this._draft, path));
      this._closePick();
      if (!cur.includes(it.v)){ this._snap(); setIn(this._draft, path, [...cur, it.v]); this._changed(true); }
      this._focusAdd('entity', inp.dataset.path);
      return;
    }
    inp.value = it.v;
    this._lastType = 0;
    this._onInput(inp);
    this._closePick();
  }
  _focusAdd(kind, path){
    const el = [...this._root.querySelectorAll(`[data-add="${kind}"]`)].find(x => x.dataset.path === path);
    if (el){ el.value = ''; el.focus(); }
  }

  /* ---------- Ereignisse ---------- */
  _bind(){
    const r = this._root;
    r.addEventListener('click', ev => this._onClick(ev));
    r.addEventListener('input', ev => this._onInput(ev.target));
    r.addEventListener('change', ev => this._onChange(ev.target));
    r.addEventListener('keydown', ev => this._onKey(ev));
    r.addEventListener('focusin', ev => {
      const t = ev.target;
      if (t.dataset && t.dataset.pick) this._openPick(t);
      if (t.dataset && t.dataset.siteId) this._idBefore = t.value;
    });
    r.addEventListener('focusout', ev => {
      if (ev.target === this._pickInput) setTimeout(() => { if (this._root.activeElement !== this._pickInput) this._closePick(); }, 150);
    });
    this.$dd.addEventListener('mousedown', ev => { ev.preventDefault(); const it = ev.target.closest('[data-pi]'); if (it) this._pick(+it.dataset.pi); });
    this.$main.addEventListener('scroll', () => { if (this._pickInput) this._updatePick(); }, {passive: true});
    this.$main.addEventListener('pointerdown', ev => this._peDown(ev));
    // Listen per Ziehen sortieren
    const clear = () => this.$main.querySelectorAll('.dragging,.drop-before,.drop-after').forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after'));
    const target = ev => { const c = ev.target.closest && ev.target.closest('[data-drag]'); if (!c) return null; const b = c.getBoundingClientRect(); return {c, after: ev.clientY > b.top + b.height / 2}; };
    this.$main.addEventListener('dragstart', ev => {
      const c = ev.target.closest && ev.target.closest('[data-drag]'); if (!c) return;
      this._dragI = +c.dataset.drag; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', String(this._dragI)); c.classList.add('dragging');
    });
    this.$main.addEventListener('dragover', ev => {
      if (this._dragI == null) return;
      const t = target(ev); if (!t) return;
      ev.preventDefault(); this.$main.querySelectorAll('.drop-before,.drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));
      t.c.classList.add(t.after ? 'drop-after' : 'drop-before');
    });
    this.$main.addEventListener('drop', ev => {
      if (this._dragI == null) return;
      const t = target(ev); if (!t) return;
      ev.preventDefault();
      const from = this._dragI; let to = +t.c.dataset.drag + (t.after ? 1 : 0); if (to > from) to--;
      this._dragI = null; clear();
      const list = this._draft[this._section().list];
      if (to !== from && Array.isArray(list)){ this._snap(); const [x] = list.splice(from, 1); list.splice(to, 0, x); this._changed(true); }
    });
    this.$main.addEventListener('dragend', () => { this._dragI = null; clear(); });
  }
  _globalKey(ev){
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    const k = ev.key.toLowerCase();
    if (k === 's'){ ev.preventDefault(); this._save(); return; }
    const a = this._root.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return;   // dort gilt das Rückgängig des Browsers
    if (k === 'z' && !ev.shiftKey){ ev.preventDefault(); this._undoRedo(-1); }
    else if (k === 'y' || (k === 'z' && ev.shiftKey)){ ev.preventDefault(); this._undoRedo(1); }
  }
  _onKey(ev){
    const t = ev.target;
    if (t.dataset && t.dataset.pick && this._pickItems && !this.$dd.hidden){
      const n = this._pickItems.length;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp'){ ev.preventDefault(); this._pickAct = (this._pickAct + (ev.key === 'ArrowDown' ? 1 : -1) + n) % n; this._markPick(); return; }
      if (ev.key === 'Enter'){ ev.preventDefault(); this._pick(this._pickAct); return; }
      if (ev.key === 'Escape'){ ev.preventDefault(); this._closePick(); return; }
    }
    if (ev.key === 'Escape' && this._peArmed != null){ this._peArmed = null; this._renderMain(); return; }
    if (t.dataset && t.dataset.add === 'string' && ev.key === 'Enter'){
      ev.preventDefault();
      const v = t.value.trim(); if (!v) return;
      const path = JSON.parse(t.dataset.path);
      this._snap(); setIn(this._draft, path, [...arr(getIn(this._draft, path)), v]); this._changed(true);
      this._focusAdd('string', t.dataset.path);
    }
  }
  _onInput(t){
    if (t.id === 'yaml'){ this._yaml = t.value; return; }
    if (t.dataset.pick){ if (this._pickInput !== t){ this._pickInput = t; this._pickAct = 0; } this._updatePick(); }
    const type = t.dataset.type;
    if (t.dataset.add || !t.dataset.path || type === 'select' || type === 'bool' || type === 'user') return;
    const path = JSON.parse(t.dataset.path);
    this._snap(true);
    if (type === 'floorname') setIn(this._draft, path, t.value.trim() ? {id: t.dataset.ref, name: t.value} : t.dataset.ref);
    else if (type === 'number'){ const n = parseFloat(t.value); setIn(this._draft, path, Number.isFinite(n) ? n : undefined); }
    else setIn(this._draft, path, t.value === '' ? undefined : t.value);
    // Kleine Anzeigen neben dem Feld gleich nachziehen, ohne das Formular neu zu zeichnen
    if (t.dataset.pick === 'entity'){ const l = t.closest('.fld') && t.closest('.fld').querySelector('.vline'); if (l) l.innerHTML = this._entityLine(t.value); }
    if (t.dataset.pick === 'icon'){ const i = t.parentElement.querySelector('ha-icon'); if (i) i.setAttribute('icon', t.value || i.dataset.ph); }
    const s = this._section();
    if (s.list && this._item != null && path.length === 3 && path[0] === s.list && path[1] === this._item){
      const title = this._root.getElementById('itemTitle'); if (title) title.textContent = LISTS[s.list].title(this._draft[s.list][this._item]);
    }
    this._changed();
  }
  _onChange(t){
    if (t.dataset.upload){ const f = t.files && t.files[0]; t.value = ''; this._upload(f, JSON.parse(t.dataset.upload)); return; }
    if (t.dataset.change === 'pv-user'){
      this._pvUser = t.value;
      if (this._preview){ this._preview.hass = this._pvHass(); this._schedulePreview(0); }
      return;
    }
    if (t.dataset.add === 'list'){
      if (!t.value) return;
      const path = JSON.parse(t.dataset.path);
      this._snap(); setIn(this._draft, path, [...arr(getIn(this._draft, path)), t.value]); this._changed(true);
      return;
    }
    if (!t.dataset.path) return;
    const path = JSON.parse(t.dataset.path), type = t.dataset.type;
    if (type === 'select'){ this._snap(); setIn(this._draft, path, t.value === '' ? undefined : t.value); this._changed(true); }
    else if (type === 'bool'){ this._snap(); setIn(this._draft, path, t.checked === (t.dataset.def === '1') ? undefined : t.checked); this._changed(true); }
    else if (type === 'user'){
      const u = arr(this._users).find(x => x.id === t.value), o = getIn(this._draft, path);
      if (!u || !o) return;
      this._snap(); o.id = u.id; o.name = u.name; this._changed(true);
    } else if (t.dataset.siteId){
      // Standort-ID geändert: alle Verweise mitziehen
      const from = this._idBefore, to = t.value.trim();
      if (from && to && from !== to){ relinkSite(this._draft, from, to); this._changed(); }
      this._idBefore = to;
    }
  }
  _onClick(ev){
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const s = this._section(), L = s.list && LISTS[s.list];
    switch (el.dataset.act){
      case 'menu': this.dispatchEvent(new CustomEvent('hass-toggle-menu', {bubbles: true, composed: true})); break;
      case 'sec': this._go(el.dataset.sec, null); break;
      case 'open': this._go(s.id, +el.dataset.i); break;
      case 'back': this._go(s.id, null); break;
      case 'new': {
        this._snap();
        const list = this._draft[s.list] = arr(this._draft[s.list]);
        list.push(L.neu(this._draft));
        this._go(s.id, list.length - 1, true);
        break;
      }
      case 'dup': {
        const list = this._draft[s.list], it = clone(list[this._item]);
        if (it.id != null) it.id = uniqueId(list, String(it.id).replace(/_\d+$/, ''));
        if (it.name) it.name = `${it.name} (Kopie)`;
        this._snap(); list.splice(this._item + 1, 0, it);
        this._go(s.id, this._item + 1, true);
        break;
      }
      case 'del': {
        const list = this._draft[s.list], it = list[this._item];
        if (!confirm(`„${L.title(it)}“ löschen?`)) break;
        this._snap(); this._removeItem(s.list, this._item);
        this._go(s.id, null, true);
        this._toast('Gelöscht – mit Rückgängig holst du es zurück');
        break;
      }
      case 'mv': {
        const path = JSON.parse(el.dataset.path), i = +el.dataset.i, j = i + +el.dataset.d, list = getIn(this._draft, path);
        if (!Array.isArray(list) || j < 0 || j >= list.length) break;
        this._snap(); [list[i], list[j]] = [list[j], list[i]]; this._changed(true);
        break;
      }
      case 'rm': {
        const path = JSON.parse(el.dataset.path), i = +el.dataset.i, list = getIn(this._draft, path);
        if (!Array.isArray(list)) break;
        if (path.length === 1 && LISTS[path[0]] && !confirm(`„${LISTS[path[0]].title(list[i])}“ löschen?`)) break;
        this._snap();
        if (path.length === 1) this._removeItem(path[0], i);
        else { list.splice(i, 1); if (!list.length) setIn(this._draft, path, undefined); }
        this._changed(true);
        break;
      }
      case 'add-row': { const path = JSON.parse(el.dataset.path); this._snap(); setIn(this._draft, path, [...arr(getIn(this._draft, path)), {}]); this._changed(true); break; }
      case 'chip': {
        const path = JSON.parse(el.dataset.path), val = el.dataset.val, cur = arr(getIn(this._draft, path)).map(String);
        const order = arr(this._draft.standorte).map(x => String(x.id)), pos = id => { const p = order.indexOf(id); return p < 0 ? 999 : p; };
        this._snap();
        setIn(this._draft, path, (cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]).sort((a, b) => pos(a) - pos(b)));
        this._changed(true);
        break;
      }
      case 'save': this._save(); break;
      case 'discard':
        if (!confirm('Alle ungespeicherten Änderungen verwerfen?')) break;
        this._snap(); this._draft = clone(this._saved); this._external = false; this._codeLoaded = false; this._changed(true);
        break;
      case 'undo': this._undoRedo(-1); break;
      case 'redo': this._undoRedo(1); break;
      case 'pv-toggle': this._pvOpen = !this._pvOpen; this.$ed.classList.toggle('pv-open', this._pvOpen); break;
      case 'hints':
        if (this._preview && typeof this._preview.zeige === 'function') this._preview.zeige('orte', 'check');
        if (!this._pvOpen){ this._pvOpen = true; this.$ed.classList.add('pv-open'); }
        break;
      case 'app': { const url = (this._panel && this._panel.config && this._panel.config.app) || '/zuhause'; history.pushState(null, '', url); window.dispatchEvent(new CustomEvent('location-changed')); break; }
      case 'pe-zoom': this._peZoom = Math.min(4, Math.max(1, (this._peZoom || 1) + +el.dataset.d)); this._renderMain(); break;
      case 'pe-arm': this._peArmed = this._peArmed === +el.dataset.i ? null : +el.dataset.i; this._renderMain(); break;
      case 'yaml-apply': this._applyYaml(); break;
      case 'yaml-reload': this._yaml = null; this._yamlMsg = ''; this._yamlBad = false; this._codeLoaded = false; this._renderMain(); break;
      default: break;
    }
  }
  _removeItem(list, i){
    const items = this._draft[list], [gone] = items.splice(i, 1);
    if (list === 'standorte' && gone && gone.id != null) relinkSite(this._draft, String(gone.id), undefined);
    if (!items.length) delete this._draft[list];
  }
  _go(sec, item, changed = false){
    if (sec !== this._sec){ this._yaml = null; this._yamlMsg = ''; this._yamlBad = false; this._codeLoaded = false; }
    if (sec !== this._sec || item !== this._item){ this._peArmed = null; this._peZoom = 1; }
    this._sec = sec; this._item = item; lsSet('msp-editor-sec', sec);
    this._closePick();
    if (changed) this._changed(true); else { this._renderSide(); this._renderMain(); }
    this.$main.scrollTop = 0;
    if (this._narrow || window.innerWidth <= 1280){ this._pvOpen = false; this.$ed.classList.remove('pv-open'); }
    this._syncPreview();
  }
  _toast(msg, err = false){
    const t = this.$toast;
    t.textContent = msg; t.classList.toggle('err', err); t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    clearTimeout(this._toastT); this._toastT = setTimeout(() => { t.hidden = true; }, err ? 6000 : 2600);
  }
}

if (!customElements.get('multisite-editor')) customElements.define('multisite-editor', MultisiteEditor);
