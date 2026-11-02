/* Capa que conecta la app con Firebase (login, base de datos, fotos, Gemini y descargas).
   Expone la misma interfaz que usaba la versión de Claude, así el resto del código no cambia. */
(function () {
  var CONFIG = {
    apiKey: 'AIzaSyCKwymQhIyUjCBEONQQR_pSPnBt30mj1Lw',
    authDomain: 'viaticos-heartland.firebaseapp.com',
    projectId: 'viaticos-heartland',
    storageBucket: 'viaticos-heartland.firebasestorage.app',
    messagingSenderId: '439606639510',
    appId: '1:439606639510:web:bea2fcf52bf7105e4cbbb7'
  };
  var EMAIL_PERMITIDO = 'martinnc28081986@gmail.com';
  var MODELO = 'gemini-3.5-flash';

  var app = FB.initializeApp(CONFIG);
  // App Check (reCAPTCHA Enterprise): Firebase AI Logic exige que los pedidos vengan de esta página
  try { FB.initializeAppCheck(app, { provider: new FB.ReCaptchaEnterpriseProvider('6LcVZgsuAAAAAJOgXPu7WPW3ZBndWIDUEvFU8dOl'), isTokenAutoRefreshEnabled: true }); } catch (e) {}
  var auth = FB.getAuth(app);
  // Guardar la sesión también en localStorage: algunos celulares borran IndexedDB al cerrar la app
  var persistReady = FB.setPersistence(auth, FB.browserLocalPersistence).catch(function () {});
  var fs;
  try { fs = FB.initializeFirestore(app, { localCache: FB.persistentLocalCache() }); }
  catch (e) { fs = FB.initializeFirestore(app, {}); }
  var ai = FB.getAI(app, { backend: new FB.GoogleAIBackend() });
  var model = FB.getGenerativeModel(ai, { model: MODELO, generationConfig: { responseMimeType: 'application/json', temperature: 0, thinkingConfig: { thinkingBudget: 0 } } });

  var user = null, resolveReady;
  var ready = new Promise(function (r) { resolveReady = r; });

  // Las rutas de la versión Claude ('data/users/<uid>/config') se guardan en 'users/<uid>/meta/config'
  function mapPath(p) {
    var m = p.match(/^data\/users\/([^/]+)\/config(\/.*)?$/);
    if (m) return 'users/' + m[1] + '/meta/config' + (m[2] || '');
    return null;
  }
  function snapDoc(s) { return { id: s.id, exists: s.exists(), data: function () { return s.data(); }, metadata: s.metadata }; }
  function mkDoc(path) {
    var real = mapPath(path);
    var ref = real ? FB.doc(fs, real) : null;
    return {
      id: path.split('/').pop(), path: path,
      get: async function () { if (!ref) return { exists: false, data: function () {} }; return snapDoc(await FB.getDoc(ref)); },
      set: function (d) { return FB.setDoc(ref, d); },
      update: function (d) { return FB.updateDoc(ref, d); },
      delete: function () { return ref ? FB.deleteDoc(ref) : Promise.resolve(); },
      collection: function (c) { return mkCol(path + '/' + c); }
    };
  }
  function mkCol(path) {
    var real = mapPath(path);
    var ref = real ? FB.collection(fs, real) : null;
    return {
      path: path,
      doc: function (id) { return mkDoc(path + '/' + (id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)))); },
      add: async function (d) { var dr = this.doc(); await dr.set(d); return dr; },
      get: async function () { return { docs: [], size: 0, empty: true }; }, // 'importar' no existe acá
      onSnapshot: function (next, err) {
        if (!ref) { setTimeout(function () { next({ docs: [], metadata: { fromCache: false } }); }, 0); return function () {}; }
        return FB.onSnapshot(ref, { includeMetadataChanges: true }, function (qs) {
          next({ docs: qs.docs.map(snapDoc), size: qs.size, empty: qs.empty, metadata: { fromCache: qs.metadata.fromCache } });
        }, function (e) { if (err) err({ code: 'unavailable', message: String(e) }); });
      }
    };
  }

  function blobToDataURL(b) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(b); }); }

  // Fotos: guardadas como JPEG en Firestore (users/<uid>/fotos/<id>), cargadas a pedido
  var fotoCache = {};
  var Fotos = {
    get: function (id) {
      if (!id) return Promise.resolve('');
      if (!fotoCache[id]) fotoCache[id] = FB.getDoc(FB.doc(fs, 'users/' + user.uid + '/fotos/' + id)).then(function (s) { return s.exists() ? s.data().data : ''; });
      return fotoCache[id];
    },
    put: async function (id, dataUrl) {
      await FB.setDoc(FB.doc(fs, 'users/' + user.uid + '/fotos/' + id), { data: dataUrl, ts: new Date().toISOString() });
      fotoCache[id] = Promise.resolve(dataUrl);
    }
  };
  window.Fotos = Fotos;

  var caps = {
    db: { doc: mkDoc, collection: mkCol },
    user: { id: async function () { return user ? user.uid : null; } },
    assets: {
      upload: async function (blob) {
        var url = await blobToDataURL(blob);
        if (url.length > 950000) throw { code: 'too_large', message: 'La foto es demasiado grande' };
        var id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        await Fotos.put(id, url);
        return { id: id, url: url };
      },
      delete: function (id) { delete fotoCache[id]; return FB.deleteDoc(FB.doc(fs, 'users/' + user.uid + '/fotos/' + id)); }
    },
    sample: {
      limits: async function () { return { images: { maxCount: 5 } }; },
      json: async function (prompt, opts) {
        var parts = [prompt];
        var imgs = (opts && opts.images) || [];
        for (var i = 0; i < imgs.length; i++) {
          var u = await blobToDataURL(imgs[i]);
          parts.push({ inlineData: { mimeType: imgs[i].type || 'image/jpeg', data: u.split(',')[1] } });
        }
        var r;
        try { r = await model.generateContent(parts); }
        catch (e) {
          var msg = String((e && e.message) || e);
          if (opts && opts.signal && opts.signal.aborted) throw { code: 'cancelled' };
          throw { code: /429|quota|RESOURCE_EXHAUSTED/i.test(msg) ? 'rate_limited' : 'upstream_error', message: msg };
        }
        if (opts && opts.signal && opts.signal.aborted) throw { code: 'cancelled' };
        var txt = r.response.text();
        var m = txt.match(/\{[\s\S]*\}/);
        try { return JSON.parse(m ? m[0] : txt); } catch (e) { throw { code: 'invalid_json', text: txt }; }
      }
    },
    downloads: {
      save: async function (req) {
        var blob = req.data instanceof Blob ? req.data : new Blob([req.data]);
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a'); a.href = url; a.download = req.filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        return { status: 'saved' };
      }
    }
  };

  window.claude = { use: async function (n) { await ready; return caps[n] || null; } };

  // ---------- Envío por mail (Gmail API, desde la cuenta de Google del usuario) ----------
  var gmailToken = null, gmailExp = 0;
  async function tokenGmail(forzar) {
    if (!forzar && gmailToken && Date.now() < gmailExp) return gmailToken;
    var prov = new FB.GoogleAuthProvider();
    prov.addScope('https://www.googleapis.com/auth/gmail.send');
    prov.setCustomParameters({ login_hint: (user && user.email) || EMAIL_PERMITIDO });
    var res = await FB.signInWithPopup(auth, prov);
    var cred = FB.GoogleAuthProvider.credentialFromResult(res);
    if (!cred || !cred.accessToken) throw new Error('Google no dio permiso para enviar mails');
    gmailToken = cred.accessToken; gmailExp = Date.now() + 50 * 60 * 1000;
    return gmailToken;
  }
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
  function b64utf8(str) { return btoa(unescape(encodeURIComponent(str))); }
  function lineas(s) { return s.replace(/(.{76})/g, '$1\r\n'); }
  window.enviarMail = async function (msg) {
    var bnd = 'viaticos_' + Date.now().toString(36);
    var partes = ['To: ' + msg.to, 'Subject: =?UTF-8?B?' + b64utf8(msg.subject) + '?=', 'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="' + bnd + '"', '',
      '--' + bnd, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', lineas(b64utf8(msg.body))];
    for (var i = 0; i < msg.files.length; i++) {
      var f = msg.files[i], data = b64(await f.blob.arrayBuffer());
      partes.push('--' + bnd, 'Content-Type: ' + f.type + '; name="' + f.name + '"', 'Content-Disposition: attachment; filename="' + f.name + '"', 'Content-Transfer-Encoding: base64', '', lineas(data));
    }
    partes.push('--' + bnd + '--', '');
    var raw = partes.join('\r\n');
    async function mandar(tk) {
      return fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', { method: 'POST', headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'message/rfc822' }, body: raw });
    }
    var r = await mandar(await tokenGmail(false));
    if (r.status === 401 || r.status === 403) r = await mandar(await tokenGmail(true));
    if (!r.ok) { var t = await r.text(); throw new Error('Gmail respondió ' + r.status + ': ' + t.slice(0, 160)); }
    return true;
  };

  // ---------- Acceso: Martín es admin; el resto pide acceso y él aprueba ----------
  var esAdmin = false;
  window.Acceso = {
    esAdmin: function () { return esAdmin; },
    escuchar: function (cb) {
      return FB.onSnapshot(FB.collection(fs, 'acceso'), function (qs) { cb(qs.docs.map(function (d) { return Object.assign({ uid: d.id }, d.data()); })); }, function () {});
    },
    decidir: function (uid, estado) { return FB.updateDoc(FB.doc(fs, 'acceso/' + uid), { estado: estado, decididaEl: new Date().toISOString() }); }
  };

  // ---------- Login ----------
  function pantallaLogin(msg, opts) {
    opts = opts || {};
    var el = document.getElementById('login');
    document.body.classList.add('nologin');
    el.classList.remove('hide');
    document.getElementById('loginTit').textContent = opts.tit || 'Viáticos Heartland';
    document.getElementById('loginSub').textContent = opts.sub || 'Entrá con tu cuenta de Google para ver y cargar tus gastos.';
    document.getElementById('loginIco').textContent = opts.ico || 'receipt_long';
    document.getElementById('btnLogin').classList.toggle('hide', !!opts.sinBoton);
    document.getElementById('btnSalirLogin').classList.toggle('hide', !opts.sinBoton);
    var m = document.getElementById('loginMsg'); m.textContent = msg || ''; m.style.color = opts.ok ? 'var(--tx2)' : 'var(--err)';
  }
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btnLogin').onclick = async function () {
      await persistReady;
      var prov = new FB.GoogleAuthProvider(); prov.setCustomParameters({ prompt: 'select_account' });
      try { await FB.signInWithPopup(auth, prov); }
      catch (e) {
        if (e && /popup/i.test(e.code || '')) { try { await FB.signInWithRedirect(auth, prov); } catch (e2) { pantallaLogin('No se pudo iniciar sesión.'); } }
        else pantallaLogin('No se pudo iniciar sesión.');
      }
    };
    function salir() { FB.signOut(auth).then(function () { location.reload(); }); }
    document.getElementById('btnSalir').onclick = salir;
    document.getElementById('btnSalirLogin').onclick = salir;
  });
  FB.getRedirectResult(auth).catch(function () {});
  var entro = false, desuscribir = null;
  function entrar(u) {
    if (entro) return; entro = true;
    user = u;
    document.getElementById('login').classList.add('hide');
    document.body.classList.remove('nologin');
    document.getElementById('btnSalir').classList.remove('hide');
    resolveReady();
  }
  FB.onAuthStateChanged(auth, async function (u) {
    if (desuscribir) { desuscribir(); desuscribir = null; }
    if (!u) { pantallaLogin(''); return; }
    var email = (u.email || '').toLowerCase();
    esAdmin = email === EMAIL_PERMITIDO;
    if (esAdmin) { entrar(u); return; }
    var nombre = (u.displayName || email).split(' ')[0];
    var ref = FB.doc(fs, 'acceso/' + u.uid);
    pantallaLogin('', { sinBoton: true, ok: true, ico: 'hourglass_top', tit: 'Verificando acceso…', sub: email });
    try {
      var s = await FB.getDoc(ref);
      if (!s.exists()) await FB.setDoc(ref, { email: u.email, nombre: u.displayName || '', foto: u.photoURL || '', estado: 'pendiente', creada: new Date().toISOString() });
    } catch (e) { pantallaLogin('No se pudo enviar la solicitud. Probá de nuevo más tarde.', { sinBoton: true, ico: 'error', tit: 'Sin conexión', sub: email }); return; }
    desuscribir = FB.onSnapshot(ref, function (d) {
      var est = d.exists() ? d.data().estado : 'pendiente';
      if (est === 'aprobado') { entrar(u); return; }
      if (entro) { location.reload(); return; }
      if (est === 'rechazado') pantallaLogin('Si creés que es un error, pedile al administrador que te habilite.', { sinBoton: true, ico: 'block', tit: 'Sin acceso', sub: email });
      else pantallaLogin('Cuando te aprueben, esta pantalla se actualiza sola.', { sinBoton: true, ok: true, ico: 'hourglass_top', tit: 'Hola ' + nombre + ', tu solicitud está pendiente', sub: email });
    }, function () {});
  });
})();
