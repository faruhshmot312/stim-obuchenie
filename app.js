{
const tg=window.Telegram&&Telegram.WebApp&&Telegram.WebApp.initData!==undefined?Telegram.WebApp:null;
const CATS={all:"Все",stock:"В наличии",auto:"Авто",home:"Дом и быт",repair:"Ремонт и инструменты",health:"Здоровье и уход",kids:"Дети",todo:"Не пройдено"};
let P=[],done={},filter="all",query="",me="";
const API=String(window.STIM_API||"").trim();
function send(event,extra){
  if(!API||!tg||!tg.initData)return Promise.resolve(null);
  return fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({initData:tg.initData,event,...(extra||{})}),keepalive:true}).then(r=>r.json()).catch(()=>null);
}
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
const safeUrl=u=>/^https:\/\//i.test(String(u||"").trim())?String(u).trim():"";
const arr=a=>Array.isArray(a)?a:[];
function lsGet(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
done=lsGet("stim-done",{});

/* Telegram: тема, кнопка «Назад», прогресс в облаке Telegram */
function applyTheme(){
  if(!tg)return;
  document.documentElement.dataset.theme=tg.colorScheme==="dark"?"dark":"light";
  const bg=getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
  try{tg.setHeaderColor(bg);tg.setBackgroundColor(getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())}catch(e){}
}
if(tg){
  tg.ready();tg.expand();applyTheme();
  tg.onEvent("themeChanged",applyTheme);
  tg.BackButton.onClick(()=>{location.hash=""});
  try{tg.CloudStorage.getItem("done",(err,v)=>{if(!err&&v){try{done={...JSON.parse(v),...done};lsSet("stim-done",done);rerender()}catch(e){}}})}catch(e){}
}
const haptic=t=>{try{tg&&tg.HapticFeedback.notificationOccurred(t)}catch(e){}};

function fill(p){
  p.script=arr(p.script);p.table=arr(p.table).length?p.table:[["Параметр","Значение"]];
  p.notes=arr(p.notes);p.side=arr(p.side);p.objections=arr(p.objections);p.important=String(p.important||"");
  p.ready=p.script.length>0;return p;
}
function photo(p,big){
  const tag=p.stock?'<span class="tag in">В наличии</span>':'';
  const dn=done[p.id]&&!big?'<span class="done">Пройдено</span>':'';
  const inner=p.photo?`<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy">`:`<span class="mono">${esc(p.name.trim()[0])}</span>`;
  return `<div class="ph">${inner}${tag}${dn}</div>`;
}
function hay(p){return norm([p.name,p.subtitle,CATS[p.cat],p.table.flat().join(" "),p.notes.join(" "),p.objections.flat().join(" "),p.script.map(s=>s[1]).join(" ")].join(" "))}
function updProg(){
  const n=P.filter(p=>done[p.id]).length;
  $("#progtxt").textContent=(me?me+" · ":"")+`Пройдено ${n} из ${P.length}`;
  $("#progbar").style.width=(P.length?n/P.length*100:0)+"%";
}
function renderChips(){
  const cnt=k=>k==="all"?P.length:k==="stock"?P.filter(p=>p.stock).length:k==="todo"?P.filter(p=>!done[p.id]).length:P.filter(p=>p.cat===k).length;
  $("#chips").innerHTML=Object.keys(CATS).map(k=>`<button class="chip" aria-pressed="${filter===k}" data-f="${k}">${CATS[k]}<b>${cnt(k)}</b></button>`).join("");
}
function list(){
  document.title="Стим — обучение операторов";
  $("#searchbox").hidden=false;$("#chips").hidden=false;
  if(tg)tg.BackButton.hide();
  renderChips();
  const q=norm(query).split(/\s+/).filter(Boolean);
  const items=P.filter(p=>(filter==="all"||(filter==="stock"?p.stock:filter==="todo"?!done[p.id]:p.cat===filter))&&q.every(w=>p._h.includes(w)));
  const head=query?`Найдено: ${items.length}`:`${CATS[filter]}: ${items.length}`;
  $("#app").innerHTML=`<p class="meta">${head}. Нажмите на товар, чтобы пройти обучение.</p>`+
   (items.length?`<div class="grid">${items.map(p=>`<a class="card" href="#${esc(p.id)}">${photo(p)}<div class="cb"><span class="cat">${CATS[p.cat]||""}</span><h3>${esc(p.name)}</h3>${p.price?`<div class="price"><b>${esc(p.price)} сум</b>${p.old?`<s>${esc(p.old)}</s>`:""}</div>`:""}</div></a>`).join("")}</div>`
   :`<div class="empty">Ничего не нашлось. Попробуйте другое слово, например «авто», «обувь» или «труба».</div>`);
}
let step=0,cur=null,answers={};
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function makeQuiz(p){
  const R=P.filter(x=>x.id!==p.id),qs=[];
  if(p.price){const prices=shuffle([...new Set(R.map(x=>x.price).filter(x=>x&&x!==p.price))]).slice(0,3);
    qs.push({t:"Какая цена по акции?",o:shuffle([p.price+" сум",...prices.map(x=>x+" сум")]),a:p.price+" сум"});}
  const spec=p.objections.filter(o=>!/Дорого|подумаю/i.test(o[0]));
  const others=R.flatMap(x=>x.objections.filter(o=>!/Дорого|подумаю/i.test(o[0])).map(o=>o[1]));
  spec.slice(0,2).forEach(o=>qs.push({t:`Клиент говорит ${o[0]}. Что ответить?`,o:shuffle([o[1],...shuffle(others).slice(0,2)]),a:o[1]}));
  const imp=p.important.replace(/^Важно:\s*/i,"");
  if(imp){const fake=shuffle(R.filter(x=>x.important).map(x=>x.important.replace(/^Важно:\s*/i,""))).slice(0,2);
    qs.push({t:"Что обязательно помнить по этому товару?",o:shuffle([imp,...fake]),a:imp});}
  return qs;
}
function product(id){
  const p=P.find(x=>x.id===id); if(!p){location.hash="";return}
  if(cur!==id){cur=id;step=0;answers={};p._quiz=makeQuiz(p);send("открыл товар",{productId:p.id,product:p.name})}
  document.title=p.name+" — обучение";
  $("#searchbox").hidden=true;$("#chips").hidden=true;
  if(tg)tg.BackButton.show();
  const pdf=safeUrl(p.pdf),vid=safeUrl(p.video);
  const labels=["Скрипт","Характеристики","Возражения","Проверка"];
  const steps=labels.map((l,i)=>`<button class="step${i<step||(i===3&&done[p.id])?' ok':''}" data-step="${i}" ${i===step?'aria-current="step"':''}><i>${i<step||(i===3&&done[p.id])?'✓':i+1}</i><span>${l}</span></button>`).join("");
  let body="";
  if(step===0) body=`<h3>Скрипт звонка</h3>${p.script.map(s=>`<div class="srow"><div class="l">${esc(s[0])}</div><div class="r">${esc(s[1])}</div></div>`).join("")}${p.important?`<div class="imp">${esc(p.important)}</div>`:""}`;
  if(step===1){const [h,...rows]=p.table;body=`<h3>${esc(p.table_title||"Характеристики и применение")}</h3><div class="two"><div><div class="tbl"><table><thead><tr>${h.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${p.notes.map(n=>`<p class="note">${esc(n)}</p>`).join("")}</div>${p.side.length?`<div class="side"><h4>${esc(p.side_title||"Важно")}</h4>${p.side.map(s=>`<p>${esc(s)}</p>`).join("")}</div>`:""}</div>`}
  if(step===2) body=`<h3>Работа с возражениями</h3><div class="objs">${p.objections.map(o=>`<div class="obj"><h4>${esc(o[0])}</h4><p>${esc(o[1]||"")}</p></div>`).join("")}</div>`;
  if(step===3){
    const qs=p._quiz, all=qs.every((q,i)=>answers[i]!=null), score=qs.filter((q,i)=>answers[i]===q.a).length;
    body=`<h3>Проверьте себя</h3>${qs.map((q,i)=>`<div class="q"><p>${i+1}. ${esc(q.t)}</p><div class="opts">${q.o.map((o,j)=>{const c=answers[i]==null?"":o===q.a?"right":answers[i]===o?"wrong":"";return `<button class="opt ${c}" data-q="${i}" data-o="${j}" ${answers[i]!=null?"disabled":""}>${esc(o)}</button>`}).join("")}</div></div>`).join("")}`+
      (all?(score===qs.length?`<div class="result ok">Все ответы верны — товар отмечен как пройденный.</div>`:`<div class="result bad">Верно ${score} из ${qs.length}. Повторите материал и пройдите проверку ещё раз.</div><div class="nav"><button class="btn" id="retry">Пройти проверку заново</button></div>`):"");
  }
  const nav=step<3?`<div class="nav"><button class="btn" id="prev" ${step===0?"disabled":""}>← Назад</button><button class="btn primary" id="next">${step===2?"К проверке →":"Дальше →"}</button></div>`:"";
  $("#app").innerHTML=`${tg?"":`<a class="back" href="#">← Все товары</a>`}
  <section class="hero">${photo(p,true)}<div>
    <span class="cat">${CATS[p.cat]||""}</span><h2>${esc(p.name)}</h2>${norm(p.subtitle)!==norm(p.name)?`<p class="sub">${esc(p.subtitle)}</p>`:""}
    ${p.price?`<div class="price"><b>${esc(p.price)} сум</b>${p.old?`<s>${esc(p.old)} сум</s>`:""}</div>`:""}
    <div class="links">${pdf?`<a class="btn" href="${esc(pdf)}" target="_blank" rel="noopener" data-ext>Открыть PDF</a>`:""}${vid?`<a class="btn" href="${esc(vid)}" target="_blank" rel="noopener" data-ext>Сайт и видео</a>`:""}</div>
  </div></section>
  <nav class="steps" aria-label="Шаги обучения">${steps}</nav>
  <section class="panel">${body}${nav}</section>`;
}
function route(){const id=location.hash.slice(1);if(id&&P.length)product(id);else list();window.scrollTo(0,0)}
function rerender(){const id=location.hash.slice(1);id&&P.length?product(id):list();updProg()}
function markDone(id){
  done[id]=true;lsSet("stim-done",done);updProg();
  try{tg&&tg.CloudStorage.setItem("done",JSON.stringify(done))}catch(e){}
}
document.addEventListener("click",e=>{
  const ext=e.target.closest("[data-ext]");if(ext&&tg){e.preventDefault();try{tg.openLink(ext.href)}catch(err){location.href=ext.href}return}
  const c=e.target.closest(".chip");if(c){filter=c.dataset.f;list();return}
  const s=e.target.closest(".step");if(s){step=+s.dataset.step;product(cur);return}
  if(e.target.closest("#next")){step++;product(cur);window.scrollTo({top:document.querySelector(".steps").offsetTop-10});return}
  if(e.target.closest("#prev")){step--;product(cur);return}
  if(e.target.closest("#retry")){answers={};const p=P.find(x=>x.id===cur);p._quiz=makeQuiz(p);product(cur);return}
  const o=e.target.closest(".opt");if(o){const p=P.find(x=>x.id===cur),i=+o.dataset.q,q=p._quiz[i];answers[i]=q.o[+o.dataset.o];
    haptic(answers[i]===q.a?"success":"error");
    const qs=p._quiz;if(qs.every((q,k)=>answers[k]!=null)){const sc=qs.filter((q,k)=>answers[k]===q.a).length,ok=sc===qs.length;
      send("проверка",{productId:p.id,product:p.name,result:`${sc}/${qs.length} ${ok?"сдал":"не сдал"}`});if(ok)markDone(cur)}
    product(cur);return}
});
$("#q").addEventListener("input",e=>{query=e.target.value;list()});
addEventListener("hashchange",route);
function screen(title,text,btn){
  $("#searchbox").hidden=true;$("#chips").hidden=true;
  $("#app").innerHTML=`<div class="gate"><h2>${esc(title)}</h2><p>${text}</p>${btn?`<button class="btn primary" id="again">${esc(btn)}</button>`:""}</div>`;
}
function load(){
  fetch("products.json?v="+Date.now(),{cache:"no-store"}).then(r=>r.json()).then(d=>{
    P=d.filter(p=>p&&p.name&&!p.hidden).map(fill).filter(p=>p.ready).sort((a,b)=>(a.row||999)-(b.row||999));
    P.forEach(p=>p._h=hay(p));updProg();route()})
   .catch(()=>{$("#app").innerHTML='<div class="empty">Не удалось загрузить список товаров. Проверьте интернет и откройте снова.</div>'});
}
function gate(){
  if(!API){load();return}
  if(!tg||!tg.initData){screen("Откройте через Telegram","Обучение доступно только сотрудникам. Откройте бота <b>@stim_obuchenie_bot</b> и нажмите кнопку «Обучение».");return}
  screen("Проверяю доступ…","Секунду.");
  send("вход").then(r=>{
    if(r&&r.ok){me=String(r.name||"");load();return}
    if(r&&r.reason==="not_allowed"){const u=tg.initDataUnsafe&&tg.initDataUnsafe.user||{};
      screen("Нет доступа",`Вас ещё нет в списке сотрудников. Отправьте руководителю ваш Telegram ID: <b>${esc(r.id||u.id||"")}</b>${(r.username||u.username)?` и ник <b>@${esc(r.username||u.username)}</b>`:""}. Когда вас добавят, откройте обучение снова.`,"Проверить ещё раз");return}
    screen("Не удалось проверить доступ","Проверьте интернет и попробуйте ещё раз.","Попробовать снова");
  });
}
document.addEventListener("click",e=>{if(e.target.closest("#again"))gate()});
gate();
}
