function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

module.exports = { requireAdmin };
