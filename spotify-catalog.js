/* Browsable catalog. Search and detail views remain open while music plays. */
(function(){
'use strict';
const sp=window.TransmissionSpotify,rt=window.TransmissionRuntime,ui=window.TransmissionTrackActions;
if(!sp||!rt||!ui)return;
const $=id=>document.getElementById(id),shell=$('tm-catalog'),content=$('tm-catalog-content'),field=$('tm-catalog-query');
if(!shell||!content||!field)return;
const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const labels={track:'CANCIONES',artist:'ARTISTAS',album:'ÁLBUMES',playlist:'PLAYLISTS'};
const keys={track:'tracks',artist:'artists',album:'albums',playlist:'playlists'};
const valid=item=>/^[A-Za-z0-9]{22}$/.test(item?.id||'');
const cache=new Map(),requests=new Map();
let history=[],cursor=-1,serial=0,timer=null,lastFocus=null,opened=false;
const view=()=>history[cursor];
function topOffset(){shell.style.setProperty('--catalog-top',Math.ceil(document.querySelector('.site-header').getBoundingClientRect().height)+'px')}
function hideOtherViews(){for(const name of ['TransmissionLibrary','TransmissionArtist','TransmissionTaste']){if(name==='TransmissionTaste')window[name]?.closeLikedAll?.({routed:true});else window[name]?.close?.({routed:true})}}
function reveal(){
 if(!opened){lastFocus=document.activeElement;hideOtherViews();opened=true;shell.hidden=false;document.body.classList.add('tm-catalog-open');$('main').inert=true;document.querySelector('.footer').inert=true}
 window.TransmissionSearch?.close?.();topOffset();
}
function close(options={}){
 if(!options.routed&&window.TransmissionPages?.isCatalog)return window.TransmissionPages.home();
 if(!opened)return;
 opened=false;++serial;clearTimeout(timer);shell.hidden=true;document.body.classList.remove('tm-catalog-open');window.TransmissionUI?.syncViews?.();ui.close();lastFocus?.focus?.();
}
function navigation(){
 $('tm-catalog-back').disabled=window.TransmissionPages?!window.TransmissionPages.canBack:cursor<=0;$('tm-catalog-forward').disabled=window.TransmissionPages?!window.TransmissionPages.canForward:cursor>=history.length-1;
 const current=view();field.value=current?.query||'';
 shell.dataset.kind=current?.kind||'search';
 $('tm-catalog-title').hidden=current?.kind!=='search';
 $('tm-catalog-title').textContent=current?.kind==='search'?(current.query?'RESULTADOS PARA “'+current.query+'”':'EXPLORAR EL ARCHIVO'):current?.kind==='album'?'ÁLBUM':'ARTISTA';
 $('tm-catalog-tabs').hidden=current?.kind!=='search';
 for(const button of document.querySelectorAll('#tm-catalog-tabs button')){const active=button.dataset.type===current?.filter;button.setAttribute('aria-pressed',String(active))}
}
function push(next,options={}){
 if(!options.routed&&window.TransmissionPages)return window.TransmissionPages.catalog(next,options);
 if(view())view().scroll=shell.scrollTop;
 history=history.slice(0,cursor+1);history.push(next);
 if(history.length>30)history.shift();cursor=history.length-1;
 ++serial;clearTimeout(timer);next.loading=false;reveal();navigation();shell.scrollTop=0;void render();
}
function search(query='',filter='track'){
 query=String(query).trim().slice(0,200);
 if(!labels[filter])filter='track';
 remember(query);
 if(opened&&view()?.kind==='search'&&view().query===query&&view().filter===filter&&view().loaded&&!view().loading){field.focus();return}
 push({kind:'search',query,filter,items:[],offset:0,next:false,total:0,loaded:false,loading:false});field.focus();
}
async function request(endpoint){
 const account=rt.account?.id;if(!account)throw Error('Conecta Spotify para explorar el catálogo.');
 const key=account+':'+endpoint,known=cache.get(key);
 if(known&&Date.now()-known.at<300000)return known.value;
 if(requests.has(key))return requests.get(key);
 const operation=sp.api(endpoint).then(value=>{
   if(rt.account?.id!==account)throw Error('La cuenta ha cambiado. Repite la búsqueda.');
   cache.set(key,{value,at:Date.now()});if(cache.size>60)cache.delete(cache.keys().next().value);return value;
 }).finally(()=>{if(requests.get(key)===operation)requests.delete(key)});
 requests.set(key,operation);return operation;
}
function message(text,action){
 const host=make('div','tm-catalog-message');host.append(make('p','',text));
 if(action){const button=make('button','tm-catalog-button',action.label);button.type='button';button.onclick=action.run;host.append(button)}
 content.append(host);
}
function heading(title,meta=''){
 const head=make('div','tm-catalog-section-head');head.append(make('h3','',title));if(meta)head.append(make('span','',meta));content.append(head);return head;
}
function card(item,type){
 const button=make('button','tm-catalog-card');button.type='button';
 const image=make('span','tm-catalog-art');const url=ui.art(item);if(url)image.style.backgroundImage='url("'+url+'")';
 image.append(make('span','tm-catalog-card-arrow','↗'));
 button.append(image,make('strong','',item.name),make('small','',type==='artist'?'ARTISTA':type==='album'?[ui.by(item),item.release_date?.slice(0,4)].filter(Boolean).join(' · '):item.owner?.display_name||'PLAYLIST'));
 button.onclick=()=>type==='artist'?openArtist(item):type==='album'?openAlbum(item):openPlaylist(item);return button;
}
function rows(tracks,onPlay){const list=make('div','tm-catalog-songs');tracks.forEach((track,index)=>list.append(ui.row(track,{tracks,index,number:index+1,onPlay:onPlay?()=>onPlay(index):undefined})));content.append(list)}
function moreButton(state,load){
 if(!state.next)return;
 const button=make('button','tm-catalog-more',state.loading?'CARGANDO…':'MÁS RESULTADOS ↓');button.type='button';button.disabled=state.loading;
 button.onclick=()=>void load(true);content.append(button);
}
function browse(){
 const recent=recentSearches();
 if(recent.length){
   const head=heading('BÚSQUEDAS RECIENTES');
   const clear=make('button','tm-text-action','BORRAR');clear.type='button';clear.onclick=()=>{try{localStorage.removeItem(recentKey())}catch{}renderCurrent()};head.append(clear);
   const list=make('div','tm-catalog-recents');
   recent.forEach(query=>{const link=make('a','',query);link.href='#/buscar?'+new URLSearchParams({q:query});list.append(link)});
   content.append(list);
 }
 heading('POR GÉNERO');
 const tags=make('div','tm-catalog-genres');
 for(const [label,genre] of [['JAZZ','jazz'],['SOUL','soul'],['FUNK','funk'],['ELECTRÓNICA','electronic'],['AMBIENT','ambient'],['HIP HOP','hip-hop'],['ROCK','rock'],['INDIE','indie'],['CLÁSICA','classical'],['REGGAE','reggae'],['LATINA','latin'],['EXPERIMENTAL','experimental']]){
   const button=make('button','',label);button.type='button';button.onclick=()=>search('genre:'+genre);tags.append(button);
 }
 content.append(tags);
 const artists=rt.accountArtists||[];
 if(artists.length){heading('TUS ARTISTAS');const grid=make('div','tm-catalog-grid');artists.slice(0,8).forEach(artist=>grid.append(card(artist,'artist')));content.append(grid)}
 const tracks=(rt.recent?.length?rt.recent:rt.accountTracks).slice(0,10);
 if(tracks.length){heading(rt.recent?.length?'VOLVER A ESCUCHAR':'EN ROTACIÓN');rows(tracks)}
 else message(rt.account?'Busca una canción, un artista o un álbum.':'Conecta Spotify para buscar y preparar tu cola.',rt.account?null:{label:'CONECTAR SPOTIFY',run:()=>$('saved-trigger').click()});
}
function renderSearch(state){
 if(!state.query){browse();return}
 heading(labels[state.filter],state.loaded?state.items.length+' / '+state.total:'');
 if(state.items.length){
   if(state.filter==='track')rows(state.items);
   else{const grid=make('div','tm-catalog-grid');state.items.forEach(item=>grid.append(card(item,state.filter)));content.append(grid)}
 }
 if(state.loading&&!state.items.length)message('Buscando…');
 else if(state.error)message(state.error,{label:'REINTENTAR',run:()=>void loadSearch(false)});
 else if(state.loaded&&!state.items.length)message('Sin resultados. Prueba otro nombre o cambia el filtro.');
 moreButton(state,loadSearch);
}
async function loadSearch(append=false){
 const state=view();if(state?.kind!=='search'||!state.query||state.loading)return;
 const query=state.query,filter=state.filter,offset=append?state.offset:0,seq=++serial;
 state.loading=true;state.requestId=seq;state.error='';content.setAttribute('aria-busy','true');renderCurrent();
 try{
   const response=await request('/search?'+new URLSearchParams({q:query,type:filter,limit:'10',offset:String(offset)}));
   if(seq!==serial||view()!==state||!opened)return;
   const page=response?.[keys[filter]],raw=page?.items||[],known=new Set((append?state.items:[]).map(item=>item.id));
   state.items=append?[...state.items]:[];
   for(const item of raw)if(valid(item)&&!known.has(item.id)){known.add(item.id);state.items.push(item)}
   state.offset=offset+raw.length;state.total=Number(page?.total)||state.items.length;
   state.next=!!page?.next&&raw.length>0&&state.offset<state.total&&state.offset<1000;state.loaded=true;
 }catch(error){if(seq===serial&&view()===state){state.error=error.status===429?'Spotify ha pausado las consultas. Inténtalo cuando se restablezca el acceso.':error.message;rt.status('Catálogo: '+error.message,true)}}
 finally{if(state.requestId===seq)state.loading=false;if(seq===serial&&view()===state&&opened){content.setAttribute('aria-busy','false');renderCurrent()}}
}
function detailHeading(item,type,extra=''){
 const head=make('div','tm-catalog-detail-head'),cover=make('div','tm-catalog-detail-art');const url=ui.art(item);if(url)cover.style.backgroundImage='url("'+url+'")';
 const copy=make('div','tm-catalog-detail-copy');copy.append(make('span','tm-catalog-kind',type),make('h1','',item.name));
 if(extra)copy.append(make('p','',extra));head.append(cover,copy);content.append(head);return copy;
}
function detailActions(copy,state){
 const actions=make('div','tm-catalog-detail-actions');
 for(const [label,operation] of [['▶ ESCUCHAR',()=>playAlbum(state,0)],['+ AÑADIR ÁLBUM A LA COLA',async()=>{await allAlbumTracks(state);return rt.enqueueTracks(state.tracks)}]]){
   const button=make('button','tm-catalog-button',label);button.type='button';button.disabled=!state.tracks?.length;button.onclick=()=>void ui.run(button,operation);actions.append(button);
 }
 const artist=state.item.artists?.[0];if(artist?.name){const button=make('button','tm-catalog-button',artist.name.toUpperCase()+' ↗');button.type='button';button.onclick=()=>openArtist(artist);actions.append(button)}
 const link=make('a','tm-catalog-link','SPOTIFY ↗');link.href='https://open.spotify.com/album/'+state.item.id;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);copy.append(actions);
}
function renderAlbum(state){
 const copy=detailHeading(state.item,'ÁLBUM',[ui.by(state.item),state.item.release_date?.slice(0,4),state.item.total_tracks?state.item.total_tracks+' CANCIONES':''].filter(Boolean).join(' · '));
 detailActions(copy,state);if(state.tracks?.length)rows(state.tracks,index=>playAlbum(state,index));
 if(state.loading)message('Cargando álbum…');else if(state.error)message(state.error,{label:'REINTENTAR',run:()=>void loadAlbum(state,true)});
 moreButton(state,()=>loadAlbum(state,true));
}
async function loadAlbum(state,append=false){
 if(state.loading)return;const seq=++serial;state.loading=true;state.requestId=seq;state.error='';renderCurrent();
 try{
   const data=await request(append?'/albums/'+state.item.id+'/tracks?limit=50&offset='+(state.trackOffset||0):'/albums/'+state.item.id);
   if(seq!==serial||view()!==state||!opened)return;
   if(!append)state.item=data;
   const page=append?data:data.tracks,album={id:state.item.id,name:state.item.name,images:state.item.images,release_date:state.item.release_date};
   const tracks=(page?.items||[]).filter(valid).map(track=>({...track,type:'track',uri:track.uri||'spotify:track:'+track.id,album}));
   state.tracks=append?[...state.tracks,...tracks]:tracks;state.trackOffset=(append?state.trackOffset||0:0)+(page?.items?.length||0);state.next=!!page?.next&&(page?.items?.length||0)>0;state.loaded=true;
 }catch(error){if(seq===serial){state.error=error.message;rt.status('Álbum: '+error.message,true)}}
 finally{if(state.requestId===seq)state.loading=false;if(seq===serial&&view()===state&&opened)renderCurrent()}
}
async function allAlbumTracks(state){
 if(state.completing)return state.completing;
 if(state.loading)throw Error('Espera a que termine de cargar el álbum.');
 const account=rt.account?.id;
 state.completing=(async()=>{while(state.next){
   const offset=state.trackOffset||0,data=await request('/albums/'+state.item.id+'/tracks?limit=50&offset='+offset);
   if(rt.account?.id!==account)throw Error('La cuenta ha cambiado.');
   const batch=(data.items||[]).filter(valid).map(track=>({...track,type:'track',album:state.item}));
   if(!batch.length)throw Error('Spotify no pudo completar el álbum. Inténtalo de nuevo.');
   state.tracks.push(...batch);state.trackOffset=offset+(data.items?.length||0);state.next=!!data.next;
 }
 if(view()===state&&opened)renderCurrent();
 })();
 try{await state.completing}finally{state.completing=null}
}
async function playAlbum(state,index){await allAlbumTracks(state);if(!opened||view()!==state)return false;return rt.playSequence(state.tracks,index)}
function renderArtist(state){
 detailHeading(state.item,'ARTISTA');
 if(state.tracks?.length){heading('CANCIONES');rows(state.tracks)}
 if(state.albums?.length){heading('ÁLBUMES Y SINGLES');const grid=make('div','tm-catalog-grid');state.albums.forEach(album=>grid.append(card(album,'album')));content.append(grid)}
 if(state.loading)message('Buscando música…');else if(state.error)message(state.error,{label:'REINTENTAR',run:()=>void loadArtist(state)});
 else if(state.loaded&&!state.tracks?.length&&!state.albums?.length)message('No se encontró música disponible para este artista.');
 moreButton(state,()=>loadArtist(state,true));
}
async function loadArtist(state,append=false){
 if(state.loading)return;const seq=++serial;state.loading=true;state.requestId=seq;state.error='';renderCurrent();
 try{
   const offset=append?state.offset:0,query='artist:"'+state.item.name.replace(/"/g,'')+'"';
   if(!valid(state.item)){
     const matches=await request('/search?'+new URLSearchParams({q:state.item.name,type:'artist',limit:'10'}));
     if(seq!==serial||view()!==state||!opened)return;
     const exact=(matches?.artists?.items||[]).find(item=>item.name?.toLocaleLowerCase()===state.item.name.toLocaleLowerCase());
     if(exact)state.item=exact;
   }
   const results=await Promise.allSettled([
     request('/search?'+new URLSearchParams({q:query,type:'track',limit:'10',offset:String(offset)})),
     !append&&valid(state.item)?request('/artists/'+state.item.id+'/albums?include_groups=album,single&limit=20'):Promise.resolve(null)
   ]);
   if(seq!==serial||view()!==state||!opened)return;
   const tracks=results[0],albums=results[1];
   if(tracks.status==='rejected')throw tracks.reason;
   const page=tracks.value?.tracks,raw=page?.items||[];
   const batch=raw.filter(track=>valid(track)&&track.artists?.some(artist=>valid(state.item)?artist.id===state.item.id:artist.name.toLocaleLowerCase()===state.item.name.toLocaleLowerCase()));
   const known=new Set((append?state.tracks||[]:[]).map(track=>track.id));state.tracks=append?[...state.tracks]:[];
   for(const track of batch)if(!known.has(track.id)){known.add(track.id);state.tracks.push(track)}
   if(albums.status==='fulfilled'&&albums.value)state.albums=(albums.value.items||[]).filter(valid);
   state.offset=offset+raw.length;state.next=!!page?.next&&raw.length>0&&state.offset<1000;state.loaded=true;
 }catch(error){if(seq===serial){state.error=error.message;rt.status('Artista: '+error.message,true)}}
 finally{if(state.requestId===seq)state.loading=false;if(seq===serial&&view()===state&&opened)renderCurrent()}
}
function renderCurrent(){content.replaceChildren();navigation();const state=view();content.setAttribute('aria-busy',String(!!state?.loading));if(!state)return;if(state.kind==='search')renderSearch(state);else if(state.kind==='album')renderAlbum(state);else renderArtist(state)}
async function render(){
 renderCurrent();const state=view();if(!state||state.loaded)return;
 if(state.kind==='search'&&state.query)await loadSearch();else if(state.kind==='album')await loadAlbum(state);else if(state.kind==='artist')await loadArtist(state);
}
function openAlbum(item){if(!valid(item))return;push({kind:'album',item,tracks:[],loaded:false,loading:false,next:false,query:''})}
function openArtist(item){if(typeof item==='string')item=(rt.accountArtists||[]).find(artist=>artist.name.toLocaleLowerCase()===item.toLocaleLowerCase())||{name:item};if(!item?.name)return;push({kind:'artist',item,tracks:[],albums:[],offset:0,loaded:false,loading:false,next:false,query:''})}
function openPlaylist(item){window.TransmissionLibrary?.openDetail?.(item)}
function traverse(delta){const next=cursor+delta;if(next<0||next>=history.length)return;view().scroll=shell.scrollTop;++serial;cursor=next;view().loading=false;clearTimeout(timer);ui.close();void render();shell.scrollTop=view().scroll||0}
$('tm-catalog-close').onclick=()=>close();$('tm-catalog-back').onclick=()=>window.TransmissionPages?window.TransmissionPages.back():traverse(-1);$('tm-catalog-forward').onclick=()=>window.TransmissionPages?window.TransmissionPages.forward():traverse(1);
$('tm-catalog-form').onsubmit=event=>{event.preventDefault();clearTimeout(timer);search(field.value,view()?.filter||'track')};
field.addEventListener('input',()=>clearTimeout(timer));
document.querySelectorAll('#tm-catalog-tabs button').forEach(button=>button.onclick=()=>search(field.value,button.dataset.type));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&opened&&!window.TransmissionPages?.isCatalog){event.preventDefault();close()}});
document.querySelectorAll('a[href="#explore"]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();search()}));
window.addEventListener('resize',()=>{if(opened)topOffset()});
function recentKey(){return 'tm:searches:'+(rt.account?.id||'guest')}
function recentSearches(){try{const value=JSON.parse(localStorage.getItem(recentKey())||'[]');return Array.isArray(value)?value.filter(query=>typeof query==='string'&&query.length<=200).slice(0,8):[]}catch{return []}}
function remember(query){if(!query)return;try{localStorage.setItem(recentKey(),JSON.stringify([query,...recentSearches().filter(item=>item.toLocaleLowerCase()!==query.toLocaleLowerCase())].slice(0,8)))}catch{}}
window.TransmissionCatalog={search,open:()=>search(),openAlbum,openArtist,close,showState:state=>{if(state.query)remember(state.query);push(state,{routed:true})},refresh:()=>{const state=view();if(state&&opened){if(!state.loaded){state.error='';void render()}else renderCurrent()}},syncNavigation:navigation,get isOpen(){return opened}};
})();
