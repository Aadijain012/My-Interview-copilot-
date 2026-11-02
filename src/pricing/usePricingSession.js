import { authStorage } from '../auth/tokenStore.mjs';
import {useCallback, useEffect, useState} from 'react';
import {API_BASE, userSession} from '../utils/api';
import {tokenClaims} from '../auth/sessionRenewal.mjs';

function savedSession() {
  try {
    const token=authStorage.getItem('auth_token'), user=JSON.parse(authStorage.getItem('auth_user')||'null');
    return token && user?.id && tokenClaims(token)?.userId===user.id ? {token,user} : null;
  } catch { return null; }
}

// The pricing route mounts outside App. Validate the same backend session,
// including OTP sessions; Firebase's currentUser alone cannot represent these.
export function usePricingSession() {
  const [state,setState]=useState(()=>({status:'checking',user:null}));
  const [attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const retry=useCallback(()=>setAttempt(n=>n+1),[]);
  useEffect(()=>{
    let disposed=false,sequence=0,controller;
    async function check() {
      const run=++sequence;controller?.abort();
      try { await userSession.restore(); }
      catch { if(!disposed&&run===sequence)setState({status:'unavailable',user:null});return; }
      if(disposed||run!==sequence)return;
      const saved=savedSession();
      if(!saved){setState({status:'anonymous',user:null});return;}
      setState(previous=>previous.status==='authenticated' && previous.user?.id===saved.user.id ? previous : {status:'checking',user:null});
      controller=new AbortController();const request=controller;const timeout=setTimeout(()=>request.abort(),20000);
      try {
        // Read-only authenticated endpoint that exists on the API (the earlier
        // /api/legal/status was never implemented, so every check failed).
        // Shared fetch renews expired credentials and retries 401s.
        const response=await fetch(API_BASE+'/api/pricing/preference',{cache:'no-store',credentials:'omit',signal:request.signal,
          headers:{Authorization:'Bearer '+saved.token,'x-suppress-auth-redirect':'true'}});
        if(disposed||run!==sequence||savedSession()?.user.id!==saved.user.id)return;
        if(response.status===401||response.status===403){setState({status:'anonymous',user:null});return;}
        if(!response.ok)throw Error('Session check unavailable');
        const body=await response.json();if(body.ok!==true)throw Error('Session check unavailable');
        if(!disposed&&run===sequence&&savedSession()?.user.id===saved.user.id)setState({status:'authenticated',user:savedSession().user});
      } catch {
        if(!disposed&&run===sequence)setState({status:'unavailable',user:null});
      } finally {clearTimeout(timeout);}
    }
    const storage=event=>{if(!event.key||['auth_token','auth_user'].includes(event.key))check();};
    const visible=()=>{if(!document.hidden)check();};
    const expired=()=>{++sequence;controller?.abort();setState({status:'anonymous',user:null});};
    check();
    window.addEventListener('storage',storage);window.addEventListener('user-session-token',check);
    window.addEventListener('auth-expired',expired);window.addEventListener('focus',visible);window.addEventListener('online',visible);
    window.addEventListener('pageshow',visible);
    return()=>{disposed=true;++sequence;controller?.abort();window.removeEventListener('storage',storage);
      window.removeEventListener('user-session-token',check);window.removeEventListener('auth-expired',expired);
      window.removeEventListener('focus',visible);window.removeEventListener('online',visible);window.removeEventListener('pageshow',visible);};
  },[attempt]);
  async function logout(){
    if(busy)return;setBusy(true);setError('');
    try {await userSession.logout();authStorage.removeItem('auth_token');authStorage.removeItem('auth_user');
      window.dispatchEvent(new Event('auth-expired'));setState({status:'anonymous',user:null});
    }catch{setError('Could not finish signing out. Please try again.');}
    finally{setBusy(false);}
  }
  return {...state,retry,logout,busy,error};
}
