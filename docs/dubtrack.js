(() => {
  var q = Object.defineProperty,
    R = Object.defineProperties;
  var U = Object.getOwnPropertyDescriptors;
  var h = Object.getOwnPropertySymbols;
  var E = Object.prototype.hasOwnProperty,
    N = Object.prototype.propertyIsEnumerable;
  var g = (i, o, a) => o in i ? q(i, o, {
      enumerable: !0,
      configurable: !0,
      writable: !0,
      value: a
    }) : i[o] = a,
    u = (i, o) => {
      for (var a in o || (o = {})) E.call(o, a) && g(i, a, o[a]);
      if (h)
        for (var a of h(o)) N.call(o, a) && g(i, a, o[a]);
      return i
    },
    l = (i, o) => R(i, U(o));
  (function() {
    var b;
    let i = document.currentScript,
      o = "dub_id",
      a = "dub_partner_data",
      O = 90 * 24 * 60 * 60 * 1e3,
      d = window.location.hostname,
      m = i.getAttribute("data-api-host") || "https://api.dub.co",
      S = i.getAttribute("data-publishable-key"),
      D = (() => {
        let n = {
            domain: d === "localhost" ? void 0 : `.${d.replace(/^www\./,"")}`,
            path: "/",
            sameSite: "Lax",
            expires: new Date(Date.now() + O).toUTCString()
          },
          e = i.getAttribute("data-cookie-options");
        if (!e) return n;
        let t = JSON.parse(e);
        return t.expiresInDays && (t.expires = new Date(Date.now() + t.expiresInDays * 24 * 60 * 60 * 1e3).toUTCString(), delete t.expiresInDays), u(u({}, n), t)
      })(),
      k = (() => {
        let n = i.getAttribute("data-short-domain"),
          e = i.getAttribute("data-domains");
        if (e) try {
          let t = JSON.parse(e);
          return l(u({}, t), {
            refer: t.refer || n
          })
        } catch (t) {}
        return {
          refer: n
        }
      })(),
      p = k.refer,
      I = i.getAttribute("data-attribution-model") || "last-click",
      C = (() => {
        let n = i.getAttribute("data-query-param"),
          e = i.getAttribute("data-query-params"),
          t = ["via"];
        if (n) t = [n, ...t];
        else if (e) try {
          t = [...JSON.parse(e), ...t]
        } catch (r) {
          console.warn("[dubAnalytics] Failed to parse data-query-params.", r)
        }
        return [...new Set(t)]
      })(),
      f = (() => {
        let n = new URLSearchParams(location.search);
        for (let e of C)
          if (n.get(e)) return n.get(e);
        return null
      })();
    if (window.DubAnalytics = window.DubAnalytics || {
        partner: null,
        discount: null
      }, window.dubAnalytics) {
      let t = function(r, ...s) {
        r === "ready" ? t.ready(...s) : r === "trackClick" ? t.trackClick(...s) : console.warn("[dubAnalytics] Unknown method:", r)
      };
      var P = t;
      let e = window.dubAnalytics.q || [];
      t.q = e, t.ready = function(r) {
        r()
      }, t.trackClick = function(...r) {
        A(...r)
      }, window.dubAnalytics = t
    }
    let c = {
        get(n) {
          var e;
          return (e = document.cookie.split(";").map(t => t.trim().split("=")).find(([t]) => t === n)) == null ? void 0 : e[1]
        },
        set(n, e) {
          let t = Object.entries(D).filter(([, r]) => r).map(([r, s]) => `${r}=${s}`).join("; ");
          document.cookie = `${n}=${e}; ${t}`
        }
      },
      y = {
        queue: ((b = window.dubAnalytics) == null ? void 0 : b.q) || [],
        flush(n) {
          let e = [];
          for (; this.queue.length;) {
            let [t, ...r] = this.queue.shift();
            !n || n(t) ? this.process({
              method: t,
              args: r
            }) : e.push([t, ...r])
          }
          this.queue = e
        },
        process({
          method: n,
          args: e
        }) {
          if (n === "ready") {
            let t = e[0];
            t()
          } else ["trackClick"].includes(n) ? A(...e) : console.warn("[dubAnalytics] Unknown method:", n)
        }
      },
      w = !1;

    function A({
      domain: n,
      key: e
    }) {
      w || (w = !0, fetch(`${m}/track/click`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          domain: n,
          key: e,
          url: window.location.href,
          referrer: document.referrer
        })
      }).then(t => t.ok && t.json()).then(t => {
        if (t) {
          if (c.set(o, t.clickId), t.partner) {
            let r = l(u({}, t), {
              partner: l(u({}, t.partner), {
                name: encodeURIComponent(t.partner.name),
                image: t.partner.image ? encodeURIComponent(t.partner.image) : null
              })
            });
            c.set(a, JSON.stringify(r)), DubAnalytics.partner = t.partner, DubAnalytics.discount = t.discount, y.flush(s => s === "ready")
          }
          return t
        }
      }))
    }

    function _() {
      let n = new URLSearchParams(location.search),
        e = () => !c.get(o) || I !== "first-click",
        t = n.get(o);
      t && e() && c.set(o, t), f && p && e() && A({
        domain: p,
        key: f
      }), y.flush(s => s === "trackClick");
      let r = c.get(a);
      if (r) try {
        let s = JSON.parse(r);
        DubAnalytics.partner = s.partner, DubAnalytics.discount = s.discount
      } catch (s) {
        console.error("[dubAnalytics] Failed to parse partner cookie:", s)
      }
    }
    window._dubAnalytics = {
      c,
      qm: y,
      i: o,
      h: d,
      a: m,
      d: p,
      v: f,
      n: k,
      k: S
    }, _()
  })();
})();