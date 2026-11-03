/* app/13-publicar.js — publicar pacote de dados (data/) para a gestão. Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== PUBLICAR DADOS PARA A PÁGINA DA GESTÃO (gestao.html + dados.json) ===================== */
/* ===================== PUBLICAÇÃO: pacote data/ (enderecos, agentes, anos e manifest) =====================
   Parte dos arquivos JÁ publicados (nada se perde), aplica por cima as alterações guardadas neste aparelho
   e gera um .zip com a pasta data/ para enviar ao GitHub. */
function dadosDoCampo(ano,id){
  const c=STORE.ciclo[id]; if(!c) return null;
  const a=String(ano), r={}; if(c.inst&&c.inst.startsWith(a)) r.inst=c.inst; if(c.rec&&c.rec.startsWith(a)) r.rec=c.rec;
  const h=(c.hist||[]).filter(x=>x.d.startsWith(a)).map(x=>({d:x.d,n:x.n})).sort((p,q)=>p.d.localeCompare(q.d)); if(h.length) r.hist=h;
  return Object.keys(r).length?r:null;
}
async function montaAnoParaPublicar(ano,ultimo){
  const pub=(PUB.ano&&PUB.ano.ano===ano)?PUB.ano:await Dados.ano(ano);
  const Y=pub?JSON.parse(JSON.stringify(pub)):{esquema:2,ano,meses:[],multi:{},serie:{},base:{},extras:{},campo:{},atual:{}};
  const ant=Y.meses, dic=(arr)=>{ const d={}; arr.forEach((x,i)=>{ if(x!==null&&x!==undefined) d[ant[i]]=x; }); return d; };
  const S={}; Object.keys(Y.serie).forEach(k=>{ S[k]=dic(Y.serie[k]); });
  const X={}; Object.keys(Y.extras||{}).forEach(k=>{ X[k]={base:Y.extras[k].base,v:dic(Y.extras[k].serie)}; });
  const L=STORE.serie, deste=m=>m.startsWith(String(ano)); let meses=ant.slice();
  if(L){
    meses=[...new Set(ant.concat(L.meses.filter(deste)))].sort();
    Object.keys(L.v).forEach(id=>{ const d=S[id]||(S[id]={}); Object.keys(L.v[id]).forEach(m=>{ if(deste(m)) d[m]=L.v[id][m]; }); });
    Object.keys(L.base).forEach(id=>{ Y.base[id]=L.base[id]; });
    Object.keys(L.extras).forEach(k=>{ const e=X[k]||(X[k]={base:null,v:{}}); Object.keys(L.extras[k].v).forEach(m=>{ if(deste(m)) e.v[m]=L.extras[k].v[m]; }); if(L.extras[k].base!==null) e.base=L.extras[k].base; });
    Object.keys(L.multi).forEach(m=>{ if(deste(m)) Y.multi[m]=L.multi[m]; });
  }
  const arr=(d)=>meses.map(m=>d[m]!==undefined?d[m]:null);
  Y.meses=meses;
  Y.serie={}; Object.keys(S).sort((a,b)=>a-b).forEach(k=>{ Y.serie[k]=arr(S[k]); });
  Y.extras={}; Object.keys(X).sort().forEach(k=>{ Y.extras[k]={base:X[k].base,serie:arr(X[k].v)}; });
  Y.base=Object.fromEntries(Object.keys(Y.base).sort((a,b)=>a-b).map(k=>[k,Y.base[k]]));
  Y.multi=Object.fromEntries(Object.keys(Y.multi).sort().map(k=>[k,Y.multi[k]]));
  Y.campo=Y.campo||{};
  Object.keys(STORE.ciclo).forEach(id=>{ const c=dadosDoCampo(ano,id); if(c) Y.campo[id]=c; else delete Y.campo[id]; });
  Y.atual=Y.atual||{};
  if(ultimo) Object.keys(STORE.pts).forEach(id=>{ const v=STORE.pts[id].ovos; if(v===undefined) return; const s=Y.serie[id], ult=s?[...s].reverse().find(x=>x!==null):undefined; if(ult===v) delete Y.atual[id]; else Y.atual[id]=v; });
  return Y;
}
async function montaPublicacao(opc){
  const r3=v=>Number(v).toFixed(3), tx=o=>JSON.stringify(o)+'\n', M0=PUB.manifest;
  const E0=PUB.enderecos, exMap={}; (E0.extras||[]).forEach(e=>{ exMap[e.id]=e; });
  if(STORE.serie) Object.keys(STORE.serie.extras).forEach(k=>{ const e=STORE.serie.extras[k]; if(e.lat&&e.lon) exMap[k]={id:k,lat:e.lat,lon:e.lon}; });
  const ender={esquema:2,
    ovitrampas:pts.map(o=>({id:o.id,rua:opc.end?o.rua:'',numero:opc.end?(o.numero||''):'',lat:opc.end?o.latRaw:r3(o.lat),lon:opc.end?o.lonRaw:r3(o.lon)})),
    extras:Object.keys(exMap).sort().map(k=>({id:k,lat:opc.end?exMap[k].lat:r3(exMap[k].lat),lon:opc.end?exMap[k].lon:r3(exMap[k].lon)})),
    ruas:dicRuas(),
    correcoes:CORRECOES.map(c=>({id:c.id,campo:c.campo,de:c.de,para:c.para,motivo:c.motivo,data:c.data,responsavel:c.responsavel}))};
  const agentes={esquema:2,agentes:(STORE.agentes||AGENTES_RAW).map(([zona,area,nome,ini,fim,equipe])=>({zona,area,nome:opc.nomes?nome:'',ini,fim,equipe}))};
  const anos=new Set(M0.anos); if(PUB.ano) anos.add(PUB.ano.ano);
  if(STORE.serie) STORE.serie.meses.forEach(m=>anos.add(+m.slice(0,4)));
  Object.keys(STORE.ciclo).forEach(id=>{ const c=STORE.ciclo[id]; [c.inst,c.rec].concat((c.hist||[]).map(h=>h.d)).forEach(d=>{ if(d) anos.add(+d.slice(0,4)); }); });
  const lista=[...anos].sort(), ultimo=lista[lista.length-1], arquivos={};
  const man={esquema:2,atualizado:new Date().toISOString().replace(/\.\d+Z$/,'Z'),anos:lista,ano_atual:ultimo,arquivos:JSON.parse(JSON.stringify(M0.arquivos||{}))};
  const txE=tx(ender), txA=tx(agentes); arquivos['enderecos.json']=txE; arquivos['agentes.json']=txA;
  man.arquivos.enderecos={url:'enderecos.json',v:fnv1a(txE)}; man.arquivos.agentes={url:'agentes.json',v:fnv1a(txA)};
  for(const ano of lista){
    const mudou=(PUB.ano&&PUB.ano.ano===ano)||(STORE.serie&&STORE.serie.meses.some(m=>m.startsWith(String(ano))))||Object.keys(STORE.ciclo).some(id=>dadosDoCampo(ano,id)!==null)||Object.keys(STORE.pts).some(id=>STORE.pts[id].ovos!==undefined&&ano===ultimo);
    if(!mudou&&man.arquivos[ano]) continue;
    const Y=await montaAnoParaPublicar(ano,ano===ultimo), t=tx(Y);
    arquivos[ano+'.json']=t; man.arquivos[ano]={url:ano+'.json',v:fnv1a(t),meses:Y.meses};
  }
  Object.keys(man.arquivos).forEach(k=>{ if(/^\d{4}$/.test(k)&&!lista.includes(+k)) delete man.arquivos[k]; });
  arquivos['manifest.json']=tx(man);
  return {arquivos,manifest:man};
}
$('pubAbrir').addEventListener('click',()=>{ $('pubDlg').style.display='flex'; closeMenu(); });
$('pubFechar').addEventListener('click',()=>{ $('pubDlg').style.display='none'; });
$('pubBaixar').addEventListener('click',async()=>{
  const b=$('pubBaixar'); b.disabled=true;
  try{
    await carregaLib('jszip');
    const r=await montaPublicacao({nomes:$('pubNomes').checked,end:$('pubEnd').checked});
    const zip=new JSZip(); Object.keys(r.arquivos).forEach(n=>zip.file('data/'+n,r.arquivos[n]));
    baixarArq(await zip.generateAsync({type:'blob',compression:'DEFLATE'}),'dados-publicacao-'+iso(new Date())+'.zip');
    $('pubMsg').innerHTML='Pacote gerado: '+Object.keys(r.arquivos).map(n=>`<b>${n}</b> (${Math.max(1,Math.round(r.arquivos[n].length/1024))} KB)`).join(' · ')+'.<br>Extraia o .zip e envie a pasta <b>data</b> ao GitHub (Add file → Upload files), substituindo os arquivos.';
  }catch(e){ console.error(e); $('pubMsg').textContent='Não foi possível gerar o pacote: '+(e&&e.message||e); }
  finally{ b.disabled=false; }
});

/* texto do botão "Mapa de campo" acompanha a seleção */
function atualizaGen(){
  const b=$('gen'), b2=$('gen2'); if(!b) return; const ids=[...sel];
  if(!ids.length){ b.textContent='SELECIONE UM AGENTE ACIMA'; if(b2) b2.textContent='SELECIONE OVITRAMPAS PARA GERAR O MAPA'; return; }
  const a=AGS.find(x=>x.lista.length===ids.length&&x.lista.every(o=>sel.has(o.id)));
  b.textContent=a?('GERAR MAPA DE CAMPO · '+nomeAg(a).toUpperCase()):('GERAR MAPA DE CAMPO · '+ids.length+' SELECIONADAS');
  if(b2) b2.textContent='GERAR MAPA · '+ids.length+(ids.length===1?' SELECIONADA':' SELECIONADAS');
}
