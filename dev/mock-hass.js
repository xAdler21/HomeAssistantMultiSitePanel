// Nachgebautes hass-Objekt mit Beispieldaten, damit das Panel ohne Home Assistant läuft.
// Nur für die lokale Vorschau (dev/vorschau.html), wird nicht auf den Server kopiert.

const MIN = 60000;
const ago = m => new Date(Date.now() - m * MIN).toISOString();

const FLOORS = [
  ['werkstatt', 'Werkstatt', 0], ['buero', 'Büro', 0], ['neue_halle', 'Neue Halle', 0], ['stadel', 'Stadel', 0],
  ['1_stock', '1. Stock', 1], ['erdgeschoss', 'Erdgeschoss', 0], ['keller', 'Keller', -1],
  ['ammerhofweg', 'Ammerhofweg', 0], ['waidl_wohnhaus', 'Waidl Wohnhaus', 0], ['waidl_halle', 'Waidl Halle', 0],
  ['alte_gartnerei', 'Alte Gärtnerei', 0], ['dachboden_alt', 'Dachboden', 2],
];
const AREAS = [
  ['werkstatt', 'Werkstatt', 'werkstatt'], ['buero_links', 'Büro links', 'buero'], ['buero_rechts', 'Büro rechts', 'buero'],
  ['buero_anbau', 'Büro Anbau', 'buero'], ['neue_halle', 'Neue Halle', 'neue_halle'], ['stadel', 'Stadel', 'stadel'], ['hof', 'Hof', null],
  ['schlafzimmer', 'Schlafzimmer', '1_stock'], ['wohnzimmer', 'Wohnzimmer', 'erdgeschoss'], ['kuche', 'Küche', 'erdgeschoss'],
  ['heizung', 'Heizung', 'keller'], ['waschkuche', 'Waschküche', 'keller'], ['aussen', 'Aussen', null],
  ['a2_wohnzimmer', 'Wohnzimmer', 'ammerhofweg'], ['a2_heizraum', 'Heizraum', 'ammerhofweg'],
  ['w1_wohnzimmer', 'Wohnzimmer', 'waidl_wohnhaus'], ['w1_halle', 'Halle', 'waidl_halle'],
  ['gewachshaus', 'Gewächshaus', 'alte_gartnerei'], ['unnamed_room', 'Unnamed Room', null],
];

// [entity_id, Zustand, Attribute, Raum, Labels]
const E = [];
const add = (eid, state, attrs = {}, area = null, labels = [], changed = 5) => E.push({eid, state, attrs, area, labels, changed});
const light = (eid, name, on, bri, area, fav) => add(eid, on ? 'on' : 'off', {friendly_name: name, brightness: on ? Math.round(bri * 2.55) : null, supported_color_modes: ['brightness']}, area, fav ? ['favorit'] : []);
const tempS = (eid, name, v, area) => add(eid, String(v), {friendly_name: name, device_class: 'temperature', unit_of_measurement: '°C'}, area);
const humS = (eid, name, v, area) => add(eid, String(v), {friendly_name: name, device_class: 'humidity', unit_of_measurement: '%'}, area);
const clim = (eid, name, cur, target, area, extra = {}) => add(eid, extra.state || 'heat', {friendly_name: name, current_temperature: cur, temperature: target, hvac_action: cur < target - 0.2 ? 'heating' : 'idle', hvac_modes: ['heat', 'off'], preset_modes: ['none', 'eco'], preset_mode: extra.preset || 'none', min_temp: 5, max_temp: 30, target_temp_step: 0.5}, area);
const power = (eid, name, w, area = null) => add(eid, String(w), {friendly_name: name, device_class: 'power', unit_of_measurement: 'W', state_class: 'measurement'}, area);
const energy = (eid, name, kwh) => add(eid, String(kwh), {friendly_name: name, device_class: 'energy', unit_of_measurement: 'kWh', state_class: 'total_increasing'});

light('light.wohnzimmer_deckenlicht', 'Wohnzimmer Deckenlicht', true, 70, 'wohnzimmer', true);
light('light.wohnzimmer_stehlampe', 'Wohnzimmer Stehlampe', true, 35, 'wohnzimmer', true);
light('light.kuche_deckenlicht', 'Küche Deckenlicht', false, 100, 'kuche');
light('light.kuche_arbeitsplatte', 'Küche Arbeitsplatte', true, 100, 'kuche', true);
light('light.schlafzimmer_nachttisch', 'Schlafzimmer Nachttisch', false, 30, 'schlafzimmer');
light('light.aussen_garten', 'Gartenlicht', false, 100, 'aussen');
light('light.werkstatt_hallenlicht', 'Werkstatt Hallenlicht', true, 100, 'werkstatt', true);
light('light.buero_links_decke', 'Büro links Deckenlicht', true, 80, 'buero_links', true);
light('light.buero_rechts_decke', 'Büro rechts Deckenlicht', false, 80, 'buero_rechts');
light('light.buero_anbau_decke', 'Büro Anbau Deckenlicht', false, 80, 'buero_anbau');
light('light.neue_halle', 'Neue Halle Hallenlicht', false, 100, 'neue_halle');
light('light.hof', 'Hofbeleuchtung', false, 100, 'hof', true);
light('light.a2_wohnzimmer', 'Wohnzimmer Deckenlicht', false, 60, 'a2_wohnzimmer');
light('light.w1_halle', 'Halle Hallenlicht', false, 100, 'w1_halle');
light('light.gewachshaus', 'Pflanzenlicht', true, 100, 'gewachshaus');
add('light.unbekannt', 'off', {friendly_name: 'Shelly Dimmer 2 (neu)', brightness: null, supported_color_modes: ['brightness']});
add('switch.werkstatt_kompressor', 'off', {friendly_name: 'Werkstatt Kompressor', icon: 'mdi:air-filter'}, 'werkstatt');
add('switch.ems_esp_zirkulation', 'on', {friendly_name: 'EMS-ESP Zirkulationspumpe'});
add('cover.schlafzimmer_rollladen', 'open', {friendly_name: 'Schlafzimmer Rollladen', device_class: 'shutter', current_position: 100}, 'schlafzimmer');

clim('climate.wohnzimmer', 'Wohnzimmer Heizkörper', 21.4, 22, 'wohnzimmer');
clim('climate.schlafzimmer', 'Schlafzimmer Heizkörper', 18.6, 18, 'schlafzimmer');
clim('climate.kuche', 'Küche Heizkörper', 21.0, 21, 'kuche');
clim('climate.buero_links', 'Büro links Heizkörper', 20.8, 21.5, 'buero_links');
clim('climate.buero_rechts', 'Büro rechts Heizkörper', 19.9, 21, 'buero_rechts');
clim('climate.buero_anbau', 'Büro Anbau Heizkörper', 19.2, 17, 'buero_anbau', {preset: 'eco'});
clim('climate.a2_wohnzimmer', 'Ammerhof Heizkörper', 21.9, 22, 'a2_wohnzimmer');
clim('climate.w1_wohnzimmer', 'Waidl Heizkörper', 20.6, 21, 'w1_wohnzimmer');
tempS('sensor.werkstatt_temperatur', 'Werkstatt Temperatur', 16.8, 'werkstatt');
tempS('sensor.neue_halle_temperatur', 'Neue Halle Temperatur', 14.2, 'neue_halle');
tempS('sensor.stadel_temperatur', 'Stadel Temperatur', 12.0, 'stadel');
tempS('sensor.heizung_temperatur', 'Heizraum Temperatur', 23.4, 'heizung');
tempS('sensor.waschkuche_temperatur', 'Waschküche Temperatur', 19.5, 'waschkuche');
tempS('sensor.w1_halle_temperatur', 'Halle Temperatur', 13.5, 'w1_halle');
tempS('sensor.gewachshaus_temperatur', 'Gewächshaus Temperatur', 15.1, 'gewachshaus');
humS('sensor.wohnzimmer_feuchte', 'Wohnzimmer Luftfeuchte', 47, 'wohnzimmer');
humS('sensor.gewachshaus_feuchte', 'Gewächshaus Luftfeuchte', 71, 'gewachshaus');

add('media_player.wohnzimmer_tv', 'on', {friendly_name: 'Wohnzimmer Fernseher', device_class: 'tv', source: 'Apple TV', source_list: ['TV', 'Apple TV', 'HDMI 1', 'HDMI 2'], volume_level: 0.18}, 'wohnzimmer');
add('media_player.schlafzimmer_tv', 'off', {friendly_name: 'Schlafzimmer Fernseher', device_class: 'tv', source_list: ['TV', 'HDMI 1'], volume_level: 0.12}, 'schlafzimmer');

add('sensor.spuelmaschine_status', 'run', {friendly_name: 'Spülmaschine Status'}, 'kuche');
add('sensor.spuelmaschine_restzeit', '38', {friendly_name: 'Spülmaschine Restzeit', unit_of_measurement: 'min'}, 'kuche');
add('sensor.spuelmaschine_fortschritt', '76', {friendly_name: 'Spülmaschine Fortschritt', unit_of_measurement: '%'}, 'kuche');
add('sensor.spuelmaschine_programm', 'Eco 50°', {friendly_name: 'Spülmaschine Programm'}, 'kuche');
add('sensor.waschmaschine_status', 'finished', {friendly_name: 'Waschmaschine Status'}, 'waschkuche', [], 12);
add('input_boolean.waschmaschine_mitteilung', 'on', {friendly_name: 'Mitteilung Waschmaschine'});

add('cover.werkstatt_tor', 'open', {friendly_name: 'Werkstatt-Tor', device_class: 'gate'}, 'werkstatt', [], 120);
add('cover.hoftor', 'closed', {friendly_name: 'Hoftor', device_class: 'gate'}, 'hof');
add('lock.buero_eingang', 'locked', {friendly_name: 'Büro Eingang'}, 'buero_links');
add('lock.haustur_1a', 'locked', {friendly_name: 'Haustür'}, 'aussen');
add('cover.w1_hallentor', 'closed', {friendly_name: 'Hallentor', device_class: 'garage'}, 'w1_halle');
add('camera.einfahrt', 'idle', {friendly_name: 'Einfahrt', entity_picture: '/dev/kamera.svg?token=a'}, 'hof');
add('camera.hof', 'idle', {friendly_name: 'Hof', entity_picture: '/dev/kamera.svg?token=b'}, 'hof');
add('camera.haustur_1a', 'idle', {friendly_name: 'Haustür 1a', entity_picture: '/dev/kamera.svg?token=c'}, 'aussen');
add('binary_sensor.einfahrt_person', 'off', {friendly_name: 'Einfahrt Person', device_class: 'occupancy'}, 'hof');

power('sensor.zaehler1_leistung', 'Zähler 1 Leistung', 2190);
power('sensor.pv_leistung', 'PV Leistung', 4230);
energy('sensor.zaehler1_verbrauch_heute', 'Zähler 1 Verbrauch heute', 27.6);
energy('sensor.pv_ertrag_heute', 'PV Ertrag heute', 31.2);
energy('sensor.zaehler1_einspeisung_heute', 'Einspeisung heute', 14.9);
power('sensor.shelly_werkstatt_leistung', 'Werkstatt Leistung', 1010);
power('sensor.shelly_neue_halle_leistung', 'Neue Halle Leistung', 590);
power('sensor.shelly_buero_links_leistung', 'Büro links Leistung', 310);
power('sensor.wallbox_leistung', 'Wallbox Leistung', 0);
power('sensor.wohnhaus_1a_leistung', 'Wohnhaus 1a Leistung', 480);
tempS('sensor.1a_ems_esp_boiler_outside_temperature', 'Boiler Außentemperatur', 11.2, null);
tempS('sensor.1a_ems_esp_boiler_current_flow_temperature', 'Boiler Vorlauf', 46, null);
tempS('sensor.1a_ems_esp_boiler_dhw_current_intern_temperature', 'Boiler Warmwasser', 51, null);
energy('sensor.1a_ems_esp_boiler_gas_heute', 'Gas heute', 71);
add('binary_sensor.unifi_internet', 'on', {friendly_name: 'Internet', device_class: 'connectivity'});
add('sensor.unifi_wan_download', '248', {friendly_name: 'Download', unit_of_measurement: 'Mbit/s'});
add('sensor.unifi_wan_upload', '41', {friendly_name: 'Upload', unit_of_measurement: 'Mbit/s'});
add('input_select.heizsaison', 'Winter', {friendly_name: 'Heizsaison', options: ['Winter', 'Sommer']});
add('weather.forecast_home', 'partlycloudy', {friendly_name: 'Zuhause', temperature: 11});
add('script.feierabend_firma', 'off', {friendly_name: 'Feierabend Firma'});
add('scene.gute_nacht', '2026-10-12T21:00:00+00:00', {friendly_name: 'Gute Nacht'});

export const mockConfig = {
  wetter: 'weather.forecast_home',
  aussentemperatur: 'sensor.1a_ems_esp_boiler_outside_temperature',
  standorte: [
    {id: 'm1', name: 'Mangoldinger Straße 1', kurz: 'Mangoldinger 1', kuerzel: 'Firma', rolle: 'Firma', icon: 'mdi:office-building', etagen: ['Werkstatt', 'Büro', 'Neue Halle', 'Stadel'], bereiche: ['Hof'], bereiche_titel: 'Außen'},
    {id: 'm1a', name: 'Mangoldinger Straße 1a', kurz: 'Mangoldinger 1a', kuerzel: '1a', rolle: 'Wohnhaus', icon: 'mdi:home', etagen: ['1. Stock', 'Erdgeschoss', 'Keller'], bereiche: ['Aussen'], bereiche_titel: 'Außen'},
    {id: 'a2', name: 'Ammerhofweg 2', kurz: 'Ammerhofweg 2', kuerzel: 'Ammerhof', rolle: 'Haus Onkel', icon: 'mdi:home-variant', etagen: ['Ammerhofweg']},
    {id: 'w1', name: 'Waidl 1', kurz: 'Waidl 1', kuerzel: 'Waidl', rolle: 'Wohnhaus & Halle', icon: 'mdi:warehouse', etagen: [{id: 'Waidl Wohnhaus', name: 'Wohnhaus'}, {id: 'Waidl Halle', name: 'Halle'}]},
    {id: 'gae', name: 'Alte Gärtnerei', kurz: 'Alte Gärtnerei', kuerzel: 'Gärtnerei', rolle: 'Gärtnerei', icon: 'mdi:flower', etagen: ['Alte Gärtnerei']},
  ],
  heizsaison: {entity: 'input_select.heizsaison', titel: 'Heizbetrieb', text: 'Holz im Winter, Öl im Sommer'},
  versorgung: [
    {id: 'strom1', art: 'strom', name: 'Strom · Zähler 1', ort: 'Mangoldinger Straße 1', standorte: ['m1'], messung: 'voll', leistung: 'sensor.zaehler1_leistung', solar: 'sensor.pv_leistung', verbrauch_heute: 'sensor.zaehler1_verbrauch_heute', solar_heute: 'sensor.pv_ertrag_heute', einspeisung_heute: 'sensor.zaehler1_einspeisung_heute',
      versorgt: [{name: 'Werkstatt', standort: 'm1', leistung: 'sensor.shelly_werkstatt_leistung'}, {name: 'Büro links', standort: 'm1', leistung: 'sensor.shelly_buero_links_leistung'}, {name: 'Büro Anbau', standort: 'm1'}, {name: 'Stadel', standort: 'm1'}, {name: 'Neue Halle', standort: 'm1', leistung: 'sensor.shelly_neue_halle_leistung'}, {name: 'Wallbox', standort: 'm1', leistung: 'sensor.wallbox_leistung'}],
      geplant: ['Zweite PV-Anlage', 'Stromspeicher']},
    {id: 'strom2', art: 'strom', name: 'Strom · Zähler 2', ort: 'Ammerhofweg 2', standorte: ['a2', 'm1a', 'w1', 'gae', 'm1'], messung: 'teilweise', hinweis: 'Der Gesamtverbrauch an diesem Zähler wird noch nicht gemessen. Werte gibt es bisher nur für das Wohnhaus 1a.',
      versorgt: [{name: 'Haus Onkel', standort: 'a2'}, {name: 'Wohnhaus 1a', standort: 'm1a', leistung: 'sensor.wohnhaus_1a_leistung'}, {name: 'Waidl 1 · Halle', standort: 'w1'}, {name: 'Waidl 1 · Wohnhaus', standort: 'w1'}, {name: 'Alte Gärtnerei', standort: 'gae'}, {name: 'Büro rechte Hälfte', standort: 'm1'}]},
    {id: 'gas1', art: 'gas', name: 'Gas 1', ort: 'Mangoldinger Straße 1a', standorte: ['m1a'], messung: 'therme', verbrauch_heute: 'sensor.1a_ems_esp_boiler_gas_heute', werte_titel: 'Therme',
      werte: [{name: 'Außentemperatur', entity: 'sensor.1a_ems_esp_boiler_outside_temperature', icon: 'mdi:thermometer'}, {name: 'Vorlauf', entity: 'sensor.1a_ems_esp_boiler_current_flow_temperature', icon: 'mdi:thermometer'}, {name: 'Warmwasser', entity: 'sensor.1a_ems_esp_boiler_dhw_current_intern_temperature', icon: 'mdi:water-thermometer'}]},
    {id: 'gas2', art: 'gas', name: 'Gas 2', ort: 'Waidl 1', standorte: ['w1'], messung: 'keine', beschreibung: 'Waidl 1 komplett'},
    {id: 'holz', art: 'holz', name: 'Holzheizung', standorte: ['m1', 'a2'], saison: 'winter', messung: 'offen', beschreibung: 'Büro, Wohnung · im Winter auch Ammerhofweg 2', versorgt: [{name: 'Büro', standort: 'm1', hinweis: 'Winter'}, {name: 'Wohnung', hinweis: 'Winter'}, {name: 'Haus Onkel', standort: 'a2', hinweis: 'Winter'}]},
    {id: 'oel', art: 'oel', name: 'Ölheizung', ort: 'Ammerhofweg 2', standorte: ['a2'], saison: 'sommer', messung: 'offen', versorgt: [{name: 'Haus Onkel', standort: 'a2', hinweis: 'Sommer'}]},
    {id: 'wasser', art: 'wasser', name: 'Stadtwasser', ort: 'Ammerhofweg 2', standorte: ['a2'], messung: 'keine', beschreibung: 'nur Ammerhofweg 2'},
    {id: 'brunnen', art: 'brunnen', name: 'Brunnen', standorte: ['m1', 'm1a', 'w1', 'gae'], messung: 'geplant', beschreibung: 'alle Gebäude außer Ammerhofweg 2', hinweis: 'Die Steuerung kommt über eine Siemens LOGO!.'},
    {id: 'internet', art: 'internet', name: 'Internet', ort: 'Mangoldinger Straße 1', standorte: ['m1', 'm1a', 'a2', 'w1', 'gae'], beschreibung: 'kommt in Mangoldinger 1 an · versorgt alles', status: 'binary_sensor.unifi_internet',
      werte: [{name: 'Download', entity: 'sensor.unifi_wan_download', icon: 'mdi:download'}, {name: 'Upload', entity: 'sensor.unifi_wan_upload', icon: 'mdi:upload'}]},
  ],
  geraete: [
    {name: 'Spülmaschine', art: 'spuelmaschine', bereich: 'Küche', status: 'sensor.spuelmaschine_status', restzeit: 'sensor.spuelmaschine_restzeit', fortschritt: 'sensor.spuelmaschine_fortschritt', programm: 'sensor.spuelmaschine_programm'},
    {name: 'Waschmaschine', art: 'waschmaschine', bereich: 'Waschküche', status: 'sensor.waschmaschine_status', mitteilung: 'input_boolean.waschmaschine_mitteilung'},
  ],
  kameras: [{entity: 'camera.einfahrt', standort: 'm1'}],
  ereignisse: ['binary_sensor.einfahrt_person'],
  szenen: [
    {name: 'Feierabend', beschreibung: 'Firma: Licht aus, Tore zu', entity: 'script.feierabend_firma', standort: 'm1', icon: 'mdi:lock'},
    {name: 'Gute Nacht', beschreibung: '1a: Licht und TV aus', entity: 'scene.gute_nacht', standort: 'm1a', icon: 'mdi:weather-night'},
  ],
};

/* Tageskurven für den Verlauf */
const pvAt = t => { const x = (t - 7.4) / 11.2; if (x <= 0 || x >= 1) return 0; let v = 6.5 * Math.pow(Math.sin(Math.PI * x), 1.6); if (t > 10.5 && t < 11.25) v *= 0.55; return v; };
const loadAt = t => { let v = 0.55 + 0.08 * Math.sin(t * 1.7); if (t >= 6.5 && t < 17) v += 2.1 + 0.6 * Math.sin(t * 2.3); if (t >= 9 && t < 9.5) v += 1.8; if (t >= 14 && t < 14.5) v += 1.2; if (t >= 12 && t < 12.75) v -= 1.2; return Math.max(0.3, v); };

export function createMockHass(onChange){
  const states = {}, entities = {};
  for (const e of E){
    states[e.eid] = {entity_id: e.eid, state: e.state, attributes: Object.fromEntries(Object.entries(e.attrs).filter(([, v]) => v != null)), last_changed: ago(e.changed), last_updated: ago(e.changed), context: {id: e.eid}};
    entities[e.eid] = {entity_id: e.eid, area_id: e.area, labels: e.labels, device_id: null, platform: 'demo'};
  }
  const floors = Object.fromEntries(FLOORS.map(([id, name, level]) => [id, {floor_id: id, name, level, icon: null, aliases: []}]));
  const areas = Object.fromEntries(AREAS.map(([id, name, floor]) => [id, {area_id: id, name, floor_id: floor, icon: null, labels: [], aliases: []}]));
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
    const t0 = Date.parse(msg.start_time), t1 = Date.parse(msg.end_time);
    if (msg.type === 'history/history_during_period'){
      const out = {};
      for (const eid of msg.entity_ids){
        const fn = eid === 'sensor.pv_leistung' ? pvAt : eid === 'sensor.zaehler1_leistung' ? loadAt : null;
        if (!fn) continue;
        const list = [];
        for (let t = t0; t <= t1; t += 5 * MIN){ const h = (t - t0) / 3600000; list.push({s: String(Math.round(fn(h) * 1000)), lu: t / 1000}); }
        out[eid] = list;
      }
      return out;
    }
    if (msg.type === 'logbook/get_events'){
      const at = (h, m) => { const d = new Date(t0); d.setHours(h, m, 0, 0); return d.getTime() / 1000; };
      return [
        {entity_id: 'binary_sensor.einfahrt_person', state: 'on', when: at(15, 12)},
        {entity_id: 'binary_sensor.einfahrt_person', state: 'off', when: at(15, 14)},
        {entity_id: 'cover.werkstatt_tor', state: 'open', when: at(13, 31)},
        {entity_id: 'lock.buero_eingang', state: 'unlocked', when: at(13, 5)},
        {entity_id: 'lock.buero_eingang', state: 'locked', when: at(13, 6)},
      ].filter(e => e.when * 1000 <= t1 && msg.entity_ids.includes(e.entity_id));
    }
    throw new Error(`Mock kennt ${msg.type} nicht`);
  };

  hass = {
    states, entities, areas, floors, devices: {},
    user: {id: 'mock-admin', name: 'Admin', is_admin: true},
    themes: {darkMode: dark},
    language: 'de', locale: {language: 'de'},
    hassUrl: p => p,
    formatEntityState: st => `${st.state}${st.attributes.unit_of_measurement ? ' ' + st.attributes.unit_of_measurement : ''}`,
    callService, callWS,
  };
  return hass;
}
