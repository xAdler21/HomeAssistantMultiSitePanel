// Ersatz für <ha-icon> aus Home Assistant: zeichnet MDI-Icons aus @mdi/js (nur für die lokale Vorschau)
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
    this.innerHTML = `<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);display:block;fill:currentColor"><path d="${d}"></path></svg>`;
  }
}
if (!customElements.get('ha-icon')) customElements.define('ha-icon', HaIcon);
