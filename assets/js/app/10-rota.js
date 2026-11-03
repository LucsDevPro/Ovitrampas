/* app/10-rota.js — rota sugerida + QR do Google Maps. Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== ROTA SUGERIDA + QR ===================== */
const rotaRelOn=()=>!!($('rotaRel')&&$('rotaRel').checked);
const rotaMapaOn=()=>!!($('rotaMapa')&&$('rotaMapa').checked);
/* menor caminho aberto entre os pontos (exato até 12 pontos; acima disso, vizinho mais próximo + 2-opt) */
function rotaOrdem(lista){
  const n=lista.length; if(n<=2) return [...lista];
  const P=lista.map(o=>[o.gx,o.gy]), D=(i,j)=>Math.hypot(P[i][0]-P[j][0],P[i][1]-P[j][1]);
  let ord;
  if(n<=12){
    const N=1<<n, INF=1e18, dp=new Float64Array(N*n).fill(INF), pr=new Int16Array(N*n).fill(-1);
    for(let i=0;i<n;i++) dp[(1<<i)*n+i]=0;
    for(let m=1;m<N;m++) for(let j=0;j<n;j++){
      const v=dp[m*n+j]; if(v>=INF||!(m&(1<<j))) continue;
      for(let k=0;k<n;k++){ if(m&(1<<k)) continue; const nm=m|(1<<k), nv=v+D(j,k); if(nv<dp[nm*n+k]){ dp[nm*n+k]=nv; pr[nm*n+k]=j; } }
    }
    let best=INF,bj=0; const full=N-1;
    for(let j=0;j<n;j++) if(dp[full*n+j]<best){ best=dp[full*n+j]; bj=j; }
    ord=[]; let m=full,j=bj; while(j!==-1){ ord.push(j); const pj=pr[m*n+j]; m^=(1<<j); j=pj; } ord.reverse();
  } else {
    let ini=0; for(let i=1;i<n;i++) if(P[i][0]-P[i][1]<P[ini][0]-P[ini][1]) ini=i;
    const usado=new Set([ini]); ord=[ini];
    while(ord.length<n){ const u=ord[ord.length-1]; let b=-1,bd=1e18; for(let i=0;i<n;i++) if(!usado.has(i)&&D(u,i)<bd){ bd=D(u,i); b=i; } usado.add(b); ord.push(b); }
    let melhorou=true, it=0;
    while(melhorou&&it++<60){ melhorou=false;
      for(let i=0;i<n-2;i++) for(let j=i+2;j<n;j++){
        const a=ord[i],b=ord[i+1],c=ord[j],d=j+1<n?ord[j+1]:null;
        const antes=D(a,b)+(d!==null?D(c,d):0), depois=D(a,c)+(d!==null?D(b,d):0);
        if(depois<antes-1e-6){ ord=ord.slice(0,i+1).concat(ord.slice(i+1,j+1).reverse(),ord.slice(j+1)); melhorou=true; }
      }
    }
  }
  const sc=i=>P[i][0]-P[i][1];                          /* começa pela ponta mais a noroeste */
  if(sc(ord[0])>sc(ord[ord.length-1])) ord.reverse();
  return ord.map(i=>lista[i]);
}
const rotaDist=ord=>ord.reduce((t,o,i)=>i?t+Math.hypot(o.gx-ord[i-1].gx,o.gy-ord[i-1].gy):0,0);
/* link do Google Maps: destino = última; paradas = as anteriores; sem origem => parte da localização do celular */
function urlRota(ordem,origem){
  const c=o=>o.latRaw+','+o.lonRaw;
  if(ordem.length===1&&!origem) return 'https://www.google.com/maps/search/?api=1&query='+c(ordem[0]);
  const dest=ordem[ordem.length-1], via=ordem.slice(0,-1);
  return 'https://www.google.com/maps/dir/?api=1&travelmode=driving'+(origem?'&origin='+c(origem):'')+'&destination='+c(dest)+(via.length?'&waypoints='+via.map(c).join('%7C'):'');
}
function desenhaQR(ctx,texto,x,y,tam){
  if(typeof qrcode!=='function') return false;
  try{
    const qr=qrcode(0,'M'); qr.addData(texto); qr.make();
    const n=qr.getModuleCount(), q=4, cel=tam/(n+2*q);
    ctx.fillStyle='#fff'; ctx.fillRect(x,y,tam,tam); ctx.fillStyle='#000';
    for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(qr.isDark(r,c)) ctx.fillRect(x+(q+c)*cel,y+(q+r)*cel,Math.ceil(cel),Math.ceil(cel));
    return true;
  }catch(e){ console.warn('QR:',e); return false; }
}
/* --- no print (canvas): linha tracejada antes dos pinos e números depois --- */
function desenhaRotaLinha(ctx,proj,k,ordem){
  if(ordem.length<2) return;
  ctx.save(); ctx.lineJoin='round'; ctx.lineCap='round';
  ctx.beginPath(); ordem.forEach((o,i)=>{ const p=proj(o.lat,o.lon); if(i) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); });
  ctx.setLineDash([14*k,9*k]); ctx.strokeStyle='rgba(255,255,255,.95)'; ctx.lineWidth=7*k; ctx.stroke();
  ctx.strokeStyle='#0A3D91'; ctx.lineWidth=3.6*k; ctx.stroke(); ctx.restore();
}
function desenhaRotaNumeros(ctx,proj,k,ordem){
  if(ordem.length<2) return;
  ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font=`800 ${13*k}px ${FONTE}`;
  ordem.forEach((o,i)=>{ const p=proj(o.lat,o.lon), x=p.x+26*k, y=p.y-34*k;
    ctx.beginPath(); ctx.arc(x,y,11.5*k,0,Math.PI*2); ctx.fillStyle='#0A3D91'; ctx.fill(); ctx.lineWidth=2.4*k; ctx.strokeStyle='#fff'; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.fillText(String(i+1),x,y+.5*k); });
  ctx.restore();
}
/* --- na tela (Leaflet) --- */
const rotaLayer=L.layerGroup().addTo(map);
function atualizaRota(){
  rotaLayer.clearLayers();
  if(!rotaMapaOn()||sel.size<2||sel.size>60) return;
  const ord=rotaOrdem(selList());
  L.polyline(ord.map(o=>[o.lat,o.lon]),{color:'#0A3D91',weight:4,opacity:.9,dashArray:'10 8',interactive:false}).addTo(rotaLayer);
  ord.forEach((o,i)=>L.marker([o.lat,o.lon],{interactive:false,keyboard:false,zIndexOffset:700,icon:L.divIcon({className:'mk-wrap',iconSize:[0,0],html:`<div class="rotanum">${i+1}</div>`})}).addTo(rotaLayer));
}
$('rotaMapa').addEventListener('change',()=>{ atualizaRota(); if($('rotaMapa').checked&&sel.size<2) toast('Selecione 2 ou mais ovitrampas (ou um agente) para ver a rota.'); });
