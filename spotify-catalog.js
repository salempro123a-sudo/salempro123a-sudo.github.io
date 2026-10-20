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
 const current=view();
 shell.dataset.kind=current?.kind||'search';
 $('tm-catalog-title').hidden=current?.kind!=='search';
 $('tm-catalog-title').textContent=current?.query||'EXPLORAR';
 $('tm-catalog-title').classList.toggle('tm-visually-hidden',!!current?.query);
 $('tm-catalog-tabs').hidden=current?.kind!=='search'||!current?.query;
 for(const button of document.querySelectorAll('#tm-catalog-tabs button')){const active=button.dataset.type===current?.filter;button.setAttribute('aria-pressed',String(active))}
}
function push(next,options={}){
 if(!options.routed&&window.TransmissionPages)return window.TransmissionPages.catalog(next,options);
 if(view())view().scroll=shell.scrollTop;
 history=history.slice(0,cursor+1);history.push(next);
 if(history.length>30)history.shift();cursor=history.length-1;
 ++serial;clearTimeout(timer);next.loading=false;field.value=next.query||'';reveal();navigation();shell.scrollTop=0;void render();
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
function card(item,type,options={}){
 const button=make('button','tm-catalog-card');button.type='button';
 const image=make('span','tm-catalog-art');const url=ui.art(item);if(url)image.style.backgroundImage='url("'+url+'")';
 button.append(image,make('strong','',item.name));
 const meta=type==='artist'?'':type==='album'?[options.discography?'':ui.by(item),item.release_date?.slice(0,4)].filter(Boolean).join(' · '):item.owner?.display_name||'';
 if(meta)button.append(make('small','',meta));
 button.onclick=()=>type==='artist'?openArtist(item):type==='album'?openAlbum(item):openPlaylist(item);return button;
}
function rows(tracks,onPlay,options={}){
 const list=make('div','tm-catalog-songs');
 tracks.forEach((track,index)=>list.append(ui.row(track,{tracks,index,number:index+1,noCover:options.album,albumSubtitle:options.artist,onPlay:onPlay?()=>onPlay(index):undefined})));
 content.append(list);
}
function moreButton(state,load,label='CARGAR MÁS'){
 if(!state.next)return;
 const button=make('button','tm-catalog-more',state.loading?'CARGANDO…':label+' ↓');button.type='button';button.disabled=state.loading;button.dataset.catalogFocus='more';
 button.onclick=async()=>{
   const source=view(),count=content.querySelectorAll('.tm-song-row,.tm-catalog-card').length,restore=document.activeElement===button;
   await load(true);
   if(restore&&opened&&view()===source){const added=content.querySelectorAll('.tm-song-row,.tm-catalog-card')[count];(added?.querySelector('.tm-song-name')||added||content.querySelector('[data-catalog-focus="more"]'))?.focus({preventScroll:true})}
 };content.append(button);
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
 heading('GÉNEROS');
 const tags=make('div','tm-catalog-genres');
 for(const [label,genre] of [['JAZZ','jazz'],['SOUL','soul'],['FUNK','funk'],['ELECTRÓNICA','electronic'],['AMBIENT','ambient'],['HIP HOP','hip-hop'],['ROCK','rock'],['INDIE','indie'],['CLÁSICA','classical'],['REGGAE','reggae'],['LATINA','latin'],['EXPERIMENTAL','experimental']]){
   const button=make('button','');button.type='button';button.append(make('span','',label),make('span','tm-genre-arrow','↗'));button.onclick=()=>search('genre:'+genre);tags.append(button);
 }
 content.append(tags);
 const artists=rt.accountArtists||[];
 if(artists.length){const head=heading('TUS ARTISTAS');const all=make('a','tm-text-action','↗');all.href='#/rotacion?vista=artists';all.setAttribute('aria-label','Ver tus artistas');head.append(all);const grid=make('div','tm-catalog-grid');artists.forEach(artist=>grid.append(card(artist,'artist')));content.append(grid)}
 const tracks=(rt.recent?.length?rt.recent:rt.accountTracks).slice(0,10);
 if(tracks.length){heading(rt.recent?.length?'VOLVER A ESCUCHAR':'EN ROTACIÓN');rows(tracks)}
 else if(!rt.account)message('',{label:'CONECTAR SPOTIFY',run:()=>$('saved-trigger').click()});
}
function renderSearch(state){
 if(!state.query){browse();return}
 if(!rt.account){message('',{label:'CONECTAR SPOTIFY',run:()=>$('saved-trigger').click()});return}
 if(state.match&&state.filter==='track'){
   const match=make('button','tm-catalog-match');match.type='button';
   const art=make('span','tm-catalog-match-art'),url=ui.art(state.match);if(url)art.style.backgroundImage='url("'+url+'")';
   if(url)match.append(art);match.append(make('strong','',state.match.name),make('span','tm-catalog-match-arrow','↗'));
   match.setAttribute('aria-label','Ver artista: '+state.match.name);match.onclick=()=>openArtist(state.match);content.append(match);
 }
 if(state.loaded){const count=make('div','tm-catalog-count',state.items.length+' / '+state.total);count.setAttribute('aria-label',state.items.length+' de '+state.total+' resultados');content.append(count)}
 if(state.items.length){
   if(state.filter==='track')rows(state.items);
   else{const grid=make('div','tm-catalog-grid');state.items.forEach(item=>grid.append(card(item,state.filter)));content.append(grid)}
 }
 if(state.loading&&!state.items.length)message('Buscando…');
 else if(state.error)message(state.error,{label:'REINTENTAR',run:()=>void loadSearch(!!state.items.length)});
 else if(state.loaded&&!state.items.length)message('Sin resultados.');
 if(!state.error)moreButton(state,loadSearch);
}
async function loadSearch(append=false){
 const state=view();if(state?.kind!=='search'||!state.query||state.loading)return;
 const query=state.query,filter=state.filter,seq=++serial;
 state.loading=true;state.requestId=seq;state.error='';content.setAttribute('aria-busy','true');renderCurrent();
 try{
   if(!append){state.items=[];state.offset=0;state.match=null}
   const known=new Set(state.items.map(item=>item.id));
   for(let batch=0;batch<(filter==='track'?3:2);batch++){
     const offset=state.offset,type=filter==='track'&&offset===0?'track,artist':filter;
     const response=await request('/search?'+new URLSearchParams({q:query,type,limit:'10',offset:String(offset)}));
     if(seq!==serial||view()!==state||!opened)return;
     const page=response?.[keys[filter]],raw=page?.items||[];
     if(type==='track,artist')state.match=(response?.artists?.items||[]).find(artist=>artist.name?.toLocaleLowerCase()===query.toLocaleLowerCase())||null;
     for(const item of raw)if(valid(item)&&!known.has(item.id)){known.add(item.id);state.items.push(item)}
     state.offset=offset+raw.length;state.total=Number(page?.total)||state.items.length;
     state.next=!!page?.next&&raw.length>0&&state.offset<state.total&&state.offset<1000;state.loaded=true;
     if(!state.next)break;
   }
   announce(state.items.length+' resultados');
 }catch(error){if(seq===serial&&view()===state){state.error=error.status===429?'Spotify ha pausado las consultas. Inténtalo cuando se restablezca el acceso.':error.message;rt.status('Catálogo: '+error.message,true)}}
 finally{if(state.requestId===seq)state.loading=false;if(seq===serial&&view()===state&&opened){content.setAttribute('aria-busy','false');renderCurrent()}}
}
function detailHeading(item,type,extra=''){
 const head=make('div','tm-catalog-detail-head'),cover=make('div','tm-catalog-detail-art');const url=ui.art(item);if(url)cover.style.backgroundImage='url("'+url+'")';
 const copy=make('div','tm-catalog-detail-copy');copy.append(make('h1','',item.name));
 if(type==='ARTISTA'&&!url){head.classList.add('tm-catalog-without-art');cover.hidden=true}
 if(extra)copy.append(make('p','',extra));head.append(cover,copy);content.append(head);return copy;
}
function detailActions(copy,state){
 const actions=make('div','tm-catalog-detail-actions');
 for(const [label,title,operation] of [['▶ ESCUCHAR','Reproducir el álbum',()=>playAlbum(state,0)],['+','Añadir el álbum a la cola',async()=>{await allAlbumTracks(state);return rt.enqueueTracks(state.tracks)}]]){
   const button=make('button','tm-catalog-button',label);button.type='button';button.title=title;button.setAttribute('aria-label',title);button.disabled=!state.tracks?.length;button.onclick=()=>void ui.run(button,operation);actions.append(button);
 }
 const link=make('a','tm-catalog-link','SPOTIFY ↗');link.href='https://open.spotify.com/album/'+state.item.id;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);copy.append(actions);
}
function renderAlbum(state){
 const copy=detailHeading(state.item,'ÁLBUM');
 const credits=make('div','tm-catalog-credits');
 for(const artist of state.item.artists||[]){const link=make(valid(artist)?'a':'span','',artist.name);if(valid(artist))link.href='#/artista/'+artist.id+'?'+new URLSearchParams({nombre:artist.name});credits.append(link)}
 copy.append(credits);
 const meta=[state.item.release_date?.slice(0,4),state.item.total_tracks?state.item.total_tracks+' CANCIONES':''];
 if(state.loaded&&!state.next&&state.tracks?.length)meta.push(ui.format(state.tracks.reduce((sum,track)=>sum+(track.duration_ms||0),0)));
 copy.append(make('p','',meta.filter(Boolean).join(' · ')));
 detailActions(copy,state);if(state.tracks?.length)rows(state.tracks,index=>playAlbum(state,index),{album:true});
 if(!rt.account)message('',{label:'CONECTAR SPOTIFY',run:()=>$('saved-trigger').click()});
 else if(state.loading)message('CARGANDO…');else if(state.error)message(state.error,{label:'REINTENTAR',run:()=>void loadAlbum(state,!!state.loaded)});
 if(!state.error)moreButton(state,()=>loadAlbum(state,true));
 detailLayout(copy,'tm-album-layout');
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
const releaseGroups={'album,single,compilation':'TODOS LOS DISCOS',album:'ÁLBUMES',single:'SINGLES Y EP',appears_on:'APARICIONES'};
function artistData(state){
 if(!state.artist)state.artist={item:state.item,profileLoaded:false,songs:{items:[],offset:0,next:false,loaded:false},releases:{}};
 return state.artist;
}
function artistPage(state){
 const data=artistData(state);
 if(state.tab!=='releases')return data.songs;
 const group=releaseGroups[state.group]?state.group:'album,single,compilation';
 if(!data.releases[group])data.releases[group]={items:[],offset:0,next:false,loaded:false};
 return data.releases[group];
}
function artistView(state,tab,group=state.group){push({...state,tab,group,loading:false,error:''})}
function renderArtist(state){
 const data=artistData(state),page=artistPage(state),releases=state.tab==='releases',item=data.item;
 const copy=detailHeading(item,'ARTISTA'),actions=make('div','tm-catalog-detail-actions');
 const play=make('button','tm-catalog-button tm-artist-play','▶ ESCUCHAR');play.type='button';play.disabled=state.loading||!rt.account;
 play.onclick=()=>void ui.run(play,async()=>{if(!data.songs.loaded)await loadArtist(state,false,'tracks');if(view()===state&&data.songs.items.length)return rt.playSequence(data.songs.items)});actions.append(play);
 const external=make('a','tm-catalog-link','SPOTIFY ↗');external.href='https://open.spotify.com/artist/'+item.id;external.target='_blank';external.rel='noopener noreferrer';actions.append(external);copy.append(actions);
 const nav=make('nav','tm-artist-tabs');nav.setAttribute('aria-label','Música del artista');
 for(const [tab,label] of [['tracks','CANCIONES'],['releases','DISCOS']]){
   const link=make('a','',label);link.href=window.TransmissionPages?.artistURL?.(state,tab,state.group)||'#';link.dataset.catalogFocus=tab;
   if((releases?'releases':'tracks')===tab)link.setAttribute('aria-current','page');
   link.onclick=event=>{if(!window.TransmissionPages){event.preventDefault();artistView(state,tab)}};nav.append(link);
 }
 content.append(nav);
 const tools=make('div','tm-artist-tools');
 if(releases){
   const select=make('select','');select.setAttribute('aria-label','Tipo de disco');select.dataset.catalogFocus='release-group';
   for(const [key,name] of Object.entries(releaseGroups)){const option=make('option','',name);option.value=key;option.selected=key===(state.group||'album,single,compilation');select.append(option)}
   select.onchange=()=>artistView(state,'releases',select.value);tools.append(select);
 }
 if(page.loaded)tools.append(make('span','tm-catalog-count',page.items.length+(releases&&page.total?' / '+page.total:'')));
 content.append(tools);
 if(page.items.length){
   if(releases){const grid=make('div','tm-catalog-grid tm-discography-grid');page.items.forEach(album=>grid.append(card(album,'album',{discography:true})));content.append(grid)}
   else rows(page.items,undefined,{artist:true});
 }
 if(!rt.account)message('',{label:'CONECTAR SPOTIFY',run:()=>$('saved-trigger').click()});
 else if(state.loading&&!page.items.length)message('CARGANDO…');
 else if(state.error)message(state.error,{label:'REINTENTAR',run:()=>void loadArtist(state,!!page.items.length)});
 else if(page.loaded&&!page.items.length)message(releases?'Sin discos disponibles.':'Sin canciones disponibles.');
 if(!state.error)moreButton({...page,loading:state.loading},()=>loadArtist(state,true),releases?'MÁS DISCOS':'MÁS CANCIONES');
 detailLayout(copy,'tm-artist-layout');
}
function detailLayout(copy,kind){
 const layout=make('div','tm-detail-layout '+kind),profile=make('header','tm-detail-profile'),library=make('div','tm-detail-library');
 profile.append(copy.parentElement);library.append(...Array.from(content.childNodes));layout.append(profile,library);content.append(layout);
}
async function loadArtist(state,append=false,tab=state.tab){
 if(state.loading)return;
 const seq=++serial,data=artistData(state),page=artistPage({...state,tab}),releases=tab==='releases';
 state.loading=true;state.requestId=seq;state.error='';renderCurrent();
 const current=()=>seq===serial&&view()===state&&opened;
 try{
   if(!data.profileLoaded){
     if(valid(data.item)){
       try{const profile=await request('/artists/'+data.item.id);if(!current())return;data.item={...data.item,...profile}}
       catch(error){if(!data.item.name||data.item.name==='ARTISTA'||error.status===429)throw error;rt.status('Artista: '+error.message,true)}
     }else{
       const matches=await request('/search?'+new URLSearchParams({q:data.item.name,type:'artist',limit:'10'}));if(!current())return;
       const exact=(matches?.artists?.items||[]).find(item=>item.name?.toLocaleLowerCase()===data.item.name.toLocaleLowerCase());
       if(!exact)throw Error('Artista no disponible.');data.item=exact;
     }
     if(!current())return;data.profileLoaded=true;state.item=data.item;document.title=data.item.name+' — TRANSMISSION';
   }
   if(!append){page.items=[];page.offset=0}
   const known=new Set(page.items.map(item=>item.id)),start=page.items.length,target=releases?20:30;
   // Spotify permits ten results per request. Keep requesting pages, not a fixed top-eight selection.
   for(let batch=0;batch<(releases?2:5);batch++){
     const endpoint=releases?'/artists/'+data.item.id+'/albums?'+new URLSearchParams({include_groups:state.group||'album,single,compilation',limit:'10',offset:String(page.offset)}):'/search?'+new URLSearchParams({q:'artist:"'+data.item.name.replace(/"/g,'')+'"',type:'track',limit:'10',offset:String(page.offset)});
     const response=await request(endpoint);if(!current())return;
     const result=releases?response:response?.tracks,raw=result?.items||[];
     for(const item of raw){
       const belongs=releases||item.artists?.some(artist=>artist.id===data.item.id);
       if(valid(item)&&belongs&&!known.has(item.id)){known.add(item.id);page.items.push(item)}
     }
     page.offset+=raw.length;page.total=Number(result?.total)||page.items.length;
     page.next=!!result?.next&&raw.length>0&&(releases||page.offset<1000);
     if(!page.next||page.items.length-start>=target)break;
   }
   page.loaded=true;announce(page.items.length+' '+(releases?'discos':'canciones'));
 }catch(error){if(current()){state.error=error.status===429?'Spotify está limitando las consultas. Inténtalo más tarde.':error.message;rt.status('Artista: '+error.message,true)}}
 finally{if(state.requestId===seq)state.loading=false;if(current())renderCurrent()}
}
function announce(text){const status=$('tm-catalog-announcement');if(status)status.textContent=text}
function renderCurrent(){
 const focused=content.contains(document.activeElement)?document.activeElement?.dataset.catalogFocus:null;
 content.replaceChildren();navigation();const state=view();content.setAttribute('aria-busy',String(!!state?.loading));if(!state)return;
 if(state.kind==='search')renderSearch(state);else if(state.kind==='album')renderAlbum(state);else renderArtist(state);
 if(focused)content.querySelector('[data-catalog-focus="'+focused+'"]')?.focus({preventScroll:true});
}
async function render(){
 renderCurrent();const state=view();if(!state||!rt.account)return;
 if(state.kind==='artist'){if(!artistPage(state).loaded)await loadArtist(state);return}
 if(state.loaded)return;
 if(state.kind==='search'&&state.query)await loadSearch();else if(state.kind==='album')await loadAlbum(state);
}
function openAlbum(item){if(!valid(item))return;push({kind:'album',item,tracks:[],loaded:false,loading:false,next:false,query:''})}
function openArtist(item){if(typeof item==='string')item=(rt.accountArtists||[]).find(artist=>artist.name.toLocaleLowerCase()===item.toLocaleLowerCase())||{name:item};if(!item?.name)return;push({kind:'artist',item,tracks:[],albums:[],offset:0,loaded:false,loading:false,next:false,query:''})}
function openPlaylist(item){window.TransmissionLibrary?.openDetail?.(item)}
function traverse(delta){const next=cursor+delta;if(next<0||next>=history.length)return;view().scroll=shell.scrollTop;++serial;cursor=next;view().loading=false;field.value=view().query||'';clearTimeout(timer);ui.close();void render();shell.scrollTop=view().scroll||0}
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
