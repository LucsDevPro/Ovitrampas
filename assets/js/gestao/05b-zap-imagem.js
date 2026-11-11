/* gestao/05b-zap-imagem.js — Imagens do resumo para WhatsApp: Status 1080×1920 e quadrada 1080×1080.
   Layout adaptado de LucsDevPro/lira (desenharImagem / desenharQuadrada): fundo escuro, medidor de risco com cor por faixa,
   frase "na prática", top 5 com barras, dica e rodapé. Usa os dados de zapDados() (05-whatsapp.js). */

/* Faixas de risco do IPO (% de ovitrampas com ovos). PROVISÓRIAS: ajustar aqui se a SEV adotar outros limites. */
const RISCO_IPO=[
  {id:'baixo',rot:'Risco baixo',ate:20,cor:'#3ddc84',rgb:'61,220,132'},
  {id:'medio',rot:'Risco médio',ate:40,cor:'#ffc233',rgb:'255,194,51'},
  {id:'alto',rot:'Risco alto',ate:Infinity,cor:'#ff6b6b',rgb:'255,107,107'}];
const faixaIPO=v=>RISCO_IPO.find(f=>v<f.ate)||RISCO_IPO[2];
/* o número em linguagem do dia a dia */
function fraseNaPratica(ipo){
  const n=Math.round(ipo/10);
  if(ipo<=0) return 'nenhuma armadilha encontrou ovos do mosquito';
  if(n<=0) return 'menos de 1 em cada 10 armadilhas encontrou ovos do mosquito';
  if(n>=10) return 'quase todas as armadilhas encontraram ovos do mosquito';
  return 'cerca de '+n+' em cada 10 armadilhas encontraram ovos do mosquito';
}
const DICA_ZAP='Como ajudar: uma vez por semana, esvazie e limpe pratos de plantas, pneus, calhas, baldes e garrafas. Sem água parada, o mosquito não nasce.';

async function zapImagem(d,formato){
  const quad=formato==='quadrada';
  await Promise.all(['900 40px Unbounded','700 40px Unbounded','400 30px Bricolage','600 30px Bricolage','800 30px Bricolage'].map(f=>document.fonts.load(f).catch(()=>{})));
  const logo=await new Promise(r=>{ const im=new Image(); im.onload=()=>r(im); im.onerror=()=>r(null); im.src='assets/img/logo-2x.png'; });
  const W=1080,H=quad?1080:1920, M=quad?54:72, IW=W-2*M, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const c=cv.getContext('2d');
  const UD='Unbounded, Archivo, sans-serif', BR='Bricolage, Archivo, sans-serif', k=faixaIPO(d.m.ipo);
  const T=(s,x,y,peso,tam,cor,al,fam)=>{ c.font=peso+' '+tam+'px '+(fam||BR); c.fillStyle=cor; c.textAlign=al||'left'; c.textBaseline='alphabetic'; c.fillText(s,x,y); };
  const rr=(x,y,w,h,r)=>{ c.beginPath(); if(c.roundRect) c.roundRect(x,y,w,h,r); else c.rect(x,y,w,h); };
  const esp=v=>{ if('letterSpacing' in c) c.letterSpacing=v; };
  const vidro=(x,y,w,h,r)=>{ c.save(); c.shadowColor='rgba(0,8,30,.38)'; c.shadowBlur=44; c.shadowOffsetY=20; c.fillStyle='rgba(255,255,255,.07)'; rr(x,y,w,h,r); c.fill(); c.restore(); c.strokeStyle='rgba(255,255,255,.15)'; c.lineWidth=2; rr(x,y,w,h,r); c.stroke(); };
  const cabe=(s,maxW,peso,tam,min,fam)=>{ let t=tam; c.font=peso+' '+t+'px '+(fam||BR); while(t>min&&c.measureText(s).width>maxW){ t--; c.font=peso+' '+t+'px '+(fam||BR); } while(s.length>4&&c.measureText(s).width>maxW) s=s.slice(0,-2).replace(/\s+$/,'')+'…'; return {s,t}; };
  const quebra=(s,maxW,peso,tam)=>{ c.font=peso+' '+tam+'px '+BR; const ls=[]; let at=''; s.split(' ').forEach(p=>{ const t=at?at+' '+p:p; if(c.measureText(t).width>maxW&&at){ ls.push(at); at=p; } else at=t; }); if(at) ls.push(at); return ls; };
  const para=(s,x,y,maxW,peso,tam,cor,alt,maxL)=>{ let ls=quebra(s,maxW,peso,tam); if(maxL&&ls.length>maxL){ ls=ls.slice(0,maxL); ls[maxL-1]=ls[maxL-1].replace(/\s*\S*$/,'')+'…'; } ls.forEach((l,i)=>T(l,x,y+i*alt,peso,tam,cor)); return y+ls.length*alt; };
  const seta=(x,y,t,sobe,cor)=>{ c.fillStyle=cor; c.beginPath(); if(sobe){ c.moveTo(x,y-t); c.lineTo(x+t,y+t*.6); c.lineTo(x-t,y+t*.6); } else { c.moveTo(x,y+t); c.lineTo(x+t,y-t*.6); c.lineTo(x-t,y-t*.6); } c.closePath(); c.fill(); };

  /* fundo: degradê + brilho na cor da faixa + brilho azul + anéis discretos */
  const g=c.createLinearGradient(0,0,0,H); g.addColorStop(0,'#04122f'); g.addColorStop(.45,'#0a2145'); g.addColorStop(1,'#061a3d'); c.fillStyle=g; c.fillRect(0,0,W,H);
  const g1=c.createRadialGradient(W*.83,H*.14,0,W*.83,H*.14,W*.6); g1.addColorStop(0,'rgba('+k.rgb+',.26)'); g1.addColorStop(1,'rgba('+k.rgb+',0)'); c.fillStyle=g1; c.fillRect(0,0,W,H);
  const g2=c.createRadialGradient(110,H*.88,0,110,H*.88,W*.67); g2.addColorStop(0,'rgba(0,126,202,.32)'); g2.addColorStop(1,'rgba(0,126,202,0)'); c.fillStyle=g2; c.fillRect(0,0,W,H);
  c.strokeStyle='rgba(255,255,255,.05)'; c.lineWidth=2; [260,400,540].forEach(r=>{ c.beginPath(); c.arc(W-70,quad?60:120,r,0,7); c.stroke(); });

  /* cabeçalho */
  const hy=quad?34:150, lw0=quad?190:250, lh0=quad?104:130; let tx=M;
  if(logo){ c.save(); c.shadowColor='rgba(0,8,30,.38)'; c.shadowBlur=30; c.shadowOffsetY=10; c.fillStyle='#fff'; rr(M,hy,lw0,lh0,quad?22:28); c.fill(); c.restore();
    let lh=Math.min(lh0-34,(lw0-44)*logo.height/logo.width), lw=lh*logo.width/logo.height; c.drawImage(logo,M+(lw0-lw)/2,hy+(lh0-lh)/2,lw,lh); tx=M+lw0+(quad?30:38); }
  esp('3px'); T('PANORAMA DAS OVITRAMPAS · PONTA PORÃ',tx,hy+(quad?24:30),'700',quad?16:19,'rgba(255,255,255,.64)'); esp('0px');
  T(d.mes,tx,hy+(quad?72:86),'900',quad?38:46,'#fff',null,UD);
  T('SEV - Setor de endemias e vetores',tx,hy+(quad?100:122),'600',quad?21:25,'rgba(255,255,255,.80)');

  /* medidor semicircular com 3 faixas; marcador na posição do IPO */
  const medidor=(cx,cy,R,E,rot)=>{ const seg=Math.PI/3, cap=(E/2)/R, folga=.035;
    RISCO_IPO.forEach((f,n)=>{ const ativo=f.id===k.id; c.save(); if(ativo){ c.shadowColor='rgba('+f.rgb+',.55)'; c.shadowBlur=34; } c.lineWidth=E; c.lineCap='round'; c.strokeStyle=ativo?f.cor:'rgba('+f.rgb+',.30)'; c.beginPath(); c.arc(cx,cy,R,Math.PI+n*seg+cap+folga,Math.PI+(n+1)*seg-cap-folga); c.stroke(); c.restore(); });
    const idx=RISCO_IPO.indexOf(k), ini=idx?RISCO_IPO[idx-1].ate:0, fim=isFinite(k.ate)?k.ate:ini+20, fr=Math.min(1,Math.max(0,(d.m.ipo-ini)/(fim-ini))), ang=Math.PI+((idx+fr)/3)*Math.PI, px=cx+R*Math.cos(ang), py=cy+R*Math.sin(ang);
    c.save(); c.shadowColor='rgba(0,8,30,.5)'; c.shadowBlur=18; c.shadowOffsetY=6; c.fillStyle='#fff'; c.beginPath(); c.arc(px,py,E*.74,0,7); c.fill(); c.restore();
    c.strokeStyle=k.cor; c.lineWidth=9; c.beginPath(); c.arc(px,py,E*.74,0,7); c.stroke();
    [[RISCO_IPO[0].ate+'%',1],[RISCO_IPO[1].ate+'%',2]].forEach(([t,n])=>{ const a=Math.PI+n*seg, r2=R+E/2+(rot?34:26); T(t,cx+r2*Math.cos(a),cy+r2*Math.sin(a)+8,'700',rot?24:20,'rgba(255,255,255,.64)','center'); }); };
  const selo=(cx,sy,tam)=>{ c.font='800 '+tam+'px '+BR; const sw=c.measureText(k.rot).width+84, sx=cx-sw/2, sh=tam*2; c.fillStyle='rgba('+k.rgb+',.16)'; rr(sx,sy,sw,sh,sh/2); c.fill(); c.strokeStyle='rgba('+k.rgb+',.55)'; c.lineWidth=2; rr(sx,sy,sw,sh,sh/2); c.stroke(); c.fillStyle=k.cor; c.beginPath(); c.arc(sx+36,sy+sh/2,10,0,7); c.fill(); T(k.rot,sx+60,sy+sh/2+tam*.35,'800',tam,k.cor); };
  const variacao=(cx,y,tam,maxW)=>{ if(!d.tem||d.mp.ipo===null||d.mp.ipo===undefined) return; const v=d.m.ipo-d.mp.ipo, igual=Math.abs(v)<.005, cor=igual?'rgba(255,255,255,.64)':(v<0?'#3ddc84':'#ff6b6b'),
      tv=igual?'Igual a '+d.antC:(v<0?'Caiu':'Subiu')+' de '+f1(d.mp.ipo)+'% para '+f1(d.m.ipo)+'% desde '+d.antC, fv=cabe(tv,maxW,'700',tam,18); c.font='700 '+fv.t+'px '+BR;
    const wv=c.measureText(fv.s).width, off=igual?0:20, x0=cx-(wv+off)/2; if(!igual) seta(x0+7,y-8,9,v>0,cor); T(fv.s,x0+off,y,'700',fv.t,cor); };

  /* painel principal */
  let y;
  if(!quad){
    const py=316, ph=608, cx=W/2, cy=py+318; vidro(M,py,IW,ph,44); medidor(cx,cy,250,40,true);
    const num=cabe(f1(d.m.ipo)+'%',372,'900',112,70,UD); T(num.s,cx,cy-12,'900',num.t,'#fff','center',UD);
    T('das ovitrampas tinham ovos do mosquito',cx,cy+66,'600',27,'rgba(255,255,255,.80)','center');
    const pre='Na prática: ', fra=fraseNaPratica(d.m.ipo)+'.', pf=cabe(pre+fra,IW-90,'700',29,20); c.font='700 '+pf.t+'px '+BR; const wp=c.measureText(pre).width, wf=c.measureText(fra).width, xp=cx-(wp+wf)/2;
    T(pre,xp,cy+114,'700',pf.t,k.cor); T(fra,xp+wp,cy+114,'700',pf.t,'#fff');
    selo(cx,cy+142,32); variacao(cx,cy+274,27,IW-120);
    /* três números-chave */
    const sy2=944, sh=108, gap=20, tw=(IW-2*gap)/3;
    [[d.m.n,'ovitrampas com contagem'],[d.m.pos,'com ovos do mosquito'],[fInt(d.m.ov),'ovos contados no mês']].forEach((it,i)=>{ const x=M+i*(tw+gap); vidro(x,sy2,tw,sh,28); const nn=cabe(String(it[0]),tw-30,'900',40,26,UD); T(nn.s,x+tw/2,sy2+54,'900',nn.t,'#fff','center',UD); T(it[1],x+tw/2,sy2+90,'600',21,'rgba(255,255,255,.64)','center'); });
    y=1072;
  } else {
    const py=170, ph=342; vidro(M,py,IW,ph,36);
    const cx=M+250, cy=py+232; medidor(cx,cy,150,26,false);
    const num=cabe(f1(d.m.ipo)+'%',210,'900',60,38,UD); T(num.s,cx,cy-6,'900',num.t,'#fff','center',UD);
    T('das ovitrampas com ovos',cx,cy+32,'600',19,'rgba(255,255,255,.80)','center');
    const rx=M+500, rw=IW-500-34; T('Na prática',rx,py+70,'800',24,k.cor);
    para(fraseNaPratica(d.m.ipo)+'.',rx,py+112,rw,'700',29,'#fff',38,3);
    c.font='800 26px '+BR; const sw=c.measureText(k.rot).width+72; c.fillStyle='rgba('+k.rgb+',.16)'; rr(rx,py+236,sw,52,26); c.fill(); c.strokeStyle='rgba('+k.rgb+',.55)'; c.lineWidth=2; rr(rx,py+236,sw,52,26); c.stroke(); c.fillStyle=k.cor; c.beginPath(); c.arc(rx+30,py+262,9,0,7); c.fill(); T(k.rot,rx+50,py+271,'800',26,k.cor);
    if(d.tem&&d.mp.ipo!==null&&d.mp.ipo!==undefined){ const v=d.m.ipo-d.mp.ipo, igual=Math.abs(v)<.005, cor=igual?'rgba(255,255,255,.64)':(v<0?'#3ddc84':'#ff6b6b'); const tv=cabe(igual?'Igual a '+d.antC:(v<0?'Caiu':'Subiu')+' '+f1(Math.abs(v))+' pontos desde '+d.antC,rw,'700',22,16); if(!igual) seta(rx+7,py+312,8,v>0,cor); T(tv.s,rx+(igual?0:20),py+318,'700',tv.t,cor); }
    y=py+ph+20;
  }

  /* top 5 ovitrampas com barras */
  const top=d.top.slice(0,5), max=top.length?top[0].v:1, bh=quad?332:332, ry0=quad?86:88, rh=quad?47:44;
  vidro(M,y,IW,bh,quad?30:36);
  T('Ovitrampas com mais ovos',M+40,y+(quad?54:60),'800',quad?30:33,'#fff');
  if(!top.length) T('Nenhuma ovitrampa teve ovos neste mês.',M+40,y+170,'600',28,'rgba(255,255,255,.8)');
  top.forEach((x,i)=>{ const ry=y+ry0+i*rh, cyr=ry+(quad?22:25);
    c.fillStyle='rgba(255,255,255,.12)'; c.beginPath(); c.arc(M+62,cyr,18,0,7); c.fill(); T(String(i+1),M+62,cyr+8,'800',21,'#fff','center');
    const nm=cabe(x.id+(x.rua?' · '+x.rua:''),quad?400:412,'700',quad?26:29,19); T(nm.s,M+100,cyr+10,'700',nm.t,'#fff');
    const bx=quad?570:598, bw=190; c.fillStyle='rgba(255,255,255,.12)'; rr(bx,cyr-8,bw,16,8); c.fill();
    const gb=c.createLinearGradient(bx,0,bx+bw,0); gb.addColorStop(0,'#ffe27a'); gb.addColorStop(1,'#ffb454'); c.fillStyle=gb; rr(bx,cyr-8,Math.max(16,bw*(x.v/max)),16,8); c.fill();
    T(fInt(x.v)+' ovos',W-M-34,cyr+9,'900',quad?22:25,'#fff','right',UD); });
  y+=bh+(quad?18:20);

  /* dica (+ alertas do mês no Status) */
  if(!quad){
    const ch=358; vidro(M,y,IW,ch,36); let yy=y;
    if(d.tem){ esp('3px'); T('ALERTAS DO MÊS',M+40,yy+52,'700',20,'rgba(255,255,255,.64)'); esp('0px'); const aw=(IW-80-2*16)/3;
      [[d.novas,'ficaram positivas','#ff8fa3'],[d.subiu,'subiram muito','#ffb454'],[d.neg,'voltaram a 0 ovos','#3ddc84']].forEach(([n,t,cor],i)=>{ const x=M+40+i*(aw+16); rr(x,yy+72,aw,96,22); c.fillStyle='rgba(255,255,255,.07)'; c.fill(); c.fillStyle=cor; c.fillRect(x+18,yy+72,aw-36,5); T(String(n),x+22,yy+130,'900',44,cor,null,UD); T(t,x+22,yy+156,'700',20,'rgba(255,255,255,.8)'); });
      yy+=190; c.fillStyle='rgba(255,255,255,.14)'; c.fillRect(M+40,yy-8,IW-80,2); }
    para(DICA_ZAP,M+40,yy+(d.tem?30:70),IW-80,'600',d.tem?24:28,'rgba(255,255,255,.86)',d.tem?32:40,4);
    c.fillStyle='rgba(255,255,255,.14)'; c.fillRect(M,1806,IW,2);
    T('Prefeitura Municipal de Ponta Porã',W/2,1846,'800',25,'#fff','center'); T('SEV - Setor de endemias e vetores · Dados das ovitrampas',W/2,1878,'500',21,'rgba(255,255,255,.64)','center');
  } else {
    vidro(M,y,IW,100,26); para(DICA_ZAP,M+30,y+40,IW-60,'600',21,'rgba(255,255,255,.88)',29,2);
    c.fillStyle='rgba(255,255,255,.14)'; c.fillRect(M,H-66,IW,2);
    T('Prefeitura Municipal de Ponta Porã · SEV - Setor de endemias e vetores',W/2,H-30,'700',20,'rgba(255,255,255,.8)','center');
  }
  return cv;
}
