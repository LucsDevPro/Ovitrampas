/* app/08b-ruas.js — correção dos nomes de rua. É o MESMO cálculo de tools/ruas.py (a planilha vem digitada à mão: sem acento,
   com erros, "Rua:" colado, prefixos misturados). Mantenha os dois iguais. O dicionário fica em data/enderecos.json ("ruas"):
   chave (nome sem acento, sem "Rua/Av.", sem "de/da/do", sem título) → nome correto. Carregado em ordem por boot.js. */
const R_SEM_VALOR=new Set(['de','da','do','das','dos','e']), R_TITULOS=new Set(['dr','doutor','dra','doutora']);
const R_EXPANDE={cel:'Coronel',eng:'Engenheiro',prof:'Professor',sta:'Santa',sto:'Santo'};
const R_PART=new Set(['de','da','do','das','dos','e','a','o']);
const R_TIPOS={rua:'Rua',r:'Rua',av:'Av.',avenida:'Av.',ave:'Av.',travessa:'Travessa',trav:'Travessa',tv:'Travessa',alameda:'Alameda',rodovia:'Rodovia',rod:'Rodovia'};
const R_LUGARES=['cemiterio','borracharia','posto','ferro velho','guarda','igreja','escola','hospital','mercado','oficina','fazenda','sitio','chacara','condominio','monte claro'];
const R_LIMIAR=0.8;
const rSemAc=t=>String(t==null?'':t).normalize('NFD').replace(/[̀-ͯ]/g,'');
const rEhLugar=nome=>R_LUGARES.some(l=>new RegExp('\\b'+l+'\\b').test(rSemAc(nome).toLowerCase()));
function rLev(a,b){ let ant=Array.from({length:b.length+1},(_,i)=>i); for(let i=1;i<=a.length;i++){ const atu=[i]; for(let k=1;k<=b.length;k++) atu.push(Math.min(ant[k]+1,atu[k-1]+1,ant[k-1]+(a[i-1]!==b[k-1]?1:0))); ant=atu; } return ant[b.length]; }
function rTipoDe(w){
  const k=rSemAc(w).toLowerCase().replace(/\./g,'');
  if(R_TIPOS[k]) return R_TIPOS[k];
  if(k==='ru') return 'Rua';
  if(k.length>=6) for(const [longo,tipo] of [['avenida','Av.'],['travessa','Travessa'],['alameda','Alameda'],['rodovia','Rodovia']]) if(rLev(k,longo)<=1) return tipo;
  return null;
}
/* texto digitado → [tipo ou null, nome, referência] */
function rPartes(rua){
  let t=String(rua==null?'':rua).trim().replace(/\s+/g,' ');
  t=t.replace(/^[ :;,-]+/,'');
  t=t.replace(/^([\p{L}\p{N}_]+\.?)\s*[:;,]\s*/u,'$1 ');
  t=t.replace(/^(av|rua|r|trav|tv|rod)\.(?=\S)/i,(m,g)=>g+'. ');
  let ref='';
  const mr=t.match(/^(?:rodovia\s+|rod\.?\s+)?([A-Za-z]{2})\s*-?\s*(\d{2,3})\b[\s,;:-]*(.*)$/i);
  if(mr&&['BR','MS'].includes(mr[1].toUpperCase())) return ['Rodovia',mr[1].toUpperCase()+'-'+mr[2],mr[3].replace(/^[ ()]+|[ ()]+$/g,'')];
  const m=t.match(/\s+-\s+(.+)$/)||t.match(/\s*\((.+)\)\s*$/);
  if(m){ ref=m[1].trim(); ref=ref.charAt(0).toUpperCase()+ref.slice(1); t=t.slice(0,m.index).trim(); }
  t=t.replace(/^[ ,;:-]+|[ ,;:-]+$/g,'');
  let pal=t?t.split(' '):[];
  const ms=pal.join(' ').trim().match(/^(?:rodovia\s+)?([A-Za-z]{2})\s*[- ]?\s*(\d{2,3})$/i);
  if(ms) return ['Rodovia',ms[1].toUpperCase()+'-'+ms[2],ref];
  let tipo=null;
  while(pal.length&&rTipoDe(pal[0])){ tipo=tipo||rTipoDe(pal[0]); pal=pal.slice(1); }
  if(pal.length>1&&tipo===null&&pal[0].toLowerCase().replace(/\.+$/,'')==='a'&&rSemAc(pal[1]).toLowerCase()==='brasil'){ tipo='Av.'; pal=pal.slice(1); }
  pal=pal.length?pal.join(' ').replace(/\b(Cel|Eng|Prof|Dr|Dra|Sta|Sto)\.(?=\S)/gi,'$1. ').split(' '):[];
  const out=[];
  pal.forEach((w,i)=>{
    const k=rSemAc(w).toLowerCase().replace(/\.+$/,'');
    if(R_EXPANDE[k]){ out.push(R_EXPANDE[k]); return; }
    if(k==='dr'||k==='dra'){ out.push(k.charAt(0).toUpperCase()+k.slice(1)+'.'); return; }
    if(w.length>1&&w===w.toUpperCase()&&w!==w.toLowerCase()&&!/^\d+$/.test(w)){ out.push(w); return; }
    if(/\d/.test(w)||w.includes("'")){ out.push(w); return; }
    if(R_PART.has(w.toLowerCase())&&(i>0||pal.length>1)){ out.push(w.toLowerCase()); return; }
    out.push(w.charAt(0).toUpperCase()+w.slice(1).toLowerCase());
  });
  let nome=out.join(' ');
  if(nome.length>4&&nome===nome.toUpperCase()&&nome!==nome.toLowerCase()&&!/\d/.test(nome))
    nome=nome.split(' ').map((w,i)=>(i>0&&R_PART.has(w.toLowerCase()))?w.toLowerCase():w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(' ');
  return [tipo,nome,ref];
}
/* "Hélio Brandão 951" → ["Hélio Brandão","951"]; "Bandeirantes quadra 49 lote 491" → ["Bandeirantes","quadra 49 lote 491"] */
function rTiraNumero(rua){
  const t=String(rua==null?'':rua).trim();
  const mq=t.match(/\s+(quadra\s+\S.*)$/i);
  if(mq) return [t.slice(0,mq.index).replace(/^[ ,;:]+|[ ,;:]+$/g,''),mq[1]];
  const nome=rPartes(t)[1], pal=nome.split(' '), ult=pal[pal.length-1];
  if(pal.length>=2&&/^\d{1,5}([/-]\d+)?$/.test(ult)&&!/^\d/.test(pal[0])&&!['projetada','quadra','lote'].includes(rSemAc(pal[pal.length-2]).toLowerCase())){
    const re=new RegExp('[\\s,]+'+ult.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(\\s*(\\(.*\\)|-\\s.*))?\\s*$');
    return [t.replace(re,(x,g)=>g||'').replace(/^[ ,;:]+|[ ,;:]+$/g,''),ult];
  }
  return [t,null];
}
function rChave(nome){
  return rSemAc(nome).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(Boolean)
    .map(w=>(R_EXPANDE[w]||w).toLowerCase()).filter(w=>!R_SEM_VALOR.has(w)&&!R_TITULOS.has(w)).join(' ');
}
function rSubseq(curta,longa){ let i=0; for(const w of longa){ if(w===curta[i]) i++; if(i===curta.length) break; } return i===curta.length; }
const rNum=a=>new Set(a.split(' ').filter(w=>/\d/.test(w)));
function rParecida(a,b){
  if(a===b) return true; if(!a||!b) return false;
  const na=rNum(a), nb=rNum(b); if(na.size!==nb.size||[...na].some(x=>!nb.has(x))) return false;   /* "13 de Setembro" ≠ "7 de Setembro" */
  if(1-rLev(a,b)/Math.max(a.length,b.length)>=R_LIMIAR) return true;
  const pa=a.split(' '), pb=b.split(' ');
  if(pa.length===pb.length&&pa.every((x,i)=>{ const y=pb[i]; return x===y||(x.length===1&&y.startsWith(x))||(y.length===1&&x.startsWith(y)); })) return true;
  const [c,l]=pa.length<=pb.length?[pa,pb]:[pb,pa];
  return c.length>=2&&c.length<l.length&&c[0]===l[0]&&rSubseq(c,l);
}
function rAcha(k,ruas){
  if(Object.prototype.hasOwnProperty.call(ruas,k)) return ruas[k];
  let melhor=null;
  Object.keys(ruas).forEach(kk=>{ if(rParecida(k,kk)){ const d=rLev(k,kk); if(melhor===null||d<melhor[0]) melhor=[d,ruas[kk]]; } });
  return melhor?melhor[1]:null;
}
/* nome de rua digitado → nome correto; rua nova entra em 'ruas' (e em 'novas') */
function ruaCorrigida(rua,ruas,novas){
  const [tipo,nome,ref]=rPartes(rua);
  if(!nome) return String(rua==null?'':rua).trim();
  const k=rChave(nome);
  let cano=k?rAcha(k,ruas):null;
  if(cano===null){
    if(/\b(quadra|lote)\b/.test(rSemAc(nome).toLowerCase())||(tipo===null&&rEhLugar(nome))) cano=nome;
    else{ cano=(tipo==='Rodovia')?'Rodovia '+nome:(tipo||'Rua')+' '+nome; }
    ruas[k]=cano; if(novas) novas.push(cano);
  }
  return cano+(ref?' ('+ref+')':'');
}
