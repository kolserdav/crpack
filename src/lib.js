/******************************************************************************************
 * Repository: https://github.com/kolserdav/crpack.git
 * Author: Sergey Kolmiller
 * Email: <serega12101983@gmail.com>
 * License: MIT
 * License Text: The code is distributed as is. There are no guarantees regarding the functionality of the code or parts of it.
 * Copyright: kolserdav, All rights reserved (c)
 * Create date: Wed Nov 10 2021 03:03:49 GMT+0700 (Krasnoyarsk Standard Time)
 ******************************************************************************************/
// @ts-check

const spawn = require('child_process').spawn;
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const ConfigParser = require('@webantic/nginx-config-parser');

const { stdin, stdout } = process;

const parser = new ConfigParser();

const Red = '\x1b[31m';
const Reset = '\x1b[0m';
const Bright = '\x1b[1m';
const Yellow = '\x1b[33m';
const Green = '\x1b[32m';
const Dim = '\x1b[2m';
const Blink = '\x1b[5m';

module.exports = class Worker {
  /**
   * @type {string}
   */
  pwd;

  /**
   * @type {string}
   */
  packageName;

  /**
   * @type {string}
   */
  domain;

  /**
   * @type {string}
   */
  npmPackageVersion;

  /**
   * @type {string}
   */
  nginxConfigPath;

  /**
   * @type {boolean}
   */
  traceWarnings;

  /**
   * @type {boolean}
   */
  renewDefault;

  /**
   * @type {boolean}
   */
  prod;

  /**
   * @type {string}
   */
  root;

  /**
   * @type {string}
   */
  configPath;

  /**
   * @type {string}
   */
  cacheDefaultUserNginxConfig;

  /**
   * @type {'[error]'}
   */
  error;

  /**
   * @type {'[info]'}
   */
  info;

  /**
   * @type {'[warning]'}
   */
  warning;

  /**
   * @type {boolean}
   */
  renewAll;

  /**
   * @type {RegExp}
   */
  nginxRegex;

  constructor() {
    this.pwd = process.env.PWD;
    this.npmPackageVersion = process.env.NPM_PACKAGE_VERSION;
    this.nginxConfigPath = '/etc/nginx/nginx.conf';
    this.domain = 'crpack1.uyem.ru';
    this.traceWarnings = false;
    this.renewDefault = false;
    this.prod = path.relative(this.pwd, __dirname) !== 'src';
    this.root = this.prod ? this.pwd : './';
    this.configPath = path.resolve(this.pwd, this.root, 'package.json');
    this.cacheDefaultUserNginxConfig = path.resolve(__dirname, '../.crpack/nginx.conf');
    this.error = '[error]';
    this.info = '[info]';
    this.warning = '[warning]';
    this.renewAll = false;
    this.nginxRegex = /nginx\/\d+\.\d+\.\d+/;
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
        console.log(12, `\r\r${str}`);
      });
      sh.stderr?.on('data', (err) => {
        const str = err.toString();
        if (command === 'nginx' && this.nginxRegex.test(str)) {
          resolve(str);
        } else {
          console.error(`Error run command ${command}`, Red, str, Reset);
          reject(str);
        }
      });
      sh.on('error', (err) => {
        console.log(11, err);
      });
      sh.on('close', (code) => {
        resolve(code);
      });
    }).catch((e) => {
      console.error(this.error, e);
    });
  }

  /**
   * Save user default nginx.conf data
   * @returns {Promise<string | undefined>}
   */
  async cacheUserNginxConfig() {
    let cData = '';
    try {
      cData = fs.readFileSync(path.normalize(this.nginxConfigPath)).toString();
    } catch (err) {
      console.error(
        this.error,
        Red,
        `Nginx config file is missing on ${this.nginxConfigPath}`,
        err
      );
      return cData;
    }
    if (cData) {
      console.log(
        fs.existsSync(this.cacheDefaultUserNginxConfig),
        this.traceWarnings && !this.renewAll
      );
      if (fs.existsSync(this.cacheDefaultUserNginxConfig) && this.traceWarnings) {
        console.warn(
          this.warning,
          Yellow,
          Dim,
          `Configuration of nginx user was cached earlier in ${this.cacheDefaultUserNginxConfig}, to change,
           run with the option:${Reset}${Bright} --renew-default`,
          Reset
        );
      } else {
        fs.writeFileSync(this.cacheDefaultUserNginxConfig, cData);
      }
    }
    return cData;
  }

  /**
   *
   * @returns {Promise<number>}
   */
  async createPackage() {
    this.packageName = await this.setPackage();
    console.info(this.info, 'Package name:', this.packageName);
    this.nginxConfigPath = await this.setUserNginxPath();
    console.info(this.info, 'Target nginx config path:', this.nginxConfigPath);
    const nginxConfig = await this.getNginxConfig();
    this.domain = await this.setDomain();
    console.info(this.info, 'Domain name:', this.domain);
    const _nginxConfig = { ...nginxConfig };
    if (_nginxConfig.http) {
    } else {
      delete _nginxConfig.mime;
      console.warn(`Section http is missing on ${JSON.stringify(_nginxConfig)}`);
    }

    await this.writeNginxConfig(
      this.prod ? this.nginxConfigPath : './tmp/nginx.conf',
      _nginxConfig,
      this.packageName
    );
    return 0;
  }

  /**
   * Parse nginx.conf file
   * @returns {Promise<Object | 1>}
   */
  async getNginxConfig() {
    const command = 'nginx';
    const args = ['-v'];
    const nginxRes = await this.getSpawn({
      command,
      args,
      options: { cwd: this.pwd },
    }).catch((e) => {
      console.error(this.error, `Error ${command} ${args.join(' ')}`);
    });
    const nginxV = nginxRes.match(this.nginxRegex);
    const nginxVer = nginxV ? nginxV[0] : null;
    if (!nginxVer) {
      console.warn(
        this.warning,
        Yellow,
        'Nginx is not installed, please install nginx and try again',
        Reset
      );
      return 1;
    }
    console.info(this.info, `Nginx version: ${nginxVer}`);
    await this.cacheUserNginxConfig();
    if (this.traceWarnings) {
      console.warn(
        this.warning,
        Yellow,
        `${Dim} First your nginx config saved on ${this.cacheDefaultUserNginxConfig} to show run command: ${Reset}${Bright} crpack show-default ${Reset}`
      );
    }
    return new Promise((resolve) => {
      parser.readConfigFile(this.nginxConfigPath, (err, res) => {
        if (err) {
          console.error(
            this.error,
            Red,
            `Error parse nginx config by path:`,
            this.nginxConfigPath,
            Reset
          );
          resolve(1);
        }
        resolve(res);
      });
    });
  }

  /**
   * return package.json config
   * @returns {Object | 1}
   */
  packageJson() {
    let result;
    try {
      result = fs.readFileSync(this.configPath).toString();
    } catch (err) {
      console.error(this.error, Red, `${this.configPath} not found `, Reset);
      return 1;
    }
    return JSON.parse(result);
  }

  /**
   * Set global package name
   * @returns {Promise<string>}
   */
  async setPackage() {
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });
    const { name } = this.packageJson();
    return new Promise((resolve) => {
      rl.question(`Package name: ${Dim} ${name} ${Reset}> `, (value) => {
        this.packageName = value || name || this.packageName;
        rl.close();
        resolve(value || name);
      });
    });
  }

  /**
   * Change default nginx config path
   * @returns {Promise<string>}
   */
  async setUserNginxPath() {
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });
    return new Promise((resolve) => {
      rl.question(`Nginx config path: ${Dim} ${this.nginxConfigPath} ${Reset}> `, (uPath) => {
        this.nginxConfigPath = uPath || this.nginxConfigPath;
        rl.close();
        resolve(this.nginxConfigPath);
      });
    });
  }

  /**
   * Set global package name
   * @returns {Promise<string>}
   */
  async setDomain() {
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });
    const { homepage } = this.packageJson();
    const homePage = homepage
      ? homepage.replace(/https?:\/\//, '').replace(/\//g, '')
      : this.domain;
    return new Promise((resolve) => {
      rl.question(`Domain name: ${Dim} ${homePage} ${Reset}> `, (value) => {
        const _value = value || homePage;
        this.domain = _value;
        rl.close();
        resolve(this.domain);
      });
    });
  }

  /**
   * Save config
   * @param {string} filePath
   * @param {Object} nginxConfig
   * @param {string} domain
   * @returns
   */
  async writeNginxConfig(filePath, nginxConfig, domain) {
    return new Promise((resolve, reject) => {
      parser.writeConfigFile(filePath, nginxConfig, false, (err, res) => {
        if (err) {
          console.error(this.error, Red, `Error write file ${filePath}`, Reset, err);
          reject(err);
        }
        console.info(this.info, `Config file ${filePath} is changed`);
        resolve(res);
      });
    });
  }
};
