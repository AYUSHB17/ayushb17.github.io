// Firebase Realtime Database backend, used whenever firebase-config.js has a
// config in it. Exposes the same Meet.net API as the local server version,
// so app.js and me.js don't know which one they're talking to.
//
// Data layout (security rules in database.rules.json enforce who may do what):
//   sessions/{sid}  { owner, created, updated, her, scene, contact, typing, online, left, live, meTyping, whisper }
//   messages/{sid}/{id}  { from: her|bot|me, text, mood, choice, at }
//   emotes/{sid}/{id}    { emote, at }
//   whispers/{sid}/{id}  { from: friends|me, text, at }  — deleted whole when either side closes it
//   preps/{pid}          { her, friends, place, detail, created }  — set up before she scans
(function () {
  'use strict';
  const cfg = window.MEETCUTE_FIREBASE;
  if (!cfg || !window.firebase) return;

  firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db = firebase.database();
  const NOW = firebase.database.ServerValue.TIMESTAMP;
  const RETENTION_DAYS = 30;

  const signedIn = new Promise((resolve) => {
    const off = auth.onAuthStateChanged((u) => { off(); resolve(u); });
  });

  // Fire `fn` only for children added after the initial load, so reopening a
  // page doesn't replay old messages as if they were new.
  function onNewChildren(ref, fn) {
    let ready = false;
    const seen = new Set();
    ref.on('child_added', (snap) => {
      if (!ready) { seen.add(snap.key); return; }
      if (!seen.has(snap.key)) fn(snap);
    });
    return ref.once('value').then((snap) => {
      snap.forEach((c) => { seen.add(c.key); });
      ready = true;
      return snap;
    });
  }

  // ------------------------------------------------------------ her

  async function herAuth() {
    return (await signedIn) || (await auth.signInAnonymously()).user;
  }

  const clip = (v, n) => String(v || '').slice(0, n);
  const cleanAvatar = (a = {}) => ({ skin: clip(a.skin, 9), hair: clip(a.hair, 9), hairStyle: clip(a.hairStyle, 20),
    outfit: clip(a.outfit, 20), outfitColor: clip(a.outfitColor, 9), pants: clip(a.pants, 9), glasses: !!a.glasses });
  const cleanScene = (sc = {}) => ({ place: clip(sc.place, 12),
    friends: (sc.friends || []).slice(0, 4).map((f) => ({ avatar: cleanAvatar(f.avatar) })) });
  const list = (snap) => { const out = []; snap.forEach((c) => { out.push(c.val()); }); return out; };

  const her = {
    async prep(pid) {
      await herAuth();
      try { return (await db.ref('preps/' + pid).once('value')).val(); } catch { return null; }
    },

    async start() {
      const user = await herAuth();
      const ref = db.ref('sessions').push();
      await ref.set({ owner: user.uid, created: NOW, updated: NOW, online: true });
      return ref.key;
    },

    listen(sid, onEvent) {
      const sRef = db.ref('sessions/' + sid);
      herAuth().then(async () => {
        sRef.child('online').onDisconnect().set(false);
        sRef.child('online').set(true);
        let first = true;
        let live = null;
        let meTyping = null;
        sRef.on('value', (snap) => {
          const s = snap.val() || {};
          if (first) { first = false; live = !!s.live; onEvent({ type: 'hello', live, messages: [] }); }
          else if (!!s.live !== live) { live = !!s.live; onEvent({ type: 'live', live }); }
          if (!!s.meTyping !== meTyping) { meTyping = !!s.meTyping; onEvent({ type: 'typing', typing: meTyping }); }
        });
        onNewChildren(db.ref('messages/' + sid), (snap) => {
          const m = snap.val();
          if (m.from === 'me') onEvent({ type: 'msg', from: 'me', text: m.text, mood: m.mood || '' });
        });
        onNewChildren(db.ref('emotes/' + sid), (snap) => onEvent({ type: 'emote', emote: snap.val().emote }));
        // Whisper: the flag lives on the session, the messages in their own branch.
        let wOpen = false;
        let wList = [];
        const emitW = () => onEvent({ type: 'whisper', open: wOpen, list: wOpen ? wList : [] });
        sRef.child('whisper').on('value', (snap) => { if (!!snap.val() !== wOpen) { wOpen = !!snap.val(); emitW(); } });
        db.ref('whispers/' + sid).on('value', (snap) => { wList = list(snap); if (wOpen) emitW(); });
      });
      return () => { sRef.off(); sRef.child('whisper').off(); db.ref('messages/' + sid).off(); db.ref('emotes/' + sid).off(); db.ref('whispers/' + sid).off(); };
    },

    async send(sid, type, p = {}) {
      await herAuth();
      const sRef = db.ref('sessions/' + sid);
      switch (type) {
        case 'join': {
          const up = { updated: NOW, her: { name: clip(p.her.name, 40), avatar: cleanAvatar(p.her.avatar) } };
          if (p.scene) up.scene = cleanScene(p.scene);
          return sRef.update(up);
        }
        case 'wmsg':
          return db.ref('whispers/' + sid).push({ from: 'friends', text: clip(p.text, 300), at: NOW });
        case 'wclose':
          // Either side closing wipes the whole whisper branch.
          return db.ref().update({ [`sessions/${sid}/whisper`]: false, ['whispers/' + sid]: null });
        case 'msg': case 'bot': case 'choice': {
          const msg = { from: type === 'bot' ? 'bot' : 'her', text: clip(p.text, 500), mood: clip(p.mood, 20), at: NOW };
          if (type === 'choice') msg.choice = true;
          await db.ref('messages/' + sid).push(msg);
          return sRef.update(type === 'bot' ? { updated: NOW } : { updated: NOW, typing: false });
        }
        case 'contact':
          return sRef.update({ updated: NOW, contact: { phone: clip(p.contact.phone, 30), insta: clip(p.contact.insta, 40) } });
        case 'leave': return sRef.update({ updated: NOW, left: true });
        case 'typing': return sRef.update({ typing: !!p.typing });
      }
    },
  };

  // ------------------------------------------------------------ me

  // Signed in with Google but not the admin UID in the rules → reads are denied.
  async function isAdmin() {
    try { await db.ref('sessions').limitToFirst(1).once('value'); return true; } catch { return false; }
  }

  let emitEmote = null;
  const me = {
    mode: 'google',
    async login() {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const { user } = await auth.signInWithPopup(provider);
      if (!(await isAdmin())) {
        throw Object.assign(new Error('not admin'), { status: 403, uid: user.uid });
      }
    },
    async authed() {
      const u = await signedIn;
      return !!u && !u.isAnonymous && isAdmin();
    },
    logout: () => auth.signOut(),

    listen(onEvent, onState) {
      db.ref('.info/connected').on('value', (s) => onState?.(!!s.val()));
      const sessions = new Map();
      const pub = (sid) => {
        const s = sessions.get(sid);
        return s && Object.assign({ sid, messages: [] }, s.data, { messages: s.messages, typing: !!s.data.typing,
          online: !!s.data.online, whisper: !!s.data.whisper, whispers: s.whispers || [] });
      };
      // Every session's whisper branch; usually empty, so this is cheap.
      const watchWhispers = (sid) => {
        db.ref('whispers/' + sid).on('value', (snap) => {
          const s = sessions.get(sid);
          if (!s) return;
          s.whispers = list(snap);
          onEvent({ type: 'whisper', sid, open: !!s.data.whisper, list: s.data.whisper ? s.whispers : [] });
        });
      };
      emitEmote = (sid, emote) => sessions.has(sid) &&
        onEvent({ type: 'event', ev: { type: 'emote', sid, emote, from: 'me' }, session: pub(sid) });
      const watchMessages = (sid, initial) => {
        const s = sessions.get(sid);
        onNewChildren(db.ref('messages/' + sid), (snap) => {
          const m = snap.val();
          s.messages.push(m);
          const ev = m.choice ? { type: 'choice', sid, text: m.text } : { type: 'msg', sid, from: m.from, text: m.text, mood: m.mood };
          onEvent({ type: 'event', ev, session: pub(sid) });
        }).then((snap) => {
          snap.forEach((c) => { s.messages.push(c.val()); });
          initial?.();
        });
      };

      db.ref('sessions').once('value').then((all) => {
        const cutoff = Date.now() - RETENTION_DAYS * 864e5;
        const pending = [];
        all.forEach((c) => {
          const data = c.val();
          // No server to expire old conversations, so the dashboard does it.
          if ((data.updated || 0) < cutoff) { me.remove(c.key); return; }
          sessions.set(c.key, { data, messages: [] });
          pending.push(new Promise((r) => watchMessages(c.key, r)));
          watchWhispers(c.key);
        });
        return Promise.all(pending);
      }).then(() => {
        onEvent({ type: 'snapshot', sessions: [...sessions.keys()].map(pub) });

        onNewChildren(db.ref('sessions'), (snap) => {
          sessions.set(snap.key, { data: snap.val(), messages: [] });
          watchMessages(snap.key);
          watchWhispers(snap.key);
          onEvent({ type: 'session', session: pub(snap.key) });
        });
        db.ref('sessions').on('child_changed', (snap) => {
          const sid = snap.key;
          const s = sessions.get(sid);
          if (!s) return;
          const was = s.data;
          const now = snap.val();
          s.data = now;
          if (!!was.typing !== !!now.typing) onEvent({ type: 'typing', sid, typing: !!now.typing });
          if (!!was.online !== !!now.online) onEvent({ type: 'presence', sid, online: !!now.online });
          const ev = (type) => onEvent({ type: 'event', ev: { type, sid }, session: pub(sid) });
          if (!was.her && now.her) ev('join');
          if (!was.contact && now.contact) ev('contact');
          if (!was.left && now.left) ev('leave');
          if (!!was.live !== !!now.live) ev('live');
          if (!!was.whisper !== !!now.whisper) {
            onEvent({ type: 'whisper', sid, open: !!now.whisper, list: now.whisper ? s.whispers || [] : [] });
          }
        });
        db.ref('sessions').on('child_removed', (snap) => {
          sessions.delete(snap.key);
          onEvent({ type: 'deleted', sid: snap.key });
        });
      });
      return () => db.ref('sessions').off();
    },

    async send(sid, text, emote) {
      const sRef = db.ref('sessions/' + sid);
      // Your first message takes over from the script automatically.
      if (!(await sRef.child('live').once('value')).val()) await sRef.update({ live: true });
      if (text) {
        await db.ref('messages/' + sid).push({ from: 'me', text: String(text).slice(0, 500), mood: emote || '', at: NOW });
        await sRef.update({ updated: NOW, meTyping: false });
      } else {
        await db.ref('emotes/' + sid).push({ emote, at: NOW });
        // The server echoed emotes back to the dashboard; here we do it locally.
        emitEmote?.(sid, emote);
      }
      return { ok: true };
    },
    typing: (sid, on) => db.ref(`sessions/${sid}/meTyping`).set(!!on),
    live: (sid, on) => db.ref(`sessions/${sid}/live`).set(!!on),
    remove: (sid) => db.ref().update({ ['sessions/' + sid]: null, ['messages/' + sid]: null, ['emotes/' + sid]: null,
      ['whispers/' + sid]: null }),
    async prep(prep) {
      const sc = cleanScene(prep);
      const ref = db.ref('preps').push();
      await ref.set({ her: { avatar: cleanAvatar(prep.her?.avatar) }, friends: sc.friends, place: sc.place,
        detail: clip(prep.detail, 120), created: NOW });
      return ref.key;
    },
    // Opening starts from an empty branch; closing deletes it. Nothing lingers.
    whisper: (sid, open) => db.ref().update({ [`sessions/${sid}/whisper`]: !!open, ['whispers/' + sid]: null }),
    wmsg: (sid, text) => db.ref('whispers/' + sid).push({ from: 'me', text: clip(text, 300), at: NOW }),
  };

  window.Meet = Object.assign(window.Meet || {}, { netFirebase: { her, me } });
})();
