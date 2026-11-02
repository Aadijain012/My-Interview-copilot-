import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { countryOptions } from './markets';
import { usePricingCountry } from './usePricingCountry';

function Flag({ code }) {
  const [failed, setFailed] = useState(false);
  return !code || ['AC', 'EA', 'TA'].includes(code) || failed
    ? <span className="dashboard-country-flag" aria-hidden="true">🌐</span>
    : <img className="dashboard-country-flag" src={import.meta.env.BASE_URL + 'flags/' + code.toLowerCase() + '.svg'} width="24" height="18" alt="" onError={() => setFailed(true)} />;
}
export default function DashboardCountry() {
  const { country, chooseCountry, message, status, retry } = usePricingCountry();
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [active, setActive] = useState(0);
  const trigger = useRef(null), dialog = useRef(null), search = useRef(null), id = useId();
  const selected = countryOptions.find(c => c.code === country);
  const options = countryOptions.filter(c => (c.name + ' ' + c.code + ' ' + c.currency).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const index = Math.min(active, Math.max(0, options.length - 1));
  const activeCode = options[index]?.code;
  const close = () => { dialog.current?.close(); setOpen(false); trigger.current?.focus(); };
  function show() {
    setQuery(''); setActive(Math.max(0, countryOptions.findIndex(c => c.code === country)));
    setOpen(true);
  }
  function choose(code) { chooseCountry(code); close(); }
  useLayoutEffect(() => {
    if (!open) return;
    const node = dialog.current;
    const position = () => {
      if (!trigger.current || window.innerWidth <= 600) return;
      const rect = trigger.current.getBoundingClientRect();
      const width = Math.min(370, window.innerWidth - 24);
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
      const top = Math.max(12, rect.bottom + 8);
      node.style.setProperty('--country-left', left + 'px');
      node.style.setProperty('--country-top', top + 'px');
      node.style.setProperty('--country-height', Math.max(0, window.innerHeight - top - 12) + 'px');
    };
    position(); node.showModal(); search.current?.focus({ preventScroll: true });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); node.close(); };
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(id + '-' + activeCode)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeCode, id]);
  function key(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setActive(Math.max(0, Math.min(options.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
    }
    if (event.key === 'Enter') { event.preventDefault(); if (options[index]) choose(options[index].code); }
  }
  return <div className="dashboard-country">
    <button ref={trigger} className="dashboard-country-trigger" type="button" data-country={country || ''}
      aria-label={'Country / region: ' + (selected?.name || 'Loading')} aria-haspopup="dialog" aria-expanded={open} onClick={show}>
      <Flag key={country} code={country} /><span className="dashboard-country-name">{selected?.name || 'Country'}</span><span className="dashboard-country-code" aria-hidden="true">{country || '—'}</span><span aria-hidden="true">⌄</span>
    </button>
    {message && status === 'error' && <div className="dashboard-country-status is-error" role="status">
      <span>{message}</span><button type="button" onClick={retry}>Try again</button>
    </div>}
    {open && createPortal(<dialog ref={dialog} className="dashboard-country-dialog" aria-labelledby={id + '-title'}
      onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }}>
      <div className="dashboard-country-heading"><div><h2 id={id + '-title'}>Country / region</h2></div>
        <button type="button" aria-label="Close country selector" onClick={close}>×</button></div>
      <div className="dashboard-country-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>
        <input ref={search} role="combobox" aria-label="Search country or currency" aria-expanded="true" aria-controls={id + '-list'}
          aria-autocomplete="list" aria-activedescendant={options.length ? id + '-' + options[index].code : undefined}
          autoComplete="off" spellCheck="false" placeholder="Search country or currency" value={query}
          onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={key} />
      </div>
      <ul id={id + '-list'} className="dashboard-country-options" role="listbox" aria-label="Countries and currencies">
        {options.map((c, i) => <li key={c.code} id={id + '-' + c.code} role="option" aria-selected={c.code === country}
          className={(i === index ? ' is-active' : '') + (c.code === country ? ' is-selected' : '')}
          onPointerDown={event => event.preventDefault()} onClick={() => choose(c.code)}>
          <Flag code={c.code} /><span>{c.name}</span><small>{c.currency}</small><b aria-hidden="true">{c.code === country ? '✓' : ''}</b>
        </li>)}
        {!options.length && <li className="dashboard-country-empty" role="presentation">No countries found. Try another name or currency.</li>}
      </ul>
    </dialog>, document.body)}
  </div>;
}
