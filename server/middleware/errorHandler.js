export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.code === 11000) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const status = err.status || 500;
  const message = err.message || "Internal server error";
  res.status(status).json({ error: message });
}

export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}
