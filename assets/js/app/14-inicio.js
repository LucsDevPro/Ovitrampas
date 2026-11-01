/* app/14-inicio.js — início: primeira renderização (precisa ser o ÚLTIMO). Carregado em ordem por boot.js; compartilha variáveis com os outros arquivos app/. */
/* ===================== início ===================== */
renderSummary(); renderAgentes(); gradeAtualiza(); atualizaIndicadores(); atualizaDadosInfo(); atualizaOffStatus(); atualizaGen(); window.__modulosOk=true; refresh(false);
fitTo(pts);

/* menu lateral: dicas escondidas atrás de um "?" em cada seção */
document.querySelectorAll('details.sec').forEach(s=>{ const sm=s.querySelector(':scope>summary'); if(!sm||!s.querySelector('p.hint:not([id])')) return;
  const b=document.createElement('button'); b.type='button'; b.className='qbtn'; b.textContent='?'; b.title='Mostrar/ocultar ajuda desta seção'; b.setAttribute('aria-label','Ajuda desta seção');
  b.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); b.setAttribute('aria-pressed',s.classList.toggle('ajuda')); }); sm.appendChild(b); });
