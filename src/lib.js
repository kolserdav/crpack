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
const { ConfigIniParser } = require('config-ini-parser');

const MAXIMUM_WAIT_ABORT = 2000;
const MINIMUM_WAIT_ABORT = 1000;

const delimiter = '\n';
const { stdin, stdout } = process;
const parser = new ConfigParser();
const _parser = new ConfigIniParser(delimiter);

const Red = '\x1b[31m';
const Reset = '\x1b[0m';
const Bright = '\x1b[1m';
const Yellow = '\x1b[33m';
const Cyan = '\x1b[36m';
const Dim = '\x1b[2m';
const Blue = '\x1b[34m';

/**
 * @typedef {1 | string[]} ResultArrayString
 * @typedef {number | undefined} NumberUndefined
 * @typedef {1 | 0} Result
 * @typedef {1 | string} ResultString;
 * @typedef {1 | void} ResultVoid;
 * @typedef {1 | 0 | string | undefined} ResultUndefined;
 */

module.exports = class Worker {
  /**
   * @type {string}
   */
  pwd;

  /**
   * @type {number}
   */
  port;

  /**
   * @type {string}
   */
  packageName;

  /**
   * @type {string}
   */
  nginxTmpPath;

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

  /**
   * @type {string}
   */
  systemdConfigDir;

  /**
   * @type {string}
   */
  templateSystemdConfig;

  /**
   * @type {string}
   */
  ini;

  /**
   *@type {boolean}
   * */
  test;

  /**
   * @type {string}
   */
  nginxPath;

  /**
   * @type {string}
   */
  nginxVersion;

  /**
   * path of custom user nginx config file
   * with the name like domain
   * @type {string}
   */
  nginxConfigDPath;

  /**
   * @type {string}
   */
  npmPath;

  /**
   * @type {Object}
   */
  packageJsonConfig;

  /**
   * @type {Object}
   */
  packageJsonSelf;

  /**
   * @type {string}
   */
  nodeEnv;

  /**
   * @type {boolean}
   */
  rawPackage;

  constructor() {
    this.pwd = process.env.PROJECT_ROOT || process.cwd();
    this.npmPackageVersion;
    this.rawPackage = false;
    this.nodeEnv = 'production';
    this.nginxPath = '/etc/nginx';
    this.nginxConfigPath = `${this.nginxPath}/nginx.conf`;
    this.nginxConfigDPath = '';
    this.systemdConfigDir = '/etc/systemd/system/';
    this.domain = 'example.com';
    this.packageJsonConfig = {};
    this.packageJsonSelf = {};
    this.ini = '';
    this.port = 3000;
    this.test = false;
    this.nginxVersion = '';
    this.npmPath = '';
    this.traceWarnings = false;
    this.renewDefault = false;
    this.prod = path.relative(this.pwd, __dirname) !== 'src';
    this.root = this.prod ? this.pwd : './';
    this.configPath = path.resolve(this.pwd, this.root, 'package.json');
    this.cacheDefaultUserNginxConfig = path.resolve(__dirname, '../.crpack/nginx.conf');
    this.nginxTmpPath = path.resolve(__dirname, '../.crpack/.nginx.conf');
    this.templateSystemdConfig = path.resolve(
      __dirname,
      '../.crpack/templates/systemd/daemon.service'
    );
    this.error = '[error]';
    this.info = '[info]';
    this.warning = '[warning]';
    this.renewAll = false;
    this.nginxRegex = /nginx\/\d+\.\d+\.\d+/;
  }

  /**
   * Run spawn command
   * @param {{ command: string, args: string[], options?: any, onData?: () => void }} props
   * @returns {Promise<ResultUndefined>}
   */
  async getSpawn(props) {
    const { command, args, options, onData } = props;
    console.info(Dim, `$ ${command} ${args.join(' ')}`, Reset);
    const sh = spawn.call('sh', command, args, options || {});
    sh.stdout.pipe(process.stdout);
    let errorData = '';
    let _data = '';
    return await new Promise((resolve, reject) => {
      let subs = false;
      sh.stdout?.on('data', (data) => {
        _data += data.toString();
        if (!subs && onData) {
          subs = true;
          onData();
        }
      });
      sh.stderr?.on('data', (err) => {
        const str = err.toString();
        if (command === 'nginx' && this.nginxRegex.test(str)) {
          _data = str;
        } else if (command === 'systemctl' && (args[0] === 'enable' || args[0] === 'disable')) {
          _data = str;
        } else {
          errorData += str;
        }
      });
      sh.on('error', (err) => {
        if (/AbortError/.test(err)) {
          resolve(0);
        } else {
          reject(err);
        }
      });
      sh.on('close', (code) => {
        if (
          /Saving debug log/.test(errorData) &&
          !/error/.test(errorData) &&
          !/failed/.test(errorData)
        ) {
          console.info(this.info, Cyan, Dim, errorData, Reset);
          resolve(0);
        }
        resolve(_data || code);
      });
    }).catch((e) => {
      console.log('Error spawn', e);
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
      if (!this.fileExists(this.cacheDefaultUserNginxConfig) || this.renewDefault) {
        this.writeFile(this.cacheDefaultUserNginxConfig, cData);
      }
      this.writeFile(this.nginxTmpPath, cData);
    }
    return cData;
  }

  /**
   *
   * @param {string} filePath
   * @returns {boolean}
   */
  fileExists(filePath) {
    return fs.existsSync(filePath);
  }

  /**
   * @returns {Promise<Result>}
   */
  async setNginxVersion() {
    const command = 'nginx';
    const args = ['-v'];
    const nginxRes = await this.getSpawn({
      command,
      args,
    });
    if (nginxRes === 1 || nginxRes === undefined) {
      return 1;
    } // noconsole

    if (typeof nginxRes === 'string') {
      const nginxV = nginxRes.match(this.nginxRegex);
      this.nginxVersion = nginxV ? nginxV[0] : null;
    }
    return 0;
  }

  /**
   * Parse nginx.conf file
   * @param {string} configPath
   * @returns {Promise<Object | 1>}
   */
  async getNginxConfig(configPath) {
    if (!this.nginxVersion) {
      const nginxV = await this.setNginxVersion();
      if (nginxV === 1) {
        return 1;
      }
      console.info(this.info, `Nginx version: ${this.nginxVersion}`);
    }
    await this.cacheUserNginxConfig();
    return new Promise((resolve) => {
      parser.readConfigFile(
        configPath,
        (err, res) => {
          if (err) {
            console.error(this.error, Red, `Error parse nginx config by path:`, configPath, Reset);
            resolve(1);
          }
          resolve(res);
        },
        { parseIncludes: false }
      );
    });
  }

  /**
   *
   * @typedef {{
   *  _ini: {
   *   sections: {
   *     name: string;
   *     value: string;
   *     options: Ini['_ini']['sections'];
   *   }[];
   *  }
   * }} Ini
   */

  /**
   * @typedef {1 | Ini} IniErr
   * @returns {Promise<IniErr>}
   */
  async getSystemConfig() {
    const npmPath = await this.setNpmPath();
    if (npmPath === 1) {
      return 1;
    }

    const iniContent = fs.readFileSync(this.templateSystemdConfig).toString();
    /**
     * @type {any}
     */
    const data = _parser.parse(iniContent);
    /**
     * @type {Ini}
     */
    const _data = { ...data };

    _data._ini.sections = data._ini.sections.map((item) => this.changeSystemdItem(item));
    return _data;
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async setNpmPath() {
    const npmPath = await this.getSpawn({
      command: 'which',
      args: ['npm'],
    });
    if (npmPath === 1 || npmPath === undefined) {
      return 1;
    }
    if (typeof npmPath === 'string') {
      console.info(this.info, 'Npm path:', Cyan, npmPath, Reset);
      this.npmPath = path.normalize(npmPath.replace(/\/npm/, '')).replace(/\n/, '');
    }
    return 0;
  }

  /**
   *
   * @param {Object} item
   * @returns {Object}
   */
  restartChangeSystemdItem(item) {
    const { name, options } = item;
    return {
      name,
      options: options.map((_item) => this.changeSystemdItem(_item)),
    };
  }

  /**
   *
   * @param {Object} item
   */
  changeSystemdItem(item) {
    const _item = { ...item };
    const { name, value } = item;
    switch (name) {
      case 'Unit':
        return this.restartChangeSystemdItem(item);
      case 'Service':
        return this.restartChangeSystemdItem(item);
      case 'Install':
        return this.restartChangeSystemdItem(item);
      case 'Description':
        if (!this.packageJsonConfig.description && this.traceWarnings) {
          console.warn(
            this.warning,
            Yellow,
            `Property description is missing in package.json ${Reset}`
          );
        }
        _item.value =
          this.packageJsonConfig.description || `CrPack application ${this.packageName}`;
        break;
      case 'Environment':
        if (/^PATH/.test(value)) {
          const clearItem = _item.value.replace(`:${this.npmPath}`, '');
          _item.value = `${clearItem}:${this.npmPath}`;
        } else if (/^NODE_ENV/.test(value)) {
          _item.value = `NODE_ENV=${this.nodeEnv}`;
        } else if (/^PORT/.test(value)) {
          _item.value = `PORT=${this.port}`;
        }
        break;
      case 'WorkingDirectory':
        _item.value = this.pwd;
        break;
      case 'ExecStart':
        _item.value = `${this.npmPath}/npm run start`;
        break;
      case 'SyslogIdentifier':
        _item.value = this.packageName;
    }
    return _item;
  }

  /**
   *
   * @param {Ini['_ini']['sections']} data
   * @returns
   */
  createIniFile(data) {
    data.map((item) => {
      const { name, options, value } = item;
      if (options) {
        if (options.length !== 0) {
          this.ini += `[${name}]${delimiter}`;
          // recursive
          return this.createIniFile(options);
        }
      }
      if (name !== '__DEFAULT_SECTION__') {
        this.ini += `${name}=${value}${delimiter}`;
      }
    });
    return this.ini;
  }

  /**
   * set package.json config
   * @param {string} configPath
   */
  setPackageJson(configPath) {
    let result;
    try {
      result = fs.readFileSync(configPath).toString();
    } catch (err) {
      console.error(this.error, Red, `${configPath} not found `, Reset);
      return 1;
    }
    this.packageJsonConfig = JSON.parse(result);
  }

  /**
   *
   */
  setPackageJsonSelf() {
    const result = fs.readFileSync(path.resolve(__dirname, '../package.json')).toString();
    this.packageJsonSelf = JSON.parse(result);
  }

  /**
   * Set global package name
   * @returns {Promise<string | 1>}
   */
  async setPackage() {
    const setRes = this.setPackageJson(this.configPath);
    if (setRes === 1) {
      return 1;
    }
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });
    const { name } = this.packageJsonConfig;
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
    if (fs.existsSync(this.cacheDefaultUserNginxConfig) && this.traceWarnings) {
      console.warn(
        this.warning,
        Yellow,
        Dim,
        `Configuration of nginx user was cached earlier in ${this.cacheDefaultUserNginxConfig},
to change run with the option:${Reset}${Bright} --renew-default`,
        Reset
      );
    }
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
    if (this.traceWarnings) {
      console.warn(
        this.warning,
        Yellow,
        Dim,
        `To change default domain
 add property ${Reset}${Bright} homepage ${Reset}${Yellow} ${Yellow}${Dim} into your ${Reset}${Bright} package.json`,
        Reset
      );
    }
    console.info(
      this.info,
      Bright,
      'Make sure that hosting zone have A record with IP of this server',
      Reset
    );
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });
    const { homepage } = this.packageJsonConfig;
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
   * @param {ReturnType<parser['readConfigFile']>} nginxConfig
   * @returns
   */
  async writeNginxConfig(filePath, nginxConfig) {
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

  /**
   *
   * @param {string} data
   */
  writeSystemdConfig(data) {
    this.writeFile(
      this.prod || this.test
        ? path.normalize(`${this.systemdConfigDir}/${this.packageName}.service`)
        : './tmp/daemon.service',
      data
    );
  }

  /**
   *
   * @param {ReturnType<parser['readConfigFile']>} nginxConfig
   * @param {boolean} subConfig
   * @returns {Promise<ReturnType<parser['readConfigFile']>>}
   */
  async createNginxFile(nginxConfig, subConfig = false) {
    // TODO rewrite
    const confDValue = 'conf.d/*.conf';
    let _nginxConfig = { ...nginxConfig };

    const { http } = nginxConfig;
    const { http: _http } = _nginxConfig;

    const confDPath = `${this.nginxPath}/conf.d`;
    const confDItems = fs.readdirSync(confDPath);
    if (confDItems.length !== undefined) {
      const theSameProm = confDItems.map((item) => this.getNginxConfig(`${confDPath}/${item}`));
      const theSame = await Promise.all(theSameProm);
      const _theSame = theSame.map((item, index) => {
        if (item.server) {
          if (item.server.server_name === this.domain) {
            this.nginxConfigDPath = `${this.nginxPath}/conf.d/${confDItems[index]}`;
            return item.server;
          }
        }
      });
      if (!_theSame) {
        this.nginxConfigDPath = `${this.nginxPath}/conf.d/${this.domain}.conf`;
      }
    }

    const keys = Object.keys(http);
    let confD = false;
    let serverC = false;
    for (let i = 0; keys[i]; i++) {
      const key = keys[i];
      const values = http[key];
      switch (key) {
        case 'include':
          if (typeof values !== 'string') {
            values.map((value) => {
              if (value === confDValue) {
                confD = true;
              }
            });
          } else {
            if (values === confDValue) {
              confD = true;
            }
          }
          break;
        case 'server':
          if (typeof values.length !== 'undefined') {
            const allPromises = await values.map(async (value) => {
              if (value.server_name === this.domain) {
                serverC = true;
                return this.changeNginxServerSection(value);
              }
              return value;
            });
            _nginxConfig.http.server = await Promise.all(allPromises);
          } else {
            if (values !== undefined) {
              if (values.server_name === this.domain) {
                serverC = true;
                _nginxConfig.http.server = await this.changeNginxServerSection(values);
              }
            }
          }
          break;
      }
    }
    // add include conf.d if needed
    if (!confD) {
      if (typeof _http.include === 'string') {
        if (_http.include !== confDValue) {
          _http.include = [_http.include, confDValue];
        }
      } else {
        _http.include.push(confDValue);
      }
    }
    // get server config from conf.d
    if (!serverC) {
      await this.changeNginxServerSection();
    }

    return _nginxConfig.http.server;
  }

  /**
   *
   * @returns {number | string}
   */
  getTmpNginx() {
    let result;
    try {
      result = fs.readFileSync(this.nginxTmpPath).toString();
    } catch (e) {
      console.error(this.error, e);
      result = 1;
    }
    return result;
  }

  /**
   *
   * @returns {number}
   */
  writeTmpNginx() {
    let result = 0;
    const data = this.getTmpNginx();
    if (typeof data !== 'string') {
      return 1;
    }
    try {
      fs.writeFileSync(this.nginxConfigPath, data);
    } catch (e) {
      console.error(this.error, e);
      result = 1;
    }
    return result;
  }

  /**
   *
   * @param {Object | undefined} server
   * @returns {Promise<1 | ReturnType<parser['readConfigFile']>['server']>}
   */
  async changeNginxServerSection(server = undefined) {
    let _server = server ? { ...server } : undefined;
    const confDPath = `${this.nginxPath}/conf.d/`;
    const serverPath = `${confDPath}${this.domain}.conf`;
    const nginxTemplatePath = path.resolve(__dirname, '../.crpack/templates/nginx/server.conf');
    const nginxTemplate = await this.getNginxConfig(nginxTemplatePath);
    let _serverPath = '';
    // when server with same name is not found into nginx.conf
    if (!server) {
      _server = fs.existsSync(serverPath) ? await this.getNginxConfig(serverPath) : 1;
      _server = _server !== 1 ? _server.server : 1;
      if (_server === 1) {
        const serverPaths = fs.readdirSync(confDPath);
        let exsists = false;
        const sProm = serverPaths.map((item) => {
          const confPath = path.resolve(confDPath, item);
          return this.getNginxConfig(confPath);
        });
        const s = await Promise.all(sProm);
        s.map((item, index) => {
          if (item.server) {
            if (item.server.server_name === this.domain) {
              _server = item.server;
              _serverPath = serverPaths[index];
            }
          }
        });
        if (!exsists) {
          _serverPath = serverPath;
          _server = { ...nginxTemplate.server };
        }
      } else if (fs.existsSync(serverPath)) {
        _serverPath = serverPath;
      }
    }
    this.nginxConfigDPath =
      _serverPath && this.nginxConfigDPath
        ? this.nginxConfigDPath
        : _serverPath
        ? /^\//.test(_serverPath)
          ? _serverPath
          : `${this.nginxPath}/conf.d/${_serverPath}`
        : this.nginxConfigPath;
    if (!this.nginxConfigDPath) {
      console.warn(this.warning, Yellow, `Server file path is ${_serverPath}`, Reset);
      console.error(this.error, Red, 'Config path is missing', Reset);
      return 1;
    }

    if (!_server) {
      _server = { ...nginxTemplate.server };
    }
    // change nginx.http.server values
    const keys = Object.keys(nginxTemplate.server);
    for (let i = 0; keys[i]; i++) {
      const key = keys[i];
      const field = nginxTemplate.server[key];
      let value = '';
      switch (key) {
        case 'server_name':
          value = this.domain;
          _server[key] = value;
          break;
        case 'access_log':
          value = `/var/log/nginx/${this.domain}.access.log`;
          _server[key] = value;
          break;
        case 'error_log':
          value = `/var/log/nginx/${this.domain}.error.log`;
          _server[key] = value;
          break;
        case 'location /':
          Object.keys(nginxTemplate.server[key]).map((_key) => {
            if (!_server[key]) {
              _server[key] = {};
            }
            if (_key === 'proxy_pass') {
              _server[key][_key] = `http://localhost:${this.port}`;
            } else {
              _server[key][_key] = nginxTemplate.server[key][_key];
            }
          });
          break;
        default:
          value = field;
      }
    }
    // write conf.d/*.conf file
    if (!server) {
      if (!this.fileExists(serverPath) && serverPath === this.nginxConfigDPath) {
        this.writeFile(serverPath, '');
      }
      parser.writeConfigFile(
        this.prod || this.test
          ? this.nginxConfigDPath
          : path.resolve(__dirname, '../tmp/server.conf'),
        {
          server: _server,
        },
        true
      );
    }

    return _server;
  }

  /**
   * Simple read a file
   * @param {string} filePath
   * @returns
   */
  readFile(filePath) {
    /**
     * @type {ResultString}
     */
    let result = 1;
    try {
      result = fs.readFileSync(filePath).toString();
    } catch (e) {
      console.error(this.error, Red, 'Error read file', Reset, e);
    }
    return result;
  }

  /**
   * Simple write a file
   * @param {string} filePath
   * @param {string} data
   * @returns {ResultVoid}
   */
  writeFile(filePath, data) {
    /**
     * @type {ResultVoid}
     */
    let result = 1;
    try {
      result = fs.writeFileSync(filePath, data);
    } catch (e) {
      console.error(this.error, Red, 'Error write file', Reset, e);
    }
    return result;
  }

  /**
   *
   * @param {string | string[]} dirPath
   */
  createDir(dirPath) {
    let result = 0;
    if (typeof dirPath === 'string') {
      try {
        if (!this.fileExists(dirPath)) {
          fs.mkdirSync(dirPath);
        }
      } catch (e) {
        console.error(this.error, Red, 'Error create dir', Reset, e);
        result = 1;
      }
      return result;
    }
    const _result = dirPath.map((_dirPath) => {
      try {
        if (!this.fileExists(_dirPath)) {
          fs.mkdirSync(_dirPath);
        }
      } catch (e) {
        console.error(this.error, Red, 'Error create dir', Reset, e);
        return 1;
      }
      return 0;
    });
    const resArr = _result.filter((item) => (item === 1 ? item : undefined));
    if (resArr.length !== 0) {
      return 1;
    }
  }

  /**
   *
   * @param {string} filePath
   * @returns {NumberUndefined}
   */
  getFileSize(filePath) {
    if (!this.fileExists(filePath)) {
      return undefined;
    }
    const stats = fs.statSync(filePath);
    return stats.size;
  }

  /**
   * @typedef {fs.ReadStream | 1} ResultReadStream
   * @param {string} fileName
   * @returns {ResultReadStream}
   */
  getReadSteam(fileName) {
    /**
     * @type {ResultReadStream}
     */
    let readStream;
    try {
      readStream = fs.createReadStream(fileName);
    } catch (e) {
      console.error(this.error, Red, 'Error create read stream of file', fileName, Reset, e);
      return 1;
    }
    return readStream;
  }

  /**
   *
   * @param {string} fileName
   * @param {string} line
   * @returns {Result}
   */
  appendLine(fileName, line) {
    /**
     * @type {Result}
     */
    let result = 0;
    try {
      fs.appendFileSync(fileName, `${line}\n`);
    } catch (e) {
      console.error(this.error, Red, 'Error append line to file', fileName);
      result = 1;
    }
    return result;
  }

  /**
   * try run application before restart service
   * @returns {Promise<Result>}
   */
  async restartService() {
    const daemonReload = await this.getSpawn({
      command: 'systemctl',
      args: ['daemon-reload'],
    });
    if (daemonReload === 1 || daemonReload === undefined) {
      return 1;
    }
    const startTime = new Date().getTime();
    const controller = new AbortController();
    const { signal } = controller;
    if (!this.packageJsonConfig.scripts) {
      console.error(this.error, Red, 'Property "scripts" is missing on package.json');
      return 1;
    }
    if (!this.packageJsonConfig.scripts.start) {
      console.error(this.error, Red, 'Property "scripts.start" is missing on package.json');
      return 1;
    }

    this.packageName = this.packageJsonConfig.name;
    /**
     * @type {ResultUndefined}
     */
    let preStartPackage = 1;
    if (!this.rawPackage) {
      preStartPackage = await this.getSpawn({
        command: `${this.npmPath}/npm`,
        args: ['run', 'test'],
        options: {
          cwd: this.pwd,
          signal,
          env: {
            PORT: 5151, // TODO check free port
            NODE_ENV: process.env.NODE_ENV,
            PATH: process.env.PATH,
          },
        },
        onData: () => {
          setTimeout(() => {
            controller.abort();
          }, MAXIMUM_WAIT_ABORT);
        },
      });
      if (preStartPackage === 1) {
        if (!this.rawPackage) {
          return 1;
        }
      }
    }

    if (this.rawPackage && preStartPackage !== 0) {
      return await this.fromRawPackage();
    } else {
      if (this.traceWarnings) {
        console.warn(
          this.warning,
          Yellow,
          Dim,
          `Maybe need create package from raw?`,
          Reset,
          'crpack --raw /path/to/clone/of/package.json'
        );
      }
    }

    if (new Date().getTime() - startTime < MINIMUM_WAIT_ABORT) {
      console.error(
        this.error,
        Red,
        `Application down after running time less than ${MINIMUM_WAIT_ABORT / 1000} second(s)`,
        Reset
      );
      return 1;
    }

    const startPackage = await this.getSpawn({
      command: 'systemctl',
      args: ['restart', this.packageName],
    });
    if (startPackage === 1 || startPackage === undefined) {
      return 1;
    }

    const statusPackage = await this.getSpawn({
      command: 'systemctl',
      args: ['status', this.packageName],
    });
    if (statusPackage === 1 || statusPackage === undefined) {
      return 1;
    }

    return 0;
  }

  /**
   * TODO add logic if pull not success
   * @param {string} repository
   * @param {string} branch
   * @returns {Promise<ResultUndefined>}
   */
  async pull(repository, branch = 'master') {
    const chRes = await this.getSpawn({
      command: 'git',
      args: ['checkout', '.'],
      options: {
        cwd: this.pwd,
      },
    });
    if (chRes === 1) {
      return 1;
    }

    const res = await this.getSpawn({
      command: 'git',
      args: ['pull', `${repository}`, branch],
      options: {
        cwd: this.pwd,
      },
    });
    if (res === 1) {
      return 1;
    }
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async fromRawPackage() {
    const projectDir = fs.readdirSync(this.pwd);
    if (projectDir.length !== 0) {
      const pullRes = await this.pull(this.packageJsonConfig.repository);
      if (pullRes === 1) {
        return 1;
      }
    } else {
      const cloneRes = await this.clone();
      if (cloneRes === 1) {
        return 1;
      }
    }

    const _installRes = await this.installDependencies();
    if (_installRes === 1) {
      return 1;
    }

    const _buildRes = await this.buildPackage();
    if (_buildRes === 1) {
      return 1;
    }
    this.rawPackage = false;
    // restart of restart
    return await this.restartService();
  }

  async clone() {
    const cloneRes = await this.getSpawn({
      command: 'git',
      args: ['clone', this.packageJsonConfig.repository, this.pwd],
    });
    if (cloneRes === 1) {
      return 1;
    }
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async buildPackage() {
    const buildRes = await this.getSpawn({
      command: `${this.npmPath}/npm`,
      args: ['run', 'build'],
      options: {
        cwd: this.pwd,
        env: this.getEnv('production'),
      },
    });
    if (buildRes === 1) {
      return 1;
    }
    return 0;
  }

  /**
   *
   * @param {string} _path
   * @returns
   */
  getEnv(_path) {
    return {
      CWD: this.pwd,
      PWD: this.pwd,
      NODE_ENV: process.env.NODE_ENV || _path,
      PATH: `/sbin:/bin:/usr/sbin:/usr/bin:${this.npmPath.replace(/\/npm/, '')}`,
    };
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async installDependencies() {
    const installRes = await this.getSpawn({
      command: `${this.npmPath}/npm`,
      args: ['install', '--legacy-peer-deps'],
      options: {
        cwd: this.pwd,
        env: this.getEnv('development'),
      },
    });
    if (installRes === 1 || installRes === undefined) {
      return 1;
    }
    return 0;
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async gitCheckout() {
    const installRes = await this.getSpawn({
      command: 'git',
      args: ['checkout', '.'],
      options: {
        cwd: this.pwd,
      },
    });
    if (installRes === 1 || installRes === undefined) {
      return 1;
    }
    return 0;
  }

  /**
   *
   * @param {number} time
   */
  async wait(time) {
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(0);
      }, time);
    });
  }

  /**
   *
   * @param {string} dirPath
   * @returns {ResultArrayString}
   */
  readDir(dirPath) {
    let result = [];
    try {
      result = fs.readdirSync(dirPath);
    } catch (e) {
      console.error(this.error, Red, 'Error read dir', Reset, Bright, dirPath, Reset, e);
      return 1;
    }
    return result;
  }

  /**
   * @typedef {(data: string) => string} OnLineHandler
   * @param {string} cronPath
   * @param {OnLineHandler} cb
   * @returns {Promise<ResultString>}
   */
  async readByLines(cronPath, cb) {
    const fileStream = this.getReadSteam(cronPath);
    if (fileStream === 1) {
      return 1;
    }
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });
    return new Promise((resolve) => {
      let lines = '';
      setTimeout(() => {
        resolve(lines);
      }, 1000);
      rl.on('line', (data) => {
        lines += cb(data);
      });
    });
  }
};
