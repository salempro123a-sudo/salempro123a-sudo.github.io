/* Existing artist links all open the same catalog page. */
(function(){
'use strict';
window.TransmissionArtist={open:item=>window.TransmissionCatalog?.openArtist(item),close:()=>{}};
})();
