function ok(data) {
  return { code: 0, message: 'success', data };
}

function fail(code, message) {
  return { code, message, data: null };
}

module.exports = { ok, fail };
