/* app/02-mapa.js — mapa: cache de mapa no aparelho, mapa Leaflet, filtros, pesquisa, menu móvel. Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== MAPA GUARDADO NO APARELHO (cache de imagens do mapa) =====================
   Toda imagem de mapa que você vê é guardada (IndexedDB); sem internet, o mapa usa o que está guardado. */
const TileDB=(()=>{
  let dbp=null;
  const abre=()=>dbp||(dbp=new Promise((res,rej)=>{
    try{ const r=indexedDB.open('ovitrampas-tiles',1); r.onupgradeneeded=()=>r.result.createObjectStore('t'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }
    catch(e){ rej(e); }
  }));
  const tx=(modo,fn)=>abre().then(db=>new Promise((res,rej)=>{
    const t=db.transaction('t',modo), st=t.objectStore('t'); let rq; try{ rq=fn(st); }catch(e){ rej(e); return; }
    t.oncomplete=()=>res(rq&&rq.result); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error);
  }));
  return {get:k=>tx('readonly',s=>s.get(k)), put:(k,v)=>tx('readwrite',s=>s.put(v,k)), has:k=>tx('readonly',s=>s.count(k)).then(n=>n>0), count:()=>tx('readonly',s=>s.count()), clear:()=>tx('readwrite',s=>s.clear())};
})();
async function tileBlob(url){
  try{ const c=await TileDB.get(url); if(c&&c.buf) return c; }catch(e){}
  const r=await fetch(url,{mode:'cors'});
  if(!r.ok) throw new Error('mapa '+r.status);
  const buf=await r.arrayBuffer(), reg={buf,type:r.headers.get('content-type')||'image/png'};
  TileDB.put(url,reg).catch(()=>{});
  return reg;
}
L.TileLayer.Cache=L.TileLayer.extend({
  createTile(coords,done){
    const img=document.createElement('img'); img.alt=''; img.setAttribute('role','presentation');
    const url=this.getTileUrl(coords);
    tileBlob(url).then(({buf,type})=>{
      const u=URL.createObjectURL(new Blob([buf],{type}));
      img.onload=()=>{ URL.revokeObjectURL(u); done(null,img); };
      img.onerror=()=>{ URL.revokeObjectURL(u); done(new Error('imagem'),img); };
      img.src=u;
    }).catch(e=>{ img.crossOrigin=''; img.onload=()=>done(null,img); img.onerror=()=>done(e,img); img.src=url; });
    return img;
  }
});

/* ===================== mapa ===================== */
const map = L.map('map',{zoomControl:true, zoomSnap:0.5}).setView(CENTRO,13);
const osm = new L.TileLayer.Cache('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,crossOrigin:true,attribution:'Mapa © Esri, HERE, Garmin, OpenStreetMap contributors'});
const sat = L.layerGroup([
  new L.TileLayer.Cache('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,crossOrigin:true,attribution:'Imagens © Esri, Maxar, Earthstar Geographics'}),
  new L.TileLayer.Cache('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,crossOrigin:true,opacity:.9})
]);
osm.addTo(map);
L.control.layers({'Mapa (ruas)':osm,'Satélite':sat},null,{position:'topright',collapsed:false}).addTo(map);
L.control.scale({imperial:false}).addTo(map);
const layer = L.layerGroup().addTo(map);
const legOv=L.control({position:'bottomleft'});
legOv.onAdd=()=>{ const d=L.DomUtil.create('div','legov'); d.innerHTML=`<details ${window.innerWidth>820?'open':''}><summary>Contorno = nº de ovos</summary>${FAIXAS_OVOS.map(([t,c],i)=>`<div>${svgFaixa(i,c,18)}${t}</div>`).join('')}</details>`; L.DomEvent.disableClickPropagation(d); return d; };
$('ovOn').addEventListener('change',()=>{
  const on=ovOn(); document.body.classList.toggle('ov-on',on);
  if(on&&!$('ovPrint').checked) $('ovPrint').checked=true;
  if(on) legOv.addTo(map); else map.removeControl(legOv);
  refresh(false);
});

function zoomClass(m){
  const z=m.getZoom(), c=m.getContainer();
  c.classList.remove('z-s','z-m','z-l','z-x');
  c.classList.add(m._fixed||(z<=13?'z-s':z<=14?'z-m':z<=15?'z-l':'z-x'));
}
map.on('zoomend',()=>zoomClass(map)); zoomClass(map);

const sel = new Set();
let filter='all', field=false;

/* enquadra só os pontos informados, em zoom inteiro (nome das ruas nítido) e marcadores menores */
function fitLegivel(m,list,pad){
  m._fixed='z-m';
  const ll=list.map(o=>[o.lat,o.lon]);
  if(ll.length===1){ m.setView(ll[0],18,{animate:false}); zoomClass(m); return; }
  const b=L.latLngBounds(ll);
  let z=Math.floor(m.getBoundsZoom(b,false,L.point(pad*2,pad*2+40)));
  z=Math.max(10,Math.min(18,z));
  m.setView(b.getCenter(),z,{animate:false});
  zoomClass(m);
}
function aguardaTiles(el,ms){
  return new Promise(res=>{
    const t0=Date.now();
    (function chk(){
      const tl=[...el.querySelectorAll('.leaflet-tile')];
      const ok=tl.length&&tl.every(i=>i.classList.contains('leaflet-tile-loaded'));
      if(ok||Date.now()-t0>ms) setTimeout(res,350); else setTimeout(chk,150);
    })();
  });
}

function iconFor(o, plain){
  const c=['mk']; const isSel=!plain && sel.has(o.id);
  if(isSel) c.push('sel'); if(o.id>=100) c.push('n3');
  const bg=(!isSel && o.grupo!=null)? `--mkc:${GCOL[o.grupo%GCOL.length]}` : '';
  return L.divIcon({className:'mk-wrap',html:`<div class="${c.join(' ')}" style="${bg};--ov:${corOvos(o.ovos)}"><span class="num">${o.id}</span><svg class=\"pot\" viewBox=\"0 0 28 28\" aria-hidden=\"true\"><path d=\"M17.5 1.5l4 1.2-4.4 10.6-3.2-1z\" fill=\"#d9a15b\" stroke=\"#6b4217\" stroke-width=\"1\"/><path d=\"M5 9.5L7.3 25c.1 1 .9 1.7 1.9 1.7h9.6c1 0 1.8-.7 1.9-1.7L23 9.5z\" fill=\"#1a1a1a\" stroke=\"#fff\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><ellipse class=\"rim\" cx=\"14\" cy=\"9.5\" rx=\"9\" ry=\"3.2\" stroke=\"#fff\" stroke-width=\"1.6\"/><ellipse cx=\"14\" cy=\"9.5\" rx=\"6.4\" ry=\"2\" fill=\"#4aa8e8\"/></svg></div>`,iconSize:[0,0]});
}

function alertasDe(id){ return (VAL||[]).filter(v=>v.id===id); }
function popupHtml(o){
  const al=alertasDe(o.id).filter(v=>v.nivel!=='info');
  return `<div class="pp">
    <div class="pp-id">Ovitrampa ${o.id}</div>
    <div class="pp-addr">${esc(o.endereco)}</div>
    ${agentePopup(o)}
    <div class="pp-coord">Lat ${esc(o.latRaw)} · Lon ${esc(o.lonRaw)}</div>
    <div class="pp-coord" style="margin-top:-6px">${ovOn()?`<span style="display:inline-block;width:22px;height:12px;border-radius:6px;border:1.5px solid #111;vertical-align:-2px;background:${corOvos(o.ovos)}"></span> `:''}Ovos: <b>${o.ovos===null?'sem contagem':o.ovos}</b></div>
    ${gradeLinhaPopup(o)}
    ${cicloLinhaPopup(o)}
    ${serieLinhaPopup(o)}
    <a class="btn" target="_blank" rel="noopener" href="${linkAbrir(o)}">Abrir no Google Maps</a>
    <a class="btn nav" target="_blank" rel="noopener" href="${linkNavegar(o)}">Navegar até a ovitrampa</a>
    <button class="btn" type="button" onclick="abreCiclo(${o.id})">Registrar / histórico</button>
    <button class="btn" type="button" onclick="toggleSel(${o.id})">${sel.has(o.id)?'Remover da seleção':'Selecionar'}</button>
    ${al.length?`<div class="pp-warn">⚠ ${al.map(a=>esc(a.tipo)).join('; ')} — conferir coordenada</div>`:''}
  </div>`;
}
pts.forEach(o=>{
  o.marker=L.marker([o.lat,o.lon],{icon:iconFor(o),title:'Ovitrampa '+o.id,riseOnHover:true,keyboard:true});
  o.marker.bindPopup(()=>popupHtml(o),{maxWidth:300,autoPanPadding:[40,40]});
});

function inFilter(o){ if(filter==='all') return true; const [a,b]=filter.split('-').map(Number); return o.id>=a&&o.id<=b; }
function visibleList(){ return field ? pts.filter(o=>sel.has(o.id)) : pts.filter(inFilter); }
function fitTo(list){
  if(!list.length) return;
  if(list.length===1){ map.setView([list[0].lat,list[0].lon],17); return; }
  map.fitBounds(L.latLngBounds(list.map(o=>[o.lat,o.lon])),{padding:[60,60],maxZoom:17});
}
function refresh(fit){
  const vis=new Set(visibleList().map(o=>o.id));
  pts.forEach(o=>{ const on=layer.hasLayer(o.marker); if(vis.has(o.id)){ if(!on) layer.addLayer(o.marker);} else if(on) layer.removeLayer(o.marker); });
  $('cVis').textContent=vis.size; $('cSel').textContent=sel.size;
  $('fieldMode').checked=field;
  $('ids').value = compress(sel);
  document.querySelectorAll('#chips .chip').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.f===filter)));
  if(fit) fitTo(visibleList());
  if(window.__modulosOk){ atualizaRota(); atualizaGen(); }
}
function reicon(ids){ (ids||pts.map(o=>o.id)).forEach(id=>byId[id].marker.setIcon(iconFor(byId[id]))); }

window.toggleSel = function(id){
  if(sel.has(id)) sel.delete(id); else sel.add(id);
  reicon([id]); refresh(false);
  const m=byId[id].marker; if(m.isPopupOpen()) m.setPopupContent(popupHtml(byId[id]));
};

/* filtros */
document.querySelectorAll('#chips .chip').forEach(b=>b.addEventListener('click',()=>{
  filter=b.dataset.f; field=false; refresh(true);
}));
$('selFilter').addEventListener('click',()=>{
  const l=pts.filter(inFilter); l.forEach(o=>sel.add(o.id)); reicon(l.map(o=>o.id)); refresh(false);
  toast(`${l.length} ovitrampas adicionadas à seleção`);
});

/* mapa de campo */
$('apply').addEventListener('click',()=>{
  const {ids,bad}=parseIds($('ids').value);
  if(bad.length) toast('Não reconhecido: '+bad.join(', '));
  if(!ids.length){ if(!bad.length) toast('Digite os números das ovitrampas.'); return; }
  const old=[...sel]; sel.clear(); ids.forEach(i=>sel.add(i));
  reicon([...new Set([...old,...ids])]);
  field=true; refresh(true); closeMenu();
});
$('clear').addEventListener('click',()=>{ const old=[...sel]; sel.clear(); reicon(old); field=false; refresh(true); });
$('fieldMode').addEventListener('change',e=>{
  if(e.target.checked && !sel.size){ e.target.checked=false; toast('Selecione ao menos uma ovitrampa.'); return; }
  field=e.target.checked; refresh(true);
});

/* pesquisa */
function buscar(txt){
  const t=norm(txt.trim()); if(!t) return [];
  if(/^\d+$/.test(t)){ const n=+t; const exact=byId[n]; const rest=pts.filter(o=>o.id!==n&&String(o.id).startsWith(t)).slice(0,6); return exact?[exact,...rest]:rest; }
  return pts.filter(o=>norm(o.endereco).includes(t)).slice(0,12);
}
function irPara(o){
  if(!visibleList().includes(o)){ filter='all'; field=false; refresh(false); toast('Filtro redefinido para “Todos” para mostrar este ponto.'); }
  closeMenu(); $('sres').style.display='none';
  map.setView([o.lat,o.lon],Math.max(map.getZoom(),17));
  setTimeout(()=>o.marker.openPopup(),250);
}
$('q').addEventListener('input',e=>{
  const r=buscar(e.target.value), box=$('sres');
  if(!e.target.value.trim()){ box.style.display='none'; return; }
  box.innerHTML = r.length? r.map(o=>`<div class="srow"><button type="button" data-id="${o.id}"><b>${o.id}</b><span>${esc(o.endereco)}<small>${esc(o.latRaw)}, ${esc(o.lonRaw)}</small></span></button><button type="button" class="ssel${sel.has(o.id)?' on':''}" data-sel="${o.id}">${sel.has(o.id)?'Selecionada ✓':'Selecionar'}</button></div>`).join('') : '<div style="padding:12px;color:#587079">Nada encontrado.</div>';
  box.style.display='block';
});
$('q').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const r=buscar(e.target.value); if(r[0]) irPara(r[0]); } });
$('sres').addEventListener('click',e=>{ const s=e.target.closest('button[data-sel]'); if(s){ const id=+s.dataset.sel; toggleSel(id); const on=sel.has(id); s.classList.toggle('on',on); s.textContent=on?'Selecionada ✓':'Selecionar'; return; } const b=e.target.closest('button[data-id]'); if(b) irPara(byId[+b.dataset.id]); });
document.addEventListener('click',e=>{ if(!e.target.closest('.search')) $('sres').style.display='none'; });

/* menu móvel */
function closeMenu(){ document.body.classList.remove('menu-open'); setTimeout(()=>map.invalidateSize(),50); }
function setMenuHidden(h){
  document.body.classList.toggle('menu-hidden',h);
  try{ localStorage.setItem('menuHidden',h?'1':'0'); }catch(e){}
  setTimeout(()=>map.invalidateSize(),60); setTimeout(()=>map.invalidateSize(),280);
}
$('hideMenu').addEventListener('click',()=>setMenuHidden(true));
$('menuBtn').addEventListener('click',()=>{ document.body.classList.add('menu-open'); if(document.body.classList.contains('menu-hidden')) setMenuHidden(false); });
try{ if(localStorage.getItem('menuHidden')==='1'&&window.innerWidth>820){ document.body.classList.add('menu-hidden'); setTimeout(()=>map.invalidateSize(),100); } }catch(e){}
$('closeMenu').addEventListener('click',closeMenu);
