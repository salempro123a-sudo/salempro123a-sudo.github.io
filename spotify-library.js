/* TRANSMISSION — playlist archive with detail, track selection and official fallback. */
(function(){
'use strict';
const sp=window.TransmissionSpotify,rt=window.TransmissionRuntime;
if(!sp||!rt)return;
const $=id=>document.getElementById(id);
const shell=$('tm-library-screen'),grid=$('tm-library-grid'),more=$('tm-library-more'),search=$('tm-library-search');
const feedback=$('tm-library-feedback'),detail=$('tm-playlist-detail');
const validId=x=>typeof x==='string'&&/^[a-zA-Z0-9]{22}$/.test(x);
const safeImg=url=>typeof url==='string'&&/^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-ak\.spotifycdn\.com)\//.test(url)?url:'';
const create=(tag,cl,txt)=>{const el=document.createElement(tag);if(cl)el.className=cl;if(txt!==undefined)el.textContent=txt;return el};
let items=[],offset=0,total=0,next=false,loading=false,mode='all',lastFocus=null,active=null,trackRows=[],trackOffset=0,trackNext=false,trackLoading=false,requestSerial=0;
function add(batch){
 const known=new Set(items.map(p=>p.id));
 for(const p of batch||[])if(validId(p?.id)&&!known.has(p.id)){items.push(p);known.add(p.id)}
}
function isRadio(p){return /radio|mix|descubr|discover|radar|repeat|daylist|station/i.test(p.name||'')}
function render(){
 grid.replaceChildren();
 const query=search.value.trim().toLocaleLowerCase();
 const found=items.filter(p=>(mode!=='radios'||isRadio(p))&&(!query||(p.name||'').toLocaleLowerCase().includes(query)));
 for(const p of found){
   const card=create('button','tm-library-card');card.type='button';
   const art=create('span','tm-library-art');const image=safeImg(p.images?.[0]?.url);
   if(image)art.style.backgroundImage='url("'+image+'")';else art.textContent='♫';
   card.append(art,create('strong','',p.name||'Playlist'),create('small','',Number.isFinite(p.items?.total)?p.items.total+' CANCIONES':'LISTA'));
   card.onclick=()=>void openDetail(p);
   grid.append(card);
 }
 if(!found.length){
   grid.append(create('p','tm-liked-empty',items.length?'No hay coincidencias.':rt.account?'No hay listas disponibles.':'Conecta Spotify para abrir tus listas.'));
   if(!rt.account&&!items.length){const connect=create('button','tm-catalog-button','CONECTAR SPOTIFY');connect.type='button';connect.onclick=()=>$('saved-trigger').click();grid.append(connect)}
 }
 $('tm-library-count').textContent=items.length+(total>items.length?' / '+total:'')+' LISTAS';
 more.hidden=!next||!rt.account;
 more.disabled=loading;
}
function browsing(activeBrowse){
 shell.classList.toggle('has-detail',!activeBrowse);
 detail.hidden=activeBrowse;
 grid.hidden=!activeBrowse;
 $('tm-library-bar').hidden=!activeBrowse;
 $('tm-library-bottom').hidden=!activeBrowse;
}
function open(event){
 if(!event?.routed&&window.TransmissionPages)return window.TransmissionPages.library();
 lastFocus=event?.currentTarget||document.activeElement;
 if(!items.length){add(rt.playlists||rt.publicSnapshot?.playlists||[]);offset=items.length;total=items.length;next=!!rt.account&&items.length>=50}
 shell.hidden=false;shell.setAttribute('aria-hidden','false');
 window.TransmissionUI?.syncViews?.();
 browsing(true);render();search.focus();
}
function close(options={}){
 if(!options.routed&&window.TransmissionPages?.isLibrary)return window.TransmissionPages.home();
 if(shell.hidden)return;
 requestSerial++;
 shell.hidden=true;shell.setAttribute('aria-hidden','true');
 window.TransmissionUI?.syncViews?.();
 lastFocus?.focus?.();
}
async function loadMore(){
 if(loading||!next||!rt.account)return;
 loading=true;more.disabled=true;feedback.textContent='Cargando listas…';
 try{
   const data=await sp.api('/me/playlists?limit=50&offset='+offset);
   const page=data.items||[];
   add(page);offset+=page.length;
   total=Math.max(items.length,Number(data.total)||0);
   next=!!data.next&&page.length>0&&offset<total;
   feedback.textContent='';
 }catch(e){feedback.textContent='No se pudieron cargar más listas. Consulta Diagnóstico.';rt.status('Listas: '+e.message,true)}
 finally{loading=false;render()}
}
function clearEmbed(){$('tm-playlist-frame').replaceChildren();$('tm-playlist-frame').hidden=true}
function embedPlaylist(p){
 clearEmbed();
 const frame=create('iframe');frame.src='https://open.spotify.com/embed/playlist/'+p.id+'?theme=0';
 frame.title='Playlist de Spotify';frame.loading='lazy';
 frame.setAttribute('allow','autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
 frame.setAttribute('allowfullscreen','');
 $('tm-playlist-frame').append(frame);$('tm-playlist-frame').hidden=false;
 $('tm-playlist-tracks').replaceChildren();
 $('tm-playlist-next').hidden=true;
}
function rowTrack(entry){return entry?.item||entry?.track||null}
function addTrackPage(data){
 const entries=data?.items||[];
 for(let i=0;i<entries.length;i++){
   const t=rowTrack(entries[i]);
   if(t&&validId(t.id)&&t.type==='track'&&!t.is_local){
     trackRows.push({track:t,position:trackOffset+i});
   }
 }
 trackOffset+=entries.length;
 trackNext=!!data?.next && entries.length>0 && trackOffset<(Number(data.total)||Infinity);
 renderTracks();
}
function renderTracks(){
 const panel=$('tm-playlist-tracks');panel.replaceChildren();
 for(const row of trackRows){
   const t=row.track;
   if(window.TransmissionTrackActions){
     panel.append(window.TransmissionTrackActions.row(t,{number:row.position+1,onPlay:()=>rt.playPlaylistAt(active,row.position)}));continue;
   }
   const btn=create('button','tm-playlist-track');btn.type='button';
   btn.setAttribute('aria-label','Reproducir '+t.name);
   const num=create('span','tm-playlist-track-index',String(row.position+1).padStart(2,'0'));
   const cover=create('span','tm-playlist-track-art');const img=safeImg(t.album?.images?.[0]?.url);
   if(img)cover.style.backgroundImage='url("'+img+'")';else cover.textContent='♫';
   const title=create('span','tm-playlist-track-title');title.append(create('strong','',t.name||'Sin título'),create('small','',(t.artists||[]).map(a=>a.name).join(', ')));
   btn.append(num,cover,title,create('span','tm-playlist-track-play','▶'));
   btn.onclick=async()=>{const played=await rt.playPlaylistAt(active,row.position);if(played)close()};
   panel.append(btn);
 }
 if(!trackRows.length)panel.append(create('p','tm-playlist-message','No se encontraron canciones reproducibles en esta lista.'));
 $('tm-playlist-next').hidden=!trackNext;
}
async function loadTracks(){
 if(!active||trackLoading||!rt.account)return;
 const serial=requestSerial,playlistId=active.id,offset=trackOffset;trackLoading=true;
 $('tm-playlist-next').disabled=true;
 try{
   const data=await sp.api('/playlists/'+playlistId+'/items?limit=50&offset='+offset);
   if(serial!==requestSerial)return;
   addTrackPage(data);
 }catch(e){
   if(serial!==requestSerial)return;
   if(e.status===403||e.status===404){
     embedPlaylist(active);
   }else{
     rt.status('Playlist: '+e.message,true);
     embedPlaylist(active);
   }
 }finally{if(serial===requestSerial){trackLoading=false;$('tm-playlist-next').disabled=false}}
}
async function openDetail(p,options={}){
 if(!validId(p?.id))return;
 if(!options.routed&&window.TransmissionPages)return window.TransmissionPages.playlist(p);
 if(shell.hidden)open({routed:true});
 requestSerial++;
 active=p;trackRows=[];trackOffset=0;trackNext=false;trackLoading=false;
 browsing(false);clearEmbed();
 $('tm-playlist-tracks').replaceChildren(create('p','tm-playlist-message','Preparando canciones…'));
 $('tm-playlist-next').hidden=true;
 $('tm-playlist-name').textContent=p.name||'Playlist';
 $('tm-playlist-owner').textContent=p.owner?.display_name||'';
 const image=safeImg(p.images?.[0]?.url);
 $('tm-playlist-cover').style.backgroundImage=image?'url("'+image+'")':'none';
 $('tm-playlist-external').href='https://open.spotify.com/playlist/'+p.id;
 $('tm-playlist-all').onclick=()=>{void rt.playPlaylist({...p,uri:p.uri||'spotify:playlist:'+p.id})};
 // 2026 development-mode playlist items: available only for owner/collaborator.
 if(rt.account){
   await loadTracks();
 }else embedPlaylist(p);
}
$('tm-library-close').onclick=()=>close();
$('tm-playlist-back').onclick=()=>{if(window.TransmissionPages)return window.TransmissionPages.library();requestSerial++;active=null;trackLoading=false;browsing(true);search.focus()};
$('tm-playlist-next').onclick=()=>void loadTracks();
more.onclick=()=>void loadMore();
search.oninput=render;
shell.addEventListener('click',e=>{if(e.target===shell&&!window.TransmissionPages?.isLibrary)close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!shell.hidden&&!window.TransmissionPages?.isLibrary)close()});
document.querySelectorAll('.tm-library-filters button').forEach(b=>b.onclick=()=>{
 mode=b.dataset.filter||'all';
 document.querySelectorAll('.tm-library-filters button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
 render()
});
$('rail-all').onclick=open;
$('collection-playlists').onclick=open;
document.querySelectorAll('a[href="#mixtapes"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();open(e)}));
window.TransmissionLibrary={
 open,close,openDetail,sync(){add(rt.playlists||[]);offset=items.length;next=!!rt.account&&items.length>=50;render()},
 getAll:()=>[...items]
};
})();
