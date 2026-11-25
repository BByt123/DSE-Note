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
 await page.locator('input[name="quiz-answer"]').first().check();
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
 await page.locator('input[name="quiz-answer"]').first().check();
 assert.equal(await page.locator('[data-action="ai-start"]').isVisible(),false);
 await page.locator('[data-action="finish-quiz"]').click();
 await page.locator('[data-action="ai-start"]').waitFor({state:'visible'});

 await page.goto(new URL('economics.html#settings',origin).href,{waitUntil:'domcontentloaded'});
 await page.locator('.ai-settings-section').waitFor();
 assert.match(await page.locator('#deepseek-key-status').innerText(),/saved on this device/i);
 await configureQuiz('Economics','MC','exercise');
 await page.locator('input[name="quiz-answer"]').first().check();
 await page.locator('[data-action="ai-start"]').click();
 await page.locator('.ai-chat-message.assistant').waitFor();
 call=await page.evaluate(()=>window.__deepseekCalls.at(-1));
 assert.match(call.messages[0].content,/HKDSE Economics/);

 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.equal(await page.locator('.ai-tutor').isVisible(),true);
 assert.ok(await page.locator('.quiz-question').evaluate(element=>element.getBoundingClientRect().width>300));
 await page.locator('.ai-tutor').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/deepseek-economics-mobile.png',animations:'disabled'});
 assert.deepEqual(errors,[]);
 console.log('DeepSeek tutor settings, exam and exercise flows passed in both subjects.');
}finally{
 await browser.close();
}
