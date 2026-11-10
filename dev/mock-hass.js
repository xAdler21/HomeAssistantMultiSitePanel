// Nachgebautes hass-Objekt, damit Panel und Editor ohne Home Assistant laufen. Nur für die lokale Vorschau.
// Die Daten (Etagen, Räume, Entitäten, Konfiguration) kommen aus einem Datenmodul: privat/vorschau-daten.js
// (eigene Daten, nicht im Repository), sonst dev/demo-daten.js (erfundenes Beispiel).

const MIN = 60000;
const ago = m => new Date(Date.now() - m * MIN).toISOString();

/* Bausteine für die Datenmodule */
export function sammler(){
  const E = [];
  const add = (eid, state, attrs = {}, area = null, labels = [], changed = 5) => E.push({eid, state, attrs, area, labels, changed});
  const light = (eid, name, on, bri, area, fav) => add(eid, on ? 'on' : 'off', {friendly_name: name, brightness: on ? Math.round(bri * 2.55) : null, supported_color_modes: ['brightness']}, area, fav ? ['favorit'] : []);
  const tempS = (eid, name, v, area) => add(eid, String(v), {friendly_name: name, device_class: 'temperature', unit_of_measurement: '°C'}, area);
  const humS = (eid, name, v, area) => add(eid, String(v), {friendly_name: name, device_class: 'humidity', unit_of_measurement: '%'}, area);
  const clim = (eid, name, cur, target, area, extra = {}) => add(eid, extra.state || 'heat', {friendly_name: name, current_temperature: cur, temperature: target, hvac_action: cur < target - 0.2 ? 'heating' : 'idle', hvac_modes: ['heat', 'off'], preset_modes: ['none', 'eco'], preset_mode: extra.preset || 'none', min_temp: 5, max_temp: 30, target_temp_step: 0.5}, area);
  const power = (eid, name, w, area = null) => add(eid, String(w), {friendly_name: name, device_class: 'power', unit_of_measurement: 'W', state_class: 'measurement'}, area);
  const energy = (eid, name, kwh) => add(eid, String(kwh), {friendly_name: name, device_class: 'energy', unit_of_measurement: 'kWh', state_class: 'total_increasing'});
  return {E, add, light, tempS, humS, clim, power, energy};
}

/* Eigene Daten aus privat/, sonst das Beispiel (?demo erzwingt das Beispiel) */
export async function ladeDaten(){
  if (new URLSearchParams(location.search).has('demo')) return import('./demo-daten.js');
  try { return await import('../privat/vorschau-daten.js'); }
  catch (e){ return import('./demo-daten.js'); }
}

const USERS = [
  {id: 'mock-admin', name: 'Admin', group_ids: ['system-admin'], is_active: true, system_generated: false},
  {id: 'mock-max', name: 'Max Mustermann', group_ids: ['system-users'], is_active: true, system_generated: false},
  {id: 'mock-supervisor', name: 'Supervisor', group_ids: ['system-admin'], is_active: true, system_generated: true},
];

/* Tageskurven für den Verlauf */
const KURVEN = {
  solar: t => { const x = (t - 7.4) / 11.2; if (x <= 0 || x >= 1) return 0; let v = 6.5 * Math.pow(Math.sin(Math.PI * x), 1.6); if (t > 10.5 && t < 11.25) v *= 0.55; return v; },
  last: t => { let v = 0.55 + 0.08 * Math.sin(t * 1.7); if (t >= 6.5 && t < 17) v += 2.1 + 0.6 * Math.sin(t * 2.3); if (t >= 9 && t < 9.5) v += 1.8; if (t >= 14 && t < 14.5) v += 1.2; if (t >= 12 && t < 12.75) v -= 1.2; return Math.max(0.3, v); },
};

export function createMockHass(daten, onChange){
  /* Nachgebauter Speicher der Integration, gemeinsam für alle Vorschau-Tabs (localStorage + BroadcastChannel) */
  const STORE_KEY = `msp-mock-store-${daten.NAME || 'demo'}`;
  if (new URLSearchParams(location.search).has('zuruecksetzen')) localStorage.removeItem(STORE_KEY);
  const storeGet = () => { try { const s = localStorage.getItem(STORE_KEY); if (s) return JSON.parse(s); } catch (e) { /* egal */ } return JSON.parse(JSON.stringify(daten.mockConfig)); };
  const subs = new Set();
  const notify = cfg => subs.forEach(cb => cb({config: cfg}));
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(STORE_KEY) : null;
  if (channel) channel.onmessage = ev => notify(ev.data);
  // Hochgeladene Bilder leben nur bis zum Neuladen der Seite
  const bilder = {...(daten.BILDER || {})};

  const states = {}, entities = {};
  for (const e of daten.ENTITIES){
    states[e.eid] = {entity_id: e.eid, state: e.state, attributes: Object.fromEntries(Object.entries(e.attrs).filter(([, v]) => v != null)), last_changed: ago(e.changed), last_updated: ago(e.changed), context: {id: e.eid}};
    entities[e.eid] = {entity_id: e.eid, area_id: e.area, labels: e.labels, device_id: null, platform: 'demo'};
  }
  const floors = Object.fromEntries(daten.FLOORS.map(([id, name, level]) => [id, {floor_id: id, name, level, icon: null, aliases: []}]));
  const areas = Object.fromEntries(daten.AREAS.map(([id, name, floor]) => [id, {area_id: id, name, floor_id: floor, icon: null, labels: [], aliases: []}]));
  const dark = new URLSearchParams(location.search).has('dunkel') || (!new URLSearchParams(location.search).has('hell') && matchMedia('(prefers-color-scheme: dark)').matches);

  let hass;
  const set = (eid, state, attrs = {}) => {
    const old = hass.states[eid]; if (!old) return;
    const now = new Date().toISOString();
    const changed = state !== undefined && state !== old.state;
    hass = {...hass, states: {...hass.states, [eid]: {...old, state: state === undefined ? old.state : state, attributes: {...old.attributes, ...attrs}, last_updated: now, last_changed: changed ? now : old.last_changed}}};
  };
  const ids = d => [].concat(d.entity_id || []);
  const callService = (domain, service, data = {}) => new Promise(resolve => setTimeout(() => {
    for (const eid of ids(data)){
      const st = hass.states[eid]; if (!st) continue;
      const on = st.state === 'on';
      switch (`${domain}.${service}`){
        case 'light.toggle': set(eid, on ? 'off' : 'on', {brightness: on ? null : (st.attributes.brightness || 255)}); break;
        case 'light.turn_off': set(eid, 'off', {brightness: null}); break;
        case 'light.turn_on': set(eid, 'on', {brightness: data.brightness_pct != null ? Math.round(data.brightness_pct * 2.55) : (st.attributes.brightness || 255)}); break;
        case 'switch.toggle': case 'input_boolean.toggle': case 'fan.toggle': set(eid, on ? 'off' : 'on'); break;
        case 'media_player.turn_on': set(eid, 'on'); break;
        case 'media_player.turn_off': set(eid, 'off'); break;
        case 'media_player.volume_set': set(eid, undefined, {volume_level: data.volume_level}); break;
        case 'media_player.select_source': set(eid, undefined, {source: data.source}); break;
        case 'cover.open_cover': set(eid, 'open', {current_position: st.attributes.current_position != null ? 100 : undefined}); break;
        case 'cover.close_cover': set(eid, 'closed', {current_position: st.attributes.current_position != null ? 0 : undefined}); break;
        case 'cover.set_cover_position': set(eid, data.position > 0 ? 'open' : 'closed', {current_position: data.position}); break;
        case 'lock.unlock': set(eid, 'unlocked'); setTimeout(() => { set(eid, 'locked'); onChange(hass); }, 5000); break;
        case 'lock.lock': set(eid, 'locked'); break;
        case 'climate.set_temperature': { const a = st.attributes; set(eid, undefined, {temperature: data.temperature, hvac_action: a.current_temperature < data.temperature - 0.2 && st.state !== 'off' ? 'heating' : 'idle'}); break; }
        case 'climate.set_hvac_mode': set(eid, data.hvac_mode, {hvac_action: data.hvac_mode === 'off' ? 'off' : (st.attributes.current_temperature < st.attributes.temperature - 0.2 ? 'heating' : 'idle')}); break;
        case 'climate.set_preset_mode': set(eid, undefined, {preset_mode: data.preset_mode, temperature: data.preset_mode === 'eco' ? 17 : 21, hvac_action: data.preset_mode === 'eco' ? 'idle' : (st.attributes.current_temperature < 20.8 ? 'heating' : 'idle')}); break;
        case 'input_select.select_option': set(eid, data.option); break;
        default: break;
      }
    }
    console.info('[mock] Dienst', `${domain}.${service}`, data);
    onChange(hass);
    resolve({});
  }, 150));

  const callWS = async msg => {
    if (msg.type === 'config/floor_registry/list') return Object.values(floors);
    if (msg.type === 'config/auth/list') return USERS;
    if (msg.type === 'multisite_panel/config/get') return {config: storeGet()};
    if (msg.type === 'multisite_panel/config/save'){
      await new Promise(r => setTimeout(r, 200));
      localStorage.setItem(STORE_KEY, JSON.stringify(msg.config));
      notify(msg.config);
      if (channel) channel.postMessage(msg.config);
      console.info('[mock] Konfiguration gespeichert');
      return null;
    }
    // Der Mock kann kein YAML; JSON ist gültiges YAML und reicht zum Testen
    if (msg.type === 'multisite_panel/yaml/dump') return {yaml: JSON.stringify(msg.config, null, 2)};
    if (msg.type === 'multisite_panel/yaml/parse'){
      try { return {config: JSON.parse(msg.yaml)}; }
      catch (e){ throw {code: 'invalid_yaml', message: `Der Mock versteht nur JSON: ${e.message}`}; }
    }
    // Signierte Adresse für ein Lageplan-Bild: in der Vorschau die Datei aus BILDER oder das hochgeladene Bild
    if (msg.type === 'auth/sign_path'){
      const datei = decodeURIComponent(String(msg.path).split('/').pop());
      return {path: bilder[datei] || msg.path};
    }
    const t0 = Date.parse(msg.start_time), t1 = Date.parse(msg.end_time);
    if (msg.type === 'history/history_during_period'){
      const out = {};
      for (const eid of msg.entity_ids){
        const fn = KURVEN[(daten.VERLAUF || {})[eid]];
        if (!fn) continue;
        const list = [];
        for (let t = t0; t <= t1; t += 5 * MIN){ const h = (t - t0) / 3600000; list.push({s: String(Math.round(fn(h) * 1000)), lu: t / 1000}); }
        out[eid] = list;
      }
      return out;
    }
    if (msg.type === 'logbook/get_events'){
      const at = (h, m) => { const d = new Date(t0); d.setHours(h, m, 0, 0); return d.getTime() / 1000; };
      return (daten.LOGBUCH || []).map(e => ({entity_id: e.entity_id, state: e.state, when: at(e.h, e.m)})).filter(e => e.when * 1000 <= t1 && msg.entity_ids.includes(e.entity_id));
    }
    throw new Error(`Mock kennt ${msg.type} nicht`);
  };

  // Hochladen eines Lageplan-Bilds (POST /api/multisite_panel/bild)
  const fetchWithAuth = async (url, init = {}) => {
    if (url === '/api/multisite_panel/bild' && init.method === 'POST'){
      await new Promise(r => setTimeout(r, 400));
      const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
      const datei = `plan-${hex}.${(init.body.type || '').includes('png') ? 'png' : 'jpg'}`;
      bilder[datei] = URL.createObjectURL(init.body);
      console.info('[mock] Bild hochgeladen', datei, init.body.size, 'Bytes');
      return new Response(JSON.stringify({datei, bytes: init.body.size}), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    return fetch(url, init);
  };

  hass = {
    states, entities, areas, floors, devices: {},
    user: {id: 'mock-admin', name: 'Admin', is_admin: true},
    themes: {darkMode: dark},
    language: 'de', locale: {language: 'de'},
    hassUrl: p => p,
    formatEntityState: st => `${st.state}${st.attributes.unit_of_measurement ? ' ' + st.attributes.unit_of_measurement : ''}`,
    callService, callWS, fetchWithAuth,
    connection: {
      subscribeMessage: (cb, msg) => {
        if (msg.type !== 'multisite_panel/subscribe') return Promise.reject(new Error(`Mock kennt ${msg.type} nicht`));
        subs.add(cb);
        setTimeout(() => cb({config: storeGet()}), 50);
        return Promise.resolve(() => subs.delete(cb));
      },
    },
  };
  return hass;
}
