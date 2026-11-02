/* app/09-indicadores.js — registro de campo, indicadores (IPO/IDO/IDV) e resumo gerencial em PDF. Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== REGISTRO DE CAMPO (instalação, recolhimento, contagens semanais) ===================== */
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dataBR=s=>s?String(s).split('-').reverse().join('/'):'—';
const parseISO=s=>{ const [y,m,d]=String(s).split('-').map(Number); return new Date(y,m-1,d); };
/* semana epidemiológica (domingo a sábado; SE 1 = semana com a maioria dos dias em janeiro) */
function semEpi(s){
  const d=parseISO(s), sab=new Date(d); sab.setDate(d.getDate()+(6-d.getDay()));
  const qua=new Date(sab); qua.setDate(sab.getDate()-3);
  const ano=qua.getFullYear(), j4=new Date(ano,0,4), ini=new Date(j4); ini.setDate(j4.getDate()-j4.getDay());
  const dom=new Date(sab); dom.setDate(sab.getDate()-6);
  return {ano,sem:Math.round((dom-ini)/(7*864e5))+1};
}
let cic=null;
window.abreCiclo=function(id){
  const o=byId[id]; if(!o) return; map.closePopup();
  cic={id,inst:o.dataInstalacao||'',rec:o.dataRecolhimento||'',hist:JSON.parse(JSON.stringify(o.historico||[]))};
  const a=AG_POR_ID[id];
  $('cicT').textContent='Ovitrampa '+id;
  $('cicSub').textContent=o.endereco+(a?` · ${a.nome||'Zona '+a.zona} · ${eqTxt(a)}`:'')+(o.ovosBase!==null?` · contagem da base: ${o.ovosBase} ovos`:' · sem contagem na base');
  $('cicInst').value=cic.inst; $('cicRec').value=cic.rec; $('cicData').value=iso(new Date()); $('cicN').value=''; $('cicMsg').textContent='';
  cicRender(); $('cicloDlg').style.display='flex';
};
function cicRender(){
  const h=cic.hist.slice().sort((a,b)=>b.d.localeCompare(a.d));
  $('cicLista').innerHTML=h.length?`<div class="tw" style="max-height:24vh"><table><thead><tr><th>Data</th><th>Sem. epid.</th><th>Ovos</th><th></th></tr></thead><tbody>${h.map(x=>{ const se=semEpi(x.d); return `<tr><td>${dataBR(x.d)}</td><td>SE ${se.sem}/${se.ano}</td><td><b>${x.n}</b></td><td><button class="btn ghost" type="button" data-del="${x.d}" aria-label="Remover contagem">✕</button></td></tr>`; }).join('')}</tbody></table></div>`:'<p class="hint">Nenhuma contagem registrada ainda. A contagem mais recente passa a valer para o mapa e os indicadores.</p>';
  const g=cic.hist.slice().sort((a,b)=>a.d.localeCompare(b.d)).slice(-16);
  if(g.length>=2){
    const mx=Math.max(1,...g.map(x=>x.n)), W=560, H=110, bw=W/g.length;
    $('cicGraf').innerHTML=`<svg viewBox="0 0 ${W} ${H+22}" width="100%" role="img" aria-label="Evolução das contagens">${g.map((x,i)=>{ const h2=Math.max(2,x.n/mx*H); return `<rect x="${i*bw+6}" y="${H-h2}" width="${bw-12}" height="${h2}" rx="4" fill="${corOvos(x.n)}" stroke="#111" stroke-width="1.5"/><text x="${i*bw+bw/2}" y="${H-h2-4}" font-size="12" font-weight="800" text-anchor="middle" fill="#002B68">${x.n}</text><text x="${i*bw+bw/2}" y="${H+15}" font-size="10.5" text-anchor="middle" fill="#5B7391">${x.d.slice(8)}/${x.d.slice(5,7)}</text>`; }).join('')}</svg>`;
  } else $('cicGraf').innerHTML='';
}
$('cicLista').addEventListener('click',e=>{ const b=e.target.closest('button[data-del]'); if(!b) return; cic.hist=cic.hist.filter(x=>x.d!==b.dataset.del); cicRender(); });
$('cicAdd').addEventListener('click',()=>{
  const d=$('cicData').value, n=$('cicN').value.trim();
  if(!d){ $('cicMsg').textContent='Informe a data da contagem.'; return; }
  if(!/^\d+$/.test(n)){ $('cicMsg').textContent='Informe a quantidade de ovos (número inteiro, 0 ou mais).'; return; }
  cic.hist=cic.hist.filter(x=>x.d!==d); cic.hist.push({d,n:parseInt(n,10)}); $('cicN').value=''; $('cicMsg').textContent='Contagem adicionada. Clique em Salvar para guardar.'; cicRender();
});
$('cicFechar').addEventListener('click',()=>{ $('cicloDlg').style.display='none'; cic=null; });
$('cicSalvar').addEventListener('click',()=>{
  if(!cic) return;
  const inst=$('cicInst').value, rec=$('cicRec').value;
  if(inst&&rec&&rec<inst){ $('cicMsg').textContent='A data de recolhimento não pode ser anterior à de instalação.'; return; }
  const o=byId[cic.id], vazio=!inst&&!rec&&!cic.hist.length;
  if(vazio) delete STORE.ciclo[cic.id]; else STORE.ciclo[cic.id]={inst,rec,hist:cic.hist};
  o.dataInstalacao=inst||null; o.dataRecolhimento=rec||null; o.historico=cic.hist;
  const ok=storeSalvar(); const id=cic.id; $('cicloDlg').style.display='none'; cic=null;
  recalcTudo([id]); toast(ok?`Ovitrampa ${id}: registro salvo.`:'Registro aplicado, mas NÃO foi possível guardar neste aparelho. Faça um backup.');
});
function cicloLinhaPopup(o){
  const h=(o.historico||[]).length; if(!o.dataInstalacao&&!o.dataRecolhimento&&!h) return '';
  return `<div class="pp-coord" style="margin-top:-6px">${o.dataInstalacao?'Instalada '+dataBR(o.dataInstalacao):''}${o.dataRecolhimento?' · Recolhida '+dataBR(o.dataRecolhimento):''}${h?` · ${h} contagem(ns)`:''}</div>`;
}
/* ===================== INDICADORES (IPO, IDO, ovos) ===================== */
const bandaOvos=v=>(v===null||v===undefined)?5:v<=0?0:v<=20?1:v<=50?2:v<=100?3:4;
function indic(lista){
  const r={n:lista.length,com:0,pos:0,ovos:0,bandas:[0,0,0,0,0,0]};
  lista.forEach(o=>{ const v=o.ovos; r.bandas[bandaOvos(v)]++; if(v!==null&&v!==undefined){ r.com++; r.ovos+=v; if(v>0) r.pos++; } });
  r.ipo=r.com?100*r.pos/r.com:null; r.imo=r.pos?r.ovos/r.pos:null; return r;
}
const fPct=x=>x===null||x===undefined?'—':x.toFixed(1).replace('.',',')+'%';
const fNum=x=>x===null||x===undefined?'—':String(Math.round(x*10)/10).replace('.',',');
function equipesDados(){
  const chaves=[...new Set(AGS.map(a=>a.equipe||0))].sort((a,b)=>(a||99)-(b||99));
  return chaves.map(k=>{ const ags=AGS.filter(a=>(a.equipe||0)===k), lista=ags.flatMap(a=>a.lista); return {eq:k,nome:k?'Equipe '+k:'Sem equipe',ags,lista,ind:indic(lista)}; });
}
function atualizaIndicadores(){
  const r=indic(pts);
  $('kpiResumo').innerHTML=[[fPct(r.ipo),'IPO'],[fNum(r.imo),'IDO'],[r.pos+'/'+r.com,'Positivas'],[r.ovos,'Total de ovos'],[r.com,'Com contagem'],[r.n-r.com,'Sem contagem']].map(([v,l])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('');
}
function criticas(lista,max){ return lista.filter(o=>o.ovos>0).sort((a,b)=>b.ovos-a.ovos||a.id-b.id).slice(0,max); }
function evolucaoSE(){
  const m={}; pts.forEach(o=>(o.historico||[]).forEach(h=>{ const se=semEpi(h.d), k=se.ano+'-'+String(se.sem).padStart(2,'0'); const e=m[k]||(m[k]={ano:se.ano,sem:se.sem,ovos:0,n:0}); e.ovos+=h.n; e.n++; }));
  return Object.keys(m).sort().map(k=>m[k]);
}
function htmlIndicadores(){
  const g=indic(pts), eqs=equipesDados(), ord=$('indOrd').value;
  let h=`<div class="indkpis">${[[fPct(g.ipo),'IPO'],[fNum(g.imo),'IDO'],[g.pos+' de '+g.com,'Positivas / com contagem'],[g.ovos,'Total de ovos'],[g.n-g.com,'Sem contagem']].map(([v,l])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>`;
  const mx=Math.max(1,...g.bandas);
  h+='<div class="tabv"><h3>Distribuição por faixa de ovos</h3>'+FAIXAS_OVOS.map(([t,c],i)=>`<div class="bandbar">${svgFaixa(i,c,18)}<i style="background:${c};width:${Math.max(2,Math.round(g.bandas[i]/mx*42))}%"></i><span><b>${g.bandas[i]}</b> · ${t}</span></div>`).join('')+'</div>';
  h+=`<div class="tabv"><h3>Por equipe</h3><div class="tw"><table><thead><tr><th>Equipe</th><th>Agentes</th><th>Ovitrampas</th><th>Com contagem</th><th>Positivas</th><th>IPO</th><th>Ovos</th><th>IDO</th></tr></thead><tbody>${eqs.map(e=>`<tr><td><b>${e.nome}</b></td><td>${e.ags.length}</td><td>${e.ind.n}</td><td>${e.ind.com}</td><td>${e.ind.pos}</td><td>${fPct(e.ind.ipo)}</td><td>${e.ind.ovos}</td><td>${fNum(e.ind.imo)}</td></tr>`).join('')}</tbody></table></div></div>`;
  let ags=AGS.map(a=>({a,i:indic(a.lista)}));
  ags.sort((x,y)=>ord==='zona'?x.a.zona-y.a.zona:ord==='ipo'?(y.i.ipo||-1)-(x.i.ipo||-1):ord==='imo'?(y.i.imo||-1)-(x.i.imo||-1):y.i.ovos-x.i.ovos||x.a.zona-y.a.zona);
  h+=`<div class="tabv"><h3>Por agente / área</h3><div class="tw"><table><thead><tr><th>Zona</th><th>Agente</th><th>Área</th><th>Equipe</th><th>Ovit.</th><th>Positivas</th><th>IPO</th><th>Ovos</th><th>IDO</th></tr></thead><tbody>${ags.map(({a,i})=>`<tr><td>${a.zona}</td><td><button class="idb" type="button" data-ag="${a.zona}">${esc(nomeAg(a))}</button></td><td>${esc(a.area||'—')}</td><td>${esc(eqTxt(a))}</td><td>${i.n}</td><td>${i.pos}</td><td>${fPct(i.ipo)}</td><td><b>${i.ovos}</b></td><td>${fNum(i.imo)}</td></tr>`).join('')}</tbody></table></div></div>`;
  const cr=criticas(pts,25);
  h+=`<div class="tabv"><h3>Ovitrampas mais críticas (maior nº de ovos)</h3>${cr.length?`<div class="tw"><table><thead><tr><th>ID ovitrampa</th><th>Endereço</th><th>Agente</th><th>Quadrícula</th><th>Ovos</th></tr></thead><tbody>${cr.map(o=>{ const a=AG_POR_ID[o.id], ci=G?celula(G,o.gx,o.gy):null; return `<tr><td><button class="idb" type="button" data-id="${o.id}">${o.id}</button></td><td>${esc(o.endereco)}</td><td>${esc(a?nomeAg(a)+' · '+eqTxt(a):'—')}</td><td>${ci&&ci.dentro?ci.code:'—'}</td><td><span style="display:inline-block;width:20px;height:11px;border-radius:6px;border:1.5px solid #111;background:${corOvos(o.ovos)};vertical-align:-1px"></span> <b>${o.ovos}</b></td></tr>`; }).join('')}</tbody></table></div>`:'<p class="hint">Nenhuma ovitrampa positiva.</p>'}</div>`;
  const ev=evolucaoSE();
  if(ev.length){ const m=Math.max(1,...ev.map(e=>e.ovos)), W=560, H=110, bw=W/ev.length;
    h+=`<div class="tabv"><h3>Evolução semanal (registros de campo)</h3><svg viewBox="0 0 ${W} ${H+24}" width="100%">${ev.map((e,i)=>{ const hh=Math.max(2,e.ovos/m*H); return `<rect x="${i*bw+6}" y="${H-hh}" width="${bw-12}" height="${hh}" rx="4" fill="#007ECA"/><text x="${i*bw+bw/2}" y="${H-hh-4}" font-size="12" font-weight="800" text-anchor="middle" fill="#002B68">${e.ovos}</text><text x="${i*bw+bw/2}" y="${H+16}" font-size="10.5" text-anchor="middle" fill="#5B7391">SE ${e.sem}</text>`; }).join('')}</svg><p class="hint">Soma dos ovos registrados por semana epidemiológica (${ev.reduce((t,e)=>t+e.n,0)} contagens).</p></div>`; }
  return h;
}
function abreIndicadores(){ $('indBody').innerHTML=htmlIndicadores(); $('indDlg').style.display='flex'; closeMenu(); }
$('indAbrir').addEventListener('click',abreIndicadores);
$('indFechar').addEventListener('click',()=>{ $('indDlg').style.display='none'; });
$('indOrd').addEventListener('change',()=>{ $('indBody').innerHTML=htmlIndicadores(); });
$('indBody').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.ag){ const a=AGS.find(x=>x.zona===+b.dataset.ag); $('indDlg').style.display='none'; selecionaIds(a.lista.map(o=>o.id)); toast(`${rotAg(a)} · ${eqTxt(a)}`); }
  else if(b.dataset.id){ const id=+b.dataset.id; $('indDlg').style.display='none'; selecionaIds([id]); setTimeout(()=>byId[id].marker.openPopup(),400); }
});
$('indCsv').addEventListener('click',()=>{
  const cab=['Equipe','Zona','Agente','Área','Ovitrampas','Com contagem','Positivas','IPO (%)','Total de ovos','IDO'];
  const lin=AGS.map(a=>{ const i=indic(a.lista); return [eqTxt(a),a.zona,a.nome,a.area,faixa(a),i.com,i.pos,i.ipo===null?'':fNum(i.ipo),i.ovos,i.imo===null?'':fNum(i.imo)].map(csvCel).join(';'); });
  baixar('indicadores-por-agente.csv','\ufeff'+[cab.join(';')].concat(lin).join('\n'),'text/csv;charset=utf-8');
});

/* ===================== RESUMO GERENCIAL (PDF, 1 página geral + 2 por equipe) ===================== */
function paginaA4(){ const W=2400,H=3394, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const c=cv.getContext('2d'); c.fillStyle='#fff'; c.fillRect(0,0,W,H); return {cv,c,W,H,u:W/1000}; }
function cabPag(pg,titulo,sub,cor){
  const {c,u,W}=pg, mx=24*u, hHead=128*u, lh=100*u, lw=LOGO.naturalWidth?lh*LOGO.naturalWidth/LOGO.naturalHeight:0, ly=(hHead-8*u-lh)/2;
  c.textBaseline='alphabetic'; c.textAlign='left';
  if(lw){ c.imageSmoothingEnabled=true; c.imageSmoothingQuality='high'; c.drawImage(LOGO,mx,ly,lw,lh); }
  const tx=mx+(lw?lw+26*u:0); if(lw){ c.fillStyle='#C5D6E8'; c.fillRect(tx-13*u,ly+8*u,2*u,lh-16*u); }
  c.fillStyle=PAL.navy; c.fillText(ajustaTexto(c,titulo,W-tx-mx-200*u,800,34*u,19*u),tx,ly+lh/2-2*u);
  c.font=`700 ${15*u}px ${FONTE}`; c.fillStyle=PAL.blue; c.fillText(sub,tx,ly+lh/2+24*u);
  rr(c,W-mx-170*u,ly+24*u,170*u,lh-48*u,12*u); c.fillStyle=cor||PAL.blue; c.fill();
  c.fillStyle=textoSobre(cor||PAL.blue); c.textAlign='center'; c.font=`800 ${17*u}px ${FONTE}`; c.fillText(new Date().toLocaleDateString('pt-BR'),W-mx-85*u,ly+lh/2+6*u); c.textAlign='left';
  faixaLogo(c,W,hHead-8*u,8*u); return hHead;
}
function kpisPag(pg,y,itens){
  const {c,u,W}=pg, mx=24*u, gap=12*u, n=itens.length, w=(W-2*mx-gap*(n-1))/n, h=88*u;
  itens.forEach(([v,l],i)=>{ const x=mx+i*(w+gap); rr(c,x,y,w,h,10*u); c.fillStyle='#EEF4FA'; c.fill(); c.strokeStyle='#C5D6E8'; c.lineWidth=1.5*u; c.stroke();
    c.textAlign='center'; c.fillStyle=PAL.navy; c.font=`800 ${32*u}px ${FONTE}`; c.fillText(String(v),x+w/2,y+50*u); c.fillStyle='#5B7391'; c.font=`800 ${11.5*u}px ${FONTE}`; c.fillText(l.toUpperCase(),x+w/2,y+74*u); });
  c.textAlign='left'; return y+h;
}
function tituloSecao(pg,y,t){ const {c,u}=pg, mx=24*u; c.textAlign='left'; c.fillStyle=PAL.navy; c.font=`800 ${22*u}px ${FONTE}`; c.fillText(t,mx,y+22*u); c.fillStyle=PAL.blue; c.fillRect(mx,y+32*u,60*u,4*u); c.fillStyle=PAL.yellow; c.fillRect(mx+60*u,y+32*u,30*u,4*u); return y+48*u; }
function tabelaPag(pg,y,cols,linhas,opt){
  opt=opt||{}; const {c,u,W}=pg, mx=24*u, tw=W-2*mx, rowH=(opt.rowH||40)*u, hh=34*u, soma=cols.reduce((t,k)=>t+k.w,0);
  const xs=[]; let x=mx; cols.forEach(k=>{ const w=tw*k.w/soma; xs.push([x,w]); x+=w; });
  rr(c,mx,y,tw,hh,7*u); c.fillStyle=PAL.navy; c.fill();
  c.fillStyle='#fff'; c.font=`800 ${12.5*u}px ${FONTE}`; c.textBaseline='middle';
  cols.forEach((k,i)=>{ c.textAlign=k.a==='r'?'right':k.a==='c'?'center':'left'; const px=k.a==='r'?xs[i][0]+xs[i][1]-10*u:k.a==='c'?xs[i][0]+xs[i][1]/2:xs[i][0]+10*u; c.fillText(k.t,px,y+hh/2+u); });
  const todas=opt.total?linhas.concat([opt.total]):linhas;
  todas.forEach((r,j)=>{ const ry=y+hh+j*rowH, tot=opt.total&&j===linhas.length;
    c.fillStyle=tot?'#DCE9F5':(j%2===0?'#EEF4FA':'#fff'); c.fillRect(mx,ry,tw,rowH);
    cols.forEach((k,i)=>{ const v=k.f(r); c.textAlign=k.a==='r'?'right':k.a==='c'?'center':'left'; const px=k.a==='r'?xs[i][0]+xs[i][1]-10*u:k.a==='c'?xs[i][0]+xs[i][1]/2:xs[i][0]+10*u;
      c.fillStyle=PAL.navy; c.font=`${(k.b||tot)?800:600} ${15*u}px ${FONTE}`; c.fillText(ajustaTexto(c,String(v),xs[i][1]-18*u,(k.b||tot)?800:600,15*u,9*u),px,ry+rowH/2+u); });
  });
  c.strokeStyle='#C5D6E8'; c.lineWidth=1.5*u; c.strokeRect(mx,y+hh,tw,rowH*todas.length); c.textBaseline='alphabetic'; c.textAlign='left';
  return y+hh+rowH*todas.length;
}
function rodapePag(pg,n,total,txt){ const {c,u,W,H}=pg, mx=24*u; c.fillStyle='#C5D6E8'; c.fillRect(mx,H-46*u,W-2*mx,1.5*u); c.fillStyle='#5B7391'; c.font=`400 ${12*u}px ${FONTE}`; c.textAlign='left'; c.fillText(txt,mx,H-22*u); c.textAlign='right'; c.fillText(`Página ${n} de ${total} · gerado em ${new Date().toLocaleString('pt-BR')}`,W-mx,H-22*u); c.textAlign='left'; }
function mapaPag(pg,y,mapCv){ const {c,u,W}=pg, mx=24*u, w=W-2*mx, h=mapCv.height*w/mapCv.width;
  c.save(); rr(c,mx,y,w,h,14*u); c.clip(); c.drawImage(mapCv,mx,y,w,h); c.restore(); rr(c,mx,y,w,h,14*u); c.strokeStyle=PAL.navy; c.lineWidth=3*u; c.stroke();
  legendaOvos(c,u,mx,y+h+24*u,'#5B7391',PAL.navy); return y+h+46*u; }
async function gerarResumoGerencial(){
  if(bRodando) return;
  try{ await carregaLib('jspdf'); }catch(e){ toast('A biblioteca de PDF não carregou. Confira a internet e tente de novo.'); return; }
  bRodando=true; bCancel=false; closeMenu(); $('indDlg').style.display='none';
  $('batchT').textContent='Gerando resumo gerencial…'; $('bCancel').disabled=false; $('bCancel').style.display=''; $('bDone').style.display='none';
  bBar(0); bTxt('Carregando mapa…'); $('batchDlg').style.display='flex';
  const satelite=map.hasLayer(sat), cw=1000, ch=540;
  let rend=null, pdf=null, nPag=0; const salvoOv=window.__ovForce, salvoEst=window.ESTILO_PONTOS, salvoRota=window.__semRota;
  try{
    window.__ovForce=true; window.ESTILO_PONTOS='ponto'; window.__semRota=true;
    rend=await criaRenderer(satelite,cw,ch,maxPR(cw,ch,2.4),$('fundo').value||'esri'); await fontes();
    const eqs=equipesDados().filter(e=>e.eq), tot=1+eqs.length*2, geral=indic(pts), todasEq=equipesDados();
    const add=cv=>{ if(!pdf) pdf=novoPdf(cv); pdfAdd(pdf,cv,nPag>0); nPag++; bBar(nPag/tot); };
    const colsEq=[{t:'Equipe',w:140,f:e=>e.nome,b:1},{t:'Agentes',w:80,a:'r',f:e=>e.ags.length},{t:'Ovitrampas',w:100,a:'r',f:e=>e.ind.n},{t:'Com contagem',w:110,a:'r',f:e=>e.ind.com},{t:'Positivas',w:90,a:'r',f:e=>e.ind.pos},{t:'IPO',w:80,a:'r',f:e=>fPct(e.ind.ipo)},{t:'Ovos',w:80,a:'r',f:e=>e.ind.ovos},{t:'IDO',w:70,a:'r',f:e=>fNum(e.ind.imo)}];
    /* página geral */
    bTxt(`Página 1 de ${tot} · visão geral`);
    let mapCv=await rend.render(pts), pg=paginaA4(), y=cabPag(pg,'Resumo gerencial — ovitrampas','Ponta Porã/MS · Vigilância em Saúde / Endemias');
    y=kpisPag(pg,y+18*pg.u,[[fPct(geral.ipo),'IPO'],[fNum(geral.imo),'IDO'],[geral.pos+'/'+geral.com,'Positivas'],[geral.ovos,'Total de ovos'],[geral.n,'Ovitrampas'],[geral.n-geral.com,'Sem contagem']]);
    y=mapaPag(pg,y+14*pg.u,mapCv); y=tituloSecao(pg,y+10*pg.u,'Resumo por equipe');
    tabelaPag(pg,y,colsEq,todasEq,{rowH:44,total:{nome:'Total',ags:AGS.filter(a=>a.nome||true),ind:geral}});
    rodapePag(pg,1,tot,'IPO = positivas ÷ ovitrampas com contagem · IDO = ovos ÷ positivas (média de ovos por ovitrampa positiva). Mapa: cor do ponto = faixa de ovos.'); add(pg.cv);
    for(const e of eqs){
      if(bCancel) break;
      bTxt(`Página ${nPag+1} de ${tot} · ${e.nome}`); await new Promise(r=>setTimeout(r,20));
      const cor=COR_EQ[e.eq]; mapCv=await rend.render(e.lista); pg=paginaA4();
      y=cabPag(pg,'Resumo gerencial — '+e.nome,`${e.ags.length} agentes · ${e.ind.n} ovitrampas · Ponta Porã/MS`,cor);
      y=kpisPag(pg,y+18*pg.u,[[fPct(e.ind.ipo),'IPO'],[fNum(e.ind.imo),'IDO'],[e.ind.pos+'/'+e.ind.com,'Positivas'],[e.ind.ovos,'Total de ovos'],[e.ags.length,'Agentes'],[e.ind.n-e.ind.com,'Sem contagem']]);
      y=mapaPag(pg,y+14*pg.u,mapCv); y=tituloSecao(pg,y+4*pg.u,'Agentes da equipe');
      const linhas=e.ags.slice().sort((a,b)=>a.zona-b.zona).map(a=>({a,i:indic(a.lista)}));
      tabelaPag(pg,y,[{t:'Zona',w:50,f:r=>r.a.zona},{t:'Agente',w:150,f:r=>r.a.nome||'—',b:1},{t:'Área',w:230,f:r=>r.a.area||'—'},{t:'Ovit.',w:60,a:'r',f:r=>r.i.n},{t:'Posit.',w:60,a:'r',f:r=>r.i.pos},{t:'IPO',w:70,a:'r',f:r=>fPct(r.i.ipo)},{t:'Ovos',w:70,a:'r',f:r=>r.i.ovos},{t:'IDO',w:60,a:'r',f:r=>fNum(r.i.imo)}],linhas,{rowH:36});
      rodapePag(pg,nPag+1,tot,e.nome+' · cor do ponto no mapa = faixa de ovos.'); add(pg.cv);
      /* página 2 da equipe: críticas + distribuição */
      pg=paginaA4(); y=cabPag(pg,e.nome+' — pontos críticos','Maiores contagens de ovos e distribuição por faixa',cor);
      y=tituloSecao(pg,y+22*pg.u,'Distribuição por faixa de ovos'); const mxb=Math.max(1,...e.ind.bandas), c=pg.c, u=pg.u;
      FAIXAS_OVOS.forEach(([t,col],i)=>{ const by=y+i*40*u, bw=Math.max(26*u,e.ind.bandas[i]/mxb*560*u), x0=24*u+34*u; desenhaFaixa(c,i,24*u+14*u,by+13*u,26*u,col); rr(c,x0,by,bw,26*u,13*u); c.fillStyle=col; c.fill(); c.lineWidth=2*u; c.strokeStyle='#111'; c.stroke();
        c.fillStyle=PAL.navy; c.font=`800 ${16*u}px ${FONTE}`; c.textBaseline='middle'; c.fillText(`${e.ind.bandas[i]}  ·  ${t}`,x0+bw+14*u,by+14*u); c.textBaseline='alphabetic'; });
      y+=6*40*u+16*u; y=tituloSecao(pg,y,'Ovitrampas com mais ovos (até 25)');
      const cr=criticas(e.lista,25);
      if(cr.length) tabelaPag(pg,y,[{t:'ID',w:44,a:'c',f:o=>o.id,b:1},{t:'Endereço',w:300,f:o=>o.endereco},{t:'Agente',w:130,f:o=>{ const a=AG_POR_ID[o.id]; return a?nomeAg(a):'—'; }},{t:'Quadr.',w:60,a:'c',f:o=>{ const ci=G?celula(G,o.gx,o.gy):null; return ci&&ci.dentro?ci.code:'—'; }},{t:'Ovos',w:60,a:'r',f:o=>o.ovos,b:1}],cr,{rowH:40});
      else{ c.fillStyle=PAL.navy; c.font=`600 ${16*u}px ${FONTE}`; c.fillText('Nenhuma ovitrampa positiva nesta equipe.',24*u,y+24*u); }
      rodapePag(pg,nPag+1,tot,e.nome); add(pg.cv);
    }
    if(pdf&&nPag){ baixarArq(pdf.output('blob'),'Resumo gerencial - ovitrampas.pdf'); $('batchT').textContent=bCancel?'Resumo cancelado (parcial)':'Concluído'; bTxt(`${nPag} página(s) geradas.`+(pastaDest?` Salvo na pasta “${pastaDest.name}”.`:' Veja a pasta Downloads (Transferências).')); }
    else{ $('batchT').textContent='Cancelado'; bTxt('Nenhuma página gerada.'); }
  }catch(e){ console.error(e); $('batchT').textContent='Não foi possível gerar'; bTxt('Erro ao gerar o resumo: '+(e&&e.message||e)); }
  finally{ window.__ovForce=salvoOv; window.ESTILO_PONTOS=salvoEst; window.__semRota=salvoRota; if(rend) rend.destroy(); bRodando=false; $('bCancel').style.display='none'; $('bDone').style.display=''; }
}
$('resGer').addEventListener('click',gerarResumoGerencial);
$('indPdf').addEventListener('click',gerarResumoGerencial);
