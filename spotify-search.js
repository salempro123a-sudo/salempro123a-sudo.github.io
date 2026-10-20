/* One search destination, shared by the header and keyboard. */
(function(){
'use strict';
const field=document.getElementById('tm-catalog-query'),trigger=document.getElementById('search-trigger');
if(!field||!trigger)return;
function focus(){
 const page=window.TransmissionPages?.current;
 if(!window.TransmissionCatalog?.isOpen||page?.kind!=='search'||page.entry!=='search'||page.query)window.TransmissionCatalog?.openSearch();
 requestAnimationFrame(()=>field.focus({preventScroll:true}));
}
trigger.onclick=focus;
document.addEventListener('keydown',event=>{
 if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target?.closest?.('input,textarea,select,[contenteditable="true"]')){event.preventDefault();focus()}
});
window.TransmissionSearch={focus,close:()=>{}};
})();
