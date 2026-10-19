/* TRANSMISSION — artist drill-down, not an external redirect. */
(function(){
'use strict';
const sp=window.TransmissionSpotify,rt=window.TransmissionRuntime;
if(!sp||!rt)return;
const $=id=>document.getElementById(id);
const modal=$('tm-artist-modal'),songs=$('tm-artist-songs');
if(!modal||!songs)return;
let activeName='',activeRequest=0,focusBefore=null;
const img=url=>typeof url==='string'&&url.startsWith('https://i.scdn.co/')?url:'';
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
function close(){
 ++activeRequest;
 modal.hidden=true;
 focusBefore?.focus?.();
}
async function open(name){
 if(!name||typeof name!=='string')return;
 if(window.TransmissionCatalog)return window.TransmissionCatalog.openArtist(name);
 focusBefore=document.activeElement;
 activeName=name;
 const seq=++activeRequest;
 modal.hidden=false;
 $('tm-artist-title').textContent=name.toUpperCase();
 songs.replaceChildren(make('p','tm-playlist-message','Buscando canciones…'));
 $('tm-artist-external').href='https://open.spotify.com/search/'+encodeURIComponent(name);
 if(!rt.account){
   songs.replaceChildren(make('p','tm-playlist-message','Conecta Spotify para explorar sus canciones aquí.'));
   return
 }
 try{
   const query=new URLSearchParams({q:'artist:"'+name.replace(/"/g,'')+'"',type:'track',limit:'10'});
   const response=await sp.api('/search?'+query);
   if(seq!==activeRequest)return;
   const tracks=(response?.tracks?.items||[]).filter(t=>t?.id&&t.artists?.some(a=>a.name?.toLocaleLowerCase()===name.toLocaleLowerCase()));
   const artist=tracks.flatMap(t=>t.artists).find(a=>a.name?.toLocaleLowerCase()===name.toLocaleLowerCase());
   if(artist?.id)$('tm-artist-external').href='https://open.spotify.com/artist/'+artist.id;
   songs.replaceChildren();
   for(const [index,track] of tracks.entries()){
     const btn=make('button','tm-artist-row');btn.type='button';
     const cover=make('span','tm-artist-row-cover');const coverURL=img(track.album?.images?.[0]?.url);
     if(coverURL)cover.style.backgroundImage='url("'+coverURL+'")';
     const label=make('span','tm-artist-row-name',track.name);
     label.append(make('small','',track.album?.name||name));
     btn.append(cover,label,make('span','tm-artist-row-action','▶'));
     btn.onclick=()=>{close();rt.player?.activateElement?.();void rt.playSequence(tracks,index)};
     songs.append(btn);
   }
   if(!tracks.length)songs.append(make('p','tm-playlist-message','Spotify no devolvió canciones para este artista.'));
 }catch(e){
   if(seq!==activeRequest)return;
   songs.replaceChildren(make('p','tm-playlist-message','No se pudo consultar el catálogo en este momento.'));
   rt.status('Artista: '+e.message,true);
 }
}
$('tm-artist-close').onclick=close;
modal.addEventListener('click',e=>{if(e.target===modal)close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)close()});
window.TransmissionArtist={open,close};
})();
