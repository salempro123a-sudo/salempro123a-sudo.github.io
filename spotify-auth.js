/* TRANSMISSION — Spotify auth, Authorization Code + PKCE.
   Session persistence on this static site uses browser-local storage (same-origin; exposed to XSS). Never place a client secret here. */
(function () {
  'use strict';
  const CONFIG = Object.freeze({
    clientId: '9dca144b3c2c42889f8d3f58705a85d0',
    redirectUri: 'https://salempro123a-sudo.github.io/musica.html',
    ownerId: '31irk65dnljb6i3jfg57lkixtgqu',
    scopes: ['streaming','user-read-private','user-read-playback-state','user-modify-playback-state','user-read-currently-playing','user-top-read','user-library-read','user-library-modify','playlist-read-private','user-read-recently-played']
  });
  const KEY='transmission_spotify_v3';
  const PKCE='transmission_spotify_pkce_v1';
  const COOLDOWN=KEY+'_cooldown_'+CONFIG.clientId;
  let refreshing=null;
  let serverCooldown=null;
  // A public maintenance window contains only availability, never account data.
  // It expires automatically and supplies Retry-After when CORS hides that header.
  const cooldownReady=fetch('./spotify-status.json',{cache:'no-store'}).then(async response=>{
    if(!response.ok)return;
    const value=await response.json();
    const until=Date.parse(value.retry_at||'');
    if(value.client_id===CONFIG.clientId&&value.reason==='QUOTA_EXCEEDED'&&Number.isFinite(until)&&until>Date.now()){
      serverCooldown={reason:value.reason,retryAt:until,resetKnown:true};
    }
  }).catch(()=>{});
  function readCooldown(){
    let stored=null;
    try{
      const value=JSON.parse(localStorage.getItem(COOLDOWN)||'null');
      if(value?.retryAt>Date.now())stored=value;
      else localStorage.removeItem(COOLDOWN);
    }catch{}
    if(serverCooldown?.retryAt>Date.now()&&(!stored||serverCooldown.retryAt>stored.retryAt))return serverCooldown;
    return stored;
  }
  function retryWindow(response,reason){
    const value=response.headers?.get?.('Retry-After');
    const seconds=Number(value);
    if(value&&Number.isFinite(seconds)&&seconds>=0)return {retryAt:Date.now()+Math.max(1,seconds)*1000,resetKnown:true};
    const date=value?Date.parse(value):NaN;
    if(Number.isFinite(date)&&date>Date.now())return {retryAt:date,resetKnown:true};
    // This is request backoff, not a claim that Spotify's quota resets then.
    return {retryAt:Date.now()+(reason==='QUOTA_EXCEEDED'?900000:60000),resetKnown:false};
  }
  function quotaError(block){
    const error=new SpotifyError(429,block.reason==='QUOTA_EXCEEDED'
      ?'Spotify agotó la cuota temporal de esta aplicación.'
      :'Spotify limitó temporalmente las solicitudes.');
    error.reason=block.reason;
    error.retryAt=block.retryAt;
    error.resetKnown=block.resetKnown===true;
    return error;
  }
  const tokenStore={
    read(){
      try{
        let value=null;
        try{value=localStorage.getItem(KEY)}catch{}
        if(!value)value=sessionStorage.getItem(KEY);
        if(!value){
          value=sessionStorage.getItem('transmission_spotify_v2');
          if(value){
            try{localStorage.setItem(KEY,value)}catch{sessionStorage.setItem(KEY,value)}
            sessionStorage.removeItem('transmission_spotify_v2');
          }
        }
        return value?JSON.parse(value):null;
      }catch{return null}
    },
    write(x){
      const value=JSON.stringify(x);
      try{localStorage.setItem(KEY,value)}catch{sessionStorage.setItem(KEY,value)}
    },
    clear(){
      try{localStorage.removeItem(KEY)}catch{}
      try{sessionStorage.removeItem(KEY)}catch{}
      try{sessionStorage.removeItem('transmission_spotify_v2')}catch{}
    }
  };
  function base64url(bytes){
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function randomToken(n=32) {
    const array = new Uint8Array(n);
    crypto.getRandomValues(array);
    return base64url(array);
  }
  async function challengeFrom(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256',data);
    return base64url(new Uint8Array(digest));
  }
  function saveToken(result, oldRefresh) {
    if (!result.access_token) throw new Error('Spotify no devolvió un access token.');
    const token={
      access: result.access_token,
      refresh: result.refresh_token||oldRefresh||'',
      expiresAt:Date.now()+Math.max(60,Number(result.expires_in||3600)-60)*1000
    };
    tokenStore.write(token);
    return token;
  }
  async function login() {
    sessionStorage.setItem('tm_return_to',location.pathname+location.search+location.hash);
    const verifier=randomToken(64),state=randomToken(20);
    sessionStorage.setItem(PKCE,JSON.stringify({verifier,state,at:Date.now()}));
    const url=new URL('https://accounts.spotify.com/authorize');
    url.search=new URLSearchParams({
      client_id:CONFIG.clientId,response_type:'code',redirect_uri:CONFIG.redirectUri,
      code_challenge_method:'S256',code_challenge:await challengeFrom(verifier),
      state,scope:CONFIG.scopes.join(' '),show_dialog:'false'
    });
    location.assign(url.href);
  }
  async function processRedirect(){
    const params=new URLSearchParams(location.search);
    const code=params.get('code'),err=params.get('error');
    if(!code&&!err)return false;
    history.replaceState(null,'',location.pathname+location.hash);
    if(err)throw new Error('Spotify canceló la autorización: '+err);
    const str=sessionStorage.getItem(PKCE);
    sessionStorage.removeItem(PKCE);
    if(!str)throw new Error('La verificación caducó. Vuelve a conectar tu cuenta.');
    let saved;try{saved=JSON.parse(str)}catch{}
    if(!saved||saved.state!==params.get('state')||Date.now()-saved.at>600000)
      throw new Error('No se pudo validar la sesión de Spotify. Inténtalo de nuevo.');
    const response=await fetch('https://accounts.spotify.com/api/token',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:CONFIG.clientId,grant_type:'authorization_code',
        code,redirect_uri:CONFIG.redirectUri,code_verifier:saved.verifier})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error('Spotify no autorizó la conexión ('+response.status+'). Revisa la Redirect URI registrada.');
    saveToken(result);
    return true;
  }
  async function refresh(){
    if(refreshing)return refreshing;
    const saved=tokenStore.read();
    if(!saved?.refresh){tokenStore.clear();throw new Error('La sesión caducó. Conéctate de nuevo.')}
    refreshing=(async()=>{
      const res=await fetch('https://accounts.spotify.com/api/token',{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({client_id:CONFIG.clientId,grant_type:'refresh_token',refresh_token:saved.refresh})
      });
      const result=await res.json().catch(()=>({}));
      if(!res.ok){
        if(result.error==='invalid_grant'||res.status===401){
          tokenStore.clear();
          throw new Error('Spotify terminó tu sesión. Conecta de nuevo tu cuenta para continuar.');
        }
        const error=new SpotifyError(res.status,'Spotify no pudo renovar la sesión en este momento. Tu autorización se conserva.');
        if(res.status===429)Object.assign(error,retryWindow(res));
        throw error;
      }
      return saveToken(result,saved.refresh).access;
    })();
    try{return await refreshing}finally{refreshing=null}
  }
  async function getToken(force=false){
    const saved=tokenStore.read();
    if(!saved?.access)throw new Error('Conecta tu cuenta Spotify para continuar.');
    return force || Date.now()>=saved.expiresAt ? refresh() : saved.access;
  }
  class SpotifyError extends Error {
    constructor(code,message){super(message);this.status=code;this.name='SpotifyError'}
  }
  async function api(path,options={},retry=true){
    await cooldownReady;
    const block=readCooldown();
    if(block)throw quotaError(block);
    const access=await getToken();
    const target='https://api.spotify.com/v1'+path;
    const headers={'Authorization':'Bearer '+access,...options.headers};
    if(options.body && !headers['Content-Type'])headers['Content-Type']='application/json';
    const res=await fetch(target,{...options,headers});
    if(res.status===401&&retry){
      await getToken(true);
      return api(path,options,false);
    }
    let data=null;
    // Some API responses are empty, plain text or HTML (e.g. quotas/CDN). Never
    // expose a raw JSON parser exception or the body to the page.
    if(res.status!==204&&res.status!==205){
      const raw=typeof res.text==='function'
        ?await res.text()
        :null;
      if(raw!==null){
        if(raw.trim()){
          try{data=JSON.parse(raw)}
          catch{if(res.ok)throw new SpotifyError(res.status,'Respuesta no válida de Spotify ('+res.status+'). Comprueba la sesión y el acceso en Diagnóstico.')}
        }
      }else{
        try{data=await res.json()}catch{
          throw new SpotifyError(res.status,'Spotify respondió con datos que no se pudieron interpretar ('+res.status+').');
        }
      }
    }
    if(!res.ok){
      const reason=data?.error?.reason||data?.error?.message||'';
      if(res.status===429){
        const reason=data?.error?.reason||'RATE_LIMITED';
        const block={reason,...retryWindow(res,reason)};
        try{localStorage.setItem(COOLDOWN,JSON.stringify(block))}catch{}
        throw quotaError(block);
      }
      const message=res.status===403?'Spotify no autorizó esta operación. Revisa permisos, acceso de desarrollo o cuota.':
        res.status===429?'Spotify limitó las solicitudes; espera antes de actualizar.':
        'Spotify respondió '+res.status+(reason?': '+String(reason).slice(0,140):'');
      throw new SpotifyError(res.status,message);
    }
    return data;
  }
  function logout(){tokenStore.clear();sessionStorage.removeItem(PKCE);sessionStorage.removeItem('tm_return_to')}
  window.TransmissionSpotify={CONFIG,login,processRedirect,getToken,api,logout,isLogged:()=>!!tokenStore.read()?.access,
    get cooldown(){return readCooldown()}};
})();
