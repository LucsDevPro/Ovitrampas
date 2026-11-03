/* gestao/04-imprimir.js — Botão de impressora: imprimir só uma tabela/cartão. Carregado em ordem por gestao.html (mesmo escopo global dos outros arquivos de assets/js/gestao/). */
/* ===== imprimir só uma tabela / um cartão (ícone de impressora) ===== */
function imprimeAlvo(el,titulo,sub){
  if(!el) return;
  const cab=document.createElement('div'); cab.className='pcab';
  cab.innerHTML=`<img src="assets/img/logo-2x.png" alt="" height="48"><div><b>${esc(titulo)}</b><span>${esc(sub||'Painel de gestão — ovitrampas · Ponta Porã/MS')}</span></div><small>Impresso em ${new Date().toLocaleDateString('pt-BR')}</small>`;
  el.parentNode.insertBefore(cab,el);
  const ocultos=[]; let n=el; while(n&&n!==document.body){ [...n.parentNode.children].forEach(s=>{ if(s!==n&&s!==cab&&!(s.contains&&s.contains(cab))&&s.tagName!=='SCRIPT'&&s.tagName!=='STYLE'){ s.classList.add('pn-oc'); ocultos.push(s); } }); n=n.parentNode; }
  const bs=[[typeof mapa!=='undefined'?mapa:null],[typeof mapaM!=='undefined'?mapaM:null]].map(([m])=>{ try{ return m?[m,m.getBounds()]:null; }catch(e){ return null; } }).filter(Boolean);
  el.classList.add('print-alvo'); const pais=[]; for(let q=el.parentNode;q&&q!==document.body;q=q.parentNode){ q.classList.add('pn-blk'); pais.push(q); }
  const fim=()=>{ window.onafterprint=null; cab.remove(); el.classList.remove('print-alvo'); ocultos.forEach(s=>s.classList.remove('pn-oc')); pais.forEach(q=>q.classList.remove('pn-blk')); bs.forEach(([m,b])=>{ try{ m.invalidateSize({animate:false}); m.fitBounds(b,{animate:false}); }catch(e){} }); };
  window.onafterprint=fim;
  setTimeout(()=>{ mapa&&mapa.invalidateSize(); mapaM&&mapaM.invalidateSize(); setTimeout(()=>{ window.print(); setTimeout(()=>{ if(el.classList.contains('print-alvo')&&!window.onafterprint) fim(); },1500); },300); },100);
}
const SVG_PRN='<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M7 3h10v5H7zM5 9h14a2 2 0 0 1 2 2v6h-4v4H7v-4H3v-6a2 2 0 0 1 2-2zm4 6v4h6v-4z" fill="currentColor"/></svg>';
function addPrn(){
  document.querySelectorAll('main h2,main h3').forEach(h=>{ const alvo=h.parentElement; if(!alvo||h.dataset.prn||h.closest('.noprint')||!(alvo.tagName==='SECTION'||alvo.classList.contains('cx')||alvo.classList.contains('tabv'))||!alvo.querySelector('table,svg,.kpis,.gcards,#dist,#mapa')) return;
    h.dataset.prn='1'; alvo.classList.add('pr-host',alvo.tagName==='SECTION'?'pr-sec':'pr-card'); const b=document.createElement('button'); b.type='button'; b.className='btprn noprint'; b.title='Imprimir só esta parte'; b.setAttribute('aria-label','Imprimir só esta parte'); b.innerHTML=SVG_PRN;
    b.onclick=e=>{ e.stopPropagation(); imprimeAlvo(alvo,h.textContent.replace(/\s+/g,' ').trim()); }; alvo.appendChild(b); });
}
{ let tm=null; new MutationObserver(()=>{ clearTimeout(tm); tm=setTimeout(addPrn,120); }).observe(document.querySelector('main')||document.body,{childList:true,subtree:true}); setTimeout(addPrn,800); }

