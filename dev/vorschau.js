// Lokale Vorschau: lädt das Panel mit nachgebautem hass-Objekt.
// ?dunkel bzw. ?hell an die Adresse hängen, um das Farbschema zu erzwingen.
import '../multisite-panel.js';
import {createMockHass, mockConfig} from './mock-hass.js';

// Ersatz für <ha-icon> aus Home Assistant: zeichnet MDI-Icons aus @mdi/js
let mdi = {};
try { mdi = await import('https://cdn.jsdelivr.net/npm/@mdi/js@7.4.47/mdi.js'); }
catch (e) { console.warn('MDI-Icons konnten nicht geladen werden, es erscheinen Platzhalter.', e); }
const toName = icon => 'mdi' + String(icon).replace(/^mdi:/, '').split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
class HaIcon extends HTMLElement {
  static get observedAttributes(){ return ['icon']; }
  connectedCallback(){ this._r(); }
  attributeChangedCallback(){ this._r(); }
  _r(){
    const d = mdi[toName(this.getAttribute('icon') || '')] || mdi.mdiHelpCircleOutline || 'M4 4h16v16H4z';
    if (!mdi[toName(this.getAttribute('icon') || '')] && Object.keys(mdi).length) console.warn('Unbekanntes Icon', this.getAttribute('icon'));
    this.innerHTML = `<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);display:block;fill:currentColor"><path d="${d}"></path></svg>`;
  }
}
if (!customElements.get('ha-icon')) customElements.define('ha-icon', HaIcon);

const panel = document.getElementById('panel');
panel.panel = {url_path: 'zuhause', config: mockConfig};
panel.narrow = window.innerWidth < 870;
panel.hass = createMockHass(h => { panel.hass = h; });
window.addEventListener('resize', () => { panel.narrow = window.innerWidth < 870; });
window.addEventListener('hass-more-info', ev => console.info('[mock] More-Info für', ev.detail.entityId));
window.addEventListener('hass-toggle-menu', () => console.info('[mock] Menü öffnen'));
