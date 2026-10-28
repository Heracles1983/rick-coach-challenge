import {shuffle, createSession, remaining, grade, validSession, questionVolume, selectQuestions, sessionVolume} from './core.mjs?v=20261027-2';
const BANK = window.QUESTION_BANK;
const TRACKS = [
 {id:'nsca-cpt',name:'NSCA-CPT',label:'从评估到训练执行',desc:'客户咨询、目标制定、动作指导与安全边界。',color:'01'},
 {id:'cscs',name:'CSCS',label:'把科学转化成表现',desc:'能量系统、生物力学、力量功率与周期计划。',color:'02'},
 {id:'ace',name:'ACE',label:'让改变持续发生',desc:'行为改变、沟通、依从性与训练进阶。',color:'03'},
 {id:'nasm',name:'NASM',label:'动作质量与系统进阶',desc:'OPT 模型、评估思路、动作链与技术指导。',color:'04'},
 {id:'acsm',name:'ACSM',label:'以运动处方连接健康',desc:'运动前筛查、FITT-VP、有氧与抗阻基础。',color:'05'}
];
const VOLUMES = [
 {id:'vol1',number:'01',name:'第一辑',title:'教练综合基础',tag:'基础巩固',description:'掌握运动科学、动作指导和职业责任的基础判断。'},
 {id:'vol2',number:'02',name:'第二辑',title:'训练应用与案例',tag:'新增 60 题',description:'用训练日志、计划计算和真实情境，练习更细致的决策。'}
];
const volumeInfo = id => VOLUMES.find(v=>v.id===id);
const SOURCES = {
 'nsca-cpt': {name:'NSCA-CPT 官方考试领域',url:'https://www.nsca.com/certification/nsca-cpt/nsca-cpt-exam-description/'},
 cscs:{name:'CSCS 官方考试领域',url:'https://www.nsca.com/cscs-exam-description'},
 ace:{name:'ACE 官方考试大纲',url:'https://www.acefitness.org/fitness-certifications/certification-exam-content/'},
 nasm:{name:'NASM-CPT 官方蓝图',url:'https://www.nasm.org/content/dam/nasm/docs/nasmlibraries/pdf/cpt7-nasm-exam-blueprint.pdf'},
 acsm:{name:'ACSM-CPT 官方考试大纲',url:'https://acsm.org/acsm-certified-personal-trainer-exam-content-outline/'}
};
const KEY = 'heracles-quiz-series-v1';
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trackName = id => TRACKS.find(t=>t.id===id)?.name || id;
const find = id => BANK.find(q=>q.id===id);
let storageOK = true, timer = null, session = null, mode = 'learn', pendingConfirm = null, activeVolume = 'vol2';
let library = {version:1,history:{},starred:[],last:null,activeVolume:'vol2'};
try {
 const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
 if (raw?.version===1 && raw.history && typeof raw.history==='object' && Array.isArray(raw.starred)) {
  if (volumeInfo(raw.activeVolume)) activeVolume = raw.activeVolume;
  library.history = Object.fromEntries(Object.entries(raw.history).filter(([id,h])=>find(id) && h && typeof h==='object'));
  library.starred = [...new Set(raw.starred.filter(id=>find(id)))];
  if (validSession(raw.last,BANK)) library.last = raw.last;
 }
 const requestedVolume = new URLSearchParams(location.search).get('volume');
 if (volumeInfo(requestedVolume)) activeVolume = requestedVolume;
 library.activeVolume = activeVolume;
 localStorage.setItem(KEY,JSON.stringify(library));
} catch {storageOK=false;}
function save() {
 library.activeVolume = activeVolume;
 if (session) library.last = session;
 try {localStorage.setItem(KEY,JSON.stringify(library));} catch {if(storageOK) toast('浏览器无法保存进度，本次仍可继续；离开前请导出复盘。');storageOK=false;}
}
function toast(text) { $('toast').textContent=text; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),3500); }
function restoreFocus(selector){document.querySelector(selector)?.focus({preventScroll:true});}
function focusContent() { $('content').focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'}); }
function wrongIds() {return BANK.filter(q=>library.history[q.id]?.wrong).map(q=>q.id);}
function studiedIds() {return BANK.filter(q=>library.history[q.id]?.attempts>0).map(q=>q.id);}
function sourceLink(q) {const s=SOURCES[q.source];return `<a href="${s.url}" target="_blank" rel="noopener">参考领域 · ${s.name} ↗</a>`;}
function home() {
 clearInterval(timer);timer=null;session=null;
 const v=volumeInfo(activeVolume), activeBank=selectQuestions(BANK,activeVolume);
 const last=library.last, done=activeBank.filter(q=>library.history[q.id]?.attempts>0).length, wrong=wrongIds().length;
 $('app').innerHTML=`<section class="hero"><div><div class="eyebrow">学习卡片 / QUESTION BANK · 2 VOLUMES</div><h1>把知识练成<br><span>教练的判断力。</span></h1><p>从运动科学到训练现场，给自己一小时。<br>两辑共 ${BANK.length} 道原创单选题，每辑约一小时。<br>从基础理解，到训练现场的案例判断。</p><div class="tags">${TRACKS.map(t=>`<span class="tag">${t.name}</span>`).join('')}</div></div><aside class="time-panel"><div class="label">ONE HOUR. FIVE PERSPECTIVES.</div><div class="time-big">60<small>分钟 / 每辑建议</small></div><div class="time-split"><span><b>45</b> 分钟答题</span><span><b>15</b> 分钟复盘</span><span><b>60</b> 道原创题</span></div></aside></section>
 <section class="volume-selector" aria-label="选择题库卷次">${VOLUMES.map(item=>{const qs=selectQuestions(BANK,item.id),count=qs.filter(q=>library.history[q.id]?.attempts>0).length;return `<button class="volume-choice ${activeVolume===item.id?'active':''}" data-action="volume" data-volume="${item.id}" aria-pressed="${activeVolume===item.id}"><span class="volume-top"><span class="micro">VOL. ${item.number}</span><span class="volume-tag">${item.tag}</span></span><strong>${item.name} · ${item.title}</strong><span class="volume-description">${item.description}</span><span class="volume-bottom">${qs.length} 题 · 已练 ${count}/${qs.length}<span>${activeVolume===item.id?'当前选择 ✓':'切换本辑 ↗'}</span></span></button>`}).join('')}</section>
 ${last?`<div class="resume"><div><p><b>${last.finishedAt?'上次学习记录':'继续上次的学习'}</b> · ${esc(last.title)}</p><small>${last.finishedAt?'已完成，可查看复盘':`已${last.mode==='cards'?'翻卡':'作答'} ${last.mode==='cards'?Object.values(last.viewed).filter(Boolean).length:Object.keys(last.answers).length} / ${last.ids.length} 题`}${last.mode==='exam'&&!last.finishedAt?' · 计时按实际时间继续，离开页面不暂停':''}</small></div><button class="btn secondary" data-action="resume">${last.finishedAt?'查看复盘':'继续学习'} →</button></div>`:''}
 <section class="mode-panel"><div><h3>先选一种学习节奏</h3><div class="mode-controls" role="radiogroup" aria-label="学习模式">${[['learn','逐题练习'],['exam','计时挑战'],['cards','学习翻卡']].map(([id,label])=>`<label><input type="radio" name="mode" value="${id}" ${mode===id?'checked':''}><span>${label}</span></label>`).join('')}</div><p id="mode-note" class="small muted">${modeDescription()}</p></div><button class="btn" data-action="start" data-track="all">开始${v.name} ${activeBank.length} 题 <span>↗</span></button></section>
 <div class="section-head"><h2>${v.name} · ${v.title}</h2><span class="caption">VOL. ${v.number} / ${activeBank.length} QUESTIONS</span></div><section class="grid" aria-label="专题题库">${TRACKS.map(t=>{const qs=selectQuestions(BANK,activeVolume,t.id),count=qs.filter(q=>library.history[q.id]?.attempts>0).length;return `<article class="track"><div class="number">VOL. ${v.number} — ${t.color}</div><h3>${t.name}</h3><span class="small">${t.label}</span><p>${t.desc}</p><div class="track-bottom"><span>${qs.length} 题 · 已练 ${count}/${qs.length}</span><button class="track-start" data-action="start" data-track="${t.id}" aria-label="开始 ${t.name} 专题">开始学习 ↗</button></div></article>`}).join('')}<article class="series-note"><span class="micro muted">BUILD YOUR KNOWLEDGE</span><h3>练习 → 理解 → 再应用</h3><p>每题配有解析与一句记忆点。五个标签表示参考方向，知识点会彼此交叉。</p><p style="margin-top:14px">本辑已练 <b>${done} / ${activeBank.length}</b><br>两辑合计已练 <b>${studiedIds().length} / ${BANK.length}</b></p></article></section>
 <section class="tools" aria-label="个人复习"><button class="btn secondary" data-action="wrong" ${wrong?'':'disabled'}>跨辑错题 <span>${wrong}</span></button><button class="btn secondary" data-action="starred" ${library.starred.length?'':'disabled'}>跨辑收藏 <span>${library.starred.length}</span></button><small>错题与收藏包含两辑。答对后从错题本移除；收藏一直保留。${storageOK?'进度自动保存于本机，不跨设备同步。':'本浏览器存储不可用，刷新可能丢失进度。'}</small></section>
 <details><summary>关于题库、参考资料与学习记录</summary><p style="margin-top:15px">本系列参考五项认证的官方公开学习领域编写，题目、场景和解析为原创；不属于官方真题、授权教材或等比例模拟考试。成绩仅反映本套练习表现，不能预测认证考试通过率。适用于教练学习，不替代个体健康评估或医疗建议。</p><div class="sources">${Object.values(SOURCES).map(s=>`<div><a href="${s.url}" target="_blank" rel="noopener">${s.name} ↗</a></div>`).join('')}</div><p>本次题库更新：2026-10-27；参考大纲于2026-10-26核对。两辑各 60 题，每辑五方向各 12 题。第一辑为基础巩固，第二辑为训练应用与案例，不复现官方考试权重。</p><p>练习模式：提交后显示答案，不改写首次作答；计时挑战：每辑 45 分钟，单专题 9 分钟，到时自动交卷；翻卡模式：先回忆，再查看知识卡，不计正确率。15 分钟复盘为建议时长，不强制倒计时。</p><p>本页不使用账号或追踪服务。练习答案、错题、收藏与最近一次学习保存在此浏览器。清除浏览器数据会丢失记录；隐私模式可能无法保存。</p><div class="actions"><button class="btn secondary" data-action="export-library">导出学习记录</button><button class="btn text" data-action="clear">清除本机学习记录</button></div></details>`;
}
function modeDescription(){return {learn:'每题提交后看解析，按自己的节奏学习。',exam:'每辑限时 45 分钟，交卷后统一看解析；离开页面不暂停。',cards:'先思考，再翻开答案与记忆点；不评分、不计入已练题数。'}[mode];}
function start(ids,title,selectedMode=mode){
 if(!ids.length){toast('当前没有可复习的题目。');return;}
 session=createSession(shuffle(ids),selectedMode,title);const volume=sessionVolume(session,BANK);if(volumeInfo(volume))activeVolume=volume;save();renderStudy();focusContent();
}
function toggleStar(id){library.starred=library.starred.includes(id)?library.starred.filter(x=>x!==id):[...library.starred,id];save();}
function record(q,answer){
 const h=library.history[q.id]||{attempts:0};
 library.history[q.id]={attempts:(+h.attempts||0)+1,wrong:answer!==q.answer,lastAnswer:answer,updatedAt:Date.now()};
}
function answerCurrent(){
 const q=find(session.ids[session.index]);
 if(session.answers[q.id]===undefined){toast('先选择一个答案。');return;}
 if(session.checked[q.id])return;
 session.checked[q.id]=true;record(q,session.answers[q.id]);save();renderStudy();
}
function currentDone(id){return session.mode==='cards'?session.viewed[id]:session.answers[id]!==undefined;}
function renderStudy(){
 clearInterval(timer);timer=null;
 if(session.finishedAt){renderResult();return;}
 if(session.mode==='exam'&&remaining(session)===0){finish(true);return;}
 const q=find(session.ids[session.index]), a=session.answers[q.id], checked=session.checked[q.id], star=library.starred.includes(q.id), flag=session.flags.includes(q.id);
 const n=session.ids.filter(currentDone).length;
 $('app').innerHTML=`<div class="study-head"><div><div class="eyebrow">${volumeInfo(sessionVolume(session,BANK))?`VOL. ${volumeInfo(sessionVolume(session,BANK)).number}`:'跨辑复习'} / ${session.mode==='exam'?'TIMED CHALLENGE':session.mode==='cards'?'LEARNING CARDS':'PRACTICE'}</div><h1>${esc(session.title)}</h1></div><button class="btn secondary" data-action="home">保存并返回 ↗</button></div><div class="study-layout"><section class="study-main"><article class="question-card"><div class="question-meta"><span class="pill">${volumeInfo(questionVolume(q)).name} · ${trackName(q.track)} · ${esc(q.topic)}</span><span class="micro muted">${String(session.index+1).padStart(2,'0')} / ${session.ids.length} · ${q.level}</span></div>
 ${session.mode==='cards'?`<div class="flashcard"><span class="micro muted">先回忆，再翻卡</span>${session.revealed[q.id]?`<span class="micro">答案 ${'ABCD'[q.answer]} · ${esc(q.options[q.answer])}</span><div class="reveal-text">${esc(q.takeaway)}</div>`:`<h2>${esc(q.question)}</h2><div class="small muted">${q.options.map((o,i)=>`${'ABCD'[i]} · ${esc(o)}`).join('<br>')}</div>`}<button class="btn secondary" data-action="flip">${session.revealed[q.id]?'收起知识卡 ↶':'翻开答案与记忆点 ↗'}</button></div>${session.revealed[q.id]?`<div class="explanation"><h3>展开理解</h3><p>${esc(q.explanation)}</p>${sourceLink(q)}</div>`:''}`:
 `<h2 id="question-title">${esc(q.question)}</h2><div class="options" role="group" aria-labelledby="question-title">${q.options.map((o,i)=>`<button class="option ${a===i?'selected':''} ${checked&&session.mode==='learn'?(i===q.answer?'correct':a===i?'wrong':''):''}" data-action="answer" data-answer="${i}" aria-pressed="${a===i}" ${checked&&session.mode==='learn'?'disabled':''}><span class="letter">${'ABCD'[i]}</span><span>${esc(o)}${checked&&session.mode==='learn'?(i===q.answer?' ✓ 正确答案':a===i?' × 你的选择':''):''}</span></button>`).join('')}</div>
 ${session.mode==='learn'&&checked?`<section class="explanation" aria-live="polite"><h3>${a===q.answer?'✓ 判断正确':'再理解一次'} · 正确答案 ${'ABCD'[q.answer]}</h3><p>${esc(q.explanation)}</p><p class="takeaway">记忆点 / ${esc(q.takeaway)}</p>${sourceLink(q)}</section>`:''}`}
 <div class="actions">${session.mode==='learn'&&!checked?`<button class="btn" data-action="check" ${a===undefined?'disabled':''}>提交本题，看解析 →</button>`:''}<button class="btn secondary" data-action="star" aria-pressed="${star}">${star?'★ 已收藏':'☆ 收藏卡片'}</button>${session.mode!=='cards'?`<button class="btn text" data-action="flag" aria-pressed="${flag}">${flag?'● 已标记，稍后再看':'标记，稍后再看'}</button>`:''}</div></article><div class="nav-actions"><button class="btn secondary" data-action="prev" ${session.index===0?'disabled':''}>← 上一题</button>${session.index===session.ids.length-1?'<button class="btn" data-action="finish">结束本次学习 ↗</button>':'<button class="btn" data-action="next">下一题 →</button>'}</div></section>
 <aside class="study-aside"><div class="aside-top"><span class="micro muted">${session.mode==='exam'?'剩余答题时间':'你的学习进度'}</span>${session.mode==='exam'?'<div id="timer" class="timer"></div>':`<div class="timer">${n}<span class="small muted"> / ${session.ids.length}</span></div>`}</div><div class="progress-bar"><span style="width:${n/session.ids.length*100}%"></span></div><div class="aside-bottom"><p class="small muted">${session.mode==='cards'?'已翻卡':'已作答'} ${n} · ${session.mode==='cards'?'待翻卡':'未答'} ${session.ids.length-n}</p><button class="btn secondary" data-action="finish">${session.mode==='exam'?'交卷并复盘':'结束并复盘'}</button></div><details class="question-navigation"><summary>展开题号 / 查看标记</summary><div class="qnav" aria-label="题目导航">${session.ids.map((id,i)=>`<button data-action="jump" data-index="${i}" class="${currentDone(id)?'done':''} ${i===session.index?'current':''} ${session.flags.includes(id)?'flagged':''}" aria-label="第 ${i+1} 题${currentDone(id)?'，已作答':''}${session.flags.includes(id)?'，已标记':''}" ${i===session.index?'aria-current="step"':''}>${i+1}</button>`).join('')}</div><p class="legend">浅绿：已作答 / 已翻卡　圆点：已标记</p></details><p class="saved-note">${session.mode==='exam'?'计时按实际时间继续，刷新或离开不暂停。':session.mode==='cards'?'翻卡不评分，可随时回看。':'提交后锁定本题答案，便于记录真实掌握情况。'}<br>${storageOK?'进度自动保存在当前浏览器。':'本浏览器存储不可用，请保持页面打开。'}</p></aside></div>`;
 if(session.mode==='exam'){tick();timer=setInterval(tick,1000);}
}
function tick(){if(!session||session.finishedAt)return;const r=remaining(session);if(!r){finish(true);return;}const t=$('timer');if(t){t.textContent=`${String(Math.floor(r/60)).padStart(2,'0')}:${String(r%60).padStart(2,'0')}`;t.classList.toggle('urgent',r<=60);}}
function ask(title,body,ok,callback){$('dialog-title').textContent=title;$('dialog-body').textContent=body;$('dialog-ok').textContent=ok;pendingConfirm=callback;$('confirm-dialog').showModal();}
function requestFinish(){
 const unanswered=session.ids.filter(id=>session.answers[id]===undefined).length;
 const unchecked=session.ids.filter(id=>session.answers[id]!==undefined&&!session.checked[id]).length;
 ask(session.mode==='cards'?'结束本次翻卡？':'交卷并复盘？',session.mode==='cards'?'查看本次翻卡小结，你可以稍后继续复习收藏卡片。':`还有 ${unanswered} 题未答${session.mode==='learn'&&unchecked?`、${unchecked} 题已选未提交（交卷时计入）`:''}。交卷后锁定本次答案，未答题不计为正确。`,'结束并查看复盘',()=>finish(false));
}
function finish(expired){
 $('confirm-dialog').close();pendingConfirm=null;
 if(!session||session.finishedAt)return;
 clearInterval(timer);timer=null;
 if(session.mode!=='cards')for(const id of session.ids){const q=find(id);if(session.answers[id]!==undefined&&!session.checked[id]){record(q,session.answers[id]);session.checked[id]=true;}}
 session.finishedAt=Date.now();session.expired=expired;save();renderResult();focusContent();
}
function renderResult(){
 const r=grade(session,BANK), cards=session.mode==='cards', missed=[...r.wrong,...r.unanswered];
 const viewed=session.ids.filter(id=>session.viewed[id]).length;
 $('app').innerHTML=`<div class="eyebrow">LEARN. APPLY. REPEAT. / 本次复盘</div><div class="study-head"><h1>${esc(session.title)} · ${cards?'翻卡小结':'练习报告'}</h1><button class="btn secondary" data-action="home">返回题库 ↗</button></div><section class="result-banner"><div class="result-score">${cards?viewed:r.correct}<small> / ${r.total} ${cards?'已翻卡':'答对'}</small></div><div><h2>${cards?'记住之后，再试着判断。':r.correct===r.total?'这一轮，判断清晰。':'让不确定，变成下一次的把握。'}</h2><p>${cards?'翻卡只记录回忆过程，不生成正确率。':`正确率 ${Math.round(r.correct/r.total*100)}% · 错答 ${r.wrong.length} 题 · 未答 ${r.unanswered.length} 题${session.expired?' · 时间到，已自动交卷':''}`}</p><p>建议再留 ${Math.max(3,Math.round(r.total/4))} 分钟，回看解析与记忆点。成绩仅针对本套练习。</p></div></section>
 ${cards?'':`<div class="result-tracks">${Object.entries(r.tracks).map(([id,t])=>`<div class="result-track">${trackName(id)}<b>${t.correct}<span class="small muted"> / ${t.total}</span></b><span class="small muted">${t.correct<t.total?'可以继续巩固':'本轮全部答对'}</span></div>`).join('')}</div>`}
 <div class="result-tools">${cards?'<button class="btn" data-action="practice-again">用这组题练习 →</button>':`<button class="btn" data-action="retry" ${missed.length?'':'disabled'}>重练错题与未答 ${missed.length} →</button>`}<button class="btn secondary" data-action="export-result">导出本次复盘</button><button class="btn secondary" data-action="start" data-track="all" data-volume="${sessionVolume(session,BANK)}">${sessionVolume(session,BANK)==='mixed'?'练习'+volumeInfo(activeVolume).name:'再练本辑'}</button></div>
 <div class="section-head"><h2>逐题回看</h2><span class="caption">${session.ids.length} KNOWLEDGE CARDS</span></div>${session.ids.map((id,i)=>{const q=find(id),a=session.answers[id],right=a===q.answer;return `<details class="review-row" ${!cards&&!right?'open':''}><summary><span class="badge ${right?'ok':''}">${cards?(session.viewed[id]?'已翻卡':'未翻卡'):(a===undefined?'未答':right?'正确':'错答')}</span>${i+1}. <span class="muted">[${volumeInfo(questionVolume(q)).name}]</span> ${esc(q.question)}</summary>${cards?'':`<p class="muted">你的选择：${a===undefined?'未作答':`${'ABCD'[a]} · ${esc(q.options[a])}`}</p>`}<p><b>正确答案 ${'ABCD'[q.answer]} · ${esc(q.options[q.answer])}</b></p><p>${esc(q.explanation)}</p><p class="takeaway">记忆点 / ${esc(q.takeaway)}</p>${sourceLink(q)}<div class="actions"><button class="btn secondary" data-action="review-star" data-id="${id}" aria-pressed="${library.starred.includes(id)}">${library.starred.includes(id)?'★ 已收藏':'☆ 收藏卡片'}</button></div></details>`}).join('')}`;
}
function download(filename,text,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportResult(){
 const r=grade(session,BANK),cards=session.mode==='cards';
 const lines=[`# HERACLES LAB · ${session.title}`,`日期：${new Date(session.finishedAt).toLocaleDateString('zh-CN')}`,cards?'学习翻卡，不计成绩。':`答对 ${r.correct}/${r.total}；错答 ${r.wrong.length}；未答 ${r.unanswered.length}。`,'',...session.ids.flatMap((id,i)=>{const q=find(id),a=session.answers[id];return [`## ${i+1}. [${volumeInfo(questionVolume(q)).name} · ${trackName(q.track)}] ${q.question}`,...q.options.map((o,n)=>`${'ABCD'[n]}. ${o}`),cards?'':`我的答案：${a===undefined?'未答':'ABCD'[a]}`,`正确答案：${'ABCD'[q.answer]}`,q.explanation,`记忆点：${q.takeaway}`,`参考领域：${SOURCES[q.source].url}`,''];})];
 download('HERACLES-学习复盘.md',lines.join('\n'));
}
document.addEventListener('change',e=>{if(e.target.name==='mode'){mode=e.target.value;$('mode-note').textContent=modeDescription();}});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const action=b.dataset.action;
 if(action==='volume'){if(volumeInfo(b.dataset.volume)){activeVolume=b.dataset.volume;save();home();restoreFocus('[data-action=volume][data-volume='+activeVolume+']');}return;}
 if(action==='home'){save();home();focusContent();return;}
 if(action==='start'){
  const track=b.dataset.track,volume=volumeInfo(b.dataset.volume)?b.dataset.volume:activeVolume,v=volumeInfo(volume);const ids=selectQuestions(BANK,volume,track).map(q=>q.id);const title=`${v.name} · ${track==='all'?v.title:trackName(track)+'专题'}`;
  if(library.last&&!library.last.finishedAt){ask('开始新一轮学习？','新一轮会替换最近一次学习进度；已记录的错题和收藏仍保留。','开始新一轮',()=>start(ids,title));}else start(ids,title);return;
 }
 if(action==='resume'){session=library.last;const volume=sessionVolume(session,BANK);if(volumeInfo(volume))activeVolume=volume;renderStudy();focusContent();return;}
 if(action==='wrong'||action==='starred'){const ids=action==='wrong'?wrongIds():library.starred;const title=action==='wrong'?'错题巩固':'收藏卡片';if(library.last&&!library.last.finishedAt)ask('切换到复习？','这会替换最近一次学习进度；已记录的错题和收藏仍保留。','开始复习',()=>start(ids,title,action==='starred'?'cards':'learn'));else start(ids,title,action==='starred'?'cards':'learn');return;}
 if(action==='export-library'){download('HERACLES-学习记录.json',JSON.stringify(library,null,2),'application/json');return;}
 if(action==='clear'){ask('清除本机学习记录？','将删除本浏览器里的答题进度、错题和收藏。建议先导出学习记录。','确认清除',()=>{library={version:1,history:{},starred:[],last:null,activeVolume};session=null;save();home();toast('已清除本机记录。');});return;}
 if(!session)return;
 if(session.mode==='exam'&&!session.finishedAt&&remaining(session)===0){finish(true);toast('时间已到，已按现有答案交卷。');return;}
 const q=find(session.ids[session.index]);
 if(action==='answer'&&!session.finishedAt&&!(session.mode==='learn'&&session.checked[q.id])){session.answers[q.id]=+b.dataset.answer;save();renderStudy();restoreFocus('[data-answer="'+b.dataset.answer+'"]');return;}
 if(action==='check'){answerCurrent();const el=document.querySelector('.explanation');el?.setAttribute('tabindex','-1');el?.focus({preventScroll:true});return;}
 if(action==='star'){toggleStar(q.id);renderStudy();restoreFocus('[data-action=star]');return;}
 if(action==='review-star'){toggleStar(b.dataset.id);b.textContent=library.starred.includes(b.dataset.id)?'★ 已收藏':'☆ 收藏卡片';b.setAttribute('aria-pressed',library.starred.includes(b.dataset.id));return;}
 if(action==='flag'){session.flags=session.flags.includes(q.id)?session.flags.filter(id=>id!==q.id):[...session.flags,q.id];save();renderStudy();restoreFocus('[data-action=flag]');return;}
 if(action==='flip'){session.revealed[q.id]=!session.revealed[q.id];session.viewed[q.id]=true;save();renderStudy();restoreFocus('[data-action=flip]');return;}
 if(['next','prev','jump'].includes(action)){session.index=action==='next'?Math.min(session.ids.length-1,session.index+1):action==='prev'?Math.max(0,session.index-1):+b.dataset.index;save();renderStudy();if(action!=='jump')focusContent();return;}
 if(action==='finish'){requestFinish();return;}
 if(action==='retry'){const r=grade(session,BANK);start([...r.wrong,...r.unanswered],'错题与未答 · 巩固练习','learn');return;}
 if(action==='practice-again'){start(session.ids,'翻卡之后 · 回忆练习','learn');return;}
 if(action==='export-result')exportResult();
});
$('home-nav').onclick=()=>{save();home();focusContent();};
$('dialog-cancel').onclick=()=>{$('confirm-dialog').close();pendingConfirm=null;};
$('dialog-ok').onclick=()=>{const cb=pendingConfirm;pendingConfirm=null;$('confirm-dialog').close();cb?.();};
$('confirm-dialog').addEventListener('cancel',()=>{pendingConfirm=null;});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&session?.mode==='exam'&&!session.finishedAt)tick();});
window.addEventListener('pagehide',save);
home();
