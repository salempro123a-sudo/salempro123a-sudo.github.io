/* TRANSMISSION · Personal listening, 2026.
   "Para ahora" is our own recent-affinity ordering of Spotify-authorized data,
   NOT Spotify's restricted recommendation algorithm. */
(async function(){
'use strict';
const sp=window.TransmissionSpotify;
const el=id=>document.getElementById(id);
if(!sp||!el('tm-liked-grid'))return;
const owner=sp.CONFIG.ownerId;
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
let liked=[],likesTotal=0,canFetchMore=false,page=0,loading=false;
const pageSize=()=>window.matchMedia?.('(max-width:540px)').matches?2:window.matchMedia?.('(max-width:700px)').matches?3:6;
let recentEvents=[],ownerTop=[],rt=null,ownerConnected=false,accountReady=false;
const likedGrid=el('tm-liked-grid'),more=el('tm-liked-more'),play=el('tm-liked-play'),label=el('liked-kicker');
function status(message,error=false){rt?.status(message,error)}
function render(){
 likedGrid.replaceChildren();
 const active=unique(liked);
 const size=pageSize();
 const maximum=Math.max(0,Math.ceil(active.length/size)-1);
 page=Math.min(page,maximum);
 if(!active.length){
   likedGrid.append(create('p','tm-liked-empty',ownerConnected?'No se recibieron canciones guardadas.':'Las favoritas todavía no están publicadas.'));
 }else{
   for(const t of active.slice(page*size,(page+1)*size)){
     const card=create('article','tm-liked-card');
     const cover=create('button','tm-liked-art');cover.type='button';
     cover.setAttribute('aria-label','Reproducir '+t.name);cover.title=t.name;
     if(image(t))cover.style.backgroundImage='url("'+image(t)+'")';
     cover.onclick=()=>void rt?.playTrack(t);
     const meta=create('div','tm-liked-caption');
     meta.append(create('strong','',t.name),create('small','',artists(t)));
     card.append(cover,meta);likedGrid.append(card);
   }
 }
 play.disabled=!active.length;
 const pager=el('tm-liked-pager');
 if(pager)pager.hidden=active.length<=size && !(ownerConnected&&canFetchMore);
 const prev=el('tm-liked-prev');
 if(prev)prev.disabled=page===0||loading;
 more.disabled=loading||((page+1)*size>=active.length && !(ownerConnected&&canFetchMore));
 more.hidden=false;
 el('collection-count-3').textContent=active.length?(likesTotal||active.length)+' '+((likesTotal||active.length)===1?'CANCIÓN':'CANCIONES')+' ↗':'';
 label.hidden=true;
}
function fillPlaylistRail(){
 if(!rt||rt.playlists?.length)return;
 const source=unique(liked.length?liked:(rt.ownerTracks?.length?rt.ownerTracks:rt.publicSnapshot?.tracks||[]));
 if(!source.length)return;
 const rail=el('mixtapes'),anchor=el('rail-all');
 if(!rail||!anchor)return;
 rail.querySelectorAll('.rail-item').forEach(x=>x.remove());
 const heading=rail.querySelector('.rail-heading');
 if(heading)heading.textContent='FAVORITAS';
 for(const track of source.slice(0,4)){
   const button=create('button','rail-item');
   button.type='button';button.title=track.name;
   const cover=create('span','rail-item-cover tm-rail-image');
   if(image(track))cover.style.backgroundImage='url("'+image(track)+'")';
   const label=create('span','rail-item-label');
   label.append(document.createTextNode(track.name),create('small','',artists(track)));
   button.append(cover,label,create('span','rail-item-arrow','▶'));
   button.onclick=()=>void rt.playTrack(track);
   rail.insertBefore(button,anchor);
 }
}

async function loadFirst(){
 if(ownerConnected){
   try{
     const data=await sp.api('/me/tracks?limit=50&offset=0');
     liked=(data.items||[]).map(x=>x.track).filter(valid);
     likesTotal=Number(data.total)||liked.length;
     canFetchMore=!!data.next&&liked.length<likesTotal;
   }catch(e){status('No pude leer tus Me gusta: '+e.message,true)}
 }else{
   liked=(rt?.publicSnapshot?.liked||[]).filter(valid);
   likesTotal=liked.length;
 }
 render();
 rt?.fillEmptyHome?.(liked);
 fillPlaylistRail();
 const holder=el('recent-items');
 if(ownerConnected && liked.length && holder && !holder.querySelector('button')){
   // Another section can fall back to saved songs, without inventing play history.
   el('recent-label').textContent='DEL ARCHIVO';
   holder.replaceChildren();
   for(const track of liked.slice(0,5)){
     const btn=create('button','tm-recent-item');
     const cover=create('span','tm-recent-cover');if(image(track))cover.style.backgroundImage='url("'+image(track)+'")';
     const by=create('span','tm-recent-desc');
     by.append(create('strong','',track.name),create('small','',artists(track)));
     btn.append(cover,by,create('span','tm-recent-arrow','▶'));
     btn.onclick=()=>void rt.playTrack(asTrack(track));holder.append(btn);
   }
 }
}
async function loadNext(){
 if(loading)return;
 const desired=(page+2)*pageSize();
 if(desired>liked.length&&ownerConnected&&canFetchMore){
   loading=true;more.disabled=true;
   try{
     const data=await sp.api('/me/tracks?limit=50&offset='+liked.length);
     const known=new Set(liked.map(t=>t.id));
     for(const row of data?.items||[]){
       const t=row?.track;
       if(valid(t)&&!known.has(t.id)){liked.push(t);known.add(t.id)}
     }
     canFetchMore=!!data?.next&&liked.length<(Number(data?.total)||liked.length);
   }catch(e){status('No se pudieron cargar más favoritas: '+e.message,true)}
   finally{loading=false}
 }
 if((page+1)*pageSize()<liked.length)page++;
 render();
}
function previousLiked(){
 if(page>0){page--;render()}
}
function recentWeight(entries){
 const score=new Map();
 function add(raw,value){
   const t=asTrack(raw);if(!t||!Number.isFinite(value))return;
   const item=score.get(t.id)||{track:t,score:0};
   item.score+=value;score.set(t.id,item);
 }
 if(ownerConnected){
   recentEvents.slice(0,50).forEach((x,i)=>add(x.track,Math.max(6,115-i*2.3)));
   ownerTop.slice(0,30).forEach((t,i)=>add(t,Math.max(9,80-i*2.3)));
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
 const playlist=unique(tracks).slice(0,40);
 if(!playlist.length){status('No hay suficientes canciones disponibles.',true);return false}
 if(!rt?.account){status('Conecta Spotify para reproducir esta sesión.',true);return false}
 return !!await rt.playSequence(playlist);
}
let discoveryCache=[],discoveryTime=0,discoveryTurn=0;
try{discoveryTurn=Math.max(0,Number(localStorage.getItem('tm_discovery_turn'))||0)}catch{}
function previousDiscoveries(){
 try{return new Set(JSON.parse(localStorage.getItem('tm_discovery_seen')||'[]'))}
 catch{return new Set()}
}
function rememberDiscoveries(tracks){
 try{
   const seen=[...previousDiscoveries(),...tracks.map(t=>t.id)];
   localStorage.setItem('tm_discovery_seen',JSON.stringify(seen.slice(-160)));
 }catch{}
}
async function lightDiscovery(known,force=false){
 if(!rt?.account)return [];
 if(!force&&discoveryCache.length&&Date.now()-discoveryTime<300000)return [...discoveryCache];
 const previous=previousDiscoveries();
 const owned=unique([...known,...liked,...(rt.ownerTracks||[]),...(rt.recent||[])]);
 const knownIds=new Set(owned.map(t=>t.id));
 // Use actual artists appearing in recent listening, top tracks and saved songs.
 const artists=[];
 const seenArtist=new Set();
 for(const t of [...recentEvents.map(x=>x.track),...ownerTop,...liked]){
   for(const a of t?.artists||[]){
     if(!a.name||seenArtist.has(a.name.toLocaleLowerCase()))continue;
     seenArtist.add(a.name.toLocaleLowerCase());artists.push(a);
   }
 }
 if(!artists.length){
   for(const a of rt.publicSnapshot?.artists||[])if(a?.name)artists.push(a)
 }
 if(!artists.length)return [];
 discoveryTurn++;
 try{localStorage.setItem('tm_discovery_turn',String(discoveryTurn))}catch{}
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
 try{return JSON.parse(localStorage.getItem('tm_recent_starts')||'[]').filter(id=>/^[A-Za-z0-9]{22}$/.test(id)).slice(-35)}
 catch{return []}
}
function recordStart(id){
 if(!id)return;
 try{
   const history=readStarts().filter(x=>x!==id);
   history.push(id);
   localStorage.setItem('tm_recent_starts',JSON.stringify(history.slice(-35)));
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
 try{turn=Math.max(0,Number(localStorage.getItem('tm_now_turn')||0))}catch{}
 turn++;
 try{localStorage.setItem('tm_now_turn',String(turn))}catch{}
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
async function playLiked(){await startSongs(liked)}
async function fetchRecent(){
 if(!ownerConnected)return;
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
 ownerConnected=rt.account?.id===owner;
 accountReady=!!rt.account;
 if(ownerConnected){
   ownerTop=rt.ownerTracks||[];
   // Reuse the already-loaded top tracks instead of doubling API requests.
 }
 await Promise.allSettled([loadFirst(),fetchRecent()]);
 const hasRecent=ownerConnected?recentEvents.length:rt.publicSnapshot?.recent?.length||0;
 const hasSelection=recentWeight(recentEvents).length>0;
 el('tm-now-play').hidden=!hasSelection;
 el('tm-now-play').disabled=!hasSelection;
 el('tm-now-caption').textContent=hasRecent?'Lo que más escuchas últimamente':'Basada en tu colección';
 const station=el('tm-station-play');
 if(station&&!hasSelection && !(rt?.ownerTracks?.length||rt?.playlists?.length))station.hidden=true;
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
document.addEventListener('tm:library-changed',event=>{
 if(!ownerConnected)return;
 const id=event.detail?.id,saved=event.detail?.saved;
 if(!id)return;
 if(saved===true){
   const current=rt?.currentTrack;
   if(current?.id===id&&!liked.some(x=>x.id===id)){
     liked.unshift(current);likesTotal++;page=0;
   }
 }else if(saved===false){
   const before=liked.length;
   liked=liked.filter(t=>t.id!==id);
   if(liked.length!==before)likesTotal=Math.max(0,likesTotal-1);
 }
 render();
});

window.addEventListener?.('resize',render);
window.TransmissionTaste={
 arrangeSession,
 getOwnerLiked:()=>ownerConnected?unique(liked).slice(0,40):[],
 getPublicLiked:()=>unique(liked).slice(0,40),
 getNowSongs:()=>recentWeight(recentEvents),
 refreshRotation,surprisePlay,
 getLiked:()=>unique(liked)
};
await prepare();
})();