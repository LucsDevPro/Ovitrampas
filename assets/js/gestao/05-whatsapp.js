/* gestao/05-whatsapp.js — Resumo para WhatsApp (texto + imagem de status). Carregado em ordem por gestao.html (mesmo escopo global dos outros arquivos de assets/js/gestao/). */
/* ===== Resumo para WhatsApp: texto pronto + imagem (status) com o panorama do mês e a comparação com o mês anterior ===== */
let zapMes=null;
const cap1=s=>s.charAt(0).toUpperCase()+s.slice(1);
const fInt=x=>Math.round(x).toLocaleString('pt-BR');
const f1=x=>(Math.round(x*10)/10).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
function dTxt(a,b,tipo){ if(a===null||b===null||a===undefined||b===undefined) return ''; const d=a-b; if(Math.abs(d)<1e-9) return '■ igual'; const s=d>0?'▲ +':'▼ −', x=Math.abs(d); return s+(tipo==='pp'?f1(x)+' p.p.':tipo==='n'?fInt(x):f1(x)); }
const dCor=(a,b)=>(a===null||b===null||a===undefined||b===undefined||Math.abs(a-b)<1e-9)?'#b8c7de':a>b?'#ff8fa3':'#3ddc84';
function zapDados(i){
  const todos=AGS.flatMap(a=>a.lista), p=i-1, tem=p>=0;
  const m=metMes(todos,i), mp=tem?metMes(todos,p):null;
  const par=tem?todos.map(o=>({a:vMes(o,p),b:vMes(o,i)})).filter(x=>x.a!==null&&x.a!==undefined&&x.b!==null&&x.b!==undefined):[];
  const bandas=[0,0,0,0,0,0]; todos.forEach(o=>{ const v=vMes(o,i); if(v!==null&&v!==undefined) bandas[banda(v)]++; });
  const eqs=[...new Set(AGS.map(a=>a.equipe).filter(Boolean))].sort().map(e=>{ const l=AGS.filter(a=>a.equipe===e).flatMap(a=>a.lista); return {e,m:metMes(l,i),mp:tem?metMes(l,p):null}; }).filter(x=>x.m.ipo!==null);
  const top=todos.map(o=>({o,v:vMes(o,i)})).filter(x=>x.v>0).sort((a,b)=>b.v-a.v).slice(0,5).map(x=>({id:x.o.id,v:x.v,rua:x.o.end||''}));
  const ex=['pe','ai'].map(cat=>{ const L=EXTRAS.filter(e=>categoriaPonto(e.id)===cat), f=k=>{ const a=L.filter(e=>e.serie[k]!==null&&e.serie[k]!==undefined); return a.length?{n:a.length,pos:a.filter(e=>e.serie[k]>0).length}:null; }, c=f(i), cp=tem?f(p):null; return c?{cat,n:c.n,pos:c.pos,ipo:100*c.pos/c.n,ipoAnt:cp?100*cp.pos/cp.n:null}:null; }).filter(Boolean);
  return {i,tem,mes:cap1(nomeMes(MESES[i])),mesC:rotMes(MESES[i]),antC:tem?rotMes(MESES[p]):'',m,mp,bandas,eqs,top,ex,
    novas:par.filter(x=>x.a===0&&x.b>0).length, subiu:par.filter(x=>x.a>0&&x.b-x.a>=LIM_SUBIDA.min&&x.b>=x.a*LIM_SUBIDA.fator).length, neg:par.filter(x=>x.a>0&&x.b===0).length};
}
/* texto escrito em palavras simples (sem emoji, sem siglas soltas) para quem não é da área */
function zapMuda(a,b,un,tipo){ if(a===null||b===null||a===undefined||b===undefined) return ''; const d=a-b; if(Math.abs(d)<1e-9) return 'ficou igual'; const x=Math.abs(d); return (d>0?'aumentou ':'diminuiu ')+(tipo==='pp'?f1(x)+' pontos percentuais':tipo==='n'?fInt(x)+(un?' '+un:''):f1(x)+(un?' '+un:'')); }
function zapTexto(d){
  const ant=d.antC, L=[];
  const cmp=(a,b,un,tipo,fmt)=>d.tem&&b!==null&&b!==undefined?' (em '+ant+' era '+fmt(b)+'; '+zapMuda(a,b,un,tipo)+')':'';
  L.push('*PANORAMA DAS OVITRAMPAS - '+d.mes.toUpperCase()+'*','Ponta Porã/MS - SEV - Setor de endemias e vetores','');
  L.push('Ovitrampas são armadilhas que mostram onde o mosquito da dengue (Aedes aegypti) está colocando ovos. Quanto mais ovos, maior o risco naquele local.','');
  L.push('*Resumo do mês*');
  L.push('- *Armadilhas com ovos (IPO):* '+f1(d.m.ipo)+'%. Foram '+d.m.pos+' armadilhas com ovos, de '+d.m.n+' que tiveram contagem'+cmp(d.m.ipo,d.tem?d.mp.ipo:null,'', 'pp',x=>f1(x)+'%')+'.');
  L.push('- *Total de ovos contados:* '+fInt(d.m.ov)+cmp(d.m.ov,d.tem?d.mp.ov:null,'ovos','n',fInt)+'.');
  L.push('- *Média de ovos nas armadilhas que têm ovos (IDO):* '+f1(d.m.ido)+cmp(d.m.ido,d.tem?d.mp.ido:null,'ovos','x',f1)+'.','');
  if(d.tem){ L.push('*O que mudou desde '+ant+'*','- '+d.novas+' armadilhas que estavam sem ovos passaram a ter ovos.','- '+d.subiu+' armadilhas tiveram aumento forte de ovos.','- '+d.neg+' armadilhas que tinham ovos ficaram sem ovos.',''); }
  if(d.eqs.length){ L.push('*Armadilhas com ovos por equipe*'); d.eqs.forEach(x=>L.push('- Equipe '+x.e+': '+f1(x.m.ipo)+'%'+(d.tem&&x.mp&&x.mp.ipo!==null?' ('+zapMuda(x.m.ipo,x.mp.ipo,'','pp')+' desde '+ant+')':''))); L.push(''); }
  if(d.top.length){ L.push('*As '+d.top.length+' ovitrampas com mais ovos*'); d.top.forEach((x,k)=>L.push((k+1)+'. Ovitrampa '+x.id+(x.rua?' - '+x.rua:'')+': '+fInt(x.v)+' ovos')); L.push(''); }
  d.ex.forEach(x=>L.push('*'+(x.cat==='pe'?'Ovitrampas em pontos estratégicos (borracharias e outros)':'Ovitrampas em aldeia')+':* '+f1(x.ipo)+'% com ovos ('+x.pos+' de '+x.n+')'+(x.ipoAnt!==null?' ('+zapMuda(x.ipo,x.ipoAnt,'','pp')+' desde '+ant+')':'')+'.'));
  if(d.ex.length) L.push('');
  L.push('*Como ajudar:* elimine água parada em pratos de plantas, pneus, calhas, baldes e garrafas. Não deixe o mosquito nascer.','');
  L.push('_SEV - Setor de endemias e vetores - Prefeitura de Ponta Porã_');
  return L.join('\n');
}
async function zapImagem(d){
  await Promise.all(['900 40px Unbounded','700 40px Unbounded','400 30px Bricolage','800 30px Bricolage'].map(f=>document.fonts.load(f).catch(()=>{})));
  const logo=await new Promise(r=>{ const im=new Image(); im.onload=()=>r(im); im.onerror=()=>r(null); im.src='assets/img/logo-2x.png'; });
  const W=1080,H=1920, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const c=cv.getContext('2d');
  const UD='Unbounded, Archivo, sans-serif', BR='Bricolage, Archivo, sans-serif';
  const g=c.createLinearGradient(0,0,W,H); g.addColorStop(0,'#06173a'); g.addColorStop(.6,'#0a2145'); g.addColorStop(1,'#103a73'); c.fillStyle=g; c.fillRect(0,0,W,H);
  c.fillStyle='rgba(255,255,255,.07)'; for(let x=20;x<W;x+=36) for(let y=20;y<H;y+=36){ c.beginPath(); c.arc(x,y,2.2,0,7); c.fill(); }
  const rr=(x,y,w,h,r)=>{ c.beginPath(); if(c.roundRect) c.roundRect(x,y,w,h,r); else c.rect(x,y,w,h); };
  const T=(s,x,y,f,col,al)=>{ c.font=f; c.fillStyle=col; c.textAlign=al||'left'; c.textBaseline='alphabetic'; c.fillText(s,x,y); };
  const card=(x,y,w,h,top)=>{ rr(x,y,w,h,30); c.fillStyle='rgba(255,255,255,.08)'; c.fill(); c.strokeStyle='rgba(255,255,255,.18)'; c.lineWidth=2; c.stroke(); if(top){ c.save(); rr(x,y,w,h,30); c.clip(); c.fillStyle=top; c.fillRect(x,y,w,8); c.restore(); } };
  rr(60,56,330,124,24); c.fillStyle='#fff'; c.fill(); if(logo){ const h=96, w=h*logo.width/logo.height; c.drawImage(logo,60+(330-w)/2,56+14,w,h); }
  T('PANORAMA DAS OVITRAMPAS',60,250,'900 44px '+UD,'#fff');
  T(d.mes,60,306,'700 38px '+UD,'#4cc3ff');
  T('Ponta Porã/MS · SEV - Setor de endemias e vetores',60,348,'400 26px '+BR,'#9fb3d1');
  card(60,390,960,260,'#3ddc84');
  T('IPO · ovitrampas positivas',100,436,'800 28px '+BR,'#b8c7de');
  T(f1(d.m.ipo)+'%',96,578,'900 150px '+UD,'#3ddc84');
  if(d.tem){ T(dTxt(d.m.ipo,d.mp.ipo,'pp')+' vs '+d.antC,100,626,'800 32px '+BR,dCor(d.m.ipo,d.mp.ipo)); }
  const cw=(960-40)/3, cds=[['OVOS',fInt(d.m.ov),d.tem?dTxt(d.m.ov,d.mp.ov,'n'):'','#ffd23f',d.tem&&dCor(d.m.ov,d.mp.ov)],['POSITIVAS',d.m.pos+'/'+d.m.n,d.tem?dTxt(d.m.pos,d.mp.pos,'n'):'','#4cc3ff',d.tem&&dCor(d.m.pos,d.mp.pos)],['IDO',f1(d.m.ido),d.tem?dTxt(d.m.ido,d.mp.ido,'x'):'','#fff',d.tem&&dCor(d.m.ido,d.mp.ido)]];
  cds.forEach(([t,v,dl,cor,dc],k)=>{ const x=60+k*(cw+20); card(x,676,cw,180,cor); T(t,x+24,726,'800 24px '+BR,'#b8c7de'); let fs=60; c.font='900 '+fs+'px '+UD; while(c.measureText(v).width>cw-44&&fs>30){ fs-=2; c.font='900 '+fs+'px '+UD; } T(v,x+24,792,'900 '+fs+'px '+UD,cor); if(dl) T(dl,x+24,838,'800 24px '+BR,dc); });
  T('Ovitrampas por faixa de ovos',60,905,'700 30px '+UD,'#fff');
  const mxb=Math.max(1,...d.bandas);
  FAIXAS.forEach(([t,col],k)=>{ const y=935+k*38; desenhaFaixa(c,k,92,y+17,34,col); T(t,130,y+27,'700 27px '+BR,'#fff'); const bw=Math.max(8,d.bandas[k]/mxb*440); rr(370,y+2,bw,30,15); c.fillStyle=col; c.fill(); c.strokeStyle='#111'; c.lineWidth=2; c.stroke(); T(String(d.bandas[k]),370+bw+16,y+28,'900 28px '+UD,'#fff'); });
  let y=1215;
  if(d.tem){ T('Alertas do mês',60,y,'700 30px '+UD,'#fff'); y+=26;
    [[d.novas,'ficaram positivas','#ff8fa3'],[d.subiu,'subiram muito','#ffb454'],[d.neg,'voltaram a 0','#3ddc84']].forEach(([n,t,cor],k)=>{ const x=60+k*(cw+20); card(x,y,cw,100,cor); T(String(n),x+24,y+56,'900 46px '+UD,cor); T(t,x+24,y+86,'800 23px '+BR,'#d5e0f0'); }); y+=100+46; }
  if(d.eqs.length){ T('IPO por equipe',60,y,'700 30px '+UD,'#fff'); y+=14;
    d.eqs.forEach((x,k)=>{ const yy=y+k*40; T('Equipe '+x.e,60,yy+30,'800 27px '+BR,'#fff'); const bw=Math.max(8,x.m.ipo/100*400); rr(250,yy+6,bw,30,15); c.fillStyle=COR_EQ[x.e]||'#4cc3ff'; c.fill(); T(f1(x.m.ipo)+'%',250+bw+14,yy+32,'900 26px '+UD,'#fff'); if(d.tem&&x.mp&&x.mp.ipo!==null) T(dTxt(x.m.ipo,x.mp.ipo,'pp'),W-60,yy+32,'800 24px '+BR,dCor(x.m.ipo,x.mp.ipo),'right'); }); y+=d.eqs.length*40+50; }
  if(d.top.length){ T('Ovitrampas com mais ovos',60,y,'700 30px '+UD,'#fff'); y+=12;
    d.top.forEach((x,k)=>{ const s=(k+1)+'. Ovitrampa '+x.id+(x.rua?' · '+x.rua:''); let fs=26; c.font='800 '+fs+'px '+BR; while(c.measureText(s).width>700&&fs>18){ fs--; c.font='800 '+fs+'px '+BR; } T(s,60,y+34+k*34,'800 '+fs+'px '+BR,'#d5e0f0'); T(fInt(x.v)+' ovos',W-60,y+34+k*34,'900 26px '+UD,'#ffd23f','right'); }); y+=d.top.length*34+30; }
  d.ex.forEach(x=>{ T((x.cat==='pe'?'Pontos estratégicos':'Aldeia')+' · IPO '+f1(x.ipo)+'% ('+x.pos+' de '+x.n+')',60,y+14,'800 24px '+BR,'#9fe0ff'); y+=34; });
  T('Prefeitura de Ponta Porã · SEV - Setor de endemias e vetores',W/2,H-20,'600 21px '+BR,'#7f93b3','center');
  return cv;
}
function zapRender(){
  const box=$('tab-zap'); if(!box) return;
  if(!temSerie()){ box.innerHTML='<div class="cx"><h2>Resumo para WhatsApp</h2><p>Disponível quando a série mensal for publicada.</p></div>'; return; }
  if(zapMes===null||zapMes>=MESES.length) zapMes=MESES.length-1;
  const d=zapDados(zapMes), txt=zapTexto(d);
  box.innerHTML=`<h2>Resumo para WhatsApp</h2><div class="filtros noprint"><label style="font-weight:800">Mês <select id="zMes" style="padding:8px;border:2px solid var(--line);border-radius:10px;font:inherit;font-weight:800">${MESES.map((m,k)=>`<option value="${k}" ${k===zapMes?'selected':''}>${cap1(nomeMes(m))}</option>`).join('')}</select></label><span class="nota" style="margin:0">Compara com ${d.tem?d.antC:'— (primeiro mês, sem comparação)'}. Todas as ovitrampas, sem filtro de equipe. p.p. = pontos percentuais (diferença entre as porcentagens dos dois meses).</span></div>
  <div class="zapgrid"><div class="cx"><h3>Texto para o grupo</h3><textarea id="zTxt" rows="22" spellcheck="false">${esc(txt)}</textarea><div class="zapbt noprint"><button type="button" class="pri" id="zCopia">Copiar texto</button><button type="button" id="zWpp">Abrir no WhatsApp</button></div><p class="nota" id="zMsg"></p></div>
  <div class="cx"><h3>Imagem para o status</h3><div id="zImg" class="zimg"><p class="nota">Gerando imagem…</p></div><div class="zapbt noprint"><button type="button" class="pri" id="zBaixa">Baixar imagem</button><button type="button" id="zComp">Compartilhar imagem</button></div></div></div>`;
  $('zMes').onchange=e=>{ zapMes=+e.target.value; zapRender(); };
  const msg=t=>{ $('zMsg').textContent=t; setTimeout(()=>{ if($('zMsg')) $('zMsg').textContent=''; },3500); };
  $('zCopia').onclick=async()=>{ const t=$('zTxt').value; try{ await navigator.clipboard.writeText(t); msg('Texto copiado. Cole no WhatsApp.'); }catch(e){ $('zTxt').select(); document.execCommand&&document.execCommand('copy'); msg('Texto copiado. Cole no WhatsApp.'); } };
  $('zWpp').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent($('zTxt').value),'_blank','noopener');
  zapImagem(d).then(cv=>{ if(!$('zImg')) return; $('zImg').innerHTML=''; cv.style.cssText='width:100%;max-width:360px;border-radius:14px;box-shadow:0 6px 20px rgba(10,33,69,.25)'; $('zImg').appendChild(cv); window.__zapCv=cv; });
  const nome='panorama-ovitrampas-'+MESES[zapMes]+'.png', blob=()=>new Promise(r=>window.__zapCv?window.__zapCv.toBlob(r,'image/png'):r(null));
  $('zBaixa').onclick=async()=>{ const b=await blob(); if(!b){ msg('A imagem ainda está sendo gerada.'); return; } const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=nome; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000); };
  $('zComp').onclick=async()=>{ const b=await blob(); if(!b){ msg('A imagem ainda está sendo gerada.'); return; } const f=new File([b],nome,{type:'image/png'}); if(navigator.canShare&&navigator.canShare({files:[f]})){ try{ await navigator.share({files:[f],text:$('zTxt').value}); }catch(e){} } else msg('Este aparelho não compartilha direto: use "Baixar imagem" e envie pelo WhatsApp.'); };
}

try{ const q=new URL(location.href).searchParams; const p=q.get('equipe'); if(p!==null&&p!=='') filtro=+p; const ab=q.get('aba'); if(ab==='mensal'||ab==='focos'||ab==='hist'||ab==='zap') aba=ab; window.__mesParam=q.get('mes'); }catch(e){}
async function iniciar(){ await carrega(); if(window.__mesParam&&MESES.indexOf(window.__mesParam)>=0) mesSel=MESES.indexOf(window.__mesParam); if(aba!=='resumo') mostraAba(aba); }
iniciar();

document.addEventListener('change',e=>{ if(e.target&&e.target.classList&&e.target.classList.contains('chkZero')){ mostraZero=e.target.checked; document.querySelectorAll('.chkZero').forEach(c=>c.checked=mostraZero); if(typeof mapaRender==='function'){ mapaRender(ptsFil()); if(aba==='mensal'&&typeof mapaMesPontos==='function') mapaMesPontos(true); } } });

document.addEventListener('change',e=>{ if(e.target&&e.target.classList&&e.target.classList.contains('chkCalor')){ mostraCalor=e.target.checked; document.querySelectorAll('.chkCalor').forEach(c=>c.checked=mostraCalor); mapaRender(ptsFil()); if(mapaM&&aba==='mensal') mapaMesPontos(false); } });

