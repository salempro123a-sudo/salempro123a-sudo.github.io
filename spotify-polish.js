/* TRANSMISSION: animations respond to playback state, not to fabricated beats. */
(function(){
'use strict';
const rt=window.TransmissionRuntime;
if(!rt)return;
function updateArtists(){
 if(!rt.account||!window.TransmissionProfile)return;
 const profile=window.TransmissionProfile.build([
   ...(rt.recent||[]),...(rt.recentEvents||[]).map(entry=>entry.track)
 ],window.TransmissionSelection.getSource('short_term'),rt.accountArtists||[]);
 const container=document.getElementById('taste-artist-names');
 const block=document.getElementById('taste-artists');
 if(!container||!block)return;
 container.replaceChildren(...profile.artists.slice(0,6).map(({artist})=>{
   const button=document.createElement('button');button.type='button';button.textContent=artist.name;
   button.title='Explorar '+artist.name;
   button.onclick=()=>window.TransmissionArtist?.open?.(artist);
   return button
 }));
 block.hidden=!container.childElementCount;
}
window.addEventListener('tm:account-track',updateArtists);
window.addEventListener('tm:ready',updateArtists);
window.addEventListener('tm:playback',event=>{
 const p=event.detail||{};
 const playing=!!p.playing;
 document.body.classList.toggle('tm-is-playing',playing);
 const live=document.getElementById('live-label');
 if(live){
   const dot=live.querySelector('.pulse-dot');
   live.replaceChildren(document.createTextNode(playing?'SONANDO ':'ESCUCHAR '));
   if(dot)live.append(dot);
 }
 const heroStatus=document.querySelector('.hero-topline .hero-onair');
 if(heroStatus)heroStatus.hidden=!(playing&&!!rt.account);
});
})();
