const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    return next();
  } catch {
    return res.status(401).json({ message: 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ' });
  }
  return next();
}

module.exports = { authenticate, requireAdmin };
