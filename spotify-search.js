/* TRANSMISSION / instant header search with actual Spotify catalog results. */
(function(){
'use strict';
const sp=window.TransmissionSpotify,rt=window.TransmissionRuntime;
if(!sp||!rt)return;
const $=id=>document.getElementById(id);
const host=$('tm-inline-search'),field=$('tm-inline-query'),results=$('tm-inline-results'),trigger=$('search-trigger');
if(!host||!field||!results||!trigger)return;
let debounce=null,request=0,open=false;
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
const img=u=>u?.startsWith('https://i.scdn.co/')?u:'';
function expand(){
 open=true;host.classList.add('tm-search-open');host.setAttribute('aria-expanded','true');field.focus();
 if(field.value.trim().length>=2)results.hidden=false;
}
function collapse(){
 open=false;request++;clearTimeout(debounce);host.classList.remove('tm-search-open');host.setAttribute('aria-expanded','false');results.hidden=true;
}
async function lookup(query){
 if(!open)return;
 const current=++request;
 results.replaceChildren();
 results.hidden=false;
 if(!rt.account){
   results.append(make('p','tm-search-message','Conecta Spotify para buscar en el catálogo.'));
   return
 }
 const wait=make('p','tm-search-message','BUSCANDO…');results.append(wait);
 try{
   const endpoint='/search?'+new URLSearchParams({q:query,type:'track',limit:10});
   const data=await sp.api(endpoint);
   if(!open||current!==request||field.value.trim()!==query)return;
   results.replaceChildren();
   const tracks=(data?.tracks?.items||[]).filter(t=>t?.id&&t?.type==='track');
   for(const [index,t] of tracks.entries()){
     const button=make('button','tm-search-result');button.type='button';
     const cover=make('span','tm-search-cover'),art=img(t.album?.images?.[0]?.url);
     if(art)cover.style.backgroundImage='url("'+art+'")';
     const label=make('span','tm-search-copy'),title=make('strong','',t.name||'');
     label.append(title,make('small','',(t.artists||[]).map(a=>a.name).join(', ')));
     button.append(cover,label,make('span','tm-search-play','▶'));
     button.onclick=()=>{collapse();rt.player?.activateElement?.();void rt.playSequence(tracks,index)};
     results.append(button);
   }
   if(!tracks.length)results.append(make('p','tm-search-message','Sin resultados.'));
 }catch(error){
   if(current!==request)return;
   results.replaceChildren(make('p','tm-search-message','No fue posible buscar en Spotify.'));
   rt.status('Búsqueda: '+error.message,true);
 }
}
trigger.onclick=()=>{
 if(!open)expand();else field.focus();
};
field.addEventListener('focus',expand);
field.addEventListener('input',()=>{
 clearTimeout(debounce);
 const query=field.value.trim();
 if(query.length<2){request++;results.hidden=true;results.replaceChildren();return}
 debounce=setTimeout(()=>void lookup(query),330);
});
document.addEventListener('pointerdown',e=>{if(!host.contains(e.target))collapse()});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&open){collapse();field.blur()}
 if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.target?.closest?.('input, textarea, [contenteditable="true"]')){e.preventDefault();expand()}
});
window.TransmissionSearch={focus:expand,close:collapse};
})();
