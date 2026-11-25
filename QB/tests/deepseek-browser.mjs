import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const origin=process.env.TEST_URL||'http://127.0.0.1:4174/';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const context=await browser.newContext({viewport:{width:1280,height:960}});
const page=await context.newPage();
page.setDefaultTimeout(12000);
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')console.error('Browser console:',message.text());});
await page.addInitScript(()=>{
 localStorage.setItem('dse-study-deepseek-api-key','sk-browser-test-key');
 const originalFetch=window.fetch.bind(window);
 window.__deepseekCalls=[];
 window.fetch=(input,options)=>{
  const url=typeof input==='string'?input:input.url;
  if(url==='https://api.deepseek.com/chat/completions'){
   window.__deepseekCalls.push(JSON.parse(options.body));
   return Promise.resolve(new Response(JSON.stringify({choices:[{message:{content:'This HKDSE explanation follows the supplied answer and marking scheme.'}}]}),{status:200,headers:{'Content-Type':'application/json'}}));
  }
  return originalFetch(input,options);
 };
});

async function configureQuiz(subject,type,mode){
 const quizStorage=subject==='Biology'?'biology-quiz-v1':'economics-quiz-v1';
 await page.evaluate(key=>localStorage.removeItem(key),quizStorage);
 await context.clearCookies();
 await page.goto(new URL(subject==='Biology'?'biology-index.html#library':'economics.html#library',origin).href,{waitUntil:'domcontentloaded'});
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('[data-action="quiz-config"]').first().click();
 const form=page.locator('[data-form="quiz"]');
 await form.locator('[name="type"]').selectOption(type);
 await form.locator('[name="mode"]').selectOption(mode);
 await form.locator('[name="count"]').fill('1');
 await form.locator('button[type="submit"]').click();
 try{await page.locator('.quiz-question-heading').waitFor();}
 catch(error){console.error(subject,await page.url(),await page.locator('#app').innerText().catch(()=>''),errors);throw error;}
}

async function selectWrongAnswer(subject){
 const correctAnswer=await page.evaluate(async storageKey=>{
  const quiz=JSON.parse(localStorage.getItem(storageKey));
  const paths=storageKey==='economics-quiz-v1'?['bank/economics/index.json']:['bank/index.json','bank/oxford/questions.json'];
  const banks=await Promise.all(paths.map(async path=>await(await fetch(path)).json()));
  return banks.flatMap(bank=>bank.questions).find(question=>question.id===quiz.ids[0]).answer;
 },subject==='Economics'?'economics-quiz-v1':'biology-quiz-v1');
 const wrongAnswer=correctAnswer==='A'?'B':'A';
 await page.locator(`input[name="quiz-answer"][value="${wrongAnswer}"]`).check();
}

try{
 await page.goto(new URL('biology-index.html#settings',origin).href,{waitUntil:'domcontentloaded'});
 await page.locator('.ai-settings-section').waitFor();
 assert.match(await page.locator('#deepseek-key-status').innerText(),/saved on this device/i);
 assert.equal(await page.locator('#deepseek-api-key').getAttribute('type'),'password');
 await page.locator('[data-action="toggle-ai-key-visibility"]').click();
 assert.equal(await page.locator('#deepseek-api-key').getAttribute('type'),'text');
 await page.locator('[data-action="clear-ai-key"]').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('dse-study-deepseek-api-key')),null);
 await page.locator('#deepseek-api-key').fill('sk-browser-test-key');
 await page.getByRole('button',{name:'Save key'}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('dse-study-deepseek-api-key')),'sk-browser-test-key');

 await configureQuiz('Biology','MC','exercise');
 await selectWrongAnswer('Biology');
 const biologyWrongId=await page.evaluate(()=>JSON.parse(localStorage.getItem('biology-quiz-v1')).ids[0]);
 await page.locator('[data-action="add-wrong-answer-to-paper"]').waitFor();
 let biologyLibrary=await page.evaluate(()=>JSON.parse(localStorage.getItem('biology-bank-v1')));
 assert.ok(biologyLibrary.bookmarks.includes(biologyWrongId));
 assert.ok(biologyLibrary.collections.some(collection=>collection.name==='Mistake notebook'&&collection.ids.includes(biologyWrongId)));
 await page.locator('[data-action="add-wrong-answer-to-paper"]').click();
 biologyLibrary=await page.evaluate(()=>JSON.parse(localStorage.getItem('biology-bank-v1')));
 assert.ok(biologyLibrary.selected.includes(biologyWrongId));
 assert.equal(await page.locator('[data-action="add-wrong-answer-to-paper"]').textContent(),'Wrong answer added');
 await page.getByRole('button',{name:/Ask AI for explanation/}).click();
 await page.locator('.ai-chat-message.assistant').waitFor();
 let call=await page.evaluate(()=>window.__deepseekCalls.at(-1));
 assert.match(call.messages[0].content,/HKDSE Biology/);
 assert.match(call.messages[1].content,/why the keyed answer is correct/);
 await page.locator('[data-form="ai-chat"] textarea').fill('Why does this distractor not fit?');
 await page.locator('[data-form="ai-chat"] button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.ai-chat-message.assistant').length===2);
 call=await page.evaluate(()=>window.__deepseekCalls.at(-1));
 assert.equal(call.messages.at(-1).content,'Why does this distractor not fit?');
 await page.reload();
 await page.locator('.ai-chat-message.assistant').nth(1).waitFor();
 await page.locator('[data-action="finish-quiz"]').click();
 await page.locator('.quiz-score [data-action="open-collection"][data-id="mistake-notebook"]').waitFor();
 await page.locator('.quiz-score [data-action="open-collection"][data-id="mistake-notebook"]').click();
 await page.waitForFunction(()=>document.querySelector('main h1')?.textContent==='Mistake notebook');
 assert.equal(await page.locator('main h1').textContent(),'Mistake notebook');
 assert.equal(await page.locator('[data-action="edit-collection"]').count(),0);
 await page.locator('[data-view="saved"]').click();
 await page.locator('#add-saved-category').click();
 await page.locator('[data-form="collection"] [name="name"]').fill('Biology labels');
 await page.locator('[data-form="collection"] button[type="submit"]').click();
 await page.locator('[data-action="open-collection"]').filter({hasText:'Biology labels'}).waitFor();

 await configureQuiz('Biology','Essay','exercise');
 await page.locator('#written-answer').waitFor();
 assert.equal(await page.locator('.ai-tutor').isVisible(),true);
 await page.locator('[data-action="ai-start"]').click();
 await page.locator('.ai-chat-message.assistant').waitFor();
 call=await page.evaluate(()=>window.__deepseekCalls.at(-1));
 assert.match(call.messages[1].content,/step by step/);
 assert.match(call.messages[1].content,/marking scheme/i);
 await page.locator('[data-form="ai-chat"] textarea').fill('How can I gain the marks?');
 await page.locator('[data-form="ai-chat"] button[type="submit"]').click();
 await page.waitForFunction(()=>document.querySelectorAll('.ai-chat-message.assistant').length===2);

 await configureQuiz('Biology','MC','exam');
 await selectWrongAnswer('Biology');
 assert.equal(await page.locator('[data-action="ai-start"]').isVisible(),false);
 await page.locator('[data-action="finish-quiz"]').click();
 await page.locator('[data-action="ai-start"]').waitFor({state:'visible'});
 const biologyExamId=await page.evaluate(()=>JSON.parse(localStorage.getItem('biology-quiz-v1')).ids[0]);
 biologyLibrary=await page.evaluate(()=>JSON.parse(localStorage.getItem('biology-bank-v1')));
 assert.ok(biologyLibrary.bookmarks.includes(biologyExamId));
 assert.ok(biologyLibrary.collections.find(collection=>collection.name==='Mistake notebook').ids.includes(biologyExamId));

 await page.goto(new URL('economics.html#settings',origin).href,{waitUntil:'domcontentloaded'});
 await page.locator('.ai-settings-section').waitFor();
 assert.match(await page.locator('#deepseek-key-status').innerText(),/saved on this device/i);
 await configureQuiz('Economics','MC','exercise');
 await selectWrongAnswer('Economics');
 const economicsWrongId=await page.evaluate(()=>JSON.parse(localStorage.getItem('economics-quiz-v1')).ids[0]);
 await page.locator('[data-action="add-wrong-answer-to-paper"]').waitFor();
 let economicsLibrary=await page.evaluate(()=>JSON.parse(localStorage.getItem('economics-bank-v1')));
 assert.ok(economicsLibrary.bookmarks.includes(economicsWrongId));
 assert.ok(economicsLibrary.collections.some(collection=>collection.name==='Mistake notebook'&&collection.ids.includes(economicsWrongId)));
 await page.locator('[data-action="add-wrong-answer-to-paper"]').click();
 economicsLibrary=await page.evaluate(()=>JSON.parse(localStorage.getItem('economics-bank-v1')));
 assert.ok(economicsLibrary.selected.includes(economicsWrongId));
 await page.locator('[data-action="ai-start"]').click();
 await page.locator('.ai-chat-message.assistant').waitFor();
 call=await page.evaluate(()=>window.__deepseekCalls.at(-1));
 assert.match(call.messages[0].content,/HKDSE Economics/);

 await configureQuiz('Economics','MC','exam');
 await selectWrongAnswer('Economics');
 const economicsExamId=await page.evaluate(()=>JSON.parse(localStorage.getItem('economics-quiz-v1')).ids[0]);
 assert.equal(await page.locator('[data-action="ai-start"]').isVisible(),false);
 await page.locator('[data-action="finish-quiz"]').click();
 await page.locator('[data-action="ai-start"]').waitFor({state:'visible'});
 try{await page.locator('.quiz-score [data-action="open-collection"]').waitFor();}
 catch(error){console.error('Economics exam results',await page.locator('#app').innerText(),await page.evaluate(()=>({quiz:localStorage.getItem('economics-quiz-v1'),library:localStorage.getItem('economics-bank-v1')})));throw error;}
 const economicsAfterExam=await page.evaluate(()=>JSON.parse(localStorage.getItem('economics-bank-v1')));
 assert.ok(economicsAfterExam.bookmarks.includes(economicsExamId));
 assert.ok(economicsAfterExam.collections.find(collection=>collection.name==='Mistake notebook').ids.includes(economicsExamId));

 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.locator('.ai-tutor').isVisible(),true);
 assert.ok(await page.locator('.quiz-question').evaluate(element=>element.getBoundingClientRect().width>300));
 await page.locator('.ai-tutor').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/deepseek-economics-mobile.png',animations:'disabled'});
 assert.deepEqual(errors,[]);
 console.log('AI tutoring, mistake notebook, wrong-answer paper, saved categories, and quiz modes passed in both subjects.');
}finally{
 await browser.close();
}
