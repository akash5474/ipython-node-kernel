import crypto from 'crypto';
import uuid from 'node-uuid';

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

export default class MsgWrapper{
  constructor(configKey) {
    this.configKey = configKey;
  }

  sendMsg(socket, msgType, content,
    parentHeader, metadata, identities) {

    content = content || {};
    parentHeader = parentHeader || {};
    metadata = metadata || {};

    let header = makeHeader(msgType, parentHeader);

    let toHash = [
      JSON.stringify(header),
      JSON.stringify(parentHeader),
      JSON.stringify(metadata),
      JSON.stringify(content)
    ];

    let hmac = crypto.createHmac('sha256', this.configKey),
        toHashStr = toHash.join(''),
        signature = '';

    hmac.update(toHashStr);
    signature = hmac.digest('hex');

    socket.send([identities, DELIM, signature].concat(toHash));
  }

  deserializeWireMsg(wire) {
    let wireMsg = Array.prototype.slice.call(wire),
        identities = wireMsg.shift();
        
    wireMsg.shift();

    let msgSignature = wireMsg.shift(),
        msgFrames = wireMsg.map((el) => { return el; });

    let msg = {
      header: JSON.parse(msgFrames[0]),
      parent_header: JSON.parse(msgFrames[1]),
      metadata: JSON.parse(msgFrames[2] || {}),
      content: JSON.parse(msgFrames[3])
    };

    return [identities, msg];
  }
}
