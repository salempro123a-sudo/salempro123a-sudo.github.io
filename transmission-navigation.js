/* Pages share one listening session. URLs and browser history belong to navigation. */
(function(){
'use strict';
const rt=window.TransmissionRuntime;if(!rt)return;
const $=id=>document.getElementById(id),catalog=window.TransmissionCatalog,library=window.TransmissionLibrary;
const snapshots=new Map(),scrolls=new Map();
let current=null,activeHash=null,position=0,lastIndex=0,renderId=0,accountId=rt.account?.id||null,ready=rt.ready;
const valid=id=>/^[A-Za-z0-9]{22}$/.test(id||'');
const filters=['track','artist','album','playlist'];
function parse(hash){
 const [path,query='']=String(hash||'').replace(/^#/,'').split('?'),params=new URLSearchParams(query),parts=path.split('/').filter(Boolean);
 if(!path.startsWith('/'))return null;
 const kind=parts[0];
 if(kind==='explorar')return {kind:'search',query:'',filter:'track',title:'EXPLORAR'};
 if(kind==='buscar')return {kind:'search',query:(params.get('q')||'').slice(0,200),filter:filters.includes(params.get('tipo'))?params.get('tipo'):'track',title:'BÚSQUEDA'};
 if(['artista','album','playlist'].includes(kind)&&valid(parts[1]))return {kind:kind==='artista'?'artist':kind,id:parts[1],name:(params.get('nombre')||'').slice(0,200),title:kind==='artista'?'ARTISTA':kind==='album'?'ÁLBUM':'PLAYLIST'};
 if(kind==='rotacion')return {kind,title:'EN ROTACIÓN',period:['short_term','medium_term','long_term'].includes(params.get('periodo'))?params.get('periodo'):'short_term',type:params.get('vista')==='artists'?'artists':'tracks'};
 const names={playlists:'MIS LISTAS',guardadas:'ME GUSTA',escuchando:'ESCUCHANDO',historial:'ÚLTIMAS ESCUCHAS',discos:'DISCOS GUARDADOS',atajos:'GUÍA Y ATAJOS'};
 if(names[kind])return {kind,title:names[kind]};
 return {kind:'missing',title:'PÁGINA NO ENCONTRADA'};
}
function catalogURL(state){
 if(state.kind==='search')return state.query?'#/buscar?'+new URLSearchParams({q:state.query,tipo:state.filter||'track'}):'#/explorar';
 return '#/'+(state.kind==='artist'?'artista':'album')+'/'+state.item.id+'?'+new URLSearchParams({nombre:state.item.name||''});
}
function rememberState(hash,state){snapshots.set(hash,state);if(snapshots.size>30)snapshots.delete(snapshots.keys().next().value)}
function updateNavigation(){
 for(const link of document.querySelectorAll('#main-nav a,#tm-page-links a')){
   const href=link.getAttribute('href'),match=href===activeHash||(href==='#/explorar'&&['search','artist','album'].includes(current?.kind))||(href==='#/playlists'&&current?.kind==='playlist')||(href==='#/rotacion'&&current?.kind==='rotacion');
   link.classList.toggle('is-current',!!match);if(match)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 }
 catalog?.syncNavigation?.();
}
function closeViews(){
 catalog?.close({routed:true});library?.close({routed:true});window.TransmissionTaste?.closeLikedAll({routed:true});
 window.TransmissionListening?.close();window.TransmissionArtist?.close();window.TransmissionSearch?.close();window.TransmissionTrackActions?.close();
 window.TransmissionArchive?.close();
 $('tm-options').hidden=true;$('tm-more').setAttribute('aria-expanded','false');
}
async function render(hash,restoring=false){
 const request=++renderId;
 activeHash=hash;current=parse(hash);
 closeViews();
 document.body.classList.toggle('tm-page-open',!!current);
 $('main').hidden=!!current;document.querySelector('.footer').hidden=!!current;
 $('tm-page-masthead').hidden=!current;
 $('tm-page-label').textContent=current?.title||'';
 $('main-nav').classList.remove('is-open');$('menu-toggle').setAttribute('aria-expanded','false');
 if(current){
   document.title=(current.name||current.query||current.title)+' — TRANSMISSION';
   if(['search','artist','album'].includes(current.kind)){
     let state=snapshots.get(hash);
     if(!state){
       state=current.kind==='search'?{kind:'search',query:current.query,filter:current.filter,items:[],offset:0,next:false,total:0,loaded:false,loading:false}:{kind:current.kind,item:{id:current.id,name:current.name||current.title},tracks:[],albums:[],offset:0,loaded:false,loading:false,next:false,query:''};
       rememberState(hash,state);
     }
     catalog?.showState(state);
   }else if(current.kind==='playlists')library?.open({routed:true});
   else if(current.kind==='playlist'){
     const item=snapshots.get(hash)?.item||(rt.playlists||[]).find(item=>item.id===current.id)||{id:current.id,name:current.name||'Playlist'};
     await library?.openDetail(item,{routed:true});
   }else if(current.kind==='guardadas')void window.TransmissionTaste?.openLikedAll({routed:true});
   else if(['discos','rotacion'].includes(current.kind))window.TransmissionArchive?.show(current);
   else window.TransmissionListening?.show(current.kind);
 }else document.title='TRANSMISSION — Personal music archive';
 if(request!==renderId)return;
 updateNavigation();window.TransmissionUI?.syncViews?.();
 requestAnimationFrame(()=>{
   if(request!==renderId)return;
   const target=!current&&hash&&hash!=='#'?document.getElementById(hash.slice(1)):null;
   if(target)target.scrollIntoView({behavior:'instant'});
   else window.scrollTo({top:restoring?scrolls.get(hash)||0:0,behavior:'instant'});
   if(!restoring&&current)$('tm-page-label').focus({preventScroll:true});
 });
}
function navigate(hash,options={}){
 if(hash===activeHash){if(options.state)rememberState(hash,options.state);return}
 if(activeHash!==null)scrolls.set(activeHash,window.scrollY);
 if(options.state)rememberState(hash,options.state);
 if(!options.replace){position++;lastIndex=position}
 window.history[options.replace?'replaceState':'pushState']({...(window.history.state||{}),tmPageIndex:position},'',hash);
 void render(hash);
}
function historyChanged(){
 if(location.hash===activeHash)return;
 if(activeHash!==null)scrolls.set(activeHash,window.scrollY);
 const index=window.history.state?.tmPageIndex;
 position=Number.isInteger(index)?index:position+1;lastIndex=Math.max(lastIndex,position);
 if(!Number.isInteger(index))window.history.replaceState({...window.history.state,tmPageIndex:position},'',location.href);
 void render(location.hash,true);
}
function accountChanged(){
 const next=rt.account?.id||null,isReady=rt.ready;
 if(next===accountId&&isReady===ready)return;
 const accountChanged=next!==accountId;accountId=next;ready=isReady;
 if(accountChanged)snapshots.clear();
 if(current&&(!accountChanged||next))void render(activeHash,true);
}
document.addEventListener('click',event=>{
 const link=event.target.closest?.('a[href^="#"]');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const hash=link.getAttribute('href');
 if(link.classList.contains('skip-link')&&current){event.preventDefault();event.stopImmediatePropagation();const main=document.querySelector('[role="main"]:not([hidden])');if(main){main.tabIndex=-1;main.focus();main.scrollIntoView({behavior:'instant'})}return}
 if(!hash.startsWith('#/')&&!current)return;
 event.preventDefault();event.stopImmediatePropagation();navigate(hash);
},true);
window.addEventListener('popstate',historyChanged);window.addEventListener('hashchange',historyChanged);
window.addEventListener('tm:account-track',accountChanged);document.addEventListener('tm:library-changed',accountChanged);
window.TransmissionPages={
 navigate,home:()=>navigate('#top'),back:()=>position>0?window.history.back():navigate('#top'),forward:()=>{if(position<lastIndex)window.history.forward()},
 catalog:state=>{
   if(state.kind==='artist'&&!valid(state.item?.id)){
     const found=(rt.accountArtists||[]).find(artist=>artist.name?.toLocaleLowerCase()===state.item?.name?.toLocaleLowerCase());
     if(found)state.item=found;else return navigate('#/buscar?'+new URLSearchParams({q:state.item.name,tipo:'artist'}));
   }
   if(state.kind!=='search'&&!valid(state.item?.id))return;
   navigate(catalogURL(state),{state});
 },
 library:()=>navigate('#/playlists'),playlist:item=>{if(valid(item?.id))navigate('#/playlist/'+item.id+'?'+new URLSearchParams({nombre:item.name||'Playlist'}),{state:{item}})},
 liked:()=>navigate('#/guardadas'),accountChanged,
 get isCatalog(){return ['search','artist','album'].includes(current?.kind)},get isLibrary(){return ['playlists','playlist'].includes(current?.kind)},get isLiked(){return current?.kind==='guardadas'},
 get canBack(){return position>0},get canForward(){return position<lastIndex},get current(){return current}
};
window.history.scrollRestoration='manual';
window.history.replaceState({...window.history.state,tmPageIndex:0},'',location.href);
void render(location.hash);
})();
