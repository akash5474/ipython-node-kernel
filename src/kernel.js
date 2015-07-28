import vm from 'vm';
import uuid from 'node-uuid';
import makeSockets from './sockets';
import MsgWrapper from './msg-wrapper';

const DELIM = '<IDS|MSG>';

function makeHeader(msgType, parentHeader) {
  console.log('MAKING HEADER', msgType);
  return {
    'date': new Date().toISOString(),
    'msg_id': uuid.v4(),
    'username': parentHeader.username,
    'session': parentHeader.session,
    'msg_type': msgType
  };
}

export default class Kernel {
  constructor(config) {
    this.exiting = false;
    this.engineID = uuid.v4();
    this.sandbox = {};
    this.vmContext = vm.createContext(this.sandbox);
    this.executionCount = 0;
    this.msgWrapper = new MsgWrapper(config.key);
    this.connections = {};
    this.config = config;
  }

  init(callback) {
    makeSockets(this.config, (err, sockets) => {
      if ( err ) return callback(err);
      this.sockets = sockets;
      this.bindSockets();
      callback();
    });
  }

  bindSockets() {
    this.sockets.heartbeat.on('message', this.hbHandler.bind(this));
    this.sockets.shell.on('message', this.shellHandler.bind(this));
    this.sockets.control.on('message', this.controlHandler.bind(this));
  }

  shutdown() {
    this.exiting = true;
  }

  hbHandler(data) {
    this.sockets.heartbeat.send(data);
  }

  iopoubHandler() {
    Array.prototype.forEach.call(arguments, (arg) => {
      console.log('IOPUB DATA:\t' + arg.toString());
    });
  }

  shellHandler() {
    Array.prototype.forEach.call(arguments, (arg) => {
      console.log('SHELL DATA:\t' + arg.toString());
    });

    let deserializedMsg = this.msgWrapper.deserializeWireMsg(arguments),
        identities = deserializedMsg[0],
        msg = deserializedMsg[1],
        msgType = msg.header.msg_type,
        signature = '';

    if ( msgType === 'execute_request' ) {
      let code = msg.content ? msg.content.code : null,
          result,
          content;

      this.msgWrapper.sendMsg(this.sockets.iopub, 'status',
        {execution_state: 'busy'}, msg.header);

      this.msgWrapper.sendMsg(this.sockets.iopub, 'execute_input',
        {execution_count: this.executionCount, code: code}, msg.header);

      if ( code ) {
        try {
          result = vm.runInContext(code, this.vmContext, '<kernel>');
        } catch(err) {
          result = err.stack;
        }
      } else {
        result = 'undefined';
      }

      this.msgWrapper.sendMsg(this.sockets.iopub, 'execute_result',
        {
          execution_count: this.executionCount,
          data: {
            'text/plain': result ? result.toString() : 'undefined'
          }
        }, msg.header);

      this.msgWrapper.sendMsg(this.sockets.iopub, 'status',
        {execution_state: 'idle'}, msg.header);

      this.msgWrapper.sendMsg(this.sockets.shell, 'execute_reply', {
        status: 'ok',
        execution_count: this.executionCount,
        user_variables: {},
        payload: []
      }, msg.header, {
        dependencies_met: true,
        engine: this.engineID,
        status: 'ok',
        started: new Date().toISOString()
      }, identities);

      this.executionCount++;
    } else if ( msgType === 'kernel_info_request' ) {
      this.msgWrapper.sendMsg(this.sockets.shell, 'kernal_info_reply', {
        'protocol_version': '5.0',
        'ipython_version': '3.2.0',
        'language_version': '0.0.1',
        'language': 'javascript',
      }, msg.header, null, identities);
    } else if ( msgType === 'history_request' ) {
      console.log('Unhandled History Request');
    } else {
      console.log('UNKNOWN MSG TYPE:', msgType);
    }
  }

  stdinHandler() {
    Array.prototype.forEach.call(arguments, (arg) => {
      console.log('STDIN DATA:\t' + arg.toString());
    });
  }

  controlHandler() {
    Array.prototype.forEach.call(arguments, (arg) => {
      console.log('CONTROL DATA:\t' + arg.toString());
    });

    let msg = this.msgWrapper.deserializeWireMsg(arguments)[1];
    if ( msg.header.msg_type === 'shutdown_request' ) {
      this.shutdown();
    }
  }
}
