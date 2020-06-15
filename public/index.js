(function () {
  const chunkSize = 2 * 1024 * 1024; // 每个chunk的大小，设置为2兆

  // 使用Blob.slice方法来对文件进行分割。
  // 同时该方法在不同的浏览器使用方式不同。
  // 使用供应商前缀兼容https://developer.mozilla.org/en-US/docs/Web/API/Blob/slice
  const blobSlice =
    File.prototype.slice ||
    File.prototype.mozSlice ||
    File.prototype.webkitSlice;

  function hashFile(file) {
    if (!file) throw Error('参数不正确');

    // // 超过文件字节则设为最后一个字节
    // const end = Math.min(file.size, start + step);

    return new Promise((resolve, reject) => {
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();
      fileReader.readAsArrayBuffer(file);

      fileReader.onload = (e) => {
        spark.append(e.target.result); // Append array buffer
        // const result = spark.end();
        // const sparkMd5 = new SparkMD5();
        // sparkMd5.append(result);
        // const hexHash = sparkMd5.end();
        resolve(spark.end());
      };
      fileReader.onerror = () => {
        reject('文件读取失败！');
      };
    });
  }

  function DOMContentLoadedCB() {
    const submitBtn = document.querySelector('#submitBtn');
    submitBtn.addEventListener('click', submitBtnClick);
  }

  async function submitBtnClick() {
    const fileDom = document.querySelector('#file');
    // 获取到的files为一个File对象数组，如果允许多选的时候，文件为多个
    const files = fileDom.files;
    const file = files[0];
    if (!file) {
      alert('没有获取到文件');
      return;
    }

    const chunkCount = Math.ceil(file.size / chunkSize); // 分片总数
    const axiosPromiseArray = []; // axiosPromise数组
    const fileHash = await hashFile(file); //文件 hash值

    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = blobSlice.call(file, start, end);
      const chunkHash = await hashFile(chunk, start, end);

      // 构建表单
      const form = new FormData();
      form.append('file', chunk);
      // form.append('name', file.name);
      // form.append('total', chunkCount);
      // form.append('size', file.size);
      form.append('fileHash', fileHash);
      form.append('chunkHash', chunkHash);
      form.append('index', i);
      // ajax提交 分片，此时 content-type 为 multipart/form-data
      const axiosOptions = {
        onUploadProgress: (e) => {
          // 处理上传的进度
          console.log(chunkCount, i, e, chunk);
        }
      };
      // 加入到 Promise 数组中
      axiosPromiseArray.push(axios.post('/file/upload', form, axiosOptions));
    }

    // 所有分片上传后，请求合并分片文件
    await axios.all(axiosPromiseArray).then(() => {
      // 合并chunks
      const data = {
        size: file.size,
        name: file.name,
        total: chunkCount,
        fileHash
      };
      axios
        .post('/file/merge_chunks', data)
        .then((res) => {
          console.log('上传成功');
          console.log(res.data, file);
          alert('上传成功');
        })
        .catch((err) => {
          console.log(err);
        });
    });
  }

  document.addEventListener('DOMContentLoaded', DOMContentLoadedCB);
})();

document.querySelector('#dl-btn').addEventListener('click', () => {
  axios.get('/download');
  // window.open('/download')
});
