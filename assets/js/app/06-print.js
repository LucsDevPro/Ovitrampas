/* app/06-print.js — print do mapa em PNG/PDF (MapLibre, folha final, captura de reserva). Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ================= PRINT DO MAPA (PNG / PDF) =================
   Nitidez: o mapa do print é redesenhado como VETOR (ruas e nomes em alta resolução, 3× ou 4×),
   com nomes de ruas maiores, contorno branco forte e sem rótulos de comércio. Os marcadores são
   desenhados direto no canvas (sem foto ampliada). Cada folha leva cabeçalho + lista com endereço. */
let shotCanvas=null, shotBlob=null, shotNome='ovitrampas', shotLista=[];
const nomeArq = lista => 'ovitrampas_'+compress(lista.map(o=>o.id)).replace(/[^0-9a-z-]+/gi,'_').slice(0,60);
const SUB='Ponta Porã/MS · Vigilância em Saúde / Endemias';
const COR_PADRAO='#ffc21a';
/* Logo da Prefeitura (embutido) e paleta do relatório extraída do logo */
const LOGO=new Image(); LOGO.src=SITE.raiz+'assets/img/logo.png';
const PAL={navy:'#002B68',blue:'#007ECA',green:'#00B93B',yellow:'#FFB900',red:'#FF1339'};
const textoSobre=hex=>{ const n=parseInt(hex.slice(1),16), r=n>>16, g=(n>>8)&255, b=n&255; return (0.299*r+0.587*g+0.114*b)>150?'#111':'#fff'; };
const FONTE='"Archivo","Segoe UI",system-ui,-apple-system,sans-serif';
const pad=(n,l)=>String(n).padStart(l,'0');
const toBlobP=(cv,tipo,q)=>new Promise(r=>cv.toBlob(r,tipo||'image/png',q));
const tituloLista=lista=>{ const ids=lista.map(o=>o.id); const a=AGS.find(a=>a.lista.length===ids.length&&a.lista.every((o,i)=>o.id===ids[i])); return a?rotAg(a):'Relatório de campo — Ovitrampas '+compress(ids); };
let pastaDest=null;
async function salvarNaPasta(blob,nome){
  try{ const partes=nome.split('/'); let dir=pastaDest; for(const p of partes.slice(0,-1)) dir=await dir.getDirectoryHandle(p,{create:true}); const fh=await dir.getFileHandle(partes[partes.length-1],{create:true}); const w=await fh.createWritable(); await w.write(blob); await w.close(); if(!bRodando) toast(`Salvo na pasta “${pastaDest.name}”: ${nome}`); }
  catch(e){ console.warn(e); pastaDest=null; $('pastaNome').textContent='Não foi possível gravar na pasta; usando Downloads.'; anexaBaixar(blob,nome); }
}
function anexaBaixar(blob,nome){ nome=nome.replace(/\//g,' - '); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),8000); if(!bRodando) toast(`“${nome}” foi para a pasta Downloads (Transferências) do navegador.`); }
function baixarArq(blob,nome){ if(pastaDest) salvarNaPasta(blob,nome); else anexaBaixar(blob,nome); }
$('pasta').addEventListener('click',async()=>{
  if(!window.showDirectoryPicker){ toast('Este navegador não deixa escolher pasta. Os arquivos vão para Downloads (Transferências). Use Chrome/Edge no computador para escolher.'); return; }
  try{ pastaDest=await window.showDirectoryPicker({mode:'readwrite'}); $('pastaNome').textContent='Salvando em: '+pastaDest.name; }catch(e){}
});
async function fontes(){ try{ await Promise.all(['400','600','800'].map(w=>document.fonts.load(`${w} 20px Archivo`))); }catch(e){} try{ if(!LOGO.complete) await LOGO.decode(); }catch(e){} }

/* nitidez automática (usado só no modo reserva, quando o mapa vetorial não está disponível) */
function afinar(cv,a){
  const ctx=cv.getContext('2d'), w=cv.width, h=cv.height;
  const src=ctx.getImageData(0,0,w,h), d=src.data, out=ctx.createImageData(w,h), o=out.data;
  const c=1+4*a;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const i=(y*w+x)*4;
      if(x===0||y===0||x===w-1||y===h-1){ o[i]=d[i];o[i+1]=d[i+1];o[i+2]=d[i+2];o[i+3]=d[i+3]; continue; }
      const u=i-w*4, v=i+w*4;
      for(let k=0;k<3;k++){
        let val=c*d[i+k]-a*(d[u+k]+d[v+k]+d[i-4+k]+d[i+4+k]);
        o[i+k]=val<0?0:val>255?255:val;
      }
      o[i+3]=255;
    }
  }
  ctx.putImageData(out,0,0);
}

/* ---------- mapa vetorial (MapLibre + OpenFreeMap) ---------- */
function carregaMapLibre(){ return carregaLib('maplibre'); }
const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';

/* multiplica tamanhos de texto do estilo (inclusive os que mudam com o zoom) */
function escalaExpr(v,k){
  if(typeof v==='number') return v*k;
  if(Array.isArray(v)){
    const op=v[0];
    if(op==='interpolate'||op==='interpolate-hcl'||op==='interpolate-lab') return v.map((x,i)=>(i>=4&&i%2===0)?escalaExpr(x,k):x);
    if(op==='step') return v.map((x,i)=>(i===2||(i>=4&&i%2===0))?escalaExpr(x,k):x);
    if(JSON.stringify(v).includes('"zoom"')) return v;
    return ['*',k,v];
  }
  if(v&&typeof v==='object'&&Array.isArray(v.stops)) return {...v,stops:v.stops.map(([z,val])=>[z,escalaExpr(val,k)])};
  return v;
}
function ajustaEstilo(js,satelite){
  js.layers.forEach(l=>{
    if(l.type!=='symbol') return;
    l.layout=l.layout||{}; l.paint=l.paint||{};
    if(/^poi|shield/i.test(l.id)){ l.layout.visibility='none'; return; }   /* tira comércio/ícones: sobra o nome das ruas */
    if(!l.layout['text-field']) return;
    const rua=/highway-name/i.test(l.id), k=rua?1.7:1.3;
    l.layout['text-size']=escalaExpr(l.layout['text-size']!==undefined?l.layout['text-size']:16,k);
    l.layout['text-padding']=2;
    if(rua) l.layout['symbol-spacing']=170;
    l.paint['text-halo-width']=rua?2.6:2; l.paint['text-halo-blur']=0;
    if(satelite){ l.paint['text-color']='#ffffff'; l.paint['text-halo-color']='rgba(0,0,0,.9)'; }
    else{ l.paint['text-halo-color']='#ffffff'; if(rua) l.paint['text-color']='#101820'; }
  });
  if(satelite){
    js.sources.sat={type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19};
    js.layers=[{id:'sat',type:'raster',source:'sat'}].concat(js.layers.filter(l=>l.type==='symbol'));
  }
  return js;
}
function estiloRaster(satelite){
  const E='esri://server.arcgisonline.com/ArcGIS/rest/services/';
  const src=p=>({type:'raster',tiles:[E+p+'/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19});
  if(satelite) return {version:8,sources:{a:src('World_Imagery'),b:src('Reference/World_Transportation')},layers:[{id:'a',type:'raster',source:'a'},{id:'b',type:'raster',source:'b',paint:{'raster-opacity':.9}}]};
  return {version:8,sources:{a:src('World_Street_Map')},layers:[{id:'a',type:'raster',source:'a'}]};
}
function maxPR(cw,ch,pedido){
  let lim=4096;
  try{ const c=document.createElement('canvas'), g=c.getContext('webgl2')||c.getContext('webgl');
    if(g){ lim=Math.min(g.getParameter(g.MAX_RENDERBUFFER_SIZE),g.getParameter(g.MAX_TEXTURE_SIZE),8192); const e=g.getExtension('WEBGL_lose_context'); if(e) e.loseContext(); } }catch(e){}
  return Math.max(1,Math.min(pedido,lim/Math.max(cw,ch)));
}
function esperaIdle(m,ms){
  return new Promise(res=>{
    let fim=false; const t=setTimeout(()=>f(),ms);
    function f(){ if(fim) return; fim=true; clearTimeout(t); m.off('idle',f); setTimeout(res,250); }
    m.on('idle',f); m.triggerRepaint();
  });
}
async function criaRenderer(satelite,cw,ch,PR,modo){
  await carregaMapLibre(); registraProtocolo();
  const holder=document.createElement('div');
  holder.style.cssText=`position:fixed;left:0;top:0;width:${cw}px;height:${ch}px;z-index:-1;pointer-events:none;background:#fff`;
  document.body.appendChild(holder);
  let m=null;
  try{
    let style;
    if(modo==='vetor'){ const resp=await fetch(STYLE_URL); if(!resp.ok) throw new Error('estilo '+resp.status); style=ajustaEstilo(await resp.json(),satelite); }
    else style=estiloRaster(satelite);
    m=new maplibregl.Map({container:holder,style,center:[-55.7,-22.54],zoom:14,interactive:false,attributionControl:false,
      preserveDrawingBuffer:true,pixelRatio:PR,fadeDuration:0,maxZoom:19.5});
    await new Promise((res,rej)=>{
      const t=setTimeout(()=>rej(new Error('timeout do mapa')),25000);
      m.once('load',()=>{ clearTimeout(t); res(); });
      m.on('error',e=>{ if(!m.isStyleLoaded()){ clearTimeout(t); rej((e&&e.error)||new Error('estilo')); } });
    });
  }catch(e){ try{ m&&m.remove(); }catch(_){} holder.remove(); throw e; }
  return {render:lista=>renderMapa(m,lista,cw,satelite,modo), destroy(){ try{ m.remove(); }catch(_){} holder.remove(); }};
}

/* marcador (pote + número) desenhado direto no canvas, nítido em qualquer resolução */
function rr(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function desenhaMarcador(ctx,x,y,o,s){
  const cor=(o.grupo!=null)?GCOL[o.grupo%GCOL.length]:COR_PADRAO;
  const S=34*s, sc=S/28, f=19*s, txt=String(o.id);
  ctx.save();
  /* ponto exato no chão: anel branco + miolo da cor */
  ctx.beginPath(); ctx.arc(x,y,6*s,0,Math.PI*2); ctx.fillStyle=cor; ctx.fill();
  ctx.lineWidth=2.5*s; ctx.strokeStyle='#fff'; ctx.stroke();
  ctx.lineWidth=1*s; ctx.strokeStyle='#000'; ctx.beginPath(); ctx.arc(x,y,7.8*s,0,Math.PI*2); ctx.stroke();
  ctx.shadowColor='rgba(0,0,0,.6)'; ctx.shadowBlur=5*s; ctx.shadowOffsetY=2*s;
  ctx.save(); ctx.translate(x-14*sc,y-S-2*s); ctx.scale(sc,sc); ctx.lineJoin='round';
  let p=new Path2D('M17.5 1.5l4 1.2-4.4 10.6-3.2-1z'); ctx.fillStyle='#d9a15b'; ctx.fill(p); ctx.strokeStyle='#6b4217'; ctx.lineWidth=1; ctx.stroke(p);
  p=new Path2D('M5 9.5L7.3 25c.1 1 .9 1.7 1.9 1.7h9.6c1 0 1.8-.7 1.9-1.7L23 9.5z'); ctx.fillStyle='#1a1a1a'; ctx.fill(p); ctx.strokeStyle='#fff'; ctx.lineWidth=1.8; ctx.stroke(p);
  ctx.beginPath(); ctx.ellipse(14,9.5,9,3.2,0,0,Math.PI*2); ctx.fillStyle=cor; ctx.fill(); ctx.stroke();
  ctx.shadowColor='transparent';
  ctx.beginPath(); ctx.ellipse(14,9.5,6.4,2,0,0,Math.PI*2); ctx.fillStyle='#4aa8e8'; ctx.fill();
  ctx.restore();
  ctx.font=`900 ${f}px ${FONTE}`; const tw=ctx.measureText(txt).width;
  const h=f*1.25+6*s, w=Math.max(S*1.0,tw+20*s), px=x-w/2, py=y-S-2*s+6*s-h;
  rr(ctx,px,py,w,h,h/2);
  if(ovPrintOn()){                                                                                   /* contorno = faixa de ovos (versão leve) */
    ctx.shadowColor='rgba(0,0,0,.6)'; ctx.lineWidth=8.5*s; ctx.strokeStyle='#000'; ctx.stroke();
    ctx.shadowColor='transparent'; ctx.lineWidth=6.5*s; ctx.strokeStyle=corOvos(o.ovos); ctx.stroke();
    ctx.fillStyle=cor; ctx.fill(); ctx.lineWidth=1.3*s; ctx.strokeStyle='rgba(0,0,0,.7)'; ctx.stroke();
  } else {                                                                                           /* padrão: preto + anel branco */
    ctx.shadowColor='rgba(0,0,0,.6)'; ctx.lineWidth=7*s; ctx.strokeStyle='#000'; ctx.stroke();
    ctx.shadowColor='transparent'; ctx.lineWidth=4*s; ctx.strokeStyle='#fff'; ctx.stroke();
    ctx.fillStyle=cor; ctx.fill();
  }
  ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.shadowColor='transparent';
  if(textoSobre(cor)!=='#111'){ ctx.lineWidth=3*s; ctx.lineJoin='round'; ctx.strokeStyle='rgba(0,0,0,.55)'; ctx.strokeText(txt,x,py+h/2+.5*s); }
  ctx.fillStyle=textoSobre(cor); ctx.fillText(txt,x,py+h/2+.5*s);                           /* número branco com borda escura */
  ctx.restore();
}
function desenhaPontos(ctx,P,s,rotulos){
  if(window.ESTILO_PONTOS==='ponto'){
    [...P].sort((a,b)=>(a.o.ovos||0)-(b.o.ovos||0)).forEach(({o,x,y})=>{
      ctx.beginPath(); ctx.arc(x,y,10.5*s,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,.92)'; ctx.fill();
      ctx.beginPath(); ctx.arc(x,y,8.4*s,0,Math.PI*2); ctx.fillStyle='#111'; ctx.fill();
      ctx.beginPath(); ctx.arc(x,y,6.2*s,0,Math.PI*2); ctx.fillStyle=corOvos(o.ovos); ctx.fill(); });
    return;
  }
  P=[...P].sort((a,b)=>a.y-b.y);
  const ocup=P.map(({x,y})=>[x-30*s,y-64*s,x+30*s,y+10*s]);
  P.forEach(({o,x,y})=>desenhaMarcador(ctx,x,y,o,s));
  if(!rotulos||P.length>15) return;
  const hit=r=>ocup.some(q=>r[0]<q[2]&&r[2]>q[0]&&r[1]<q[3]&&r[3]>q[1]);
  P.forEach(({o,x,y})=>{
    if(o.semEndereco||!o.endereco) return;
    ctx.save();
    const txt=ajustaTexto(ctx,o.endereco,380*s,800,17*s,12*s);
    const w=ctx.measureText(txt).width, h=17*s*1.2;
    const cand=[[x-w/2,y+12*s],[x+26*s,y-h/2-12*s],[x-26*s-w,y-h/2-12*s],[x-w/2,y-68*s-h]];
    let esc=null;
    for(const [lx,ly] of cand){ const rc=[lx-3*s,ly-3*s,lx+w+3*s,ly+h+3*s]; if(!hit(rc)){ esc=[lx,ly,rc]; break; } }
    if(!esc){ const [lx,ly]=cand[0]; esc=[lx,ly,[lx,ly,lx+w,ly+h]]; }
    ocup.push(esc[2]);
    ctx.textAlign='left'; ctx.textBaseline='top'; ctx.lineJoin='round';
    ctx.lineWidth=5*s; ctx.strokeStyle='#fff'; ctx.strokeText(txt,esc[0],esc[1]);
    ctx.fillStyle='#0b1b22'; ctx.fillText(txt,esc[0],esc[1]);
    ctx.restore();
  });
}
async function renderMapa(m,lista,cw,satelite,modo){
  { const c0=m.getContainer(); if(m._hMax&&c0.clientHeight!==m._hMax) c0.style.height=m._hMax+'px'; }
  m.resize();
  if(lista.length===1) m.jumpTo({center:[lista[0].lon,lista[0].lat],zoom:17.5});
  else{
    const bb=new maplibregl.LngLatBounds(); lista.forEach(o=>bb.extend([o.lon,o.lat])); if(gradePrintOn()) cantosCelulas(lista).forEach(p=>bb.extend([p.lon,p.lat]));
    /* altura do mapa acompanha o formato da área dos pontos (só a região com ovitrampas; sem faixa vazia em volta) e margem menor */
    const cont=m.getContainer(); if(!m._hMax) m._hMax=cont.clientHeight;
    const a=bb.getSouthWest(), b=bb.getNorthEast(), dx=Math.max(30,(b.lng-a.lng)*Math.cos((a.lat+b.lat)/2*Math.PI/180)*111320), dy=Math.max(30,(b.lat-a.lat)*111320);
    const hNec=Math.round((dy/dx)*(cw-210)+190), hNovo=Math.max(Math.min(m._hMax,500),Math.min(m._hMax,hNec));
    if(hNovo!==cont.clientHeight){ cont.style.height=hNovo+'px'; m.resize(); }
    m.fitBounds(bb,{padding:{top:115,bottom:60,left:105,right:105},maxZoom:19,duration:0});
  }
  await esperaIdle(m,20000);
  const gl=m.getCanvas(), k=gl.width/cw;
  const out=document.createElement('canvas'); out.width=gl.width; out.height=gl.height;
  const ctx=out.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,out.width,out.height); ctx.drawImage(gl,0,0);
  if(modo!=='vetor') afinar(out,.5);
  const proj=(la,lo)=>{ const p=m.project([lo,la]); return {x:p.x*k,y:p.y*k}; };
  if(gradePrintOn()) desenhaGrade(ctx,proj,k,satelite);
  const ordRota=(rotaMapaOn()&&!window.__semRota&&lista.length>=2&&lista.length<=60)?rotaOrdem(lista):null;
  if(ordRota) desenhaRotaLinha(ctx,proj,k,ordRota);
  desenhaPontos(ctx,lista.map(o=>{ const p=m.project([o.lon,o.lat]); return {o,x:p.x*k,y:p.y*k}; }),k*(lista.length>60?.6:lista.length>20?.8:1),true);
  if(ordRota) desenhaRotaNumeros(ctx,proj,k,ordRota);
  const txt=modo==='vetor'?'© OpenStreetMap contributors · OpenFreeMap'+(satelite?' · Imagens © Esri':''):(satelite?'Imagens © Esri, Maxar, Earthstar Geographics':'Mapa © Esri, HERE, Garmin, OpenStreetMap contributors');
  ctx.font=`${11*k}px ${FONTE}`; ctx.textAlign='left'; ctx.textBaseline='middle'; const tw=ctx.measureText(txt).width;
  ctx.fillStyle='rgba(255,255,255,.88)'; ctx.fillRect(out.width-tw-14*k,out.height-20*k,tw+14*k,20*k);
  ctx.fillStyle='#222'; ctx.fillText(txt,out.width-tw-7*k,out.height-10*k);
  return out;
}

/* ---------- folha final: cabeçalho + mapa + lista de endereços ---------- */
function ajustaTexto(ctx,txt,max,peso,tam,min){
  let t=tam; ctx.font=`${peso} ${t}px ${FONTE}`;
  while(ctx.measureText(txt).width>max&&t>min){ t-=.5; ctx.font=`${peso} ${t}px ${FONTE}`; }
  if(ctx.measureText(txt).width>max){ while(txt.length>1&&ctx.measureText(txt+'…').width>max) txt=txt.slice(0,-1); txt+='…'; }
  return txt;
}
function comporFolha(mapCv,lista,titulo,info){
  info=info||{};
  const gr=gradePrintOn()?G:null;
  const W=mapCv.width, u=W/1000, n=lista.length, comLista=n>=1&&n<=40, rowH=(n>10?50:62)*u, mx=24*u;
  const INK=PAL.navy, BR=PAL.blue, CL='#EEF4FA', LN='#C5D6E8', MUTE='#5B7391', RISCO='#9DB0C6';
  const ordem=(rotaRelOn()&&n>=2)?rotaOrdem(lista):lista, comRota=ordem!==lista;
  /* rota em QR: até 10 paradas por QR (limite do Google Maps); com mais paradas, a rota vira trechos em sequência */
  const trechos=[]; if(rotaRelOn()&&comLista&&typeof qrcode==='function'){ for(let k=0;k<ordem.length;k+=10){ const parte=ordem.slice(k,k+10); trechos.push({ids:parte.map(o=>o.id),url:urlRota(parte,k>0?ordem[k-1]:null)}); } }
  const urlR=trechos.length===1?trechos[0].url:null, multiQR=trechos.length>1, QRPL=4;
  const mh=mapCv.height*(W-2*mx)/W, hHead=128*u, hInfo=100*u, hSecT=comLista?64*u:0, hTh=comLista?38*u:0, hRows=comLista?n*rowH:0;
  const temOvos=comLista&&lista.some(o=>o.ovos!==null&&o.ovos!==undefined), hTot=temOvos?48*u:0, hLeg=ovPrintOn()?40*u:0, hQR=urlR?172*u:(multiQR?(70+Math.ceil(trechos.length/QRPL)*(136+74))*u:0), hFoot=56*u;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=Math.round(hHead+hInfo+mh+16*u+hSecT+hTh+hRows+hTot+hLeg+hQR+hFoot);
  const c=cv.getContext('2d');
  c.fillStyle='#fff'; c.fillRect(0,0,cv.width,cv.height);
  /* cabeçalho com o logo da Prefeitura */
  c.textBaseline='alphabetic'; c.textAlign='left';
  const lh=100*u, lw=LOGO.naturalWidth?lh*LOGO.naturalWidth/LOGO.naturalHeight:0, ly=(hHead-8*u-lh)/2;
  if(lw){ c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high'; c.drawImage(LOGO,mx,ly,lw,lh); }
  const tx=mx+(lw?lw+26*u:0);
  if(lw){ c.fillStyle=LN; c.fillRect(tx-13*u,ly+8*u,2*u,lh-16*u); }
  c.fillStyle=INK;
  c.fillText(ajustaTexto(c,titulo,W-tx-mx-210*u,800,34*u,19*u),tx,ly+lh/2-2*u);
  c.font=`700 ${15*u}px ${FONTE}`; c.fillStyle=BR; c.fillText(SUB,tx,ly+lh/2+24*u);
  rr(c,W-mx-190*u,ly+14*u,190*u,lh-28*u,14*u); c.fillStyle=BR; c.fill();
  c.textAlign='center'; c.fillStyle='#fff'; c.font=`800 ${34*u}px ${FONTE}`; c.fillText(String(n),W-mx-142*u,ly+lh/2+6*u);
  c.font=`700 ${15*u}px ${FONTE}`; c.textAlign='left'; c.fillText(n>1?'ovitrampas':'ovitrampa',W-mx-116*u,ly+lh/2-4*u); c.fillText(new Date().toLocaleDateString('pt-BR'),W-mx-116*u,ly+lh/2+18*u);
  faixaLogo(c,W,hHead-8*u,8*u);
  /* cartões de informação */
  const gap=14*u, iy=hHead+18*u, ih=hInfo-30*u, tot4=W-2*mx-3*gap, fr=[.27,.33,.24,.16];
  const eqTxt=info.equipe?(info.equipe+(info.zona?' · Zona '+info.zona:'')):(info.zona?'Zona '+info.zona:'');
  const cards=[['AGENTE',info.agente||''],['ÁREA',info.area||''],['EQUIPE · ZONA',eqTxt],['DATA DA VISITA','']];
  let cx0=mx;
  cards.forEach(([lab,val],i)=>{
    const cw=tot4*fr[i], x=cx0; cx0+=cw+gap;
    rr(c,x,iy,cw,ih,10*u); c.fillStyle=CL; c.fill(); c.strokeStyle=LN; c.lineWidth=1.5*u; c.stroke();
    c.textAlign='left'; c.fillStyle=MUTE; c.font=`800 ${12.5*u}px ${FONTE}`; c.fillText(lab,x+14*u,iy+22*u);
    let tx0=x+14*u, mw=cw-28*u;
    if(val&&i===2&&info.eqCor){ c.beginPath(); c.arc(x+22*u,iy+ih-23*u,7*u,0,Math.PI*2); c.fillStyle=info.eqCor; c.fill(); tx0=x+36*u; mw=cw-50*u; }
    if(val){ c.fillStyle=INK; c.fillText(ajustaTexto(c,val,mw,800,22*u,12*u),tx0,iy+ih-14*u); }
    else{ c.fillStyle=RISCO; c.fillRect(x+14*u,iy+ih-16*u,cw-28*u,1.5*u); }
  });
  /* mapa com cantos arredondados */
  const my=hHead+hInfo;
  c.save(); rr(c,mx,my,W-2*mx,mh,14*u); c.clip(); c.drawImage(mapCv,0,0,mapCv.width,mapCv.height,mx,my,W-2*mx,mh); c.restore();
  rr(c,mx,my,W-2*mx,mh,14*u); c.strokeStyle=INK; c.lineWidth=3*u; c.stroke();
  if(hLeg) legendaOvos(c,u,mx,my+mh+10*u+hLeg/2-6*u,MUTE,INK);
  let y=my+mh+22*u+hLeg;
  if(comLista){
    c.textAlign='left'; c.fillStyle=INK; c.font=`800 ${24*u}px ${FONTE}`; c.fillText('Endereços das ovitrampas',mx,y+24*u);
    c.fillStyle=BR; c.fillRect(mx,y+34*u,60*u,4*u); c.fillStyle=PAL.yellow; c.fillRect(mx+60*u,y+34*u,30*u,4*u);
    if(gr){ c.textAlign='right'; c.fillStyle=MUTE; c.font=`600 ${13*u}px ${FONTE}`; c.fillText(`Grade ${gr.s} m · A1 = ${glat(gr.y0).toFixed(5)}, ${glon(gr.x0).toFixed(5)} · “+” = centro`,W-mx,y+22*u); c.textAlign='left'; }
    y+=hSecT-10*u;
    const sh=comRota?36*u:0;
    const col=gr?{vis:[mx,sh],n:[mx+sh,70*u],e:[mx+84*u+sh,250*u-sh],q:[mx+340*u,104*u],v:[mx+450*u,64*u],d:[mx+520*u,190*u],o:[mx+718*u,134*u],k:[W-mx-52*u,40*u]}:{vis:[mx,sh],n:[mx+sh,70*u],e:[mx+84*u+sh,316*u-sh],v:[mx+408*u,70*u],d:[mx+486*u,196*u],o:[mx+690*u,158*u],k:[W-mx-52*u,40*u]};
    rr(c,mx,y,W-2*mx,hTh,8*u); c.fillStyle=INK; c.fill();
    c.fillStyle='#fff'; c.font=`800 ${14*u}px ${FONTE}`; c.textBaseline='middle';
    c.textAlign='center'; c.fillText('Nº',col.n[0]+col.n[1]/2,y+hTh/2); c.fillText('OVOS',col.v[0]+col.v[1]/2,y+hTh/2); c.fillText('OK',col.k[0]+col.k[1]/2,y+hTh/2);
    if(comRota){ c.font=`800 ${10.5*u}px ${FONTE}`; c.fillText('VISITA',col.vis[0]+col.vis[1]/2+2*u,y+hTh/2); c.font=`800 ${14*u}px ${FONTE}`; }
    c.textAlign='left'; c.fillText('ENDEREÇO / COORDENADAS',col.e[0],y+hTh/2); if(gr) c.fillText('QUADRÍCULA',col.q[0],y+hTh/2); c.fillText(gr?'ÚLT. INSTALAÇÃO':'ÚLTIMA INSTALAÇÃO',col.d[0],y+hTh/2); c.fillText('OBSERVAÇÕES',col.o[0],y+hTh/2);
    y+=hTh; c.textBaseline='alphabetic';
    ordem.forEach((o,i)=>{
      const ry=y+i*rowH;
      if(i%2===0){ c.fillStyle=CL; c.fillRect(mx,ry,W-2*mx,rowH); }
      if(comRota){ c.beginPath(); c.arc(col.vis[0]+col.vis[1]/2+2*u,ry+rowH/2,13*u,0,Math.PI*2); c.fillStyle=INK; c.fill(); c.fillStyle='#fff'; c.font=`800 ${15*u}px ${FONTE}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(String(i+1),col.vis[0]+col.vis[1]/2+2*u,ry+rowH/2+u); c.textBaseline='alphabetic'; }
      const ph=32*u, pw=Math.min(62*u,col.n[1]-4*u), cor=(o.grupo!=null)?GCOL[o.grupo%GCOL.length]:COR_PADRAO;
      rr(c,col.n[0]+(col.n[1]-pw)/2,ry+(rowH-ph)/2,pw,ph,ph/2); if(ovPrintOn()){ c.lineWidth=8*u; c.strokeStyle='#000'; c.stroke(); c.lineWidth=6*u; c.strokeStyle=corOvos(o.ovos); c.stroke(); c.fillStyle=cor; c.fill(); c.lineWidth=1.2*u; c.strokeStyle='rgba(0,0,0,.7)'; c.stroke(); } else { c.fillStyle=cor; c.fill(); c.lineWidth=2.5*u; c.strokeStyle='#fff'; c.stroke(); }
      c.fillStyle=textoSobre(cor); c.font=`800 ${20*u}px ${FONTE}`; c.textAlign='center'; c.textBaseline='middle'; c.fillText(String(o.id),col.n[0]+col.n[1]/2,ry+rowH/2+u);
      c.textAlign='left'; c.textBaseline='alphabetic'; c.fillStyle=INK;
      c.fillText(ajustaTexto(c,o.endereco,col.e[1],800,19*u,12*u),col.e[0],ry+rowH/2-3*u);
      c.font=`400 ${13.5*u}px ${FONTE}`; c.fillStyle=MUTE; c.fillText(`${o.latRaw}, ${o.lonRaw}`,col.e[0],ry+rowH/2+17*u);
      if(gr){ const ci=celula(gr,o.gx,o.gy), longe=ci.dentro&&ci.dist>limiteCentro(); c.textAlign='left'; c.fillStyle=BR; c.font=`800 ${21*u}px ${FONTE}`; c.fillText(ci.code,col.q[0],ry+rowH/2-3*u);
        c.fillStyle=longe?'#C62828':MUTE; c.font=`${longe?800:400} ${12.5*u}px ${FONTE}`; c.fillText(ci.dentro?`${Math.round(ci.dist)} m do centro${longe?' ⚠':''}`:'fora do grid',col.q[0],ry+rowH/2+17*u); }
      { const ov=o.ovos; c.textAlign='center'; c.textBaseline='middle'; c.font=`800 ${24*u}px ${FONTE}`;
        c.fillStyle=(ov===null||ov===undefined)?RISCO:INK; c.fillText((ov===null||ov===undefined)?'—':String(ov),col.v[0]+col.v[1]/2,ry+rowH/2+u);
        c.textAlign='left'; c.textBaseline='alphabetic'; }
      c.fillStyle=RISCO; c.fillRect(col.o[0],ry+rowH-16*u,col.o[1],1.5*u);
      { /* última instalação e histórico de contagens (vêm da planilha); sem dados, fica a linha para escrever a data */
        const hs=(o.historico||[]).slice().sort((a,b)=>a.d.localeCompare(b.d)), dm=d=>{ const p=d.split('-'); return +p[2]+'/'+(+p[1]); }, dw=col.d[1]-10*u;
        if(o.dataInstalacao||hs.length){
          c.textAlign='left'; c.fillStyle=INK; c.font=`800 ${15*u}px ${FONTE}`;
          c.fillText(ajustaTexto(c,o.dataInstalacao?'Inst. '+dataBR(o.dataInstalacao):'Inst. —',dw,800,15*u,10*u),col.d[0],ry+15*u);
          c.fillStyle=MUTE; c.font=`600 ${13.5*u}px ${FONTE}`;
          if(o.dataRecolhimento) c.fillText(ajustaTexto(c,'Recolh. '+dataBR(o.dataRecolhimento),dw,600,13.5*u,9.5*u),col.d[0],ry+31*u);
          if(hs.length) c.fillText(ajustaTexto(c,hs.slice(-3).map(x=>dm(x.d)+': '+x.n).join(' · '),dw,600,13.5*u,9*u),col.d[0],ry+rowH-5*u);
        } else { c.fillRect(col.d[0],ry+rowH-16*u,col.d[1]-10*u,1.5*u); c.font=`400 ${13*u}px ${FONTE}`; c.fillText('  /    /',col.d[0],ry+rowH-20*u); }
      }
      c.fillStyle='#fff'; rr(c,col.k[0]+4*u,ry+(rowH-30*u)/2,30*u,30*u,6*u); c.fill(); c.strokeStyle=INK; c.lineWidth=2*u; c.stroke();
    });
    c.strokeStyle=LN; c.lineWidth=1.5*u; c.strokeRect(mx,y,W-2*mx,hRows);
    y+=hRows;
    if(temOvos){
      const tot=lista.reduce((t,o)=>t+(o.ovos||0),0), sem=lista.filter(o=>o.ovos===null||o.ovos===undefined).length;
      c.fillStyle='#DCE9F5'; c.fillRect(mx,y,W-2*mx,hTot); c.strokeStyle=LN; c.strokeRect(mx,y,W-2*mx,hTot);
      c.textBaseline='middle'; c.textAlign='right'; c.fillStyle=INK; c.font=`800 ${15*u}px ${FONTE}`; c.fillText('TOTAL DE OVOS NESTA LISTA',col.v[0]-14*u,y+hTot/2+u);
      c.textAlign='center'; c.font=`800 ${26*u}px ${FONTE}`; c.fillStyle=INK; c.fillText(String(tot),col.v[0]+col.v[1]/2,y+hTot/2+u);
      if(sem){ c.textAlign='left'; c.font=`400 ${12.5*u}px ${FONTE}`; c.fillStyle=MUTE; c.fillText(`${sem} ovitrampa${sem>1?'s':''} sem contagem de ovos`,col.d[0],y+hTot/2+u); }
      c.textBaseline='alphabetic'; c.textAlign='left'; y+=hTot;
    }
    if(urlR){
      const qy=y+18*u, tam=136*u;
      if(desenhaQR(c,urlR,mx,qy,tam)){
        c.strokeStyle=LN; c.lineWidth=1.5*u; c.strokeRect(mx,qy,tam,tam);
        const qx=mx+tam+22*u; c.textAlign='left'; c.fillStyle=INK; c.font=`800 ${19*u}px ${FONTE}`; c.fillText('Rota sugerida no Google Maps',qx,qy+32*u);
        c.fillStyle=MUTE; c.font=`400 ${14*u}px ${FONTE}`; c.fillText('Aponte a câmera do celular para o QR. A rota parte da sua localização atual.',qx,qy+58*u);
        c.fillStyle=INK; c.font=`800 ${15*u}px ${FONTE}`; c.fillText(ajustaTexto(c,'Ordem de visita (ovitrampas): '+ordem.map(o=>o.id).join(' → '),W-mx-qx,800,15*u,10*u),qx,qy+90*u);
        c.fillStyle=MUTE; c.font=`400 ${12.5*u}px ${FONTE}`; c.fillText('Menor caminho calculado entre os pontos. Pode ser percorrido ao contrário, se for mais prático.',qx,qy+116*u);
      }
      y+=hQR;
    } else if(multiQR){
      const qy0=y+18*u, tam=136*u, gap=(W-2*mx-QRPL*tam)/(QRPL-1);
      c.textAlign='left'; c.fillStyle=INK; c.font=`800 ${19*u}px ${FONTE}`; c.fillText('Rota sugerida no Google Maps · '+trechos.length+' trechos',mx,qy0+22*u);
      c.fillStyle=MUTE; c.font=`400 ${13.5*u}px ${FONTE}`; c.fillText('O Google Maps aceita até 10 paradas por rota. Faça os trechos em ordem: cada QR parte do último ponto do trecho anterior (o 1º parte da sua localização).',mx,qy0+46*u);
      trechos.forEach((tr,k)=>{ const col=k%QRPL, lin=Math.floor(k/QRPL), qx=mx+col*(tam+gap), qy=qy0+70*u+lin*(tam+74*u);
        if(desenhaQR(c,tr.url,qx,qy,tam)){ c.strokeStyle=LN; c.lineWidth=1.5*u; c.strokeRect(qx,qy,tam,tam);
          c.textAlign='left'; c.fillStyle=INK; c.font=`800 ${14.5*u}px ${FONTE}`; c.fillText('Trecho '+(k+1),qx,qy+tam+20*u);
          c.fillStyle=MUTE; c.font=`400 ${12*u}px ${FONTE}`; c.fillText(ajustaTexto(c,tr.ids.join(' → '),tam+gap-8*u,400,12*u,8*u),qx,qy+tam+40*u); } });
      y+=hQR;
    }
  }
  c.fillStyle=LN; c.fillRect(mx,y+14*u,W-2*mx,1.5*u);
  c.textAlign='left'; c.fillStyle=MUTE; c.font=`400 ${12*u}px ${FONTE}`;
  c.fillText('O número no mapa é o ID permanente da ovitrampa.'+(comLista?' Marque “OK” ao concluir cada ponto.':' Lista de endereços disponível para até 40 ovitrampas por mapa.'),mx,y+36*u);
  c.textAlign='right'; c.fillText('Gerado em '+new Date().toLocaleString('pt-BR'),W-mx,y+36*u);
  return cv;
}
/* faixa com as cores do logo */
function faixaLogo(c,W,y,h){ [[PAL.navy,.38],[PAL.blue,.30],[PAL.green,.14],[PAL.yellow,.11],[PAL.red,.07]].reduce((x,[col,p])=>{ c.fillStyle=col; c.fillRect(x,y,Math.ceil(W*p)+1,h); return x+W*p; },0); }
/* legenda do contorno por ovos (linha única) */
function legendaOvos(c,u,x0,ly,cMute,cInk){
  c.textBaseline='middle'; c.textAlign='left'; c.font=`800 ${12.5*u}px ${FONTE}`; c.fillStyle=cMute;
  let lx=x0; const t0='CONTORNO = Nº DE OVOS:'; c.fillText(t0,lx,ly); lx+=c.measureText(t0).width+16*u;
  FAIXAS_OVOS.forEach(([t,col],i)=>{ const tt=t.replace(' ovos','');
    desenhaFaixa(c,i,lx+9*u,ly,18*u,col);
    c.fillStyle=cInk; c.font=`700 ${12.5*u}px ${FONTE}`; c.fillText(tt,lx+24*u,ly); lx+=24*u+c.measureText(tt).width+16*u; });
  c.textBaseline='alphabetic';
}

const faixaTxt=l=>{ const ids=l.map(o=>o.id); return ids.length>1&&ids.length<=6&&ids.every((v,i)=>i===0||v===ids[i-1]+1)?`${ids[0]} a ${ids[ids.length-1]}`:(ids.length>6?compress(ids):ids.join(', ')); };

/* --- reserva: captura da tela com nitidez aplicada --- */
async function printRaster(lista){
  const salvo={c:map.getCenter(),z:map.getZoom(),field:field,fixed:map._fixed};
  try{
    map.closePopup();
    if(sel.size){ field=true; refresh(false); }
    map.invalidateSize();
    fitLegivel(map,gradePrintOn()?lista.concat(cantosCelulas(lista)):lista,60);
    await aguardaTiles($('map'),9000);
    await carregaLib('html2canvas');
    const cv=await html2canvas($('map'),{useCORS:true,scale:3,logging:false,backgroundColor:'#ffffff',
      ignoreElements:el=>el.classList&&(el.classList.contains('leaflet-control-zoom')||el.classList.contains('leaflet-control-layers')||el.classList.contains('leaflet-marker-pane')||el.classList.contains('leaflet-shadow-pane')||el.classList.contains('leaflet-popup-pane'))});
    afinar(cv,0.55);
    const el=$('map'), k=cv.width/el.clientWidth, ctx=cv.getContext('2d'), fator=lista.length>60?.6:lista.length>20?.8:1;
    await fontes();
    if(gradePrintOn()) desenhaGrade(ctx,(la,lo)=>{ const p=map.latLngToContainerPoint([la,lo]); return {x:p.x*k,y:p.y*k}; },k,map.hasLayer(sat));
    desenhaPontos(ctx,lista.map(o=>{ const p=map.latLngToContainerPoint([o.lat,o.lon]); return {o,x:p.x*k,y:p.y*k}; }),k*fator*0.9,true);
    return cv;
  } finally {
    field=salvo.field; map._fixed=salvo.fixed; refresh(false);
    map.setView(salvo.c,salvo.z,{animate:false}); zoomClass(map);
  }
}

/* uma imagem pronta (vetorial; se falhar, cai na captura da tela) */
async function gerarImagem(lista,titulo,dim,info){
  try{ await carregaLib('qrcode'); }catch(e){}
  const r0=$('map').getBoundingClientRect();
  const cw=1000, ch=dim?dim.ch:(r0.width>50?Math.max(560,Math.min(950,Math.round(1000*r0.height/r0.width))):1000);
  let mapCv, modo=$('fundo').value||'esri';
  try{
    const PR=maxPR(cw,ch,+$('qual').value||3);
    await fontes();
    const r=await criaRenderer(map.hasLayer(sat),cw,ch,PR,modo);
    try{ mapCv=await r.render(lista); } finally{ r.destroy(); }
  }catch(e){ console.warn('Mapa vetorial indisponível, usando reserva:',e); modo='raster'; mapCv=await printRaster(lista); }
  await fontes();
  return {cv:comporFolha(mapCv,lista,titulo,info||infoTela()),modo};
}

/* PDF: A4, uma folha por imagem */
function novoPdf(cv){ return new window.jspdf.jsPDF({orientation:cv.width>cv.height?'l':'p',unit:'mm',format:'a4',compress:true}); }
function pdfAdd(pdf,cv,novaPagina){
  const land=cv.width>cv.height;
  if(novaPagina) pdf.addPage('a4',land?'l':'p');
  const W=pdf.internal.pageSize.getWidth(), H=pdf.internal.pageSize.getHeight(), mg=6;
  const k=Math.min((W-2*mg)/cv.width,(H-2*mg)/cv.height), iw=cv.width*k, ih=cv.height*k;
  pdf.addImage(cv.toDataURL('image/jpeg',.94),'JPEG',(W-iw)/2,mg,iw,ih,undefined,'FAST');
}

function mostrarPrint(cv,lista,modo){
  shotCanvas=cv; shotLista=lista; shotNome=nomeArq(lista);
  cv.toBlob(b=>{
    shotBlob=b;
    if($('shotImg').dataset.u) URL.revokeObjectURL($('shotImg').dataset.u);
    const u=URL.createObjectURL(b); $('shotImg').src=u; $('shotImg').dataset.u=u;
    $('shotInf').textContent=`${lista.length} ovitrampa(s) · ${cv.width}×${cv.height} px · `+(modo==='vetor'?'fundo vetorial OpenStreetMap':modo==='esri'?'mesmo mapa da tela (Esri) + nome das ruas das ovitrampas em texto nítido':'modo reserva: captura da tela (o mapa em alta resolução não carregou) + nomes das ruas nítidos');
    $('shotShare').style.display=(navigator.canShare&&navigator.canShare({files:[new File([b],'a.png',{type:'image/png'})]}))?'':'none';
    $('shotDlg').style.display='flex';
  },'image/png');
}

$('shotBtn').addEventListener('click',async()=>{
  const btn=$('shotBtn'); btn.disabled=true; btn.textContent='Gerando…';
  try{
    const lista=sel.size? selList() : visibleList();
    if(!lista.length){ toast('Nenhuma ovitrampa para o print.'); return; }
    const r=await gerarImagem(lista,tituloLista(lista));
    mostrarPrint(r.cv,lista,r.modo);
  }catch(e){ console.error(e); toast('Não foi possível gerar o print. Confira a internet e tente de novo.'); }
  finally{ btn.disabled=false; btn.innerHTML=ico('camera')+'<span>Print do mapa</span>'; }
});
$('shotClose').addEventListener('click',()=>{ $('shotDlg').style.display='none'; });
$('shotPng').addEventListener('click',()=>{ if(shotBlob) baixarArq(shotBlob,shotNome+'.png'); });
$('shotShare').addEventListener('click',async()=>{
  try{ await navigator.share({files:[new File([shotBlob],shotNome+'.png',{type:'image/png'})],title:'Mapa — ovitrampas'}); }
  catch(e){ if(e.name!=='AbortError') toast('Não foi possível compartilhar. Use “Salvar PNG”.'); }
});
$('shotPdf').addEventListener('click',async()=>{
  try{ await carregaLib('jspdf'); }catch(e){ toast('PDF indisponível (biblioteca não carregou). Use “Salvar PNG”.'); return; }
  try{ const pdf=novoPdf(shotCanvas); pdfAdd(pdf,shotCanvas,false); pdf.save(shotNome+'.pdf'); }
  catch(e){ console.error(e); toast('Não foi possível gerar o PDF. Use “Salvar PNG”.'); }
});
