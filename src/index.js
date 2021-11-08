// @ts-check

const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const ConfigParser = require('@webantic/nginx-config-parser');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const parser = new ConfigParser();

const { NPM_PACKAGE_VERSION, PWD } = process.env;
console.log(path.relative(PWD, __dirname));
const PROD = path.relative(PWD, __dirname) !== 'src';
const ROOT = PROD ? PWD : './';
const CONFIG_PATH = path.resolve(PWD, ROOT, 'package.json');

const NGINX_REGEX = /nginx\/\d+\.\d+\.\d+/;
const DEFAULT_NGINX_CONFIG = '/etc/nginx/nginx.conf';

const Red = '\x1b[31m';
const Reset = '\x1b[0m';
const Bright = '\x1b[1m';
const Yellow = '\x1b[33m';
const Green = '\x1b[32m';
const Dim = '\x1b[2m';
const Blink = '\x1b[5m';

const ERROR = 'ERROR';
const INFO = 'INFO';
const WARNING = 'WARNING';

class Factory {
  nginxConfigPath = DEFAULT_NGINX_CONFIG;
  /**
   * Check if nginx version requested
   * @param {string} str
   * @returns {boolean}
   */
  isNginx(str) {
    return NGINX_REGEX.test(str);
  }

  /**
   * Run spawn command
   * @param {{ command: string, args: string[], options?: any }} props
   * @returns {Promise<any>}
   */
  async getSpawn(props) {
    const { command, args, options } = props;
    console.info(Dim, `${command} ${args.join(' ')}`, Reset);
    const sh = spawn.call('sh', command, args, options || {});
    return await new Promise((resolve, reject) => {
      sh.stdout?.on('data', (data) => {
        const str = data.toString();
        console.log(1, `\r\r${str}`);
      });
      sh.stderr?.on('data', (err) => {
        const str = err.toString();
        if (command === 'nginx' && this.isNginx(str)) {
          resolve(str);
        } else {
          console.warn(`Error run command ${command}`, Red, str, Reset);
          reject(str);
        }
      });
      sh.on('close', (code) => {
        resolve(code);
      });
    }).catch((e) => {
      console.error(ERROR, e);
    });
  }

  /**
   * Commands map
   */
  async run() {
    console.info(INFO, Reset, 'Started create system package script...');
    const controller = new AbortController();
    const { signal } = controller;
    const arg2 = process.argv[2];
    const version = `CrPack version ${NPM_PACKAGE_VERSION}`;
    const help = `
    ${version}
> crpack [options]     
OPTIONS
--name - package name 
  `;
    let args;
    let pName;
    switch (arg2) {
      case '-h':
        console.info(help);
        break;
      case '--help':
        console.info(help);
        break;
      case '--name':
        pName = process.argv[3];
        if (!pName) {
          console.error(ERROR, Red, `Package name is ${pName}, please use string`, Reset);
          break;
        }
        await this.createPackage(pName);
        break;
      case '-v':
        console.info(version);
        break;
      case '--version':
        console.info(version);
        break;
      default:
        console.info(
          `
error Unknown command ${arg2}
Try run "crpack --help" 
        ${help}
      `,
          Reset
        );
    }
  }

  /**
   *
   * @param {string} name
   * @returns {Promise<number>}
   */
  async createPackage(name) {
    const command = 'nginx';
    const args = ['-v'];
    const nginxRes = await this.getSpawn({
      command,
      args,
      options: { cwd: PWD },
    }).catch((e) => {
      console.error(ERROR, `Error ${command} ${args.join(' ')}`);
    });
    const nginxV = nginxRes.match(NGINX_REGEX);
    const nginxVer = nginxV ? nginxV[0] : null;

    return 0;
  }

  /**
   *
   * @param {string} nginxVer
   * @returns {Promise<number>}
   */
  async checkNginxConfig(nginxVer) {
    if (!nginxVer) {
      console.warn(
        WARNING,
        Yellow,
        'Nginx is not installed, please install nginx and try again',
        Reset
      );
      return 1;
    }
    console.info(INFO, `Nginx version: ${nginxVer}`);
    rl.question(`Nginx config path: ${Dim} ${DEFAULT_NGINX_CONFIG} ${Reset}> `, (uPath) => {
      this.nginxConfigPath = uPath;
      rl.close();
    });
    const nginxConfigRaw = fs.readFileSync(this.nginxConfigPath).toString();
  }
}

const r = new Factory();

(async () => {
  await r.run();
})();
