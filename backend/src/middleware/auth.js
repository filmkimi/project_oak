const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' });
  }
  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'ระบบยังไม่ได้ตั้งค่า JWT_SECRET' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์ดำเนินการนี้' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
