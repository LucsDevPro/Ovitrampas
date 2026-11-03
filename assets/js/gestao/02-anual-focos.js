/* gestao/02-anual-focos.js — Análise anual e Focos e alertas (gráficos SVG, tabelas, mapa do mês). Carregado em ordem por gestao.html (mesmo escopo global dos outros arquivos de assets/js/gestao/). */
/* ===================== ANÁLISE MENSAL E FOCOS (série do ano) ===================== */
const MES_PT=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MES_LONGO=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const rotMes=m=>MES_PT[+m.slice(5,7)-1]+'/'+m.slice(2,4);
const nomeMes=m=>MES_LONGO[+m.slice(5,7)-1]+' de '+m.slice(0,4);
let mesInit=false, MESES=[], SERIE={}, BASE={}, EXTRAS=[], MULTI={}, mesSel=0, aba='resumo', mapaM=null, camM=null, extM=null, timer=null, kFoco=6, metHeat='ipo';
const temSerie=()=>MESES.length>0;
function preparaSerie(){
  MESES=D.meses||[]; SERIE=D.serie||{}; BASE=D.base||{}; MULTI=D.multi||{};
  EXTRAS=(D.extras||[]).map(e=>({id:e.id,lat:parseFloat(e.lat),lon:parseFloat(e.lon),base:e.base,serie:e.serie||[],ovos:(e.serie||[]).length?e.serie[e.serie.length-1]:null}));
  if(!mesInit&&MESES.length){ mesSel=MESES.length-1; mesInit=true; }
  if(mesSel>=MESES.length||mesSel<0) mesSel=Math.max(0,MESES.length-1);
}
const vMes=(o,i)=>{ const a=SERIE[o.id]; return (a&&a[i]!==undefined)?a[i]:null; };
function metMes(l,i){
  let n=0,pos=0,ov=0,bs=0;
  l.forEach(o=>{ const v=vMes(o,i); if(v===null) return; n++; ov+=v; if(v>0) pos++; if(BASE[o.id]!==undefined) bs+=BASE[o.id]; });
  return {n,pos,ov,ipo:n?100*pos/n:null,ido:pos?ov/pos:null,idv:n?ov/n:null,rel:bs?ov/bs:null};
}
const fOv=x=>x===null||x===undefined?'—':(Math.round(x*10)/10).toLocaleString('pt-BR');
const fDelta=(a,b,pp)=>{ if(a===null||b===null||a===undefined||b===undefined) return '—'; const d=a-b; const t=pp?(d>=0?'+':'')+d.toFixed(1).replace('.',',')+' p.p.':(b?((d>=0?'+':'')+(100*d/b).toFixed(1).replace('.',',')+'%'):'—'); return `<span class="${d>0?'sobe':d<0?'desce':''}">${d>0?'▲':d<0?'▼':'■'} ${t}</span>`; };
const corMes=i=>i===mesSel?'#002B68':'#007ECA';

/* ---- gráficos em SVG ---- */
function svgBarras(vals,fmt,cor,h){
  h=h||140; const n=vals.length, W=720, bw=W/n, mx=Math.max(1e-9,...vals.filter(v=>v!==null));
  return `<svg viewBox="0 0 ${W} ${h+34}" width="100%" role="img">${vals.map((v,i)=>{ const hh=v===null?0:Math.max(2,v/mx*h);
    return `<g class="mb" data-m="${i}" style="cursor:pointer"><rect x="${i*bw}" y="0" width="${bw}" height="${h+34}" fill="transparent"/><rect x="${i*bw+9}" y="${h-hh+16}" width="${bw-18}" height="${hh}" rx="5" fill="${i===mesSel?'#002B68':cor}"/><text x="${i*bw+bw/2}" y="${h-hh+11}" font-size="12.5" font-weight="800" text-anchor="middle" fill="#002B68">${v===null?'—':fmt(v)}</text><text x="${i*bw+bw/2}" y="${h+31}" font-size="12.5" font-weight="${i===mesSel?800:500}" text-anchor="middle" fill="${i===mesSel?'#002B68':'#5B7391'}">${rotMes(MESES[i])}</text></g>`; }).join('')}</svg>`;
}
function svgLinhas(series,h,todos){
  h=h||150; const n=MESES.length, W=720, bw=W/n, all=series.flatMap(s=>s.vals.filter(v=>v!==null)), mx=Math.max(1e-9,...all)*1.15;
  const X=i=>i*bw+bw/2, Y=v=>h-(v/mx)*h+14;
  return `<svg viewBox="0 0 ${W} ${h+36}" width="100%" role="img">${[0,.5,1].map(t=>`<line x1="0" x2="${W}" y1="${Y(mx*t)}" y2="${Y(mx*t)}" stroke="#E1EAF3"/>`).join('')}
  ${series.map(s=>{ const pts=s.vals.map((v,i)=>v===null?null:[X(i),Y(v)]).filter(Boolean); return `<polyline fill="none" stroke="${s.cor}" stroke-width="3.5" stroke-linejoin="round" points="${pts.map(p=>p.join(',')).join(' ')}"/>`+s.vals.map((v,i)=>v===null?'':`<circle cx="${X(i)}" cy="${Y(v)}" r="${i===mesSel?6:3.8}" fill="${s.cor}" stroke="#fff" stroke-width="2"/>`+((todos||i===mesSel||i===n-1)?`<text x="${X(i)}" y="${Y(v)-10}" font-size="12.5" font-weight="800" text-anchor="middle" fill="${s.cor}">${fOv(v)}</text>`:'')).join(''); }).join('')}
  ${MESES.map((m,i)=>`<g class="mb" data-m="${i}" style="cursor:pointer"><rect x="${i*bw}" y="${h+18}" width="${bw}" height="22" fill="transparent"/><text x="${X(i)}" y="${h+32}" font-size="12.5" font-weight="${i===mesSel?800:500}" text-anchor="middle" fill="${i===mesSel?'#002B68':'#5B7391'}">${rotMes(m)}</text></g>`).join('')}</svg>`;
}
function spark(vals,w,h){
  w=w||110; h=h||24; const mx=Math.max(1,...vals.filter(v=>v!==null)), bw=w/vals.length;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="vertical-align:middle">${vals.map((v,i)=>v===null?`<line x1="${i*bw+2}" x2="${i*bw+bw-2}" y1="${h-1}" y2="${h-1}" stroke="#C5D6E8" stroke-width="2"/>`:`<rect x="${i*bw+1}" y="${h-Math.max(2,v/mx*h)}" width="${bw-2}" height="${Math.max(2,v/mx*h)}" fill="${corOvos(v)}" stroke="#222" stroke-width=".8"/>`).join('')}</svg>`;
}
const mixC=(a,b,t)=>{ const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)); const x=p(a),y=p(b); return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join(''); };
const escala=t=>t<=.5?mixC('#EAF3FB','#FFD166',t*2):mixC('#FFD166','#E5383B',(t-.5)*2);

/* ---- aba Análise anual ---- */
function mensalRender(){
  const box=$('tab-mensal');
  if(!temSerie()){ box.innerHTML='<div class="cx"><h2>Análise anual</h2><p>Ainda não há série mensal publicada. No mapa de campo: <b>Dados e conferência → Importar planilha ou backup</b> (planilha “contaovos-contagens”), depois <b>Publicar dados para a gestão</b> e envie o dados.json ao GitHub.</p></div>'; return; }
  const l=ptsFil(), n=MESES.length, M=MESES.map((_,i)=>metMes(l,i)), a=M[mesSel], ant=mesSel>0?M[mesSel-1]:null;
  const chipsM=`<div class="filtros noprint">${MESES.map((m,i)=>`<button class="chip ${i===mesSel?'on':''}" data-m="${i}">${rotMes(m)}</button>`).join(' ')}<button class="chip" id="btnPlay" type="button">${timer?'⏸ Parar':'▶ Animar'}</button></div>`;
  const kp=[[fPct(a.ipo),'IPO',ant?fDelta(a.ipo,ant.ipo,true):''],[fOv(a.ido),'IDO (ovos por positiva)',ant?fDelta(a.ido,ant.ido):''],[fOv(a.idv),'IDV (ovos por ovitrampa)',ant?fDelta(a.idv,ant.idv):''],[a.pos+' de '+a.n,'Positivas / ovitrampas',''],[fOv(a.ov),'Total de ovos',ant?fDelta(a.ov,ant.ov):'']];
  let h=`<h2>Análise de ${nomeMes(MESES[mesSel])}</h2>${chipsM}
  <div class="kpis">${kp.map(([v,t,d])=>`<div class="kpi"><b>${v}</b><span>${t}</span><small>${d||'&nbsp;'}</small><em class="kleg">${legKpi(t,a,ant)}</em></div>`).join('')}</div>`;
  if(MULTI[MESES[mesSel]]) h+=`<div class="aviso">Em ${nomeMes(MESES[mesSel])} cada ovitrampa teve ${MULTI[MESES[mesSel]]} leituras. Os números usam a <b>média</b> das leituras do mês.</div>`;
  h+=`<section><h2>Insights do período</h2><div class="cx"><ul class="ins">${insights(M).map(x=>`<li>${x}</li>`).join('')}</ul></div></section>`;
  h+=`<section class="duas3"><div class="cx"><h3>IPO por mês (%)</h3>${svgBarras(M.map(x=>x.ipo),v=>v.toFixed(0)+'%','#007ECA')}</div><div class="cx"><h3>Média de ovos: IDO e IDV</h3>${svgLinhas([{nome:'IDO',cor:'#E0182D',vals:M.map(x=>x.ido)},{nome:'IDV',cor:'#00A651',vals:M.map(x=>x.idv)}])}<div class="leg"><span><i style="background:#E0182D"></i>IDO · ovos por ovitrampa positiva</span><span><i style="background:#00A651"></i>IDV · ovos por ovitrampa</span></div></div></section>`;
  h+=`<section><div class="cx"><h3>Total de ovos por mês</h3>${svgBarras(M.map(x=>x.ov),v=>Math.round(v).toLocaleString('pt-BR'),'#FFB900')}</div></section>`;
  h+=`<section><h2>Mês a mês</h2><div class="tw"><table><thead><tr><th>Mês</th><th class="n">Ovitrampas</th><th class="n">Positivas</th><th class="n">IPO</th><th class="n">Δ IPO</th><th class="n">Ovos</th><th class="n">Δ ovos</th><th class="n">IDO</th><th class="n">IDV</th></tr></thead><tbody>${M.map((x,i)=>`<tr class="${i===mesSel?'sel':''}" data-m="${i}" style="cursor:pointer"><td><b>${nomeMes(MESES[i]).split(' de ')[0]}</b>${MULTI[MESES[i]]?' <small title="média de 2 leituras">*</small>':''}</td><td class="n">${x.n}</td><td class="n">${x.pos}</td><td class="n">${fPct(x.ipo)}</td><td class="n">${i?fDelta(x.ipo,M[i-1].ipo,true):'—'}</td><td class="n"><b>${Math.round(x.ov).toLocaleString('pt-BR')}</b></td><td class="n">${i?fDelta(x.ov,M[i-1].ov):'—'}</td><td class="n">${fOv(x.ido)}</td><td class="n">${fOv(x.idv)}</td></tr>`).join('')}</tbody></table></div>${Object.keys(MULTI).length?'<p class="nota">* Mês com mais de uma leitura por ovitrampa: usa-se a média das leituras.</p>':''}</section>`;
  h+=`<section><h2>Mapa do mês</h2><div class="cx"><div class="noprint" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><label class="zero" style="margin:0"><input type="checkbox" class="chkZero" ${mostraZero?'checked':''}> Mostrar 0 ovos</label><label class="zero" style="margin:0"><input type="checkbox" class="chkCalor" ${mostraCalor?'checked':''}> Mapa de calor</label><input type="range" id="rng" min="0" max="${n-1}" value="${mesSel}" style="flex:1;min-width:180px"><b id="rngTxt">${nomeMes(MESES[mesSel])}</b><label style="font-weight:700;font-size:13px"><input type="checkbox" id="chkExtras" ${$('chkExtras')&&!$('chkExtras').checked?'':'checked'}> pontos estratégicos (◆) e aldeia (●)</label></div><div id="mapaM"></div><div class="leg">${FAIXAS.map(([t,c],i)=>`<span>${svgFaixa(i,c,16)}${t}</span>`).join('')}<span><b class="lgext"></b>ovitrampa em ponto estratégico (losango) · <b class="lgext ai"></b>aldeia (círculo): cor = faixa de ovos</span></div></div></section>`;
  h+=`<section><h2>Mapa de calor: equipes e áreas por mês</h2><div class="filtros noprint"><b style="color:var(--navy)">Métrica:</b> ${[['ipo','IPO %'],['idv','IDV · ovos por ovitrampa'],['ov','Total de ovos']].map(([k,t])=>`<button class="chip ${metHeat===k?'on':''}" data-heat="${k}">${t}</button>`).join(' ')}</div><div class="tw" style="max-height:620px" id="heat">${heatHtml()}</div></section>`;
  h+=`<section><h2>Quem mais mudou em ${rotMes(MESES[mesSel])}</h2>${variacaoHtml()}</section>`;
  box.innerHTML=h; mapaMensal();
}
function insights(M){
  const v=(f)=>M.map(f), idx=(arr,fn)=>arr.reduce((b,x,i)=>x!==null&&(b<0||fn(x,arr[b]))?i:b,-1);
  const ipo=v(x=>x.ipo), idv=v(x=>x.idv), out=[];
  const pk=idx(ipo,(a,b)=>a>b), vl=idx(ipo,(a,b)=>a<b), pkd=idx(idv,(a,b)=>a>b), vld=idx(idv,(a,b)=>a<b), u=M.length-1;
  out.push(`<b>Positividade:</b> pico em ${nomeMes(MESES[pk]).split(' de ')[0]} (${fPct(ipo[pk])}) e menor valor em ${nomeMes(MESES[vl]).split(' de ')[0]} (${fPct(ipo[vl])}).`);
  out.push(`<b>Densidade de ovos (IDV):</b> máxima em ${nomeMes(MESES[pkd]).split(' de ')[0]} (${fOv(idv[pkd])} ovos por ovitrampa) e mínima em ${nomeMes(MESES[vld]).split(' de ')[0]} (${fOv(idv[vld])}).`);
  if(u>0){ const d=ipo[u]-ipo[u-1], dd=idv[u]-idv[u-1]; out.push(`<b>Último mês (${rotMes(MESES[u])}):</b> IPO ${fPct(ipo[u])} (${d>=0?'+':''}${d.toFixed(1).replace('.',',')} p.p. vs ${rotMes(MESES[u-1])}) e IDV ${fOv(idv[u])} (${dd>=0?'+':''}${fOv(dd)}). ${d>0&&dd>0?'Os dois indicadores subiram.':d<0&&dd<0?'Os dois indicadores caíram.':'Os indicadores se moveram em sentidos diferentes.'}`); }
  const l=ptsFil(), est=l.map(o=>({o,s:SERIE[o.id]||[]})).filter(x=>x.s.length);
  const pers=est.filter(x=>x.s.filter(y=>y!==null&&y>0).length>=6).length;
  if(est.length) out.push(`<b>Focos persistentes:</b> ${pers} ovitrampa(s) ficaram positivas em 6 ou mais meses (ver aba “Focos e alertas”).`);
  const eq=[...new Set(AGS.map(a=>a.equipe).filter(Boolean))].sort().map(e=>({e,m:metMes(AGS.filter(a=>a.equipe===e).flatMap(a=>a.lista),u)})).filter(x=>x.m.ipo!==null).sort((a,b)=>b.m.ipo-a.m.ipo);
  if(filtro===null&&eq.length>1) out.push(`<b>Equipes em ${rotMes(MESES[u])}:</b> maior IPO na Equipe ${eq[0].e} (${fPct(eq[0].m.ipo)}); menor na Equipe ${eq[eq.length-1].e} (${fPct(eq[eq.length-1].m.ipo)}).`);
  return out;
}
function heatHtml(){
  const linhas=[]; const eqs=[...new Set(agFil().map(a=>a.equipe||0))].sort((a,b)=>(a||99)-(b||99));
  const val=(lst,i)=>{ const m=metMes(lst,i); return metHeat==='ipo'?m.ipo:metHeat==='idv'?m.idv:(m.n?m.ov:null); };
  eqs.forEach(k=>{ const ags=agFil().filter(a=>(a.equipe||0)===k); linhas.push({tit:true,nome:k?'Equipe '+k:'Zona rural',cor:k?COR_EQ[k]:'#587079',v:MESES.map((_,i)=>val(ags.flatMap(a=>a.lista),i))});
    ags.slice().sort((a,b)=>a.zona-b.zona).forEach(a=>linhas.push({nome:`${a.zona} · ${nomeAg(a)} · ${a.area||'—'}`,v:MESES.map((_,i)=>val(a.lista,i))})); });
  const mxA=Math.max(1e-9,...linhas.filter(x=>!x.tit).flatMap(x=>x.v.filter(y=>y!==null))), mxE=Math.max(1e-9,...linhas.filter(x=>x.tit).flatMap(x=>x.v.filter(y=>y!==null)));
  const fmt=v=>v===null?'—':metHeat==='ipo'?v.toFixed(0)+'%':Math.round(v).toLocaleString('pt-BR');
  return `<table class="heat"><thead><tr><th style="min-width:230px">Equipe / agente · área</th>${MESES.map((m,i)=>`<th class="n ${i===mesSel?'selc':''}" data-m="${i}" style="cursor:pointer">${rotMes(m)}</th>`).join('')}</tr></thead><tbody>${linhas.map(r=>`<tr class="${r.tit?'tit':''}"><td style="${r.tit?'font-weight:800;color:'+r.cor:''}">${r.tit?'● ':''}${esc(r.nome)}</td>${r.v.map((x,i)=>{ const mx=r.tit?mxE:mxA, t=x===null?0:Math.min(1,x/mx); return `<td class="n ${i===mesSel?'selc':''}" style="background:${x===null?'#f7f7f7':escala(t)};color:${t>.8?'#fff':'#0f2a33'}">${fmt(x)}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
}
function variacaoHtml(){
  if(mesSel===0) return '<p class="nota">Selecione um mês depois do primeiro para comparar com o anterior.</p>';
  const rows=agFil().map(a=>{ const x=metMes(a.lista,mesSel), y=metMes(a.lista,mesSel-1); return {a,x,y,d:x.ov-y.ov}; }).filter(r=>r.x.n&&r.y.n);
  const sobe=rows.filter(r=>r.d>0).sort((p,q)=>q.d-p.d).slice(0,8), desce=rows.filter(r=>r.d<0).sort((p,q)=>p.d-q.d).slice(0,8);
  const tb=(t,l,cor)=>`<div><h3 style="color:${cor}">${t}</h3><div class="tw"><table><thead><tr><th>Agente · área</th><th class="n">${rotMes(MESES[mesSel-1])}</th><th class="n">${rotMes(MESES[mesSel])}</th><th class="n">Δ ovos</th></tr></thead><tbody>${l.length?l.map(r=>`<tr><td>${esc(nomeAg(r.a))} · ${esc(r.a.area||'—')}<br><small>${esc(eqTxt(r.a))}</small></td><td class="n">${fOv(r.y.ov)}</td><td class="n">${fOv(r.x.ov)}</td><td class="n"><b style="color:${cor}">${r.d>0?'+':''}${fOv(r.d)}</b></td></tr>`).join(''):'<tr><td colspan="4">Nenhuma.</td></tr>'}</tbody></table></div></div>`;
  return `<div class="duas2">${tb('Mais subiram (ovos)',sobe,'#C62828')}${tb('Mais caíram (ovos)',desce,'#0a7a2f')}</div>`;
}
function mapaMensal(){
  const el=$('mapaM'); if(!el) return;
  if(mapaM){ mapaM.remove(); mapaM=null; }
  mapaM=L.map('mapaM',{scrollWheelZoom:false}); mapaM.on('click',()=>mapaM.scrollWheelZoom.enable());
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Mapa © Esri, HERE, Garmin, OpenStreetMap'}).addTo(mapaM);
  camM=L.layerGroup().addTo(mapaM); extM=L.layerGroup().addTo(mapaM);
  mapaMesPontos(true);
  $('rng').addEventListener('input',e=>{ mesSel=+e.target.value; atualizaMes(false); });
  $('chkExtras').addEventListener('change',()=>mapaMesPontos(false));
  const b=$('btnPlay'); if(b) b.onclick=()=>{ if(timer){ clearInterval(timer); timer=null; b.textContent='▶ Animar'; return; } b.textContent='⏸ Parar'; timer=setInterval(()=>{ mesSel=(mesSel+1)%MESES.length; atualizaMes(false); if(mesSel===MESES.length-1){ clearInterval(timer); timer=null; const bb=$('btnPlay'); if(bb) bb.textContent='▶ Animar'; } },1300); };
  setTimeout(()=>mapaM&&mapaM.invalidateSize(),60);
}
function mapaMesPontos(ajusta){
  if(!mapaM) return; camM.clearLayers(); extM.clearLayers(); const ll=[], i=mesSel;
  ptsFil().filter(o=>vMes(o,i)!==null&&(mostraZero||vMes(o,i)!==0)&&isFinite(o.lat)).sort((a,b)=>vMes(a,i)-vMes(b,i)).forEach(o=>{ const v=vMes(o,i), a=POR_ID[o.id]; ll.push([o.lat,o.lon]);
    marcaFaixa(o.lat,o.lon,v).bindPopup(`<b>Ovitrampa ${o.id}</b>${o.end?'<br>'+esc(o.end):''}<br>${rotMes(MESES[i])}: <b>${fOv(v)} ovos</b>${a?`<br>${esc(nomeAg(a))} · ${esc(eqTxt(a))}`:''}<br>${spark(SERIE[o.id]||[],150,28)}<br><small>${MESES.map(rotMes).join(' · ')}</small>`).addTo(camM); });
  if($('chkExtras')&&$('chkExtras').checked) EXTRAS.filter(e=>e.serie[i]!==null&&e.serie[i]!==undefined&&isFinite(e.lat)).forEach(e=>{ const v=e.serie[i];
    L.marker([e.lat,e.lon],{icon:L.divIcon({className:'',iconSize:[16,16],html:`<div class="ext${categoriaPonto(e.id)==='ai'?' ai':''}" style="background:${corOvos(v)}"></div>`})}).bindPopup(`<b>${esc(CATEGORIAS[categoriaPonto(e.id)]||'Ponto')}: ${esc(e.id)}</b><br>${rotMes(MESES[i])}: <b>${fOv(v)} ovos</b>`).addTo(extM); ll.push([e.lat,e.lon]); });
  if(mostraCalor) camM.addLayer(calorCamada(ptsFil().map(o=>[o.lat,o.lon,vMes(o,i)||0]).filter(p=>isFinite(p[0])&&isFinite(p[1]))));
  if(ajusta&&ll.length) mapaM.fitBounds(ll,{padding:[20,20],maxZoom:18});
}
function atualizaMes(refazTudo){ if(aba==='mensal'){ if(refazTudo){ mensalRender(); } else { const keep=mapaM?mapaM.getBounds():null; const r=$('rng'); const s=document.scrollingElement.scrollTop; mensalRender(); if(keep&&mapaM) mapaM.fitBounds(keep); document.scrollingElement.scrollTop=s; } } updUrl(); }

/* ---- aba Focos e alertas ---- */
function focosRender(){
  const box=$('tab-focos');
  if(!temSerie()){ box.innerHTML='<div class="cx"><h2>Focos e alertas</h2><p>Disponível quando a série mensal for publicada (veja a aba “Análise anual”).</p></div>'; return; }
  const l=ptsFil(), u=MESES.length-1;
  const est=l.map(o=>{ const s=SERIE[o.id]||[], lei=s.filter(x=>x!==null&&x!==undefined).length, pos=s.filter(x=>x!==null&&x>0).length, tot=s.reduce((t,x)=>t+(x||0),0); let mx=-1,mi=-1; s.forEach((x,i)=>{ if(x!==null&&x>mx){ mx=x; mi=i; } }); return {o,s,lei,pos,tot,mx,mi}; }).filter(x=>x.lei);
  const pers=est.filter(x=>x.pos>=kFoco).sort((a,b)=>b.pos-a.pos||b.tot-a.tot);
  const rank=est.slice().sort((a,b)=>b.tot-a.tot).slice(0,15);
  const picos=est.filter(x=>x.mx>=300).sort((a,b)=>b.mx-a.mx);
  const novas=est.filter(x=>x.lei===1&&x.s[u]!==null&&x.s[u]!==undefined);
  const dist=[...Array(MESES.length+1)].map((_,k)=>est.filter(x=>x.pos===k).length);
  const mid=x=>`<span class="pill">${x.o.id}</span>`, endc=x=>esc(x.o.end||'—'), ag=x=>{ const a=POR_ID[x.o.id]; return a?esc(nomeAg(a))+' · '+esc(eqTxt(a)):'—'; };
  const semEnd=D.identificado&&D.identificado.enderecos===false;
  let h=`<h2>Focos e alertas</h2>
  <section><div class="cx"><h3>Ovitrampas positivas em quantos meses?</h3><div class="bandbars">${dist.map((c,k)=>`<div class="bandbar"><i style="background:${k>=kFoco?'#E0182D':'#007ECA'};width:${Math.max(2,Math.round(c/Math.max(1,...dist)*55))}%"></i><span><b>${c}</b> · ${k} ${k===1?'mês':'meses'}</span></div>`).join('')}</div></div></section>
  <section><h2>Focos persistentes</h2><div class="filtros noprint"><label style="font-weight:700">Positivas em pelo menos <b id="kTxt">${kFoco}</b> meses <input type="range" id="kRng" min="2" max="${MESES.length}" value="${kFoco}" style="vertical-align:middle"></label></div>
  <div class="tw">${pers.length?`<table><thead><tr><th>ID ovitrampa</th>${semEnd?'':'<th>Endereço</th>'}<th>Agente</th><th class="n">Meses +</th><th class="n">Ovos no ano</th><th>${MESES.map(rotMes)[0]} → ${rotMes(MESES[u])}</th><th class="n">Pico</th></tr></thead><tbody>${pers.map(x=>`<tr><td>${mid(x)}</td>${semEnd?'':`<td>${endc(x)}</td>`}<td>${ag(x)}</td><td class="n"><b>${x.pos}</b>/${x.lei}</td><td class="n">${fOv(x.tot)}</td><td>${spark(x.s)}</td><td class="n">${fOv(x.mx)} <small>(${rotMes(MESES[x.mi])})</small></td></tr>`).join('')}</tbody></table>`:'<p style="padding:14px;margin:0">Nenhuma ovitrampa com esse critério.</p>'}</div><p class="nota">${pers.length} ovitrampa(s). Ovitrampas que seguem positivas mês após mês indicam criadouros próximos que merecem inspeção.</p></section>
  <section><h2>Ranking do ano: mais ovos acumulados</h2><div class="tw"><table><thead><tr><th>ID ovitrampa</th>${semEnd?'':'<th>Endereço</th>'}<th>Agente</th><th class="n">Ovos no ano</th><th class="n">Meses +</th><th>Evolução</th></tr></thead><tbody>${rank.map(x=>`<tr><td>${mid(x)}</td>${semEnd?'':`<td>${endc(x)}</td>`}<td>${ag(x)}</td><td class="n"><b>${fOv(x.tot)}</b></td><td class="n">${x.pos}/${x.lei}</td><td>${spark(x.s)}</td></tr>`).join('')}</tbody></table></div></section>
  <section><h2>Contagens muito altas para conferir (300 ovos ou mais)</h2><div class="tw">${picos.length?`<table><thead><tr><th>ID ovitrampa</th>${semEnd?'':'<th>Endereço</th>'}<th>Agente</th><th class="n">Maior contagem</th><th>Mês</th></tr></thead><tbody>${picos.map(x=>`<tr><td>${mid(x)}</td>${semEnd?'':`<td>${endc(x)}</td>`}<td>${ag(x)}</td><td class="n"><b>${fOv(x.mx)}</b></td><td>${rotMes(MESES[x.mi])}</td></tr>`).join('')}</tbody></table>`:'<p style="padding:14px;margin:0">Nenhuma.</p>'}</div><p class="nota">Valores extremos podem ser reais, mas vale conferir a leitura e o preenchimento.</p></section>`;
  gruposAParte().forEach(g=>{
    const meses=MESES.map((m,i)=>{ const a=g.L.filter(e=>e.serie[i]!==null&&e.serie[i]!==undefined); if(!a.length) return null; const p=a.filter(e=>e.serie[i]>0).length; return {m,n:a.length,p,t:a.reduce((t,e)=>t+e.serie[i],0)}; }).filter(Boolean);
    h+=`<section><h2>${CATEGORIAS[g.cat]} · ${rotMes(MESES[g.ci])}</h2><div class="cx"><p><b>${g.ex.length}</b> ovitrampa(s) com contagem, <b>${g.pos.length}</b> positivo(s) (IPO ${fPct(100*g.pos.length/g.ex.length)}), IDO ${fOv(g.pos.length?g.tot/g.pos.length:null)}, ${fOv(g.tot)} ovos no total.</p>
    <div class="tw"><table><thead><tr><th>Mês</th><th class="n">Ovitrampas</th><th class="n">Positivos</th><th class="n">IPO</th><th class="n">Ovos</th></tr></thead><tbody>${meses.map(x=>`<tr><td>${rotMes(x.m)}</td><td class="n">${x.n}</td><td class="n">${x.p}</td><td class="n">${fPct(100*x.p/x.n)}</td><td class="n">${fOv(x.t)}</td></tr>`).join('')}</tbody></table></div>
    <div class="tw" style="max-height:340px"><table><thead><tr><th>ID ovitrampa</th><th class="n">Ovos</th><th>Local</th></tr></thead><tbody>${g.ex.slice().sort((a,b)=>b.serie[g.ci]-a.serie[g.ci]).map(e=>`<tr><td><b>${esc(e.id)}</b></td><td class="n">${fOv(e.serie[g.ci])}</td><td>${isFinite(e.lat)?`<a href="https://www.google.com/maps?q=${e.lat},${e.lon}" target="_blank" rel="noopener">mapa</a>`:'—'}</td></tr>`).join('')}</tbody></table></div>
    <p class="nota">Contagem à parte: estas ovitrampas não entram nos indicadores das ovitrampas fixas (1–242).</p></div></section>`;
  });
  h+=`<section><h2>Qualidade dos dados</h2><div class="cx"><ul class="ins"><li><b>${novas.length}</b> ovitrampa(s) entraram só em ${rotMes(MESES[u])} e ainda não têm histórico${novas.length&&novas.every(x=>x.tot===0)?' (todas com 0 ovos)':''}.</li>${Object.keys(MULTI).map(m=>`<li>${nomeMes(m)}: ${MULTI[m]} leituras por ovitrampa. A análise usa a média; somar os registros dobraria os ovos e levaria o IPO acima de 100%.</li>`).join('')}${est.filter(x=>x.lei<MESES.length&&x.lei>1).length?`<li>${est.filter(x=>x.lei<MESES.length&&x.lei>1).length} ovitrampa(s) com leituras em apenas parte dos meses.</li>`:''}</ul></div></section>`;
  box.innerHTML=h;
}

