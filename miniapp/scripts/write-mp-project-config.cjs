const fs = require('fs');
const path = require('path');

const output = path.resolve(__dirname, '..', 'dist', 'build', 'mp-weixin');
const config = {
  appid: 'wx0000000000000000',
  projectname: 'DormDelivery-CloudBase',
  miniprogramRoot: './',
  cloudfunctionRoot: '../../../cloudfunctions/',
  setting: {
    es6: true,
    enhance: true,
    postcss: true,
    minified: true,
    urlCheck: false
  }
};

fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'project.config.json'), `${JSON.stringify(config, null, 2)}\n`);
