(() => {
"use strict";
// ---------- constantes ----------
const CATS = [
  ["basicos","Básicos"],["hortifruti","Hortifrúti"],["carnes","Carnes e peixes"],["frios","Frios e laticínios"],
  ["padaria","Padaria e matinais"],["bebidas","Bebidas"],["congelados","Congelados"],["higiene","Higiene"],
  ["limpeza","Limpeza"],["pet","Pet"],["outros","Outros"]
];
const CATNAME = Object.fromEntries(CATS);
const MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const MESL = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const ICONS = {
  resumo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  produtos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  despensa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16"/></svg>',
  comparar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
  notas:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h3"/></svg>'
};
const TABS = [["resumo","Resumo"],["produtos","Produtos"],["despensa","Despensa"],["comparar","Comparar"],["notas","Notas"]];

// ---------- utilidades ----------
const $ = (s, el=document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl = v => (Number(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const fmtQ = (q,u) => { q = Number(q)||0; const s = Number.isInteger(q) ? String(q) : q.toLocaleString("pt-BR",{maximumFractionDigits:3}); return s + " " + (u||"un"); };
const pct = v => (v>0?"+":"") + v.toLocaleString("pt-BR",{maximumFractionDigits:0}) + "%";
const dayNum = s => { const [y,m,d] = String(s).split("-").map(Number); return Math.round(Date.UTC(y,(m||1)-1,d||1)/864e5); };
const todayStr = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const fmtD = s => { if(!s) return "—"; const [y,m,d] = s.split("-"); return d+"/"+m+"/"+y.slice(2); };
const fmtM = ym => { const [y,m] = ym.split("-"); return MES[+m-1]+"/"+y.slice(2); };
const fmtML = ym => { const [y,m] = ym.split("-"); return MESL[+m-1]+" de "+y; };
const slug = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,120) || "item";
const sum = (a,f=x=>x) => a.reduce((t,x)=>t+(Number(f(x))||0),0);
const LS = { get(k,d){ try{ const v = localStorage.getItem("nan:"+k); return v==null?d:JSON.parse(v);}catch{return d;} }, set(k,v){ try{ localStorage.setItem("nan:"+k, JSON.stringify(v)); }catch{} } };

// ---------- estado ----------
const S = {
  tab: LS.get("tab","resumo"), cat:"todas", scope:"ultimo", q:"", open:null, horizon: LS.get("horizon",30),
  compras:[], produtosDb:{}, cotacoes:[], loaded:{c:false,p:false,q:false},
  supa:null, user:null, demo:false, pendingStock:{}, openNota:null, confirmDel:null
};
const MAX_FOTOS = 6;
let D = null; // dados derivados

// ---------- dados de exemplo (somente em memória) ----------
function makeDemo(){
  let seed = 7; const rnd = () => (seed = (seed*9301+49297)%233280)/233280;
  const P = [
    ["Arroz Tio João tipo 1 5kg","basicos",27.9,1,"un",30],["Feijão carioca Camil 1kg","basicos",8.49,2,"un",15],
    ["Café Pilão tradicional 500g","basicos",19.9,2,"un",14],["Molho de tomate Fugini 340g","basicos",2.79,6,"un",5],
    ["Óleo de soja Soya 900ml","basicos",7.49,2,"un",20],["Açúcar refinado União 1kg","basicos",4.99,2,"un",18],
    ["Macarrão espaguete Renata 500g","basicos",4.59,4,"un",8],["Banana prata","hortifruti",6.99,1.5,"kg",7],
    ["Tomate italiano","hortifruti",8.9,1,"kg",7],["Peito de frango Sadia 1kg","carnes",17.9,3,"un",8],
    ["Patinho moído","carnes",42.9,1,"kg",14],["Leite integral Italac 1L","frios",4.79,12,"un",2.5],
    ["Queijo mussarela fatiado","frios",49.9,0.4,"kg",10],["Iogurte Nestlé morango 540g","frios",8.99,2,"un",6],
    ["Pão de forma Wickbold 500g","padaria",9.49,2,"un",6],["Água mineral Crystal 1,5L","bebidas",2.49,6,"un",4],
    ["Creme dental Colgate Total 12 90g","higiene",8.99,2,"un",25],["Papel higiênico Neve 12 rolos","higiene",22.9,1,"un",24],
    ["Sabonete Dove original 90g","higiene",3.99,4,"un",9],["Shampoo Seda 325ml","higiene",14.9,1,"un",40],
    ["Detergente Ypê neutro 500ml","limpeza",2.39,3,"un",12],["Sabão líquido Omo 3L","limpeza",42.9,1,"un",45],
    ["Água sanitária Qboa 2L","limpeza",7.99,1,"un",30],["Esponja Scotch-Brite c/3","limpeza",6.49,1,"un",25]
  ];
  const M = ["Assaí Atacadista","Carrefour","Pão de Açúcar"], fac = [0.94,1.0,1.12];
  const compras = [], t = dayNum(todayStr());
  for(let i=6;i>=1;i--){
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-i+1); d.setDate(3+Math.floor(rnd()*6));
    if(dayNum(d.toISOString().slice(0,10))>t) continue;
    const ds = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const mi = i%3===0?1:(i%2?0:2);
    const itens = P.filter(p => rnd() < Math.min(0.97, 30/p[5]/1.2)).map(p => {
      const vu = +(p[2]*fac[mi]*(0.93+rnd()*0.14)*(1+(6-i)*0.006)).toFixed(2);
      const q = p[4]==="kg" ? +(p[3]*(0.8+rnd()*0.5)).toFixed(3) : Math.max(1,Math.round(p[3]*(0.7+rnd()*0.7)));
      return {nome:p[0],chave:slug(p[0]),categoria:p[1],qtd:q,un:p[4],vUnit:vu,vTotal:+(vu*q).toFixed(2)};
    });
    compras.push({id:"demo"+i,data:ds,mercado:M[mi],itens,total:+sum(itens,x=>x.vTotal).toFixed(2),desconto:0});
  }
  const cot = [];
  P.slice(0,12).forEach((p,i)=>{ cot.push({id:"q"+i,chave:slug(p[0]),nome:p[0],mercado:"Atacadão",preco:+(p[2]*0.91).toFixed(2),data:todayStr(),fonte:"Pesquisa (exemplo)"}); });
  return {compras, produtosDb:{}, cotacoes:cot};
}

// ---------- derivação ----------
function derive(){
  const compras = [...S.compras].filter(c=>c && c.data).sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:0);
  const prods = {};
  const today = dayNum(todayStr());
  for(const c of compras){
    for(const it of (c.itens||[])){
      const k = it.chave || slug(it.nome);
      const p = prods[k] || (prods[k] = {chave:k,nome:it.nome,categoria:it.categoria||"outros",un:it.un||"un",hist:[]});
      p.nome = it.nome || p.nome; if(it.categoria) p.categoria = it.categoria; p.un = it.un || p.un;
      const q = Number(it.qtd)||1, vt = Number(it.vTotal)|| (Number(it.vUnit)||0)*q;
      p.hist.push({data:c.data,mercado:c.mercado||"—",qtd:q,vUnit:Number(it.vUnit)|| (q? vt/q:0),vTotal:vt,compraId:c.id});
    }
  }
  for(const [k,o] of Object.entries(S.produtosDb)){ if(prods[k]){ if(o.categoria) prods[k].categoria=o.categoria; if(o.duracaoDias) prods[k].duracaoManual=o.duracaoDias; } }
  for(const p of Object.values(prods)){
    const h = p.hist; p.last = h[h.length-1];
    p.avg = sum(h,x=>x.vUnit)/h.length;
    p.diff = p.avg>0 && h.length>1 ? (p.last.vUnit/p.avg-1)*100 : 0;
    p.min = h.reduce((m,x)=> !m || x.vUnit<m.vUnit ? x : m, null);
    const first = dayNum(h[0].data), lastD = dayNum(p.last.data), span = lastD-first;
    const qBefore = sum(h.filter(x=>x.data<p.last.data),x=>x.qtd);
    p.rate = null;
    if(p.duracaoManual) p.rate = 1/p.duracaoManual;
    else if(span>=7 && qBefore>0) p.rate = qBefore/span;
    const o = S.produtosDb[p.chave] || {};
    const pend = S.pendingStock[p.chave];
    let base, since, bought;
    if(pend){ base=pend.estoque; since=dayNum(pend.estoqueEm); bought=0; p.manual=true; }
    else if(o.estoqueEm!=null && o.estoque!=null){ base=Number(o.estoque); since=dayNum(o.estoqueEm); bought=sum(h.filter(x=>dayNum(x.data)>since),x=>x.qtd); p.manual=true; }
    else { base=sum(h.filter(x=>x.data===p.last.data),x=>x.qtd); since=lastD; bought=0; p.manual=false; }
    p.stockSet = pend ? pend.estoque : (o.estoque!=null ? Number(o.estoque) : null);
    p.est = Math.max(0, p.rate!=null ? base+bought-p.rate*Math.max(0,today-since) : base+bought);
    p.daysLeft = p.rate ? p.est/p.rate : null;
    p.perUnitDays = p.rate ? 1/p.rate : null;
  }
  // meses
  const months = {};
  for(const c of compras){
    const ym = c.data.slice(0,7);
    const m = months[ym] || (months[ym] = {ym,total:0,n:0,mercados:{},cats:{}});
    const tot = Number(c.total) || sum(c.itens||[],x=>x.vTotal);
    m.total += tot; m.n++; m.mercados[c.mercado||"—"] = (m.mercados[c.mercado||"—"]||0)+tot;
    for(const it of (c.itens||[])){ const cat = (S.produtosDb[it.chave||slug(it.nome)]||{}).categoria || it.categoria || "outros"; m.cats[cat]=(m.cats[cat]||0)+(Number(it.vTotal)||0); }
  }
  const ymKeys = Object.keys(months).sort();
  let series = [];
  if(ymKeys.length){
    let [y,m] = ymKeys[0].split("-").map(Number); const [ly,lm] = ymKeys[ymKeys.length-1].split("-").map(Number);
    while(y<ly || (y===ly && m<=lm)){ const k = y+"-"+String(m).padStart(2,"0"); series.push(months[k]||{ym:k,total:0,n:0,mercados:{},cats:{}}); m++; if(m>12){m=1;y++;} }
  }
  const lastYm = ymKeys[ymKeys.length-1] || null;
  const mercados = {};
  for(const c of compras){ const k=c.mercado||"—"; const o = mercados[k]||(mercados[k]={nome:k,total:0,n:0,last:null}); o.total+=Number(c.total)||sum(c.itens||[],x=>x.vTotal); o.n++; o.last=c.data; }
  D = {compras, prods, months, series, lastYm, mercados, today};
}

// ---------- persistência (Supabase; cada usuário só enxerga as próprias linhas via RLS) ----------
async function loadAll(){
  const sb = S.supa; if(!sb || !S.user) return;
  const [c,p,q] = await Promise.all([
    sb.from("compras").select("*").order("data",{ascending:true}),
    sb.from("produtos").select("*"),
    sb.from("cotacoes").select("*")
  ]);
  if(c.error){ $("#syncState").textContent = "sem conexão"; return; }
  real.compras = (c.data||[]).map(r=>({id:r.id,data:r.data,mercado:r.mercado,cnpj:r.cnpj,total:Number(r.total),desconto:Number(r.desconto),itens:r.itens||[]}));
  real.produtos = {};
  (p.data||[]).forEach(r=>{ real.produtos[r.chave] = {chave:r.chave,nome:r.nome,categoria:r.categoria||undefined,
    estoque: r.estoque==null?undefined:Number(r.estoque), estoqueEm: r.estoque_em||undefined, duracaoDias: r.duracao_dias==null?undefined:Number(r.duracao_dias)}; });
  real.cotacoes = (q.data||[]).map(r=>({...r, preco:Number(r.preco)}));
  S.loaded = {c:true,p:true,q:true};
  if(!S.demo){ S.compras = real.compras; S.produtosDb = real.produtos; S.cotacoes = real.cotacoes; S.pendingStock = {}; render(); }
}
async function writeProduto(chave, patch){
  const cur = S.produtosDb[chave] || {};
  const next = {...cur, ...patch, chave};
  if(S.demo){ S.produtosDb = {...S.produtosDb,[chave]:next}; return; }
  const row = {user_id:S.user.id, chave, nome:next.nome||D.prods[chave]?.nome||chave, categoria:next.categoria??null,
    estoque:next.estoque??null, estoque_em:next.estoqueEm??null, duracao_dias:next.duracaoDias??null, atualizado_em:new Date().toISOString()};
  const {error} = await S.supa.from("produtos").upsert(row,{onConflict:"user_id,chave"});
  if(error) throw error;
  real.produtos = {...real.produtos,[chave]:next}; S.produtosDb = real.produtos;
}
async function saveCompra(c){
  if(S.demo){ S.compras = [...S.compras, {...c, id:"demo"+Date.now()}]; derive(); render(); return; }
  const {error} = await S.supa.from("compras").insert({user_id:S.user.id, data:c.data, mercado:c.mercado, cnpj:c.cnpj||"", total:c.total, desconto:c.desconto||0, itens:c.itens, origem:"app"});
  if(error) throw error;
  await loadAll();
}
async function deleteCompra(id){
  if(S.demo){ S.compras = S.compras.filter(c=>c.id!==id); derive(); render(); return; }
  const {error} = await S.supa.from("compras").delete().eq("id",id);
  if(error) throw error;
  await loadAll();
}

// ---------- UI comum ----------
function toast(msg){ const t = document.createElement("div"); t.className="toast"; t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2200); }
function catOf(p){ return CATNAME[p.categoria] ? p.categoria : "outros"; }
function diffPill(d, n){
  if(n<2) return '<span class="pill flat">1ª compra</span>';
  if(Math.abs(d)<3) return '<span class="pill flat">na média</span>';
  return d>0 ? `<span class="pill up">▲ ${pct(d)} da média</span>` : `<span class="pill down">▼ ${pct(d)} da média</span>`;
}
function renderNav(){
  $("#nav").innerHTML = TABS.map(([id,l])=>`<button type="button" data-tab="${id}" ${S.tab===id?'aria-current="page"':""}>${ICONS[id]}${l}</button>`).join("");
}
function demoBanner(){
  return S.demo ? `<div class="banner"><span><b>Dados de exemplo.</b> Nada aqui é seu ainda.</span><button class="btn sm" data-act="exit-demo">Sair do exemplo</button></div>` : "";
}
function emptyState(){
  const loading = !S.demo && S.user && !(S.loaded.c);
  if(loading) return `<div class="empty"><div class="spin"></div><span>Carregando suas notas…</span></div>`;
  return `<div class="card"><div class="empty">
    <svg width="54" height="54" viewBox="0 0 26 26" aria-hidden="true"><path d="M5 2h16v22l-2.7-1.8L15.6 24 13 22.2 10.4 24l-2.7-1.8L5 24z" fill="var(--accent-soft)"/><path d="M9 8h8M9 12h8M9 16h5" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/></svg>
    <b>Nenhuma nota lançada ainda</b>
    <span>Toque em <b>+ Nota</b> e tire foto da nota fiscal. O app lê os produtos e os preços para você conferir.</span>
    <div class="row" style="flex-wrap:wrap;justify-content:center">
      <button class="btn primary" data-act="add">Adicionar primeira nota</button>
      <button class="btn" data-act="demo">Ver com dados de exemplo</button>
    </div></div></div>`;
}

// ---------- aba: Resumo ----------
function viewResumo(){
  if(!D.compras.length) return demoBanner()+emptyState();
  const s = D.series, last = D.months[D.lastYm];
  const active = s.filter(m=>m.n>0);
  const avg = sum(active,m=>m.total)/active.length;
  const prevAvgArr = active.filter(m=>m.ym!==D.lastYm); const prevAvg = prevAvgArr.length ? sum(prevAvgArr,m=>m.total)/prevAvgArr.length : null;
  const maxM = active.reduce((a,b)=>b.total>a.total?b:a);
  const year = D.lastYm.slice(0,4), yTot = sum(active.filter(m=>m.ym.startsWith(year)),m=>m.total);
  const cmp = prevAvg ? (last.total/prevAvg-1)*100 : null;
  // categorias do último mês
  const cats = Object.entries(last.cats).sort((a,b)=>b[1]-a[1]);
  const cmax = cats.length ? cats[0][1] : 1;
  const mercs = Object.values(D.mercados).sort((a,b)=>b.total-a.total);
  const mmax = mercs.length ? mercs[0].total : 1;
  const lastItems = [];
  for(const c of D.compras.filter(c=>c.data.startsWith(D.lastYm))) for(const it of c.itens||[]) lastItems.push({...it, mercado:c.mercado});
  const top = lastItems.sort((a,b)=>(b.vTotal||0)-(a.vTotal||0)).slice(0,5);
  const alerts = Object.values(D.prods).filter(p=>p.hist.length>1 && p.last.data.startsWith(D.lastYm) && Math.abs(p.diff)>=8).sort((a,b)=>b.diff-a.diff).slice(0,6);
  return `${demoBanner()}
  <div class="hero">
    <span class="lbl">Gasto em ${fmtML(D.lastYm)}</span>
    <span class="big">${brl(last.total)}</span>
    <span class="cmp">${cmp==null ? `${last.n} ${last.n>1?"compras":"compra"} no mês` : `${cmp>0?"▲":"▼"} ${Math.round(Math.abs(cmp))}% ${cmp>0?"acima":"abaixo"} da sua média anterior (${brl(prevAvg)})`}</span>
  </div>
  <div class="stats">
    <div class="stat"><span class="k">Média por mês</span><span class="v">${brl(avg)}</span></div>
    <div class="stat"><span class="k">Maior mês</span><span class="v">${brl(maxM.total)}</span><span class="k">${fmtM(maxM.ym)}</span></div>
    <div class="stat"><span class="k">Total em ${year}</span><span class="v">${brl(yTot)}</span></div>
    <div class="stat"><span class="k">Notas lançadas</span><span class="v">${D.compras.length}</span><span class="k">${Object.keys(D.prods).length} produtos</span></div>
  </div>
  <section class="card"><div class="row between"><h3>Gasto por mês</h3><div class="legend"><span><i style="background:var(--accent)"></i>mês atual</span><span><i style="background:var(--muted);height:2px;vertical-align:3px"></i>média</span></div></div>
    ${monthChart(s.slice(-12), avg)}</section>
  <section class="card"><h3>Onde foi o dinheiro em ${MES[+D.lastYm.slice(5)-1]}</h3>
    ${cats.map(([k,v])=>`<div class="hbar"><span class="l">${esc(CATNAME[k]||"Outros")}</span><span class="v">${brl(v)}<small>${Math.round(v/last.total*100)}%</small></span><div class="track"><div class="fill" style="width:${(v/cmax*100).toFixed(1)}%"></div></div></div>`).join("")}
  </section>
  <section class="card"><h3>Maiores itens do mês</h3><div class="list">
    ${top.map(it=>`<div class="item"><div class="grow"><div class="name">${esc(it.nome)}</div><div class="meta">${fmtQ(it.qtd,it.un)} × ${brl(it.vUnit)} · ${esc(it.mercado)}</div></div><div class="price">${brl(it.vTotal)}</div></div>`).join("")}
  </div></section>
  ${alerts.length?`<section class="card"><h3>Preços fora da média</h3><div class="list">
    ${alerts.map(p=>`<div class="item"><div class="grow"><div class="name">${esc(p.nome)}</div><div class="meta">pagou ${brl(p.last.vUnit)} · média ${brl(p.avg)}</div></div>${diffPill(p.diff,p.hist.length)}</div>`).join("")}
  </div></section>`:""}
  <section class="card"><h3>Mercados</h3>
    ${mercs.map(m=>`<div class="hbar"><span class="l">${esc(m.nome)} <span class="note">· ${m.n} ${m.n>1?"notas":"nota"}</span></span><span class="v">${brl(m.total)}</span><div class="track"><div class="fill" style="width:${(m.total/mmax*100).toFixed(1)}%;background:var(--bar)"></div></div></div>`).join("")}
  </section>`;
}
function monthChart(s, avg){
  const W=520,H=190,pl=6,pr=6,pt=22,pb=24, n=s.length;
  const max = Math.max(...s.map(m=>m.total), avg)*1.08 || 1;
  const bw = (W-pl-pr)/n, barW = Math.min(36, bw*0.62);
  const y = v => pt + (H-pt-pb)*(1-v/max);
  const bars = s.map((m,i)=>{
    const x = pl + i*bw + (bw-barW)/2, h = Math.max(m.total>0?2:0, (H-pb)-y(m.total)), isLast = m.ym===D.lastYm;
    const r = Math.min(4, barW/2, h);
    const path = h>0 ? `M${x},${H-pb} V${H-pb-h+r} Q${x},${H-pb-h} ${x+r},${H-pb-h} H${x+barW-r} Q${x+barW},${H-pb-h} ${x+barW},${H-pb-h+r} V${H-pb} Z` : "";
    return `<g data-tip="${fmtM(m.ym)}: ${brl(m.total)}${m.n?` · ${m.n} ${m.n>1?"notas":"nota"}`:""}" data-x="${((x+barW/2)/W*100).toFixed(2)}" data-y="${((H-pb-h)/H*100).toFixed(2)}">
      <rect x="${pl+i*bw}" y="${pt}" width="${bw}" height="${H-pt-pb}" fill="transparent"/>
      ${path?`<path d="${path}" fill="${isLast?"var(--accent)":"var(--bar)"}"/>`:""}
      ${isLast?`<text x="${x+barW/2}" y="${H-pb-h-6}" text-anchor="middle" style="fill:var(--fg);font-weight:600;font-family:var(--f-mono)">${Math.round(m.total).toLocaleString("pt-BR")}</text>`:""}
      ${(n<=8 || i%2===(n-1)%2)?`<text x="${pl+i*bw+bw/2}" y="${H-6}" text-anchor="middle">${fmtM(m.ym)}</text>`:""}</g>`;
  }).join("");
  const ay = y(avg);
  return `<div class="chart" data-chart><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gasto mensal">
    <line x1="${pl}" x2="${W-pr}" y1="${H-pb}" y2="${H-pb}" stroke="var(--line)"/>
    ${bars}
    <line x1="${pl}" x2="${W-pr}" y1="${ay}" y2="${ay}" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="${pl+2}" y="${ay-5}" text-anchor="start">média ${Math.round(avg).toLocaleString("pt-BR")}</text>
  </svg><div class="tip" hidden></div></div>`;
}

// ---------- aba: Produtos ----------
function viewProdutos(){
  if(!D.compras.length) return demoBanner()+emptyState();
  const all = Object.values(D.prods);
  const scoped = S.scope==="ultimo" ? all.filter(p=>p.hist.some(h=>h.data.startsWith(D.lastYm))) : all;
  const counts = {}; scoped.forEach(p=>counts[catOf(p)]=(counts[catOf(p)]||0)+1);
  return `${demoBanner()}
  <div class="row between"><h2>Produtos</h2></div>
  <div class="seg" role="group" aria-label="Período">
    <button data-scope="ultimo" aria-pressed="${S.scope==="ultimo"}">Último mês (${fmtM(D.lastYm)})</button>
    <button data-scope="todos" aria-pressed="${S.scope==="todos"}">Todos</button>
  </div>
  <div class="chips" role="group" aria-label="Seção">
    <button class="chip" data-cat="todas" aria-pressed="${S.cat==="todas"}">Todas<span class="c">${scoped.length}</span></button>
    ${CATS.filter(([k])=>counts[k]).map(([k,l])=>`<button class="chip" data-cat="${k}" aria-pressed="${S.cat===k}">${l}<span class="c">${counts[k]}</span></button>`).join("")}
  </div>
  <input class="search" id="q" type="search" placeholder="Buscar produto ou marca" value="${esc(S.q)}" autocomplete="off">
  <div id="plist"></div>`;
}
function renderProdList(){
  const el = $("#plist"); if(!el) return;
  const all = Object.values(D.prods);
  let list = S.scope==="ultimo" ? all.filter(p=>p.hist.some(h=>h.data.startsWith(D.lastYm))) : all;
  if(S.cat!=="todas") list = list.filter(p=>catOf(p)===S.cat);
  const q = S.q.trim() ? slug(S.q).replace(/-/g," ") : "";
  if(q) list = list.filter(p=>slug(p.nome).replace(/-/g," ").includes(q));
  list.sort((a,b)=>catOf(a).localeCompare(catOf(b)) || a.nome.localeCompare(b.nome,"pt-BR"));
  if(!list.length){ el.innerHTML = `<div class="card"><div class="empty">Nenhum produto aqui.</div></div>`; return; }
  const groups = {};
  list.forEach(p=>(groups[catOf(p)] ||= []).push(p));
  el.innerHTML = Object.entries(groups).map(([k,ps])=>`<section class="card"><div class="row between"><h3>${CATNAME[k]}</h3><span class="note">${ps.length} ${ps.length>1?"itens":"item"}</span></div><div class="list">
    ${ps.map(p=>{ const open = S.open===p.chave;
      return `<div class="item" style="flex-direction:column;gap:0"><button class="tap" data-open="${esc(p.chave)}" aria-expanded="${open}">
        <div class="grow"><div class="name">${esc(p.nome)}</div><div class="meta">${esc(p.last.mercado)} · ${fmtD(p.last.data)} · média ${brl(p.avg)}</div><div style="margin-top:4px">${diffPill(p.diff,p.hist.length)}</div></div>
        <div class="price">${brl(p.last.vUnit)}<div class="meta" style="font-family:var(--f-body);font-weight:400">por ${esc(p.un)}</div></div></button>
        ${open?prodDetail(p):""}</div>`; }).join("")}
  </div></section>`).join("");
}
function prodDetail(p){
  const byM = {}; p.hist.forEach(h=>{ (byM[h.mercado] ||= []).push(h.vUnit); });
  const mk = Object.entries(byM).map(([m,v])=>[m, sum(v)/v.length]).sort((a,b)=>a[1]-b[1]);
  return `<div class="detail">
    <div class="row between"><span>Menor preço pago</span><b class="mono">${brl(p.min.vUnit)} <span class="note">${esc(p.min.mercado)}</span></b></div>
    ${mk.length>1?`<div><b>Média por mercado</b><table>${mk.map(([m,v],i)=>`<tr><td>${esc(m)}${i===0?' <span class="pill down">mais barato</span>':""}</td><td class="r">${brl(v)}</td></tr>`).join("")}</table></div>`:""}
    <div><b>Histórico</b><div class="tablewrap"><table>${[...p.hist].reverse().map(h=>`<tr><td>${fmtD(h.data)}</td><td>${esc(h.mercado)}</td><td class="r">${fmtQ(h.qtd,p.un)}</td><td class="r">${brl(h.vUnit)}</td></tr>`).join("")}</table></div></div>
    <label class="f">Seção<select data-setcat="${esc(p.chave)}" id="cat-${esc(p.chave)}">${CATS.map(([k,l])=>`<option value="${k}" ${catOf(p)===k?"selected":""}>${l}</option>`).join("")}</select></label>
  </div>`;
}

// ---------- aba: Despensa ----------
function viewDespensa(){
  if(!D.compras.length) return demoBanner()+emptyState();
  const H = S.horizon;
  const ps = Object.values(D.prods);
  const known = ps.filter(p=>p.rate);
  const need = known.filter(p=>p.daysLeft < H).sort((a,b)=>a.daysLeft-b.daysLeft);
  const have = known.filter(p=>p.daysLeft >= H).sort((a,b)=>a.daysLeft-b.daysLeft);
  const learning = ps.filter(p=>!p.rate).sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  const row = (p, kind) => {
    const step = p.un==="kg"||p.un==="l" ? 0.5 : 1;
    const shown = step===1 ? Math.round(p.est) : p.est;
    const sugg = p.rate ? Math.max(step, Math.ceil((p.rate*H - p.est)/step)*step) : null;
    const ratio = p.daysLeft!=null ? Math.min(1, p.daysLeft/H) : 0;
    const color = kind==="need" ? (p.daysLeft<7?"var(--bad)":"var(--warn)") : "var(--accent)";
    return `<div class="item"><div class="grow">
      <div class="name">${esc(p.nome)}</div>
      <div class="meta">${p.perUnitDays?`1 ${esc(p.un)} dura ~${Math.round(p.perUnitDays)} dias`:"precisa de 2 compras para calcular a duração"}${p.manual?" · contado por você":""}</div>
      ${kind==="need"?`<div class="meta" style="color:var(--fg)">Comprar <b class="mono">${fmtQ(sugg,p.un)}</b> · acaba em ~${Math.max(0,Math.round(p.daysLeft))} dias</div>`:""}
      ${kind==="have"?`<div class="meta">Dá para ~${Math.round(p.daysLeft)} dias, não precisa comprar</div>`:""}
      ${p.daysLeft!=null?`<div class="meta"><div class="meter"><i style="width:${(ratio*100).toFixed(0)}%;background:${color}"></i></div></div>`:""}
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span class="note">em casa</span>
      <div class="stepper" role="group" aria-label="Quanto tem em casa de ${esc(p.nome)}"><button type="button" data-stk="${esc(p.chave)}" data-d="-${step}" aria-label="Menos">−</button><span>${fmtQ(Math.round(shown*10)/10,"").trim()}</span><button type="button" data-stk="${esc(p.chave)}" data-d="${step}" aria-label="Mais">+</button></div>
    </div></div>`;
  };
  return `${demoBanner()}
  <div class="row between"><h2>Despensa</h2></div>
  <p class="note" style="margin:0">Calculo quanto cada produto dura pelo intervalo entre as suas compras. Os números de <b>em casa</b> são estimativas: ajuste com − e + quando contar o que tem, e o app passa a usar a sua contagem.</p>
  <div class="row"><span class="note">Próxima compra em</span>
    <div class="seg grow" role="group" aria-label="Horizonte">${[15,30,45].map(h=>`<button data-h="${h}" aria-pressed="${H===h}">${h} dias</button>`).join("")}</div></div>
  <section class="card"><div class="row between"><h3>Precisa comprar · ${need.length}</h3>${need.length?`<button class="btn sm" data-act="copy-list">Copiar lista</button>`:""}</div>
    <div class="list">${need.length?need.map(p=>row(p,"need")).join(""):`<div class="empty">Nada acabando nos próximos ${H} dias.</div>`}</div></section>
  <section class="card"><h3>Tem em casa · ${have.length}</h3>
    <div class="list">${have.length?have.map(p=>row(p,"have")).join(""):`<div class="empty">Nenhum item com estoque sobrando ainda.</div>`}</div></section>
  ${learning.length?`<section class="card"><h3>Ainda aprendendo · ${learning.length}</h3><p class="note" style="margin:0">Comprados uma vez só. Depois da segunda compra eu calculo a duração.</p>
    <div class="list">${learning.map(p=>row(p,"learn")).join("")}</div></section>`:""}`;
}
function shoppingListText(){
  const H = S.horizon;
  const need = Object.values(D.prods).filter(p=>p.rate && p.daysLeft<H).sort((a,b)=>catOf(a).localeCompare(catOf(b)));
  let out = "Lista de compras ("+H+" dias)\n", cur = "";
  for(const p of need){ const step = p.un==="kg"||p.un==="l"?0.5:1; const q = Math.max(step, Math.ceil((p.rate*H-p.est)/step)*step);
    if(catOf(p)!==cur){ cur=catOf(p); out += "\n"+CATNAME[cur]+"\n"; }
    out += "- "+p.nome+" — "+fmtQ(q,p.un)+" (melhor: "+bestPlace(p.chave).mercado+")\n"; }
  return out;
}

// ---------- aba: Comparar ----------
function priceMap(){
  // chave -> mercado -> {preco, data, fonte}
  const map = {};
  for(const p of Object.values(D.prods)) for(const h of p.hist){
    const m = (map[p.chave] ||= {}); const cur = m[h.mercado];
    if(!cur || h.data>=cur.data) m[h.mercado] = {preco:h.vUnit,data:h.data,fonte:"sua nota"};
  }
  for(const q of S.cotacoes){ if(!q.chave || !q.mercado || !(q.preco>0)) continue;
    const m = (map[q.chave] ||= {}); const cur = m[q.mercado];
    if(!cur || (q.data||"")>=cur.data) m[q.mercado] = {preco:Number(q.preco),data:q.data||"",fonte:q.fonte||"pesquisa",url:q.url}; }
  return map;
}
function bestPlace(chave){ const m = priceMap()[chave]||{}; let b={mercado:"—",preco:Infinity}; for(const [k,v] of Object.entries(m)) if(v.preco<b.preco) b={mercado:k,...v}; return b; }
function viewComparar(){
  if(!D.compras.length) return demoBanner()+emptyState();
  const pm = priceMap();
  const basket = {};
  for(const c of D.compras.filter(c=>c.data.startsWith(D.lastYm))) for(const it of c.itens||[]){
    const k = it.chave||slug(it.nome); const b = basket[k] || (basket[k]={chave:k,nome:it.nome,qtd:0,pago:0,un:it.un||"un",mercado:c.mercado});
    b.qtd += Number(it.qtd)||1; b.pago += Number(it.vTotal)||0; }
  const items = Object.values(basket);
  const pagoTotal = sum(items,x=>x.pago);
  const markets = new Set(); items.forEach(i=>Object.keys(pm[i.chave]||{}).forEach(m=>markets.add(m)));
  const rows = [...markets].map(m=>{
    const cov = items.filter(i=>pm[i.chave]?.[m]);
    const custo = sum(cov,i=>pm[i.chave][m].preco*i.qtd), pago = sum(cov,i=>i.pago);
    return {m, n:cov.length, custo, pago, eco: pago>0 ? (1-custo/pago)*100 : 0};
  }).sort((a,b)=> (b.n/items.length>=0.5) - (a.n/items.length>=0.5) || b.eco-a.eco);
  let best = 0; const per = items.map(i=>{ const opts = Object.entries(pm[i.chave]||{}).sort((a,b)=>a[1].preco-b[1].preco); const [bm,bv] = opts[0]||["—",{preco:i.pago/i.qtd}]; best += bv.preco*i.qtd; return {...i,bm,bv,paidU:i.pago/i.qtd}; });
  const eco = pagoTotal-best;
  const hasPesquisa = S.cotacoes.length>0;
  return `${demoBanner()}
  <div class="row between"><h2>Onde sai mais barato</h2></div>
  <p class="note" style="margin:0">Base: a sua compra de ${fmtML(D.lastYm)} (${items.length} itens, ${brl(pagoTotal)}). Os preços vêm das suas notas${hasPesquisa?" e das pesquisas de preço salvas":""}. Quanto mais mercados diferentes você lançar, melhor fica a comparação.</p>
  <div class="hero" style="background:var(--surface);color:var(--fg);border:1px solid var(--line)">
    <span class="lbl" style="color:var(--muted)">Comprando cada item onde é mais barato</span>
    <span class="big">${brl(best)}</span>
    <span class="cmp">${eco>0.5?`<b class="ok">economia de ${brl(eco)}</b> (${Math.round(eco/pagoTotal*100)}%) sobre o que você pagou`:"Você já pagou o menor preço conhecido."}</span>
  </div>
  <section class="card"><h3>Por mercado</h3><div class="list">
    ${rows.map(r=>`<div class="item"><div class="grow"><div class="name">${esc(r.m)}</div><div class="meta">tem preço de ${r.n} de ${items.length} itens</div></div>
      <div style="text-align:right"><div class="price">${brl(r.custo)}</div>${Math.abs(r.eco)<1?'<span class="pill flat">igual</span>':r.eco>0?`<span class="pill down">${Math.round(r.eco)}% mais barato</span>`:`<span class="pill up">${Math.round(-r.eco)}% mais caro</span>`}</div></div>`).join("")}
  </div><p class="note" style="margin:0">Cada mercado é comparado só nos itens em que ele tem preço, contra o que você pagou nesses mesmos itens.</p></section>
  <section class="card"><h3>Item a item</h3><div class="list">
    ${per.sort((a,b)=>(b.paidU-b.bv.preco)*b.qtd-(a.paidU-a.bv.preco)*a.qtd).map(i=>{ const save = (i.paidU-i.bv.preco)*i.qtd;
      return `<div class="item"><div class="grow"><div class="name">${esc(i.nome)}</div>
      <div class="meta">pagou ${brl(i.paidU)} no ${esc(i.mercado)}</div>
      <div class="meta">menor: <b style="color:var(--fg)">${brl(i.bv.preco)}</b> no ${esc(i.bm)} · ${esc(i.bv.fonte||"")}${i.bv.data?" de "+fmtD(i.bv.data):""}${i.bv.url?` · <a href="${esc(i.bv.url)}" target="_blank" rel="noopener" style="color:var(--accent)">ver</a>`:""}</div></div>
      ${save>0.05?`<span class="pill down">−${brl(save)}</span>`:'<span class="pill acc">melhor</span>'}</div>`; }).join("")}
  </div></section>`;
}

// ---------- aba: Notas ----------
function viewNotas(){
  if(!D.compras.length) return demoBanner()+emptyState();
  const list = [...D.compras].reverse();
  return `${demoBanner()}
  <div class="row between"><h2>Notas</h2><button class="btn sm primary" data-act="add">+ Nova nota</button></div>
  <section class="card"><div class="list">
  ${list.map(c=>{ const open = S.openNota===c.id; const tot = Number(c.total)||sum(c.itens||[],x=>x.vTotal);
    return `<div class="item" style="flex-direction:column;gap:0"><button class="tap" data-nota="${esc(c.id)}" aria-expanded="${open}">
      <div class="grow"><div class="name">${esc(c.mercado||"Mercado")}</div><div class="meta">${fmtD(c.data)} · ${(c.itens||[]).length} itens</div></div><div class="price">${brl(tot)}</div></button>
      ${open?`<div class="receipt" style="margin-top:10px">
        <div class="rh"><b>${esc(c.mercado||"")}</b><br>${fmtD(c.data)}${c.cnpj?" · CNPJ "+esc(c.cnpj):""}</div>
        ${(c.itens||[]).map(it=>`<div class="ln"><span>${esc(it.nome)}<br><span style="color:var(--muted)">${fmtQ(it.qtd,it.un)} × ${brl(it.vUnit)}</span></span><span>${brl(it.vTotal)}</span></div>`).join("")}
        ${Number(c.desconto)>0?`<div class="ln"><span>Descontos</span><span>−${brl(c.desconto)}</span></div>`:""}
        <div class="ln tot"><span>TOTAL</span><span>${brl(tot)}</span></div>
        <div class="row" style="justify-content:flex-end;margin-top:10px;font-family:var(--f-body)">
          ${S.confirmDel===c.id?`<span class="note">Apagar esta nota?</span><button class="btn sm" data-act="cancel-del">Não</button><button class="btn sm danger" data-del="${esc(c.id)}">Apagar</button>`:`<button class="btn sm danger" data-act="ask-del" data-id="${esc(c.id)}">Apagar nota</button>`}
        </div></div>`:""}</div>`; }).join("")}
  </div></section>`;
}

// ---------- folha: adicionar nota ----------
let draft = null, files = [], ctl = null;
function openAdd(){ draft = null; files = []; renderSheet(); }
function closeSheet(){ ctl?.abort(); $("#layer").innerHTML=""; draft=null; files=[]; }
function renderSheet(state){
  const canRead = !!(S.supa && S.user);
  const max = MAX_FOTOS;
  let body;
  if(state==="reading"){
    body = `<div class="card"><div class="row"><div class="spin"></div><b>Lendo a nota…</b></div><p class="note" style="margin:0" id="readProg">Preparando as fotos…</p><button class="btn" data-act="stop">Parar</button></div>`;
  } else if(draft){
    const soma = sum(draft.itens,x=>x.vTotal), dif = (Number(draft.total)||0) - soma + (Number(draft.desconto)||0);
    body = `<p class="note" style="margin:0">Confira o que foi lido. Corrija nomes para ficarem iguais aos das outras compras, assim a média de preço junta o mesmo produto.</p>
      <div class="g2"><label class="f">Data<input type="date" id="d-data" value="${esc(draft.data)}"></label>
      <label class="f">Mercado<input id="d-merc" list="mercs" value="${esc(draft.mercado)}"></label></div>
      <datalist id="mercs">${Object.keys(D.mercados).map(m=>`<option value="${esc(m)}">`).join("")}</datalist>
      <datalist id="pnames">${Object.values(D.prods).map(p=>`<option value="${esc(p.nome)}">`).join("")}</datalist>
      <div class="g2"><label class="f">Total da nota<input type="number" step="0.01" inputmode="decimal" id="d-total" value="${draft.total??""}"></label>
      <label class="f">Descontos<input type="number" step="0.01" inputmode="decimal" id="d-desc" value="${draft.desconto||0}"></label></div>
      <div class="row between"><h3>${draft.itens.length} itens · soma ${brl(soma)}</h3>${Math.abs(dif)>0.05 && draft.total?`<span class="pill warn">diferença ${brl(dif)}</span>`:`<span class="pill down">confere</span>`}</div>
      ${draft.itens.map((it,i)=>`<div class="ed" data-i="${i}">
        ${it.nomeNota?`<div class="full nn">${esc(it.nomeNota)}</div>`:""}
        <input class="full" list="pnames" data-f="nome" id="it-n-${i}" value="${esc(it.nome)}" aria-label="Produto">
        <select class="s3" data-f="categoria" id="it-c-${i}" aria-label="Seção">${CATS.map(([k,l])=>`<option value="${k}" ${it.categoria===k?"selected":""}>${l}</option>`).join("")}</select>
        <select class="s3" data-f="un" id="it-u-${i}" aria-label="Unidade">${["un","kg","l","pct","cx"].map(u=>`<option ${it.un===u?"selected":""}>${u}</option>`).join("")}</select>
        <input class="s2" type="number" step="0.001" inputmode="decimal" data-f="qtd" id="it-q-${i}" value="${it.qtd}" aria-label="Quantidade">
        <input class="s2" type="number" step="0.01" inputmode="decimal" data-f="vUnit" id="it-v-${i}" value="${it.vUnit}" aria-label="Valor unitário">
        <input class="s2" type="number" step="0.01" inputmode="decimal" data-f="vTotal" id="it-t-${i}" value="${it.vTotal}" aria-label="Valor total">
        <span class="s3 note">qtd · unit · total</span><button type="button" class="btn sm danger s3" data-rm="${i}">Remover</button>
      </div>`).join("")}
      <button class="btn" data-act="add-item">+ Adicionar item</button>
      <button class="btn primary" data-act="save" id="saveBtn">Salvar nota</button>`;
  } else {
    body = `${canRead?`<label class="drop" for="pics">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linejoin="round"><path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/></svg>
        <b>Fotos da nota fiscal</b><span class="note">Até ${max} fotos. Nota comprida: fotografe em partes, com boa luz e reta.</span>
        <input type="file" id="pics" accept="image/*" multiple hidden></label>
      <div class="thumbs" id="thumbs">${files.map(f=>`<img alt="" src="${URL.createObjectURL(f)}">`).join("")}</div>
      <button class="btn primary" data-act="read" ${files.length?"":"disabled"}>Ler nota${files.length?` (${files.length} foto${files.length>1?"s":""})`:""}</button>`
      : `<div class="card"><b>Leitura por foto indisponível</b><p class="note" style="margin:0">Entre na sua conta para ler notas por foto, ou digite à mão.</p></div>`}
      <button class="btn" data-act="manual">Digitar à mão</button>`;
  }
  $("#layer").innerHTML = `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="Adicionar nota">
    <div class="sh"><h2>${draft?"Conferir nota":"Nova nota"}</h2><button class="x" data-act="close" aria-label="Fechar">×</button></div>
    <div class="sb">${body}</div></div></div>`;
}
function syncDraftFromForm(){
  if(!draft) return;
  const v = id => $("#"+id)?.value;
  if($("#d-data")) draft.data = v("d-data");
  if($("#d-merc")) draft.mercado = v("d-merc").trim();
  if($("#d-total")) draft.total = parseFloat(v("d-total"))||0;
  if($("#d-desc")) draft.desconto = parseFloat(v("d-desc"))||0;
  document.querySelectorAll(".ed").forEach(row=>{ const it = draft.itens[+row.dataset.i]; if(!it) return;
    row.querySelectorAll("[data-f]").forEach(inp=>{ const f = inp.dataset.f; it[f] = ["qtd","vUnit","vTotal"].includes(f) ? (parseFloat(inp.value)||0) : inp.value; }); });
}
// reduz cada foto para no máx. 2000px no lado maior (JPEG), legível e leve para enviar
async function prepImage(file){
  const url = URL.createObjectURL(file);
  try{
    const img = await new Promise((ok,ko)=>{ const i = new Image(); i.onload=()=>ok(i); i.onerror=ko; i.src=url; });
    const scale = Math.min(1, 2000/Math.max(img.naturalWidth,img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth*scale); c.height = Math.round(img.naturalHeight*scale);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    return {media_type:"image/jpeg", data:c.toDataURL("image/jpeg",0.85).split(",")[1]};
  } finally { URL.revokeObjectURL(url); }
}
async function readReceipt(){
  if(!files.length) return;
  ctl = new AbortController(); const signal = ctl.signal;
  renderSheet("reading");
  try{
    const imagens = [];
    for(const f of files){ imagens.push(await prepImage(f)); if(signal.aborted) throw {code:"cancelled"}; }
    const p=$("#readProg"); if(p) p.textContent="Lendo os itens da nota. Leva de 20 segundos a 1 minuto.";
    const conhecidos = Object.values(D?.prods||{}).slice(0,400).map(p=>p.chave+" | "+p.nome+" | "+p.categoria).join("\n");
    const {data:r, error} = await S.supa.functions.invoke("ler-nota",{body:{imagens, conhecidos}});
    if(signal.aborted) throw {code:"cancelled"};
    if(error){ let m=null; try{ m = await error.context.json(); }catch{} throw {code:"server", message:m?.erro}; }
    const itens = Array.isArray(r?.itens) ? r.itens : [];
    if(!itens.length) throw {code:"empty"};
    draft = {
      data: /^\d{4}-\d{2}-\d{2}$/.test(r.data||"") ? r.data : todayStr(),
      mercado: String(r.mercado||"").trim(), cnpj: String(r.cnpj||""),
      total: Number(r.total)||0, desconto: Number(r.desconto)||0,
      itens: itens.map(it=>{ const q = Number(it.qtd)||1, vu = Number(it.vUnit)||0, vt = Number(it.vTotal)|| +(vu*q).toFixed(2);
        return {nomeNota:String(it.nomeNota||""), nome:String(it.nome||it.nomeNota||"Item"), chave:String(it.chave||""), categoria: CATNAME[it.categoria]?it.categoria:"outros", qtd:q, un:["un","kg","l","pct","cx"].includes(it.un)?it.un:"un", vUnit: vu || (q? +(vt/q).toFixed(2):0), vTotal:vt}; })
    };
    renderSheet();
  }catch(e){
    if(e?.code==="cancelled"){ renderSheet(); return; }
    const msg = e?.message || {empty:"Não encontrei itens nas fotos. Tente fotos mais nítidas, com boa luz e a nota reta."}[e?.code] || "A leitura falhou. Confira a internet e tente de novo, ou digite à mão.";
    renderSheet(); const sb = $(".sb"); if(sb){ const d = document.createElement("div"); d.className="banner"; d.textContent=msg; sb.prepend(d); }
  }
}
async function saveDraft(){
  syncDraftFromForm();
  if(!draft.mercado){ toast("Informe o mercado"); return; }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.data)){ toast("Informe a data"); return; }
  const known = Object.values(D?.prods||{});
  const itens = draft.itens.filter(it=>String(it.nome).trim()).map(it=>{
    const nome = String(it.nome).trim();
    const match = known.find(p=>p.nome.toLowerCase()===nome.toLowerCase());
    const chave = match ? match.chave : (it.chave && /^[a-z0-9-]+$/.test(it.chave) ? it.chave : slug(nome));
    const q = Number(it.qtd)||1; const vt = Number(it.vTotal) || +(q*(Number(it.vUnit)||0)).toFixed(2);
    return {nome: match?match.nome:nome, nomeNota:it.nomeNota||"", chave, categoria:it.categoria||"outros", qtd:q, un:it.un||"un", vUnit:Number(it.vUnit)||+(vt/q).toFixed(2), vTotal:vt};
  });
  if(!itens.length){ toast("Adicione pelo menos um item"); return; }
  const btn = $("#saveBtn"); if(btn){ btn.disabled=true; btn.textContent="Salvando…"; }
  try{
    await saveCompra({data:draft.data, mercado:draft.mercado, cnpj:draft.cnpj||"", total: Number(draft.total)||+sum(itens,x=>x.vTotal).toFixed(2), desconto:Number(draft.desconto)||0, itens});
    closeSheet(); toast("Nota salva"); S.tab="resumo"; LS.set("tab","resumo"); render();
  }catch(e){ if(btn){ btn.disabled=false; btn.textContent="Salvar nota"; } toast(e?.code==="quota_exceeded"?"Espaço cheio no banco de dados":"Não consegui salvar. Tente de novo."); }
}

// ---------- render ----------
function render(){
  derive(); renderNav();
  const views = {resumo:viewResumo,produtos:viewProdutos,despensa:viewDespensa,comparar:viewComparar,notas:viewNotas};
  $("#main").innerHTML = `<div class="stack">${(views[S.tab]||viewResumo)()}</div>`;
  if(S.tab==="produtos") renderProdList();
  $("#syncState").textContent = S.demo ? "modo exemplo" : (S.loaded.c ? `${D.compras.length} ${D.compras.length===1?"nota":"notas"}` : "carregando…");
}

// ---------- eventos ----------
document.addEventListener("click", async e => {
  const t = e.target.closest("[data-tab],[data-act],[data-scope],[data-cat],[data-open],[data-h],[data-stk],[data-nota],[data-del],[data-rm]");
  if(!t) return;
  if(t.dataset.tab){ S.tab=t.dataset.tab; LS.set("tab",S.tab); render(); window.scrollTo({top:0}); return; }
  if(t.dataset.scope){ S.scope=t.dataset.scope; S.cat="todas"; render(); return; }
  if(t.dataset.cat){ S.cat=t.dataset.cat; render(); return; }
  if(t.dataset.open){ S.open = S.open===t.dataset.open?null:t.dataset.open; renderProdList(); return; }
  if(t.dataset.nota){ S.openNota = S.openNota===t.dataset.nota?null:t.dataset.nota; S.confirmDel=null; render(); return; }
  if(t.dataset.h){ S.horizon=+t.dataset.h; LS.set("horizon",S.horizon); render(); return; }
  if(t.dataset.del){ try{ await deleteCompra(t.dataset.del); S.openNota=null; S.confirmDel=null; toast("Nota apagada"); }catch{ toast("Não consegui apagar"); } return; }
  if(t.dataset.rm!=null){ syncDraftFromForm(); draft.itens.splice(+t.dataset.rm,1); renderSheet(); return; }
  if(t.dataset.stk){ adjustStock(t.dataset.stk, parseFloat(t.dataset.d)); return; }
  const a = t.dataset.act;
  if(a==="scrim" && e.target!==t) return;
  if(a==="close"||a==="scrim") closeSheet();
  else if(a==="add") openAdd();
  else if(a==="demo"){ const d = makeDemo(); S.demo=true; S.compras=d.compras; S.produtosDb=d.produtosDb; S.cotacoes=d.cotacoes; render(); }
  else if(a==="exit-demo"){ S.demo=false; S.compras=real.compras; S.produtosDb=real.produtos; S.cotacoes=real.cotacoes; render(); }
  else if(a==="read") readReceipt();
  else if(a==="stop") ctl?.abort();
  else if(a==="manual"){ draft = {data:todayStr(),mercado:"",cnpj:"",total:0,desconto:0,itens:[{nome:"",categoria:"basicos",qtd:1,un:"un",vUnit:0,vTotal:0}]}; renderSheet(); }
  else if(a==="add-item"){ syncDraftFromForm(); draft.itens.push({nome:"",categoria:"basicos",qtd:1,un:"un",vUnit:0,vTotal:0}); renderSheet(); }
  else if(a==="save") saveDraft();
  else if(a==="ask-del"){ S.confirmDel=t.dataset.id; render(); }
  else if(a==="cancel-del"){ S.confirmDel=null; render(); }
  else if(a==="copy-list"){
    const txt = shoppingListText();
    try{ await navigator.clipboard.writeText(txt); toast("Lista copiada"); }
    catch{ const ta=document.createElement("textarea"); ta.value=txt; ta.className="search"; ta.rows=8; t.closest(".card").appendChild(ta); ta.select(); toast("Selecione e copie"); }
  }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if(t.id==="pics"){ const max = MAX_FOTOS; files = [...t.files].slice(0,max); if(t.files.length>max) toast("Usei as primeiras "+max+" fotos"); renderSheet(); return; }
  if(t.dataset.setcat){ try{ await writeProduto(t.dataset.setcat,{categoria:t.value}); toast("Seção alterada"); if(S.demo) render(); }catch{ toast("Não consegui salvar"); } return; }
  if(t.closest(".ed") && t.dataset.f){ // recalcula total do item
    const row = t.closest(".ed"), q = parseFloat(row.querySelector('[data-f="qtd"]').value)||0, vu = parseFloat(row.querySelector('[data-f="vUnit"]').value)||0;
    if(t.dataset.f==="qtd"||t.dataset.f==="vUnit") row.querySelector('[data-f="vTotal"]').value = (q*vu).toFixed(2);
  }
});
document.addEventListener("input", e => { if(e.target.id==="q"){ S.q=e.target.value; renderProdList(); } });
// tooltip do gráfico
function showTip(g){ const ch = g.closest("[data-chart]"); const tip = ch.querySelector(".tip"); tip.textContent = g.dataset.tip; tip.hidden=false; tip.style.left=g.dataset.x+"%"; tip.style.top=g.dataset.y+"%"; }
document.addEventListener("pointerover", e => { const g = e.target.closest?.("[data-tip]"); if(g) showTip(g); });
document.addEventListener("pointerout", e => { const g = e.target.closest?.("[data-tip]"); if(g && !g.contains(e.relatedTarget)){ const tip = g.closest("[data-chart]")?.querySelector(".tip"); if(tip) tip.hidden=true; } });
$("#fab").addEventListener("click", openAdd);
$("#acctBtn").addEventListener("click", openAccount);

const stockTimers = {};
function adjustStock(chave, d){
  const p = D.prods[chave]; if(!p) return;
  const cur = S.pendingStock[chave]?.estoque ?? ((p.un==="kg"||p.un==="l") ? Math.round(p.est*10)/10 : Math.round(p.est));
  const next = Math.max(0, Math.round((cur + d)*10)/10);
  S.pendingStock[chave] = {estoque:next, estoqueEm:todayStr()};
  render();
  clearTimeout(stockTimers[chave]);
  stockTimers[chave] = setTimeout(async ()=>{
    const v = S.pendingStock[chave];
    try{ await writeProduto(chave, {estoque:v.estoque, estoqueEm:v.estoqueEm, nome:p.nome}); }
    catch{ toast("Não consegui salvar o estoque"); }
    delete S.pendingStock[chave]; render();
  }, 700);
}

// ---------- conta e login ----------
const real = {compras:[], produtos:{}, cotacoes:[]};
const LOGO = '<svg width="64" height="64" viewBox="0 0 26 26" aria-hidden="true"><path d="M5 2h16v22l-2.7-1.8L15.6 24 13 22.2 10.4 24l-2.7-1.8L5 24z" fill="var(--accent)"/><path d="M9 8h8M9 12h8M9 16h5" stroke="var(--surface)" stroke-width="1.8" stroke-linecap="round"/></svg>';
let authMode = "entrar", authMsg = null;
function showAuth(mode){
  if(mode) authMode = mode;
  $("#appView").hidden = true; $("#authView").hidden = false;
  const titles = {entrar:"Entrar", criar:"Criar conta", esqueci:"Recuperar senha", nova:"Nova senha"};
  const needEmail = authMode!=="nova", needPass = authMode!=="esqueci";
  $("#authView").innerHTML = `<div class="wrap auth">
    <div class="logo">${LOGO}<b>Nota a Nota</b><span class="note">Seus gastos de mercado, nota a nota.</span></div>
    <section class="card"><h2>${titles[authMode]}</h2>
      ${authMsg?`<div class="msg ${authMsg.err?"err":""}">${esc(authMsg.text)}</div>`:""}
      <form id="authForm" novalidate>
        ${needEmail?`<label class="f">E-mail<input id="au-email" type="email" autocomplete="email" inputmode="email" required></label>`:""}
        ${needPass?`<label class="f">${authMode==="nova"?"Nova senha":"Senha"}<input id="au-pass" type="password" autocomplete="${authMode==="entrar"?"current-password":"new-password"}" minlength="6" required></label>`:""}
        <button class="btn primary" type="submit" id="au-go">${{entrar:"Entrar",criar:"Criar conta",esqueci:"Enviar link",nova:"Salvar senha"}[authMode]}</button>
      </form>
      <div class="row" style="justify-content:center;flex-wrap:wrap">
        ${authMode!=="entrar"?`<button class="linkbtn" data-auth="entrar">Já tenho conta</button>`:""}
        ${authMode!=="criar"&&authMode!=="nova"?`<button class="linkbtn" data-auth="criar">Criar conta</button>`:""}
        ${authMode==="entrar"?`<button class="linkbtn" data-auth="esqueci">Esqueci a senha</button>`:""}
      </div>
    </section>
    <p class="note" style="text-align:center;margin:0">Cada pessoa tem a própria conta. Ninguém vê as notas de outra pessoa.</p>
  </div>`;
}
const AUTH_ERR = {"Invalid login credentials":"E-mail ou senha incorretos.","Email not confirmed":"Confirme seu e-mail antes de entrar. Procure a mensagem na sua caixa de entrada.","User already registered":"Este e-mail já tem conta. Use Entrar.","Signups not allowed for this instance":"Cadastro fechado. Peça para quem administra o app te convidar."};
document.addEventListener("click", e => { const b = e.target.closest("[data-auth]"); if(b){ authMsg=null; showAuth(b.dataset.auth); } });
document.addEventListener("submit", async e => {
  if(e.target.id!=="authForm") return;
  e.preventDefault();
  const email = $("#au-email")?.value.trim(), pass = $("#au-pass")?.value;
  if(authMode!=="nova" && !/^\S+@\S+\.\S+$/.test(email||"")){ authMsg={err:true,text:"Digite um e-mail válido."}; showAuth(); return; }
  if(authMode!=="esqueci" && (pass||"").length<6){ authMsg={err:true,text:"A senha precisa ter pelo menos 6 caracteres."}; showAuth(); if(email && $("#au-email")) $("#au-email").value=email; return; }
  const go = $("#au-go"); go.disabled = true; go.textContent = "Aguarde…";
  const redirect = location.origin + location.pathname;
  let res;
  if(authMode==="entrar") res = await S.supa.auth.signInWithPassword({email, password:pass});
  else if(authMode==="criar") res = await S.supa.auth.signUp({email, password:pass, options:{emailRedirectTo:redirect}});
  else if(authMode==="esqueci") res = await S.supa.auth.resetPasswordForEmail(email,{redirectTo:redirect});
  else res = await S.supa.auth.updateUser({password:pass});
  if(res.error){ authMsg={err:true,text:AUTH_ERR[res.error.message]||res.error.message}; showAuth(); if(email && $("#au-email")) $("#au-email").value=email; return; }
  if(authMode==="criar" && !res.data.session){ authMsg={text:"Conta criada. Abra o e-mail de confirmação e depois entre aqui."}; showAuth("entrar"); return; }
  if(authMode==="esqueci"){ authMsg={text:"Se o e-mail tiver conta, você vai receber um link para criar uma senha nova."}; showAuth("entrar"); return; }
  if(authMode==="nova"){ toast("Senha alterada"); }
  authMsg = null;
});
function showApp(){
  $("#authView").hidden = true; $("#appView").hidden = false;
  $("#acctBtn").textContent = (S.user?.email||"?")[0].toUpperCase();
  render(); loadAll();
}
async function openAccount(){
  let usados = "—";
  try{ const ini = todayStr().slice(0,8)+"01";
    const {count} = await S.supa.from("uso_leitura").select("id",{count:"exact",head:true}).gte("criado_em",ini);
    if(count!=null) usados = count; }catch{}
  $("#layer").innerHTML = `<div class="scrim" data-act="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="Minha conta">
    <div class="sh"><h2>Minha conta</h2><button class="x" data-act="close" aria-label="Fechar">×</button></div>
    <div class="sb">
      <div class="card"><span class="note">Conectado como</span><b style="overflow-wrap:anywhere">${esc(S.user?.email)}</b>
        <span class="note">Notas lidas por foto neste mês: <b class="mono">${usados}</b></span></div>
      <button class="btn" id="btnRefresh">Atualizar dados</button>
      <button class="btn danger" id="btnSair">Sair da conta</button>
    </div></div></div>`;
  $("#btnSair").onclick = async () => { closeSheet(); await S.supa.auth.signOut(); };
  $("#btnRefresh").onclick = async () => { closeSheet(); await loadAll(); toast("Dados atualizados"); };
}

// ---------- início ----------
(async () => {
  const cfg = window.NAN_CONFIG || {};
  if(!window.supabase || !cfg.SUPABASE_URL || /COLE/.test(cfg.SUPABASE_URL)){
    $("#authView").hidden = false;
    $("#authView").innerHTML = `<div class="wrap auth"><div class="logo">${LOGO}<b>Nota a Nota</b></div><div class="card"><b>Falta configurar</b><p class="note" style="margin:0">Preencha o arquivo <span class="mono">config.js</span> com a URL e a chave pública do seu projeto Supabase (veja o README).</p></div></div>`;
    return;
  }
  S.supa = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {auth:{persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
  S.supa.auth.onAuthStateChange((event, session) => {
    if(event==="PASSWORD_RECOVERY"){ S.user = session?.user||null; authMsg={text:"Crie sua senha nova."}; showAuth("nova"); return; }
    const prev = S.user?.id; S.user = session?.user || null;
    if(!S.user){ S.compras=[]; S.produtosDb={}; S.cotacoes=[]; S.loaded={c:false,p:false,q:false}; S.demo=false; real.compras=[]; real.produtos={}; real.cotacoes=[]; showAuth("entrar"); return; }
    if(authMode==="nova" && event!=="USER_UPDATED") return;
    if(prev!==S.user.id || $("#appView").hidden){ authMode="entrar"; setTimeout(showApp,0); }
  });
  document.addEventListener("visibilitychange", () => { if(document.visibilityState==="visible" && S.user && !S.demo) loadAll(); });
})();

if("serviceWorker" in navigator){ window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(()=>{})); }
})();
