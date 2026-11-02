const LABELS={windows:"Windows",macos:"macOS",linux:"Linux"};
const cleanUrl=value=>{
  if(!value)return null;
  try {const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}catch{return null;}
};
export function developerSetup(release,cdn,activeRelease) {
  const config=release.developerSetup;
  if(!config)return null;
  const downloadUrl=cleanUrl(config.downloadUrl),primary=release.files.find(f=>f.primary);
  const published=!!release.verification?.publishedAt&& !["deleting","deleted"].includes(release.state);
  const versionUrl=published&&primary?.publicKey?cleanUrl(String(cdn).replace(/\/$/,"")+"/"+primary.publicKey):null;
  const updateBaseUrl=release.autoUpdate?cleanUrl(config.updateBaseUrl):null;
  const metadataUrl=updateBaseUrl?cleanUrl(config.metadataUrl):null;
  const current=activeRelease?.id===release.id;
  const status=current?"Live — the download link serves this release.":activeRelease
    ? "The download link currently serves "+activeRelease.version+". It switches when this release is published or restored."
    : "Not live yet. An owner must publish a release before this download link works.";
  const platform=LABELS[release.platform]||release.platform;
  const html=downloadUrl?'<a href="'+downloadUrl.replaceAll("&","&amp;")+'">Download for '+platform+'</a>':null;
  const configKey={windows:"win",macos:"mac",linux:"linux"}[release.platform];
  const builder=updateBaseUrl&&configKey?JSON.stringify({[configKey]:{publish:[{provider:"generic",url:updateBaseUrl,channel:config.metadataChannel}]}},null,2):null;
  const windows=updateBaseUrl&&release.platform==="windows"&&release.arch==="x64"
    ? ['$env:APP_UPDATE_BASE_URL = "'+new URL(updateBaseUrl).origin+'"','$env:APP_UPDATE_CHANNEL = "'+release.channel+'"','$env:APP_RELEASE_VERSION = "'+release.version+'"',"npm run build"].join("\n"):null;
  const notes=[
    "MyInterviewCopilot — "+platform+" "+release.arch+" / "+release.channel+" / "+release.version,
    status,
    downloadUrl?"Website download button (always follows the current release):\n"+downloadUrl:"Download URL unavailable. Refresh after the backend is updated.",
    versionUrl?"This exact version (does not follow future releases):\n"+versionUrl:"Exact-version link becomes available after successful publication.",
    html?"Website HTML:\n"+html:"",
    updateBaseUrl?"Electron update feed directory (not an installer download):\n"+updateBaseUrl:"Automatic-update metadata is not enabled for this release.",
    metadataUrl?"Metadata file for checking the feed:\n"+metadataUrl:"",
    builder?"Merge into electron-builder config for this OS/architecture:\n"+builder:"",
    windows?"Existing Windows x64 updater build, from CoPilotIQ/new1/NavSharp/overlay-ai:\n"+windows+"\nSee https://github.com/Bright-Access-Consulting-LLC/CoPilotIQ/pull/42":"",
    updateBaseUrl?"Configure the updater before building. An already-built installer must be rebuilt if its feed is missing or different. Keep the existing update manager and defer installation while a session is active. Test a signed native installation and an update between two versions.":"",
    "Do not put S3 upload URLs, private download URLs, AWS keys or admin tokens into client code."
  ].filter(Boolean).join("\n\n");
  return {downloadUrl,versionUrl,updateBaseUrl,metadataUrl,status,html,builder,windows,notes};
}
