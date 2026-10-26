// Uses an existing Playwright installation; no runtime package installation.
const { chromium } = require(process.env.PICTAG_PLAYWRIGHT_MODULE || 'playwright');
const JSZip = require('jszip');
const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const out = path.resolve(__dirname, '../output/playwright/2026-10-26-boundary');
const testUrl = process.env.PICTAG_TEST_URL || 'http://127.0.0.1:4173';

(async () => {
  await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await context.newPage();
  const checks = [], downloads = [], errors = [];
  page.on('download', download => downloads.push(download));
  page.on('pageerror', error => errors.push(error.message));
  const pass = name => { checks.push(name); console.log('PASS', name); };
  const card = name => page.getByRole('group', { name: '图片 ' + name, exact: true });
  const edges = name => card(name).locator('[data-uncovered-edge]').evaluateAll(nodes => nodes.map(n => n.dataset.uncoveredEdge).sort());
  const expectEdges = async (name, wanted) => {
    await page.waitForFunction(({ name, wanted }) => {
      const c = [...document.querySelectorAll('[data-image-card]')].find(n => n.dataset.imageName === name);
      return c && JSON.stringify([...c.querySelectorAll('[data-uncovered-edge]')].map(n => n.dataset.uncoveredEdge).sort()) === JSON.stringify(wanted.sort());
    }, { name, wanted });
    assert.deepEqual(await edges(name), [...wanted].sort());
  };
  const reset = async name => {
    const button = page.getByRole('button', { name: '复位 ' + name, exact: true });
    if (await button.isEnabled()) await button.click();
  };
  const scale = async (name, value) => {
    const slider = page.getByRole('slider', { name: '缩放 ' + name, exact: true });
    await slider.focus();
    await slider.press('Home');
    for (let i = 0; i < Math.round((value - 0.1) / 0.05); i++) await slider.press('ArrowRight');
    assert.ok(Math.abs(Number(await slider.inputValue()) - value) < 1e-8);
  };
  const processAll = async () => {
    await page.getByRole('button', { name: '应用到所有图片', exact: true }).click();
    await page.getByRole('button', { name: '下载 square.png', exact: true }).waitFor();
    await page.getByRole('button', { name: '应用到所有图片', exact: true }).waitFor();
  };
  const fixture = async (name, width, height, color) => {
    const data = await page.evaluate(({width,height,color}) => {
      const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
      const ctx=canvas.getContext('2d'); if(color) {ctx.fillStyle=color;ctx.fillRect(0,0,width,height);}
      return canvas.toDataURL('image/png').split(',')[1];
    }, {width,height,color});
    const path = out + '/' + name;
    await fs.writeFile(path, Buffer.from(data, 'base64'));
    return path;
  };
  const pixels = async (buffer, mime) => page.evaluate(async ({data,mime}) => {
    const img=new Image(); img.src=`data:${mime};base64,${data}`; await img.decode();
    const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
    const sample=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
    return {width:img.width,height:img.height,corner:sample(5,5),center:sample(Math.floor(img.width/2),Math.floor(img.height/2)),gap:sample(100,500)};
  }, {data:buffer.toString('base64'),mime});
  const captureDownload = async (action, filename) => {
    const before=downloads.length; const promise=page.waitForEvent('download');
    await action(); const download=await promise; await download.saveAs(out+'/'+filename);
    await page.waitForTimeout(200);
    assert.equal(downloads.length,before+1,'exactly one download');
    return fs.readFile(out+'/'+filename);
  };
  try {
    await page.goto(testUrl, {waitUntil:'networkidle'});
    await fs.writeFile(out+'/initial-snapshot.yml',await page.locator('body').ariaSnapshot());
    const square=await fixture('square.png',1080,1080,'#008080');
    const wide=await fixture('wide.png',2160,1080,'#008080');
    const tall=await fixture('tall.png',1080,2160,'#008080');
    await page.locator('input[type=file][multiple]').setInputFiles([square,wide,tall]);
    await card('tall.png').waitFor();
    for(const name of ['square.png','wide.png','tall.png']) await expectEdges(name,[]);
    await page.getByRole('button',{name:'文字',exact:true}).click();
    const crop=page.getByText('统一裁切尺寸',{exact:true}).locator('..').locator('input[type=checkbox]');
    await crop.check();
    for(const name of ['square.png','wide.png','tall.png']) await expectEdges(name,[]);
    pass('default, exact fill, landscape and portrait sources have no warning (DPR 2)');
    await page.screenshot({path:out+'/01-covered.png',fullPage:true});

    for(const [dx,dy,edge] of [[15,0,'left'],[-15,0,'right'],[0,15,'top'],[0,-15,'bottom']]) {
      const box=await card('square.png').getByTestId('export-preview').boundingBox();
      const x=box.x+box.width/2,y=box.y+box.height/2;
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:5});await page.mouse.up();
      await expectEdges('square.png',[edge]);await reset('square.png');await expectEdges('square.png',[]);
    }
    pass('real pointer drag exposes each of four edges; reset immediately clears warning');
    await scale('square.png',1.5);
    const b=await card('square.png').getByTestId('export-preview').boundingBox();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+10,b.y+b.height/2+10);await page.mouse.up();
    await expectEdges('square.png',[]);
    await reset('square.png');
    await card('square.png').focus();await card('square.png').press('ArrowRight');await expectEdges('square.png',['left']);
    await card('square.png').press('ArrowLeft');await expectEdges('square.png',[]);
    pass('enlarged image can move while covered; moving back immediately clears warning');

    const width=page.getByText('宽度 (W)',{exact:true}).locator('..').locator('input');
    const height=page.getByText('高度 (H)',{exact:true}).locator('..').locator('input');
    await width.fill('1000');await height.fill('600');
    await expectEdges('square.png',[]);
    let box=await card('square.png').getByTestId('export-preview').boundingBox();
    assert.ok(Math.abs(box.width/box.height-1000/600)<0.02);
    await page.setViewportSize({width:1280,height:900});
    await expectEdges('square.png',[]);
    box=await card('square.png').getByTestId('export-preview').boundingBox();
    assert.ok(Math.abs(box.width/box.height-1000/600)<0.02);
    await width.fill('600');await height.fill('1000');await expectEdges('square.png',[]);
    box=await card('square.png').getByTestId('export-preview').boundingBox();
    assert.ok(Math.abs(box.width/box.height-0.6)<0.02);
    await width.fill('1080');await height.fill('1080');await page.setViewportSize({width:1500,height:1000});
    pass('wide/tall output and responsive preview resizing preserve exact output boundary');

    await scale('square.png',0.5);await expectEdges('square.png',['top','right','bottom','left']);
    await scale('wide.png',0.5);await expectEdges('wide.png',['top','bottom']);
    await scale('tall.png',0.5);await expectEdges('tall.png',['left','right']);
    await page.screenshot({path:out+'/02-uncovered.png',fullPage:true});
    await reset('wide.png');await reset('tall.png');await processAll();
    const downloadButton=page.getByRole('button',{name:'下载 square.png',exact:true});
    await downloadButton.click();
    const dialog=page.getByRole('dialog',{name:'图片未铺满导出区域'});
    await dialog.waitFor();assert.equal(await dialog.locator('li').count(),1);
    assert.match(await dialog.innerText(),/square.png/);
    await page.screenshot({path:out+'/03-export-confirmation.png',fullPage:true});
    let before=downloads.length;await page.getByRole('button',{name:'返回调整',exact:true}).click();await page.waitForTimeout(250);
    assert.equal(downloads.length,before);assert.equal(await dialog.count(),0);
    await downloadButton.click();await page.keyboard.press('Escape');await page.waitForTimeout(150);assert.equal(downloads.length,before);
    pass('single export lists affected edges; return and Escape cancel without any download');

    await downloadButton.click();
    const png=await captureDownload(()=>page.getByRole('button',{name:'仍然导出',exact:true}).evaluate(button=>{button.click();button.click();}), 'single-confirmed.png');
    const pngPixels=await pixels(png,'image/png');
    assert.equal(pngPixels.width,1080);assert.equal(pngPixels.height,1080);assert.equal(pngPixels.corner[3],0);assert.equal(pngPixels.gap[3],0);assert.deepEqual(pngPixels.center,[0,128,128,255]);
    pass('repeated confirmation downloads once; PNG has transparent gaps, teal pixels, and no warning overlay');

    await page.getByRole('button',{name:'批量导出 ZIP',exact:true}).click();await dialog.waitFor();
    assert.equal(await dialog.locator('li').count(),1);assert.match(await dialog.innerText(),/square.png/);
    before=downloads.length;await page.getByRole('button',{name:'返回调整',exact:true}).click();await page.waitForTimeout(200);assert.equal(downloads.length,before);
    await page.getByRole('button',{name:'批量导出 ZIP',exact:true}).click();
    const zipBuffer=await captureDownload(()=>page.getByRole('button',{name:'仍然导出',exact:true}).evaluate(button=>{button.click();button.click();}), 'mixed-confirmed.zip');
    const zip=await JSZip.loadAsync(zipBuffer);assert.deepEqual(Object.keys(zip.files).sort(),['square.png','tall.png','wide.png']);
    assert.deepEqual(await zip.file('square.png').async('nodebuffer'),png);
    for(const name of ['wide.png','tall.png']) {const p=await pixels(await zip.file(name).async('nodebuffer'),'image/png');assert.deepEqual(p.corner,[0,128,128,255]);}
    pass('mixed ZIP warns only affected image; cancel downloads nothing; continue once preserves all clean image bytes');

    const format=page.getByText('目标导出格式',{exact:true}).locator('..').locator('input[type=checkbox]');
    await format.check();
    assert.equal(await page.getByRole('button',{name:'下载 square.png',exact:true}).count(),0);
    await processAll();await downloadButton.click();
    const jpeg=await captureDownload(()=>page.getByRole('button',{name:'仍然导出',exact:true}).click(),'single-confirmed.jpg');
    const jp=await pixels(jpeg,'image/jpeg');assert.equal(jp.width,1080);assert.equal(jp.height,1080);assert.ok(jp.corner.slice(0,3).every(v=>v<4));assert.ok(jp.center[0]<4&&Math.abs(jp.center[1]-128)<4&&Math.abs(jp.center[2]-128)<4);
    pass('format changes invalidate stale results; JPEG contains only source/background, no overlay');
    await reset('square.png');await expectEdges('square.png',[]);await processAll();
    await captureDownload(()=>downloadButton.click(),'corrected.jpg');assert.equal(await dialog.count(),0);
    await captureDownload(()=>page.getByRole('button',{name:'批量导出 ZIP',exact:true}).click(),'corrected.zip');assert.equal(await dialog.count(),0);
    pass('corrected image exports singly and in ZIP without a confirmation');

    await scale('square.png',0.5);await crop.uncheck();await expectEdges('square.png',[]);await crop.check();await expectEdges('square.png',['top','right','bottom','left']);
    await page.getByRole('button',{name:'移除 square.png',exact:true}).click();
    await page.locator('input[type=file][multiple]').setInputFiles(square);await card('square.png').waitFor();await expectEdges('square.png',[]);
    const transparent=await fixture('transparent.png',1080,1080,null), white=await fixture('white.png',1080,1080,'#ffffff');
    await page.locator('input[type=file][multiple]').setInputFiles([transparent,white]);await card('white.png').waitFor();
    await expectEdges('transparent.png',[]);await expectEdges('white.png',[]);
    pass('crop toggle/reset/replacement clear appropriate state; transparent and white source pixels never trigger geometric warnings');
    await fs.writeFile(out+'/final-snapshot.yml',await page.locator('body').ariaSnapshot());
    assert.deepEqual(errors,[]);
    await fs.writeFile(out+'/results.json',JSON.stringify({status:'passed',checks,downloads:downloads.length,pageErrors:errors,viewport:'1500x1000 and 1280x900',deviceScaleFactor:2},null,2));
    console.log('RESULT',checks.length,'browser scenarios passed;',downloads.length,'downloads verified');
  } catch(error) {
    await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});
    await fs.writeFile(out+'/failure-snapshot.yml',await page.locator('body').ariaSnapshot()).catch(()=>{});
    await fs.writeFile(out+'/results.json',JSON.stringify({status:'failed',checks,error:String(error),pageErrors:errors},null,2));
    throw error;
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
