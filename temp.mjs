import fs from 'fs'
import path from 'path';
import chalk from 'chalk';

// const downloadPath = path.resolve('./downloads', '20241018');
const downloadPath = path.resolve('./downloads', '20241021');

// 重命名文件名：长度超过100的文件，只保留前100个字符，后缀名改为.doc
fs.readdir(downloadPath, (err, files) => {
  files.forEach(file => {
    if (file.length > 100) {
      const newFileName = file.split('.')[0].slice(0, 100) + '.doc'
      const newFilePath = path.resolve(downloadPath, newFileName)
      fs.rename(path.resolve(downloadPath, file), newFilePath, err => {
        if (err) {
          console.error(chalk.red(`Error renaming file: ${file}`, err))
        }
      })
    }
  })
})