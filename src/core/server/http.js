// dsh-micro · HTTP 桥接小工具
//
// 宿主侧所有路由 handler 共用的一套读写原语。原来这些散在 ble.js 里（#jsonHead/#readBody/#json），
// 搬到这里是因为它们与「BLE/HID 设备」无关，只跟「webserver 通信」有关 —— 属于 server/ 的职责。
//
// 这些函数是纯工具（无状态、无闭包），所以导出为模块级常量即可，不必挂到某个实例上。

/** 统一 JSON 响应头。 */
export const JSON_HEAD = { 'content-type': 'application/json; charset=utf-8' }

/**
 * 读完请求体（跨 chunk 拼起来）后回调。
 * @param {import('http').IncomingMessage} req
 * @param {(body: string) => void} cb
 */
export const readBody = (req, cb) => {
  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => cb(body))
}

/**
 * 用 JSON_HEAD 回一段 JSON。
 * @param {import('http').ServerResponse} res
 * @param {number} code
 * @param {unknown} obj
 */
export const json = (res, code, obj) => {
  res.writeHead(code, JSON_HEAD)
  res.end(JSON.stringify(obj))
}

/** 405（方法不允许）的统一回包。 */
export const methodNotAllowed = (res) => json(res, 405, { error: 'method not allowed' })

/**
 * 把一个「读 body → 解析 → 处理 → 回 JSON」的 POST handler 包成标准形态：
 * 方法不是 POST 就 405；body 解析失败回 400；处理器抛错也回 400（带 message）。
 * @param {(body: unknown, req: import('http').IncomingMessage) => unknown} handler
 *   返回要写回客户端的 JSON 对象（200）。
 * @returns {(req, res) => void}
 */
export const postJson = (handler) => (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res)
  readBody(req, (body) => {
    let parsed
    try {
      parsed = JSON.parse(body || '{}')
    } catch (e) {
      return json(res, 400, { error: e && e.message ? e.message : String(e) })
    }
    try {
      json(res, 200, handler(parsed, req))
    } catch (e) {
      json(res, 400, { error: e && e.message ? e.message : String(e) })
    }
  })
}
