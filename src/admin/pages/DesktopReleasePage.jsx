import {useCallback,useEffect,useRef,useState} from "react";
import {useAuth} from "@/features/auth/useAuth";
import {apiFetchWithRefresh} from "@/api/client";
import "./DesktopReleasePage.css";
import {DesktopDeveloperSetup} from "./DesktopDeveloperSetup.jsx";

const SYSTEMS={windows:"Windows",macos:"macOS",linux:"Linux"};
const ARCHES={windows:["x64","arm64"],macos:["arm64","x64","universal"],linux:["x64","arm64"]};
const TYPES={windows:".exe,.msi,.blockmap",macos:".dmg,.pkg,.zip,.blockmap",linux:".AppImage,.deb,.rpm,.blockmap"};
const size=n=>n>=1024**3?(n/1024**3).toFixed(2)+" GiB":(n/1024**2).toFixed(1)+" MiB";
const when=s=>new Date(s).toLocaleString();
const initial={platform:"windows",arch:"x64",channel:"stable",version:"",sourceCommit:"",notes:"",autoUpdate:false};
async function checksum(file,signal) {
  const h=await createSHA256();h.init();
  for(let i=0;i<file.size;i+=4*1024**2) {signal.throwIfAborted();h.update(new Uint8Array(await file.slice(i,i+4*1024**2).arrayBuffer()));}
  return h.digest();
}
function put(url,blob,signal,onProgress) {
  return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest(),abort=()=>x.abort();
    x.open("PUT",url); x.timeout=15*60000;
    x.upload.onprogress=e=>onProgress(e.loaded);
    const finish=()=>signal.removeEventListener("abort",abort);
    x.onload=()=>{finish();x.status>=200&&x.status<300?resolve():reject(new Error("Upload interrupted. You can resume this draft."));};
    x.onerror=x.ontimeout=()=>{finish();reject(new Error("Connection interrupted. Select the same files to resume."));};
    x.onabort=()=>{finish();reject(new DOMException("Upload paused.","AbortError"));};
    signal.addEventListener("abort",abort,{once:true});if(signal.aborted)return abort();x.send(blob);
  });
}
function Dialog({title,onClose,children,busy}) {
  const ref=useRef(null);
  useEffect(()=>{
    const prev=document.activeElement;ref.current?.focus();
    const key=e=>{
      if(e.key==="Escape"&&!busy)onClose();
      if(e.key==="Tab") {
        const els=[...ref.current.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(x=>!x.disabled);
        const first=els[0],last=els.at(-1);
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener("keydown",key);return()=>{document.removeEventListener("keydown",key);prev?.focus();};
  },[onClose,busy]);
  return <div className="dr-backdrop"><section ref={ref} tabIndex={-1} className="dr-dialog" role="dialog" aria-modal="true" aria-label={title}>
    <header><h2>{title}</h2><button aria-label="Close" onClick={onClose} disabled={busy}>×</button></header>{children}
  </section></div>;
}
export function DesktopReleasePage() {
  const {handleRefreshSuccess,handleRefreshFailure}=useAuth();
  const api=useCallback(async(path,options)=> (await apiFetchWithRefresh("/desktop"+path,options,{onRefreshSuccess:handleRefreshSuccess,onRefreshFailure:handleRefreshFailure})).data,[handleRefreshSuccess,handleRefreshFailure]);
  const [data,setData]=useState(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[filter,setFilter]=useState("all");
  const [dialog,setDialog]=useState(null),[form,setForm]=useState(initial),[files,setFiles]=useState([]),[primary,setPrimary]=useState("");
  const [importMode,setImportMode]=useState(false),[incoming,setIncoming]=useState({name:"",bytes:"",expectedSha256:""});
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState(""),[confirmed,setConfirmed]=useState(false),[evidence,setEvidence]=useState(""),[typed,setTyped]=useState("");
  const [history,setHistory]=useState([]),[access,setAccess]=useState([]);
  const control=useRef(null),resumeInput=useRef(null),resumeId=useRef(null),mounted=useRef(true);
  const reload=useCallback(async()=>{try{const r=await api("/releases");if(mounted.current){setData(r);}}catch(e){if(mounted.current)setError(e.message);}},[api]);
  useEffect(()=>{mounted.current=true;reload();const id=setInterval(reload,5000);return()=>{mounted.current=false;clearInterval(id);control.current?.abort();};},[reload]);
  const close=useCallback(()=>{setDialog(null);setConfirmed(false);setEvidence("");setTyped("");},[]);
  async function upload(r,selected) {
    for(const f of r.files) {
      if(f.sourceVersion)continue;
      const local=selected.find(x=>x.name===f.name&&x.size===f.bytes);
      if(!local)throw new Error("Select the original file "+f.name+" to resume.");
      setProgress("Checking "+f.name+"…");
      if(await checksum(local,control.current.signal)!==f.expectedSha256)throw new Error(f.name+" differs from the original draft. Choose the original file.");
      const count=Math.ceil(f.bytes/data.partBytes);
      for(let n=1;n<=count;n++) {
        control.current.signal.throwIfAborted();
        const part=await api("/releases/"+r.id+"/files/"+f.id+"/part",{method:"POST",data:{number:n}});
        if(part.uploaded.some(x=>x.number===n))continue;
        const start=(n-1)*data.partBytes,blob=local.slice(start,start+data.partBytes);
        await put(part.url,blob,control.current.signal,loaded=>setProgress(f.name+" · "+Math.round((start+loaded)/f.bytes*100)+"%"));
      }
      await api("/releases/"+r.id+"/files/"+f.id+"/complete",{method:"POST",data:{}});
    }
    await api("/releases/"+r.id+"/actions/verify",{method:"POST",data:{}});
    setNotice("Upload complete. File verification and private backup are running.");
  }
  async function create(e) {
    e.preventDefault();setBusy(true);setError("");control.current=new AbortController();
    try {
      let descriptors;
      if(importMode)descriptors=[{...incoming,bytes:Number(incoming.bytes),primary:true}];
      else {
        descriptors=[];
        for(const f of files){setProgress("Checking "+f.name+"…");descriptors.push({name:f.name,bytes:f.size,primary:f.name===primary,expectedSha256:await checksum(f,control.current.signal)});}
      }
      const r=await api("/releases",{method:"POST",data:{...form,files:descriptors}});
      if(importMode) {
        const f=r.files[0];
        await api("/releases/"+r.id+"/files/"+f.id+"/import",{method:"POST",data:{key:"copilotiq/incoming/"+r.version+"/"+r.platform+"/"+f.name}});
        await api("/releases/"+r.id+"/actions/verify",{method:"POST",data:{}});
        setNotice("Incoming S3 file registered. Verification is running.");
      } else await upload(r,files);
      close();await reload();
    }catch(e){setError(e.name==="AbortError"?"Upload paused. Your draft is saved; select the same files to resume.":e.message);}
    finally{setBusy(false);setProgress("");control.current=null;await reload();}
  }
  async function resume(selected) {
    const r=data.releases.find(x=>x.id===resumeId.current);if(!r||!selected.length)return;
    setBusy(true);control.current=new AbortController();
    try{await upload(r,selected);await reload();}catch(e){setError(e.name==="AbortError"?"Upload paused.":e.message);}
    finally{setBusy(false);setProgress("");control.current=null;}
  }
  async function action(e) {
    e.preventDefault();setBusy(true);setError("");
    try {
      if(dialog.kind==="notes")await api("/releases/"+dialog.release.id+"/notes",{method:"PATCH",data:{notes:evidence}});
      else await api("/releases/"+dialog.release.id+"/actions/"+dialog.kind,{method:"POST",data:{confirmed,evidence,confirmVersion:typed}});
      setNotice("Request queued. The status will update when it finishes.");close();await reload();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function download(r,f) {
    try {const result=await api("/releases/"+r.id+"/files/"+f.id+"/download",{method:"POST",data:{}});const a=document.createElement("a");a.href=result.url;a.rel="noreferrer";a.click();}
    catch(e){setError(e.message);}
  }
  async function showHistory(r){setDialog({kind:"history",release:r});setHistory([]);try{setHistory(await api("/releases/"+r.id+"/history"));}catch(e){setError(e.message);}}
  async function showAccess(){setDialog({kind:"access"});try{setAccess(await api("/access"));}catch(e){setError(e.message);}}
  async function changeAccess(user){try{setAccess(await api("/access",{method:"PUT",data:{adminId:user.id,upload:!user.upload}}));}catch(e){setError(e.message);}}
  const copyText=async(text,message)=>{try{await navigator.clipboard.writeText(text);setNotice(message);}catch{setError("Could not copy. Select and copy the text instead.");}};
  const releases=data?.releases.filter(r=>filter==="all"||r.platform===filter)||[];
  return <main className="dr-page">
    <header className="dr-heading"><div><span className="dr-eyebrow">DESKTOP DISTRIBUTION</span><h1>Desktop releases</h1><p>Upload privately. Publish with confidence. Keep a verified release ready to restore.</p></div>
      <div className="dr-actions">{data?.capabilities.manage&&<button onClick={showAccess}>Upload access</button>}{data?.capabilities.upload&&<button className="dr-primary" disabled={busy} onClick={()=>{setForm(initial);setFiles([]);setPrimary("");setImportMode(false);setDialog({kind:"create"});}}>＋ New release</button>}</div></header>
    {error&&<div className="dr-message dr-error" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss error">×</button></div>}
    {notice&&<div className="dr-message" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss message">×</button></div>}
    {progress&&<div className="dr-message" role="status">{progress}<button onClick={()=>control.current?.abort()}>Pause upload</button></div>}
    {!data?<div className="dr-empty">{error?<button onClick={reload}>Try again</button>:"Loading releases…"}</div>:<>
      <div className="dr-platforms">{Object.entries(SYSTEMS).map(([key,label])=><section key={key}><span className="dr-platform-icon" aria-hidden="true">{key==="windows"?"▦":key==="macos"?"◉":"⌘"}</span><h2>{label}</h2>
        {data.channels.filter(c=>data.releases.some(r=>r.id===c.activeId&&r.platform===key)).map(c=>{const r=data.releases.find(r=>r.id===c.activeId);return <p key={c.id}><strong>{r.version}</strong> · {r.arch} · {r.channel}</p>;})}
        {!data.channels.some(c=>data.releases.some(r=>r.id===c.activeId&&r.platform===key))&&<p>No managed release published</p>}
      </section>)}</div>
      <div className="dr-section-heading"><h2>Release library</h2><label>Operating system <select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All platforms</option>{Object.entries(SYSTEMS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button onClick={reload}>Refresh</button></div>
      {!releases.length&&<div className="dr-empty">No releases yet. Add a draft to begin. Existing external download feeds remain unchanged.</div>}
      <div className="dr-library">{releases.map(r=>{
        const c=data.channels.find(x=>x.id===[r.platform,r.arch,r.channel].join("-"));
        const current=c?.activeId===r.id,rollback=c?.previousId===r.id,protectedRelease=current||rollback;
        const operation=data.operations.find(x=>x.releaseId===r.id&&["queued","running"].includes(x.status));
        const failed=data.operations.find(x=>x.releaseId===r.id&&["failed","recovery_required"].includes(x.status));
        return <article key={r.id} className="dr-release"><div className="dr-release-title"><div><h3>{SYSTEMS[r.platform]} <span>{r.version}</span></h3><p>{r.arch} · {r.channel} · {size(r.files.reduce((n,f)=>n+f.bytes,0))}</p></div><span className={"dr-badge "+(current?"dr-live":"")}>{current?"Current":rollback?"Rollback ready":r.state}</span></div>
          <p className="dr-notes">{r.notes||"No release notes."}</p><p className="dr-meta">Added {when(r.createdAt)} · Source {r.sourceCommit.slice(0,8)}</p>
          {r.files.map(f=><div className="dr-file" key={f.id}><div><strong>{f.name}</strong><small>{size(f.bytes)}{f.sha256?" · SHA-256 "+f.sha256.slice(0,16)+"…":""}</small></div>{f.sourceVersion&&<button onClick={()=>download(r,f)} disabled={r.state==="deleting"}>Download</button>}</div>)}
          {operation&&<p className="dr-status" role="status">{operation.kind} · {operation.status==="queued"?"Waiting":"In progress"} — safe to leave this page.</p>}
          {!operation&&failed&&<div className="dr-status dr-error">{failed.error}<button onClick={async()=>{try{await api("/operations/"+failed.id+"/retry",{method:"POST",data:{}});await reload();}catch(e){setError(e.message);}}}>Retry operation</button></div>}
          <div className="dr-actions">
            {data.capabilities.upload&&!operation&&["draft","uploading","failed"].includes(r.state)&&<button disabled={busy} onClick={()=>{resumeId.current=r.id;resumeInput.current.click();}}>Resume upload</button>}
            {data.capabilities.upload&&!operation&&["draft","uploading","failed","ready"].includes(r.state)&&<button onClick={()=>{setEvidence(r.notes);setDialog({kind:"notes",release:r});}}>Edit notes</button>}
            {current&&<button onClick={()=>navigator.clipboard.writeText(r.files.find(f=>f.primary)?.url||data.cdn+"/"+r.files.find(f=>f.primary)?.publicKey).then(()=>setNotice("Download link copied.")).catch(()=>setError("Could not copy the link."))}>Copy version link</button>}
            {data.capabilities.manage&&!operation&&["ready","published","archived"].includes(r.state)&&!current&&<button className="dr-primary" onClick={()=>setDialog({kind:r.verification.publishedAt?"rollback":"publish",release:r})}>{r.verification.publishedAt?"Restore this release":"Review & publish"}</button>}
            {data.capabilities.manage&&!operation&&!protectedRelease&&r.state!=="deleting"&&<>{["ready","published","archived"].includes(r.state)&&<button onClick={()=>setDialog({kind:"archive",release:r})}>Archive</button>}<button className="dr-danger" onClick={()=>setDialog({kind:"delete",release:r})}>Delete permanently</button></>}
            <button onClick={()=>showHistory(r)}>Activity</button>
          </div>
          <DesktopDeveloperSetup release={r} cdn={data.cdn} activeRelease={data.releases.find(x=>x.id===c?.activeId)} onCopy={copyText}/>
        </article>;
      })}</div>
      <p className="dr-footnote">Published installers use the global download CDN. Restoring a release changes new downloads; it does not downgrade apps already installed. A higher-version corrective build is normally needed for those users.</p>
    </>}
    <input ref={resumeInput} type="file" multiple hidden onChange={e=>{resume([...e.target.files]);e.target.value="";}}/>
    {dialog?.kind==="create"&&<Dialog title="New desktop release" onClose={close} busy={busy}><form onSubmit={create}>
      <div className="dr-grid"><label>Operating system<select value={form.platform} onChange={e=>{setForm({...form,platform:e.target.value,arch:ARCHES[e.target.value][0]});setFiles([]);}}>{Object.entries(SYSTEMS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>Processor<select value={form.arch} onChange={e=>setForm({...form,arch:e.target.value})}>{ARCHES[form.platform].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Version<input required placeholder="1.2.0" value={form.version} onChange={e=>setForm({...form,version:e.target.value})}/></label>
      <label>Channel<select value={form.channel} onChange={e=>setForm({...form,channel:e.target.value})}><option value="stable">Stable</option><option value="beta">Beta</option></select></label></div>
      <label>Source commit<input required pattern="[a-f0-9]{40}" maxLength={40} placeholder="Full Git commit SHA" value={form.sourceCommit} onChange={e=>setForm({...form,sourceCommit:e.target.value.trim()})}/></label>
      <label>Release notes<textarea maxLength={12000} rows={3} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      <label className="dr-check"><input type="checkbox" checked={importMode} onChange={e=>setImportMode(e.target.checked)}/>Register an existing AWS incoming upload</label>
      {importMode?<><p>Use copilotiq/incoming/{form.version||"&lt;version&gt;"}/{form.platform}/ in the private downloads bucket.</p><label>File name<input required value={incoming.name} onChange={e=>setIncoming({...incoming,name:e.target.value})}/></label><label>Size in bytes<input required type="number" min="1" max="4294967296" value={incoming.bytes} onChange={e=>setIncoming({...incoming,bytes:e.target.value})}/></label><label>SHA-256<input required pattern="[a-f0-9]{64}" value={incoming.expectedSha256} onChange={e=>setIncoming({...incoming,expectedSha256:e.target.value.trim()})}/></label></>:
      <><label className="dr-drop">Installer files<input required type="file" multiple accept={TYPES[form.platform]} onChange={e=>{const all=[...e.target.files];setFiles(all);setPrimary(all.find(f=>!f.name.endsWith(".blockmap"))?.name||"");}}/><small>Up to 4 GiB per file. Uploaded as a private draft.</small></label>
      {files.map(f=><label className="dr-check" key={f.name}><input type="radio" name="primary" checked={primary===f.name} disabled={f.name.endsWith(".blockmap")} onChange={()=>setPrimary(f.name)}/>{f.name} · {size(f.size)} · main download</label>)}</>}
      <label className="dr-check"><input type="checkbox" checked={form.autoUpdate} onChange={e=>setForm({...form,autoUpdate:e.target.checked})}/>Publish compatible Electron updater metadata after owner review</label>
      <p className="dr-meta">Windows: NSIS EXE. macOS: signed DMG and ZIP. Linux: AppImage. Other native packages remain downloadable.</p>
      {busy&&<p role="status">{progress}</p>}{error&&<p className="dr-error" role="alert">{error}</p>}
      <footer><button type="button" onClick={busy?()=>control.current?.abort():close}>{busy?"Pause":"Cancel"}</button><button className="dr-primary" disabled={busy}>{busy?"Uploading…":"Save private draft"}</button></footer>
    </form></Dialog>}
    {dialog&&["publish","rollback","archive","delete","notes"].includes(dialog.kind)&&<Dialog title={dialog.kind==="notes"?"Edit release notes":dialog.kind==="delete"?"Delete release permanently":dialog.kind==="archive"?"Archive release":dialog.kind==="rollback"?"Restore previous release":"Review & publish"} onClose={close} busy={busy}><form onSubmit={action}>
      <p><strong>{SYSTEMS[dialog.release.platform]} {dialog.release.version}</strong> · {dialog.release.arch} · {dialog.release.channel}</p>
      {dialog.kind==="notes"?<label>Release notes<textarea maxLength={12000} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>:["publish","rollback"].includes(dialog.kind)?<><label className="dr-check"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I verified installation on this operating system and processor, reviewed security scanning and signing/notarization, and confirmed the updater files when enabled.</label><label>Test evidence<textarea required minLength={10} maxLength={2000} placeholder="Test device, result, signing evidence or CI report URL" value={evidence} onChange={e=>setEvidence(e.target.value)}/></label><p>Files are verified and privately backed up before the current download changes. Existing installations are not automatically downgraded.</p></>:
      dialog.kind==="delete"?<><p>Removes this release’s managed files and backups, all their S3 versions, and cached CDN copies. Downloaded copies cannot be recalled. Activity history stays.</p>{dialog.release.files.some(f=>f.externalIncoming)&&<p>The exact imported source version is also removed unless another release still needs it. Other independently uploaded versions are not affected.</p>}<label>Type {dialog.release.version} to confirm<input required value={typed} onChange={e=>setTyped(e.target.value)} autoComplete="off"/></label></>:<p>Keep the files and private backup, and mark the release archived. Known download links continue working.</p>}
      {error&&<p className="dr-error" role="alert">{error}</p>}<footer><button type="button" onClick={close} disabled={busy}>Cancel</button><button className={dialog.kind==="delete"?"dr-danger":"dr-primary"} disabled={busy}>{busy?"Submitting…":dialog.kind==="delete"?"Delete permanently":dialog.kind==="archive"?"Archive":dialog.kind==="notes"?"Save notes":"Confirm release"}</button></footer>
    </form></Dialog>}
    {dialog?.kind==="history"&&<Dialog title="Release activity" onClose={close}><ol className="dr-history">{history.map(h=><li key={h.id}><strong>{h.action.replace("desktop.","").replaceAll("_"," ")}</strong><small>{when(h.createdAt)} · {h.actorId}</small></li>)}</ol>{!history.length&&<p>No activity loaded.</p>}</Dialog>}
    {dialog?.kind==="access"&&<Dialog title="Developer upload access" onClose={close}><p>Selected administrators can upload and verify drafts. Publishing, rollback and permanent deletion stay owner-only. Existing AWS CLI access is managed separately.</p>{access.map(u=><div className="dr-file" key={u.id}><div><strong>{u.name||u.email}</strong><small>{u.email}</small></div>{u.role==="owner"?<span>Owner</span>:<button onClick={()=>changeAccess(u)}>{u.upload?"Remove upload access":"Allow uploads"}</button>}</div>)}</Dialog>}
  </main>;
}
export default DesktopReleasePage;
