import {developerSetup} from "./desktopReleaseInstructions.mjs";
function CopyValue({label,value,onCopy}) {
  return <div className="dr-setup-value"><strong>{label}</strong><div><code>{value}</code><button type="button" aria-label={"Copy "+label.toLowerCase()} onClick={()=>onCopy(value,label+" copied.")}>Copy</button></div></div>;
}
export function DesktopDeveloperSetup({release,cdn,activeRelease,onCopy}) {
  const setup=developerSetup(release,cdn,activeRelease);
  return <details className="dr-setup" open>
    <summary>Developer setup <span>Links &amp; code</span></summary>
    {!setup?<p>Developer links are unavailable. Refresh after the backend update.</p>:<>
      <p className="dr-meta">{setup.status}</p>
      {setup.downloadUrl&&<CopyValue label="Website download link" value={setup.downloadUrl} onCopy={onCopy}/>}
      <p className="dr-meta">Use this link in your website’s download button. It follows the current release for this operating system, processor and channel.</p>
      {setup.versionUrl&&<CopyValue label="Exact-version link" value={setup.versionUrl} onCopy={onCopy}/>}
      {setup.html&&<details><summary>Website code example</summary><pre>{setup.html}</pre><button onClick={()=>onCopy(setup.html,"Website code copied.")}>Copy website code</button></details>}
      {setup.updateBaseUrl?<details className="dr-updater-details"><summary>Automatic updates · Electron</summary>
        <p className="dr-meta">Configure this before building the installer. Uploading a file does not add an updater to an existing app.</p>
        <CopyValue label="Update feed directory" value={setup.updateBaseUrl} onCopy={onCopy}/>
        {setup.metadataUrl&&<CopyValue label="Update metadata file" value={setup.metadataUrl} onCopy={onCopy}/>}
        <p className="dr-meta">Merge this into electron-builder configuration for {release.platform} / {release.arch}. Keep your other build settings.</p>
        <pre>{setup.builder}</pre><button onClick={()=>onCopy(setup.builder,"Updater configuration copied.")}>Copy updater configuration</button>
        {setup.windows&&<><p className="dr-meta">For the <a href="https://github.com/Bright-Access-Consulting-LLC/CoPilotIQ/pull/42" target="_blank" rel="noreferrer">existing Windows updater integration</a>, run in CoPilotIQ/new1/NavSharp/overlay-ai using PowerShell:</p><pre>{setup.windows}</pre><button onClick={()=>onCopy(setup.windows,"Windows build commands copied.")}>Copy Windows build commands</button></>}
        <p className="dr-meta">Use electron-updater and keep the existing update manager. Defer installation while a session is active. Test signing and an update between two native builds. <a href="https://www.electron.build/v26/docs/features/auto-update/" target="_blank" rel="noreferrer">Electron setup guide</a></p>
      </details>:<p className="dr-meta">Automatic-update metadata is not enabled for this release. The download link still works after publication.</p>}
      <button className="dr-copy-notes" onClick={()=>onCopy(setup.notes,"Developer notes copied.")}>Copy developer notes</button>
      <p className="dr-meta">Share these public links with your developer. Keep AWS credentials and private upload links out of application code.</p>
    </>}
  </details>;
}
