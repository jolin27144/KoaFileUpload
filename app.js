const Koa = require('koa');
const Router = require('koa-router');
const serve = require('koa-static');
const multer = require('koa-multer'); // 处理上传中间件
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const koaBody = require('koa-body');
const uploadPath = path.join(__dirname, 'upload');
const uploadTempPath = path.join(uploadPath, 'temp');
const upload = multer({ dest: uploadTempPath });

const router = new Router();
const app = new Koa();

app.use(koaBody());

/**
 * single(fieldname)
 * Accept a single file with the name fieldname. The single file will be stored in req.file.
 */
router.post('/file/upload', upload.single('file'), async (ctx, next) => {
  const { index, fileHash, chunkHash } = ctx.req.body;
  console.log(`File Comes In With Index:${index}`);
  // 根据文件hash创建文件夹，把默认上传的文件移动当前hash文件夹下。方便后续文件合并。

  const chunksPath = path.join(uploadPath, fileHash, '/');
  if (!fs.existsSync(chunksPath)) {
    // 创建hash目录
    await fs.mkdir(chunksPath, { recursive: true });
  }

  const buffer = fs.readFileSync(ctx.req.file.path);
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  if (hash !== chunkHash) {
    console.log('分片校验失败');
    ctx.status = 500;
    ctx.res.end('分片校验失败');
  }

  // 分片移动到hash目录
  fs.renameSync(ctx.req.file.path, chunksPath + chunkHash + '-' + index);

  ctx.status = 200;
  ctx.res.end();
  console.log(`File With Index:${index} Saved`);
});

router.post('/file/merge_chunks', async (ctx, next) => {
  const { name, total, fileHash } = ctx.request.body;

  // 根据hash值，获取分片存储的hash目录
  const chunksPath = path.join(uploadPath, fileHash, '/');
  // 确定合并之后要存储的路径
  const filePath = path.join(uploadPath, name);
  // 读取所有的chunks 文件名存放在数组中
  const chunks = fs.readdirSync(chunksPath);
  // 创建存储文件
  fs.writeFileSync(filePath, '');
  if (chunks.length !== total || chunks.length === 0) {
    ctx.status = 200;
    ctx.res.end('切片文件数量不符合');
    return;
  }
  chunks.forEach((chunk) => {
    // 追加写入到文件中
    fs.appendFileSync(filePath, fs.readFileSync(path.join(chunksPath, chunk)));
    // 删除本次使用的chunk
    fs.unlinkSync(path.join(chunksPath, chunk));
  });
  fs.rmdirSync(chunksPath);
  // 文件合并成功
  ctx.status = 200;
  ctx.res.end('合并成功');
});

app.use(router.routes());
app.use(router.allowedMethods());
app.use(serve(__dirname + '/public')); // 静态文件服务
app.listen(9000, () => {
  console.log('listening port:9000');
});
