/* app/12-offline.js — uso sem internet (guardar mapa no aparelho). Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== USO SEM INTERNET (guardar mapa no aparelho) ===================== */
const ESRI='https://server.arcgisonline.com/ArcGIS/rest/services/';
const URL_CAMADAS={ruas:[ESRI+'World_Street_Map/MapServer/tile/{z}/{y}/{x}'],sat:[ESRI+'World_Imagery/MapServer/tile/{z}/{y}/{x}',ESRI+'Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}']};
const lonX=(lon,z)=>Math.floor((lon+180)/360*Math.pow(2,z));
const latY=(lat,z)=>{ const r=lat*Math.PI/180; return Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*Math.pow(2,z)); };
function tilesDe(bb,zmin,zmax,modelos){
  const out=[];
  for(let z=zmin;z<=zmax;z++){
    const x0=lonX(bb.w,z), x1=lonX(bb.e,z), y0=latY(bb.n,z), y1=latY(bb.s,z);
    for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) modelos.forEach(m=>out.push(m.replace('{z}',z).replace('{x}',x).replace('{y}',y)));
  }
  return out;
}
function bboxAlvo(escopo){
  if(escopo==='cidade'){ const la=pts.map(o=>o.lat), lo=pts.map(o=>o.lon); return {n:Math.max(...la)+.004,s:Math.min(...la)-.004,w:Math.min(...lo)-.004,e:Math.max(...lo)+.004}; }
  if(sel.size){ const l=selList(), la=l.map(o=>o.lat), lo=l.map(o=>o.lon); return {n:Math.max(...la)+.006,s:Math.min(...la)-.006,w:Math.min(...lo)-.006,e:Math.max(...lo)+.006}; }
  const b=map.getBounds(); return {n:b.getNorth(),s:b.getSouth(),w:b.getWest(),e:b.getEast()};
}
function modelosDe(camada){ return camada==='ruas'?URL_CAMADAS.ruas:camada==='sat'?URL_CAMADAS.sat:URL_CAMADAS.ruas.concat(URL_CAMADAS.sat); }
async function atualizaOffStatus(){
  try{ const n=await TileDB.count(); $('offStatus').textContent=n?`${n} imagens do mapa guardadas neste aparelho (≈ ${Math.round(n*20/1024)} MB). Sem internet, o mapa usa elas.`:'Nenhuma imagem do mapa guardada ainda. Tudo que você vê com internet fica guardado automaticamente.'; }
  catch(e){ $('offStatus').textContent='Este navegador não permite guardar o mapa (armazenamento bloqueado).'; }
}
let offCancel=false, offRodando=false;
async function guardaMapa(){
  if(offRodando){ offCancel=true; return; }
  const escopo=$('offEscopo').value, camada=$('offCamada').value;
  const zmin=escopo==='cidade'?12:14, zmax=escopo==='cidade'?16:18;
  const todos=tilesDe(bboxAlvo(escopo),zmin,zmax,modelosDe(camada));
  if(todos.length>4000){ toast(`São ${todos.length} imagens — escolha uma área menor (selecione um agente).`); return; }
  if(todos.length>1500&&!confirm(`Serão ${todos.length} imagens (≈ ${Math.round(todos.length*22/1024)} MB). Continuar?`)) return;
  offRodando=true; offCancel=false; $('offBaixar').textContent='Cancelar'; $('offBarW').style.display='block';
  try{ if(navigator.storage&&navigator.storage.persist) navigator.storage.persist(); }catch(e){}
  let feitos=0, falhas=0, jaTinha=0, i=0;
  const trabalha=async()=>{ while(i<todos.length&&!offCancel){ const u=todos[i++];
    try{ if(await TileDB.has(u)) jaTinha++; else await tileBlob(u); }catch(e){ falhas++; }
    feitos++; if(feitos%8===0||feitos===todos.length){ $('offBar').style.width=Math.round(feitos/todos.length*100)+'%'; $('offProg').textContent=`${feitos} de ${todos.length} imagens…`; } } };
  await Promise.all(Array.from({length:6},trabalha));
  offRodando=false; $('offBaixar').textContent='Guardar mapa no aparelho'; $('offBarW').style.display='none';
  $('offProg').textContent=(offCancel?'Cancelado. ':'Concluído. ')+`${feitos-falhas-jaTinha} novas, ${jaTinha} já estavam guardadas`+(falhas?`, ${falhas} falharam (sem internet ou bloqueio).`:'.');
  atualizaOffStatus();
}
$('offBaixar').addEventListener('click',guardaMapa);
$('offLimpar').addEventListener('click',async()=>{ if(!confirm('Apagar o mapa guardado neste aparelho?')) return; try{ await TileDB.clear(); }catch(e){} atualizaOffStatus(); toast('Mapa guardado apagado.'); });
window.addEventListener('offline',()=>toast('Sem internet: usando o mapa guardado neste aparelho.'));
window.addEventListener('online',()=>toast('Internet de volta.'));
/* o print (MapLibre) também lê do mesmo cache */
let protoOk=false;
function registraProtocolo(){
  if(protoOk||!window.maplibregl) return; protoOk=true;
  maplibregl.addProtocol('esri',async params=>{ const u='https://'+params.url.slice('esri://'.length); const r=await tileBlob(u); return {data:r.buf}; });
}
