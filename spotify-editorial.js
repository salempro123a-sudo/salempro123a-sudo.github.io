/* TRANSMISSION / original editorial layout with actual Spotify tracks, playlists and player.
   Uses Spotify's official OAuth PKCE client and Web Playback SDK. No pretend audio. */
(async function(){
'use strict';
const sp=window.TransmissionSpotify;
if(!sp){console.error('Spotify authorization module missing');return}
const $=id=>document.getElementById(id);
const list={tracks:[],playlists:[],recent:[],liked:[],shared:null},owner=sp.CONFIG.ownerId;
let account=null,player=null,device=null,deviceSelected=false,hero=0,featured=null;
let selected=null,lastPlayerState=null,poll=null,sdkPromise=null,lastOnAirId=null;
let lastPlayback=null,publicSnapshot=null,accountTracks=[],accountSaved=[],accountArtists=[],manualUntil=0,station=null,ready=false;
let connectionError=null;
let recentEvents=[];
const safeArt=u=>typeof u==='string'&&/^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-ak\.spotifycdn\.com|seeded-session-images\.scdn\.co)\//.test(u)?u:'';
const title=t=>t?.name||'';
const artist=t=>(t?.artists||[]).map(x=>x.name).filter(Boolean).join(', ')||'';
const img=t=>safeArt(t?.album?.images?.[0]?.url||t?.images?.[0]?.url);
const first=(sel,root=document)=>root.querySelector(sel);
const create=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
const diagLog=[];
function status(message,error=false){
  const entry={at:new Date().toLocaleTimeString('es-PE'),message:String(message||''),error:!!error};
  if(entry.error)diagLog.unshift(entry);
  if(diagLog.length>15)diagLog.length=15;
  // All technical feedback belongs in the diagnostics menu, not under the player.
  const el=$('spotify-status');
  if(el){el.hidden=true;el.textContent='';el.setAttribute('aria-hidden','true')}
  if(error)console.warn('TRANSMISSION:',entry.message);
}
function banner(message,duration=3200){status(message);const toast=$('toast');if(!toast)return;toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),duration)}
function connectionMessage(){
  const block=sp.cooldown||connectionError;
  if(block?.status===429||block?.retryAt){
    const when=block.retryAt&&block.resetKnown===true?new Date(block.retryAt).toLocaleString('es-PE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'más tarde';
    return 'Tu cuenta ya está autorizada. Spotify ha limitado temporalmente el acceso de esta aplicación. Puedes reintentar '+when.replace(/\.$/,'')+'.';
  }
  return connectionError?.message||'No se pudo completar la conexión. Inténtalo de nuevo.';
}
function applyTrackArt(target,t){
  if(!target)return;
  const u=img(t);
  target.style.backgroundImage=u?'url("'+u+'")':'';
  target.classList.toggle('no-cover',!u);
}

/* A public snapshot is deliberately different from the signed-in visitor's private Spotify session.
   It is generated only after the page owner explicitly approves the public data. */
function validId(id){return typeof id==='string'&&/^[A-Za-z0-9]{22}$/.test(id)}
function publicTrack(raw){
  if(!raw||!validId(raw.id))return null;
  const a=Array.isArray(raw.artists)?raw.artists.slice(0,4):[];
  const artists=a.map(x=>({name:String(x?.name||'').slice(0,110)})).filter(x=>x.name);
  return {
    id:raw.id,uri:'spotify:track:'+raw.id,type:'track',name:String(raw.name||'').slice(0,220),
    is_playable:typeof raw.is_playable==='boolean'?raw.is_playable:undefined,
    linked_from:validId(raw.linked_from?.id)?{id:raw.linked_from.id}:undefined,
    artists:artists.length?artists:[{name:String(raw.artist||'Artista').slice(0,130)}],
    album:{id:raw.album?.id,name:String(raw.album?.name||'').slice(0,180),
      images:[{url:safeArt(raw.album?.images?.[0]?.url||raw.image)||''}],
      release_date:/^\d{4}(-\d{2})?(-\d{2})?$/.test(raw.album?.release_date||'')?raw.album.release_date:undefined},
    duration_ms:Number(raw.duration_ms)||0,
    external_urls:{spotify:'https://open.spotify.com/track/'+raw.id}
  }
}
function publicPlaylist(raw){
  if(!raw||!validId(raw.id))return null;
  return {
    id:raw.id,uri:'spotify:playlist:'+raw.id,
    name:String(raw.name||'Playlist').slice(0,150),
    images:[{url:safeArt(raw.images?.[0]?.url||raw.image)||''}],
    owner:{display_name:String(raw.owner?.display_name||raw.ownerName||'TRANSMISSION').slice(0,100)},
    items:{total:Math.max(0,Number(raw.items?.total??raw.total)||0)},
    external_urls:{spotify:'https://open.spotify.com/playlist/'+raw.id}
  }
}
function uniqueTracks(items,limit=40){
  const seen=new Set();
  const out=[];
  for(const t of items||[]){
    const track=publicTrack(t);
    if(!track||seen.has(track.id))continue;
    seen.add(track.id);out.push(track);
    if(out.length>=limit)break;
  }
  return out
}
async function getPublicSnapshot(){
  try{
    const res=await fetch('./featured.json?version='+Math.floor(Date.now()/900000),{cache:'no-store'});
    if(!res.ok)return null;
    const data=await res.json();
    if(data?.status!=='ready')return null;
    if(data.owner_id && data.owner_id!==owner)return null;
    const tracks=uniqueTracks(Array.isArray(data.tracks)?data.tracks:(data.track?[data.track]:[]));
    const playlists=(Array.isArray(data.playlists)?data.playlists:[]).slice(0,14).map(publicPlaylist).filter(Boolean);
    const recent=uniqueTracks(Array.isArray(data.recent)?data.recent:[]);
    const liked=uniqueTracks(Array.isArray(data.liked)?data.liked:[]);
    const artists=(Array.isArray(data.artists)?data.artists:[]).slice(0,8)
      .map(a=>({name:String(a?.name||'').slice(0,120)})).filter(a=>a.name);
    return {status:'ready',updated_at:data.updated_at,tracks,playlists,recent,liked,artists,
      track:publicTrack(data.track)||tracks[0]||null};
  }catch(e){console.warn('Public catalogue unavailable:',e?.message||e);return null}
}
function arrangeForDisplay(items){
  const queue=[...items],out=[];
  // Preserve a range of artists and albums between neighbouring cards where possible.
  while(queue.length){
    const past=out.slice(-2);
    let idx=queue.findIndex(t=>past.every(p=>{
      const sameAlbum=!!(p.album?.id&&t.album?.id&&p.album.id===t.album.id);
      const sameArtist=!!(artist(p)&&artist(t)&&artist(p)===artist(t));
      const sameImage=!!(img(p)&&img(t)&&img(p)===img(t));
      return !sameAlbum&&!sameArtist&&!sameImage;
    }));
    if(idx<0)idx=0;
    out.push(queue.splice(idx,1)[0]);
  }
  return out
}
function publicExport(){
  if(account?.id!==owner){status('Solo el propietario puede publicar esta selección. Comprueba que conectaste tu cuenta principal.',true);return}
  if(!accountTracks.length&&!accountSaved.length&&!window.TransmissionTaste?.getLikedForExport?.().length){status('No se recibieron canciones para publicar.',true);return}
  const includeRecent=!!document.getElementById('tm-share-recent')?.checked;
  const top=arrangeForDisplay(uniqueTracks(accountTracks.length?accountTracks:(window.TransmissionTaste?.getLikedForExport?.()||accountSaved))).slice(0,24);
  // Public snapshot must never accidentally include private playlists.
  const playlists=list.playlists.filter(p=>p?.public===true)
    .map(publicPlaylist).filter(Boolean).slice(0,14);
  const recent=includeRecent?uniqueTracks(list.recent).slice(0,8):[];
  const liked=$('tm-share-liked')?.checked?uniqueTracks(window.TransmissionTaste?.getLikedForExport?.()||accountSaved).slice(0,40):[];
  const data={
    status:'ready',
    owner_id:owner,
    source:'owner_authorized_export',
    updated_at:new Date().toISOString(),
    track:top[0],
    tracks:top,
    artists:accountArtists.map(a=>({name:String(a.name||'').slice(0,120)})).slice(0,8),
    playlists,recent,liked
  };
  const blob=new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;link.download='featured.json';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  banner('Selección descargada.');
}
function installOwnerExport(){
  if(account?.id!==owner)return;
  const panel=$('owner-public-export');
  if(!panel)return;
  const open=$('tm-open-publish');
  if(open){open.hidden=false;open.onclick=()=>{panel.hidden=false;$('tm-publish-close')?.focus()}}
  $('tm-publish-close').onclick=()=>{panel.hidden=true;open?.focus()};
  $('tm-export-public').onclick=publicExport;
}
async function playStation(){
  if(!account){status('Conecta tu Spotify Premium para escuchar la estación.',true);return}
  const tracks=arrangeForDisplay(uniqueTracks([
    ...list.tracks,...accountTracks,...accountSaved,...list.recent
  ])).slice(0,40);
  if(!tracks.length){status('Necesitamos primero una selección musical real para esta estación.',true);return}
  await playSequence(tracks);
}

function renderHero(index){
  const arr=list.tracks;
  if(!arr.length)return;
  hero=((index%arr.length)+arr.length)%arr.length;
  featured=arr[hero];
  const t=featured;
  $('hero-kicker').textContent='';
  $('hero-title').textContent=title(t);
  $('hero-description').textContent=artist(t);
  applyTrackArt($('hero-image'),t);
  $('slider-count').textContent=(hero+1)+' / '+arr.length;
  $('progress-fill').style.width=((hero+1)/arr.length*100)+'%';
  $('hero-play').disabled=false;
  $('pause-slide').disabled=false;
  $('pause-slide').textContent='▶';
  $('pause-slide').title='Reproducir esta canción';
}
function fillEmptyHome(items){
  if(list.tracks.length)return;
  const prepared=arrangeForDisplay(uniqueTracks(items)).slice(0,24);
  if(!prepared.length)return;
  list.tracks=prepared;
  renderHero(0);
  renderTiles(prepared);
  renderOtherDetails();
}
function setRotation(tracks){
  const chosen=uniqueTracks(tracks).slice(0,36);
  if(!chosen.length)return false;
  list.tracks=arrangeForDisplay(chosen).slice(0,24);
  manualUntil=Date.now()+120000;
  renderHero(0);renderTiles(list.tracks);renderOtherDetails();
  return true;
}
function renderCoverArt(node,t){
  if(!node)return;
  node.style.backgroundImage=img(t)?'url("'+img(t)+'")':'';
  node.textContent=img(t)?'':(title(t).slice(0,2).toUpperCase()||'T/M');
}
function updatePlayerSong(t){
  if(!t)return;
  selected=t;
  $('player-track').textContent=title(t);
  $('player-artist').textContent=artist(t);
  $('strip-song').textContent=title(t)||'LISTENING';
  $('strip-artist').textContent=artist(t)||'';
  renderCoverArt($('player-art'),t);
  window.dispatchEvent(new CustomEvent('tm:track',{detail:{track:t}}));
}
function renderTiles(tracks){
  const grid=$('picks-grid');grid.replaceChildren();
  if(!tracks.length){
    const kinds=[
      ['','ME GUSTA','','graphic-one'],
      ['','LISTAS','','graphic-two'],
      ['','ÚLTIMAS ESCUCHAS','','graphic-three'],
      ['','PARA AHORA','','art-focus']
    ];
    kinds.forEach((item,i)=>{
      const card=create('article','record-card');
      const button=create('button','record-image');button.type='button';
      const art=create('span','record-art tm-placeholder '+item[3]);
      const title=create('span','tm-placeholder-title',item[1]);
      art.append(title);button.append(art,create('span','card-play','↗'));
      button.onclick=()=>{
        if(!account){$('saved-trigger').click();return}
        if(i===0)$('liked').scrollIntoView({behavior:'smooth'});
        else if(i===1)window.TransmissionLibrary?.open?.();
        else if(i===2)$('recent-items').scrollIntoView({behavior:'smooth'});
        else $('tm-now-play')?.click();
      };
      const info=create('div','record-info');const caption=create('div');
      button.setAttribute('aria-label',item[1]);
      card.append(button);grid.append(card);
    });
    return;
  }
  tracks.slice(0,8).forEach((t,i)=>{
    const card=create('article','record-card');
    const button=create('button','record-image');button.type='button';button.title='Reproducir '+title(t);
    const art=create('span','record-art');applyTrackArt(art,t);
    const play=create('span','card-play','▶');
    const mark=create('span','record-index','');
    button.append(art,play,mark);button.onclick=()=>void playSequence(tracks,i);
    const info=create('div','record-info');
    const text=create('div');
    text.append(create('span','record-type',t.album?.release_date?.slice(0,4)||'CANCIÓN'),create('h3','',title(t)),create('p','',artist(t)));
    const add=create('a','save-button','↗');
    add.href=t.external_urls?.spotify||'https://open.spotify.com/track/'+t.id;
    add.target='_blank';add.rel='noopener noreferrer';
    add.title='Abrir esta canción en Spotify';
    info.append(text,add);card.append(button,info);grid.append(card);
  });
}
function renderRail(items){
  const rail=$('mixtapes'),anchor=$('rail-all');
  rail.querySelectorAll('.rail-item').forEach(x=>x.remove());
  if(!items.length){
    const prompts=[
      ['♫','LISTAS','','art-pool'],
      ['◌','ME GUSTA','','art-focus'],
      ['⌁','ÚLTIMAS ESCUCHAS','','art-low'],
      ['✳','COMPARTIR','','art-feel']
    ];
    rail.style.setProperty('--tm-rail-rows','2');
    prompts.forEach((p,i)=>{
      const button=create('button','rail-item');button.type='button';
      const cover=create('span','rail-item-cover '+p[3],p[0]);
      const label=create('span','rail-item-label');label.append(document.createTextNode(p[1]));
      button.append(cover,label,create('span','rail-item-arrow','↗'));
      button.onclick=()=>{
        if(i===3){$('support').scrollIntoView({behavior:'smooth'});return}
        if(!account){$('saved-trigger').click();return}
        if(i===0)window.TransmissionLibrary?.open?.();
        else if(i===1)$('liked').scrollIntoView({behavior:'smooth'});
        else $('recent-items').scrollIntoView({behavior:'smooth'});
      };
      rail.insertBefore(button,anchor);
    });return;
  }
  const visible=items.slice(0,7);
   rail.style.setProperty('--tm-rail-rows',String(Math.max(2,Math.ceil((visible.length+2)/3))));
   visible.forEach((pl,i)=>{
    const button=create('button','rail-item');button.type='button';
    const cover=create('span','rail-item-cover');cover.classList.add('tm-rail-image');
    const u=safeArt(pl?.images?.[0]?.url);if(u)cover.style.backgroundImage='url("'+u+'")';else cover.textContent='♫';
    const label=create('span','rail-item-label');
    label.append(document.createTextNode(pl.name||'PLAYLIST'),create('small','',(pl.items?.total??pl.tracks?.total??'—')+' CANCIONES'));
    button.append(cover,label,create('span','rail-item-arrow','▶'));
    button.onclick=()=>window.TransmissionLibrary?.openDetail?.(pl)??void playPlaylist(pl);
    rail.insertBefore(button,anchor);
  });
}
function renderRecent(tracks){
  const section=$('recent-items');section.replaceChildren();
  if(!tracks.length){
    const button=create('button','tm-empty-action',account?'EXPLORAR MI MÚSICA':'CONECTAR SPOTIFY');button.type='button';
    button.onclick=()=>account?$('latest').scrollIntoView({behavior:'smooth'}):$('saved-trigger').click();
    section.append(button);return;
  }
  uniqueTracks(tracks).slice(0,4).forEach((t,i)=>{
    const btn=create('button','tm-recent-item');btn.type='button';btn.title='Escuchar '+title(t);
    const cover=create('span','tm-recent-cover');applyTrackArt(cover,t);
    const meta=create('span','tm-recent-desc');meta.append(create('strong','',title(t)),create('small','',artist(t)));
    btn.append(cover,meta,create('span','tm-recent-arrow','▶'));
    btn.onclick=()=>void playTrack(t);section.append(btn);
  });
}
function setLiveLabel(value){
 const badge=$('live-label');
 const dot=badge?.querySelector('.pulse-dot');
 if(!badge)return;
 badge.replaceChildren(document.createTextNode(value+' '));
 if(dot)badge.append(dot);
 else{
   const span=create('span','pulse-dot');
   badge.append(span)
 }
}
function renderOtherDetails(){
  const connected=!!account;
  const published=!!publicSnapshot?.tracks?.length;
  $('pick-period').textContent=connected?'ÚLTIMAS SEMANAS':published?'MIS FAVORITAS':'MI SELECCIÓN';
  $('collection-count-1').textContent=list.tracks.length?list.tracks.length+' CANCIONES':'';
  $('collection-count-2').textContent=list.playlists.length?list.playlists.length+' LISTAS':'';
  const likedCount=window.TransmissionTaste?.getTotal?.()??publicSnapshot?.liked?.length??0;
  $('collection-count-3').textContent=likedCount?likedCount+' CANCIONES':'';
  $('owner-display').textContent='';
  const waiting=!account&&sp.isLogged?.()&&(connectionError?.status===429||!!sp.cooldown);
  const accountName=$('account-name');if(accountName)accountName.textContent=account?.display_name||(account?'CONECTADO':waiting?'SPOTIFY EN ESPERA':'CONECTAR');
  $('connect-button').textContent=account?'CONECTADO ✓':waiting?'REINTENTAR':'CONECTAR';
  $('saved-trigger').title=account?'Me gusta de '+(account.display_name||'tu cuenta'):waiting?connectionMessage():'Conectar Spotify';
  $('connect-button').title=waiting?connectionMessage():'';
  $('reconnect-button').textContent=sp.isLogged?.()?'DESCONECTAR SPOTIFY':'CONECTAR SPOTIFY';
  window.TransmissionUI?.refresh?.();
}
function playFeedback(msg,err=false){status(msg,err)}
async function sdk(){
  if(player)return player;
  if(!sdkPromise){
    sdkPromise=new Promise((resolve,reject)=>{
      if(window.Spotify){resolve();return}
      const end=setTimeout(()=>reject(new Error('No se pudo iniciar el SDK de Spotify.')),15000);
      window.onSpotifyWebPlaybackSDKReady=()=>{clearTimeout(end);resolve()};
      const script=document.createElement('script');script.src='https://sdk.scdn.co/spotify-player.js';
      script.onerror=()=>{clearTimeout(end);reject(new Error('Spotify Web Playback SDK no está disponible.'))};
      document.head.appendChild(script)
    });
  }
  await sdkPromise;
  const p=new Spotify.Player({name:'TRANSMISSION',getOAuthToken:async fn=>{
    try{fn(await sp.getToken())}catch(e){status(e.message,true)}
  },volume:.7});
  p.addListener('ready',({device_id})=>{device=device_id;status('Reproductor listo. Puedes escuchar dentro de esta página.');$('player-device').textContent='WEB PLAYER / LISTO'});
  p.addListener('not_ready',()=>{device=null;deviceSelected=false;status('El dispositivo web dejó de estar disponible.',true)});
  p.addListener('player_state_changed',state=>{
    if(!state)return;
    lastPlayerState=state;
    const t=state.track_window?.current_track;
    if(t){
      void maintainStation(t);
      updatePlayerSong({id:t.id,uri:t.uri,name:t.name,artists:t.artists||[],
        album:{name:t.album?.name||'',images:t.album?.images||[]},
        external_urls:{spotify:'https://open.spotify.com/track/'+t.id}});
    }
    const isPlaying=!state.paused;
    lastPlayback={trackId:t?.id||null,playing:isPlaying,position:state.position||0,duration:t?.duration_ms||0,
      shuffle:state.shuffle,repeat:state.repeat_mode,deviceId:device};
    window.dispatchEvent(new CustomEvent('tm:playback',{detail:lastPlayback}));
    $('audio-toggle').setAttribute('aria-label',isPlaying?'Pausar':'Reproducir');
  });
  p.addListener('autoplay_failed',()=>status('Spotify necesita un clic para iniciar audio. Pulsa ▶ sobre una canción.',true));
  ['authentication_error','account_error','playback_error','initialization_error'].forEach(ev=>p.addListener(ev,({message})=>status('Spotify: '+message,true)));
  const ok=await p.connect();
  if(!ok)throw new Error('Spotify no pudo conectar el reproductor. Comprueba Premium y la autorización.');
  player=p;return p;
}
async function activatePlayer(){
  const p=await sdk();
  if(!device){
    const max=Date.now()+9500;
    while(!device&&Date.now()<max)await new Promise(r=>setTimeout(r,100));
  }
  if(!device)throw new Error('Spotify no proporcionó un dispositivo de reproducción. Comprueba Premium y el permiso streaming.');
  if(!deviceSelected){
    await sp.api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[device],play:false})});
    deviceSelected=true;
    await new Promise(r=>setTimeout(r,500));
  }
}
/* Official Spotify Embed fallback; no token needed to display compatible media. */
function showOfficialEmbed(type,id){
  if(!['track','playlist','album'].includes(type)||!/^[A-Za-z0-9]{22}$/.test(id))return false;
  const host=$('tm-embed-frame'),wrap=$('tm-spotify-embed');
  if(!host||!wrap)return false;
  const frame=create('iframe');
  frame.src='https://open.spotify.com/embed/'+type+'/'+id+'?theme=0';
  frame.title='Reproductor oficial Spotify — '+type;
  frame.loading='lazy';
  frame.setAttribute('allow','autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
  frame.setAttribute('allowfullscreen','');
  frame.style.height=type==='track'?'152px':'352px';
  host.replaceChildren(frame);wrap.hidden=false;
  return true;
}
function closeOfficialEmbed(){
  const wrap=$('tm-spotify-embed'),host=$('tm-embed-frame');
  if(host)host.replaceChildren();
  if(wrap)wrap.hidden=true;
}

async function action(fn){
  if(!account){status('Conecta Spotify Premium para controlar el Web Player. Puedes usar la reproducción oficial incrustada.',true);return false}
  try{
    await fn();
    status('Spotify recibió la orden. Reproduciendo en el dispositivo seleccionado.');
    setTimeout(readPlaying,1100);
    return true;
  }catch(e){
    if(e.status===404)deviceSelected=false;
    status(e.message||String(e),true);
    return false;
  }
}
// Keep the full selection locally; send a conservative window of at most 40 URIs.
// Add Item to Queue takes one URI, so later tracks are appended as the window ends.
const sequenceWindow=40;
let playbackGeneration=0,playbackTail=Promise.resolve(),pendingQueueAppend=null;
function detachStation(){
 const pending=pendingQueueAppend||station?.pending;station=null;
 return pending?pending.catch(()=>{}):null;
}
function replacePlayback(request,priorQueue,fn){
 // Serialize replacement requests; discard starts superseded before their turn.
 const operation=playbackTail.catch(()=>{}).then(async()=>{
   if(priorQueue)await priorQueue;
   if(request!==playbackGeneration)return false;
   return action(fn);
 });
 playbackTail=operation.catch(()=>false);
 return operation;
}
async function playSequence(items,startIndex=0){
 const selection=uniqueTracks(items,Infinity).filter(t=>t?.uri);
 if(!Number.isInteger(startIndex)||startIndex<0||startIndex>=selection.length)return false;
 const chosen=selection[startIndex],tracks=selection.filter(t=>t.is_playable!==false);
 startIndex=tracks.findIndex(t=>t.id===chosen.id);
 if(startIndex<0){status('Spotify indica que esta canción no está disponible para reproducir.',true);return false}
 if(!tracks.length){status('La selección no contiene canciones disponibles.',true);return false}
 if(!account){status('Conecta una cuenta Premium para reproducir la sesión.',true);return false}
 player?.activateElement?.();
 const request=++playbackGeneration,priorQueue=detachStation();
 const nextStation={tracks,index:startIndex,end:Math.min(tracks.length,startIndex+sequenceWindow),loop:false,busy:false,pending:null};
 const ok=await replacePlayback(request,priorQueue,async()=>{
   await activatePlayer();
   const target='&device_id='+encodeURIComponent(device);
   await sp.api('/me/player/shuffle?state=false'+target,{method:'PUT'});
   await sp.api('/me/player/repeat?state=off'+target,{method:'PUT'});
   await sp.api('/me/player/play?device_id='+encodeURIComponent(device),{
     method:'PUT',body:JSON.stringify({uris:tracks.slice(startIndex,nextStation.end).map(t=>t.uri)})
   });
 });
 if(request!==playbackGeneration)return false;
 if(!ok){status('Spotify no inició la secuencia. Consulta Diagnóstico.',true);return false}
 station=nextStation;
 updatePlayerSong(tracks[startIndex]);
 closeOfficialEmbed();
 return true;
}
async function playTrack(t){
  if(!t?.uri)return;
  const request=++playbackGeneration,priorQueue=detachStation();
  updatePlayerSong(t);
  if(!account){
    showOfficialEmbed('track',t.id);
    status('Reproductor oficial disponible. Para el reproductor avanzado, conecta Spotify Premium.');
    return;
  }
  player?.activateElement?.();
  const ok=await replacePlayback(request,priorQueue,async()=>{
     await activatePlayer();
    await sp.api('/me/player/play?device_id='+encodeURIComponent(device),{
      method:'PUT',body:JSON.stringify({uris:[t.uri]})
    });
  });
  if(request!==playbackGeneration)return false;
  if(ok)closeOfficialEmbed();
  else{
    showOfficialEmbed('track',t.id);
    status('No se pudo iniciar el Web Player; abrí el reproductor oficial aquí mismo.',true);
  }
}
async function playPlaylist(p){
  if(!p?.uri)return;
  const request=++playbackGeneration,priorQueue=detachStation();
  if(!account){
    showOfficialEmbed('playlist',p.id);
    status('Playlist disponible en el reproductor oficial incrustado. Conecta Premium para usar controles avanzados.');
    return;
  }
  player?.activateElement?.();
  const ok=await replacePlayback(request,priorQueue,async()=>{
     await activatePlayer();
    await sp.api('/me/player/play?device_id='+encodeURIComponent(device),{
      method:'PUT',body:JSON.stringify({context_uri:p.uri})
    });
  });
  if(request!==playbackGeneration)return false;
  if(ok)closeOfficialEmbed();
  else{
    showOfficialEmbed('playlist',p.id);
    status('No se pudo iniciar el Web Player; abrí el reproductor oficial en nuestra página.',true);
  }
}
async function playPlaylistAt(playlist,index){
 if(!playlist?.id||!Number.isInteger(index)||index<0)return false;
 if(!account){showOfficialEmbed('playlist',playlist.id);return false}
 const request=++playbackGeneration,priorQueue=detachStation();
 player?.activateElement?.();
 const ok=await replacePlayback(request,priorQueue,async()=>{
     await activatePlayer();
   await sp.api('/me/player/play?device_id='+encodeURIComponent(device),{
     method:'PUT',body:JSON.stringify({
       context_uri:playlist.uri||'spotify:playlist:'+playlist.id,
       offset:{position:index}
     })
   });
 });
 if(request!==playbackGeneration)return false;
 if(ok)closeOfficialEmbed();
 else showOfficialEmbed('playlist',playlist.id);
 return ok;
}
async function toggle(){
  player?.activateElement?.();
  await action(async()=>{
    await activatePlayer();
    const state=await player.getCurrentState();
    if(state){await player.togglePlay();return}
    const t=selected||featured||list.tracks[0];
    if(t?.uri){await sp.api('/me/player/play?device_id='+encodeURIComponent(device),{
      method:'PUT',body:JSON.stringify({uris:[t.uri]})
    });return}
    await sp.api('/me/player/play?device_id='+encodeURIComponent(device),{method:'PUT'})
  })
}
async function maintainStation(item){
 const active=station;
 if(!active||!item?.id)return;
 const ids=new Set([item.id,item.linked_from?.id].filter(Boolean));
 const current=active.tracks.findIndex(t=>ids.has(t.id)||ids.has(t.linked_from?.id));
 if(current<0){station=null;return}
 active.index=current;
 if(active.busy||current<active.end-3||Date.now()<(active.retryAfter||0))return;
 // The current API window is ending. Queue the next item once, without restarting audio.
 let nextIndex=active.end;
 if(nextIndex>=active.tracks.length){
   if(!active.loop)return;
   nextIndex=0;
 }
 const next=active.tracks[nextIndex];
 if(!next?.uri)return;
 active.busy=true;
 let queued=false;
 try{
   pendingQueueAppend=active.pending=sp.api('/me/player/queue?uri='+encodeURIComponent(next.uri)+'&device_id='+encodeURIComponent(device),{method:'POST'});
   await active.pending;
   queued=true;
   if(station===active){
     if(nextIndex===0)active.end=1;
     else active.end=nextIndex+1;
   }
 }catch(e){active.retryAfter=Date.now()+(e.status===429?30000:10000);status('No se pudo continuar la cola: '+e.message,true)}
 finally{active.busy=false;if(pendingQueueAppend===active.pending)pendingQueueAppend=null;active.pending=null}
 if(queued&&station===active&&active.index!==current&&active.index>=active.end-3){
   void maintainStation(active.tracks[active.index]);
 }
}

async function readPlaying(){
  if(!account||document.hidden)return;
  try{
    const data=await sp.api('/me/player');
    if(data?.item){
      updatePlayerSong(data.item);
      const isPlaying=!!data.is_playing;
      lastPlayback={trackId:data.item.id,playing:isPlaying,position:data.progress_ms||0,
        duration:data.item.duration_ms||0,shuffle:data.shuffle_state,repeat:data.repeat_state,
        deviceId:data.device?.id,deviceName:data.device?.name,volume:data.device?.volume_percent};
      window.dispatchEvent(new CustomEvent('tm:playback',{detail:lastPlayback}));
      $('player-device').textContent='DEVICE / '+(data.device?.name||'SPOTIFY');
      setLiveLabel(data.is_playing?'SONANDO':'PAUSADO');
      if(data.is_playing){notePlay(data.item);renderHighlighted(data.item)}
      if(data.is_playing&&station)void maintainStation(data.item)
    }else setLiveLabel('ESCUCHAR');
  }catch(e){if(e.status===403||e.status===401)status(e.message,true)}
}
let lastRecentId=null;
function notePlay(t){
  if(!account||!t?.id||lastRecentId===t.id)return;
  lastRecentId=t.id;
  list.recent=[t,...list.recent.filter(x=>x?.id!==t.id)].slice(0,30);
  renderRecent(list.recent);
  window.dispatchEvent(new CustomEvent('tm:account-track',{detail:{track:t}}));
}
function renderHighlighted(t){
 if(!t?.id||Date.now()<manualUntil)return;
 if(lastOnAirId===t.id && featured?.id===t.id)return;
 lastOnAirId=t.id;
 const current={...t,uri:t.uri||'spotify:track:'+t.id};
 // The highlighted song is a real carousel item so the restored n/N counter is accurate.
 list.tracks=list.tracks.filter(item=>item.id!==t.id);
 list.tracks.unshift(current);
 if(list.tracks.length>24)list.tracks.length=24;
 renderHero(0);
 renderTiles(list.tracks);
 $('hero-kicker').textContent='ESCUCHANDO AHORA';
 renderOtherDetails();
}
function renderArtistOrbit(items){
  const wrap=$('taste-artists'),line=$('taste-artist-names');
  if(!wrap||!line)return;
  const artists=(items||[]).slice(0,6).map(x=>String(x?.name||'').trim()).filter(Boolean);
  if(!artists.length){wrap.hidden=true;line.replaceChildren();return}
  line.replaceChildren();
  artists.forEach(name=>{
    const button=create('button','',name);button.type='button';
    button.title='Explorar '+name;
    button.onclick=()=>window.TransmissionArtist?.open?.(name);
    line.append(button);
  });
  wrap.hidden=false;
}
async function loadArtistExtras(){
  if(!account){renderArtistOrbit(publicSnapshot?.artists||[]);return}
  const values=await Promise.allSettled([
    sp.api('/me/top/artists?limit=10&time_range=short_term')
  ]);
  if(values[0].status==='fulfilled'){
    accountArtists=(values[0].value.items||[]).filter(x=>x?.name).slice(0,10);
    renderArtistOrbit(accountArtists);
  }
  // La lectura de Me gusta se realiza en spotify-taste.js, con paginación.
}

async function loadHome(){
  const connected=!!account;
  let own=null;
  if(connected){
    try{own=await sp.api('/me/top/tracks?limit=30&time_range=short_term')}
    catch(e){status('Spotify Top Tracks: '+e.message,true)}
    accountTracks=(own?.items||[]).filter(t=>t?.id&&t?.uri);
  }
  const incoming=connected?accountTracks:(publicSnapshot?.tracks||[]);
  list.tracks=arrangeForDisplay(uniqueTracks(incoming)).slice(0,24);
  if(list.tracks.length){
    renderHero(0);renderTiles(list.tracks);
    if(connected&&!lastOnAirId){
      $('hero-kicker').textContent='';
    }else if(!connected){
      $('hero-kicker').textContent='';
    }
  }else{
    $('hero-kicker').textContent='';
    $('hero-title').textContent=account?'TU MÚSICA':'CONECTA SPOTIFY';
    $('hero-description').textContent='';
    $('slider-count').textContent='';
    $('hero-play').disabled=false;
    $('pause-slide').disabled=true;
    renderTiles([]);
  }
  renderOtherDetails();
}
async function loadPlaylists(){
  if(account){
    let result=null;
    try{result=await sp.api('/me/playlists?limit=50&offset=0')}catch(e){status('Playlists: '+e.message,true)}
    list.playlists=(result?.items||[]).filter(Boolean);
  }else list.playlists=publicSnapshot?.playlists||[];
  renderRail(list.playlists);
  renderOtherDetails();
  window.TransmissionLibrary?.sync?.();
}
async function loadRecent(){
  if(account){
    let recent=null;
    try{recent=await sp.api('/me/player/recently-played?limit=50')}catch(e){status('Historial: '+e.message,true)}
    recentEvents=(recent?.items||[]).filter(x=>x?.track?.id);
    list.recent=recentEvents.map(x=>x.track).filter(Boolean);
  }else list.recent=publicSnapshot?.recent||[];
  renderRecent(list.recent);
  if($('recent-label'))$('recent-label').textContent='ÚLTIMAS ESCUCHAS';
  renderOtherDetails();
}
async function loadShared(id){
  if(!/^[a-zA-Z0-9]{22}$/.test(id))throw Error('Enlace de playlist no válido.');
  // Spotify embeds can display public playlist content without authorizing our Web API app.
  const host=$('tm-public-embed');
  const iframe=document.createElement('iframe');
  iframe.src='https://open.spotify.com/embed/playlist/'+id+'?utm_source=generator&theme=0';
  iframe.title='Playlist compartida de Spotify';
  iframe.loading='lazy';
  iframe.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  iframe.setAttribute('allowfullscreen','');
  host.replaceChildren(iframe);
  host.hidden=false;
  $('shared-link').value='https://open.spotify.com/playlist/'+id;
  $('shared-name').textContent='PLAYLIST COMPARTIDA';
  $('shared-info').textContent='SELECCIÓN DE SPOTIFY / ACCESO PÚBLICO';
  $('shared-button').disabled=!account;
  list.shared={id,uri:'spotify:playlist:'+id};
  const u=new URL(location.href);u.searchParams.set('playlist',id);
  history.replaceState(null,'',u.pathname+u.search+u.hash);
  if(account){
    try{
      const data=await sp.api('/playlists/'+id);
      $('shared-name').textContent=data?.name||'PLAYLIST COMPARTIDA';
      $('shared-info').textContent='SPOTIFY / '+(data?.owner?.display_name||'PLAYLIST');
      if(data?.uri)list.shared.uri=data.uri;
    }catch(e){status('El reproductor oficial está disponible; la API no pudo leer los detalles de esta lista.',true)}
  }
  status('Playlist compartida cargada dentro de TRANSMISSION.');
}
async function copyLink(url){
  try{await navigator.clipboard.writeText(url);banner('Enlace copiado.')}
  catch{banner('Copia el enlace desde Spotify.')}
}
function parsePlaylist(s){
  const v=String(s||'').trim();
  if(/^[a-zA-Z0-9]{22}$/.test(v))return v;
  if(/^spotify:playlist:[a-zA-Z0-9]{22}$/.test(v))return v.split(':')[2];
  try{const url=new URL(v);if(url.hostname!=='open.spotify.com'||url.protocol!=='https:')return null;
    const x=url.pathname.split('/').filter(Boolean);if(x[0]?.startsWith('intl-'))x.shift();
    if(x.length===2&&x[0]==='playlist'&&/^[a-zA-Z0-9]{22}$/.test(x[1]))return x[1];
  }catch{}
  return null;
}
function bind(){
  $('prev-slide').onclick=()=>{manualUntil=Date.now()+90000;renderHero(hero-1)};
  $('next-slide').onclick=()=>{manualUntil=Date.now()+90000;renderHero(hero+1)};
  $('pause-slide').onclick=()=>featured?void playSequence(list.tracks,hero):void toggle();
  $('hero-play').onclick=()=>featured?void playSequence(list.tracks,hero):$('saved-trigger').click();
  $('audio-toggle').onclick=()=>void toggle();
  $('audio-next').onclick=()=>void action(()=>sp.api('/me/player/next',{method:'POST'}));
  $('audio-previous').onclick=()=>void action(()=>sp.api('/me/player/previous',{method:'POST'}));
  const login=()=>void sp.login().catch(e=>{status(e.message,true);banner(e.message,10000)});
  const logout=()=>{sp.logout();location.reload()};
  const openMyPlayer=()=>{
    if(!account){
      if(sp.isLogged?.()){
        const block=sp.cooldown||connectionError;
        if(block?.retryAt>Date.now()){banner(connectionMessage(),10000);return}
        location.reload();return;
      }
      login();return;
    }
    $('tm-liked-all')?.click();
  };
  $('tm-embed-close').onclick=closeOfficialEmbed;
  $('connect-button').onclick=openMyPlayer;
  $('saved-trigger').onclick=openMyPlayer;
  $('rail-all').onclick=()=>window.TransmissionLibrary?.open?.();
  $('collection-top').onclick=()=>document.getElementById('latest').scrollIntoView({behavior:'smooth'});
  $('collection-playlists').onclick=()=>document.getElementById('mixtapes').scrollIntoView({behavior:'smooth'});
  $('collection-liked').onclick=()=>document.getElementById('liked').scrollIntoView({behavior:'smooth'});
  $('top-refresh').onclick=()=>void loadHome();
  $('random-discovery').onclick=()=>window.TransmissionTaste?.refreshRotation?void window.TransmissionTaste.refreshRotation():list.tracks.length?renderHero((hero+1)%list.tracks.length):banner('La colección pública aún no está preparada.');
  $('tm-station-play').onclick=()=>void playStation();
  $('shared-form').onsubmit=e=>{e.preventDefault();const id=parsePlaylist($('shared-link').value);if(!id){status('Introduce el enlace real de una playlist de Spotify.',true);return}void loadShared(id).catch(err=>status(err.message,true))}
  $('shared-button').onclick=()=>{if(list.shared)void playPlaylist(list.shared)};
  $('shared-share').onclick=()=>void copyLink(location.href);
  $('reconnect-button').onclick=()=>sp.isLogged?.()?logout():login();
  const toggle=$('menu-toggle'),nav=$('main-nav');
  toggle.onclick=()=>{const open=nav.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open))};
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('is-open')));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&account)void readPlaying()});
}
window.TransmissionRuntime={
  sdk,activatePlayer,toggle,readPlaying,playTrack,playPlaylist,playPlaylistAt,playSequence,
  action,status,
  get ready(){return ready},
  get diagnostics(){return [...diagLog]},
  get account(){return account},
  get player(){return player},
  get device(){return device},
  get currentTrack(){return selected||featured},
  get queue(){return station?.tracks?station.tracks.slice(station.index):[]},
   get sequencePending(){return !!station&&station.end<station.tracks.length},
  get featured(){return featured},
  get state(){return lastPlayback},
  get upcomingTrack(){
    return station?station.tracks[station.index+1]||null:lastPlayerState?.track_window?.next_tracks?.[0]||null;
  },
  get owner(){return owner},
  get publicSnapshot(){return publicSnapshot},
  fillEmptyHome,
  setRotation,
  get accountArtists(){return [...accountArtists]},
  get accountTracks(){return [...accountTracks]},
  get playlists(){return [...list.playlists]},
  get recent(){return [...list.recent]},
  refreshPublic:loadHome
};
try{
  bind();
  publicSnapshot=await getPublicSnapshot();
  await sp.processRedirect();
  if(sp.isLogged()){
    try{
      account=await sp.api('/me');
      status('Conectado como '+(account.display_name||account.id)+'. Cargando canciones y playlists...');
      renderOtherDetails();
      const results=await Promise.allSettled([loadHome(),loadPlaylists(),loadRecent(),sdk(),loadArtistExtras()]);
      ready=true;
      installOwnerExport();
      const playerFailed=results[3].status==='rejected';
      await readPlaying();
      const requested=new URLSearchParams(location.search).get('playlist');
      if(requested&&/^[a-zA-Z0-9]{22}$/.test(requested))await loadShared(requested);
      clearInterval(poll);poll=setInterval(readPlaying,30000);
      if(playerFailed){
        status('Spotify conectó la cuenta, pero falló el reproductor web: '+String(results[3].reason?.message||results[3].reason),true);
      }else{
        status('Spotify conectado. Haz clic en una carátula para reproducir aquí.');
      }
    }catch(e){
      connectionError=e;
      if(e.status===429&&!e.retryAt)e.retryAt=Date.now()+60000;
      status(e.message,true);
      if(!account){
        // A saved session can be valid while Spotify temporarily rejects /me.
        // Render the public page without clearing authorization or retrying login.
        await loadHome();
        await loadPlaylists();
        await loadRecent();
        renderArtistOrbit(publicSnapshot?.artists||[]);
        renderOtherDetails();
        ready=true;
        if(e.status===429)banner(connectionMessage(),10000);
        const requested=new URLSearchParams(location.search).get('playlist');
        if(requested&&/^[a-zA-Z0-9]{22}$/.test(requested))await loadShared(requested);
      }
    }
  }else{
    await loadHome();
    await loadPlaylists();
    await loadRecent();
    renderArtistOrbit(publicSnapshot?.artists||[]);
    ready=true;
    const requested=new URLSearchParams(location.search).get('playlist');
    if(requested&&/^[a-zA-Z0-9]{22}$/.test(requested)){
      await loadShared(requested);
    }else{
      status(publicSnapshot?.tracks?.length?'Esta es mi selección musical. Conecta Premium solo para reproducir aquí.':'La selección pública aún no está sincronizada. Puedes conectar Spotify para escuchar.');
    }
  }
}catch(e){status('Error de conexión: '+e.message,true)}
})();
