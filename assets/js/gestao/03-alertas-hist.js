/* gestao/03-alertas-hist.js — Alertas do mês e Histórico por ovitrampa. Carregado em ordem por gestao.html (mesmo escopo global dos outros arquivos de assets/js/gestao/). */
/* ===== alertas do mês (comparação com o mês anterior) e histórico por ovitrampa ===== */
const LIM_SUBIDA={min:30,fator:1.5};   /* "subiu muito": +30 ovos ou mais E pelo menos 1,5× o mês anterior */
function alertasRender(){
  const el=$('alertas'); if(!el) return;
  if(!temSerie()||MESES.length<2){ el.innerHTML=''; return; }
  const u=MESES.length-1, p=u-1, l=ptsFil();
  const par=l.map(o=>({o,a:vMes(o,p),b:vMes(o,u)})).filter(x=>x.a!==null&&x.a!==undefined&&x.b!==null&&x.b!==undefined);
  const novas=par.filter(x=>x.a===0&&x.b>0).sort((x,y)=>y.b-x.b);
  const subiu=par.filter(x=>x.a>0&&x.b-x.a>=LIM_SUBIDA.min&&x.b>=x.a*LIM_SUBIDA.fator).sort((x,y)=>(y.b-y.a)-(x.b-x.a));
  const neg=par.filter(x=>x.a>0&&x.b===0);
  const semEnd=D.identificado&&D.identificado.enderecos===false;
  const linhas=(lst,max)=>lst.slice(0,max).map(x=>{ const a=POR_ID[x.o.id]; return `<tr><td><button type="button" class="lk" data-id="${x.o.id}"><b>${x.o.id}</b></button></td>${semEnd?'':`<td>${esc(x.o.end||'—')}</td>`}<td>${a?esc(nomeAg(a)):'—'}</td><td class="n">${x.a}</td><td class="n"><b>${x.b}</b></td><td>${spark(SERIE[x.o.id]||[],110,22)}</td></tr>`; }).join('');
  const tab=(tit,lst,cor)=>`<div class="cx alt" style="border-top-color:${cor}"><h3 style="color:${cor}">${tit} <span class="pill">${lst.length}</span></h3>${lst.length?`<div class="tw" style="max-height:300px"><table><thead><tr><th>ID ovitrampa</th>${semEnd?'':'<th>Endereço</th>'}<th>Agente</th><th class="n">${rotMes(MESES[p])}</th><th class="n">${rotMes(MESES[u])}</th><th>Ano</th></tr></thead><tbody>${linhas(lst,40)}</tbody></table></div>`:'<p class="nota">Nenhuma.</p>'}</div>`;
  el.innerHTML=`<h2>Alertas: ${rotMes(MESES[u])} comparado com ${rotMes(MESES[p])}</h2><div class="alts">${tab('Ficaram positivas (0 → mais de 0)',novas,'#e60026')}${tab('Subiram muito (+'+LIM_SUBIDA.min+' ovos e 1,5× ou mais)',subiu,'#ff7a00')}${tab('Negativaram (voltaram a 0)',neg,'#22bf4a')}</div><p class="nota">Compara só as ovitrampas com contagem nos dois meses. Toque no número da ovitrampa para ver o histórico dela.</p>`;
}
let histId=null;
function histRender(){
  const box=$('tab-hist'); if(!box) return;
  if(!temSerie()){ box.innerHTML='<div class="cx"><h2>Histórico por ovitrampa</h2><p>Disponível quando a série mensal for publicada.</p></div>'; return; }
  const l=ptsFil().slice().sort((a,b)=>a.id-b.id), semEnd=D.identificado&&D.identificado.enderecos===false;
  if(histId===null||!l.some(o=>o.id===histId)) histId=l.length?l[0].id:null;
  const o=l.find(x=>x.id===histId); let h=`<h2>Histórico por ovitrampa</h2><div class="filtros noprint"><label style="font-weight:800">Ovitrampa nº <input type="number" id="hId" list="hLista" value="${histId??''}" min="1" style="width:90px;padding:8px;border:2px solid var(--line);border-radius:10px;font:inherit;font-weight:800"></label><datalist id="hLista">${l.map(x=>`<option value="${x.id}">`).join('')}</datalist><button type="button" id="hAnt">◀</button><button type="button" id="hProx">▶</button><button type="button" id="hPrn" class="pri" style="display:inline-flex;align-items:center;gap:8px">${SVG_PRN} Imprimir esta ovitrampa</button></div>`;
  if(o){ const s=SERIE[o.id]||[], v=s.filter(x=>x!==null&&x!==undefined), pos=v.filter(x=>x>0).length, tot=v.reduce((t,x)=>t+x,0), mx=v.length?Math.max(...v):null, a=POR_ID[o.id];
    const ult=s.length?s[s.length-1]:null, ant=s.length>1?s[s.length-2]:null;
    const seta=(ult===null||ant===null||ult===undefined||ant===undefined)?'—':ult>ant?'▲ subiu':ult<ant?'▼ caiu':'= igual';
    h+=`<div class="cx"><h3 style="font-size:20px">Ovitrampa ${o.id}${o.end&&!semEnd?' · '+esc(o.end):''}</h3><p class="nota">${a?esc(nomeAg(a))+' · '+esc(eqTxt(a))+' · '+esc(a.area||''):'Sem agente definido'}</p>
    <div class="kpis">${[[fOv(ult),'Último mês · '+seta],[pos+' de '+v.length,'Meses positivos'],[fOv(tot),'Ovos no ano'],[fOv(mx),'Maior contagem']].map(([x,t])=>`<div class="kpi"><b>${x}</b><span>${t}</span></div>`).join('')}</div>
    <h3 style="margin-top:14px">Ovos por mês</h3>${svgLinhas([{cor:'#002868',vals:s}],150,true)}
    <div class="tw"><table><thead><tr><th>Mês</th>${MESES.map(m=>`<th class="n">${rotMes(m)}</th>`).join('')}</tr></thead><tbody><tr><td>Ovos</td>${MESES.map((m,i)=>`<td class="n" style="background:${s[i]===null||s[i]===undefined?'#fff':corOvos(s[i])+'55'}"><b>${fOv(s[i]===undefined?null:s[i])}</b></td>`).join('')}</tr></tbody></table></div>
    ${(o.hist&&o.hist.length)?`<h3 style="margin-top:14px">Últimas contagens semanais</h3><p>${o.hist.slice().reverse().map(x=>`<span class="pill">${x.d.split('-').reverse().join('/')}: <b>${x.n}</b></span>`).join(' ')}</p>`:''}</div>`; }
  h+=`<section><h2>Todas as ovitrampas (toque para abrir)</h2><div class="tw" style="max-height:520px"><table><thead><tr><th>ID ovitrampa</th>${semEnd?'':'<th>Endereço</th>'}<th>Agente</th><th class="n">Meses +</th><th class="n">Ovos no ano</th><th>Evolução</th></tr></thead><tbody>${l.map(x=>{ const s=SERIE[x.id]||[], a=POR_ID[x.id]; return `<tr><td><button type="button" class="lk" data-id="${x.id}"><b>${x.id}</b></button></td>${semEnd?'':`<td>${esc(x.end||'—')}</td>`}<td>${a?esc(nomeAg(a)):'—'}</td><td class="n">${s.filter(y=>y>0).length}</td><td class="n">${s.reduce((t,y)=>t+(y||0),0)}</td><td>${spark(s,120,22)}</td></tr>`; }).join('')}</tbody></table></div></section>`;
  box.innerHTML=h;
  const ir=id=>{ if(l.some(x=>x.id===id)){ histId=id; histRender(); window.scrollTo({top:0}); } };
  const inp=$('hId'); if(inp) inp.onchange=()=>ir(+inp.value);
  const i=l.findIndex(x=>x.id===histId); if($('hAnt')) $('hAnt').onclick=()=>l[i-1]&&ir(l[i-1].id); if($('hProx')) $('hProx').onclick=()=>l[i+1]&&ir(l[i+1].id);
  box.querySelectorAll('.lk').forEach(b=>b.onclick=()=>ir(+b.dataset.id));
  if($('hPrn')) $('hPrn').onclick=()=>{ const o=l.find(x=>x.id===histId); if(!o) return; const a=POR_ID[o.id]; imprimeAlvo(box.querySelector('.cx'),'Histórico da ovitrampa '+o.id+(o.end&&!semEnd?' · '+o.end:''),(a?'Agente: '+nomeAg(a)+' · '+eqTxt(a)+(a.area?' · '+a.area:''):'Sem agente definido')+' · Ano '+(D.ano||MESES[0].slice(0,4))); };
}
document.addEventListener('click',e=>{ const b=e.target.closest&&e.target.closest('#alertas .lk'); if(b){ histId=+b.dataset.id; mostraAba('hist'); window.scrollTo({top:0}); } });

