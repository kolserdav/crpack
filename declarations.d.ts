import type { Parser } from '@webantic/nginx-config-parser';

module '@webantic/nginx-config-parser' {
  export default Parser;
}

interface SSHConfigInterface {}

class SSHConfig1 {
  parse() {
    return 'das';
  }
}

module 'ssh-config' {
  export default SSHConfig1;
}

module 'linebyline' {
  const rl: () => any;
  export = rl.exports;
}
