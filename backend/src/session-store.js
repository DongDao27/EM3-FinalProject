import session from "express-session";
import { query, first, json } from "./db.js";
export class MySqlSessionStore extends session.Store {
  get(sid, callback) {
    first("SELECT data FROM em3_sessions WHERE sid=? AND expires_at>UTC_TIMESTAMP(6)", [sid]).then(
      (r) => callback(null, r ? json(r.data) : null),
      callback,
    );
  }
  set(sid, value, callback = () => {}) {
    query(
      "INSERT INTO em3_sessions(sid,user_id,data,expires_at) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),data=VALUES(data),expires_at=VALUES(expires_at)",
      [
        sid,
        value.userId || null,
        JSON.stringify(value),
        new Date(value.cookie.expires || Date.now() + 86400000),
      ],
    ).then(() => callback(), callback);
  }
  destroy(sid, callback = () => {}) {
    query("DELETE FROM em3_sessions WHERE sid=?", [sid]).then(() => callback(), callback);
  }
  touch(sid, value, callback) {
    this.set(sid, value, callback);
  }
}
