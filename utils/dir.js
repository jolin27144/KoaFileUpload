const path = require('path');
const fs = require('fs');
const mkdirsSync = (dirname) => {
  if (fs.existsSync(dirname)) {
    return;
  } else {
    fs.mkdirSync(dirname, { recursive: true });
  }
};
module.exports = {
  mkdirsSync
};
