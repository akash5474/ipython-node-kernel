import fs from 'fs';
import Kernel from './kernel';

var config;

if ( process.argv.length > 2 ) {
  console.log('Loading kernel with args...' + process.argv);
  console.log('Reading config file...' + process.argv[2]);

  config = JSON.parse(fs.readFileSync(process.argv[2]));
  console.log('config', config);
} else {
  console.log('Starting kernel with default args...');

  config = {
    'control_port': 0,
    'hb_port': 0,
    'iopub_port': 0,
    'ip': '127.0.0.1',
    'key': uuid.v4(),
    'shell_port': 0,
    'signature_scheme': 'hmac-sha256',
    'stdin_port': 0,
    'transport': 'tcp'
  };
}

const nodeKernel = new Kernel(config);

nodeKernel.init(function(err) {
  if ( err ) {
    console.log('FAILED TO START KERNEL');
    console.log(err.stack);
    process.exit();
  }
});

export default nodeKernel;
