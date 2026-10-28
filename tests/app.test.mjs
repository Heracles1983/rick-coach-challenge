import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createSession} from '../quiz-series/core.mjs';

const sandbox={window:{}};
vm.runInNewContext(readFileSync(new URL('../quiz-series/questions.js',import.meta.url),'utf8'),sandbox);
const bank=JSON.parse(JSON.stringify(sandbox.window.QUESTION_BANK));
const KEY='heracles-quiz-series-v1';
let instance=0;

// Exercise real application event handlers without a browser or network.
// The small DOM surface records markup, focus and dialogs; it does not test CSS layout.
async function mount(saved=null,{search='',blocked=false}={}) {
 const listeners={},elements=new Map(),store=new Map(saved?[[KEY,JSON.stringify(saved)]]:[]);
 let focused=null;
 const element=id=>{
  if(!elements.has(id))elements.set(id,{
   innerHTML:'',textContent:'',open:false,attrs:{},
   classList:{add(){},remove(){},toggle(){}},
   focus(){focused=id;},setAttribute(k,v){this.attrs[k]=v;},
   showModal(){this.open=true;},close(){this.open=false;},
   addEventListener(){},
  });
  return elements.get(id);
 };
 globalThis.document={getElementById:element,querySelector:element,
  addEventListener(name,fn){listeners[name]=fn;}};
 globalThis.window={QUESTION_BANK:bank,scrollTo(){},addEventListener(){}};
 globalThis.location={search};
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem(k,v){if(blocked)throw Error('storage unavailable');store.set(k,v);}};
 const originalInterval=globalThis.setInterval;
 globalThis.setInterval=()=>0;
 try {await import(`../quiz-series/app.mjs?app-test=${++instance}`);}
 finally {globalThis.setInterval=originalInterval;}
 const click=(action,data={})=>{
  const savedInterval=globalThis.setInterval;
  globalThis.setInterval=()=>0;
  try{listeners.click({target:{closest(){return {dataset:{action,...data},disabled:false};}}});}
  finally{globalThis.setInterval=savedInterval;}
 };
 return {click,element,html:()=>element('app').innerHTML,
  state:()=>JSON.parse(store.get(KEY)||'null'),
  confirm:()=>element('dialog-ok').onclick(),
  mode(value){listeners.change({target:{name:'mode',value}});},
  focus:()=>focused,
 };
}

test('homepage defaults to new volume; query selection and saved selection remain usable',async()=>{
 const app=await mount();
 assert.match(app.html(),/两辑共 120 道/);
 assert.match(app.html(),/开始第二辑 60 题/);
 assert.equal(app.state().activeVolume,'vol2');
 app.click('volume',{volume:'vol1'});
 assert.match(app.html(),/开始第一辑 60 题/);
 assert.equal(app.state().activeVolume,'vol1');
 const deepLink=await mount(app.state(),{search:'?volume=vol2'});
 assert.equal(deepLink.state().activeVolume,'vol2');
 assert.match(deepLink.html(),/开始第二辑 60 题/);
});

test('switching volumes preserves a legacy attempt, its deadline, wrong answers and stars',async()=>{
 const old=bank.filter(q=>q.volume==='vol1');
 const session=createSession(old.map(q=>q.id),'exam','五方向 · 综合基础卷');
 session.answers[old[0].id]=old[0].answer;
 const saved={version:1,history:{[old[1].id]:{attempts:1,wrong:true}},starred:[old[1].id],last:session};
 const app=await mount(saved);
 assert.equal(app.state().last.deadline,session.deadline);
 app.click('volume',{volume:'vol2'});
 assert.deepEqual(app.state().last,session);
 assert.deepEqual(app.state().starred,saved.starred);
 app.click('resume');
 assert.match(app.html(),/VOL. 01/);
 assert.equal(app.state().history[old[1].id].wrong,true);
 app.click('home');
 assert.equal(app.state().activeVolume,'vol1');
 app.click('start',{track:'cscs',volume:'vol2'});
 assert.equal(app.element('confirm-dialog').open,true);
 assert.deepEqual(app.state().last.ids,session.ids,'new session waits for explicit replacement');
 app.confirm();
 assert.equal(app.state().last.ids.length,12);
 assert.ok(app.state().last.ids.every(id=>id.startsWith('v2-cscs-')));
 assert.deepEqual(app.state().starred,saved.starred);
});

test('each volume starts only its own 60 questions with a 45 minute exam deadline',async()=>{
 for(const volume of ['vol1','vol2']){
  const app=await mount(null,{search:'?volume='+volume});
  app.mode('exam');app.click('start',{track:'all'});
  const s=app.state().last;
  assert.equal(s.ids.length,60);
  assert.equal(s.deadline-s.startedAt,45*60*1000);
  assert.ok(s.ids.every(id=>bank.find(q=>q.id===id).volume===volume));
  assert.doesNotMatch(app.html(),/正确答案/);
 }
});

test('new-volume answer submission records one attempt, then correct retry clears its wrong status',async()=>{
 const app=await mount();app.click('start',{track:'acsm'});
 const id=app.state().last.ids[0],q=bank.find(q=>q.id===id);
 app.click('answer',{answer:String((q.answer+1)%4)});app.click('check');
 assert.equal(app.state().history[id].attempts,1);
 assert.equal(app.state().history[id].wrong,true);
 app.click('check');assert.equal(app.state().history[id].attempts,1);
 app.click('finish');app.confirm();
 assert.match(app.html(),/错答 1 题 · 未答 11 题/);
 app.click('retry');
 const ids=app.state().last.ids;
 app.click('jump',{index:String(ids.indexOf(id))});
 app.click('answer',{answer:String(q.answer)});app.click('check');
 assert.equal(app.state().history[id].attempts,2);
 assert.equal(app.state().history[id].wrong,false);
});

test('mixed-volume wrong and starred sessions retain volume labels and question identities',async()=>{
 const one=bank.find(q=>q.volume==='vol1'),two=bank.find(q=>q.volume==='vol2');
 const saved={version:1,history:{[one.id]:{attempts:1,wrong:true},[two.id]:{attempts:1,wrong:true}},starred:[one.id,two.id],last:null};
 const app=await mount(saved);app.click('wrong');
 assert.deepEqual(new Set(app.state().last.ids),new Set([one.id,two.id]));
 assert.match(app.html(),/跨辑复习/);
 app.click('home');app.click('starred');app.confirm();
 app.click('flip');app.click('flip');
 assert.equal(Object.values(app.state().last.viewed).filter(Boolean).length,1);
 app.click('finish');app.confirm();
 assert.match(app.html(),/\[第一辑\]/);assert.match(app.html(),/\[第二辑\]/);
 assert.match(app.html(),/不生成正确率/);
});

test('expired saved exams submit once on resume and can still be reviewed',async()=>{
 const qs=bank.filter(q=>q.volume==='vol2');
 const s=createSession(qs.map(q=>q.id),'exam','第二辑 · 训练应用与案例',Date.now()-3600000);
 s.answers[qs[0].id]=qs[0].answer;
 const app=await mount({version:1,history:{},starred:[],last:s});
 app.click('resume');
 assert.match(app.html(),/时间到，已自动交卷/);
 assert.ok(app.state().last.finishedAt);
 assert.equal(app.state().history[qs[0].id].attempts,1);
 app.click('home');app.click('resume');
 assert.equal(app.state().history[qs[0].id].attempts,1);
});

test('practice remains available when browser storage is blocked',async()=>{
 const app=await mount(null,{blocked:true});
 assert.match(app.html(),/存储不可用/);
 app.click('start',{track:'ace'});
 app.click('answer',{answer:'0'});app.click('check');
 assert.match(app.html(),/正确答案/);
});
