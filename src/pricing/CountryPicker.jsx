import {useEffect,useId,useRef,useState} from 'react';
import {countryOptions} from './markets';
function Flag({code,selected=false}) {
 const [failed,setFailed]=useState(false);
 if(!code||['AC','EA','TA'].includes(code)||failed)return <span className={selected?'pricing-country-flag':'country-option-flag'} aria-hidden="true">🌐</span>;
 return <img className={selected?'pricing-country-flag':'country-option-flag'} src={import.meta.env.BASE_URL+'flags/'+code.toLowerCase()+'.svg'} width="24" height="18" alt="" aria-hidden="true" onError={()=>setFailed(true)}/>;
}
export default function CountryPicker({value,onChange}) {
 const id=useId(),root=useRef(null),input=useRef(null),[open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
 const selected=countryOptions.find(c=>c.code===value);
 const options=countryOptions.filter(c=>(c.name+' '+c.code+' '+c.currency).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const index=Math.min(active,Math.max(0,options.length-1));
 const close=()=>{setOpen(false);setQuery('');setActive(0);};
 const choose=c=>{onChange(c.code);close();input.current?.focus();};
 useEffect(()=>{const outside=e=>{if(!root.current?.contains(e.target)){setOpen(false);setQuery('');}};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[]);
 useEffect(()=>{if(open)document.getElementById(id+'-'+options[index]?.code)?.scrollIntoView({block:'nearest'});},[open,index,query,id]);
 function key(e){
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key==='Tab'){close();return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp') {e.preventDefault();if(!open){setOpen(true);setQuery('');setActive(Math.max(0,countryOptions.findIndex(c=>c.code===value)));}else setActive(Math.max(0,Math.min(options.length-1,index+(e.key==='ArrowDown'?1:-1))));}
  if(e.key==='Enter'){e.preventDefault();if(open&&options[index])choose(options[index]);else setOpen(true);}
 }
 return <div className="country-picker" ref={root} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))close();}}>
  <label htmlFor={id}>Country / region</label>
  <div className="pricing-country-control">
   <Flag key={open?'search':value} code={open?null:value} selected/>
   <input id={id} ref={input} role="combobox" aria-label="Pricing country" aria-expanded={open} aria-controls={id+'-list'} aria-autocomplete="list" aria-activedescendant={open&&options.length?id+'-'+options[index].code:undefined} data-country={value||''} autoComplete="off" spellCheck="false" placeholder={open?'Search country or currency':'Finding your country…'} value={open?query:selected?selected.name+' · '+selected.currency:''} onClick={()=>{if(!open){setOpen(true);setQuery('');setActive(Math.max(0,countryOptions.findIndex(c=>c.code===value)));}}} onChange={e=>{setOpen(true);setQuery(e.target.value);setActive(0);}} onKeyDown={key}/>
   <span className="country-chevron" aria-hidden="true">⌄</span>
  </div>
  {open&&<div className="country-popup"><ul id={id+'-list'} role="listbox" aria-label="Countries and currencies">
   {options.map((c,i)=><li id={id+'-'+c.code} key={c.code} role="option" aria-selected={c.code===value} className={i===index?'is-active':''} onPointerDown={e=>e.preventDefault()} onClick={()=>choose(c)}><Flag code={c.code}/><span>{c.name}</span><small>{c.currency}</small>{c.code===value&&<span aria-hidden="true">✓</span>}</li>)}
  </ul>{!options.length&&<p role="status">No countries found. Try another name or currency.</p>}</div>}
 </div>;
}
