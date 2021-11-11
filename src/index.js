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

const Worker = require('./lib');

const Red = '\x1b[31m';
const Reset = '\x1b[0m';
const Bright = '\x1b[1m';
const Yellow = '\x1b[33m';
const Green = '\x1b[32m';
const Dim = '\x1b[2m';
const Blink = '\x1b[5m';

class Factory extends Worker {
  /**
   * @type {string} - current command
   */
  arg;

  /**
   * @type {string} - name of package
   */
  name;

  /**
   * @type {string} - version of package
   */
  version;

  /**
   * @type {string} - help result
   */
  help;

  /**
   * @type {boolean}
   */
  traceWarnings;

  /**
   * @type {boolean} - renew the default cache of config
   */
  renewDefault;

  /**
   * @type {boolean}
   */
  disabled;

  /**
   * Commands
   * @type {{
   *  showDefault: 'show-default';
   *  run: 'run';
   * }}
   */
  props = {
    showDefault: 'show-default',
    run: 'run',
  };

  /**
   * Parameters
   *  @type {{
   *  traceWarnings: '--trace-warnings';
   *  renewDefault: '--renew-default';
   *  test: '--test';
   *  port: '--port';
   *  disabled: '--disabled';
   * }}
   */
  params = {
    traceWarnings: '--trace-warnings',
    renewDefault: '--renew-default',
    test: '--test',
    port: '--port',
    disabled: '--disabled',
  };

  constructor() {
    super();
    const controller = new AbortController();
    const { signal } = controller;
    this.arg = process.argv[2];
    const argv = process.argv;
    this.setPackageJsonSelf();
    this.disabled = false;
    this.version = `CrPack version ${this.packageJsonSelf.version}`;
    this.help = `
    ${this.version}
> crpack [options] <command>   

COMMANDS:
  run: start create package script
  show-default: show default nginx config

OPTIONS:
  -h | --help: show this man 
  -v | --version: show CrPack version
  --trace-warnings: show all warnings
  --renew-default: rewrite default cache nginx file
  --test: run in dev as prod
  --port: local application port
  --disabled: don't add package to autorun 

ENVIRONMENT:
  NGINX_PATH: [/etc/nginx]
  NODE_ENV: [production]
  `;
    const { showDefault, run } = this.props;

    /**
     * Commands
     */
    if (argv.indexOf(run) !== -1) {
      this.arg = run;
      this.setAdditional();
    }
    if (argv.indexOf(showDefault) !== -1) {
      this.arg = showDefault;
    }
  }

  /**
   * Options
   */
  setAdditional() {
    const argv = process.argv;
    const { traceWarnings, renewDefault, test, port, disabled } = this.params;
    if (argv.indexOf(traceWarnings) !== -1) {
      this.traceWarnings = true;
    }
    if (argv.indexOf(renewDefault) !== -1) {
      this.renewDefault = true;
    }
    if (argv.indexOf(test) !== -1) {
      this.test = true;
    }
    if (argv.indexOf(disabled) !== -1) {
      this.disabled = true;
    }
    const portArg = argv.indexOf(port);
    if (portArg !== -1) {
      const nextArg = process.argv[portArg + 1];
      if (!nextArg) {
        console.warn(this.warning, Yellow, 'Port value is missing while use --port option', Reset);
      }
      const nextArgNum = parseInt(nextArg, 10);
      const _isNan = Number.isNaN(nextArgNum);
      if (_isNan) {
        console.warn(
          this.warning,
          Yellow,
          'Port value is not number. Skipping change default port',
          Reset
        );
      }
      this.port = _isNan ? this.port : nextArgNum;
    }
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
    const nginxConfig = await this.getNginxConfig(this.nginxConfigPath);
    if (this.traceWarnings) {
      console.warn(
        this.warning,
        Yellow,
        `${Dim} Cache of nginx.conf based on ${this.cacheDefaultUserNginxConfig} to show run command: ${Reset}${Bright} crpack show-default ${Reset}`
      );
    }
    this.domain = await this.setDomain();
    console.info(this.info, 'Domain name:', this.domain);
    const nginxData = await this.createNginxFile(nginxConfig);
    if (nginxData !== 1) {
      await this.writeNginxConfig(
        this.prod || this.test ? this.nginxConfigPath : './tmp/nginx.conf',
        nginxData,
        this.packageName
      );
    }
    const systemdConfig = await this.getSystemConfig();
    const systemData = this.createIniFile(systemdConfig._ini.sections);
    this.writeSystemdConfig(systemData);

    const daemonReload = await this.getSpawn({
      command: 'systemctl',
      args: ['daemon-reload'],
    });
    if (daemonReload !== 0) {
      return 1;
    }

    const startPackage = await this.getSpawn({
      command: 'systemctl',
      args: ['restart', this.packageName],
    });
    if (startPackage !== 0) {
      return 1;
    }

    if (!this.disabled) {
      const enablePackage = await this.getSpawn({
        command: 'systemctl',
        args: ['enable', this.packageName],
      });
      if (typeof enablePackage === 'string') {
        console.info(this.info, enablePackage);
      } else if (enablePackage !== 0) {
        return 1;
      }
    } else {
      const enablePackage = await this.getSpawn({
        command: 'systemctl',
        args: ['disable', this.packageName],
      });
      if (typeof enablePackage === 'string') {
        console.info(this.info, enablePackage);
      } else if (enablePackage !== 0) {
        return 1;
      }
    }

    const statusPackage = await this.getSpawn({
      command: 'systemctl',
      args: ['status', this.packageName],
    });
    if (statusPackage !== undefined) {
      console.info(this.info, Dim, statusPackage, Reset);
    }

    return 0;
  }

  /**
   * Commands map
   */
  async run() {
    let pName;
    switch (this.arg) {
      case this.props.showDefault:
        const result = await this.getSpawn({
          command: 'cat',
          args: [this.cacheDefaultUserNginxConfig],
        });
        console.info(result);
        break;
      case '-h':
        console.info(this.help);
        break;
      case '--help':
        console.info(this.help);
        break;
      case this.props.run:
        console.info(this.info, Reset, 'Started create system package script...');
        const code = await this.createPackage();
        if (code !== 1) {
          console.info(this.info, Green, `Package ${this.domain} created successfully!`, Reset);
        } else {
          console.warn(this.warning, Yellow, 'Create package return error');
        }
        break;
      case '-v':
        console.info(this.version);
        break;
      case '--version':
        console.info(this.version);
        break;
      default:
        console.info(
          this.error,
          `Unknown command ${this.arg}
Try run ${Bright} crpack -h
      `,
          Reset
        );
    }
    process.exit(0);
  }
}

const r = new Factory();

(async () => {
  await r.run();
})();
