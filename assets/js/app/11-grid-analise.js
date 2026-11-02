/* app/11-grid-analise.js — análise do grid + exportação KML. Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== ANÁLISE DO GRID + KML ===================== */
const limiteCentro=()=>G?Math.round(G.s*0.375):150;
function analiseGrid(){
  if(!G) return null;
  const cel={}; pts.forEach(o=>{ const ci=celula(G,o.gx,o.gy); if(!ci.dentro) return; (cel[ci.code]||(cel[ci.code]={c:ci.c,r:ci.r,ids:[]})).ids.push(o.id); });
  const lim=limiteCentro();
  const multi=Object.keys(cel).filter(k=>cel[k].ids.length>1).sort((a,b)=>cel[a].c-cel[b].c||cel[a].r-cel[b].r);
  const longe=pts.map(o=>({o,ci:celula(G,o.gx,o.gy)})).filter(x=>x.ci.dentro&&x.ci.dist>lim).sort((a,b)=>b.ci.dist-a.ci.dist);
  const fora=pts.filter(o=>!celula(G,o.gx,o.gy).dentro);
  const lac=[];
  for(let c=0;c<G.cols;c++) for(let r=0;r<G.rows;r++){
    const code=colLabel(c)+(r+1); if(cel[code]) continue;
    let viz=0; for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++){ if(!dc&&!dr) continue; const cc=c+dc, rr_=r+dr; if(cc<0||rr_<0) continue; if(cel[colLabel(cc)+(rr_+1)]) viz++; }
    if(viz>=4) lac.push({c,r,code,viz});
  }
  return {cel,multi,longe,fora,lac,lim};
}
let lacLayer=L.layerGroup();
function celaLatLngs(c,r){ const x0=G.x0+c*G.s, y0=G.y0-r*G.s; return [[glat(y0),glon(x0)],[glat(y0-G.s),glon(x0+G.s)]]; }
function desenhaLacunas(){
  lacLayer.clearLayers();
  if(!$('gdLac').checked||!G){ if(map.hasLayer(lacLayer)) map.removeLayer(lacLayer); return; }
  const a=analiseGrid(); a.lac.forEach(l=>L.rectangle(celaLatLngs(l.c,l.r),{color:'#d9480f',weight:1.5,dashArray:'5 5',fillColor:'#ff922b',fillOpacity:.22,interactive:false}).addTo(lacLayer));
  if(!map.hasLayer(lacLayer)) lacLayer.addTo(map);
}
function abreAnaliseGrid(){
  if(!G){ toast('Defina o início do grid primeiro (Camadas do mapa › Grid).'); return; }
  const a=analiseGrid(), n=Object.keys(a.cel).length;
  let h=`<p class="hint">Grade de ${G.s} m · ${G.cols}×${G.rows} quadrículas · ${n} com ovitrampa. “Longe do centro” = mais de ${a.lim} m (3/8 do lado da quadrícula).</p>`;
  h+=`<div class="tabv"><h3>Quadrículas com 2 ou mais ovitrampas (${a.multi.length})</h3>${a.multi.length?a.multi.map(k=>`<span class="cellb" data-cel="${a.cel[k].c},${a.cel[k].r}" title="Ovitrampas ${a.cel[k].ids.join(', ')}">${k}: ${a.cel[k].ids.join(', ')}</span>`).join(''):'<p class="hint">Nenhuma.</p>'}</div>`;
  h+=`<div class="tabv"><h3>Ovitrampas longe do centro da quadrícula (${a.longe.length})</h3>${a.longe.length?`<div class="tw" style="max-height:30vh"><table><thead><tr><th>ID ovitrampa</th><th>Endereço</th><th>Quadrícula</th><th>Distância</th></tr></thead><tbody>${a.longe.map(x=>`<tr><td><button class="idb" type="button" data-id="${x.o.id}">${x.o.id}</button></td><td>${esc(x.o.endereco)}</td><td>${x.ci.code}</td><td><b>${Math.round(x.ci.dist)} m</b></td></tr>`).join('')}</tbody></table></div>`:'<p class="hint">Todas dentro do limite.</p>'}</div>`;
  h+=`<div class="tabv"><h3>Lacunas: quadrículas sem ovitrampa cercadas por outras (${a.lac.length})</h3>${a.lac.length?a.lac.map(l=>`<span class="cellb" data-cel="${l.c},${l.r}">${l.code}</span>`).join(''):'<p class="hint">Nenhuma lacuna interna.</p>'}<p class="hint">Considera lacuna a quadrícula vazia com 4 ou mais vizinhas ocupadas. Ligue “Destacar lacunas” para vê-las no mapa.</p></div>`;
  if(a.fora.length) h+=`<div class="tabv"><h3>Fora do grid (${a.fora.length})</h3><p>${a.fora.map(o=>o.id).join(', ')}</p></div>`;
  $('gdBody').innerHTML=h; $('gdLac').checked=map.hasLayer(lacLayer); $('gridDlg').style.display='flex'; closeMenu();
}
$('gAnalise').addEventListener('click',abreAnaliseGrid);
$('gdFechar').addEventListener('click',()=>{ $('gridDlg').style.display='none'; });
$('gdLac').addEventListener('change',desenhaLacunas);
$('gdBody').addEventListener('click',e=>{
  const ce=e.target.closest('[data-cel]'), b=e.target.closest('button[data-id]');
  if(ce){ const [c,r]=ce.dataset.cel.split(',').map(Number); $('gridDlg').style.display='none'; if(!$('gOn').checked){ $('gOn').checked=true; if(!$('gPrint').checked) $('gPrint').checked=true; gradeAtualiza(); } map.fitBounds(celaLatLngs(c,r),{padding:[40,40],maxZoom:17}); }
  else if(b){ const id=+b.dataset.id; $('gridDlg').style.display='none'; selecionaIds([id]); setTimeout(()=>byId[id].marker.openPopup(),400); }
});
function exportaKML(){
  if(!G){ toast('Defina o início do grid primeiro.'); return; }
  const a=analiseGrid(), ocup=new Set(Object.keys(a.cel)), x=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const kc=hex=>'ff'+hex.slice(5,7)+hex.slice(3,5)+hex.slice(1,3);      /* #RRGGBB -> aaBBGGRR */
  let k='<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Ovitrampas — Ponta Porã</name>\n';
  k+='<Style id="grade"><LineStyle><color>ff91510f</color><width>1.5</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>\n';
  FAIXAS_OVOS.forEach(([t,c],i)=>{ k+=`<Style id="f${i}"><IconStyle><color>${kc(c)}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle><LabelStyle><scale>0.8</scale></LabelStyle></Style>\n`; });
  k+='<Folder><name>Grid '+G.s+' m</name>\n';
  for(let c=0;c<G.cols;c++) for(let r=0;r<G.rows;r++){
    let perto=false; for(let dc=-1;dc<=1&&!perto;dc++) for(let dr=-1;dr<=1;dr++){ const cc=c+dc, rr_=r+dr; if(cc>=0&&rr_>=0&&ocup.has(colLabel(cc)+(rr_+1))){ perto=true; break; } }
    if(!perto) continue;
    const x0=G.x0+c*G.s, y0=G.y0-r*G.s, pt=[[x0,y0],[x0+G.s,y0],[x0+G.s,y0-G.s],[x0,y0-G.s],[x0,y0]].map(([px,py])=>glon(px).toFixed(7)+','+glat(py).toFixed(7)+',0').join(' ');
    k+=`<Placemark><name>${colLabel(c)+(r+1)}</name><styleUrl>#grade</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${pt}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>\n`;
  }
  k+='</Folder>\n<Folder><name>Ovitrampas</name>\n';
  pts.forEach(o=>{ const ag=AG_POR_ID[o.id], ci=celula(G,o.gx,o.gy);
    const desc=`${x(o.endereco)}<br/>Ovos: ${o.ovos===null?'sem contagem':o.ovos}<br/>Agente: ${x(ag?nomeAg(ag):'—')} · ${x(ag?eqTxt(ag):'')}<br/>Quadrícula: ${ci.dentro?ci.code+' ('+Math.round(ci.dist)+' m do centro)':'fora do grid'}`;
    k+=`<Placemark><name>${o.id}</name><description><![CDATA[${desc}]]></description><styleUrl>#f${bandaOvos(o.ovos)}</styleUrl><Point><coordinates>${o.lonRaw},${o.latRaw},0</coordinates></Point></Placemark>\n`; });
  k+='</Folder></Document></kml>';
  baixar('ovitrampas-grid.kml',k,'application/vnd.google-earth.kml+xml');
}
$('gKml').addEventListener('click',exportaKML);
$('gdKml').addEventListener('click',exportaKML);
