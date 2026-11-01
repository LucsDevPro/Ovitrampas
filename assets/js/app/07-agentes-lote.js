/* app/07-agentes-lote.js — agentes, áreas, equipes e geração de mapas em lote. Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ================= MAPAS POR AGENTE (lotes de 5) ================= */
/* ===================== AGENTES, ÁREAS E EQUIPES (planilha da coordenação) =====================
   [zona, área, agente, ovitrampa inicial, final, equipe]. Zonas 43 e 44 ainda sem agente/equipe definidos. */
const AGENTES_RAW=window.__BOOT.agentes;
const COR_EQ={1:'#007ECA',2:'#00A651',3:'#C98A00',4:'#E0182D'};
const tituloPT=t=>String(t).toLowerCase().split(' ').map((w,i)=>/^(i|ii|iii|iv|v)$/.test(w)?w.toUpperCase():w==='p.p.'?'P.P.':(i>0&&['de','da','do','dos','das','e'].includes(w))?w:w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
const AGS=[]; const AG_POR_ID={};
function montaAgentes(raw){
  AGS.length=0; Object.keys(AG_POR_ID).forEach(k=>delete AG_POR_ID[k]);
  raw.forEach(([zona,area,nome,ini,fim,equipe])=>{
    const a={zona,area:area?tituloPT(area):'',nome,ini,fim,equipe,lista:pts.filter(o=>o.id>=ini&&o.id<=fim)};
    AGS.push(a); a.lista.forEach(o=>{ AG_POR_ID[o.id]=a; });
  });
}
montaAgentes(STORE.agentes||AGENTES_RAW);
const nomeAg=a=>a.nome||('Agente '+a.zona), eqTxt=a=>a.equipe?'Equipe '+a.equipe:'Sem equipe';
const faixa=a=>a.fim>a.ini?`${a.ini}–${a.fim}`:String(a.ini);
const rotAg=a=>`Zona ${a.zona} — Ovitrampas ${a.fim>a.ini?a.ini+' a '+a.fim:a.ini}`;
const infoAg=a=>({agente:a.nome,area:a.area,zona:a.zona,equipe:a.equipe?'Equipe '+a.equipe:'',eqCor:a.equipe?COR_EQ[a.equipe]:null});
function agentePopup(o){
  const a=AG_POR_ID[o.id]; if(!a) return '';
  return `<div class="pp-coord" style="margin-top:-6px">Agente <b>${esc(a.nome||'não definido')}</b> · ${esc(eqTxt(a))} · Zona ${a.zona}${a.area?'<br>'+esc(a.area):''}</div>`;
}
const cmpNome=(x,y)=>(x.nome?0:1)-(y.nome?0:1)||norm(x.nome).localeCompare(norm(y.nome),'pt')||x.zona-y.zona;
function ordenaAg(l,modo){
  const c=[...l];
  if(modo==='nome') c.sort(cmpNome);
  else if(modo==='zona') c.sort((x,y)=>x.zona-y.zona);
  else c.sort((x,y)=>((x.equipe||9)-(y.equipe||9))||cmpNome(x,y));
  return c;
}
let agEq=null;
function renderAgentes(){
  const modo=$('agOrd').value, q=norm($('agBusca').value.trim());
  const eqs=[...new Set(AGS.map(a=>a.equipe).filter(Boolean))].sort();
  $('agEq').innerHTML=`<button type="button" data-f="" class="${agEq===null?'on':''}">Todas</button>`+eqs.map(e=>`<button type="button" data-f="${e}" class="${agEq===e?'on':''}" style="${agEq===e?'':`border-color:${COR_EQ[e]}`}">Equipe ${e}</button>`).join('');
  let l=agentesListados();
  const row=a=>`<button type="button" class="ag" data-z="${a.zona}"><span class="agn">${esc(nomeAg(a))}</span><span class="aga">${esc(a.area||'Área não informada')}</span><span class="agm">Zona ${a.zona} · ovitrampas ${faixa(a)}</span><i class="eqc" style="background:${a.equipe?COR_EQ[a.equipe]:'#7a8b90'}">${a.equipe?'Eq. '+a.equipe:'sem eq.'}</i></button>`;
  let h='';
  if(modo==='equipe'){
    let atual='#';
    l.forEach(a=>{
      const k=a.equipe||0;
      if(k!==atual){ atual=k; const g=l.filter(x=>(x.equipe||0)===k); const nO=g.reduce((t,x)=>t+x.lista.length,0);
        h+=`<div class="agh" style="--c:${k?COR_EQ[k]:'#7a8b90'}"><span>${k?'Equipe '+k:'Sem equipe'} · ${g.length} agente${g.length>1?'s':''} · ${nO} ovitrampas</span>${k?`<button type="button" data-eq="${k}">ver equipe no mapa</button>`:''}</div>`; }
      h+=row(a);
    });
  } else h=l.map(row).join('');
  $('agents').innerHTML=h||'<div style="padding:14px;color:var(--mute)">Nenhum agente encontrado.</div>';
  $('bInfo').textContent=`${AGS.filter(a=>a.nome).length} agentes com nome · ${eqs.length} equipes · ${pts.length} ovitrampas (zonas 43 e 44 ainda sem agente).`;
  resumoLote();
}
function selecionaIds(ids){
  const old=[...sel]; sel.clear(); ids.forEach(id=>sel.add(id));
  reicon([...new Set([...old,...ids])]); field=true; refresh(true); closeMenu();
}
$('agents').addEventListener('click',e=>{
  const eb=e.target.closest('button[data-eq]');
  if(eb){ const eq=+eb.dataset.eq, g=AGS.filter(a=>a.equipe===eq); selecionaIds(g.flatMap(a=>a.lista.map(o=>o.id)));
    toast(`Equipe ${eq}: ${g.length} agentes · ${g.reduce((t,a)=>t+a.lista.length,0)} ovitrampas`); return; }
  const b=e.target.closest('button.ag'); if(!b) return;
  const a=AGS.find(x=>x.zona===+b.dataset.z);
  document.querySelectorAll('#agents button.ag').forEach(x=>x.classList.toggle('on',x===b));
  selecionaIds(a.lista.map(o=>o.id));
  toast(`${rotAg(a)} · ${eqTxt(a)}`);
});
$('agEq').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; agEq=b.dataset.f===''?null:+b.dataset.f; renderAgentes(); });
$('agOrd').addEventListener('change',renderAgentes);
$('agBusca').addEventListener('input',renderAgentes);

function agentesListados(){
  const modo=$('agOrd').value, q=norm($('agBusca').value.trim());
  return ordenaAg(AGS.filter(a=>(agEq===null||a.equipe===agEq)&&(!q||norm([a.nome,a.area,'zona '+a.zona,a.ini+'-'+a.fim,eqTxt(a)].join(' ')).includes(q))),modo);
}
const loteAlvo=agentesListados;
function resumoLote(){ const l=loteAlvo(); $('bResumo').textContent=`${l.length} agente(s) · ${l.reduce((t,a)=>t+a.lista.length,0)} ovitrampas serão gerados.`; $('bGo').textContent=l.length?`GERAR MAPAS DOS ${l.length} AGENTES LISTADOS`:'NENHUM AGENTE NA LISTA'; }

let bCancel=false, bRodando=false;
const bTxt=t=>{ $('bTxt').textContent=t; }, bBar=f=>{ $('bBar').style.width=Math.round(f*100)+'%'; };
$('bCancel').addEventListener('click',()=>{ bCancel=true; $('bCancel').disabled=true; bTxt('Cancelando após o mapa atual…'); });
$('bDone').addEventListener('click',()=>{ $('batchDlg').style.display='none'; });
const seguro=t=>String(t).replace(/[\\/:*?"<>|]/g,'').replace(/\s+/g,' ').trim();
async function gerarLote(){
  if(bRodando) return;
  const alvo=loteAlvo();
  if(!alvo.length){ toast('Nenhum agente nesse filtro.'); return; }
  const doPng=$('bPng').checked, doPdf=$('bPdf').checked, doAll=$('bAll').checked;
  if(!doPng&&!doPdf&&!doAll){ toast('Marque ao menos um formato (PNG ou PDF).'); return; }
  if(doPdf||doAll){ try{ await carregaLib('jspdf'); }catch(e){ toast('A biblioteca de PDF não carregou. Confira a internet e tente de novo.'); return; } }
  const total=alvo.length, satelite=map.hasLayer(sat), cw=1000, ch=850;
  bRodando=true; bCancel=false; closeMenu();
  $('batchT').textContent='Gerando mapas dos agentes…'; $('bCancel').disabled=false; $('bCancel').style.display=''; $('bDone').style.display='none';
  bBar(0); bTxt('Carregando mapa…'); $('batchDlg').style.display='flex';
  if(!pastaDest){ try{ await carregaLib('jszip'); }catch(e){} }
  try{ await carregaLib('qrcode'); }catch(e){}
  const zip=(window.JSZip&&!pastaDest)?new JSZip():null;
  const entrega=async(nome,blob)=>{ if(zip) zip.file(nome,blob); else{ baixarArq(blob,nome); await new Promise(r=>setTimeout(r,pastaDest?50:500)); } };
  let rend=null, feitos=0; const falhas=[], pdfsEq={};
  try{
    rend=await criaRenderer(satelite,cw,ch,maxPR(cw,ch,+$('qual').value||3),$('fundo').value||'esri');
    await fontes();
    for(let i=0;i<alvo.length;i++){
      if(bCancel) break;
      const a=alvo[i], titulo=rotAg(a);
      bTxt(`${feitos+falhas.length+1} de ${total} · ${nomeAg(a)} · ${eqTxt(a)}`); bBar((feitos+falhas.length)/total);
      const pasta=seguro(eqTxt(a)), stem=seguro(`Zona ${pad(a.zona,2)} - ${a.nome||'sem agente'} - ovitrampas ${pad(a.ini,3)}-${pad(a.fim,3)}`);
      try{
        let mapCv; try{ mapCv=await rend.render(a.lista); }catch(e){ mapCv=await rend.render(a.lista); }   /* 1 nova tentativa */
        const cv=comporFolha(mapCv,a.lista,titulo,infoAg(a));
        if(doPng) await entrega(`${pasta}/${stem}.png`,await toBlobP(cv));
        if(doPdf){ const p=novoPdf(cv); pdfAdd(p,cv,false); await entrega(`${pasta}/${stem}.pdf`,p.output('blob')); }
        if(doAll){ const k=eqTxt(a); if(!pdfsEq[k]){ pdfsEq[k]=novoPdf(cv); pdfAdd(pdfsEq[k],cv,false); } else pdfAdd(pdfsEq[k],cv,true); }
        feitos++;
      }catch(e){ console.error(e); falhas.push(a.zona); }
      await new Promise(r=>setTimeout(r,30));
    }
    if(feitos){
      bBar(1);
      for(const k of Object.keys(pdfsEq)) await entrega(`${seguro(k)} - todos os agentes.pdf`,pdfsEq[k].output('blob'));
      const nomeZip='mapas-ovitrampas_'+(agEq===null?'todas-as-equipes':'equipe-'+agEq)+($('agBusca').value.trim()?'_busca':'')+'.zip';
      if(zip){ bTxt('Compactando arquivos…'); baixarArq(await zip.generateAsync({type:'blob',compression:'STORE'}),nomeZip); }
    }
    $('batchT').textContent=bCancel?'Geração cancelada':(falhas.length?'Concluído com avisos':'Concluído');
    bTxt(`${feitos} de ${total} mapa(s) gerado(s).`+(falhas.length?` Falharam as zonas: ${falhas.join(', ')} — gere-as de novo pelo campo “Da zona … à …”.`:'')+(feitos&&!zip?' (Arquivos salvos um a um.)':'')+(feitos?(pastaDest?` Salvos na pasta “${pastaDest.name}”, em subpastas por equipe.`:' Veja a pasta Downloads (Transferências) do navegador.'):''));
  }catch(e){
    console.error(e);
    $('batchT').textContent='Não foi possível gerar';
    bTxt('O mapa não carregou (internet instável ou bloqueada). Confira a conexão e tente de novo. Detalhe: '+(e&&e.message||e));
  }finally{
    if(rend) rend.destroy();
    bRodando=false; $('bCancel').style.display='none'; $('bDone').style.display='';
  }
}
$('bGo').addEventListener('click',gerarLote);


document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if($('batchDlg').style.display==='flex'){ if(bRodando) $('bCancel').click(); else $('batchDlg').style.display='none'; } else if($('shotDlg').style.display==='flex') $('shotDlg').style.display='none'; else if($('sheet').style.display==='block') fecharFolha(); else ['impDlg','indDlg','cicloDlg','gridDlg','pubDlg','val'].forEach(id=>{ $(id).style.display='none'; }); } });
