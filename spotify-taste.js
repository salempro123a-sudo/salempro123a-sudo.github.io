/* TRANSMISSION · Personal listening, 2026.
   "Para ahora" is our own recent-affinity ordering of Spotify-authorized data,
   NOT Spotify's restricted recommendation algorithm. */
(async function(){
'use strict';
const sp=window.TransmissionSpotify;
const el=id=>document.getElementById(id);
if(!sp||!el('tm-liked-grid'))return;
const art=u=>typeof u==='string'&&/^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-ak\.spotifycdn\.com|seeded-session-images\.scdn\.co)\//.test(u)?u:'';
const image=t=>art(t?.album?.images?.[0]?.url||t?.image);
const artists=t=>(t?.artists||[]).map(a=>a.name).filter(Boolean).join(', ')||t?.artist||'';
const create=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e};
const valid=t=>t&&/^[A-Za-z0-9]{22}$/.test(t.id)&&t.name;
const asTrack=t=>valid(t)?{...t,uri:t.uri||'spotify:track:'+t.id,artists:t.artists||[{name:t.artist||'Artista'}]}:null;
const unique=items=>{
 const ids=new Set(),out=[];
 for(const item of items||[]){
   const t=asTrack(item);
   if(!t||ids.has(t.id))continue;
   ids.add(t.id);out.push(t)
 }
 return out;
};
let liked=[],likesTotal=0,canFetchMore=false,page=0,loading=false,likedOffset=0,likedOrder='new',modalOpen=false,modalFocus=null,likedRequest=null;
const pageSize=()=>window.matchMedia?.('(max-width:540px)').matches?2:window.matchMedia?.('(max-width:767px)').matches?3:6;
let recentEvents=[],accountTop=[],rt=null,accountConnected=false,accountReady=false;
const likedGrid=el('tm-liked-grid'),more=el('tm-liked-more'),play=el('tm-liked-play'),label=el('liked-kicker');
function status(message,error=false){rt?.status(message,error)}
function sortedLiked(){
 const items=unique(liked);
 if(likedOrder==='old')return items.reverse();
 if(likedOrder==='az')return items.sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'base'}));
 if(likedOrder==='artist')return items.sort((a,b)=>artists(a).localeCompare(artists(b),'es',{sensitivity:'base'})||a.name.localeCompare(b.name,'es'));
 return items;
}
function render(){
 likedGrid.replaceChildren();
 const active=sortedLiked(),size=pageSize(),count=likesTotal||active.length;
 const maxPage=Math.max(0,Math.ceil(active.length/size)-1);
 page=Math.min(page,maxPage);
 const start=page*size,end=Math.min(start+size,active.length);
 if(!active.length){
   const button=create('button','tm-empty-action',accountConnected?'EXPLORAR MI MÚSICA':'CONECTAR SPOTIFY');button.type='button';
   button.onclick=()=>accountConnected?el('latest').scrollIntoView({behavior:'smooth'}):el('saved-trigger').click();
   likedGrid.append(button);
 }else{
   for(const t of active.slice(start,end)){
     const card=create('article','tm-liked-card');
     const cover=create('button','tm-liked-art');cover.type='button';
     cover.setAttribute('aria-label','Reproducir '+t.name);cover.title=t.name;
     if(image(t))cover.style.backgroundImage='url("'+image(t)+'")';
     cover.onclick=()=>void playLikedFrom(t);
     const meta=create('div','tm-liked-caption');
     meta.append(create('strong','',t.name),create('small','',artists(t)));
     if(window.TransmissionTrackActions)meta.append(window.TransmissionTrackActions.optionsButton(t,'tm-card-options'));
     card.append(cover,meta);likedGrid.append(card);
   }
 }
 play.disabled=!active.length;
 el('tm-liked-position').textContent=active.length?String(start+1).padStart(2,'0')+'–'+String(end).padStart(2,'0')+' / '+count:'';
 const pager=el('tm-liked-pager');
 if(pager)pager.hidden=count<=size;
 el('tm-liked-prev').disabled=page===0||loading;
 more.disabled=loading||((page+1)*size>=active.length&&!(accountConnected&&canFetchMore));
 more.hidden=false;
 el('tm-liked-all').disabled=!active.length;
 el('collection-count-3').textContent=active.length?count+' '+(count===1?'CANCIÓN':'CANCIONES'):'';
 label.hidden=true;
 if(modalOpen)renderLikedAll();
 window.TransmissionUI?.refresh?.();
}
function renderLikedAll(){
 const host=el('tm-liked-all-grid');if(!host)return;
 host.replaceChildren();
 const value=el('tm-liked-search').value.trim().toLocaleLowerCase();
 const all=sortedLiked();
 const tracks=value?all.filter(t=>(t.name+' '+artists(t)+' '+(t.album?.name||'')).toLocaleLowerCase().includes(value)):all;
 for(const t of tracks){
   const card=create('article','tm-liked-all-card');
   const listen=create('button','tm-liked-all-listen');listen.type='button';listen.setAttribute('aria-label','Reproducir '+t.name);
   const art=create('span','tm-liked-all-art'),pic=image(t);if(pic)art.style.backgroundImage='url("'+pic+'")';
   const caption=create('span','tm-liked-all-name');caption.append(create('strong','',t.name),create('small','',artists(t)));
   listen.append(art,caption);card.append(listen);
   if(window.TransmissionTrackActions)card.append(window.TransmissionTrackActions.optionsButton(t,'tm-card-options'));
   listen.onclick=()=>void playLikedFrom(t);
   host.append(card);
 }
 if(!tracks.length){
   host.append(create('p','tm-liked-empty',value?'Sin coincidencias.':accountConnected?'Todavía no hay canciones guardadas.':'Conecta Spotify para abrir tus canciones guardadas.'));
   if(!accountConnected){const connect=create('button','tm-catalog-button','CONECTAR SPOTIFY');connect.type='button';connect.onclick=()=>el('saved-trigger').click();host.append(connect)}
 }
 el('tm-liked-total').textContent=tracks.length+' / '+(likesTotal||liked.length);
 el('tm-liked-load').hidden=!(accountConnected&&canFetchMore);
}
function fetchLikedBatch(){
 if(likedRequest)return likedRequest;
 if(!accountConnected||!canFetchMore)return Promise.resolve(false);
 loading=true;more.disabled=true;
 likedRequest=(async()=>{
  try{
   const data=await sp.api('/me/tracks?limit=50&offset='+likedOffset);
   const rows=data?.items||[];
   likedOffset+=rows.length;
   const seen=new Set(liked.map(t=>t.id));
   for(const row of rows){
    const t=row?.track;
    if(valid(t)&&!seen.has(t.id)){liked.push(t);seen.add(t.id)}
   }
   likesTotal=Math.max(liked.length,Number(data?.total)||liked.length);
   canFetchMore=!!data?.next&&rows.length>0&&likedOffset<likesTotal;
   return rows.length>0
  }catch(e){status('No se pudieron cargar más favoritas: '+e.message,true);return false}
  finally{loading=false;likedRequest=null;render()}
 })();
 return likedRequest;
}
async function loadLikedSelection(){
 // Twenty small pages cover up to 1,050 saved songs without an unbounded request loop.
 for(let i=0;accountConnected&&canFetchMore&&i<20;i++){
  if(!await fetchLikedBatch())break;
 }
 return sortedLiked();
}
async function playLikedFrom(track){
 if(!rt?.account)return rt?.playTrack(track);
 rt.player?.activateElement?.();
 const tracks=await loadLikedSelection();
 const index=tracks.findIndex(t=>t.id===track.id);
 return index>=0?rt.playSequence(tracks,index):false;
}
async function openLikedAll(options={}){
 if(!options.routed&&window.TransmissionPages)return window.TransmissionPages.liked();
 const dialog=el('tm-liked-modal');
 if(!dialog)return;
 modalFocus=document.activeElement;
 modalOpen=true;dialog.hidden=false;dialog.setAttribute('aria-hidden','false');
 window.TransmissionUI?.syncViews?.();
 el('tm-liked-sort').value=likedOrder;
 renderLikedAll();
 el('tm-liked-search').focus();
 // Only two additional pages are needed for typical small libraries;
 // continue in capped batches without blocking the whole interface.
 let steps=0;
 while(modalOpen&&canFetchMore&&steps<8){
   if(!await fetchLikedBatch())break;
   steps++;
 }
 renderLikedAll()
}
function closeLikedAll(options={}){
 if(!options.routed&&window.TransmissionPages?.isLiked)return window.TransmissionPages.home();
 if(el('tm-liked-modal').hidden)return;
 modalOpen=false;
 const dialog=el('tm-liked-modal');dialog.hidden=true;dialog.setAttribute('aria-hidden','true');
 window.TransmissionUI?.syncViews?.();
 modalFocus?.focus?.();
}
function fillPlaylistRail(){
 if(!rt)return;
 const source=unique(liked.length?liked:(rt.account?rt.accountTracks:rt.publicSnapshot?.tracks||[]));
 if(!source.length)return;
 const rail=el('mixtapes'),anchor=el('rail-all');
 if(!rail||!anchor)return;
 const playlists=(rt.playlists||[]).length;
 // When no playlists were available, remove only decorative placeholders.
 if(!playlists)rail.querySelectorAll('.rail-item').forEach(node=>node.remove());
 const previous=rail.querySelectorAll('.tm-rail-favorite').length;
 if(previous)rail.querySelectorAll('.tm-rail-favorite').forEach(node=>node.remove());
 const remaining=Math.max(0,7-Math.min(playlists,7));
 if(!playlists){
   const heading=rail.querySelector('.rail-heading');
   if(heading)heading.textContent='ESCUCHAR';
 }
 for(const track of source.slice(0,remaining)){
   const button=create('button','rail-item tm-rail-favorite');
   button.type='button';button.title='Escuchar '+track.name;
   const cover=create('span','rail-item-cover tm-rail-image');
   if(image(track))cover.style.backgroundImage='url("'+image(track)+'")';
   const label=create('span','rail-item-label');
   label.append(document.createTextNode(track.name),create('small','',artists(track)));
   button.append(cover,label,create('span','rail-item-arrow','▶'));
   button.onclick=()=>void rt.playTrack(track);
   rail.insertBefore(button,anchor);
 }
 window.TransmissionUI?.refresh?.();
}

async function loadFirst(){
 if(accountConnected){
   try{
     const data=await sp.api('/me/tracks?limit=50&offset=0');
     liked=(data.items||[]).map(x=>x.track).filter(valid);
     likedOffset=(data.items||[]).length;
     likesTotal=Number(data.total)||liked.length;
     canFetchMore=!!data.next&&likedOffset<likesTotal;
   }catch(e){status('No pude leer tus Me gusta: '+e.message,true)}
 }else{
   liked=(rt?.publicSnapshot?.liked||[]).filter(valid);
   likesTotal=liked.length;
 }
 render();
 rt?.fillEmptyHome?.(liked);
 fillPlaylistRail();
}
async function loadNext(){
 if(loading)return;
 const desired=(page+2)*pageSize();
 if(desired>liked.length&&accountConnected&&canFetchMore)await fetchLikedBatch();
 if((page+1)*pageSize()<liked.length)page++;
 render()
}
function previousLiked(){if(page>0){page--;render()}}
function recentWeight(entries){
 const score=new Map();
 function add(raw,value){
   const t=asTrack(raw);if(!t||!Number.isFinite(value))return;
   const item=score.get(t.id)||{track:t,score:0};
   item.score+=value;score.set(t.id,item);
 }
 if(accountConnected){
   recentEvents.slice(0,50).forEach((x,i)=>add(x.track,Math.max(6,115-i*2.3)));
   accountTop.slice(0,30).forEach((t,i)=>add(t,Math.max(9,80-i*2.3)));
   liked.slice(0,100).forEach((t,i)=>add(t,Math.max(5,24-i*.25)));
 }else{
   (rt?.publicSnapshot?.recent||[]).slice(0,20).forEach((t,i)=>add(t,Math.max(8,105-i*4.5)));
   (rt?.publicSnapshot?.tracks||[]).slice(0,30).forEach((t,i)=>add(t,Math.max(8,72-i*2)));
   liked.slice(0,40).forEach((t,i)=>add(t,Math.max(5,22-i*.3)));
 }
 let ranked=[...score.values()].sort((a,b)=>b.score-a.score).map(x=>x.track);
 // Avoid neighbouring repeats of an artist or album without randomising on every reload.
 const result=[];
 while(ranked.length&&result.length<40){
   const last=result.slice(-2);
   let idx=ranked.findIndex(t=>last.every(prev=>{
     const sameArtist=artists(prev)&&artists(prev)===artists(t);
     const sameAlbum=prev.album?.id&&prev.album.id===t.album?.id;
     return !sameArtist&&!sameAlbum;
   }));
   if(idx<0)idx=0;
   result.push(ranked.splice(idx,1)[0]);
 }
 return result;
}
async function startSongs(tracks){
 const playlist=unique(tracks);
 if(!playlist.length){status('No hay suficientes canciones disponibles.',true);return false}
 if(!rt?.account){status('Conecta Spotify para reproducir esta sesión.',true);return false}
 return !!await rt.playSequence(playlist);
}
let discoveryCache=[],discoveryTime=0,discoveryTurn=0;
const accountStorageKey=name=>name+':'+(window.TransmissionRuntime?.account?.id||'anonymous');
function previousDiscoveries(){
 try{return new Set(JSON.parse(localStorage.getItem(accountStorageKey('tm_discovery_seen'))||'[]'))}
 catch{return new Set()}
}
function rememberDiscoveries(tracks){
 try{
   const seen=[...previousDiscoveries(),...tracks.map(t=>t.id)];
   localStorage.setItem(accountStorageKey('tm_discovery_seen'),JSON.stringify(seen.slice(-160)));
 }catch{}
}
async function lightDiscovery(known,force=false){
 if(!rt?.account)return [];
 if(!force&&discoveryCache.length&&Date.now()-discoveryTime<300000)return [...discoveryCache];
 const previous=previousDiscoveries();
 const owned=unique([...known,...liked,...(rt.accountTracks||[]),...(rt.recent||[])]);
 const knownIds=new Set(owned.map(t=>t.id));
 // Use actual artists appearing in recent listening, top tracks and saved songs.
 const artists=[];
 const seenArtist=new Set();
 for(const t of [...recentEvents.map(x=>x.track),...accountTop,...liked]){
   for(const a of t?.artists||[]){
     if(!a.name||seenArtist.has(a.name.toLocaleLowerCase()))continue;
     seenArtist.add(a.name.toLocaleLowerCase());artists.push(a);
   }
 }
 if(!artists.length){
   for(const a of rt.accountArtists||[])if(a?.name)artists.push(a)
 }
 if(!artists.length)return [];
 try{discoveryTurn=Math.max(0,Number(localStorage.getItem(accountStorageKey('tm_discovery_turn')))||0)}catch{}
 discoveryTurn++;
 try{localStorage.setItem(accountStorageKey('tm_discovery_turn'),String(discoveryTurn))}catch{}
 const fresh=[],later=[];
 const consider=track=>{
   if(!valid(track)||knownIds.has(track.id))return;
   const list=previous.has(track.id)?later:fresh;
   if(!fresh.some(x=>x.id===track.id)&&!later.some(x=>x.id===track.id))list.push(track);
 };
 // Move across different artists and result pages at each explicit request.
 const picked=[artists[(discoveryTurn*2)%artists.length],artists[(discoveryTurn*2+1)%artists.length]];
 for(let i=0;i<picked.length;i++){
   const a=picked[i];if(!a?.name)continue;
   try{
     const query=new URLSearchParams({
       q:'artist:"'+a.name.replace(/"/g,'')+'"',
       type:'track',limit:'10',
       offset:String(((discoveryTurn+i)%5)*10)
     });
     const data=await sp.api('/search?'+query);
     for(const t of data?.tracks?.items||[])consider(t);
   }catch(e){console.warn('Catalog search:',e?.message)}
 }
 // A transparent collaboration-graph recommendation: move one step beyond
 // regular artists via co-credited artists on real Spotify catalog recordings.
 const adjacent=new Map();
 const core=new Set(artists.map(a=>a.name?.toLocaleLowerCase()).filter(Boolean));
 for(const t of [...fresh,...later]){
   const lineup=t.artists||[];
   if(!lineup.some(a=>core.has(a.name?.toLocaleLowerCase())))continue;
   for(const a of lineup){
     const name=a.name?.toLocaleLowerCase();
     if(name&&!core.has(name)&&!adjacent.has(name))adjacent.set(name,a);
   }
 }
 const neighbours=[...adjacent.values()];
 if(neighbours.length){
   const neighbour=neighbours[discoveryTurn%neighbours.length];
   try{
     const query=new URLSearchParams({
       q:'artist:"'+neighbour.name.replace(/"/g,'')+'"',
       type:'track',limit:'10',
       offset:String((discoveryTurn%3)*10)
     });
     const result=await sp.api('/search?'+query);
     for(const t of result?.tracks?.items||[]){
       if((t.artists||[]).some(a=>a.name?.toLocaleLowerCase()===neighbour.name.toLocaleLowerCase()))consider(t);
     }
   }catch(e){console.warn('Collaborator search unavailable:',e?.message)}
 }
 // Deep cuts from an actual artist's album, where this API is available.
 const seed=picked.find(a=>a?.id&&/^[a-zA-Z0-9]{22}$/.test(a.id));
 if(seed && fresh.length<10){
   try{
     const albums=await sp.api('/artists/'+seed.id+'/albums?include_groups=album,single&limit=10&offset='+((discoveryTurn%4)*10));
     const album=(albums?.items||[]).find(a=>a?.id&&a.album_type!=='compilation');
     if(album?.id){
       const response=await sp.api('/albums/'+album.id+'/tracks?limit=30');
       for(const item of response?.items||[]){
         consider({...item,album:{id:album.id,name:album.name,images:album.images||[]}})
       }
     }
   }catch(e){console.warn('Album discovery:',e?.message)}
 }
 discoveryCache=[...fresh,...later].slice(0,18);
 discoveryTime=Date.now();
 return [...discoveryCache]
}
function readStarts(){
 try{return JSON.parse(localStorage.getItem(accountStorageKey('tm_recent_starts'))||'[]').filter(id=>/^[A-Za-z0-9]{22}$/.test(id)).slice(-35)}
 catch{return []}
}
function recordStart(id){
 if(!id)return;
 try{
   const history=readStarts().filter(x=>x!==id);
   history.push(id);
   localStorage.setItem(accountStorageKey('tm_recent_starts'),JSON.stringify(history.slice(-35)));
 }catch{}
}
function arrangeSession(familiar,discoveries){
 const known=unique(familiar);
 const explored=unique(discoveries).filter(t=>!known.some(k=>k.id===t.id));
 const starts=readStarts();
 const never=explored.filter(t=>!starts.includes(t.id));
 const fallback=explored.filter(t=>starts.includes(t.id));
 const unknown=[...never,...fallback];
 const lastIds=new Set(starts.slice(-8));
 const nonrecent=known.filter(t=>!lastIds.has(t.id));
 // A song from the previous session must not be forced to start again.
 const alternatives=unique([...never,...nonrecent,...fallback,...known]);
 const recentlyStarted=starts.slice(-Math.min(8,Math.max(1,alternatives.length-1)));
 let starters=alternatives.filter(t=>!recentlyStarted.includes(t.id));
 if(!starters.length)starters=alternatives;
 let turn=0;
 try{turn=Math.max(0,Number(localStorage.getItem(accountStorageKey('tm_now_turn'))||0))}catch{}
 turn++;
 try{localStorage.setItem(accountStorageKey('tm_now_turn'),String(turn))}catch{}
 let starter=starters[(turn-1)%starters.length]||null;
 if(starter?.id===starts.at(-1)&&starters.length>1){
   starter=starters.find(t=>t.id!==starter.id)||starter;
 }
 if(!starter)return [];
 const order=[starter],seen=new Set([starter.id]);
 const remainingKnown=[...known].sort((a,b)=>{
   const ap=starts.lastIndexOf(a.id),bp=starts.lastIndexOf(b.id);
   return ap-bp
 });
 const others=[...unknown.filter(t=>!seen.has(t.id)),...remainingKnown];
 let avoidArtist=(t)=>artists(t).toLocaleLowerCase();
 while(others.length&&order.length<40){
   const last=order[order.length-1];
   let i=others.findIndex(t=>!seen.has(t.id)&&avoidArtist(t)!==avoidArtist(last)&&t.album?.id!==last.album?.id);
   if(i<0)i=others.findIndex(t=>!seen.has(t.id));
   if(i<0)break;
   const next=others.splice(i,1)[0];seen.add(next.id);order.push(next)
 }
 return order;
}
async function playNow(){
 const button=el('tm-now-play'),caption=el('tm-now-caption');
 if(button.disabled)return;
 const known=recentWeight(recentEvents);
 if(!known.length){status('Aún no hay canciones suficientes para preparar una sesión.',true);return}
 button.disabled=true;
 const previous=caption.textContent;
 caption.textContent='Buscando otras canciones…';
 try{
   const discoveries=await lightDiscovery(known,true);
   const queue=arrangeSession(known,discoveries);
   if(!queue.length)return;
   const started=await startSongs(queue);
   if(started)recordStart(queue[0]?.id);
   rememberDiscoveries(discoveries);
 }catch(e){status('No pude preparar la sesión: '+e.message,true)}
 finally{button.disabled=false;caption.textContent=previous}
}
async function playLiked(){
 if(play.disabled)return;
 play.disabled=true;rt?.player?.activateElement?.();
 try{await startSongs(await loadLikedSelection())}finally{render()}
}
async function fetchRecent(){
 if(!accountConnected)return;
 if(rt.recent?.length){
   recentEvents=rt.recent.filter(valid).map(track=>({track}));
   return;
 }
 // If the main player could not read history, retry just once.
 try{
   const data=await sp.api('/me/player/recently-played?limit=50');
   recentEvents=(data.items||[]).filter(x=>valid(x.track));
 }catch(e){console.warn('Recent affinity not available:',e.message)}
}
async function prepare(){
 for(let i=0;i<38;i++){
   rt=window.TransmissionRuntime;
   if(rt?.ready)break;
   await new Promise(done=>setTimeout(done,300));
 }
 if(!rt)return;
 accountConnected=!!rt.account;
 accountReady=!!rt.account;
 if(accountConnected){
   accountTop=rt.accountTracks||[];
   // Reuse the already-loaded top tracks instead of doubling API requests.
 }
 await Promise.allSettled([loadFirst(),fetchRecent()]);
 const hasRecent=accountConnected?recentEvents.length:rt.publicSnapshot?.recent?.length||0;
 const hasSelection=recentWeight(recentEvents).length>0;
 el('tm-now-play').hidden=!hasSelection;
 el('tm-now-play').disabled=!hasSelection;
 el('tm-now-caption').textContent=hasRecent?'Lo que más escuchas últimamente':'Basada en tu colección';
 const station=el('tm-station-play');
 if(station&&!hasSelection && !(rt?.accountTracks?.length||rt?.playlists?.length))station.hidden=true;
}
async function surprisePlay(){
 const favorites=recentWeight(recentEvents);
 const discoveries=await lightDiscovery(favorites,true);
 const never=unique(discoveries).filter(t=>!favorites.some(f=>f.id===t.id));
 let queue;
 if(never.length){
   // Distinct from Para ahora: unfamiliar music receives priority.
   queue=unique([...never,...favorites]).slice(0,40);
 }else{
   queue=arrangeSession(favorites,[]);
 }
 if(!queue.length){status('Todavía no hay canciones para descubrir.',true);return}
 const ok=await startSongs(queue);
 if(ok){recordStart(queue[0].id);rememberDiscoveries(discoveries)}
}
async function refreshRotation(){
 const button=el('top-refresh');
 if(!rt?.setRotation||!button)return;
 const label=button.firstChild,original=label?.textContent;
 button.disabled=true;button.setAttribute('aria-busy','true');
 if(label)label.textContent='BUSCANDO… ';
 try{
   const familiar=recentWeight(recentEvents);
   const discovered=await lightDiscovery(familiar,true);
   const merged=unique([...discovered,...familiar]);
   if(!merged.length){status('Todavía no hay canciones para renovar la vista.',true);return}
   const shift=discoveryTurn%Math.max(1,merged.length);
   const rotated=[...merged.slice(shift),...merged.slice(0,shift)];
   rt.setRotation(rotated);
   rememberDiscoveries(discovered.slice(0,8));
 }catch(e){status('No pude renovar la selección: '+e.message,true)}
 finally{button.disabled=false;button.removeAttribute('aria-busy');if(label)label.textContent=original}
}
el('tm-now-play').onclick=()=>{rt?.player?.activateElement?.();void playNow()};
el('random-discovery').onclick=()=>{rt?.player?.activateElement?.();void surprisePlay()};
el('top-refresh').onclick=()=>void refreshRotation();
play.onclick=()=>void playLiked();
more.onclick=()=>void loadNext();
el('tm-liked-prev').onclick=previousLiked;
el('tm-liked-all').onclick=()=>void openLikedAll();
el('tm-liked-close').onclick=closeLikedAll;
el('tm-liked-modal').addEventListener('click',e=>{if(e.target===el('tm-liked-modal')&&!window.TransmissionPages?.isLiked)closeLikedAll()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modalOpen&&!window.TransmissionPages?.isLiked)closeLikedAll()});
el('tm-liked-search').addEventListener('input',renderLikedAll);
async function changeLikedOrder(value){
 likedOrder=value;page=0;
 el('tm-liked-sort').value=value;
 el('tm-liked-sort-inline').value=value;
 render();
 if(accountConnected&&canFetchMore&&value!=='new'){
   let pages=0;
   while(canFetchMore&&pages<12){
     if(!await fetchLikedBatch())break;
     pages++;
   }
 }
 render();
}
el('tm-liked-sort').onchange=()=>void changeLikedOrder(el('tm-liked-sort').value);
el('tm-liked-sort-inline').onchange=()=>void changeLikedOrder(el('tm-liked-sort-inline').value);
el('tm-liked-load').onclick=()=>void fetchLikedBatch();

document.addEventListener('tm:library-changed',event=>{
 if(!accountConnected)return;
 const id=event.detail?.id,saved=event.detail?.saved;
 if(!id)return;
 if(saved===true){
   const current=event.detail?.track||rt?.currentTrack;
   if(current?.id===id&&!liked.some(x=>x.id===id)){
     liked.unshift(current);likesTotal++;likedOffset++;page=0;
   }
 }else if(saved===false){
   const before=liked.length;
   liked=liked.filter(t=>t.id!==id);
   likesTotal=Math.max(0,likesTotal-1);
    if(liked.length!==before)likedOffset=Math.max(0,likedOffset-1);
 }
 render();
});

window.addEventListener?.('tm:account-track',event=>{
  const track=event.detail?.track;
  if(accountConnected&&valid(track))recentEvents=[{track},...recentEvents].slice(0,50);
 });
 window.addEventListener?.('resize',render);
window.TransmissionTaste={
 openLikedAll,
 closeLikedAll,
 arrangeSession,
 getLikedForExport:()=>accountConnected?unique(liked).slice(0,40):[],
 getPublicLiked:()=>unique(liked).slice(0,40),
 getNowSongs:()=>recentWeight(recentEvents),
 refreshRotation,surprisePlay,
 getLiked:()=>unique(liked),
  getTotal:()=>likesTotal||unique(liked).length
};
await prepare();
})();
