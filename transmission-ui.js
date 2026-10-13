/* View composition: no Spotify requests and no credentials. */
(function(){
'use strict';
const rt=window.TransmissionRuntime;
if(!rt)return;
const $=id=>document.getElementById(id);
const safe=url=>typeof url==='string'&&/^https:\/\/(i\.scdn\.co|mosaic\.scdn\.co|image-cdn-ak\.spotifycdn\.com|seeded-session-images\.scdn\.co)\//.test(url)?url:'';
const image=item=>safe(item?.album?.images?.[0]?.url||item?.images?.[0]?.url);
function collage(id,items){
 const host=$(id);if(!host)return;
 const pictures=[...new Set((items||[]).map(image).filter(Boolean))].slice(0,4);
 const signature=pictures.join('|');
 if(host.dataset.pictures===signature)return;
 host.dataset.pictures=signature;
 host.dataset.pictureCount=String(pictures.length);
 host.replaceChildren(...pictures.map(url=>{const tile=document.createElement('span');tile.style.backgroundImage='url("'+url+'")';return tile}));
}
function refresh(){
 document.body.classList.toggle('tm-connected',!!rt.account);
 const next=rt.upcomingTrack;
 $('tm-next-song').textContent=next?.name||'MI ROTACIÓN';
 $('tm-next-artist').textContent=next?(next.artists||[]).map(a=>a.name).join(', '):'';
 $('tm-up-next').setAttribute('aria-label',next?'Siguiente: '+next.name:'Escuchar mi rotación');
 $('tm-up-next').title=next?'Reproducir la siguiente canción':'Escuchar mi rotación';
 const track=rt.currentTrack;
 const current=rt.state?.trackId;
 $('hero-kicker').textContent=current&&rt.featured?.id===current?(rt.state.playing?'ESCUCHANDO AHORA':'EN PAUSA'):'';
 $('tm-open-spotify').href=track?.id?'https://open.spotify.com/track/'+track.id:'https://open.spotify.com/';
 collage('tm-collection-art-1',rt.account?rt.accountTracks:rt.publicSnapshot?.tracks);
 collage('tm-collection-art-2',rt.playlists);
 collage('tm-collection-art-3',window.TransmissionTaste?.getLiked?.()||[]);
 collage('tm-artist-backdrop',rt.accountArtists);
 const first=rt.playlists?.find(p=>image(p));
 const head=document.querySelector('.rail-head');
 if(head)head.style.backgroundImage=first?'url("'+image(first)+'")':'';
 const count=document.querySelectorAll('#mixtapes>.rail-item').length;
 if(count){
   const columns=count<=4||window.matchMedia('(max-width:1200px)').matches?2:3;
   const headRows=count===3?3:2,rows=Math.max(headRows,Math.ceil((count+headRows)/columns));
   const rail=$('mixtapes');rail.style.setProperty('--tm-rail-columns',String(columns));
   rail.style.setProperty('--tm-head-rows',String(headRows));rail.style.setProperty('--tm-rail-rows',String(rows));
   rail.dataset.singleList=String(count===1);
 }
}
$('tm-up-next').onclick=()=>!rt.account?$('saved-trigger').click():rt.upcomingTrack?$('tm-next').click():$('tm-station-play').click();
$('tm-rail-open').onclick=()=>window.TransmissionLibrary?.open?.();
$('tm-explore-artists').onclick=()=>{
 const artists=rt.accountArtists;
 if(artists?.length){const artist=artists[Math.floor(Math.random()*artists.length)];window.TransmissionArtist?.open?.(artist.name)}
 else if(rt.account)window.TransmissionSearch?.focus?.();
 else $('saved-trigger').click();
};
$('tm-strip-volume').addEventListener('input',event=>{
 const main=$('tm-volume');main.value=event.target.value;main.dispatchEvent(new Event('input',{bubbles:true}));
});
window.addEventListener('tm:playback',()=>{const volume=rt.state?.volume;if(volume!=null)$('tm-strip-volume').value=String(volume);refresh()});
window.addEventListener('tm:track',refresh);
document.addEventListener('tm:library-changed',refresh);
window.addEventListener('resize',refresh);
document.addEventListener('keydown',event=>{
 if(event.key==='Escape')$('owner-public-export').hidden=true;
 if(event.key!=='Tab')return;
 const dialog=Array.from(document.querySelectorAll('[aria-modal="true"]')).find(element=>element.getClientRects().length);
 if(!dialog)return;
 const targets=Array.from(dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')).filter(element=>element.getClientRects().length);
 if(!targets.length)return;
 const first=targets[0],last=targets[targets.length-1];
 if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus()}
 else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus()}
});
document.querySelectorAll('#main-nav a').forEach(link=>link.addEventListener('click',()=>{$('menu-toggle').setAttribute('aria-expanded','false')}));
window.TransmissionUI={refresh};
refresh();
})();
