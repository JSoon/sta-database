let fileHandle;
let writableStream;

async function openFileForWriting() {
  try {
    const currentPage = document.querySelector('.layui-laypage-curr').innerText
    // 请求用户选择保存文件的位置
    fileHandle = await window.showSaveFilePicker({
      suggestedName: `${currentPage}.txt`,
      types: [
        {
          description: 'Text Files',
          accept: { 'text/plain': ['.txt'] },
        },
      ],
    });

    // 创建文件的可写流
    writableStream = await fileHandle.createWritable();
    console.log('File opened for writing.');
  } catch (err) {
    console.error('Error opening file:', err);
  }
}

async function writeToFile(content) {
  if (writableStream) {
    try {
      // 写入内容到文件
      await writableStream.write(content);
      console.log('Data written to file:', content);
    } catch (err) {
      console.error('Error writing to file:', err);
    }
  } else {
    console.log('Writable stream is not available.');
  }
}

async function closeFile() {
  if (writableStream) {
    try {
      // 关闭文件流并保存文件
      await writableStream.close();
      console.log('File closed.');
    } catch (err) {
      console.error('Error closing file:', err);
    }
  }
}

// 打开文件，然后多次写入数据，最后关闭文件
async function main() {
  await openFileForWriting();

  let list = document.querySelectorAll('.list .bt a')
  list.forEach(async ele => {
    await writeToFile(`// ${ele.innerText}\n${ele.href}\n`)
  })

  await closeFile();  // 关闭文件
}

main();