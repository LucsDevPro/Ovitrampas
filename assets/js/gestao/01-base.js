/* gestao.js — painel da gestão (somente leitura). Dados vêm de data/*.json via boot.js. */

const FAIXAS=[['0 ovos','#00a8e8'],['1–20 ovos','#22bf4a'],['21–50 ovos','#ffc800'],['51–100 ovos','#ff7a00'],['101+ ovos','#e60026'],['Sem informação','#7b1fa2']];
const COR_EQ={1:'#007ECA',2:'#00A651',3:'#C98A00',4:'#E0182D'};
const $=id=>document.getElementById(id);
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const marcaFaixa=(lat,lon,v)=>L.marker([lat,lon],{icon:L.divIcon({className:'mfx',iconSize:[20,20],iconAnchor:[10,10],html:svgFaixa(banda(v),corOvos(v),20)})});
const banda=v=>(v===null||v===undefined)?5:v<=0?0:v<=20?1:v<=50?2:v<=100?3:4;
const corOvos=v=>FAIXAS[banda(v)][1];
const fPct=x=>x===null||x===undefined?'—':x.toFixed(1).replace('.',',')+'%';
const fNum=x=>x===null||x===undefined?'—':String(Math.round(x*10)/10).replace('.',',');
const parseISO=s=>{ const [y,m,d]=String(s).split('-').map(Number); return new Date(y,m-1,d); };
function semEpi(s){ const d=parseISO(s), sab=new Date(d); sab.setDate(d.getDate()+(6-d.getDay())); const qua=new Date(sab); qua.setDate(sab.getDate()-3);
  const ano=qua.getFullYear(), j4=new Date(ano,0,4), ini=new Date(j4); ini.setDate(j4.getDate()-j4.getDay()); const dom=new Date(sab); dom.setDate(sab.getDate()-6);
  return {ano,sem:Math.round((dom-ini)/(7*864e5))+1}; }
const PART=['de','da','do','dos','das','e'];
const titulo=t=>String(t||'').toLowerCase().split(' ').map((w,i)=>/^(i|ii|iii|iv|v)$/.test(w)?w.toUpperCase():w==='p.p.'?'P.P.':(i>0&&PART.includes(w))?w:w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
const _ini=0; let D=null, PTS=[], AGS=[], POR_ID={}, filtro=null, ordem={k:'ovos',d:-1}, mapa=null, camada=null;

function prepara(){
  PTS=D.ovitrampas.map(o=>{ const h=(o.hist||[]).filter(x=>x&&x.d&&isFinite(x.n)).sort((a,b)=>a.d.localeCompare(b.d));
    const ov=h.length?h[h.length-1].n:(o.ovos===undefined?null:o.ovos);
    return {id:o.id,rua:o.rua||'',numero:o.numero||'',end:o.rua?(o.rua+(o.numero&&!/^[—–-]+$/.test(o.numero)?', '+o.numero:'')):'',lat:parseFloat(o.lat),lon:parseFloat(o.lon),ovos:ov,hist:h,inst:o.inst||'',rec:o.rec||''}; });
  const byId={}; PTS.forEach(o=>byId[o.id]=o);
  AGS=D.agentes.map(([zona,area,nome,ini,fim,equipe])=>({zona,area:area?titulo(area):'',nome:nome||'',ini,fim,equipe,lista:PTS.filter(o=>o.id>=ini&&o.id<=fim)}));
  POR_ID={}; AGS.forEach(a=>a.lista.forEach(o=>POR_ID[o.id]=a));
  preparaSerie();
}
const nomeAg=a=>a.nome||('Zona '+a.zona), eqTxt=a=>a.equipe?'Equipe '+a.equipe:'Sem equipe';
function indic(l){ const r={n:l.length,com:0,pos:0,ovos:0,b:[0,0,0,0,0,0]}; l.forEach(o=>{ r.b[banda(o.ovos)]++; if(o.ovos!==null&&o.ovos!==undefined){ r.com++; r.ovos+=o.ovos; if(o.ovos>0) r.pos++; } }); r.ipo=r.com?100*r.pos/r.com:null; r.imo=r.pos?r.ovos/r.pos:null; return r; }
const agFil=()=>AGS.filter(a=>filtro===null||(filtro===0?!a.equipe:a.equipe===filtro));
const ptsFil=()=>agFil().flatMap(a=>a.lista);

function chips(){
  const eqs=[...new Set(AGS.map(a=>a.equipe).filter(Boolean))].sort();
  $('chips').innerHTML=[`<button class="chip ${filtro===null?'on':''}" data-f="">Todas</button>`].concat(eqs.map(e=>`<button class="chip ${filtro===e?'on':''}" data-f="${e}" style="${filtro===e?'':'border-color:'+COR_EQ[e]}">Equipe ${e}</button>`)).concat(AGS.some(a=>!a.equipe)?[`<button class="chip ${filtro===0?'on':''}" data-f="0">Sem equipe</button>`]:[]).join(' ');
}
/* legenda de cada quadrado de indicador (aparece escrita no próprio quadrado) */
function legKpi(t,a,ant){
  if(/^IPO/.test(t)) return 'Índice de Positividade: % das ovitrampas com contagem que tiveram 1 ovo ou mais.'+(ant&&ant.ipo!==null&&a?' A seta mostra a diferença em pontos percentuais (p.p.) em relação ao mês anterior ('+fPct(ant.ipo)+' → '+fPct(a.ipo)+'). p.p. é a diferença entre duas porcentagens, não uma porcentagem.':'');
  if(/^IDO/.test(t)) return 'Densidade de Ovos: média de ovos só nas ovitrampas positivas (total de ovos ÷ nº de positivas).';
  if(/^IDV/.test(t)) return 'Média de ovos por ovitrampa com contagem, positivas ou não (total de ovos ÷ nº de ovitrampas).';
  if(/^Positivas/.test(t)) return 'Ovitrampas com 1 ovo ou mais ÷ ovitrampas que tiveram contagem no mês.';
  if(/^Total de ovos/.test(t)) return 'Soma dos ovos contados em todas as ovitrampas no mês.';
  if(/^Sem contagem/.test(t)) return 'Ovitrampas que não tiveram leitura no mês.';
  return '';
}
function kpis(l){ const r=indic(l);
  $('kpis').innerHTML=[[fPct(r.ipo),'IPO'],[fNum(r.imo),'IDO · ovos por positiva'],[fNum(r.com?r.ovos/r.com:null),'IDV · ovos por ovitrampa'],[r.pos+' de '+r.com,'Positivas / com contagem'],[r.ovos,'Total de ovos'],[r.n-r.com,'Sem contagem']].map(([v,t])=>`<div class="kpi"><b>${v}</b><span>${t}</span><em class="kleg">${legKpi(t)}</em></div>`).join('');
  const mx=Math.max(1,...r.b);
  $('dist').innerHTML=FAIXAS.map(([t,c],i)=>`<div class="bandbar">${svgFaixa(i,c,18)}<i style="background:${c};width:${Math.max(2,Math.round(r.b[i]/mx*50))}%"></i><span><b>${r.b[i]}</b> · ${t}</span></div>`).join('');
}
let mostraZero=false, mostraCalor=false;
/* cores iguais às da legenda de ovos: 1–20 verde · 21–50 amarelo · 51–100 laranja · 101+ vermelho (intensidade = ovos/120) */
const GRAD_CALOR={.01:COR_FAIXA[1],.16:COR_FAIXA[1],.17:COR_FAIXA[2],.40:COR_FAIXA[2],.41:COR_FAIXA[3],.82:COR_FAIXA[3],.84:COR_FAIXA[4],1:COR_FAIXA[4]};
/* mapa de calor: cada ovitrampa positiva esquenta o mapa (mais ovos = mais forte) e o calor se liga até a ovitrampa positiva mais próxima,
   para formar manchas contínuas. 0 ovos não esquenta. */
function calorCamada(pts){
  const pos=pts.filter(p=>p[2]>0).map(p=>({la:p[0],lo:p[1],i:Math.min(1,Math.max(.02,p[2]/120))}));
  const kx=Math.cos(-22.5*Math.PI/180), m=(a,b)=>Math.hypot((a.la-b.la)*111320,(a.lo-b.lo)*111320*kx), saida=pos.map(p=>[p.la,p.lo,p.i]);
  pos.forEach((p,k)=>{ let bi=-1,bd=Infinity; pos.forEach((q,j)=>{ if(j===k) return; const d=m(p,q); if(d<bd){ bd=d; bi=j; } });
    if(bi<0||bd>700||bd<25) return; const q=pos[bi], n=Math.floor(bd/25);
    for(let s=1;s<n;s++){ const f=s/n; saida.push([p.la+(q.la-p.la)*f,p.lo+(q.lo-p.lo)*f,p.i+(q.i-p.i)*f]); } });
  return L.heatLayer(saida,{radius:26,blur:18,maxZoom:18,max:1,minOpacity:.3,gradient:GRAD_CALOR});
}
function mapaRender(l){
  if(!mapa){
    mapa=L.map('mapa',{scrollWheelZoom:false});
    const ruas=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Mapa © Esri, HERE, Garmin, OpenStreetMap'});
    const sat=L.layerGroup([L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Imagens © Esri, Maxar'}),L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,opacity:.9})]);
    ruas.addTo(mapa); L.control.layers({'Ruas':ruas,'Satélite':sat},null,{collapsed:true}).addTo(mapa); camada=L.layerGroup().addTo(mapa);
    mapa.on('click',()=>mapa.scrollWheelZoom.enable());
  }
  camada.clearLayers(); const ll=[];
  l.filter(o=>mostraZero||o.ovos!==0).sort((a,b)=>(a.ovos||0)-(b.ovos||0)).forEach(o=>{ if(!isFinite(o.lat)||!isFinite(o.lon)) return; ll.push([o.lat,o.lon]);
    const a=POR_ID[o.id], h=o.hist.slice(-4).reverse();
    marcaFaixa(o.lat,o.lon,o.ovos)
      .bindPopup(`<b>Ovitrampa ${o.id}</b>${o.end?'<br>'+esc(o.end):''}<br>Ovos: <b>${o.ovos===null?'sem contagem':o.ovos}</b>${a?`<br>${esc(nomeAg(a))} · ${esc(eqTxt(a))}<br>${esc(a.area)}`:''}${h.length?'<br><small>'+h.map(x=>x.d.split('-').reverse().join('/')+': '+x.n).join(' · ')+'</small>':''}`).addTo(camada); });
  if(mostraCalor) camada.addLayer(calorCamada(l.map(o=>[o.lat,o.lon,o.ovos||0]).filter(p=>isFinite(p[0])&&isFinite(p[1]))));
  if(ll.length) mapa.fitBounds(ll,{padding:[30,30],maxZoom:17}); setTimeout(()=>mapa.invalidateSize(),50);
  $('leg').innerHTML=FAIXAS.map(([t,c],i)=>`<span>${svgFaixa(i,c,16)}${t}</span>`).join('');
}
function tabelaEquipes(){
  const chaves=[...new Set(AGS.map(a=>a.equipe||0))].sort((a,b)=>(a||99)-(b||99));
  const linhas=chaves.map(k=>{ const ags=AGS.filter(a=>(a.equipe||0)===k), l=ags.flatMap(a=>a.lista), r=indic(l); return {k,ags,r,nome:k?'Equipe '+k:'Sem equipe'}; });
  const g=indic(AGS.flatMap(a=>a.lista));
  $('eqTab').innerHTML=`<table><thead><tr><th>Equipe</th><th class="n">Agentes</th><th class="n">Ovitrampas</th><th class="n">Com contagem</th><th class="n">Positivas</th><th class="n">IPO</th><th class="n">Ovos</th><th class="n">IDO</th></tr></thead><tbody>${linhas.map(x=>`<tr><td><b style="color:${x.k?COR_EQ[x.k]:'#587079'}">● ${x.nome}</b></td><td class="n">${x.ags.length}</td><td class="n">${x.r.n}</td><td class="n">${x.r.com}</td><td class="n">${x.r.pos}</td><td class="n">${fPct(x.r.ipo)}</td><td class="n"><b>${x.r.ovos}</b></td><td class="n">${fNum(x.r.imo)}</td></tr>`).join('')}<tr style="background:#dce9f5;font-weight:800"><td>Total</td><td class="n">${AGS.length}</td><td class="n">${g.n}</td><td class="n">${g.com}</td><td class="n">${g.pos}</td><td class="n">${fPct(g.ipo)}</td><td class="n">${g.ovos}</td><td class="n">${fNum(g.imo)}</td></tr></tbody></table>`;
}
function tabelaAgentes(){
  const k=ordem.k, d=ordem.d;
  const l=agFil().map(a=>({a,i:indic(a.lista)}));
  const val={zona:x=>x.a.zona,nome:x=>(x.a.nome||'~').toLowerCase(),area:x=>x.a.area.toLowerCase(),ovit:x=>x.i.n,pos:x=>x.i.pos,ipo:x=>x.i.ipo===null?-1:x.i.ipo,ovos:x=>x.i.ovos,imo:x=>x.i.imo===null?-1:x.i.imo}[k];
  l.sort((x,y)=>{ const a=val(x), b=val(y); return (a<b?-1:a>b?1:x.a.zona-y.a.zona)*d; });
  const th=(c,t,n)=>`<th class="${n?'n':''}"><button data-k="${c}" type="button">${t}${k===c?(d>0?' ▲':' ▼'):''}</button></th>`;
  $('agTab').innerHTML=`<table><thead><tr>${th('zona','Zona',1)}${th('nome','Agente')}${th('area','Área')}<th>Equipe</th>${th('ovit','Ovit.',1)}${th('pos','Positivas',1)}${th('ipo','IPO',1)}${th('ovos','Ovos',1)}${th('imo','IDO',1)}</tr></thead><tbody>${l.map(({a,i})=>`<tr><td class="n">${a.zona}</td><td>${esc(nomeAg(a))}</td><td>${esc(a.area||'—')}</td><td>${esc(eqTxt(a))}</td><td class="n">${i.n}</td><td class="n">${i.pos}</td><td class="n">${fPct(i.ipo)}</td><td class="n"><b>${i.ovos}</b></td><td class="n">${fNum(i.imo)}</td></tr>`).join('')}</tbody></table>`;
}
function criticos(l){
  const c=l.filter(o=>o.ovos>0).sort((a,b)=>b.ovos-a.ovos||a.id-b.id).slice(0,25);
  $('crit').innerHTML=c.length?`<table><thead><tr><th>ID ovitrampa</th>${D.identificado&&D.identificado.enderecos===false?'':'<th>Endereço</th>'}<th>Agente</th><th>Equipe</th><th class="n">Ovos</th></tr></thead><tbody>${c.map(o=>{ const a=POR_ID[o.id]; return `<tr><td><span class="pill">${o.id}</span></td>${D.identificado&&D.identificado.enderecos===false?'':`<td>${esc(o.end||'—')}</td>`}<td>${esc(a?nomeAg(a):'—')}</td><td>${esc(a?eqTxt(a):'—')}</td><td class="n"><span class="ch" style="background:${corOvos(o.ovos)}"></span><b>${o.ovos}</b></td></tr>`; }).join('')}</tbody></table>`:'<p style="padding:14px;margin:0">Nenhuma ovitrampa positiva.</p>';
}
function evolucao(l){
  /* por semana epidemiológica: cada ovitrampa conta uma vez; se foi lida mais de uma vez na mesma semana, vale a média (mesma regra do mês) */
  const m={}; l.forEach(o=>{ const sw={}; o.hist.forEach(h=>{ const s=semEpi(h.d), k=s.ano+'-'+String(s.sem).padStart(2,'0'); const e=sw[k]||(sw[k]={ano:s.ano,sem:s.sem,t:0,c:0}); e.t+=h.n; e.c++; });
    Object.keys(sw).forEach(k=>{ const s=sw[k], v=s.t/s.c, e=m[k]||(m[k]={ano:s.ano,sem:s.sem,n:0,pos:0,ovos:0}); e.n++; e.ovos+=v; if(v>0) e.pos++; }); });
  Object.keys(m).forEach(k=>{ m[k].ovos=Math.round(m[k].ovos); });
  const ks=Object.keys(m).sort().map(k=>m[k]);
  if(!ks.length){ $('evo').innerHTML='<div class="cx"><p class="nota" style="margin:0">Ainda não há registros semanais. Quando os agentes registrarem as contagens no aplicativo e os dados forem publicados, a evolução por semana epidemiológica aparece aqui.</p></div>'; return; }
  const W=720,H=130,T=26,bw=W/ks.length, mx=Math.max(1,...ks.map(e=>e.ovos)), varios=new Set(ks.map(e=>e.ano)).size>1;
  $('evo').innerHTML=`<div class="cx"><svg viewBox="0 0 ${W} ${H+T+30}" width="100%" role="img" aria-label="Total de ovos por semana epidemiológica">${ks.map((e,i)=>{ const h=Math.max(2,e.ovos/mx*H); return `<rect x="${i*bw+8}" y="${T+H-h}" width="${bw-16}" height="${h}" rx="5" fill="#007ECA"/><text x="${i*bw+bw/2}" y="${T+H-h-6}" font-size="13" font-weight="800" text-anchor="middle" fill="#002B68">${e.ovos}</text><text x="${i*bw+bw/2}" y="${T+H+18}" font-size="12" text-anchor="middle" fill="#5B7391">SE ${e.sem}${varios?"/"+String(e.ano).slice(2):""}</text>`; }).join('')}</svg>
  <div class="tw" style="margin-top:10px"><table><thead><tr><th>Semana epidemiológica</th><th class="n">Contagens</th><th class="n">Positivas</th><th class="n">IPO</th><th class="n">Ovos</th><th class="n">IDO</th></tr></thead><tbody>${ks.map(e=>`<tr><td>SE ${e.sem}/${e.ano}</td><td class="n">${e.n}</td><td class="n">${e.pos}</td><td class="n">${fPct(100*e.pos/e.n)}</td><td class="n"><b>${e.ovos}</b></td><td class="n">${fNum(e.pos?e.ovos/e.pos:null)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function cardsEquipes(){
  const chaves=[...new Set(agFil().map(a=>a.equipe||0))].sort((a,b)=>(a||99)-(b||99));
  $('eqCards').innerHTML=chaves.map(k=>{ const ags=agFil().filter(a=>(a.equipe||0)===k), l=ags.flatMap(a=>a.lista), r=indic(l), cor=k?COR_EQ[k]:'#587079';
    return `<div class="eqcard"><header style="background:${cor}"><span>${k?'Equipe '+k:'Sem equipe'}</span><span>${ags.length} agentes · ${r.n} ovitrampas</span></header><div class="corpo"><div class="mini">${[[fPct(r.ipo),'IPO'],[fNum(r.imo),'IDO'],[r.pos+'/'+r.com,'Positivas'],[r.ovos,'Total de ovos']].map(([v,t])=>`<div><b>${v}</b><span>${t}</span></div>`).join('')}</div>
    <div class="tw"><table><thead><tr><th class="n">Zona</th><th>Agente</th><th>Área</th><th class="n">Ovit.</th><th class="n">Posit.</th><th class="n">IPO</th><th class="n">Ovos</th><th class="n">IDO</th></tr></thead><tbody>${ags.slice().sort((a,b)=>a.zona-b.zona).map(a=>{ const i=indic(a.lista); return `<tr><td class="n">${a.zona}</td><td>${esc(nomeAg(a))}</td><td>${esc(a.area||'—')}</td><td class="n">${i.n}</td><td class="n">${i.pos}</td><td class="n">${fPct(i.ipo)}</td><td class="n"><b>${i.ovos}</b></td><td class="n">${fNum(i.imo)}</td></tr>`; }).join('')}</tbody></table></div></div></div>`; }).join('');
}
/* Contagens à parte: pontos estratégicos (PE), aldeia (AI) e outros. Não entram no IPO/IDO/IDV da malha. */
function gruposAParte(){
  return ['pe','ai','outro'].map(cat=>{
    const L=EXTRAS.filter(e=>{ const c=categoriaPonto(e.id); return (c==='malha'?'outro':c)===cat; });  /* ponto extra só com número (ex.: 1001) = “outros pontos” */ if(!L.length) return null;
    let ci=-1; L.forEach(e=>e.serie.forEach((x,i)=>{ if(x!==null&&x!==undefined&&i>ci) ci=i; })); if(ci<0) return null;
    const ex=L.filter(e=>e.serie[ci]!==null&&e.serie[ci]!==undefined), pos=ex.filter(e=>e.serie[ci]>0), tot=ex.reduce((t,e)=>t+e.serie[ci],0);
    return {cat,L,ci,ex,pos,tot};
  }).filter(Boolean);
}
function resumoAParte(){
  const el=$('aparte'); if(!el) return; const G=gruposAParte();
  /* malha: último mês com contagem, mesma regra dos outros grupos */
  const l=ptsFil(); let ci=-1; l.forEach(o=>(SERIE[o.id]||[]).forEach((x,i)=>{ if(x!==null&&x!==undefined&&i>ci) ci=i; }));
  const cards=[];
  if(ci>=0){ const ex=l.filter(o=>vMes(o,ci)!==null&&vMes(o,ci)!==undefined), tot=ex.reduce((t,o)=>t+vMes(o,ci),0), pos=ex.filter(o=>vMes(o,ci)>0).length; cards.push({tit:'Ovitrampas fixas',cls:'malha',ci,n:ex.length,pos,tot,nota:'Base do IPO, IDO e IDV'}); }
  G.forEach(g=>cards.push({tit:CATEGORIAS[g.cat],cls:g.cat,ci:g.ci,n:g.ex.length,pos:g.pos.length,tot:g.tot,nota:'Contagem à parte'}));
  el.innerHTML=cards.length?`<div class="gcards">${cards.map(g=>`<div class="gcard g-${g.cls}"><header><b>${g.tit}</b><small>${g.nota} · ${rotMes(MESES[g.ci])}</small></header><div class="gipo"><b>${fPct(g.n?100*g.pos/g.n:null)}</b><span>IPO</span></div><div class="gnum"><div><b>${g.n}</b><span>Ovitrampas</span></div><div><b>${g.pos}</b><span>Positivos</span></div><div><b>${fOv(g.pos?g.tot/g.pos:null)}</b><span>IDO</span></div><div><b>${fOv(g.tot)}</b><span>Ovos</span></div></div></div>`).join('')}</div><p class="nota">As ovitrampas de pontos estratégicos (borracharias etc.) e de aldeia têm contagem própria: não entram no IPO, IDO e IDV da malha.</p>`:'<p>Nenhuma ovitrampa nesta base.</p>';
}
function render(){
  const l=ptsFil(); chips(); kpis(l); resumoAParte(); mapaRender(l); tabelaEquipes(); tabelaAgentes(); criticos(l); evolucao(l); cardsEquipes(); alertasRender();
  if(aba==='mensal') mensalRender(); if(aba==='focos') focosRender(); if(aba==='hist') histRender(); if(aba==='zap') zapRender();
  const q=D.gerado?new Date(D.gerado).toLocaleString('pt-BR'):null;
  $('atual').textContent=q?'Dados de '+q:'';
  $('rod').innerHTML=`<b>IPO</b> = ovitrampas positivas (com 1 ovo ou mais) ÷ ovitrampas com contagem. <b>IDO</b> = total de ovos ÷ ovitrampas positivas. <b>IDV</b> = total de ovos ÷ ovitrampas com contagem. Ovitrampas sem contagem não entram nos cálculos.<br>Fonte: arquivos de dados publicados em ${q||'—'}${D.ano?' · ano '+D.ano:''} · Gerado em ${new Date().toLocaleString('pt-BR')}.`;
  $('aviso').innerHTML='';
  updUrl();
}
let ENDER=null, AGEN=null, MAN=null, anoSel=null;
/* monta o objeto D (formato usado pelas telas) a partir dos arquivos data/: endereços + agentes + um ano */
function montaD(m,ender,ag,Y){
  const serie=(Y&&Y.serie)||{}, campo=(Y&&Y.campo)||{}, atual=(Y&&Y.atual)||{};
  const ult=a=>{ for(let i=a.length-1;i>=0;i--) if(a[i]!==null&&a[i]!==undefined) return a[i]; return null; };
  const ovitrampas=ender.ovitrampas.map(o=>{ const c=campo[o.id]||{}; const v=atual[o.id]!==undefined?atual[o.id]:(serie[o.id]?ult(serie[o.id]):null);
    return {id:o.id,rua:o.rua,numero:o.numero,lat:o.lat,lon:o.lon,ovos:v,inst:c.inst,rec:c.rec,hist:c.hist||[]}; });
  const extras=(Y&&Y.extras)?Object.keys(Y.extras).map(k=>{ const e=(ender.extras||[]).find(x=>x.id===k)||{}; return {id:k,lat:e.lat,lon:e.lon,base:Y.extras[k].base,serie:Y.extras[k].serie}; }):[];
  return {gerado:m.atualizado,identificado:{nomes:ag.agentes.some(a=>a.nome),enderecos:ender.ovitrampas.some(o=>o.rua)},ovitrampas,
    agentes:ag.agentes.map(a=>[a.zona,a.area,a.nome,a.ini,a.fim,a.equipe]),meses:Y?Y.meses:[],serie,base:Y?Y.base:{},multi:Y?Y.multi:{},extras,ano:Y?Y.ano:null,anos:m.anos};
}
function seletorAno(){
  const s=$('selAno'); if(!s) return;
  s.innerHTML=(MAN.anos||[]).slice().reverse().map(a=>`<option value="${a}" ${a===anoSel?'selected':''}>${a}</option>`).join('');
  s.parentElement.style.display=(MAN.anos||[]).length>1?'inline-flex':'none';
}
async function carrega(novoAno){
  try{
    MAN=await Dados.manifest(); ENDER=await Dados.arquivo('enderecos'); AGEN=await Dados.arquivo('agentes');
    anoSel=novoAno||anoSel||MAN.ano_atual;
    const Y=anoSel?await Dados.ano(anoSel):null;
    D=montaD(MAN,ENDER,AGEN,Y); D._fonte='dados.json';
  }catch(e){ window.bootErro(e); return; }
  if(window.splashFim) window.splashFim();
  seletorAno(); prepara(); render();
}
function mostraAba(a){
  aba=a; ['resumo','mensal','focos','hist','zap'].forEach(t=>{ $('tab-'+t).classList.toggle('off',t!==a); });
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===a));
  if(a==='mensal') mensalRender(); else if(timer){ clearInterval(timer); timer=null; }
  if(a==='focos') focosRender();
  if(a==='hist') histRender();
  if(a==='zap') zapRender();
  if(a==='resumo') setTimeout(()=>mapa&&mapa.invalidateSize(),60);
  updUrl();
}
function updUrl(){ try{ const u=new URL(location.href); filtro===null?u.searchParams.delete('equipe'):u.searchParams.set('equipe',filtro); aba==='resumo'?u.searchParams.delete('aba'):u.searchParams.set('aba',aba); (aba==='mensal'&&MESES.length)?u.searchParams.set('mes',MESES[mesSel]):u.searchParams.delete('mes'); history.replaceState(null,'',u); }catch(e){} }
function imprime(tudo){
  const atual=aba;
  const depois=()=>{ setTimeout(()=>{ bs.forEach(([m,b])=>{ try{ m.invalidateSize({animate:false}); m.fitBounds(b,{animate:false}); }catch(e){} }); setTimeout(()=>window.print(),500); },150); };
  window.onafterprint=()=>{ window.onafterprint=null; mostraAba(atual); };
  if(tudo){ ['resumo','mensal','focos'].forEach(t=>$('tab-'+t).classList.remove('off')); aba='mensal'; mensalRender(); focosRender(); }
  depois();
}
document.addEventListener('click',e=>{
  const c=e.target.closest('.chip[data-f]'); if(c){ filtro=c.dataset.f===''?null:+c.dataset.f; render(); return; }
  const tb=e.target.closest('#tabs button'); if(tb){ mostraAba(tb.dataset.t); return; }
  const hm=e.target.closest('[data-heat]'); if(hm){ metHeat=hm.dataset.heat; if(timer){ clearInterval(timer); timer=null; } mensalRender(); return; }
  const mm=e.target.closest('[data-m]'); if(mm&&aba==='mensal'){ mesSel=+mm.dataset.m; if(timer){ clearInterval(timer); timer=null; } atualizaMes(false); return; }
  const b=e.target.closest('th button[data-k]'); if(b){ const k=b.dataset.k; ordem=ordem.k===k?{k,d:-ordem.d}:{k,d:(k==='nome'||k==='area'||k==='zona')?1:-1}; tabelaAgentes(); }
});
document.addEventListener('input',e=>{ if(e.target.id==='kRng'){ kFoco=+e.target.value; focosRender(); const r=$('kRng'); if(r){ r.focus(); } } });
$('btnImp').addEventListener('click',()=>imprime(false));
$('btnImpTudo').addEventListener('click',()=>imprime(true));
$('btnRec').addEventListener('click',()=>{ Dados.limpa(); carrega(); });
if($('selAno')) $('selAno').addEventListener('change',e=>{ mesInit=false; Dados.limpa(); carrega(+e.target.value); });
