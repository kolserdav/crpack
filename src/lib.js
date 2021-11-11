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

  constructor() {
    this.pwd = process.env.PWD;
    this.npmPackageVersion;
    this.nginxPath = process.env.NGINX_PATH || '/etc/nginx';
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
    return await new Promise((resolve, reject) => {
      sh.stdout?.on('data', (data) => {
        const str = data.toString();
        resolve(str);
      });
      sh.stderr?.on('data', (err) => {
        const str = err.toString();
        if (command === 'nginx' && this.nginxRegex.test(str)) {
          resolve(str);
        } else if (command === 'systemctl' && (args[0] === 'enable' || args[0] === 'disable')) {
          resolve(str);
        } else {
          console.error(this.error, `Run command return with error ${command}`, Red, str, Reset);
          reject(str);
        }
      });
      sh.on('error', (err) => {
        console.error(this.error, `Run command error ${command}`, err);
        reject(err);
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
   * @returns {Promise<Ini>}
   */
  async getSystemConfig() {
    const npmPath = await this.getSpawn({
      command: 'which',
      args: ['npm'],
    }).catch(() => {
      return 1;
    });
    this.npmPath = path.normalize(npmPath.replace(/\/npm/, '')).replace(/\n/, '');

    const fileName = `${this.systemdConfigDir}${this.packageName}.service`;
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

    _data._ini.sections = data._ini.sections.map((item) => this.changeSystemdItem(item));
    return _data;
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
          _item.value = `NODE_ENV=${process.env.NODE_ENV || 'production'}`;
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
   */
  setPackageJson() {
    let result;
    try {
      result = fs.readFileSync(this.configPath).toString();
    } catch (err) {
      console.error(this.error, Red, `${this.configPath} not found `, Reset);
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
   * @returns {Promise<string>}
   */
  async setPackage() {
    this.setPackageJson();
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
    } else {
      const { http } = nginxConfig;
      const { http: _http } = _nginxConfig;

      if (http !== undefined && !http.server) {
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
          if (_theSame) {
            if (_theSame[0]) {
              return _theSame[0];
            }
          }
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
    }
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
        ? `${this.nginxPath}/conf.d/${_serverPath}`
        : '';
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
      if (!fs.existsSync(serverPath) && serverPath === this.nginxConfigDPath) {
        fs.writeFileSync(serverPath, '');
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
};
