/* Personal library and period views. Read-only data, requested when opened. */
(function(){
'use strict';
const rt=window.TransmissionRuntime,sp=window.TransmissionSpotify,ui=window.TransmissionTrackActions;
if(!rt||!sp||!ui)return;
const $=id=>document.getElementById(id),shell=$('tm-personal-page'),content=$('tm-personal-content');
const make=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
const stores=new Map(),periods={short_term:'4 SEMANAS',medium_term:'6 MESES',long_term:'UN AÑO APROX.'};
let active=null,account=null;
function current(){
 if(!active)return null;
 const key=account+':'+(active.kind==='discos'?'albums':active.type+':'+active.period);
 if(!stores.has(key))stores.set(key,{kind:active.kind,items:[],offset:0,next:false,total:0,loaded:false,loading:false,error:'',query:'',at:0});
 return stores.get(key);
}
function button(text,run,cls='tm-catalog-button'){const node=make('button',cls,text);node.type='button';node.onclick=run;return node}
function route(type,period){return '#/rotacion?'+new URLSearchParams({vista:type,periodo:period})}
function card(item,type,added){
 const link=make('a','tm-archive-card');
 link.href='#/'+(type==='artist'?'artista':'album')+'/'+item.id+'?'+new URLSearchParams({nombre:item.name||''});
 const cover=make('span','tm-archive-art'),image=ui.art(item);if(image)cover.style.backgroundImage='url("'+image+'")';
 cover.append(make('span','tm-archive-arrow','↗'));
 link.append(cover,make('strong','',item.name||'Sin título'),make('small','',type==='artist'?'ARTISTA':[ui.by(item),item.release_date?.slice(0,4)].filter(Boolean).join(' · ')));
 if(added&&!Number.isNaN(Date.parse(added)))link.append(make('small','tm-archive-added','GUARDADO '+new Intl.DateTimeFormat('es',{day:'numeric',month:'short',year:'numeric'}).format(new Date(added)).toUpperCase()));
 return link;
}
function results(state){
 const host=$('tm-archive-results');if(!host)return;host.replaceChildren();
 const query=state.query.trim().toLocaleLowerCase();
 const items=state.items.filter(entry=>!query||((entry.album?.name||'')+' '+ui.by(entry.album)).toLocaleLowerCase().includes(query));
 if(state.kind==='discos'){
   const grid=make('div','tm-archive-grid');items.forEach(entry=>grid.append(card(entry.album,'album',entry.added_at)));host.append(grid);
 }else if(active.type==='artists'){
   const grid=make('div','tm-archive-grid');state.items.forEach(item=>grid.append(card(item,'artist')));host.append(grid);
 }else{
   const tracks=state.items;tracks.forEach((track,index)=>host.append(ui.row(track,{tracks,index,number:index+1})));
 }
 if(!items.length&&!state.loading&&!state.error)host.append(make('p','tm-archive-empty',query?'No hay coincidencias entre los discos cargados.':state.kind==='discos'?'Todavía no hay discos guardados en tu biblioteca.':'Spotify todavía no tiene una selección disponible para este periodo.'));
 $('tm-archive-count').textContent=state.kind==='discos'?state.items.length+' DE '+state.total+' DISCOS CARGADOS':state.items.length+' '+(active.type==='artists'?'ARTISTAS':'CANCIONES');
}
function draw(){
 if(!active)return;const state=current(),albums=active.kind==='discos';content.replaceChildren();
 const head=make('header','tm-personal-heading');head.append(make('h1','',albums?'DISCOS GUARDADOS':'CANCIONES Y ARTISTAS'));content.append(head);
 const links=make('nav','tm-archive-nav');links.setAttribute('aria-label','Archivo personal');
 for(const [label,href] of [['PLAYLISTS','#/playlists'],['DISCOS','#/discos'],['ME GUSTA','#/guardadas'],['ROTACIÓN','#/rotacion']]){const link=make('a','',label);link.href=href;if((albums&&href==='#/discos')||(!albums&&href==='#/rotacion'))link.setAttribute('aria-current','page');links.append(link)}content.append(links);
 if(!rt.account){const empty=make('div','tm-page-empty');empty.append(make('p','','Conecta Spotify para abrir esta parte de tu archivo.'),button('CONECTAR SPOTIFY',()=>$('saved-trigger').click()));content.append(empty);return}
 const bar=make('div','tm-archive-toolbar');
 if(albums){
   const search=make('input','');search.type='search';search.placeholder='Filtrar estos discos';search.setAttribute('aria-label','Filtrar los discos cargados');search.value=state.query;search.oninput=()=>{state.query=search.value;results(state)};bar.append(search);
 }else{
   const tabs=make('nav','tm-archive-tabs');tabs.setAttribute('aria-label','Tipo de afinidad');
   for(const [type,label] of [['tracks','CANCIONES'],['artists','ARTISTAS']]){const link=make('a','',label);link.href=route(type,active.period);if(active.type===type)link.setAttribute('aria-current','page');tabs.append(link)}bar.append(tabs);
   const label=make('label','tm-archive-period','PERIODO'),select=make('select','');select.setAttribute('aria-label','Periodo de afinidad');
   for(const [key,name] of Object.entries(periods)){const option=make('option','',name);option.value=key;option.selected=key===active.period;select.append(option)}
   select.onchange=()=>window.TransmissionPages.navigate(route(active.type,select.value));label.append(select);bar.append(label);
 }
 content.append(bar);const summary=make('div','tm-archive-summary');summary.append(make('span','',''));summary.firstChild.id='tm-archive-count';
 if(!albums&&active.type==='tracks'&&state.items.length)summary.append(button('▶ ESCUCHAR SELECCIÓN',event=>void ui.run(event.currentTarget,()=>rt.playSequence(state.items))));
 content.append(summary);
 const host=make('div','tm-archive-results');host.id='tm-archive-results';host.setAttribute('aria-busy',String(state.loading));content.append(host);results(state);
 if(state.loading)content.append(make('p','tm-archive-feedback','Cargando tu archivo…'));
 if(state.error){const error=make('div','tm-archive-feedback');error.setAttribute('role','status');error.append(make('p','',state.error),button('REINTENTAR',()=>void load(state,false)));content.append(error)}
 if(albums&&state.next&&!state.error)content.append(button(state.loading?'CARGANDO…':'MÁS DISCOS ↓',()=>void load(state,true),'tm-catalog-more'));
}
async function load(state,append){
 if(state.loading||!rt.account)return;const owner=rt.account.id,view={...active};state.loading=true;state.error='';draw();
 try{
   const data=await sp.api(view.kind==='discos'?'/me/albums?limit=20&offset='+(append?state.offset:0):'/me/top/'+view.type+'?'+new URLSearchParams({limit:'50',time_range:view.period}));
   if(rt.account?.id!==owner)return;
   const items=(data?.items||[]).filter(item=>view.kind==='discos'?item?.album?.id:item?.id);
   if(view.kind==='discos'){
     const known=new Set((append?state.items:[]).map(item=>item.album.id));state.items=append?[...state.items]:[];
     for(const item of items)if(!known.has(item.album.id)){known.add(item.album.id);state.items.push(item)}
     state.offset=(append?state.offset:0)+(data?.items?.length||0);state.total=Number(data?.total)||state.items.length;state.next=!!data?.next&&(data?.items?.length||0)>0;
   }else state.items=items;
   state.loaded=true;state.at=Date.now();
 }catch(error){if(rt.account?.id===owner){state.error=error.status===429?'Spotify ha pausado las consultas. Vuelve a intentarlo cuando se restablezca el acceso.':'No se pudo abrir esta parte de tu archivo. Inténtalo de nuevo.';rt.status('Archivo personal: '+error.message,true)}}
 finally{state.loading=false;if(rt.account?.id===owner&&current()===state)draw()}
}
function show(view){
 if(rt.account?.id!==account){account=rt.account?.id||null;stores.clear()}
 active={...view};shell.hidden=false;draw();const state=current();
 if(rt.account&&(!state.loaded||Date.now()-state.at>300000))void load(state,false);
}
function close(){active=null;shell.hidden=true}
window.TransmissionArchive={show,close};
})();
