/* app/08-importar.js — importar planilha mensal, exportar CSV/JSON, atualizar dados. Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== IMPORTAR / EXPORTAR / ATUALIZAR ===================== */
const nk=t=>norm(String(t==null?'':t)).replace(/[^a-zº°0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const limpa=t=>String(t==null?'':t).replace(/\*/g,'').trim();
const distM=(la1,lo1,la2,lo2)=>Math.hypot((la2-la1)*110574,(lo2-lo1)*102500);
function dividirLinha(l,d){
  const out=[]; let cur='', q=false;
  for(let i=0;i<l.length;i++){ const ch=l[i];
    if(q){ if(ch==='"'){ if(l[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=ch; }
    else if(ch==='"') q=true; else if(ch===d){ out.push(cur); cur=''; } else cur+=ch; }
  out.push(cur); return out.map(x=>x.trim());
}
function lerTabela(txt){
  const L=txt.replace(/^\uFEFF/,'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!L.length) return [];
  const pipe=L.filter(l=>l.startsWith('|')).length>=Math.max(1,Math.ceil(L.length/2));
  if(pipe) return L.filter(l=>!(/^\|?[\s:|-]+\|?$/.test(l)&&/-{2,}/.test(l))).map(l=>l.replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim()));
  const am=L.slice(0,8).join('\n'), cont=ch=>am.split(ch).length-1;
  const d=cont('\t')>0?'\t':(cont(';')>0&&cont(';')>=cont(',')?';':',');
  return L.map(l=>dividirLinha(l,d));
}
function mapaColunas(h){
  const m={};
  h.forEach((t,i)=>{ const k=nk(t);
    if(m.id===undefined&&/^(id|cod|codigo|ovitrampa|n ovitrampa|numero da ovitrampa)$/.test(k)) m.id=i;
    else if(m.rua===undefined&&/^(rua|endereco|logradouro|via)\b/.test(k)) m.rua=i;
    else if(m.num===undefined&&/^(n|nº|n°|no|num|numero)$/.test(k)) m.num=i;
    else if(m.lat===undefined&&/^lat/.test(k)) m.lat=i;
    else if(m.lon===undefined&&/^(lon|lng|long)/.test(k)) m.lon=i;
    else if(m.ovos===undefined&&/ovos/.test(k)) m.ovos=i;
    else if(m.area===undefined&&/^area/.test(k)) m.area=i;
    else if(m.agente===undefined&&/^agente/.test(k)) m.agente=i;
    else if(m.faixa===undefined&&/^ovitrampas$/.test(k)) m.faixa=i;
    else if(m.zona===undefined&&/^zona/.test(k)) m.zona=i;
    else if(m.equipe===undefined&&/^equipe/.test(k)) m.equipe=i;
  });
  return m;
}
const coordTxt=t=>{ t=limpa(t).replace(',','.'); return /^-?\d{1,3}\.\d+$/.test(t)?t:null; };
const coordOk=(la,lo)=>{ const a=parseFloat(la),b=parseFloat(lo); return a<=-22.2&&a>=-23&&b<=-55.3&&b>=-56; };

function planoDePontos(L,col){
  const mud=[], ign=[]; let lidas=0;
  L.forEach((r,i)=>{
    const id=parseInt(limpa(r[col.id]),10);
    if(!(id>=1&&byId[id])){ if(limpa(r.join(''))) ign.push(`linha ${i+1}: ID inválido (${limpa(r[col.id])||'vazio'})`); return; }
    lidas++;
    const o=byId[id], m=[];
    if(col.ovos!==undefined){ const v=limpa(r[col.ovos]); if(/^\d+$/.test(v)){ const n=parseInt(v,10); if(n!==o.ovosBase) m.push({t:'ovos',de:o.ovosBase,para:n}); } }
    if(col.rua!==undefined){ const v=limpa(r[col.rua]); if(v&&v!==o.rua) m.push({t:'rua',de:o.rua,para:v}); }
    if(col.num!==undefined){ const v=limpa(r[col.num]); if(v!==''&&v!==String(o.numero||'')) m.push({t:'num',de:o.numero||'',para:v}); }
    if(col.lat!==undefined&&col.lon!==undefined){
      const la=coordTxt(r[col.lat]), lo=coordTxt(r[col.lon]);
      if(la&&lo){ if(!coordOk(la,lo)) ign.push(`ID ${id}: coordenada fora da região de Ponta Porã (${la}, ${lo})`);
        else{ const d=distM(o.lat,o.lon,parseFloat(la),parseFloat(lo)); if(d>0.5) m.push({t:'coord',de:o.latRaw+', '+o.lonRaw,para:la+', '+lo,d,lat:la,lon:lo}); } }
      else if(limpa(r[col.lat])||limpa(r[col.lon])) ign.push(`ID ${id}: coordenada em formato não reconhecido`);
    }
    if(m.length) mud.push({id,m});
  });
  return {tipo:'pontos',lidas,mud,ign};
}
function planoDeAgentes(L,col){
  const rows=[], ign=[];
  L.forEach((r,i)=>{
    const faixa=limpa(r[col.faixa]).split(/[-–—]/).map(x=>parseInt(x,10));
    const ini=faixa[0], fim=faixa.length>1?faixa[1]:faixa[0];
    const zona=parseInt(limpa(r[col.zona]),10), eq=parseInt(limpa(r[col.equipe]),10);
    if(!(ini>=1&&fim>=ini&&fim<=pts.length)){ if(limpa(r.join(''))) ign.push(`linha ${i+1}: faixa de ovitrampas inválida`); return; }
    rows.push([isFinite(zona)?zona:rows.length+1, limpa(r[col.area]||''), limpa(r[col.agente]||''), ini, fim, isFinite(eq)?eq:null]);
  });
  /* completa ovitrampas sem agente */
  const cob=new Set(); rows.forEach(r=>{ for(let k=r[3];k<=r[4];k++) cob.add(k); });
  let zmax=Math.max(0,...rows.map(r=>r[0])), ini=null; const extra=[];
  for(let k=1;k<=pts.length+1;k++){ const sem=k<=pts.length&&!cob.has(k); if(sem&&ini===null) ini=k; if(!sem&&ini!==null){ extra.push([++zmax,'','',ini,k-1,null]); ini=null; } }
  return {tipo:'agentes',rows:rows.concat(extra),ign,extra};
}

/* ---- planilha mensal (ex.: "contaovos-contagens-...csv": uma linha por ovitrampa e mês) ---- */
const MESES_PT=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const rotMes=m=>MESES_PT[+m.slice(5,7)-1]+'/'+m.slice(2,4);
function colunasMensal(h){
  const m={}; h.forEach((t,i)=>{ const k=nk(t);
    if(m.mes===undefined&&/^mes$/.test(k)) m.mes=i;
    else if(m.id===undefined&&/^ovitrampa( numero.*)?$/.test(k)) m.id=i;
    else if(m.reg===undefined&&/^registros$/.test(k)) m.reg=i;
    else if(m.ovos===undefined&&/^soma de ovos$/.test(k)) m.ovos=i;
    else if(m.media===undefined&&/^media de ovos$/.test(k)) m.media=i;
    else if(m.base===undefined&&/^media de media historica/.test(k)) m.base=i;
    else if(m.lat===undefined&&/^latitude/.test(k)) m.lat=i;
    else if(m.lon===undefined&&/^longitude/.test(k)) m.lon=i; });
  return (m.mes!==undefined&&m.id!==undefined&&(m.media!==undefined||m.ovos!==undefined))?m:null;
}
/* ---- planilha de leituras ("contaovos-ovitrampas-...csv": uma linha por leitura/semana) ----
   Usa só: nº da ovitrampa, ovos, data de coleta (define o mês), média histórica, latitude e longitude.
   O resto (município, IDs do sistema, responsável, bairro, rua etc.) é ignorado.
   Várias leituras no mesmo mês viram a MÉDIA, como na planilha mensal. */
function colunasLeituras(h){
  const m={}; h.forEach((t,i)=>{ const k=nk(t);
    if(m.id===undefined&&/^ovitrampa( numero.*)?$/.test(k)) m.id=i;
    else if(m.ovos===undefined&&/^ovos$/.test(k)) m.ovos=i;
    else if(m.data===undefined&&/^data de coleta/.test(k)) m.data=i;
    else if(m.inst===undefined&&/^data de instalacao/.test(k)) m.inst=i;
    else if(m.rua===undefined&&/^rua$/.test(k)) m.rua=i;
    else if(m.num===undefined&&/^numero$/.test(k)) m.num=i;
    else if(m.base===undefined&&/^media historica/.test(k)) m.base=i;
    else if(m.lat===undefined&&/^latitude/.test(k)) m.lat=i;
    else if(m.lon===undefined&&/^longitude/.test(k)) m.lon=i; });
  return (m.id!==undefined&&m.ovos!==undefined&&m.data!==undefined)?m:null;
}
const mesDaData=t=>{ t=limpa(t); let m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m) return m[3]+'-'+m[2].padStart(2,'0'); m=t.match(/^(\d{4})-(\d{2})-\d{2}/); return m?m[1]+'-'+m[2]:null; };
function planoLeituras(rows,col){
  const num=t=>{ t=limpa(t).replace(',','.'); return /^-?\d+(\.\d+)?$/.test(t)?parseFloat(t):null; };
  const G={}, U={}, H={}, ign=[]; let lidas=0;
  rows.forEach((r,i)=>{
    const idt=limpa(r[col.id]); if(!idt){ if(limpa(r.join(''))) ign.push(`linha ${i+2}: sem número da ovitrampa`); return; }
    const mes=mesDaData(r[col.data]); if(!mes){ ign.push(`linha ${i+2}: sem data de coleta`); return; }
    const ov=num(r[col.ovos]); if(ov===null){ ign.push(`linha ${i+2}: sem contagem de ovos`); return; }
    lidas++;
    const dcol=isoData(r[col.data]), la0=col.lat!==undefined?coordTxt(r[col.lat]):null, lo0=col.lon!==undefined?coordTxt(r[col.lon]):null;
    if(dcol){ (H[idt]||(H[idt]={}))[dcol]=ov;
      if(!U[idt]||dcol>=U[idt].col) U[idt]={col:dcol,inst:col.inst!==undefined?isoData(r[col.inst]):null,rua:col.rua!==undefined?limpa(r[col.rua]):'',num:col.num!==undefined?limpa(r[col.num]):'',lat:la0,lon:lo0}; }
    const g=G[mes+'|'+idt]||(G[mes+'|'+idt]={mes,idt,soma:0,n:0,base:null,lat:'',lon:''});
    g.soma+=ov; g.n++;
    const b=col.base!==undefined?num(r[col.base]):null; if(b!==null) g.base=b;
    const la=col.lat!==undefined?coordTxt(r[col.lat]):null, lo=col.lon!==undefined?coordTxt(r[col.lon]):null; if(la&&lo){ g.lat=la; g.lon=lo; }
  });
  /* reaproveita o processamento da planilha mensal: [mês, id, leituras, média de ovos, média histórica, lat, lon] */
  const linhas=Object.values(G).map(g=>[g.mes,g.idt,String(g.n),String(g.soma/g.n),g.base===null?'':String(g.base),g.lat,g.lon]);
  const p=planoMensal(linhas,{mes:0,id:1,reg:2,media:3,base:4,lat:5,lon:6},U);
  if(p.tipo==='mensal'){ p.ign=ign.concat(p.ign); p.leituras=lidas; p.campo={};
    /* registro de campo (última instalação, recolhimento e histórico de contagens) das ovitrampas da malha */
    Object.keys(H).forEach(id=>{ const n=+id; if(!/^\d+$/.test(id)||!(n>=1&&n<=pts.length)) return; const u=U[id];
      p.campo[n]={inst:(u&&u.inst)||'',rec:u?u.col:'',hist:Object.keys(H[id]).sort().map(d=>({d,n:H[id][d]}))}; }); }
  return p;
}
/* ---- endereço da ÚLTIMA instalação ----
   A coordenada e o endereço são sempre os da última instalação. Na mesma rua, fica a grafia já conferida
   (a planilha é digitada à mão: sem acentos e com erros). */
const chaveNum=t=>{ t=norm(t).replace(/[^a-z0-9]/g,''); return (t==='sn'||t==='s')?'sn':t; };
const limpaNum=n=>{ n=String(n||'').trim(); if(/^s\s*\/?\s*n$/i.test(n)) return 'S/N'; return n?n.charAt(0).toUpperCase()+n.slice(1):n; };
/* dicionário de ruas: o publicado (data/enderecos.json) + as ruas novas já importadas neste aparelho */
const dicRuas=()=>Object.assign({},(PUB.enderecos&&PUB.enderecos.ruas)||{},STORE.ruas||{});
/* [rua, nº, lat, lon] da última instalação para o plano de importação: nome da rua sempre corrigido pelo dicionário */
function linhaDeEndereco(id,u,ruas,novas){
  const o=byId[id]; if(!o) return ['','','',''];
  const la=u&&u.lat||'', lo=u&&u.lon||'';
  const atual=/^Sem endere/i.test(o.rua)?o.rua:ruaCorrigida(o.rua,ruas,novas);      /* cadastro todo com o nome padronizado */
  let rua=atual, num='';
  if(u&&String(u.rua||'').trim()){
    const [rt,nr]=rTiraNumero(u.rua), nu=limpaNum(u.num||nr); let rn=ruaCorrigida(rt,ruas,novas);
    if(rn){   /* o endereço é sempre o da última instalação (se a planilha trouxe rua) */
      const mesma=rChave(rPartes(rn)[1])===rChave(rPartes(atual)[1]);
      if(mesma&&(rPartes(atual)[2]||!rPartes(rn)[2])) rn=atual;                        /* mesma rua: fica o texto já conferido */
      const novoNum=nu||(mesma?String(o.numero||''):'');
      rua=rn; if(chaveNum(novoNum)!==chaveNum(o.numero)) num=novoNum;
    }
  }
  return [rua!==o.rua?rua:'',num,la,lo];
}
const isoData=t=>{ const m=limpa(t).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):null; };
function planoMensal(rows,col,ult){
  const num=t=>{ t=limpa(t).replace(',','.'); return /^-?\d+(\.\d+)?$/.test(t)?parseFloat(t):null; };
  const set=new Set(), v={}, base={}, ex={}, multi={}, geo={}, ign=[];
  rows.forEach((r,i)=>{
    const mes=limpa(r[col.mes]), idt=limpa(r[col.id]);
    if(!/^\d{4}-\d{2}$/.test(mes)||!idt){ if(limpa(r.join(''))) ign.push(`linha ${i+2}: mês ou ovitrampa vazios`); return; }
    const reg=col.reg!==undefined?(num(r[col.reg])||1):1;
    let val=col.media!==undefined?num(r[col.media]):null; if(val===null&&col.ovos!==undefined){ const o=num(r[col.ovos]); val=o===null?null:o/reg; }
    if(val===null){ ign.push(`linha ${i+2}: sem contagem de ovos`); return; }
    set.add(mes); if(reg>1) multi[mes]=Math.max(multi[mes]||0,reg);
    const b=col.base!==undefined?num(r[col.base]):null, la=col.lat!==undefined?coordTxt(r[col.lat]):null, lo=col.lon!==undefined?coordTxt(r[col.lon]):null;
    const n=/^\d+$/.test(idt)?parseInt(idt,10):null;
    if(n!==null&&n>=1&&n<=pts.length){ (v[n]||(v[n]={}))[mes]=val; if(b!==null) base[n]=b; if(la&&lo&&(!geo[n]||mes>=geo[n].mes)) geo[n]={mes,la,lo}; }
    else{ const e=ex[idt]||(ex[idt]={v:{},base:null,lat:null,lon:null,mes:''}); e.v[mes]=val; if(b!==null) e.base=b; if(la&&lo&&mes>=e.mes){ e.lat=la; e.lon=lo; e.mes=mes; } }
  });
  const ms=[...set].sort(); if(!ms.length) return {tipo:'erro',msg:'Não achei meses com contagens nessa planilha.'};
  const ultimo=ms[ms.length-1], L=[];
  const ruasT=dicRuas(), novasRuas=[];
  Object.keys(v).forEach(id=>{ const x=v[id][ultimo]; if(x===undefined) return; const e=linhaDeEndereco(id,ult?ult[id]:null,ruasT,novasRuas); L.push([id,e[0],e[1],e[2],e[3],String(Math.round(x))]); });
  const pontos=planoDePontos(L,{id:0,rua:1,num:2,lat:3,lon:4,ovos:5});
  const div=[]; Object.keys(geo).forEach(id=>{ const g=geo[id], o=byId[id]; if(!o) return; const d=distM(o.lat,o.lon,parseFloat(g.la),parseFloat(g.lo)); if(d>50) div.push({id:+id,d}); }); div.sort((a,b)=>b.d-a.d);
  const ruasNovas={}; Object.keys(ruasT).forEach(k=>{ if(!(k in dicRuas())) ruasNovas[k]=ruasT[k]; });
  return {tipo:'mensal',ms,v,base,ex,multi,ultimo,nMalha:Object.keys(v).length,nExtras:Object.keys(ex).length,ign,pontos,div,ruasNovas,novasRuas};
}
/* registro de campo vindo da planilha: datas e contagens de mesmo dia são atualizadas; as demais são mantidas */
function aplicaCampoDaPlanilha(campo){
  Object.keys(campo||{}).forEach(id=>{ const o=byId[id], n=campo[id]; if(!o||!n) return;
    const hist={}; (o.historico||[]).forEach(x=>{ hist[x.d]=x.n; }); n.hist.forEach(x=>{ hist[x.d]=x.n; });
    const c={inst:o.dataInstalacao||'',rec:o.dataRecolhimento||'',hist:Object.keys(hist).sort().map(d=>({d,n:hist[d]}))};
    if(n.inst&&n.rec&&n.rec>=(c.rec||'')){ c.inst=n.inst; c.rec=n.rec; }
    STORE.ciclo[id]=c; o.dataInstalacao=c.inst||null; o.dataRecolhimento=c.rec||null; o.historico=c.hist; });
}
function guardaSerie(p){
  const S=STORE.serie||(STORE.serie={meses:[],v:{},base:{},extras:{},multi:{},importado:null});
  S.meses=[...new Set(S.meses.concat(p.ms))].sort();
  Object.keys(p.v).forEach(id=>{ S.v[id]=Object.assign(S.v[id]||{},p.v[id]); });
  Object.keys(p.base).forEach(id=>{ S.base[id]=p.base[id]; });
  Object.keys(p.ex).forEach(k=>{ const e=S.extras[k]||(S.extras[k]={v:{},base:null,lat:null,lon:null}); Object.assign(e.v,p.ex[k].v); if(p.ex[k].base!==null) e.base=p.ex[k].base; if(p.ex[k].lat){ e.lat=p.ex[k].lat; e.lon=p.ex[k].lon; } });
  Object.assign(S.multi,p.multi); S.importado=new Date().toISOString(); _serieMemo=null;
  if(p.campo) aplicaCampoDaPlanilha(p.campo);
  if(p.ruasNovas&&Object.keys(p.ruasNovas).length) STORE.ruas=Object.assign(STORE.ruas||{},p.ruasNovas);
}
/* série mensal para os balões: dados publicados (data/AAAA.json) + o que foi importado neste aparelho */
let _serieMemo=null;
function serieCompleta(){
  if(_serieMemo) return _serieMemo;
  const Y=PUB.ano, S={meses:[],v:{}};
  if(Y){ S.meses=Y.meses.slice(); Object.keys(Y.serie).forEach(id=>{ const d={}; Y.serie[id].forEach((x,i)=>{ if(x!==null) d[Y.meses[i]]=x; }); S.v[id]=d; }); }
  const L=STORE.serie;
  if(L){ S.meses=[...new Set(S.meses.concat(L.meses))].sort(); Object.keys(L.v).forEach(id=>{ S.v[id]=Object.assign(S.v[id]||{},L.v[id]); }); }
  return _serieMemo=S;
}
function serieLinhaPopup(o){
  const S=serieCompleta(), d=S.v[o.id]; if(!d||!S.meses.length) return '';
  const vals=S.meses.map(m=>d[m]===undefined?null:d[m]), mx=Math.max(1,...vals.map(x=>x||0)), bl='▁▂▃▄▅▆▇█';
  const sp=vals.map(x=>x===null?'·':bl[Math.min(7,Math.floor((x/mx)*7.999))]).join('');
  const pico=vals.reduce((b,x,i)=>x!==null&&x>(b.v)?{v:x,i}:b,{v:-1,i:-1});
  return `<div class="pp-linha">${S.meses.length} meses: <span class="spark-txt">${sp}</span> · pico ${Math.round(pico.v)} (${rotMes(S.meses[pico.i])})</div>`;
}
function planoImport(txt){
  txt=String(txt||'').trim(); if(!txt) return null;
  if(txt[0]==='{'){
    let j; try{ j=JSON.parse(txt); }catch(e){ return {tipo:'erro',msg:'O JSON está inválido.'}; }
    if(j&&j.store&&j.store.versao===2) return {tipo:'backup',store:j.store};
    if(j&&Array.isArray(j.ovitrampas)){
      const L=j.ovitrampas.map(x=>[x.id,x.rua!==undefined?x.rua:x.endereco,x.numero!==undefined?x.numero:'',x.latRaw||String(x.lat),x.lonRaw||String(x.lon),x.ovos==null?'':x.ovos]);
      return planoDePontos(L,{id:0,rua:1,num:2,lat:3,lon:4,ovos:5});
    }
    return {tipo:'erro',msg:'JSON não reconhecido.'};
  }
  const L=lerTabela(txt); if(!L.length) return {tipo:'erro',msg:'Não consegui ler a tabela.'};
  const temCab=!/^\d+$/.test(limpa(L[0][0]));
  if(temCab){
    const cm=colunasMensal(L[0]); if(cm) return planoMensal(L.slice(1),cm);
    const cl=colunasLeituras(L[0]); if(cl) return planoLeituras(L.slice(1),cl);
    const col=mapaColunas(L[0]), dados=L.slice(1);
    if(col.agente!==undefined&&col.faixa!==undefined) return planoDeAgentes(dados,col);
    if(col.id!==undefined) return planoDePontos(dados,col);
    return {tipo:'erro',msg:'Não achei as colunas. Use: ID, Rua, Nº, Latitude, Longitude, Ovos (ou Área, Agente, Ovitrampas, Zona, Equipe).'};
  }
  if(L[0].length>=5) return planoDePontos(L,{id:0,rua:1,num:2,lat:3,lon:4,ovos:5});
  return {tipo:'erro',msg:'Tabela sem cabeçalho e com poucas colunas.'};
}
let impPlano=null;
const nomeCampo={ovos:'Ovos',rua:'Rua',num:'Nº',coord:'Coordenadas'};
function renderImport(){
  const p=impPlano, box=$('impPrev'); $('impAplicar').disabled=true; $('impOpc').style.display='none'; $('impSerieW').style.display='none';
  if(!p){ box.innerHTML=''; return; }
  if(p.tipo==='erro'){ box.innerHTML=`<p class="err">${esc(p.msg)}</p>`; return; }
  if(p.tipo==='backup'){ const n=Object.keys(p.store.pts||{}).length, c=Object.keys(p.store.ciclo||{}).length;
    box.innerHTML=`<p class="ok">Backup reconhecido.</p><p>${n} ovitrampa(s) com alteração, ${c} com registro de campo${p.store.agentes?', lista de agentes':''}. Aplicar <b>substitui</b> os dados guardados neste aparelho por este backup.</p>`; $('impAplicar').disabled=false; return; }
  if(p.tipo==='agentes'){
    const eqs={}; p.rows.forEach(r=>{ const k=r[5]?'Equipe '+r[5]:'Sem equipe'; eqs[k]=(eqs[k]||0)+1; });
    box.innerHTML=`<p class="ok">Lista de agentes reconhecida: ${p.rows.length} linhas.</p><p>${Object.keys(eqs).sort().map(k=>`${k}: ${eqs[k]}`).join(' · ')}</p>`
      +(p.extra.length?`<p class="aviso">${p.extra.length} faixa(s) de ovitrampas sem agente foram mantidas como “sem agente”: ${p.extra.map(r=>r[3]+'–'+r[4]).join(', ')}.</p>`:'')
      +(p.ign.length?`<p class="aviso">Ignoradas: ${esc(p.ign.slice(0,6).join('; '))}</p>`:'');
    $('impAplicar').disabled=!p.rows.length; return; }
  if(p.tipo==='mensal'){
    const mm=Object.keys(p.multi).map(m=>rotMes(m)+' ('+p.multi[m]+' leituras por ovitrampa)');
    $('impSerieW').style.display='flex'; $('impOpc').style.display='flex'; $('impAplicar').disabled=false;
    box.innerHTML=`<p class="ok">${p.leituras?`Planilha de leituras reconhecida (${p.leituras} leituras)`:'Planilha mensal reconhecida'}: ${p.ms.length} meses (${rotMes(p.ms[0])} a ${rotMes(p.ultimo)}), ${p.nMalha} ovitrampas da malha e ${p.nExtras} pontos extras (estratégicos/outros).</p>`
      +(mm.length?`<p class="aviso">Mês com mais de uma leitura: ${esc(mm.join(', '))}. A série usa a <b>média</b> das leituras do mês (somar dobraria os ovos e passaria de 100% no IPO).</p>`:'')
      +(p.ign.length?`<p class="aviso">Ignorado: ${esc(p.ign.slice(0,4).join('; '))}</p>`:'')
      +(p.novasRuas&&p.novasRuas.length?`<p class="aviso">Ruas novas (entram no dicionário; confira a grafia): <b>${esc([...new Set(p.novasRuas)].sort().join('; '))}</b>.</p>`:'')
      +`<p><b>Último mês (${rotMes(p.ultimo)}) × base atual:</b></p>`+htmlPontos(p.pontos);
    return;
  }
  box.innerHTML=htmlPontos(p); if(p.mud.length){ $('impOpc').style.display='flex'; $('impAplicar').disabled=false; }
}
function htmlPontos(p){
  const cont={ovos:0,rua:0,num:0,coord:0,grande:0}; p.mud.forEach(x=>x.m.forEach(y=>{ cont[y.t]++; if(y.t==='coord'&&y.d>50) cont.grande++; }));
  let h=`<p class="ok">${p.lidas} ovitrampa(s) reconhecida(s).</p><p><b>${p.mud.length}</b> com mudança · ovos: ${cont.ovos} · rua: ${cont.rua} · nº: ${cont.num} · coordenadas: ${cont.coord}${cont.grande?` (<span class="aviso">${cont.grande} acima de 50 m</span>)`:''}</p>`;
  if(p.ign.length) h+=`<p class="aviso">Ignorado: ${esc(p.ign.slice(0,6).join('; '))}${p.ign.length>6?` … (+${p.ign.length-6})`:''}</p>`;
  if(p.mud.length){
    const linhas=[]; p.mud.forEach(x=>x.m.forEach(y=>linhas.push(`<tr><td>${x.id}</td><td>${nomeCampo[y.t]}</td><td>${esc(y.de===null?'—':y.de)}</td><td>${esc(y.para)}${y.t==='coord'?` <small class="${y.d>50?'aviso':''}">(${Math.round(y.d)} m${y.d>50?' ⚠':''})</small>`:''}</td></tr>`)));
    h+=`<div class="tw" style="max-height:30vh"><table><thead><tr><th>ID</th><th>Campo</th><th>Atual</th><th>Novo</th></tr></thead><tbody>${linhas.slice(0,150).join('')}</tbody></table></div>${linhas.length>150?`<p class="hint">Mostrando as 150 primeiras de ${linhas.length} mudanças.</p>`:''}`;
  } else h+='<p>Nada para atualizar nas ovitrampas: a planilha é igual à base atual.</p>';
  return h;
}
function analisaImport(){ impPlano=planoImport($('impTxt').value); renderImport(); }
function fechaImport(){ $('impDlg').style.display='none'; }
function aplicaPlanoPontos(p){
  const opO=$('impOvos').checked, opE=$('impEnd').checked, opC=$('impCoord').checked, opB=$('impCoordBig').checked;
  const r={nO:0,nE:0,nC:0,pulouC:0,ids:new Set()};
  p.mud.forEach(x=>{
    const d=STORE.pts[x.id]||(STORE.pts[x.id]={});
    x.m.forEach(y=>{
      if(y.t==='ovos'&&opO){ d.ovos=y.para; r.nO++; r.ids.add(x.id); }
      else if(y.t==='rua'&&opE){ d.rua=y.para; r.nE++; r.ids.add(x.id); }
      else if(y.t==='num'&&opE){ d.numero=y.para; r.nE++; r.ids.add(x.id); }
      else if(y.t==='coord'){ if(opC&&(y.d<=50||opB)){
          const c={id:x.id,campo:'lat/lon',de:y.de,para:y.para,motivo:'Planilha importada ('+Math.round(y.d)+' m)',data:iso(new Date()),responsavel:'Importação'};
          d.lat=y.lat; d.lon=y.lon; r.nC++; r.ids.add(x.id); CORRECOES.push(c); STORE.corr.push(c); } else r.pulouC++; }
    });
    aplicaPonto(byId[x.id],d); if(!Object.keys(d).length) delete STORE.pts[x.id];
  });
  return r;
}
function aplicaImport(){
  const p=impPlano; if(!p||p.tipo==='erro') return;
  let resumo='';
  if(p.tipo==='backup'){
    STORE=Object.assign(storeVazio(),p.store); if(!storeSalvar()){ toast('Não foi possível guardar neste aparelho.'); return; }
    toast('Backup restaurado. Recarregando…'); setTimeout(()=>location.reload(),600); return;
  }
  if(p.tipo==='agentes'){
    STORE.agentes=p.rows; montaAgentes(p.rows); resumo=`lista de agentes importada (${p.rows.length} linhas)`;
    STORE.log.push({q:new Date().toISOString(),tipo:'agentes',resumo}); storeSalvar();
    recalcTudo(); fechaImport(); toast('Lista de agentes atualizada.'); return;
  }
  const partes=[]; let r;
  if(p.tipo==='mensal'){
    if($('impSerie').checked){ guardaSerie(p); partes.push(`série mensal (${p.ms.length} meses)`); }
    r=aplicaPlanoPontos(p.pontos);
  } else r=aplicaPlanoPontos(p);
  partes.push(`ovos: ${r.nO} · rua/nº: ${r.nE} · coordenadas: ${r.nC}`+(r.pulouC?` (${r.pulouC} não aplicadas)`:''));
  resumo=partes.join(' · ');
  STORE.log.push({q:new Date().toISOString(),tipo:p.tipo,resumo});
  const ok=storeSalvar();
  recalcTudo([...r.ids]); fechaImport();
  toast((ok?'Atualizado: ':'Atualizado (SEM guardar no aparelho): ')+resumo);
}
function recalcTudo(ids){
  pts.forEach(o=>{ o.ovos=ovosEfetivo(o); o.endereco=enderecoCompleto(o.rua,o.numero); });
  (ids||pts.map(o=>o.id)).forEach(id=>{ const o=byId[id]; o.gx=gx(o.lon); o.gy=gy(o.lat); o.marker.setLatLng([o.lat,o.lon]); o.marker.setIcon(iconFor(o)); });
  VAL=validar(); renderSummary(); renderAgentes(); gradeAtualiza(); atualizaIndicadores(); atualizaDadosInfo(); refresh(false); atualizaRota();
}
function atualizaDadosInfo(){
  const n=Object.keys(STORE.pts).length, c=Object.keys(STORE.ciclo).length, q=STORE.quando?new Date(STORE.quando).toLocaleString('pt-BR'):'';
  const pub=PUB.manifest.atualizado?new Date(PUB.manifest.atualizado).toLocaleString('pt-BR'):'—';
  $('dadosInfo').textContent=(n||c||STORE.agentes||STORE.serie)
    ? `Dados publicados em ${pub}. Alterações guardadas só neste aparelho (${q}): ${n} ovitrampa(s) alterada(s), ${c} com registro de campo${STORE.agentes?', lista de agentes importada':''}${STORE.serie?', série mensal':''}. Use “Publicar dados para a gestão” para levá-las ao site.`
    : `Dados publicados em ${pub}. Nenhuma alteração guardada neste aparelho.`;
}
$('impAbrir').addEventListener('click',()=>{ $('impTxt').value=''; $('impFile').value=''; impPlano=null; renderImport(); $('impDlg').style.display='flex'; closeMenu(); });
$('impFechar').addEventListener('click',fechaImport);
let impT=null; $('impTxt').addEventListener('input',()=>{ clearTimeout(impT); impT=setTimeout(analisaImport,250); });
/* arquivo em UTF-8 ou, se tiver acentos quebrados, em Windows-1252 (padrão de planilhas exportadas do sistema/Excel) */
function decodificaTexto(buf){
  try{ return new TextDecoder('utf-8',{fatal:true}).decode(buf); }catch(e){ return new TextDecoder('windows-1252').decode(buf); }
}
$('impFile').addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ $('impTxt').value=decodificaTexto(r.result); analisaImport(); }; r.readAsArrayBuffer(f); });
$('impAplicar').addEventListener('click',aplicaImport);
/* exportações */
const csvCel=t=>{ t=String(t==null?'':t); return /[;"\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t; };
$('expCsv').addEventListener('click',()=>{
  const cab=['ID','Rua','Nº','Latitude','Longitude','Ovos','Zona','Agente','Área','Equipe','Quadrícula','Distância do centro (m)','Instalada em','Recolhida em','Última contagem em'];
  const lin=pts.map(o=>{ const a=AG_POR_ID[o.id]||{}, ci=G?celula(G,o.gx,o.gy):null, h=(o.historico||[]).slice().sort((x,y)=>x.d.localeCompare(y.d)), ult=h.length?h[h.length-1].d:'';
    return [o.id,o.rua,o.numero||'',o.latRaw.replace('.',','),o.lonRaw.replace('.',','),o.ovos===null?'':o.ovos,a.zona||'',a.nome||'',a.area||'',a.equipe?'Equipe '+a.equipe:'',ci&&ci.dentro?ci.code:'',ci&&ci.dentro?Math.round(ci.dist):'',o.dataInstalacao||'',o.dataRecolhimento||'',ult].map(csvCel).join(';'); });
  baixar('base-ovitrampas.csv','\ufeff'+[cab.join(';')].concat(lin).join('\n'),'text/csv;charset=utf-8');
});
$('expJson').addEventListener('click',()=>{
  baixar('backup-ovitrampas-'+iso(new Date())+'.json',JSON.stringify({app:'ovitrampas-ponta-pora',exportado:new Date().toISOString(),store:STORE},null,1),'application/json');
});
$('resetBase').addEventListener('click',()=>{
  if(!confirm('Apagar as alterações guardadas neste aparelho (importações e registros de campo) e voltar aos dados publicados?\n\nFaça um Backup (JSON) antes, se quiser guardar.')) return;
  try{ localStorage.removeItem(STORE_KEY); }catch(e){}
  location.reload();
});
