/* Header search: quick songs, Enter to browse the full catalog. */
(function(){
'use strict';
const sp=window.TransmissionSpotify,rt=window.TransmissionRuntime,ui=window.TransmissionTrackActions;
if(!sp||!rt||!ui)return;
const $=id=>document.getElementById(id),host=$('tm-inline-search'),field=$('tm-inline-query'),results=$('tm-inline-results'),trigger=$('search-trigger');
let timer=null,serial=0,opened=false;
function collapse(){opened=false;++serial;clearTimeout(timer);host.classList.remove('tm-search-open');trigger.setAttribute('aria-expanded','false');results.hidden=true}
function browse(){collapse();window.TransmissionCatalog?.search(field.value.trim())}
function footer(){const button=document.createElement('button');button.type='button';button.className='tm-search-all';button.textContent=field.value.trim()?'VER TODOS LOS RESULTADOS ↗':'EXPLORAR EL CATÁLOGO ↗';button.onclick=browse;results.append(button)}
function message(text){const node=document.createElement('p');node.className='tm-search-message';node.textContent=text;results.append(node)}
async function lookup(){
 if(!opened)return;const seq=++serial,query=field.value.trim();results.hidden=false;results.replaceChildren();
 if(query.length<2){footer();return}
 if(!rt.account){message('Conecta Spotify para buscar música.');footer();return}
 message('BUSCANDO…');
 try{
   const data=await sp.api('/search?'+new URLSearchParams({q:query,type:'track',limit:'10'}));
   if(seq!==serial||!opened||field.value.trim()!==query)return;
   results.replaceChildren();const tracks=(data?.tracks?.items||[]).filter(track=>track?.id&&track.type==='track');
   tracks.slice(0,5).forEach((track,index)=>results.append(ui.row(track,{tracks,index,onPlay:()=>rt.playSequence(tracks,index)})));
   if(!tracks.length)message('Sin resultados.');footer();
 }catch(error){if(seq!==serial||!opened)return;results.replaceChildren();message('No fue posible buscar. Inténtalo de nuevo.');footer();rt.status('Búsqueda: '+error.message,true)}
}
function expand(){
 if(window.TransmissionCatalog?.isOpen){window.TransmissionCatalog.search(field.value.trim());return}
 const changed=!opened;opened=true;host.classList.add('tm-search-open');trigger.setAttribute('aria-expanded','true');field.focus();if(changed)void lookup();
}
trigger.setAttribute('aria-controls','tm-inline-results');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','Buscar música');trigger.onclick=expand;
field.addEventListener('focus',expand);
field.addEventListener('input',()=>{++serial;clearTimeout(timer);if(field.value.trim().length<2)void lookup();else timer=setTimeout(()=>void lookup(),330)});
field.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();browse()}else if(event.key==='ArrowDown'){event.preventDefault();results.querySelector('button:not(:disabled)')?.focus()}});
document.addEventListener('pointerdown',event=>{if(!host.contains(event.target))collapse()});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&opened){collapse();field.blur()}
 if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.target?.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();if(window.TransmissionCatalog?.isOpen)$('tm-catalog-query').focus();else expand()}
});
window.TransmissionSearch={focus:expand,close:collapse};
})();
