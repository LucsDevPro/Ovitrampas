/* app/05-relatorio.js — relatório de campo (folha com mapa, endereços e QR). Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== relatório de campo ===================== */
let folhaAtual=null;
function selList(){ return [...sel].sort((a,b)=>a-b).map(id=>byId[id]); }
function infoSel(){
  const ids=[...sel]; if(!ids.length) return null;
  const ags=[...new Set(ids.map(id=>AG_POR_ID[id]).filter(Boolean))];
  if(ags.length===1) return infoAg(ags[0]);
  const eqs=[...new Set(ags.map(a=>a.equipe))];
  if(eqs.length===1&&eqs[0]) return {agente:'',area:'',zona:null,equipe:'Equipe '+eqs[0],eqCor:COR_EQ[eqs[0]]};
  return null;
}
function infoTela(){
  const man={agente:$('agNome').value.trim(),equipe:$('agEquipe').value.trim()}, auto=infoSel()||{};
  return {agente:man.agente||auto.agente||'',area:auto.area||'',zona:auto.zona||null,equipe:man.equipe||auto.equipe||'',eqCor:man.equipe?null:(auto.eqCor||null)};
}
const slug=t=>String(t).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30);
const nomeFolha=(lista,info)=>nomeArq(lista)+(info&&info.agente?'_'+slug(info.agente):'');
async function abrirFolha(){
  const lista=selList();
  if(!lista.length){ toast('Selecione ao menos uma ovitrampa para gerar o mapa.'); return; }
  $('sheet').style.display='block'; document.body.style.overflow='hidden';
  $('sheetImg').style.display='none'; $('sheetLoad').style.display='block'; $('sheetLoad').textContent='Gerando relatório em alta resolução…';
  $('sStatus').textContent='';
  $('sShare').style.display=(navigator.canShare&&navigator.canShare({files:[new File([''],'a.png',{type:'image/png'})]}))?'inline-block':'none';
  try{
    const info=infoTela(), r=await gerarImagem(lista,tituloLista(lista),null,info);
    folhaAtual={cv:r.cv,lista,info,modo:r.modo};
    const b=await toBlobP(r.cv), im=$('sheetImg');
    if(im.dataset.u) URL.revokeObjectURL(im.dataset.u);
    im.dataset.u=URL.createObjectURL(b); im.src=im.dataset.u;
    im.style.display='block'; $('sheetLoad').style.display='none';
    $('sStatus').textContent=`${r.cv.width}×${r.cv.height} px`+(r.modo==='raster'?' · modo reserva':'');
  }catch(e){ console.error(e); $('sheetLoad').textContent='Não foi possível gerar o relatório. Confira a internet e tente de novo.'; }
}
function fecharFolha(){ $('sheet').style.display='none'; document.body.style.overflow=''; setTimeout(()=>map.invalidateSize(),50); }
$('gen').addEventListener('click',abrirFolha); if($('gen2')) $('gen2').addEventListener('click',abrirFolha);
$('sBack').addEventListener('click',fecharFolha);
$('sPrint').addEventListener('click',()=>{ if(!folhaAtual){ toast('Aguarde o relatório terminar de carregar.'); return; } const t=document.title; document.title='Relatório de campo - ovitrampas '+compress(folhaAtual.lista.map(o=>o.id)); window.print(); setTimeout(()=>document.title=t,500); });
$('sPng').addEventListener('click',async()=>{
  if(!folhaAtual){ toast('Aguarde o relatório terminar de carregar.'); return; }
  try{ baixarArq(await toBlobP(folhaAtual.cv),nomeFolha(folhaAtual.lista,folhaAtual.info)+'.png'); }catch(e){ console.error(e); toast('Não foi possível salvar a imagem.'); }
});
$('sPdf').addEventListener('click',async()=>{
  if(!folhaAtual){ toast('Aguarde o relatório terminar de carregar.'); return; }
  try{ await carregaLib('jspdf'); }catch(e){ toast('PDF indisponível (biblioteca não carregou).'); return; }
  try{ const p=novoPdf(folhaAtual.cv); pdfAdd(p,folhaAtual.cv,false); baixarArq(p.output('blob'),nomeFolha(folhaAtual.lista,folhaAtual.info)+'.pdf'); }
  catch(e){ console.error(e); toast('Não foi possível gerar o PDF.'); }
});
$('sShare').addEventListener('click',async()=>{
  if(!folhaAtual) return;
  try{ await navigator.share({files:[new File([await toBlobP(folhaAtual.cv)],nomeFolha(folhaAtual.lista,folhaAtual.info)+'.png',{type:'image/png'})],title:'Relatório de campo — ovitrampas'}); }
  catch(e){ if(e.name!=='AbortError') toast('Não foi possível compartilhar. Use “Salvar PNG”.'); }
});
$('sWa').addEventListener('click',()=>{
  const l=selList();
  const ag=infoTela().agente; const txt=`*Ovitrampas — Ponta Porã/MS*\n`+(ag?`Agente: ${ag}\n`:'')+`${l.length} ponto(s) para visita\n\n`+l.map(o=>`*${o.id}* — ${o.endereco}${o.ovos!==null?` (ovos: ${o.ovos})`:''}\n${linkNavegar(o)}`).join('\n\n');
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
});
