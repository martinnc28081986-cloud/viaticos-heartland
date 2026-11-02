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

  // ---------- Login ----------
  function pantallaLogin(msg) {
    var el = document.getElementById('login');
    document.body.classList.add('nologin');
    el.classList.remove('hide');
    document.getElementById('loginMsg').textContent = msg || '';
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
    document.getElementById('btnSalir').onclick = function () { FB.signOut(auth).then(function () { location.reload(); }); };
  });
  FB.getRedirectResult(auth).catch(function () {});
  FB.onAuthStateChanged(auth, function (u) {
    if (!u) { pantallaLogin(''); return; }
    if ((u.email || '').toLowerCase() !== EMAIL_PERMITIDO) { pantallaLogin('La cuenta ' + u.email + ' no tiene acceso a esta app.'); FB.signOut(auth); return; }
    user = u;
    document.getElementById('login').classList.add('hide');
    document.body.classList.remove('nologin');
    document.getElementById('btnSalir').classList.remove('hide');
    resolveReady();
  });
})();
