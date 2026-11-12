/* boot.js — carregamento comum às duas páginas:
   · dados em arquivos (data/manifest.json + enderecos.json + agentes.json + AAAA.json), com cache por versão;
   · bibliotecas pesadas só quando necessárias (PDF, ZIP, QR, mapa vetorial);
   · service worker (funcionamento sem internet e atualização controlada). */
(function(){
  'use strict';
  const SCRIPT=document.currentScript, RAIZ=new URL('../../',SCRIPT.src).href, VERSAO='fcddf236';
  window.SITE={raiz:RAIZ,versao:VERSAO};

  /* ---- hash FNV-1a (mesmo cálculo de tools/atualizar_dados.py) ---- */
  window.fnv1a=txt=>{ const b=new TextEncoder().encode(txt); let h=0x811c9dc5; for(let i=0;i<b.length;i++){ h^=b[i]; h=Math.imul(h,0x01000193)>>>0; } return h.toString(16).padStart(8,'0'); };

  /* ---- categoria do ponto: malha (1–242) · pe (ponto estratégico, "500 PE" / "P.E") · ai (aldeia, "AI") · outro.
         Cada categoria tem contagem à parte (não entra no IPO/IDO/IDV da malha). ---- */
  window.categoriaPonto=id=>{ const t=String(id).trim();
    if(/^\d+$/.test(t)) return 'malha';
    if(/(^|[\s._-])P\.?\s?E\.?($|[\s._-])/i.test(t)) return 'pe';
    if(/(^|[\s._-])A\.?\s?I\.?($|[\s._-])/i.test(t)) return 'ai';
    return 'outro'; };
  /* ---- faixas de ovos: cores fortes (família da logo) + uma FORMA por faixa, para quem imprime sem cor ou tem daltonismo.
         Limites das faixas inalterados: 0 · 1–20 · 21–50 · 51–100 · 101+ · sem informação. ---- */
  window.COR_FAIXA=['#00a8e8','#22bf4a','#ffc800','#ff7a00','#e60026','#7b1fa2'];
  window.FORMA_FAIXA=[ /* viewBox 0 0 16 16: círculo · triângulo · losango · quadrado · estrela · triângulo invertido */
    'M8 1.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z','M8 1.5L15 14H1z','M8 1L15 8L8 15L1 8z','M2.2 2.2H13.8V13.8H2.2z',
    'M8 .8L10.1 5.8L15.4 6.2L11.3 9.6L12.6 15L8 12.1L3.4 15L4.7 9.6L.6 6.2L5.9 5.8z','M1.5 2H14.5L8 14.5z'];
  window.svgFaixa=(i,cor,tam)=>`<svg class="fx" width="${tam||14}" height="${tam||14}" viewBox="0 0 16 16" aria-hidden="true"><path d="${FORMA_FAIXA[i]}" fill="${cor||COR_FAIXA[i]}" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  /* no canvas (relatório / impressão): centro (x,y), tamanho t */
  window.desenhaFaixa=(c,i,x,y,t,cor)=>{ c.save(); c.translate(x-t/2,y-t/2); c.scale(t/16,t/16); const P=new Path2D(FORMA_FAIXA[i]); c.fillStyle=cor||COR_FAIXA[i]; c.fill(P); c.lineWidth=1.6; c.strokeStyle='#111'; c.lineJoin='round'; c.stroke(P); c.restore(); };

  window.CATEGORIAS={pe:'Ovitrampas em pontos estratégicos (PE)',ai:'Ovitrampas em aldeia (AI)',outro:'Outras ovitrampas'};

  /* ---- bibliotecas sob demanda ---- */
  const LIBS={
    maplibre:{js:'assets/vendor/maplibre-gl.js',css:'assets/vendor/maplibre-gl.css',ok:()=>!!window.maplibregl},
    jspdf:{js:'assets/vendor/jspdf.umd.min.js',ok:()=>!!window.jspdf},
    jszip:{js:'assets/vendor/jszip.min.js',ok:()=>!!window.JSZip},
    qrcode:{js:'assets/vendor/qrcode.js',ok:()=>typeof window.qrcode==='function'},
    html2canvas:{js:'assets/vendor/html2canvas.min.js',ok:()=>typeof window.html2canvas==='function'}
  }, pend={};
  function script(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('Não foi possível carregar '+src)); document.head.appendChild(s); }); }
  window.carregaScript=src=>script(RAIZ+src+'?v='+VERSAO);
  window.carregaLib=nome=>{
    const L=LIBS[nome]; if(!L) return Promise.reject(new Error('biblioteca desconhecida: '+nome));
    if(L.ok()) return Promise.resolve();
    if(pend[nome]) return pend[nome];
    if(L.css&&!document.querySelector('link[data-lib="'+nome+'"]')){ const l=document.createElement('link'); l.rel='stylesheet'; l.href=RAIZ+L.css+'?v='+VERSAO; l.dataset.lib=nome; document.head.appendChild(l); }
    return pend[nome]=script(RAIZ+L.js+'?v='+VERSAO).then(()=>{ if(!L.ok()) throw new Error('biblioteca '+nome+' carregou, mas não iniciou'); }).catch(e=>{ delete pend[nome]; throw e; });
  };

  /* ---- dados: manifest sempre revalidado; arquivos versionados (?v=) ficam no cache do navegador ---- */
  const memo={};
  async function json(url,opt){ const r=await fetch(url,opt); if(!r.ok) throw new Error(url.replace(RAIZ,'')+' → HTTP '+r.status); return r.json(); }
  window.Dados={
    manifest(){ return memo.manifest||(memo.manifest=json(RAIZ+'data/manifest.json',{cache:'no-cache'}).catch(async e=>{ delete memo.manifest; throw e; })); },
    async arquivo(chave){ const m=await this.manifest(), a=m.arquivos[chave]; if(!a) return null; return memo[chave]||(memo[chave]=json(RAIZ+'data/'+a.url+'?v='+a.v).catch(e=>{ delete memo[chave]; throw e; })); },
    ano(ano){ return this.arquivo(String(ano)); },
    limpa(){ Object.keys(memo).forEach(k=>delete memo[k]); }
  };
  const ultimo=a=>{ for(let i=a.length-1;i>=0;i--) if(a[i]!==null&&a[i]!==undefined) return a[i]; return null; };
  /* estrutura usada pelo mapa de campo: [id, rua, número, lat, lon, ovos atuais] */
  window.Dados.paraApp=(m,ender,ag,ano)=>{
    const serie=ano?ano.serie:{}, atual=ano&&ano.atual?ano.atual:{};
    const raw=ender.ovitrampas.map(o=>{ const v=atual[o.id]!==undefined?atual[o.id]:(serie[o.id]?ultimo(serie[o.id]):null); return [o.id,o.rua,o.numero,o.lat,o.lon,v]; });
    return {raw,agentes:ag.agentes.map(a=>[a.zona,a.area,a.nome,a.ini,a.fim,a.equipe]),correcoes:ender.correcoes||[],pub:{manifest:m,enderecos:ender,agentes:ag,ano}};
  };

  /* ---- tela de carregamento / erro ---- */
  function aviso(titulo,texto){ const s=document.getElementById('splash'); if(!s) return; s.classList.add('erro'); s.querySelector('[data-splash-txt]').innerHTML='<b>'+titulo+'</b><br>'+texto; }
  window.splashFim=()=>{ const s=document.getElementById('splash'); if(s){ s.classList.add('fim'); setTimeout(()=>s.remove(),400); } };
  window.bootErro=e=>{ console.error(e); aviso('Não foi possível carregar os dados.',location.protocol==='file:'
    ?'Esta página precisa ser aberta pelo endereço do site (GitHub Pages) ou por um servidor local, por exemplo <code>python -m http.server</code> na pasta do projeto. Abrir o arquivo direto do disco não permite ler os dados.'
    :'Confira a conexão e tente de novo. ('+(e&&e.message||e)+')'); };

  /* ---- service worker ---- */
  if('serviceWorker' in navigator&&location.protocol!=='file:'){
    navigator.serviceWorker.register(RAIZ+'sw.js?v='+VERSAO).then(reg=>{
      reg.addEventListener('updatefound',()=>{ const n=reg.installing; if(n) n.addEventListener('statechange',()=>{ if(n.state==='installed'&&navigator.serviceWorker.controller) document.dispatchEvent(new Event('nova-versao')); }); });
    }).catch(e=>console.warn('Service worker indisponível:',e));
  }
  document.addEventListener('nova-versao',()=>{
    if(document.getElementById('banner-versao')) return;
    const b=document.createElement('div'); b.id='banner-versao'; b.setAttribute('role','status');
    b.innerHTML='<span>Há uma nova versão do sistema.</span><button type="button" class="btn btn-sm btn-primary">Atualizar agora</button>';
    b.querySelector('button').onclick=()=>location.reload(); document.body.appendChild(b);
  });

  /* ---- inicialização do mapa de campo ---- */
  if(document.body.dataset.pagina==='app'){
    (async()=>{
      try{
        const m=await Dados.manifest(), [e,a,y]=await Promise.all([Dados.arquivo('enderecos'),Dados.arquivo('agentes'),m.ano_atual?Dados.ano(m.ano_atual):null]);
        window.__BOOT=Dados.paraApp(m,e,a,y);
        /* o mapa de campo é dividido em arquivos em assets/js/app/ — carregados NESTA ORDEM (14-inicio.js por último) */
        for(const f of ['01-dados.js','02-mapa.js','03-agrupar-validar.js','04-grid.js','05-relatorio.js','06-print.js','07-agentes-lote.js','08-importar.js','08b-ruas.js','09-indicadores.js','10-rota.js','11-grid-analise.js','12-offline.js','13-publicar.js','14-inicio.js']) await carregaScript('assets/js/app/'+f);
        window.splashFim();
      }catch(e){ window.bootErro(e); }
    })();
  }
})();

/* ordenar qualquer tabela (A–Z / Z–A, números e datas) tocando no título da coluna */
document.addEventListener('click',e=>{
  const th=e.target.closest&&e.target.closest('thead th'); if(!th||e.target.closest('button,a,input,select')||th.querySelector('button')) return;
  const tb=th.closest('table'); if(!tb||tb.classList.contains('heat')||!tb.tBodies[0]) return;
  const idx=[...th.parentNode.children].indexOf(th), asc=th.dataset.ord!=='asc';
  tb.querySelectorAll('thead th').forEach(x=>{ delete x.dataset.ord; }); th.dataset.ord=asc?'asc':'desc';
  const chave=tr=>{ const c=tr.children[idx]; let t=(c?c.textContent:'').trim(); if(!t||/^[—–-]$/.test(t)) return {v:null};
    const d=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(d) return {n:+(d[3]+d[2].padStart(2,'0')+d[1].padStart(2,'0'))};
    if(/^[+-−]?\s*[\d.]+(,\d+)?\s*(%|p\.p\.)?$/.test(t)||/^[+-−]?\s*\d+(\.\d+)?\s*(%)?$/.test(t)){ return {n:parseFloat(t.replace('−','-').replace(/\s|%|p\.p\./g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'))}; }
    const m=t.match(/^(\d+)\s*(de|\/)\s*\d+/); if(m) return {n:+m[1]};
    return {s:t}; };
  const todas=[...tb.tBodies[0].rows], fixas=todas.filter(r=>/^total/i.test((r.children[0]||{}).textContent||'')||r.classList.contains('tot')||r.classList.contains('tit')), mov=todas.filter(r=>!fixas.includes(r));
  mov.sort((a,b)=>{ const x=chave(a), y=chave(b); if(x.v===null&&y.v===null) return 0; if(x.v===null) return 1; if(y.v===null) return -1;
    let r; if(x.n!==undefined&&y.n!==undefined) r=x.n-y.n; else r=String(x.s!==undefined?x.s:x.n).localeCompare(String(y.s!==undefined?y.s:y.n),'pt',{numeric:true,sensitivity:'base'}); return asc?r:-r; });
  mov.forEach(r=>tb.tBodies[0].appendChild(r)); fixas.forEach(r=>tb.tBodies[0].appendChild(r));
});
