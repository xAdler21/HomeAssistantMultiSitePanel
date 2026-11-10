// Erfundene Beispieldaten für die lokale Vorschau (Adressen, Namen und Geräte sind ausgedacht).
// Eigene Daten gehören nach privat/vorschau-daten.js (gleicher Aufbau, kommt nicht ins Repository).
import {sammler} from './mock-hass.js';

export const NAME = 'demo';

export const FLOORS = [
  ['werkstatt', 'Werkstatt', 0], ['buero', 'Büro', 0], ['neue_halle', 'Neue Halle', 0], ['stadel', 'Stadel', 0],
  ['1_stock', '1. Stock', 1], ['erdgeschoss', 'Erdgeschoss', 0], ['keller', 'Keller', -1],
  ['birkenweg', 'Birkenweg', 0], ['feld_wohnhaus', 'Feld Wohnhaus', 0], ['feld_halle', 'Feld Halle', 0],
  ['gartenhaus', 'Gartenhaus', 0], ['dachboden_alt', 'Dachboden', 2],
];
export const AREAS = [
  ['werkstatt', 'Werkstatt', 'werkstatt'], ['buero_links', 'Büro links', 'buero'], ['buero_rechts', 'Büro rechts', 'buero'],
  ['buero_anbau', 'Büro Anbau', 'buero'], ['neue_halle', 'Neue Halle', 'neue_halle'], ['stadel', 'Stadel', 'stadel'], ['hof', 'Hof', null],
  ['schlafzimmer', 'Schlafzimmer', '1_stock'], ['wohnzimmer', 'Wohnzimmer', 'erdgeschoss'], ['kuche', 'Küche', 'erdgeschoss'],
  ['heizung', 'Heizung', 'keller'], ['waschkuche', 'Waschküche', 'keller'], ['aussen', 'Aussen', null],
  ['bw_wohnzimmer', 'Wohnzimmer', 'birkenweg'], ['bw_heizraum', 'Heizraum', 'birkenweg'],
  ['fe_wohnzimmer', 'Wohnzimmer', 'feld_wohnhaus'], ['fe_halle', 'Halle', 'feld_halle'],
  ['gewachshaus', 'Gewächshaus', 'gartenhaus'], ['unnamed_room', 'Unnamed Room', null],
];

const {E, add, light, tempS, humS, clim, power, energy} = sammler();
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
light('light.stadel', 'Stadel Licht', false, 100, 'stadel');
light('light.hof', 'Hofbeleuchtung', false, 100, 'hof', true);
light('light.bw_wohnzimmer', 'Wohnzimmer Deckenlicht', false, 60, 'bw_wohnzimmer');
light('light.fe_halle', 'Halle Hallenlicht', false, 100, 'fe_halle');
light('light.gewachshaus', 'Pflanzenlicht', true, 100, 'gewachshaus');
add('light.unbekannt', 'off', {friendly_name: 'Dimmer (neu)', brightness: null, supported_color_modes: ['brightness']});
add('switch.werkstatt_kompressor', 'off', {friendly_name: 'Werkstatt Kompressor', icon: 'mdi:air-filter'}, 'werkstatt');
add('switch.therme_zirkulation', 'on', {friendly_name: 'Zirkulationspumpe'});
add('cover.schlafzimmer_rollladen', 'open', {friendly_name: 'Schlafzimmer Rollladen', device_class: 'shutter', current_position: 100}, 'schlafzimmer');

clim('climate.wohnzimmer', 'Wohnzimmer Heizkörper', 21.4, 22, 'wohnzimmer');
clim('climate.schlafzimmer', 'Schlafzimmer Heizkörper', 18.6, 18, 'schlafzimmer');
clim('climate.kuche', 'Küche Heizkörper', 21.0, 21, 'kuche');
clim('climate.buero_links', 'Büro links Heizkörper', 20.8, 21.5, 'buero_links');
clim('climate.buero_rechts', 'Büro rechts Heizkörper', 19.9, 21, 'buero_rechts');
clim('climate.buero_anbau', 'Büro Anbau Heizkörper', 19.2, 17, 'buero_anbau', {preset: 'eco'});
clim('climate.bw_wohnzimmer', 'Birkenweg Heizkörper', 21.9, 22, 'bw_wohnzimmer');
clim('climate.fe_wohnzimmer', 'Am Feld Heizkörper', 20.6, 21, 'fe_wohnzimmer');
tempS('sensor.werkstatt_temperatur', 'Werkstatt Temperatur', 16.8, 'werkstatt');
tempS('sensor.neue_halle_temperatur', 'Neue Halle Temperatur', 14.2, 'neue_halle');
tempS('sensor.stadel_temperatur', 'Stadel Temperatur', 12.0, 'stadel');
tempS('sensor.heizung_temperatur', 'Heizraum Temperatur', 23.4, 'heizung');
tempS('sensor.waschkuche_temperatur', 'Waschküche Temperatur', 19.5, 'waschkuche');
tempS('sensor.fe_halle_temperatur', 'Halle Temperatur', 13.5, 'fe_halle');
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
add('lock.haustuer_wohnhaus', 'locked', {friendly_name: 'Haustür'}, 'aussen');
add('cover.fe_hallentor', 'closed', {friendly_name: 'Hallentor', device_class: 'garage'}, 'fe_halle');
add('camera.einfahrt', 'idle', {friendly_name: 'Einfahrt', entity_picture: '/dev/kamera.svg?token=a'}, 'hof');
add('camera.hof', 'idle', {friendly_name: 'Hof', entity_picture: '/dev/kamera.svg?token=b'}, 'hof');
add('camera.haustuer', 'idle', {friendly_name: 'Haustür', entity_picture: '/dev/kamera.svg?token=c'}, 'aussen');
add('binary_sensor.einfahrt_person', 'off', {friendly_name: 'Einfahrt Person', device_class: 'occupancy'}, 'hof');

power('sensor.zaehler1_leistung', 'Zähler 1 Leistung', 2190);
power('sensor.pv_leistung', 'PV Leistung', 4230);
energy('sensor.zaehler1_verbrauch_heute', 'Zähler 1 Verbrauch heute', 27.6);
energy('sensor.pv_ertrag_heute', 'PV Ertrag heute', 31.2);
energy('sensor.zaehler1_einspeisung_heute', 'Einspeisung heute', 14.9);
power('sensor.werkstatt_leistung', 'Werkstatt Leistung', 1010);
power('sensor.neue_halle_leistung', 'Neue Halle Leistung', 590);
power('sensor.buero_links_leistung', 'Büro links Leistung', 310);
power('sensor.wallbox_leistung', 'Wallbox Leistung', 0);
power('sensor.wohnhaus_leistung', 'Wohnhaus Leistung', 480);
tempS('sensor.therme_aussentemperatur', 'Therme Außentemperatur', 11.2, null);
tempS('sensor.therme_vorlauf', 'Therme Vorlauf', 46, null);
tempS('sensor.therme_warmwasser', 'Therme Warmwasser', 51, null);
energy('sensor.therme_gas_heute', 'Gas heute', 71);
add('binary_sensor.router_internet', 'on', {friendly_name: 'Internet', device_class: 'connectivity'});
add('sensor.router_download', '248', {friendly_name: 'Download', unit_of_measurement: 'Mbit/s'});
add('sensor.router_upload', '41', {friendly_name: 'Upload', unit_of_measurement: 'Mbit/s'});
add('input_select.heizsaison', 'Winter', {friendly_name: 'Heizsaison', options: ['Winter', 'Sommer']});
add('weather.forecast_home', 'partlycloudy', {friendly_name: 'Zuhause', temperature: 11});
add('script.feierabend_firma', 'off', {friendly_name: 'Feierabend Firma'});
add('scene.gute_nacht', '2026-10-12T21:00:00+00:00', {friendly_name: 'Gute Nacht'});
export const ENTITIES = E;

export const VERLAUF = {'sensor.pv_leistung': 'solar', 'sensor.zaehler1_leistung': 'last'};
export const LOGBUCH = [
  {entity_id: 'binary_sensor.einfahrt_person', state: 'on', h: 15, m: 12},
  {entity_id: 'binary_sensor.einfahrt_person', state: 'off', h: 15, m: 14},
  {entity_id: 'cover.werkstatt_tor', state: 'open', h: 13, m: 31},
  {entity_id: 'lock.buero_eingang', state: 'unlocked', h: 13, m: 5},
  {entity_id: 'lock.buero_eingang', state: 'locked', h: 13, m: 6},
];
// Lageplan-Bild der Vorschau (gezeichnetes Beispiel-Areal)
export const BILDER = {'plan-demo.svg': '/dev/areal-demo.svg'};

export const mockConfig = {
  wetter: 'weather.forecast_home',
  aussentemperatur: 'sensor.therme_aussentemperatur',
  standorte: [
    {id: 'firma', name: 'Lindenstraße 4', kurz: 'Lindenstraße 4', kuerzel: 'Firma', rolle: 'Firma', icon: 'mdi:office-building', etagen: ['Werkstatt', 'Büro', 'Neue Halle', 'Stadel'], bereiche: ['Hof'], bereiche_titel: 'Außen'},
    {id: 'haus', name: 'Lindenstraße 4a', kurz: 'Lindenstraße 4a', kuerzel: '4a', rolle: 'Wohnhaus', icon: 'mdi:home', etagen: ['1. Stock', 'Erdgeschoss', 'Keller'], bereiche: ['Aussen'], bereiche_titel: 'Außen'},
    {id: 'birke', name: 'Birkenweg 7', kurz: 'Birkenweg 7', kuerzel: 'Birkenweg', rolle: 'Gästehaus', icon: 'mdi:home-variant', etagen: ['Birkenweg']},
    {id: 'feld', name: 'Am Feld 1', kurz: 'Am Feld 1', kuerzel: 'Feld', rolle: 'Wohnhaus & Halle', icon: 'mdi:warehouse', etagen: [{id: 'Feld Wohnhaus', name: 'Wohnhaus'}, {id: 'Feld Halle', name: 'Halle'}]},
    {id: 'garten', name: 'Gartenhaus', kurz: 'Gartenhaus', kuerzel: 'Garten', rolle: 'Gewächshaus', icon: 'mdi:flower', etagen: ['Gartenhaus']},
  ],
  heizsaison: {entity: 'input_select.heizsaison', titel: 'Heizbetrieb', text: 'Holz im Winter, Öl im Sommer'},
  plaene: [
    {id: 'areal', name: 'Areal', bild: 'plan-demo.svg', breite: 1600, hoehe: 1000, punkte: [
      {entity: 'light.werkstatt_hallenlicht', x: 24.4, y: 31},
      {entity: 'light.neue_halle', x: 60, y: 29},
      {entity: 'light.stadel', x: 88, y: 35},
      {entity: 'light.buero_links_decke', x: 16.9, y: 62},
      {entity: 'light.buero_rechts_decke', x: 28.1, y: 62},
      {entity: 'light.hof', x: 50, y: 61, name: 'Hof'},
      {entity: 'light.wohnzimmer_deckenlicht', x: 81.9, y: 70},
      {entity: 'light.aussen_garten', x: 93, y: 88},
    ]},
  ],
  versorgung: [
    {id: 'strom1', art: 'strom', name: 'Strom · Zähler 1', ort: 'Lindenstraße 4', standorte: ['firma'], messung: 'voll', leistung: 'sensor.zaehler1_leistung', solar: 'sensor.pv_leistung', verbrauch_heute: 'sensor.zaehler1_verbrauch_heute', solar_heute: 'sensor.pv_ertrag_heute', einspeisung_heute: 'sensor.zaehler1_einspeisung_heute',
      versorgt: [{name: 'Werkstatt', standort: 'firma', leistung: 'sensor.werkstatt_leistung'}, {name: 'Büro links', standort: 'firma', leistung: 'sensor.buero_links_leistung'}, {name: 'Büro Anbau', standort: 'firma'}, {name: 'Stadel', standort: 'firma'}, {name: 'Neue Halle', standort: 'firma', leistung: 'sensor.neue_halle_leistung'}, {name: 'Wallbox', standort: 'firma', leistung: 'sensor.wallbox_leistung'}],
      geplant: ['Zweite PV-Anlage', 'Stromspeicher']},
    {id: 'strom2', art: 'strom', name: 'Strom · Zähler 2', ort: 'Birkenweg 7', standorte: ['birke', 'haus', 'feld', 'garten', 'firma'], messung: 'teilweise', hinweis: 'Der Gesamtverbrauch an diesem Zähler wird noch nicht gemessen. Werte gibt es bisher nur für das Wohnhaus 4a.',
      versorgt: [{name: 'Gästehaus', standort: 'birke'}, {name: 'Wohnhaus 4a', standort: 'haus', leistung: 'sensor.wohnhaus_leistung'}, {name: 'Am Feld · Halle', standort: 'feld'}, {name: 'Am Feld · Wohnhaus', standort: 'feld'}, {name: 'Gartenhaus', standort: 'garten'}, {name: 'Büro rechte Hälfte', standort: 'firma'}]},
    {id: 'gas1', art: 'gas', name: 'Gas 1', ort: 'Lindenstraße 4a', standorte: ['haus'], messung: 'therme', verbrauch_heute: 'sensor.therme_gas_heute', werte_titel: 'Therme',
      werte: [{name: 'Außentemperatur', entity: 'sensor.therme_aussentemperatur', icon: 'mdi:thermometer'}, {name: 'Vorlauf', entity: 'sensor.therme_vorlauf', icon: 'mdi:thermometer'}, {name: 'Warmwasser', entity: 'sensor.therme_warmwasser', icon: 'mdi:water-thermometer'}]},
    {id: 'gas2', art: 'gas', name: 'Gas 2', ort: 'Am Feld 1', standorte: ['feld'], messung: 'keine', beschreibung: 'Am Feld komplett'},
    {id: 'holz', art: 'holz', name: 'Holzheizung', standorte: ['firma', 'birke'], saison: 'winter', messung: 'offen', beschreibung: 'Büro, Wohnung · im Winter auch Birkenweg 7', versorgt: [{name: 'Büro', standort: 'firma', hinweis: 'Winter'}, {name: 'Wohnung', hinweis: 'Winter'}, {name: 'Gästehaus', standort: 'birke', hinweis: 'Winter'}]},
    {id: 'oel', art: 'oel', name: 'Ölheizung', ort: 'Birkenweg 7', standorte: ['birke'], saison: 'sommer', messung: 'offen', versorgt: [{name: 'Gästehaus', standort: 'birke', hinweis: 'Sommer'}]},
    {id: 'wasser', art: 'wasser', name: 'Stadtwasser', ort: 'Birkenweg 7', standorte: ['birke'], messung: 'keine', beschreibung: 'nur Birkenweg 7'},
    {id: 'brunnen', art: 'brunnen', name: 'Brunnen', standorte: ['firma', 'haus', 'feld', 'garten'], messung: 'geplant', beschreibung: 'alle Gebäude außer Birkenweg 7', hinweis: 'Die Brunnensteuerung ist noch nicht angebunden.'},
    {id: 'internet', art: 'internet', name: 'Internet', ort: 'Lindenstraße 4', standorte: ['firma', 'haus', 'birke', 'feld', 'garten'], beschreibung: 'kommt in der Lindenstraße 4 an · versorgt alles', status: 'binary_sensor.router_internet',
      werte: [{name: 'Download', entity: 'sensor.router_download', icon: 'mdi:download'}, {name: 'Upload', entity: 'sensor.router_upload', icon: 'mdi:upload'}]},
  ],
  geraete: [
    {name: 'Spülmaschine', art: 'spuelmaschine', bereich: 'Küche', status: 'sensor.spuelmaschine_status', restzeit: 'sensor.spuelmaschine_restzeit', fortschritt: 'sensor.spuelmaschine_fortschritt', programm: 'sensor.spuelmaschine_programm'},
    {name: 'Waschmaschine', art: 'waschmaschine', bereich: 'Waschküche', status: 'sensor.waschmaschine_status', mitteilung: 'input_boolean.waschmaschine_mitteilung'},
  ],
  kameras: [{entity: 'camera.einfahrt', standort: 'firma'}],
  ereignisse: ['binary_sensor.einfahrt_person'],
  szenen: [
    {name: 'Feierabend', beschreibung: 'Firma: Licht aus, Tore zu', entity: 'script.feierabend_firma', standort: 'firma', icon: 'mdi:lock'},
    {name: 'Gute Nacht', beschreibung: '4a: Licht und TV aus', entity: 'scene.gute_nacht', standort: 'haus', icon: 'mdi:weather-night'},
  ],
};
