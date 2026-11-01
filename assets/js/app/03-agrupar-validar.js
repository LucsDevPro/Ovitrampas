/* app/03-agrupar-validar.js — agrupamento por proximidade + validação das coordenadas (conferência). Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== agrupamento por proximidade (prévia) ===================== */
function kmeans(list,k){
  const kx=Math.cos(-22.5*Math.PI/180);
  const P=list.map(o=>[o.lon*kx,o.lat]);
  const d2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
  let first=0; P.forEach((p,i)=>{ if(p[0]<P[first][0]) first=i; });
  const C=[P[first].slice()];
  while(C.length<k){ let best=-1,bd=-1; P.forEach((p,i)=>{ const d=Math.min(...C.map(c=>d2(p,c))); if(d>bd){bd=d;best=i;} }); C.push(P[best].slice()); }
  let asg=new Array(P.length).fill(0);
  for(let it=0;it<40;it++){
    let moved=false;
    P.forEach((p,i)=>{ let b=0,bd=Infinity; C.forEach((c,j)=>{ const d=d2(p,c); if(d<bd){bd=d;b=j;} }); if(asg[i]!==b){asg[i]=b;moved=true;} });
    C.forEach((c,j)=>{ const m=P.filter((_,i)=>asg[i]===j); if(m.length){ c[0]=m.reduce((s,p)=>s+p[0],0)/m.length; c[1]=m.reduce((s,p)=>s+p[1],0)/m.length; } });
    if(!moved) break;
  }
  return asg;
}
let grupos=[];
$('group').addEventListener('click',()=>{
  const list=visibleList(); if(list.length<2){ toast('Poucos pontos visíveis para agrupar.'); return; }
  const size=Math.max(5,Math.min(60,+$('gsize').value||20));
  const k=Math.max(1,Math.round(list.length/size));
  const asg=kmeans(list,k);
  pts.forEach(o=>o.grupo=null);
  const buckets=Array.from({length:k},()=>[]);
  list.forEach((o,i)=>buckets[asg[i]].push(o));
  grupos=buckets.filter(b=>b.length).sort((a,b)=>Math.min(...a.map(o=>o.lon))-Math.min(...b.map(o=>o.lon)));
  grupos.forEach((g,i)=>g.forEach(o=>o.grupo=i));
  reicon(); renderGrupos(); toast(`${grupos.length} grupos criados`);
});
$('ungroup').addEventListener('click',()=>{ pts.forEach(o=>o.grupo=null); grupos=[]; reicon(); renderGrupos(); });
function renderGrupos(){
  $('groups').innerHTML=grupos.map((g,i)=>`<button type="button" data-g="${i}"><i style="background:${GCOL[i%GCOL.length]}"></i>G${i+1} · ${g.length}</button>`).join('');
}
$('groups').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return;
  const g=grupos[+b.dataset.g]; const old=[...sel]; sel.clear(); g.forEach(o=>sel.add(o.id));
  reicon([...new Set([...old,...g.map(o=>o.id)])]); field=true; refresh(true); closeMenu();
  toast(`Grupo G${+b.dataset.g+1}: ${compress(g.map(o=>o.id))}`);
});

/* ===================== validação das coordenadas ===================== */
function validar(){
  const out=[]; const add=(o,nivel,tipo,msg)=>out.push({id:o?o.id:null,nivel,tipo,msg,end:o?o.endereco:'',lat:o?o.latRaw:'',lon:o?o.lonRaw:''});
  const dec=/^-?\d{1,3}\.\d+$/, casas=s=>(s.split('.')[1]||'').length;
  pts.forEach(o=>{
    if(!dec.test(o.latRaw)) add(o,'erro','Formato da latitude','Latitude não está em formato decimal: '+o.latRaw);
    if(!dec.test(o.lonRaw)) add(o,'erro','Formato da longitude','Longitude não está em formato decimal: '+o.lonRaw);
    if(!isFinite(o.lat)||!isFinite(o.lon)) { add(o,'erro','Valor inválido','Não foi possível converter as coordenadas em número.'); return; }
    if(o.lat<-23.0||o.lat>-22.2||o.lon<-56.0||o.lon>-55.3) add(o,'erro','Fora de Ponta Porã','Coordenada fora da região esperada do município.');
    if(Math.min(casas(o.latRaw),casas(o.lonRaw))<=4) add(o,'atenção','Precisão baixa','Coordenada com 4 casas decimais ou menos (erro possível de ~10 m).');
    if(o.ovos===null) add(o,'info','Sem contagem de ovos','Contagem de ovos não informada na base.');
    if(o.semEndereco) add(o,'info','Sem endereço','Endereço não informado na base; localizar só pelas coordenadas.');
  });
  const ok=pts.filter(o=>isFinite(o.lat)&&isFinite(o.lon));
  /* grupos geográficos separados */
  const par=ok.map((_,i)=>i); const f=i=>par[i]===i?i:(par[i]=f(par[i]));
  for(let i=0;i<ok.length;i++) for(let j=i+1;j<ok.length;j++) if(hav(ok[i].lat,ok[i].lon,ok[j].lat,ok[j].lon)<1.5) par[f(i)]=f(j);
  const comps={}; ok.forEach((o,i)=>(comps[f(i)]=comps[f(i)]||[]).push(o));
  const lista=Object.values(comps).sort((a,b)=>b.length-a.length), main=lista[0]||[];
  lista.slice(1).forEach(c=>{
    const dist=Math.min(...c.flatMap(a=>main.map(b=>hav(a.lat,a.lon,b.lat,b.lon))));
    const ids=compress(c.map(o=>o.id));
    c.forEach(o=>add(o,'atenção','Grupo geográfico isolado',`Faz parte de um conjunto de ${c.length} pontos (${ids}) a ${dist.toFixed(1)} km do grupo principal. Confirmar se a região está correta.`));
  });
  /* sobreposição e isolamento */
  ok.forEach((a,i)=>{
    let nn=Infinity;
    ok.forEach((b,j)=>{ if(i===j) return; const d=hav(a.lat,a.lon,b.lat,b.lon)*1000; if(d<nn) nn=d; if(j>i&&d<25) add(a,'atenção','Pontos quase sobrepostos',`A ${d.toFixed(0)} m da ovitrampa ${b.id}. Pode ser duplicidade.`), add(b,'atenção','Pontos quase sobrepostos',`A ${d.toFixed(0)} m da ovitrampa ${a.id}. Pode ser duplicidade.`); });
    if(nn>600 && main.includes(a)) add(a,'info','Ponto isolado',`Vizinho mais próximo a ${nn.toFixed(0)} m — conferir se não é erro de digitação.`);
  });
  /* componentes idênticos */
  [['latRaw','Latitude'],['lonRaw','Longitude']].forEach(([k,nome])=>{
    const m={}; ok.forEach(o=>{ if(casas(o[k])>=6)(m[o[k]]=m[o[k]]||[]).push(o); });
    Object.entries(m).filter(([,l])=>l.length>1).forEach(([v,l])=>l.forEach(o=>add(o,'atenção',nome+' repetida',`${nome} ${v} idêntica nas ovitrampas ${l.map(x=>x.id).join(', ')}. Pode ser cópia.`)));
  });
  const rank={erro:0,'atenção':1,info:2};
  return out.sort((a,b)=>(a.id-b.id)||(rank[a.nivel]-rank[b.nivel]));
}
let VAL=validar();

function renderSummary(){
  const c={erro:0,'atenção':0,info:0}; VAL.forEach(v=>c[v.nivel]++);
  const ptsComAlerta=new Set(VAL.filter(v=>v.nivel!=='info').map(v=>v.id)).size;
  $('valsum').innerHTML=`<span class="pill erro">${c.erro} erros</span><span class="pill atenção">${c['atenção']} atenções</span><span class="pill info">${c.info} informativos</span>`;
  $('valnote').textContent=`Formato decimal e região verificados nos 242 pontos. ${ptsComAlerta} pontos pedem conferência manual. Nenhuma coordenada foi alterada.`;
  $('valInfo').textContent=`Formato decimal, região esperada, grupos isolados, pontos sobrepostos e precisão foram verificados automaticamente. A lista indica o que conferir; as coordenadas originais foram mantidas.`;
  $('corrInfo').textContent=CORRECOES.length? '' : 'Nenhuma coordenada foi corrigida. Se isso for necessário, a alteração deve ser registrada em CORRECOES (id, campo, valor antigo, valor novo, motivo, data) e aparecerá aqui.';
}
function renderVal(){
  const lv=$('vlvl').value;
  $('vbody').innerHTML=VAL.filter(v=>!lv||v.nivel===lv).map(v=>`<tr>
    <td>${v.id?`<button class="idb" type="button" data-id="${v.id}">${v.id}</button>`:'—'}</td>
    <td><span class="lvl ${v.nivel}">${v.nivel}</span></td><td>${esc(v.tipo)}</td>
    <td>${esc(v.msg)}<br><small style="color:#587079">${esc(v.end)}</small></td>
    <td style="white-space:nowrap;font-variant-numeric:tabular-nums">${esc(v.lat)}<br>${esc(v.lon)}</td></tr>`).join('') || '<tr><td colspan="5">Nenhum alerta neste filtro.</td></tr>';
  if(CORRECOES.length){ $('corrInfo').innerHTML=CORRECOES.map(c=>`#${c.id} ${esc(c.campo)}: ${esc(c.de)} → ${esc(c.para)} (${esc(c.motivo)}, ${esc(c.data)})`).join('<br>'); }
}
$('openVal').addEventListener('click',()=>{ renderVal(); $('val').style.display='flex'; });
$('vclose').addEventListener('click',()=>$('val').style.display='none');
$('val').addEventListener('click',e=>{ if(e.target===$('val')) $('val').style.display='none'; });
$('vlvl').addEventListener('change',renderVal);
$('vbody').addEventListener('click',e=>{ const b=e.target.closest('.idb'); if(!b) return; $('val').style.display='none'; irPara(byId[+b.dataset.id]); });
function baixar(nome,conteudo,tipo){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([conteudo],{type:tipo})); a.download=nome; document.body.appendChild(a); a.click(); a.remove(); }
$('csv').addEventListener('click',()=>{
  const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
  const linhas=[['ID','Nível','Tipo','Descrição','Endereço','Latitude','Longitude'].join(';')].concat(VAL.map(v=>[v.id||'',v.nivel,q(v.tipo),q(v.msg),q(v.end),v.lat,v.lon].join(';')));
  baixar('conferencia-coordenadas-ovitrampas.csv','\ufeff'+linhas.join('\n'),'text/csv;charset=utf-8');
});
$('json').addEventListener('click',()=>{
  const base=pts.map(({marker,grupo,latRaw,lonRaw,semEndereco,...r})=>r);
  baixar('base-ovitrampas.json',JSON.stringify({gerado:new Date().toISOString(),correcoes:CORRECOES,ovitrampas:base},null,2),'application/json');
});
