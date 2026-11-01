/* app/04-grid.js — grid de quadrículas (cálculo, desenho na tela e no print). Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== GRID DE QUADRÍCULAS (padrão 400 m) =====================
   O grid é GLOBAL (calculado com as 242 ovitrampas), então a quadrícula "F12" é a mesma em qualquer mapa/agente.
   Linhas norte-sul / leste-oeste. A1 = canto noroeste (o "início" do grid); colunas em letras, linhas em números.
   Origem: automática (melhor centralização), centralizada numa ovitrampa, ou manual (lat/lon ou clique no mapa). */
const GREF=-22.55*Math.PI/180;
const M_LAT=111132.92-559.82*Math.cos(2*GREF)+1.175*Math.cos(4*GREF);
const M_LON=111412.84*Math.cos(GREF)-93.5*Math.cos(3*GREF);
const gx=lon=>lon*M_LON, gy=lat=>lat*M_LAT, glon=x=>x/M_LON, glat=y=>y/M_LAT;
pts.forEach(o=>{ o.gx=gx(o.lon); o.gy=gy(o.lat); });
const colLabel=n=>{ let t=''; n++; while(n>0){ const r=(n-1)%26; t=String.fromCharCode(65+r)+t; n=Math.floor((n-1)/26); } return t; };
let G=null;
const gradePrintOn=()=>!!(G&&$('gPrint').checked);

function melhorOffset(s){
  const avalia=(ax,ay)=>{ let t=0; for(const o of pts){ const c=Math.floor((o.gx-ax)/s), r=Math.floor((o.gy-ay)/s); t+=Math.hypot(o.gx-(ax+(c+.5)*s),o.gy-(ay+(r+.5)*s)); } return t/pts.length; };
  let b={v:Infinity,ax:0,ay:0}; const st=Math.max(10,s/40);
  for(let a=0;a<s;a+=st) for(let c=0;c<s;c+=st){ const v=avalia(a,c); if(v<b.v) b={v,ax:a,ay:c}; }
  const f=st/5, A=b.ax, B=b.ay;
  for(let a=A-st;a<=A+st;a+=f) for(let c=B-st;c<=B+st;c+=f){ const v=avalia(a,c); if(v<b.v) b={v,ax:a,ay:c}; }
  return b;
}
function celula(g,x,y){
  const c=Math.floor((x-g.x0)/g.s), r=Math.floor((g.y0-y)/g.s), dentro=c>=0&&r>=0&&c<g.cols&&r<g.rows;
  const cx=g.x0+(c+.5)*g.s, cy=g.y0-(r+.5)*g.s;
  return {c,r,dentro,code:dentro?colLabel(c)+(r+1):'—',dist:Math.hypot(x-cx,y-cy),cx,cy};
}
function gradeCalcula(){
  const s=Math.max(50,Math.min(5000,+$('gSize').value||400)), modo=$('gModo').value;
  const xs=pts.map(o=>o.gx), ys=pts.map(o=>o.gy);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  let x0,y0;
  if(modo==='manual'){
    const la=parseFloat(String($('gLat').value).replace(',','.')), lo=parseFloat(String($('gLon').value).replace(',','.'));
    if(!isFinite(la)||!isFinite(lo)||la>-22||la<-23||lo>-55||lo<-56) return {erro:'Informe a latitude e a longitude do início (canto noroeste), ou use “Marcar no mapa”.'};
    x0=gx(lo); y0=gy(la);
  }else{
    let ax,ay;
    if(modo==='centro'){ const o=byId[Math.round(+$('gCid').value)]; if(!o) return {erro:'Informe um número de ovitrampa de 1 a 242.'}; ax=o.gx-s/2; ay=o.gy-s/2; }
    else { const b=melhorOffset(s); ax=b.ax; ay=b.ay; }
    x0=ax+Math.floor((minX-ax)/s)*s; y0=ay+Math.ceil((maxY-ay)/s)*s;
  }
  const g={s,modo,x0,y0,cols:Math.max(1,Math.ceil((maxX-x0)/s)),rows:Math.max(1,Math.ceil((y0-minY)/s))};
  let soma=0,n=0,perto=0,fora=0; const cont={};
  pts.forEach(o=>{ const ci=celula(g,o.gx,o.gy); if(!ci.dentro){ fora++; return; } soma+=ci.dist; n++; if(ci.dist<=s/4) perto++; cont[ci.code]=(cont[ci.code]||0)+1; });
  g.st={media:n?soma/n:0,pct:n?100*perto/n:0,multi:Object.values(cont).filter(v=>v>1).length,fora,ocupadas:Object.keys(cont).length};
  return g;
}
function cantosCelulas(lista){
  const out=[]; if(!G) return out;
  lista.forEach(o=>{ const ci=celula(G,o.gx,o.gy); if(!ci.dentro) return;
    [[0,0],[1,0],[0,1],[1,1]].forEach(([i,j])=>out.push({lat:glat(G.y0-(ci.r+j)*G.s),lon:glon(G.x0+(ci.c+i)*G.s)})); });
  return out;
}
function gradeLinhaPopup(o){
  if(!G||!($('gOn').checked||$('gPrint').checked)) return '';
  const ci=celula(G,o.gx,o.gy);
  return ci.dentro?`<div class="pp-coord" style="margin-top:-6px">Quadrícula <b>${ci.code}</b> · a ${Math.round(ci.dist)} m do centro${ci.dist>limiteCentro()?' <b style="color:#C62828">⚠ longe do centro</b>':''}</div>`:`<div class="pp-warn">Fora do grid atual</div>`;
}

/* --- desenho na tela (Leaflet) --- */
const gridLayer=L.layerGroup(), gridDyn=L.layerGroup();
const gridCor=()=>map.hasLayer(sat)?'#ffd60a':'#1a56db';
function gradeRotulos(){
  gridDyn.clearLayers();
  if(!G||!$('gOn').checked) return;
  const z=map.getZoom(); if(z<13) return;
  const b=map.getBounds().pad(.05), s=G.s, cor=gridCor(), sat_=map.hasLayer(sat);
  const c0=Math.max(0,Math.floor((gx(b.getWest())-G.x0)/s)), c1=Math.min(G.cols-1,Math.floor((gx(b.getEast())-G.x0)/s));
  const r0=Math.max(0,Math.floor((G.y0-gy(b.getNorth()))/s)), r1=Math.min(G.rows-1,Math.floor((G.y0-gy(b.getSouth()))/s));
  if((c1-c0+1)*(r1-r0+1)>420) return;
  const sh=sat_?'-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000':'-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff,0 0 3px #fff';
  for(let c=c0;c<=c1;c++) for(let r=r0;r<=r1;r++){
    const x=G.x0+c*s, y=G.y0-r*s;
    L.marker([glat(y),glon(x)],{interactive:false,keyboard:false,icon:L.divIcon({className:'mk-wrap',iconSize:[0,0],html:`<div class="gl" style="color:${cor};text-shadow:${sh}">${colLabel(c)}${r+1}</div>`})}).addTo(gridDyn);
    if(z>=15){
      const cx=x+s/2, cy=y-s/2, a=12;
      L.polyline([[glat(cy),glon(cx-a)],[glat(cy),glon(cx+a)]],{color:cor,weight:1.8,opacity:.9,interactive:false}).addTo(gridDyn);
      L.polyline([[glat(cy-a),glon(cx)],[glat(cy+a),glon(cx)]],{color:cor,weight:1.8,opacity:.9,interactive:false}).addTo(gridDyn);
    }
  }
}
function gradeTela(){
  gridLayer.clearLayers(); gridDyn.clearLayers();
  const on=$('gOn').checked&&G;
  [gridLayer,gridDyn].forEach(l=>{ if(on&&!map.hasLayer(l)) l.addTo(map); if(!on&&map.hasLayer(l)) map.removeLayer(l); });
  if(!on) return;
  const s=G.s, cor=gridCor(), yb=G.y0-G.rows*s, xr=G.x0+G.cols*s;
  for(let c=0;c<=G.cols;c++){ const x=G.x0+c*s; L.polyline([[glat(G.y0),glon(x)],[glat(yb),glon(x)]],{color:cor,weight:(c===0||c===G.cols)?2.8:1.4,opacity:.85,interactive:false}).addTo(gridLayer); }
  for(let r=0;r<=G.rows;r++){ const y=G.y0-r*s; L.polyline([[glat(y),glon(G.x0)],[glat(y),glon(xr)]],{color:cor,weight:(r===0||r===G.rows)?2.8:1.4,opacity:.85,interactive:false}).addTo(gridLayer); }
  L.marker([glat(G.y0),glon(G.x0)],{zIndexOffset:900,icon:L.divIcon({className:'mk-wrap',iconSize:[0,0],html:'<div class="gflag">⚑ INÍCIO DO GRID · A1</div>'})})
    .bindPopup(`<b>Início do grid (A1)</b><br>Canto noroeste<br>Lat ${glat(G.y0).toFixed(6)}<br>Lon ${glon(G.x0).toFixed(6)}`).addTo(gridLayer);
  gradeRotulos();
}
function gradeAtualiza(){
  $('gCentro').style.display=$('gModo').value==='centro'?'flex':'none';
  $('gManual').style.display=$('gModo').value==='manual'?'block':'none';
  const g=gradeCalcula();
  if(g&&g.erro){ G=null; $('gInfo').textContent=g.erro; gradeTela(); return; }
  G=g;
  const st=G.st;
  $('gInfo').innerHTML=`<b>Início do grid (A1, canto noroeste):</b><br>${glat(G.y0).toFixed(6)}, ${glon(G.x0).toFixed(6)}<br>${G.cols}×${G.rows} quadrículas de ${G.s} m · colunas A–${colLabel(G.cols-1)}, linhas 1–${G.rows}<br>Ovitrampas ficam, em média, a <b>${Math.round(st.media)} m</b> do centro (${Math.round(st.pct)}% a até ${Math.round(G.s/4)} m)<br>${st.ocupadas} quadrículas com ovitrampa · ${st.multi} com 2 ou mais`+(st.fora?` · <b style="color:var(--err)">${st.fora} fora do grid</b>`:'');
  if(G.modo==='auto'||G.modo==='centro'){ $('gLat').value=glat(G.y0).toFixed(6); $('gLon').value=glon(G.x0).toFixed(6); }
  gradeTela();
}
['gOn','gPrint'].forEach(id=>$(id).addEventListener('change',()=>{ if(id==='gOn'&&$('gOn').checked&&!$('gPrint').checked) $('gPrint').checked=true; gradeAtualiza(); }));
['gSize','gModo','gCid','gLat','gLon'].forEach(id=>$(id).addEventListener('change',gradeAtualiza));
$('gPick').addEventListener('click',()=>{
  closeMenu(); toast('Toque no mapa no ponto onde o grid deve COMEÇAR (canto noroeste, A1).');
  map.getContainer().style.cursor='crosshair';
  map.once('click',e=>{
    map.getContainer().style.cursor='';
    $('gLat').value=e.latlng.lat.toFixed(6); $('gLon').value=e.latlng.lng.toFixed(6);
    $('gModo').value='manual'; $('gOn').checked=true; $('gPrint').checked=true; gradeAtualiza();
    toast('Início do grid marcado (A1).');
  });
});
map.on('moveend zoomend',gradeRotulos);
map.on('baselayerchange',gradeTela);

/* --- desenho no print (canvas) --- */
function desenhaGrade(ctx,proj,k,satelite){
  if(!G) return;
  const cor=satelite?'#ffd60a':'#1a56db', halo=satelite?'rgba(0,0,0,.85)':'rgba(255,255,255,.9)', s=G.s, yb=G.y0-G.rows*s, xr=G.x0+G.cols*s;
  const P=(x,y)=>proj(glat(y),glon(x));
  const traco=(x1,y1,x2,y2,w)=>{ const a=P(x1,y1), b=P(x2,y2);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
    ctx.strokeStyle=halo; ctx.lineWidth=w+2.6*k; ctx.stroke();
    ctx.strokeStyle=cor; ctx.lineWidth=w; ctx.stroke(); };
  ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
  for(let c=0;c<=G.cols;c++){ const x=G.x0+c*s; traco(x,G.y0,x,yb,(c===0||c===G.cols?3:1.8)*k); }
  for(let r=0;r<=G.rows;r++){ const y=G.y0-r*s; traco(G.x0,y,xr,y,(r===0||r===G.rows?3:1.8)*k); }
  const a=P(G.x0,G.y0), b=P(G.x0+s,G.y0), pw=Math.hypot(b.x-a.x,b.y-a.y);
  const W=ctx.canvas.width, H=ctx.canvas.height;
  ctx.textAlign='left'; ctx.textBaseline='top'; ctx.font=`800 ${14*k}px ${FONTE}`;
  for(let c=0;c<G.cols;c++) for(let r=0;r<G.rows;r++){
    const nw=P(G.x0+c*s,G.y0-r*s), ce=P(G.x0+(c+.5)*s,G.y0-(r+.5)*s);
    if(ce.x<-pw||ce.y<-pw||ce.x>W+pw||ce.y>H+pw) continue;
    if(pw>60*k){ const t=colLabel(c)+(r+1); ctx.lineWidth=4.5*k; ctx.strokeStyle=halo; ctx.strokeText(t,nw.x+6*k,nw.y+5*k); ctx.fillStyle=cor; ctx.fillText(t,nw.x+6*k,nw.y+5*k); }
    if(pw>100*k){ const ar=11*k; ctx.beginPath(); ctx.moveTo(ce.x-ar,ce.y); ctx.lineTo(ce.x+ar,ce.y); ctx.moveTo(ce.x,ce.y-ar); ctx.lineTo(ce.x,ce.y+ar);
      ctx.strokeStyle=halo; ctx.lineWidth=4.2*k; ctx.stroke(); ctx.strokeStyle=cor; ctx.lineWidth=2*k; ctx.stroke(); }
  }
  if(a.x>0&&a.y>0&&a.x<W&&a.y<H){
    const t='⚑ INÍCIO · A1'; ctx.font=`800 ${13*k}px ${FONTE}`; const tw=ctx.measureText(t).width;
    rr(ctx,a.x,a.y-26*k,tw+16*k,24*k,6*k); ctx.fillStyle=cor; ctx.fill(); ctx.lineWidth=2*k; ctx.strokeStyle='#fff'; ctx.stroke();
    ctx.fillStyle=satelite?'#000':'#fff'; ctx.textBaseline='middle'; ctx.fillText(t,a.x+8*k,a.y-14*k);
  }
  ctx.restore();
}
