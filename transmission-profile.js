/* Recent listening profile: distinct songs, primary artists and supplied genre metadata. */
(function(){
'use strict';
const selection=window.TransmissionSelection;
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const artistKey=artist=>artist?.id||normalized(artist?.name);
const families=[
 ['CUMBIA','cumbia',/cumbia|chicha/],['SALSA','salsa',/\bsalsa\b/],
 ['REGGAETÓN','reggaeton',/reggaeton|regueton|dembow|urbano latino|latin urban/],
 ['BACHATA','bachata',/bachata/],['MERENGUE','merengue',/merengue/],
 ['REGGAE','reggae',/reggae|dub\b|ska\b|dancehall/],
 ['HIP HOP','hip-hop',/hip hop|\brap\b|\btrap\b/],
 ['JAZZ','jazz',/jazz|bebop|bop\b/],['FUNK','funk',/funk/],
 ['SOUL / R&B','soul',/\bsoul\b|\br b\b|\brnb\b|rhythm and blues/],
 ['METAL','metal',/metal|grindcore|deathcore/],['PUNK','punk',/punk|hardcore/],
 ['ROCK','rock',/rock|grunge|new wave|post grunge|shoegaze|britpop/],
 ['ELECTRÓNICA','electronic',/electro|techno|house|trance|\bedm\b|drum and bass|dubstep|breakbeat|garage|disco/],
 ['AMBIENT','ambient',/ambient|drone/],['CLÁSICA','classical',/classical|clasica|baroque|orchestra|chamber music|opera/],
 ['ANDINA','andean',/andina|andean|huayno|folklore peruano/],
 ['FOLK','folk',/folk|country|bluegrass|singer songwriter/],['POP','pop',/\bpop\b|synthpop|synth pop|k pop/],
 ['LATINA','latin',/^latin$|^latino$|^latin music$/]
];
function genreFamily(value){
 const genre=normalized(value);if(!genre)return null;
 const match=families.find(row=>row[2].test(genre));
 return match?{id:match[1],label:match[0],query:match[1]}:{id:genre,label:String(value).trim().toLocaleUpperCase(),query:String(value).trim()};
}
function build(recent=[],shortTerm=[],metadata=[]){
 const history=selection.unique(recent).slice(0,80),familiar=selection.unique(shortTerm).slice(0,50);
 const seen=new Set(history.map(selection.key));
 // A small recent history is supported by the already-loaded four-week selection.
 const support=history.length<20?familiar.filter(track=>!seen.has(selection.key(track))):[];
 const sample=[...history,...support].slice(0,80),people=new Map(),regularity=new Map();
 const profiles=new Map(metadata.filter(artist=>artist?.name).map(artist=>[artistKey(artist),artist]));
 for(const track of familiar){
  const artist=track.artists?.[0];if(!artist?.name)continue;
  const id=artistKey(artist);regularity.set(id,(regularity.get(id)||0)+1);
 }
 sample.forEach((track,index)=>{
  const primary=track.artists?.[0];if(!primary?.name)return;
  const id=artistKey(primary),known=profiles.get(id);
  if(!people.has(id))people.set(id,{artist:{...primary,...known},songs:new Set(),recentSongs:new Set(),weight:0,first:index,support:regularity.get(id)||0});
  const entry=people.get(id),song=selection.key(track);entry.songs.add(song);
  if(index<history.length){entry.recentSongs.add(song);entry.weight+=1-.4*index/Math.max(1,history.length-1)}
  else entry.weight+=.3;
 });
 const ranked=[...people.values()].sort((a,b)=>
  (b.weight+Math.min(b.support,4)*.15)-(a.weight+Math.min(a.support,4)*.15)||a.first-b.first);
 let eligible=ranked.filter(entry=>entry.songs.size>=2||entry.support>=2);
 if(!eligible.length)eligible=ranked.filter(entry=>entry.support>0);
 const artists=eligible.slice(0,8),genreScores=new Map();
 for(const entry of eligible){
  const genres=new Map();
  for(const raw of Array.isArray(entry.artist.genres)?entry.artist.genres:[]){
   if(typeof raw!=='string'||raw.length>70)continue;
   const family=genreFamily(raw);if(family)genres.set(family.id,family);
  }
  // An artist tagged with several related genres still contributes only its song weight.
  for(const genre of genres.values()){
   if(!genreScores.has(genre.id))genreScores.set(genre.id,{...genre,weight:0,songs:new Set()});
   const item=genreScores.get(genre.id);item.weight+=entry.weight/genres.size;
   for(const song of entry.songs)item.songs.add(song);
  }
 }
 const genres=[...genreScores.values()].filter(genre=>genre.songs.size>=2)
  .sort((a,b)=>b.weight-a.weight||a.label.localeCompare(b.label,'es')).slice(0,6);
 return {artists,genres,sample};
}
window.TransmissionProfile={build,artistKey};
})();
