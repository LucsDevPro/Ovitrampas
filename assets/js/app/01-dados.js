/* app/01-dados.js — dados-base: lista oficial de ovitrampas, correções, dados atualizáveis guardados no aparelho, utilidades. Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* app.js — mapa de campo (Prefeitura de Ponta Porã). Dados vêm de data/*.json via boot.js. */

/* ===================== BASE OFICIAL (coordenação) =====================
   [ID, rua, número, latitude, longitude, ovos] — texto original da planilha (atualização de 02/10/2026).
   Ovos = null quando não informado (ovitrampas 220 a 242 ainda sem contagem). IDs 1–242 são permanentes: nunca renumerar. */
const RAW = window.__BOOT.raw;;

/* Registro de correções. Nenhuma coordenada é alterada em silêncio:
   toda correção deve ser feita aqui e aparece no painel de conferência. */
const CORRECOES = window.__BOOT.correcoes.map(c=>({...c})); // { id, campo:'lat'|'lon'|'endereco', de, para, motivo, data, responsavel }

const CENTRO = [-22.536, -55.726];
/* Contorno do número = faixa de ovos */
const FAIXAS_OVOS=[['0 ovos','#00a8e8'],['1–20 ovos','#22bf4a'],['21–50 ovos','#ffc800'],['51–100 ovos','#ff7a00'],['101+ ovos','#e60026'],['Sem informação','#7b1fa2']];
const corOvos=n=>(n===null||n===undefined)?'#7b1fa2':n<=0?'#00a8e8':n<=20?'#22bf4a':n<=50?'#ffc800':n<=100?'#ff7a00':'#e60026';
const ovOn=()=>!!(document.getElementById('ovOn')&&document.getElementById('ovOn').checked);
const ovPrintOn=()=>window.__ovForce===true||!!(document.getElementById('ovPrint')&&document.getElementById('ovPrint').checked);
const GCOL = ['#d90429','#7b2cbf','#1b8a2f','#e36414','#1d4ed8','#0a9396','#c9184a','#8a6d00','#6a040f','#0b525b'];

/* Modelo pronto para dados futuros (agente, equipe, datas, ovos, situação, foto, observação, histórico, status) */
const enderecoCompleto = (rua,num) => { num=String(num||'').trim(); return (!num||/^[—–-]+$/.test(num))? rua : rua+', '+num; };
const pts = RAW.map(r => ({
  id: r[0], rua: r[1], numero: r[2], endereco: enderecoCompleto(r[1],r[2]), latRaw: r[3], lonRaw: r[4],
  lat: parseFloat(r[3]), lon: parseFloat(r[4]),
  semEndereco: /^Sem endere/i.test(r[1]),
  agente: null, equipe: null, dataInstalacao: null, dataRecolhimento: null,
  ovos: (r[5]===null||r[5]===undefined)? null : r[5], situacao: null, foto: null, observacao: null, historico: [], status: null,
  grupo: null, marker: null
}));
const byId = {}; pts.forEach(o => byId[o.id] = o);

/* ===================== DADOS ATUALIZÁVEIS (guardados neste aparelho) =====================
   A base original (RAW) nunca é apagada. Alterações importadas e registros de campo ficam em localStorage
   e são aplicados por cima dela ao abrir a página. "Voltar à base original" apaga só essas alterações. */
const STORE_KEY='ovitrampas.dados.v2';
function storeVazio(){ return {versao:2,quando:null,pts:{},agentes:null,ciclo:{},corr:[],log:[],serie:null}; }
function storeLer(){
  try{ const t=localStorage.getItem(STORE_KEY); if(t){ const d=JSON.parse(t); if(d&&d.versao===2) return Object.assign(storeVazio(),d); } }catch(e){}
  return storeVazio();
}
let STORE=storeLer();
function storeSalvar(){
  STORE.quando=new Date().toISOString();
  try{ localStorage.setItem(STORE_KEY,JSON.stringify(STORE)); return true; }catch(e){ console.warn('Não foi possível guardar:',e); return false; }
}
function aplicaPonto(o,d){
  if(d.rua!==undefined) o.rua=d.rua;
  if(d.numero!==undefined) o.numero=d.numero;
  if(d.lat!==undefined){ o.latRaw=d.lat; o.lat=parseFloat(d.lat); }
  if(d.lon!==undefined){ o.lonRaw=d.lon; o.lon=parseFloat(d.lon); }
  if(d.ovos!==undefined) o.ovosBase=(d.ovos===null)?null:d.ovos;
  o.endereco=enderecoCompleto(o.rua,o.numero); o.semEndereco=/^Sem endere/i.test(o.rua);
}
function ovosEfetivo(o){
  const h=(o.historico||[]).filter(x=>x&&x.d&&isFinite(x.n)).sort((a,b)=>a.d.localeCompare(b.d));
  return h.length? h[h.length-1].n : (o.ovosBase===undefined? o.ovos : o.ovosBase);
}
pts.forEach(o=>{ o.ovosBase=o.ovos; });
Object.keys(STORE.pts).forEach(id=>{ const o=byId[+id]; if(o) aplicaPonto(o,STORE.pts[id]); });
const PUB=window.__BOOT.pub;
Object.keys((PUB.ano&&PUB.ano.campo)||{}).forEach(id=>{ const o=byId[+id], c=PUB.ano.campo[id]; if(!o||!c) return; o.dataInstalacao=c.inst||null; o.dataRecolhimento=c.rec||null; o.historico=(c.hist||[]).map(x=>({d:x.d,n:x.n})); });
Object.keys(STORE.ciclo).forEach(id=>{ const o=byId[+id], c=STORE.ciclo[id]; if(!o||!c) return; o.dataInstalacao=c.inst||null; o.dataRecolhimento=c.rec||null; o.historico=Array.isArray(c.hist)?c.hist:[]; });
pts.forEach(o=>{ o.ovos=ovosEfetivo(o); });
if(Array.isArray(STORE.corr)) STORE.corr.forEach(x=>CORRECOES.push(x));

/* ===================== utilidades ===================== */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function toast(msg){ const t=$('toast'); t.textContent=msg; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none',3200); }
function hav(a,b,c,d){ const p=Math.PI/180,x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2; return 2*6371*Math.asin(Math.sqrt(x)); }
const linkAbrir = o => `https://www.google.com/maps/search/?api=1&query=${o.latRaw},${o.lonRaw}`;
const linkNavegar = o => `https://www.google.com/maps/dir/?api=1&destination=${o.latRaw},${o.lonRaw}&travelmode=driving`;

function parseIds(str){
  const out=new Set(), bad=[];
  String(str).split(/[,;\s]+/).filter(Boolean).forEach(t=>{
    const m=t.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if(m){ let a=+m[1],b=+m[2]; if(a>b)[a,b]=[b,a]; if(a<1||b>242){bad.push(t);return;} for(let i=a;i<=b;i++) out.add(i); }
    else if(/^\d+$/.test(t)){ const n=+t; if(n>=1&&n<=242) out.add(n); else bad.push(t); }
    else bad.push(t);
  });
  return {ids:[...out].sort((a,b)=>a-b), bad};
}
function compress(ids){
  const s=[...ids].sort((a,b)=>a-b), out=[]; let i=0;
  while(i<s.length){ let j=i; while(j+1<s.length&&s[j+1]===s[j]+1) j++; out.push(j>i+1? `${s[i]}-${s[j]}` : s.slice(i,j+1).join(', ')); i=j+1; }
  return out.join(', ');
}
