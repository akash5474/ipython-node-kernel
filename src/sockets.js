import zmq from 'zmq';

export default function makeSockets(config, callback) {
  const sockets = [
    {
      name: 'heartbeat',
      port: config.hb_port,
      type: 'rep',
    },
    {
      name: 'iopub',
      port: config.iopub_port,
      type: 'pub',
    },
    {
      name: 'shell',
      port: config.shell_port,
      type: 'xrep',
    },
    {
      name: 'stdin',
      port: config.stdin_port,
      type: 'router',
    },
    {
      name: 'control',
      port: config.control_port,
      type: 'xrep',
    }
  ];

  const promArr = [];
  const boundSockets = {};

  for ( var sock of sockets ) {
    promArr.push(makeSocket(sock, config));
  }

  Promise.all(promArr)
    .then((socketsArr) => {
      socketsArr.forEach((s) => { boundSockets[ s[0] ] = s[1]; });
      callback(null, boundSockets);
    })
    .catch((err) => {
      callback(err);
    });
}

function makeSocket(socketConfig, kernelConfig) {
  return new Promise((resolve, reject) => {
    const socket = zmq.socket(socketConfig.type);
    const address = kernelConfig.transport + '://' +
      kernelConfig.ip + ':' + socketConfig.port;

    socket.bind(address, (err) => {
      if (err) return reject(err);
      resolve([socketConfig.name, socket]);
    });
  });
}
