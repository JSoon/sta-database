import fs from 'fs'
import path from 'path';
import recursiveReadDir from 'recursive-readdir';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import _ from 'lodash';
import chalk from 'chalk';
import md5 from 'md5';

puppeteer.use(StealthPlugin());

// Launch the browser and open a new blank page
const browser = await puppeteer.launch({
  // headless: false,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

// 下载文件路径
// const downloadPath = path.resolve('./downloads');
// const downloadPath = path.resolve('./downloads', '20241018');
// const downloadPath = path.resolve('./downloads', '20241021');
const downloadPath = path.resolve('./downloads', 'updates');
// 遍历下载链接
// const linkPath = path.resolve('./links', '20241018');
// const linkPath = path.resolve('./links', '20241021');
const linkPath = path.resolve('./links', 'updates');
// 错误日志路径
// const errorLogPath = path.resolve('./error_20241018.log');
// const errorLogPath = path.resolve('./error_20241021.log');
const errorLogPath = path.resolve('./error_updates.log');

// 下载完成的文件数组
const downloadedFiles = []
try {
  // 下载文件数组，包含标题和链接
  let fileData = []
  // 遍历所有链接文件
  recursiveReadDir(linkPath, ['.DS_Store'], async function (err, files) {
    files.forEach((file) => {
      const data = fs.readFileSync(file, 'utf8');
      const titles = data.split('\n').filter(row => row.startsWith('//'));
      const links = data.split('\n').filter(row => row.startsWith('https://'));
      titles.forEach((title, idx) => {
        const link = links[idx];
        // 和已下载文件的 newFilePath 保持一致
        const fileName = `${title.replace('// ', '').replace(/\s+/g, ' ')}_${md5(link)}.doc`;
        const filePath = path.resolve(downloadPath, fileName);
        fileData.push({
          title,
          link,
          fileName,
          filePath
        });
      });
    });
    // 根据政策链接地址去重，防止重复下载
    fileData = _.uniqBy(fileData, 'link');
    console.log('全部文件数量:', fileData.length);
    // 下载文件
    for (let i = 0; i < fileData.length; i++) {
      const file = fileData[i];
      // 检查是否所有文件都下载完成
      if (downloadedFiles.length === fileData.length) {
        console.log('所有文件下载完成');
        await browser.close();
        process.exit();
      }
      // 检查文件是否已经下载
      if (fs.existsSync(file.filePath)) {
        console.log('文件已存在:', file.filePath);
        continue;
      }
      // 停顿 delayTime 毫秒
      await new Promise(r => setTimeout(r, _.random(0, 5000)));
      try {
        await downloadFile(file.link);
      } catch (e) {
        console.error(chalk.red('下载出错:', file.link, e));
        // 写入错误日志
        fs.appendFileSync(errorLogPath, `// （下载出错）${file.fileName}\n${file.link}\n`);
        // 更新已下载文件列表（下载失败的也要记录，用于判断是否所有文件均已下载）
        downloadedFiles.push(file.filePath);
      }
    }
  });
} catch (err) {
  console.error(chalk.red('遍历出错:', err));
}

// 下载政策文件
async function downloadFile(link) {
  const page = await browser.newPage();

  page.setDefaultTimeout(60 * 1000); // 设置超时时间

  // 启用下载功能
  const client = await page.createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath, // 设置下载路径
  });

  // Navigate the page to a URL.
  await page.goto(link);
  // console.log(await page.content())

  // NOTE: 和页面中获取文件名称的逻辑保持一致，都使用jQuery的text()方法，避免下载文件名称不一致
  const fileNameHandler = await page.$('.content .detials h3');
  const fileName = await fileNameHandler.evaluate(el => $(el).text());
  const filePath = path.resolve(downloadPath, `${fileName}.doc`);
  console.log('开始下载:', fileName, link);

  const downloadDOM = await page.$('#zwxz');
  await downloadDOM.click();

  // 等待文件下载完成
  let waitTime = 0;
  const waitTimeMax = 10;
  return new Promise((resolve) => {
    const downloadTimer = setInterval(async () => {
      if (fs.existsSync(filePath)) {
        // 统一处理文件名中的连续空白符，用于后续下载时判断文件是否已存在
        const newFileName = fileName.replace(/\s+/g, ' ');
        // 加上md5后缀，确保唯一性（因为有些规范文件可能重名，但是发布年份不一样）
        const newFilePath = path.resolve(downloadPath, `${newFileName}_${md5(link)}.doc`);
        // 重命名下载文件，防止原文件名不超长，但重命名超长的报错
        try {
          fs.renameSync(filePath, newFilePath);
        } catch (e) {
          fs.appendFileSync(errorLogPath, `// （重命名失败）${fileName}\n${link}\n`);
        }
        // 清除定时器
        clearInterval(downloadTimer);
        // 更新已下载文件列表
        downloadedFiles.push(newFilePath);
        await page.close();
        console.log('下载完成:', newFilePath);
        resolve();
      } else {
        console.log('下载中:', link);
        if (waitTime >= waitTimeMax) {
          console.error(chalk.red('下载出错（超过最大等待时间）:', link));
          // 写入错误日志
          fs.appendFileSync(errorLogPath, `// （超过最大等待时间）${fileName}\n${link}\n`);
          // 清除定时器
          clearInterval(downloadTimer);
          // 更新已下载文件列表（下载失败的也要记录，用于判断是否所有文件均已下载）
          downloadedFiles.push(filePath);
          await page.close();
          resolve();
        }
        waitTime += 1;
      }
    }, 1000);
  })
}
