/* gestao/06-extras.js — Esconder equipes, tema claro/escuro, impressão do mapa. Carregado em ordem por gestao.html (mesmo escopo global dos outros arquivos de assets/js/gestao/). */
/* esconder / mostrar os botões de equipe (o filtro escolhido continua valendo) */
{ const sec=document.querySelector('.filtros'), b=$('btnEq'); let esc=false; try{ esc=localStorage.getItem('ovEqEsc')==='1'; }catch(e){}
  const aplica=()=>{ if(!sec||!b) return; sec.classList.toggle('eq-esc',esc); b.textContent=esc?'Mostrar equipes':'Esconder equipes'; b.setAttribute('aria-expanded',String(!esc)); };
  if(b){ b.onclick=()=>{ esc=!esc; try{ localStorage.setItem('ovEqEsc',esc?'1':'0'); }catch(e){} aplica(); }; aplica(); } }

/* tema claro (padrão) / escuro (lembra a escolha) */
{ const b=$('btnTema'), r=document.documentElement; let esc=false; try{ esc=localStorage.getItem('ovTema')==='escuro'; }catch(e){}
  const ap=()=>{ r.setAttribute('data-tema',esc?'escuro':'claro'); if(b){ b.textContent=esc?'Tema claro':'Tema escuro'; b.setAttribute('aria-pressed',String(esc)); } };
  if(b) b.onclick=()=>{ esc=!esc; try{ localStorage.setItem('ovTema',esc?'escuro':'claro'); }catch(e){} ap(); }; ap(); }

/* impressão do mapa: ajusta o tamanho ao da página e reenquadra (evita mapa cortado) */
{ let salvo=[]; 
  window.addEventListener('beforeprint',()=>{ salvo=[]; [['mapa',typeof mapa!=='undefined'?mapa:null],['mapaM',typeof mapaM!=='undefined'?mapaM:null]].forEach(([id,m])=>{ if(!m||!$(id)) return; try{ const b=m.getBounds(); salvo.push([m,b]); m.invalidateSize({animate:false}); m.fitBounds(b,{animate:false,padding:[4,4]}); }catch(e){} }); });
  window.addEventListener('afterprint',()=>{ salvo.forEach(([m,b])=>{ try{ m.invalidateSize({animate:false}); m.fitBounds(b,{animate:false}); }catch(e){} }); salvo=[]; }); }
