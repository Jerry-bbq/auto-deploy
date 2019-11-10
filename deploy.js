const fs = require("fs");
const archiver = require("archiver");
const chalk = require("chalk");
const Client = require("ssh2").Client;
const conn = new Client();
const config = require("./config");

const { host, username, password, port, remotePath } = config;

const fileName = "dist"; // 本地文以及服务服务器文件,可根据环境变量进行配置
const localFilePath = `./${fileName}.zip`; // 本地压缩后的文件

// 压缩文件
function compress() {
  const output = fs.createWriteStream(localFilePath); // 创建一个可写流 **.zip
  const archive = archiver("zip"); // 生成archiver对象，打包类型为zip
  archive.pipe(output); // 将存档数据管道化到文件
  archive.glob(`./${fileName}/**`); // 追加与匹配到的文件
  archive.finalize(); // 完成打包,“close”、“end”或“finish”可能在调用此方法后立即被激发
  output.on("close", () => {
    console.log(chalk.green("compress finished, waiting for upload..."));
    ready(); // 上传
  });
}

const cmdList = [
  `cd ${remotePath}\n`,
  `rm -rf ${fileName}.copy\n`,
  `mv ${fileName} ${fileName}.copy\n`,
  `unzip ${fileName}.zip\n`,
  `rm -rf ${fileName}.zip\n`,
  `exit\n`
];

/**
 * 上传文件
 * @param conn
 */
function uploadFile(conn) {
  const remoteFilePath = `${remotePath}/${fileName}.zip`; // 远程文件路径
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut(localFilePath, remoteFilePath, {}, (err, result) => {
      if (err) {
        console.log(chalk.red(err.message));
        throw err;
      }
      shell(conn);
    });
  });
}

/**
 * 上传完成后服务器需要执行的内容
 * 删除本地压缩文件
 * @param conn
 * @constructor
 */
function shell(conn) {
  conn.shell((err, stream) => {
    if (err) throw err;
    stream
      .on("close", function() {
        console.log("Stream :: close");
        conn.end();
        fs.unlinkSync(localFilePath);
      })
      .on("data", function(data) {
        console.log("OUTPUT: " + data);
      });
    stream.end(cmdList.join(""));
  });
}

function ready() {
  conn
    .on("ready", () => {
      console.log("Client :: ready");
      uploadFile(conn);
    })
    .connect({ host, username, password, port });
}

compress();
