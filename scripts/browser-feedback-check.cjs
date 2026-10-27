const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
let checks = 0;
const assert = new Proxy(require('node:assert/strict'), {get(target, key) {const value = target[key]; return typeof value === 'function' ? (...args) => {value(...args); checks++;} : value;}});
async function main() {
 const {createServer} = await import('../server.mjs');
 const server = createServer({apiKey:'',model:'snapshot-model'});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser = await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || undefined, executablePath:process.env.BROWSER_EXECUTABLE || undefined});
 try {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('https://**/*',r=>r.abort());
 const page=await context.newPage();
 const errors=[]; page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{window.opened=[];window.open=(...args)=>window.opened.push(args);});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const open=()=>page.locator('.report-sentence').first().click();
 await open();
 assert.match(await page.locator('#feedback-body').inputValue(),/未调用模型/);
 assert.equal(await page.locator('#feedback-open').isDisabled(),true);
 await page.locator('#feedback-cancel').click();
 assert.equal(await page.evaluate(()=>window.opened.length),0);
 assert.equal(await page.locator('.report-sentence').first().evaluate(n=>n===document.activeElement),true);
 await open(); await page.keyboard.press('Escape');
 assert.equal(await page.locator('#feedback-dialog').isVisible(),false);
 assert.equal(await page.locator('.report-sentence').first().evaluate(n=>n===document.activeElement),true);
 await open();
 await page.locator('#feedback-title').fill('Edited &?#');
 await page.locator('#feedback-body').fill('<img src=x onerror=alert(1)> 中文 &?#');
 await page.locator('#feedback-consent').check(); await page.locator('#feedback-open').click();
 let url=new URL(await page.evaluate(()=>window.opened[0][0]));
 assert.equal(url.searchParams.get('title'),'Edited &?#');
 assert.equal(url.searchParams.get('body'),'<img src=x onerror=alert(1)> 中文 &?#');
 assert.equal(await page.locator('#feedback-dialog img').count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('#feedback-body').fill('长正文'.repeat(2500));
 assert.equal(await page.locator('#feedback-consent').isChecked(),false);
 assert.equal(await page.locator('#feedback-open').isDisabled(),true);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('blocked');}}}));
 await page.locator('#feedback-copy').click();
 assert.match(await page.locator('#feedback-message').innerText(),/自动复制失败/);
 assert.equal(await page.locator('#feedback-body').evaluate(n=>n.selectionEnd-n.selectionStart),7500);
 await page.locator('#feedback-consent').check(); await page.locator('#feedback-open').click();
 url=new URL(await page.evaluate(()=>window.opened[1][0])); assert.match(url.searchParams.get('body'),/粘贴/);
 assert.equal((await page.locator('#feedback-body').inputValue()).length,7500);
 await page.locator('#feedback-cancel').click();
 await page.locator('#english-input').fill('Go.'); await page.locator('#analyze-button').click();
 await page.locator('#report-failure').waitFor({state:'visible'}); await page.locator('#report-failure').click();
 assert.match(await page.locator('#feedback-body').inputValue(),/snapshot-model/);
 assert.match(await page.locator('#feedback-body').inputValue(),/未获得分析结果/);
 assert.ok((await page.locator('#feedback-body').inputValue()).includes('提示：'+await page.locator('#status').innerText()));
 await page.locator('#feedback-cancel').click(); await page.locator('#clear-button').click();
 assert.equal(await page.locator('#report-failure').isVisible(),false);
 assert.equal(await page.locator('#feedback-body').inputValue(),'');
 // Two independent sentence results: preview must not include another sentence.
 await page.route('**/api/analyze',r=>r.fulfill({json:{translation:'all',sentences:[{text:'Go.',translation:'走',segments:[{text:'Go.',role:'other'}]},{text:'Stay.',translation:'留下',segments:[{text:'Stay.',role:'other'}]}]}}));
 await page.locator('#english-input').fill('Go.Stay.'); await page.locator('#analyze-button').click();
 await page.locator('.report-sentence').first().waitFor(); await open();
 assert.ok(!(await page.locator('#feedback-body').inputValue()).includes('Stay.'));
 await page.locator('#feedback-cancel').click();
 // An older backend must report unknown, never infer a default model.
 await page.route('**/api/status',r=>r.fulfill({json:{configured:true}})); await page.reload();
 await page.locator('#english-input').fill('Go.Stay.'); await page.locator('#analyze-button').click();
 await open(); assert.match(await page.locator('#feedback-body').inputValue(),/未知/);

 await page.locator('#feedback-cancel').click();
 // Simulate static hosting: serve the same HTML without the local server's restrictive CSP header.
 await page.route(`http://127.0.0.1:${server.address().port}/`,async r=>r.fulfill({contentType:'text/html',body:await require('node:fs/promises').readFile(require('node:path').join(__dirname,'../public/index.html'),'utf8')}));
 // Pages mode: provider responses are mocked, including actual requested model.
 await page.route('**/api/status',r=>r.fulfill({status:404,body:''})); await page.reload();
 await page.locator('#key-panel').waitFor({state:'visible'});
 const settings=async model=>{await page.locator('#key-panel').evaluate(n=>n.open=true); await page.locator('#model-input').fill(model);await page.locator('#save-key').click();};
 await page.locator('#key-panel').evaluate(n=>n.open=true);await page.locator('#key-input').fill('sk-FAKE-NEVER-SEND');await settings('original-model');
 const {demoAnalysis,demoText}=await import('../public/demo.js');
 const provider='https://api.deepseek.com/chat/completions';
 await page.route(provider,r=>{assert.equal(r.request().postDataJSON().model,'original-model');return r.fulfill({json:{choices:[{finish_reason:'stop',message:{content:JSON.stringify(demoAnalysis)}}]}});});
 await page.locator('#english-input').fill(demoText);await page.locator('#analyze-button').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('已分析'));
 await settings('changed-model');await open();
 assert.match(await page.locator('#feedback-body').inputValue(),/original-model/);
 assert.ok(!(await page.locator('#feedback-body').inputValue()).includes('changed-model'));
 assert.ok(!(await page.locator('#feedback-body').inputValue()).includes('sk-FAKE'));
 await page.locator('#feedback-consent').check();await page.locator('#feedback-title').fill('another');
 assert.equal(await page.locator('#feedback-open').isDisabled(),true);
 await page.locator('#feedback-cancel').click();await open();
 assert.equal(await page.locator('#feedback-consent').isChecked(),false);
 // A pending clipboard operation from an old dialog must not mutate a new one.
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise((resolve,reject)=>{window.rejectCopy=reject;})}}));
 await page.locator('#feedback-copy').click();await page.locator('#feedback-cancel').click();await open();
 const message=await page.locator('#feedback-message').innerText();
 await page.evaluate(()=>window.rejectCopy(Error('blocked')));
 assert.equal(await page.locator('#feedback-message').innerText(),message);
 await page.locator('#feedback-cancel').click();
 await page.unroute(provider);await page.route(provider,r=>r.fulfill({status:401,body:'raw-provider-secret'}));
 await page.locator('#analyze-button').click();await page.locator('#report-failure').waitFor({state:'visible'});await page.locator('#report-failure').click();
 assert.match(await page.locator('#feedback-body').inputValue(),/changed-model/);
 assert.match(await page.locator('#feedback-body').inputValue(),/提示：DeepSeek 拒绝了这个密钥/);
 assert.ok(!(await page.locator('#feedback-body').inputValue()).includes('raw-provider-secret'));
 await page.locator('#feedback-cancel').click();await page.locator('#english-input').fill('New input.');
 assert.equal(await page.locator('#report-failure').isVisible(),false);
 assert.equal(await page.locator('#feedback-body').inputValue(),'');
 await page.locator('#analyze-button').click();await page.locator('#report-failure').waitFor({state:'visible'});
 await page.locator('#example-button').click();assert.equal(await page.locator('#report-failure').isVisible(),false);
 await open();assert.match(await page.locator('#feedback-body').inputValue(),/未调用模型/);
 await page.locator('#feedback-cancel').click();await page.locator('#clear-button').click();
 assert.equal(await page.locator('#results').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log(`Feedback browser: ${checks} assertions passed (all external requests blocked or mocked).`);

 } finally {await browser.close(); await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
