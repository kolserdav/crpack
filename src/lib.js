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

const delimiter = '\n';
const { stdin, stdout } = process;
const parser = new ConfigParser();
const _parser = new ConfigIniParser(delimiter);

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

  constructor() {
    this.pwd = process.env.PWD;
    this.npmPackageVersion = process.env.NPM_PACKAGE_VERSION;
    this.nginxPath = process.env.NGINX_PATH || '/etc/nginx';
    this.nginxConfigPath = `${this.nginxPath}/nginx.conf`;
    this.systemdConfigDir = '/etc/systemd/system/';
    this.domain = 'example.com';
    this.ini = '';
    this.test = false;
    this.nginxVersion = '';
    this.traceWarnings = false;
    this.renewDefault = false;
    this.prod = path.relative(this.pwd, __dirname) !== 'src';
    this.root = this.prod ? this.pwd : './';
    this.configPath = path.resolve(this.pwd, this.root, 'package.json');
    this.cacheDefaultUserNginxConfig = path.resolve(__dirname, '../.crpack/nginx.conf');
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
   * @param {{ command: string, args: string[], options?: any }} props
   * @returns {Promise<any>}
   */
  async getSpawn(props) {
    const { command, args, options } = props;
    console.info(Dim, `${command} ${args.join(' ')}`, Reset);
    const sh = spawn.call('sh', command, args, options || {});
    sh.stdout.pipe(process.stdout);
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
      if (!fs.existsSync(this.cacheDefaultUserNginxConfig) || this.renewDefault) {
        fs.writeFileSync(this.cacheDefaultUserNginxConfig, cData);
      }
    }
    return cData;
  }

  /**
   *
   */
  async setNginxVersion() {
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
    this.nginxVersion = nginxV ? nginxV[0] : null;
  }

  /**
   * Parse nginx.conf file
   * @param {string} configPath
   * @returns {Promise<Object | 1>}
   */
  async getNginxConfig(configPath) {
    if (!this.nginxVersion) {
      await this.setNginxVersion();
      console.info(this.info, `Nginx version: ${this.nginxVersion}`);
    }
    if (!this.nginxVersion) {
      console.warn(
        this.warning,
        Yellow,
        'Nginx is not installed, please install nginx and try again',
        Reset
      );
      return 1;
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
   *
   * @returns {Ini}
   */
  getSystemConfig() {
    const fileName = `${this.systemdConfigDir}${this.domain}.service`;
    let iniContent;
    if (fs.existsSync(fileName)) {
      iniContent = fs.readFileSync(fileName).toString();
    } else {
      iniContent = fs.readFileSync(this.templateSystemdConfig).toString();
    }
    /**
     * @type {any}
     */
    const data = _parser.parse(iniContent);
    /**
     * @type {Ini}
     */
    const _data = { ...data };
    data._ini.sections.map((item) => {
      /**todo */
    });
    return data;
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
    const rl = readline.createInterface({
      input: stdin,
      output: stdout,
    });
    const { homepage } = this.packageJson();
    const homePage = homepage
      ? homepage.replace(/https?:\/\//, '').replace(/\//g, '')
      : this.domain;
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

  /**
   *
   * @param {string} data
   */
  writeSystemdConfig(data) {
    fs.writeFileSync(
      this.prod || this.test
        ? path.normalize(`${this.systemdConfigDir}/${this.domain}.service`)
        : './tmp/daemon.service',
      data
    );
  }

  /**
   *
   * @param {ReturnType<parser['readConfigFile']>} nginxConfig
   * @param {boolean} subConfig
   * @returns {ReturnType<parser['readConfigFile']>}
   */
  createNginxFile(nginxConfig, subConfig = false) {
    const confDValue = 'conf.d/*.conf';
    let _nginxConfig = { ...nginxConfig };
    if (!_nginxConfig.http) {
      if (!subConfig) {
        console.error(
          this.error,
          Red,
          `Section http is missing on ${JSON.stringify(_nginxConfig)}`,
          Reset
        );
        return 1;
      }
      const confDPath = `${this.nginxConfigPath}/conf.d`;
      const confDItems = fs.readdirSync(confDPath);
      if (confDItems.length !== undefined) {
        confDItems.map((item) => {
          console.log(item);
        });
      }
    } else {
      const { http } = nginxConfig;
      const { http: _http } = _nginxConfig;
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
              _nginxConfig.http.server = values.map((value) => {
                if (value.server_name === this.domain) {
                  serverC = true;
                  return this.changeNginxServerSection(value);
                }
                return value;
              });
            } else {
              if (values !== undefined) {
                if (values.server_name === this.domain) {
                  serverC = true;
                  _nginxConfig.http.server = this.changeNginxServerSection(values);
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
        this.changeNginxServerSection();
      }
    }
    _nginxConfig;
    return _nginxConfig;
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
        serverPaths.map(async (item) => {
          const confPath = path.resolve(confDPath, item);
          const s = await this.getNginxConfig(confPath);
          if (s !== 1) {
            if (s.server.server_name === this.domain) {
              exsists = true;
              _server = s.server;
              _serverPath = confPath;
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

    const keys = Object.keys(_server);
    for (let i = 0; keys[i]; i++) {
      const key = keys[i];
      const field = _server[key];
      let value = '';
      switch (key) {
        case 'server_name':
          value = this.domain;
          break;
        case 'access_log':
          value = `/var/log/nginx/${this.domain}.access.log`;
          break;
        case 'error_log':
          value = `/var/log/nginx/${this.domain}.error.log`;
          break;
        case 'location /':
          Object.keys(_server[key]).map((_key) => {
            if (_key === 'proxy_pass') {
              _server[key][_key] = `http://localhost:${this.port}`;
            }
          });
          break;
        default:
          value = field;
      }
      _server[key] = value;
    }
    // todo
    return _server;
  }
};
