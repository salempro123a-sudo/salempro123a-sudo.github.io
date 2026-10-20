/* TRANSMISSION · Shared selection memory. No authorization or network requests. */
(function(){
'use strict';
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const valid=track=>track&&/^[A-Za-z0-9]{22}$/.test(track.id)&&track.name&&track.type!=='episode'&&track.is_playable!==false&&!track.is_local;
const mainArtist=track=>normalize(track.artists?.[0]?.name||track.artist||'');
const album=track=>track.album?.images?.[0]?.url||track.album?.id||'';
function key(track){
 if(!track)return '';
 // Compilation/relinked copies and remasters of the same song share a display identity.
 // Live recordings, remixes and other named versions retain their distinct titles.
 const name=normalize(String(track.name||'').replace(/\s*[-–(\[]\s*(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?[^)\]]*[)\]]?\s*$/i,''));
 const identity=mainArtist(track)+'|'+name;
 if(!name||!mainArtist(track))return track.linked_from?.id||track.id||'';
 let hash=2166136261;
 for(let i=0;i<identity.length;i++){hash^=identity.charCodeAt(i);hash=Math.imul(hash,16777619)}
 return 'song-'+(hash>>>0).toString(36);
}
function unique(tracks){
 const seen=new Set(),result=[];
 for(const track of tracks||[]){
  const id=key(track);
  if(!valid(track)||!id||seen.has(id))continue;
  seen.add(id);result.push(track);
 }
 return result;
}
let storageKey='',state=null,shown=new Map(),sources=new Map(),recent=[],currentHome=null;
function start(accountId){
 const next='tm_selection_v1:'+String(accountId||'public');
 if(storageKey===next)return;
 storageKey=next;sources=new Map();recent=[];currentHome=null;
 let saved=null;
 try{saved=JSON.parse(localStorage.getItem(storageKey)||'null')}catch{}
 state={tick:Number.isSafeInteger(saved?.tick)&&saved.tick>=0?saved.tick:0,heroes:Array.isArray(saved?.heroes)?saved.heroes.filter(x=>typeof x==='string').slice(-30):[],cursors:{}};
 if(saved?.cursors&&typeof saved.cursors==='object'){
  for(const [name,value] of Object.entries(saved.cursors))if(Number.isSafeInteger(value)&&value>=0)state.cursors[name]=value;
 }
 shown=new Map((Array.isArray(saved?.shown)?saved.shown:[]).filter(row=>Array.isArray(row)&&typeof row[0]==='string'&&Number.isFinite(row[1])).slice(-800));
}
function persist(){
 try{localStorage.setItem(storageKey,JSON.stringify({...state,shown:[...shown].sort((a,b)=>a[1]-b[1]).slice(-800)}))}catch{}
}
function advance(name,count){
 if(!state)start();
 const size=Math.max(1,Math.floor(Number(count)||1)),value=(state.cursors[name]||0)%size;
 state.cursors[name]=(value+1)%size;persist();return value;
}
function remember(tracks,options={}){
 if(!state)start();
 const songs=unique(tracks);if(!songs.length)return;
 state.tick++;
 for(const track of songs)shown.set(key(track),state.tick);
 if(options.hero){
  const id=key(songs[0]);state.heroes=[...state.heroes.filter(x=>x!==id),id].slice(-30);
 }
 if(shown.size>800)shown=new Map([...shown].sort((a,b)=>a[1]-b[1]).slice(-800));
 persist();
}
function setSource(name,tracks){if(!state)start();sources.set(name,unique(tracks).slice(0,300))}
function pool(){return unique([...sources.values()].flat())}
function compare(a,b){for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]-b[i]}return 0}
function choose(tracks,options={}){
 if(!state)start();
 const avoid=new Set((options.avoid||[]).map(key)),latest=new Set(recent.slice(0,12).map(key));
 const heroHistory=new Set(state.heroes.slice(-12));
 const previous=new Set(options.fresh===false?[]:[...(currentHome?.heroes||[]),...(currentHome?.cards||[])].map(key));
 const candidates=unique(tracks).map(track=>({track,id:key(track),artist:mainArtist(track),record:album(track),tie:Math.random()}));
 const counts=new Map(),albumCounts=new Map(),sourceCounts=new Map(),picked=[],context=[...(options.context||[])];
 const memberships=new Map();
 for(const [name,items] of sources){for(const track of items){const id=key(track);if(!memberships.has(id))memberships.set(id,[]);memberships.get(id).push(name)}}
 const limit=Math.min(Number(options.limit)||40,candidates.length);
 while(candidates.length&&picked.length<limit){
  const last=context.slice(-2),lastArtists=new Set(last.map(mainArtist)),lastAlbums=new Set(last.map(album));
  let best=0,bestRank=null;
  for(let i=0;i<candidates.length;i++){
   const item=candidates[i],a=item.artist,record=item.record;
   const neighbors=a&&lastArtists.has(a)?1:0;
   const repeatedAlbum=record&&lastAlbums.has(record)?1:0;
   const tags=memberships.get(item.id)||['other'];
   const used=Math.min(...tags.map(name=>sourceCounts.get(name)||0));
   const rank=[avoid.has(item.id)?1:0,options.hero&&picked.length===0&&heroHistory.has(item.id)?1:0,
    latest.has(item.id)?1:0,previous.has(item.id)?1:0,neighbors,repeatedAlbum,
    counts.get(a)||0,albumCounts.get(record)||0,shown.has(item.id)?1:0,used,shown.get(item.id)||0,item.tie];
   if(!bestRank||compare(rank,bestRank)<0){best=i;bestRank=rank}
  }
  const {track,id}=candidates.splice(best,1)[0];picked.push(track);context.push(track);
  const a=mainArtist(track);counts.set(a,(counts.get(a)||0)+1);
  const record=album(track);if(record)albumCounts.set(record,(albumCounts.get(record)||0)+1);
  // Charge every source containing a duplicate so overlapping affinity lists cannot dominate.
  for(const name of memberships.get(id)||['other'])sourceCounts.set(name,(sourceCounts.get(name)||0)+1);
 }
 return picked;
}
function compose(){
 const all=pool();
 if(!all.length)return null;
 const ordered=choose(all,{limit:60,hero:true});
 const heroCount=Math.min(6,Math.max(1,Math.floor(ordered.length/3)));
 const heroes=ordered.slice(0,heroCount),cards=ordered.slice(heroCount,heroCount+8);
 currentHome={heroes,cards,sequence:ordered};
 remember(cards);remember(heroes.slice(0,1),{hero:true});
 return currentHome;
}
window.TransmissionSelection={start,key,unique,advance,remember,choose,setSource,compose,
 setRecent:tracks=>{recent=unique(tracks)},pool,
 getSource:name=>[...(sources.get(name)||[])],
 get hasHistory(){return shown.size>0},
 get home(){return currentHome}
};
})();
