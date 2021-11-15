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

const path = require('path');
const Worker = require('./lib');
const Employer = require('./git');

const git = new Employer();

const Red = '\x1b[31m';
const Reset = '\x1b[0m';
const Bright = '\x1b[1m';
const Yellow = '\x1b[33m';
const Green = '\x1b[32m';
const Dim = '\x1b[2m';
const Blue = '\x1b[34m';
const Cyan = '\x1b[36m';
const Blink = '\x1b[5m';

/**
 * @typedef {1 | void} ResultVoid
 * @typedef {1 | 0} Result
 */

class Factory extends Worker {
  /**
   * @type {string} - current command
   */
  arg;

  /**
   * @type {boolean}
   */
  ssl;

  /**
   * @type {boolean}
   */
  git;

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
   *  update: 'update';
   * }}
   */
  props = {
    showDefault: 'show-default',
    run: 'run',
    update: 'update',
  };

  /**
   * @type {string}
   */
  certbotExe;

  /**
   * Parameters
   *  @type {{
   *  traceWarnings: '--trace-warnings';
   *  renewDefault: '--renew-default';
   *  test: '--test';
   *  port: '--port';
   *  disabled: '--disabled';
   *  nginxPath: '--nginx-path';
   *  nodeEnv: '--node-env';
   *  certbotPath: '--certbot-path';
   *  ssl: '--ssl';
   *  git: '--git';
   *  cwd: '--cwd';
   *  raw: '--raw';
   * }}
   */
  params = {
    traceWarnings: '--trace-warnings',
    renewDefault: '--renew-default',
    test: '--test',
    port: '--port',
    disabled: '--disabled',
    nginxPath: '--nginx-path',
    nodeEnv: '--node-env',
    certbotPath: '--certbot-path',
    ssl: '--ssl',
    git: '--git',
    cwd: '--cwd',
    raw: '--raw',
  };

  constructor() {
    super();
    this.arg = process.argv[2];
    this.ssl = false;
    this.git = false;
    this.certbotExe = '/snap/bin/certbot';
    this.setPackageJsonSelf();
    this.disabled = false;
    this.version = `CrPack version: ${this.packageJsonSelf.version}`;
    this.help = `
    ${this.version}
> crpack [options] <command>   

COMMANDS:
  run: start create package script
  show-default: show default nginx config
  update: update git local commit

OPTIONS:
  -h | --help: show this man 
  -v | --version: show CrPack version
  --trace-warnings: show all warnings
  --renew-default: rewrite default cache nginx file
  --test: run in dev as prod
  --port [number]: local application port
  --disabled: don't add package to autorun
  --node-env [development | production]: application NODE_ENV
  --nginx-path [absolute path]: nginx path  
  --ssl: create certificate with certbot
  --git: connect git server to automatic CI
  --cwd [absolute path]: set project root
  --raw [absolute path or 'root']: path to clone of package.json from outside of project 
  `;
  }

  commands() {
    const argv = process.argv;
    const { showDefault, run, update } = this.props;

    if (argv.indexOf(run) !== -1) {
      this.arg = run;
      const additiotals = this.arguments();
      if (additiotals === 1) {
        return 1;
      }
    }
    if (argv.indexOf(showDefault) !== -1) {
      this.arg = showDefault;
    }
    if (argv.indexOf(update) !== -1) {
      this.arg = update;
    }
  }

  /**
   * @returns {ResultVoid}
   */
  arguments() {
    const argv = process.argv;
    const {
      traceWarnings,
      renewDefault,
      test,
      port,
      disabled,
      nginxPath,
      nodeEnv,
      certbotPath,
      ssl,
      git,
      cwd,
      raw,
    } = this.params;
    if (argv.indexOf(traceWarnings) !== -1) {
      this.traceWarnings = true;
    }
    if (argv.indexOf(ssl) !== -1) {
      this.ssl = true;
    }
    if (argv.indexOf(git) !== -1) {
      this.git = true;
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
      if (this.traceWarnings) {
        console.warn(
          this.warning,
          Yellow,
          Dim,
          'To port a port in your application, you must use process.env.PORT instead of static',
          Reset
        );
      }
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

    const nodeEnvArg = argv.indexOf(nodeEnv);
    if (nodeEnvArg !== -1) {
      const nextArg = process.argv[nodeEnvArg + 1];
      if (!nextArg) {
        console.warn(
          this.warning,
          Yellow,
          'Node env value is missing while use --node-env option',
          Reset
        );
      }
      this.nodeEnv = nextArg ? nextArg : this.nodeEnv;
    }

    const cwdArg = argv.indexOf(cwd);
    if (cwdArg !== -1) {
      const nextArg = process.argv[cwdArg + 1];
      if (!nextArg) {
        console.warn(this.warning, Yellow, 'CWD value is missing while use --cwd option', Reset);
      }
      if (nextArg) {
        if (!this.fileExists(nextArg)) {
          console.error(this.error, Red, 'Current working dir is not found', Reset, nextArg);
          return 1;
        }
      }
      this.pwd = nextArg ? nextArg : this.pwd;
    }

    const certbotPathArg = argv.indexOf(certbotPath);
    if (certbotPathArg !== -1) {
      const nextArg = process.argv[certbotPathArg + 1];
      if (!nextArg) {
        console.warn(
          this.warning,
          Yellow,
          'Certbot path value is missing while use --certbot-path option',
          Reset
        );
      }
      this.certbotExe = nextArg ? nextArg : this.certbotExe;
    }

    const nginxPathArg = argv.indexOf(nginxPath);
    if (nginxPathArg !== -1) {
      const nextArg = process.argv[nginxPathArg + 1];
      if (!nextArg) {
        console.warn(
          this.warning,
          Yellow,
          'Nginx path value is missing while use --nginx-path option',
          Reset
        );
      }
      this.nginxPath = nextArg ? nextArg : this.nginxPath;
    }

    const rawArg = argv.indexOf(raw);
    if (rawArg !== -1) {
      if (this.traceWarnings && !cwd) {
        console.warn(
          this.warning,
          Yellow,
          Dim,
          'If you need set up application in root owner dir you can use --cwd option',
          Reset,
          Bright,
          'crpack run --cwd /path/to/your/project/root'
        );
      }
      const nextArg = process.argv[rawArg + 1];
      if (!nextArg) {
        console.warn(
          this.warning,
          Yellow,
          'Link to raw package.json is missing while use --raw option',
          Reset
        );
      }
      const isRoot = nextArg === 'root';
      this.configPath = nextArg && isRoot ? this.configPath : nextArg;
      this.rawPackage = true;
    }
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async createPackage() {
    const packageName = await this.setPackage();
    if (packageName === 1) {
      return 1;
    } else {
      this.packageName = packageName;
    }
    const nginxExists = this.fileExists(this.nginxConfigPath);
    if (!nginxExists) {
      console.warn(
        this.warning,
        Yellow,
        'Nginx config not found in:',
        Reset,
        Cyan,
        this.nginxConfigPath,
        Reset
      );
    }
    this.nginxConfigPath = nginxExists ? this.nginxConfigPath : await this.setUserNginxPath();

    const setupNginx = await this.setupNginx();
    if (setupNginx === 1) {
      return 1;
    }

    const restartNginx = await this.restartNginx();
    if (restartNginx === 1) {
      return 1;
    }

    // Create ssl certificate
    if (this.ssl) {
      const certbot = await this.getSpawn({
        command: this.certbotExe,
        args: ['-d', this.domain, '--nginx'],
      });
      if (certbot === undefined || certbot === 1) {
        return 1;
      }
    }

    const setUpPack = await this.setupPackage();
    if (setUpPack === 1) {
      return 1;
    }
    if (this.git) {
      const sshConfig = await git.setSshHost();
      if (sshConfig === 1) {
        return 1;
      }

      const install = await git.create();
      if (install === 1) {
        return 1;
      }

      const secretKeyPath = await git.setSecretKeyPath();
      if (secretKeyPath === 1) {
        return 1;
      }
    }

    const installRes = await this.installDependencies();
    if (installRes === 1) {
      return 1;
    }

    await this.wait(2000);

    const buildRes = await this.buildPackage();
    if (buildRes === 1) {
      return 1;
    }

    await this.wait(4000);

    const restartRes = await this.restartService();
    if (restartRes === 1) {
      return 1;
    }

    console.info(this.info, 'Git enabled:', Blue, this.git, Reset);
    console.info(this.info, 'SSL enabled:', Blue, this.ssl, Reset);
    console.info(this.info, 'SSH config:', Blue, !this.git ? git.sshConfig : undefined, Reset);
    console.info(this.info, 'Nginx config path: ', Blue, this.nginxConfigPath, Reset);
    console.info(this.info, 'Package name:', Blue, this.packageName, Reset);
    console.info(this.info, 'Domain name:', Blue, this.domain, Reset);
    console.info(
      this.info,
      'Service config:',
      Blue,
      `${this.systemdConfigDir}${this.packageName}.service`,
      Reset
    );
    await this.versionWarning();
    return 0;
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async versionWarning() {
    const cachePackagePath = path.resolve(__dirname, '../.crpack/package.json');

    const getRaw = await this.getSpawn({
      command: 'curl',
      args: [
        '-o',
        cachePackagePath,
        'https://github.com/kolserdav/crpack/blob/master/package.json',
      ],
    });
    if (getRaw === 1) {
      return 1;
    }

    await this.wait(1000);

    const getVer = await this.getSpawn({
      command: 'curl',
      args: [
        '-o',
        cachePackagePath,
        'https://raw.githubusercontent.com/kolserdav/crpack/master/package.json',
      ],
    });
    if (getVer === 1) {
      return 1;
    }

    this.setPackageJson(path.resolve(__dirname, '../package.json'));
    const { version: currentVer } = this.packageJsonConfig;
    this.setPackageJson(cachePackagePath);
    const { version } = this.packageJsonConfig;
    if (version !== currentVer) {
      console.warn(
        Yellow,
        this.warning,
        Cyan,
        Blink,
        'New version of CrPack is now available\n',
        'Current version:',
        currentVer,
        '\n',
        'New version:',
        version,
        Reset
      );
    }
    return 0;
  }

  /**
   * @returns {Promise<Result>}
   */
  async setupNginx() {
    /**
     * @type {Result}
     */
    let result = 0;
    const nginxConfig = await this.getNginxConfig(this.nginxConfigPath);
    if (this.traceWarnings) {
      console.warn(
        this.warning,
        Yellow,
        `${Dim} Cache of nginx.conf based on ${this.cacheDefaultUserNginxConfig} to show run command: ${Reset}${Bright} crpack show-default ${Reset}`
      );
    }
    this.domain = await this.setDomain();
    const nginxData = await this.createNginxFile(nginxConfig);
    if (nginxData === 1) {
      return 1;
    }
    return result;
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async setupPackage() {
    const systemdConfig = await this.getSystemConfig();
    if (systemdConfig === 1 || systemdConfig === undefined) {
      return 1;
    }
    const systemData = this.createIniFile(systemdConfig._ini.sections);
    this.writeSystemdConfig(systemData);

    /**
     * @type {Result}
     */
    let result = 0;
    if (!this.disabled) {
      const enablePackage = await this.getSpawn({
        command: 'systemctl',
        args: ['enable', this.packageName],
      });
      if (typeof enablePackage === 'string') {
        console.info(this.info, 'Package enabled');
      } else if (enablePackage !== 0) {
        result = 1;
      }
    } else {
      const enablePackage = await this.getSpawn({
        command: 'systemctl',
        args: ['disable', this.packageName],
      });
      if (typeof enablePackage === 'string') {
        console.info(this.info, 'Package disabled');
      } else if (enablePackage !== 0) {
        result = 1;
      }
    }

    return result;
  }

  /**
   *
   * @returns {Promise<Result>}
   */
  async restartNginx() {
    /**
     * @type {Result}
     */
    let result = 0;
    const nginxRestart = await this.getSpawn({
      command: 'systemctl',
      args: ['restart', 'nginx'],
    });
    if (nginxRestart !== 0) {
      console.warn(
        this.warning,
        Yellow,
        'Make sure that all nginx config values not have newline symbols',
        Reset
      );
      this.writeTmpNginx();
      return 1;
    }
    await this.getSpawn({
      command: 'nginx',
      args: ['-t'],
    });
    return result;
  }

  /**
   * Commands map
   * @returns {Promise<ResultVoid>}
   */
  async run() {
    const commandsRes = this.commands();
    if (commandsRes === 1) {
      return 1;
    }
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
      case this.props.update:
        const path = require('path');
        this.setPackageJson(path.resolve(this.pwd, 'package.json'));
        this.repository = this.packageJsonConfig.repository;
        const updateRes = await git.update(this.repository);
        if (updateRes === 1) {
          console.warn(this.warning, Yellow, 'Update script is not success', Reset);
        } else {
          console.info(this.info, Green, 'Success update repository', Reset);
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
  const runRes = await r.run();
  if (runRes) {
    console.info(r.info, 'Script end with code', runRes);
  }
})();
