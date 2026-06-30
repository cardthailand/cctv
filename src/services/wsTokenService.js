const jwt = require('jsonwebtoken');
const { config } = require('../config');

function signStreamToken(user, channel) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      channel,
    },
    config.wsToken.secret,
    { expiresIn: config.wsToken.expirySec }
  );
}

function verifyStreamToken(token, channel) {
  const payload = jwt.verify(token, config.wsToken.secret);
  if (payload.channel !== channel) {
    throw new Error('Token channel mismatch');
  }
  return payload;
}

module.exports = {
  signStreamToken,
  verifyStreamToken,
};
