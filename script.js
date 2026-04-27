// ===== Firebase Auth UI + Firestore Sync (CDN compat) =====
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
// Enable offline persistence (best-effort). Ignore if unsupported or in multi-tab conflict.
try { firebase.firestore().enablePersistence({ synchronizeTabs: true }); }
catch (e) { console.warn('Firestore persistence not enabled:', e && e.code ? e.code : e); }

const LIBRARY_DOC = 'bandData/library';
const SETLISTS_DOC = 'bandData/setlists';

let libraryUnsub = null;
let setlistsUnsub = null;

const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const userInfo = document.getElementById('userInfo');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const authError = document.getElementById('authError');

function showAppUI(show) {
  document.querySelector('.tab-header').style.display = show ? '' : 'none';
  const _lib    = document.getElementById('libraryView');
  const _sl     = document.getElementById('setlistView');
  const _tabLib = document.getElementById('tabLibrary');
  const _tabSl  = document.getElementById('tabSetlist');
  // Clear any stale inline display overrides so the hidden class is in full control
  _lib.style.display = '';
  _sl.style.display  = '';
  if (show) {
    // Always start on the Library tab so both tabs are reachable after login
    _lib.classList.remove('hidden');
    _sl.classList.add('hidden');
    if (_tabLib) { _tabLib.classList.add('active'); }
    if (_tabSl)  { _tabSl.classList.remove('active'); }
  } else {
    _lib.classList.add('hidden');
    _sl.classList.add('hidden');
  }
}

function attachRealtimeListeners() {
  if (libraryUnsub) libraryUnsub();
  if (setlistsUnsub) setlistsUnsub();

  libraryUnsub = db.doc(LIBRARY_DOC).onSnapshot(snapshot => {
    if (!snapshot.exists) {
      db.doc(LIBRARY_DOC).set({ songs: [] });
      library = [];
    } else {
      library = snapshot.data().songs || [];
    }
    renderLibrary();
  });

  setlistsUnsub = db.doc(SETLISTS_DOC).onSnapshot(snapshot => {
    if (!snapshot.exists) {
      db.doc(SETLISTS_DOC).set({ allSetlists: {} });
      allSetlists = {};
    } else {
      allSetlists = snapshot.data().allSetlists || {};
    }
    // Honor URL hash if present (create empty set if it doesn't exist yet)
    const hashName = decodeURIComponent((window.location.hash || '').slice(1));
    let createdFromHash = false;
    let targetSet = '';

    if (hashName) {
      if (!allSetlists[hashName]) { allSetlists[hashName] = []; createdFromHash = true; }
      targetSet = hashName;
    } else if (currentSetlist && allSetlists[currentSetlist]) {
      // Reuse the last selected setlist if it still exists
      targetSet = currentSetlist;
    } else {
      // No hash and no prior valid selection: start with no active setlist
      targetSet = '';
    }

    currentSetlist = targetSet;
    songs = currentSetlist && Array.isArray(allSetlists[currentSetlist])
      ? [...allSetlists[currentSetlist]]
      : [];
    updateSetlistTitle();
    renderSetlist();
    renderDropdown();
    updateTotal();
    if (createdFromHash) persist();
  });
}

function persistFirestore() {
  if (!auth.currentUser) return;
  db.doc(LIBRARY_DOC).set({ songs: library }, { merge: true })
    .catch(() => showToast('⚠️ Could not save — check your connection.'));
  // Replace the entire allSetlists map so deleted setlists do not reappear
  db.doc(SETLISTS_DOC).set({ allSetlists }, { merge: false })
    .catch(() => showToast('⚠️ Could not save — check your connection.'));
}

auth.onAuthStateChanged(user => {
  // Dismiss the loading spinner shown on initial page load
  const spinner = document.getElementById('authSpinner');
  if (spinner) {
    spinner.classList.add('fade-out');
    setTimeout(() => { spinner.style.display = 'none'; spinner.classList.remove('fade-out'); }, 300);
  }

  if (user) {
    loginForm.style.display = 'none';
    userInfo.style.display = '';
    userEmail.textContent = user.email;
    authError.textContent = '';
    showAppUI(true);
    attachRealtimeListeners();
  } else {
    if (libraryUnsub) { libraryUnsub(); libraryUnsub = null; }
    if (setlistsUnsub) { setlistsUnsub(); setlistsUnsub = null; }

    loginForm.style.display = 'flex';
    userInfo.style.display = 'none';
    userEmail.textContent = '';
    showAppUI(false);

    library = [];
    allSetlists = {};
    songs = [];
  }
});

loginForm.addEventListener('submit', e => {
  e.preventDefault();
  authError.textContent = '';
  auth.signInWithEmailAndPassword(loginEmail.value, loginPassword.value)
    .catch(err => { authError.textContent = err.message; });
});

logoutBtn.addEventListener('click', () => {
  auth.signOut();
});

/* ===== Toast notifications ===== */
function showToast(msg, duration = 2400) {
  let el = document.getElementById('toastBar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toastBar';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('visible'), duration);
}

showAppUI(false);

/* ===== Tabs ===== */
const tabLibrary = document.getElementById('tabLibrary');
const tabSetlist = document.getElementById('tabSetlist');
const libraryView = document.getElementById('libraryView');
const setlistView = document.getElementById('setlistView');

tabLibrary.onclick = () => {
  tabLibrary.classList.add('active');
  tabSetlist.classList.remove('active');
  libraryView.classList.remove('hidden');
  setlistView.classList.add('hidden');
  // Safety: ensure only libraryView is visible
  if (!libraryView.classList.contains('hidden')) setlistView.classList.add('hidden');
};
tabSetlist.onclick = () => {
  tabSetlist.classList.add('active');
  tabLibrary.classList.remove('active');
  libraryView.classList.add('hidden');
  setlistView.classList.remove('hidden');
  // Safety: ensure only setlistView is visible
  if (!setlistView.classList.contains('hidden')) libraryView.classList.add('hidden');
};

/* ===== Elements ===== */
const libraryList = document.getElementById('libraryList');
const libSongName = document.getElementById('libSongName');
const libSongTime = document.getElementById('libSongTime');
const libSongTempo = document.getElementById('libSongTempo'); // may be absent; tempo is mainly edited in the info panel
const saveToLibrary = document.getElementById('saveToLibrary');

const setlist = document.getElementById('setlist');
const totalTimeEl = document.getElementById('totalTime');
const songTemplate = document.getElementById('songTemplate');
const currentSetlistNameEl = document.getElementById('currentSetlistName');
const currentSetlistMetaEl = document.getElementById('currentSetlistMeta');

const setlistDropdownBtn = document.getElementById('setlistDropdownBtn');
const setlistDropdown = document.getElementById('setlistDropdown');

const printBtn = document.getElementById('printBtn');
const shareBtn = document.getElementById('shareBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

/* ===== Storage (mirrored via Firestore) ===== */
let library = [];
let allSetlists = {};
let currentSetlist = '';
let songs = [];

/* ===== Play Set state ===== */
let playSetState = { active: false, index: -1, timer: null };

function persist() {
  // Only persist a named setlist; when no setlist is selected,
  // we still persist the library but leave allSetlists as-is.
  if (currentSetlist) {
    allSetlists[currentSetlist] = songs;
  }
  persistFirestore();
}

/* ===== Audio helpers ===== */

async function uploadAudioFile(file) {
  if (!auth.currentUser) throw new Error('Not signed in');
  const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
  const path = `bandData/audio/${Date.now()}_${safeName}`;
  const ref = storage.ref(path);
  await ref.put(file);
  return await ref.getDownloadURL();
}

async function uploadScoreFile(file) {
  if (!auth.currentUser) throw new Error('Not signed in');
  const safeName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
  const path = `bandData/scores/${Date.now()}_${safeName}`;
  const ref = storage.ref(path);
  await ref.put(file);
  return await ref.getDownloadURL();
}

function isSoundCloud(url) {
  return /soundcloud\.com\/[^/]+\/[^/]+/.test(url);
}

function getDropboxStreamUrl(url) {
  // Transform Dropbox share link to directly streamable URL
  if (url.match(/[?&]dl=\d/)) return url.replace(/([?&])dl=\d/, '$1raw=1');
  return url + (url.includes('?') ? '&' : '?') + 'raw=1';
}

function buildPlayer(audioUrl, autoplay) {
  if (!audioUrl) return null;

  // SoundCloud: use their official embeddable widget
  if (isSoundCloud(audioUrl)) {
    const iframe = document.createElement('iframe');
    const params = [
      `url=${encodeURIComponent(audioUrl)}`,
      `color=%23d4cfc9`,
      `auto_play=${autoplay ? 'true' : 'false'}`,
      `hide_related=true`,
      `show_comments=false`,
      `show_user=false`,
      `show_reposts=false`,
      `show_teaser=false`,
      `visual=false`
    ].join('&');
    iframe.src = `https://w.soundcloud.com/player/?${params}`;
    iframe.allow = 'autoplay';
    iframe.className = 'song-embed song-embed--soundcloud';
    return iframe;
  }

  // Dropbox: convert share link to direct stream URL
  const src = audioUrl.includes('dropbox.com') ? getDropboxStreamUrl(audioUrl) : audioUrl;

  // Native audio — Firebase Storage, Dropbox direct, or any hosted audio file
  const audio = document.createElement('audio');
  audio.src = src;
  audio.controls = true;
  audio.preload = 'metadata';
  audio.className = 'song-audio';
  if (autoplay) audio.autoplay = true;
  return audio;
}

/* ===== Play Set ===== */

function updatePlaySetUI() {
  const btn = document.getElementById('playSetBtn');
  if (!btn) return;
  if (playSetState.active) {
    btn.textContent = '⏹ Stop Set';
    btn.classList.add('active');
  } else {
    btn.textContent = '▶ Play Set';
    btn.classList.remove('active');
  }
}

function stopPlaySet(updateUI = true) {
  if (playSetState.timer) { clearTimeout(playSetState.timer); playSetState.timer = null; }
  document.querySelectorAll('#setlist .song-player-wrap.open').forEach(w => {
    w.innerHTML = ''; w.classList.remove('open');
  });
  document.querySelectorAll('#setlist .song-play-btn.playing').forEach(b => {
    b.textContent = '▶'; b.classList.remove('playing');
  });
  document.querySelectorAll('#setlist .song-item.now-playing').forEach(el => el.classList.remove('now-playing'));
  playSetState.active = false;
  playSetState.index = -1;
  if (updateUI) updatePlaySetUI();
}

function playSetToIndex(i) {
  if (!playSetState.active) return;
  if (i >= songs.length) {
    stopPlaySet();
    showToast('✓ Set complete!');
    return;
  }

  playSetState.index = i;
  const song = songs[i];
  const items = [...document.querySelectorAll('#setlist .song-item')];

  // Highlight current song, close others
  items.forEach((el, idx) => {
    el.classList.toggle('now-playing', idx === i);
    const btn = el.querySelector('.song-play-btn');
    if (btn) { btn.textContent = idx === i ? '⏸' : '▶'; btn.classList.toggle('playing', idx === i); }
    const wrap = el.querySelector('.song-player-wrap');
    if (wrap && idx !== i) { wrap.innerHTML = ''; wrap.classList.remove('open'); }
  });

  const item = items[i];
  if (!item) return;
  item.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const wrap = item.querySelector('.song-player-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  wrap.classList.add('open');

  if (!song.audioUrl) {
    const msg = document.createElement('p');
    msg.className = 'song-no-audio';
    msg.textContent = 'No audio source — advancing after song duration…';
    wrap.appendChild(msg);
    const dur = Math.max(parseTime(song.time) * 1000, 3000);
    playSetState.timer = setTimeout(() => playSetToIndex(i + 1), dur);
    return;
  }

  const player = buildPlayer(song.audioUrl, true);
  if (!player) {
    playSetState.timer = setTimeout(() => playSetToIndex(i + 1), Math.max(parseTime(song.time) * 1000, 3000));
    return;
  }

  wrap.appendChild(player);

  if (player.tagName === 'AUDIO') {
    // Guard prevents 'ended' event and safety timer from both advancing
    let advanced = false;
    const advance = () => {
      if (advanced || !playSetState.active) return;
      advanced = true;
      if (playSetState.timer) { clearTimeout(playSetState.timer); playSetState.timer = null; }
      playSetToIndex(i + 1);
    };

    player.addEventListener('ended', advance);

    const armSafetyTimer = () => {
      if (playSetState.timer) clearTimeout(playSetState.timer);
      // Use the audio's real duration if known; otherwise fall back to listed time + generous buffer
      const actualMs = player.duration && isFinite(player.duration) ? player.duration * 1000 : null;
      const listedMs = Math.max(parseTime(song.time) * 1000, 5000);
      playSetState.timer = setTimeout(advance, actualMs ? actualMs + 3000 : listedMs + 8000);
    };

    player.play().then(() => {
      // Autoplay allowed — arm a safety timer in case 'ended' never fires
      if (player.readyState >= 1 && isFinite(player.duration)) {
        armSafetyTimer();
      } else {
        player.addEventListener('loadedmetadata', armSafetyTimer, { once: true });
        // Belt-and-suspenders: crude fallback if metadata never arrives
        playSetState.timer = setTimeout(advance, Math.max(parseTime(song.time) * 1000, 5000) + 15000);
      }
    }).catch(() => {
      // Autoplay blocked — user must tap; fall back to listed duration
      const dur = Math.max(parseTime(song.time) * 1000, 3000);
      playSetState.timer = setTimeout(advance, dur);
    });
  } else {
    // SoundCloud iframe — can't detect 'ended' cross-origin, advance after song duration
    const dur = Math.max(parseTime(song.time) * 1000, 30000);
    playSetState.timer = setTimeout(() => playSetToIndex(i + 1), dur);
  }
}

function startPlaySet() {
  if (!songs.length) { showToast('No songs in the setlist.'); return; }
  if (!currentSetlist) { showToast('No setlist selected.'); return; }
  stopPlaySet(false);
  playSetState.active = true;
  updatePlaySetUI();
  playSetToIndex(0);
}

// Debounced persist for inline field edits — avoids a Firestore write per keystroke
let _persistFieldTimer = null;
function persistField() {
  clearTimeout(_persistFieldTimer);
  _persistFieldTimer = setTimeout(persist, 800);
}

function updateSetlistTitle() {
  // Update header label
  if (currentSetlistNameEl) {
    currentSetlistNameEl.textContent = currentSetlist || 'Select a setlist';
  }
  // Compute meta (count + total time)
  if (currentSetlistMetaEl) {
    const count = songs.length;
    const totalSecs = songs.reduce((acc, s) => acc + parseTime(s.time), 0);
    const mm = Math.floor(totalSecs / 60).toString();
    const ss = String(totalSecs % 60).padStart(2, '0');
    const plural = count === 1 ? 'song' : 'songs';
    currentSetlistMetaEl.textContent = currentSetlist
      ? (count ? `— ${count} ${plural} • ${mm}:${ss}` : '— 0 songs')
      : '';
  }
  // Update dropdown button label to show active setlist
  if (setlistDropdownBtn) {
    const isOpen = setlistDropdown.classList.contains('show');
    const label = currentSetlist || 'Select setlist';
    setlistDropdownBtn.textContent = `🎛 ${label} ${isOpen ? '▴' : '▾'}`;
  }
  // Show/hide print-share-clear actions based on whether a setlist is loaded
  const actionsEl = document.querySelector('.setlist-actions');
  if (actionsEl) actionsEl.classList.toggle('visible', !!currentSetlist);
  // Reflect current set in the URL hash for easy sharing/navigation
  if (currentSetlist) {
    const desiredHash = '#' + encodeURIComponent(currentSetlist);
    if (window.location.hash !== desiredHash) {
      try { window.history.replaceState(null, '', desiredHash); } catch { window.location.hash = desiredHash; }
    }
  } else {
    // Clear hash when no setlist is selected
    if (window.location.hash) {
      try { window.history.replaceState(null, '', window.location.pathname); }
      catch { window.location.hash = ''; }
    }
  }
}

// Inline rename for the active setlist name
function setupSetlistNameEditing() {
  if (!currentSetlistNameEl) return;
  const beginEdit = () => {
    // Avoid starting another edit if an input already exists
    if (currentSetlistNameEl.dataset.editing === 'yes') return;
    currentSetlistNameEl.dataset.editing = 'yes';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentSetlist;
    input.style.background = 'transparent';
    input.style.color = 'var(--accent)';
    input.style.border = '1px dashed var(--accent)';
    input.style.borderRadius = '6px';
    input.style.padding = '0 0.25rem';
    input.style.font = 'inherit';
    input.style.width = Math.max(6, currentSetlist.length + 2) + 'ch';

    const span = currentSetlistNameEl;
    span.replaceWith(input);
    input.focus();
    input.select();

    const finish = (commit) => {
      const newName = input.value.trim();
      // Restore span first
      input.replaceWith(span);
      span.dataset.editing = '';

      if (!commit) { updateSetlistTitle(); return; }
      if (!newName || newName === currentSetlist) { updateSetlistTitle(); return; }
      if (allSetlists[newName]) {
        showToast('A setlist with that name already exists.');
        updateSetlistTitle();
        return;
      }
      // Rename key in the dictionary
      allSetlists[newName] = Array.isArray(allSetlists[currentSetlist]) ? [...allSetlists[currentSetlist]] : [];
      delete allSetlists[currentSetlist];
      currentSetlist = newName;
      songs = Array.isArray(allSetlists[currentSetlist]) ? [...allSetlists[currentSetlist]] : [];
      persist();
      renderDropdown();
      updateTotal();
      updateSetlistTitle();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));
  };

  // Click to edit (also handles double click naturally)
  currentSetlistNameEl.addEventListener('click', beginEdit);
}

/* ===== Helpers ===== */
function formatTime(t) {
  t = String(t || '').replace(/\D/g, '');
  if (t.length <= 2) return `00:${t.padStart(2, '0')}`;
  if (t.length === 3) return `0${t[0]}:${t.slice(1)}`;
  return `${t.slice(0, -2).padStart(2, '0')}:${t.slice(-2)}`;
}
function parseTime(str) {
  const [m, s] = (str || '').split(':').map(n => Number(n) || 0);
  return m * 60 + s;
}
function updateTotal() {
  const total = songs.reduce((acc, s) => acc + parseTime(s.time), 0);
  const m = Math.floor(total / 60), s = total % 60;
  totalTimeEl.textContent = `Total Time: ${m} min ${s} s`;
}

/* ===== Library (editable + add-to-setlist) ===== */

// Creates a collapsible sub-section inside the lib-info panel
function makeInfoSubSection(icon, title, hasContent, onOpen) {
  const wrap = document.createElement('div');
  wrap.className = 'lib-subsection';
  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'lib-subsection-header' + (hasContent ? ' has-content' : '');
  const headerLeft = document.createElement('span');
  headerLeft.textContent = `${icon} ${title}`;
  const arrow = document.createElement('span');
  arrow.className = 'lib-subsection-arrow';
  arrow.textContent = '▾';
  header.append(headerLeft, arrow);
  const body = document.createElement('div');
  body.className = 'lib-subsection-body';
  header.onclick = () => {
    const open = body.classList.toggle('open');
    arrow.textContent = open ? '▴' : '▾';
    if (open) header.classList.add('open');
    else header.classList.remove('open');
    if (open && onOpen) setTimeout(onOpen, 0);
  };
  wrap.append(header, body);
  return { wrap, body };
}

function renderLibrary() {
  libraryList.innerHTML = '';
  library.forEach((song, i) => {
    const li = document.createElement('li');
    li.className = 'lib-item';
    li.setAttribute('draggable', 'true');
    // Main row: drag handle, name, time, info button, controls
    const mainRow = document.createElement('div');
    mainRow.className = 'lib-main';

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.title = 'Drag to reorder';
    handle.textContent = '≡';

    // Read-only display in the main row
    const nameDisplay = document.createElement('span');
    nameDisplay.className = 'lib-name-display';
    nameDisplay.textContent = song.name;

    const timeDisplay = document.createElement('span');
    timeDisplay.className = 'lib-time-display';
    timeDisplay.textContent = song.time;

    // Edit panel — all fields, shown when row is tapped/clicked
    const infoPanel = document.createElement('div');
    infoPanel.className = 'lib-info';

    // Name
    const nameEditRow = document.createElement('div');
    nameEditRow.className = 'lib-info-row';
    const nameLabel = document.createElement('span');
    nameLabel.className = 'lib-info-label';
    nameLabel.textContent = 'Name';
    const name = document.createElement('input');
    name.className = 'lib-name';
    name.value = song.name;
    name.placeholder = 'Song name';
    name.onblur = () => { library[i].name = name.value.trim(); nameDisplay.textContent = library[i].name; persistField(); };
    name.addEventListener('keydown', e => { if (e.key === 'Enter') name.blur(); });
    nameEditRow.append(nameLabel, name);

    // Duration
    const timeEditRow = document.createElement('div');
    timeEditRow.className = 'lib-info-row';
    const timeLabel = document.createElement('span');
    timeLabel.className = 'lib-info-label';
    timeLabel.textContent = 'Duration';
    const time = document.createElement('input');
    time.className = 'lib-time';
    time.value = song.time;
    time.placeholder = '03:00';
    time.onblur = () => { library[i].time = formatTime(time.value); time.value = library[i].time; timeDisplay.textContent = library[i].time; persistField(); };
    time.addEventListener('keydown', e => { if (e.key === 'Enter') time.blur(); });
    timeEditRow.append(timeLabel, time);

    // Tempo
    const tempoRow = document.createElement('div');
    tempoRow.className = 'lib-info-row';
    const tempoLabel = document.createElement('span');
    tempoLabel.className = 'lib-info-label';
    tempoLabel.textContent = 'Tempo';
    const tempo = document.createElement('input');
    tempo.className = 'lib-tempo';
    tempo.value = song.tempo || '';
    tempo.placeholder = '120 BPM';
    tempo.onblur = () => { library[i].tempo = tempo.value.trim(); persistField(); };
    tempo.addEventListener('keydown', e => { if (e.key === 'Enter') tempo.blur(); });
    tempoRow.append(tempoLabel, tempo);

    // Key
    const keyRow = document.createElement('div');
    keyRow.className = 'lib-info-row';
    const keyLabel = document.createElement('span');
    keyLabel.className = 'lib-info-label';
    keyLabel.textContent = 'Key';
    const keyInput = document.createElement('input');
    keyInput.className = 'lib-key';
    keyInput.value = song.key || '';
    keyInput.placeholder = 'e.g. Am, G major';
    keyInput.onblur = () => { library[i].key = keyInput.value.trim(); persistField(); };
    keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') keyInput.blur(); });
    keyRow.append(keyLabel, keyInput);

    // --- Collapsible sub-sections ---

    // Lyrics
    const lyrics = document.createElement('textarea');
    lyrics.className = 'lib-lyrics';
    lyrics.value = song.lyrics || '';
    lyrics.placeholder = 'Paste or type song lyrics here';
    lyrics.onblur = () => { library[i].lyrics = lyrics.value.trim(); persistField(); };
    const autoResizeLyrics = () => { lyrics.style.height = 'auto'; lyrics.style.height = lyrics.scrollHeight + 'px'; };
    lyrics.addEventListener('input', autoResizeLyrics);
    const { wrap: lyricsWrap, body: lyricsBody } = makeInfoSubSection('🎵', 'Lyrics', !!song.lyrics, autoResizeLyrics);
    lyricsBody.appendChild(lyrics);

    // Notes
    const notes = document.createElement('textarea');
    notes.className = 'lib-notes';
    notes.value = song.notes || '';
    notes.placeholder = 'Cues, arrangement notes, performance reminders…';
    notes.onblur = () => { library[i].notes = notes.value.trim(); persistField(); };
    const autoResizeNotes = () => { notes.style.height = 'auto'; notes.style.height = notes.scrollHeight + 'px'; };
    notes.addEventListener('input', autoResizeNotes);
    const { wrap: notesWrap, body: notesBody } = makeInfoSubSection('📝', 'Notes', !!song.notes, autoResizeNotes);
    notesBody.appendChild(notes);

    // Score / Tab
    const { wrap: scoreWrap, body: scoreBody } = makeInfoSubSection('🎼', 'Score / Tab', !!song.scoreUrl);
    const scoreUrlRow = document.createElement('div');
    scoreUrlRow.className = 'lib-info-row lib-audio-row';
    const scoreUrlLabel = document.createElement('span');
    scoreUrlLabel.className = 'lib-info-label';
    scoreUrlLabel.textContent = 'Link';
    const scoreUrlInput = document.createElement('input');
    scoreUrlInput.className = 'lib-score-url';
    scoreUrlInput.value = song.scoreUrl || '';
    scoreUrlInput.placeholder = 'URL to PDF, image, or tab site';
    scoreUrlInput.onblur = () => { library[i].scoreUrl = scoreUrlInput.value.trim(); persistField(); };
    scoreUrlInput.addEventListener('keydown', e => { if (e.key === 'Enter') scoreUrlInput.blur(); });
    scoreUrlRow.append(scoreUrlLabel, scoreUrlInput);
    const scoreUploadRow = document.createElement('div');
    scoreUploadRow.className = 'lib-audio-upload-row';
    const scoreUploadLabel = document.createElement('label');
    scoreUploadLabel.className = 'lib-upload-btn';
    const scoreUploadText = document.createElement('span');
    scoreUploadText.textContent = '⬆ Upload score / tab file';
    const scoreFileInput = document.createElement('input');
    scoreFileInput.type = 'file';
    scoreFileInput.accept = '.pdf,.png,.jpg,.jpeg,.gif,.webp';
    scoreFileInput.className = 'lib-file-input';
    scoreFileInput.addEventListener('change', async () => {
      const file = scoreFileInput.files[0];
      if (!file) return;
      scoreUploadText.textContent = '⏳ Uploading…';
      try {
        const url = await uploadScoreFile(file);
        library[i].scoreUrl = url;
        scoreUrlInput.value = url;
        persist();
        showToast(`"${file.name}" uploaded`);
        scoreUploadText.textContent = '✓ Uploaded';
        setTimeout(() => { scoreUploadText.textContent = '⬆ Upload score / tab file'; }, 2500);
      } catch (err) {
        showToast('Upload failed: ' + (err && err.message ? err.message : 'unknown error'));
        scoreUploadText.textContent = '⬆ Upload score / tab file';
      }
    });
    scoreUploadLabel.append(scoreUploadText, scoreFileInput);
    scoreUploadRow.appendChild(scoreUploadLabel);
    scoreBody.append(scoreUrlRow, scoreUploadRow);
    if (song.scoreUrl) {
      const viewScoreLink = document.createElement('a');
      viewScoreLink.href = song.scoreUrl;
      viewScoreLink.target = '_blank';
      viewScoreLink.rel = 'noopener noreferrer';
      viewScoreLink.className = 'lib-view-score-btn';
      viewScoreLink.textContent = '🔗 View score / tab';
      scoreBody.appendChild(viewScoreLink);
    }

    // Audio
    const { wrap: audioWrap, body: audioBody } = makeInfoSubSection('🎧', 'Audio', !!song.audioUrl);

    // Link paste row (SoundCloud / Dropbox)
    const audioLinkRow = document.createElement('div');
    audioLinkRow.className = 'lib-audio-link-row';
    const audioInput = document.createElement('input');
    audioInput.type = 'url';
    audioInput.className = 'lib-audio-url';
    const _isFbUrl = (song.audioUrl || '').includes('firebasestorage.googleapis.com');
    audioInput.value = _isFbUrl ? '' : (song.audioUrl || '');
    audioInput.placeholder = _isFbUrl
      ? '✓ File uploaded — paste a link to replace'
      : 'Paste a SoundCloud or Dropbox link';
    audioInput.onblur = () => {
      const newUrl = audioInput.value.trim();
      // Don’t wipe an uploaded file when blurring an empty field
      const storedIsFb = (library[i].audioUrl || '').includes('firebasestorage.googleapis.com');
      if (!newUrl && storedIsFb) return;
      library[i].audioUrl = newUrl;
      songs.forEach(s => { if (s.name === library[i].name) s.audioUrl = newUrl; });
      persistField();
    };
    audioInput.addEventListener('keydown', e => { if (e.key === 'Enter') audioInput.blur(); });
    audioLinkRow.appendChild(audioInput);

    const audioSep = document.createElement('p');
    audioSep.className = 'lib-audio-sep';
    audioSep.textContent = '— or upload a file —';
    const uploadRow = document.createElement('div');
    uploadRow.className = 'lib-audio-upload-row';
    const uploadLabel = document.createElement('label');
    uploadLabel.className = 'lib-upload-btn';
    const uploadText = document.createElement('span');
    uploadText.textContent = '⬆ Upload audio file';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.className = 'lib-file-input';
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      uploadText.textContent = '⏳ Uploading…';
      try {
        const url = await uploadAudioFile(file);
        library[i].audioUrl = url;
        // Sync to any setlist copies of this song
        songs.forEach(s => { if (s.name === library[i].name) s.audioUrl = url; });
        persist();
        infoBtn.classList.add('has-notes');
        showToast(`"${file.name}" uploaded`);
        uploadText.textContent = '✓ Uploaded';
        setTimeout(() => { uploadText.textContent = '⬆ Upload audio file'; }, 2500);
      } catch (err) {
        showToast('Upload failed: ' + (err && err.message ? err.message : 'unknown error'));
        uploadText.textContent = '⬆ Upload audio file';
      }
    });
    uploadLabel.append(uploadText, fileInput);
    uploadRow.appendChild(uploadLabel);
    audioBody.append(audioLinkRow, audioSep, uploadRow);

    infoPanel.append(nameEditRow, timeEditRow, tempoRow, keyRow, lyricsWrap, notesWrap, scoreWrap, audioWrap);

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️ Delete from library';
    delBtn.className = 'lib-delete-btn';
    delBtn.onclick = () => { library.splice(i, 1); persist(); renderLibrary(); };
    infoPanel.appendChild(delBtn);

    const controls = document.createElement('div');
    controls.className = 'lib-controls';

    // Info toggle button
    const infoBtn = document.createElement('button');
    infoBtn.className = 'lib-info-toggle';
    if (song.lyrics || song.notes || song.key || song.audioUrl || song.scoreUrl || song.tempo) infoBtn.classList.add('has-notes');
    infoBtn.textContent = 'ℹ️';
    infoBtn.title = 'Edit song details';
    infoBtn.onclick = () => {
      const opening = !infoPanel.classList.contains('open');
      infoPanel.classList.toggle('open', opening);
      li.classList.toggle('lib-expanded', opening);
      if (opening) setTimeout(() => name.focus(), 60);
    };

    // ➕ add to current setlist (push a COPY to avoid shared references)
    const addBtn = document.createElement('button');
    addBtn.textContent = '➕';
    addBtn.title = 'Add to current setlist';
    addBtn.onclick = () => {
      if (!currentSetlist) {
        showToast('No setlist selected — go to Setlist tab and pick or create one first.');
        return;
      }
      const src = library[i] || {};
      const copy = { name: src.name, time: src.time, tempo: src.tempo, key: src.key, lyrics: src.lyrics, notes: src.notes, audioUrl: src.audioUrl, scoreUrl: src.scoreUrl };
      songs.push(copy);
      persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
      const totalSecs = songs.reduce((acc, s) => acc + parseTime(s.time), 0);
      const mm = Math.floor(totalSecs / 60);
      const ss = String(totalSecs % 60).padStart(2, '0');
      showToast(`“${src.name}” added — total ${mm}:${ss}`);
    };

    controls.append(infoBtn, addBtn);
    mainRow.append(handle, nameDisplay, timeDisplay, controls);
    li.append(mainRow, infoPanel);
    libraryList.appendChild(li);

    // Mark drags that originate from the handle (for mouse)
    handle.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        li.dataset.dragFromHandle = '1';
      }
    });
    // Mouse drag (handle-only) for library reordering
    li.addEventListener('dragstart', (e) => {
      // Allow only if we started on the handle (set on pointerdown)
      if (li.dataset.dragFromHandle !== '1') { e.preventDefault(); return; }
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'reorder'); } catch {}
      li.classList.add('dragging');
      try { const img = document.createElement('canvas'); img.width = 1; img.height = 1; e.dataTransfer.setDragImage(img, 0, 0); } catch {}
      startAutoScroll();
    });
    li.addEventListener('dragend', () => {
      delete li.dataset.dragFromHandle;
      li.classList.remove('dragging');
      stopAutoScroll();
      // Rebuild library from DOM (read inputs)
      library = [...libraryList.children].map(row => ({
        name: (row.querySelector('.lib-name')?.value || '').trim(),
        time: formatTime(row.querySelector('.lib-time')?.value || ''),
        tempo: (row.querySelector('.lib-tempo')?.value || '').trim(),
        key: (row.querySelector('.lib-key')?.value || '').trim(),
        lyrics: (row.querySelector('.lib-lyrics')?.value || '').trim(),
        notes: (row.querySelector('.lib-notes')?.value || '').trim(),
        audioUrl: (row.querySelector('.lib-audio-url')?.value || '').trim(),
        scoreUrl: (row.querySelector('.lib-score-url')?.value || '').trim()
      }));
      persist();
      renderLibrary();
    });

    // Touch/pen: long-press anywhere on the row (not on a button/input) to start drag
    li.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.target && (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea'))) return;
      const capturedId = e.pointerId, startY = e.clientY, startX = e.clientX;
      let moved = false;
      const onMove = (ev) => {
        if (Math.abs(ev.clientY - startY) > 9 || Math.abs(ev.clientX - startX) > 9) {
          moved = true; clearTimeout(pressTimer); cleanup();
        }
      };
      const cleanup = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
      const onUp = () => { clearTimeout(pressTimer); cleanup(); };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
      window.addEventListener('pointercancel', onUp, { once: true });
      const pressTimer = setTimeout(() => {
        cleanup();
        if (moved || libTouchDrag.active) return;
        li.classList.add('long-press-active');
        startTouchDragLib({ pointerId: capturedId, clientY: startY, clientX: startX, pointerType: e.pointerType, preventDefault: () => {} }, li);
        setTimeout(() => li.classList.remove('long-press-active'), 400);
      }, 380);
    });
  });
}

// ===== Library container drag logic =====
const libDragState = { rafId: 0, lastY: 0 };

function getDragAfterElementLib(container, y) {
  const elements = [...container.querySelectorAll('.lib-item:not(.dragging)')];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  for (const el of elements) {
    const box = el.getBoundingClientRect();
    const offset = y - (box.top + box.height / 2);
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: el };
    }
  }
  return closest.element;
}

function processLibDragOver() {
  libDragState.rafId = 0;
  const dragging = libraryList.querySelector('.dragging');
  if (!dragging) return;
  const y = libDragState.lastY;
  // Clear hints
  [...libraryList.children].forEach(li => li.classList.remove('drop-above', 'drop-below'));
  const after = getDragAfterElementLib(libraryList, y);
  if (after) {
    if (dragging === after || dragging.nextElementSibling === after) { after.classList.add('drop-above'); return; }
    after.classList.add('drop-above');
    libraryList.insertBefore(dragging, after);
  } else {
    const last = libraryList.lastElementChild;
    if (last) last.classList.add('drop-below');
    if (dragging !== libraryList.lastElementChild) libraryList.appendChild(dragging);
  }
}

libraryList.addEventListener('dragenter', e => { e.preventDefault(); });
libraryList.addEventListener('dragover', e => {
  e.preventDefault();
  libDragState.lastY = e.clientY;
  if (!libDragState.rafId) libDragState.rafId = requestAnimationFrame(processLibDragOver);
});
libraryList.addEventListener('drop', e => { e.preventDefault(); });
libraryList.addEventListener('dragleave', () => {
  [...libraryList.children].forEach(li => li.classList.remove('drop-above', 'drop-below'));
});

// Touch fallback for Library
let libTouchDrag = { active: false, item: null, placeholder: null, grabOffsetY: 0, rectLeft: 0, width: 0 };

function startTouchDragLib(e, item) {
  if (document.querySelector('.dragging')) return;
  if (typeof e.preventDefault === 'function') e.preventDefault();
  item.setPointerCapture(e.pointerId);

  const rect = item.getBoundingClientRect();
  libTouchDrag.active = true;
  libTouchDrag.item = item;
  libTouchDrag.grabOffsetY = e.clientY - rect.top;
  libTouchDrag.rectLeft = rect.left;
  libTouchDrag.width = rect.width;

  const ph = document.createElement('li');
  ph.className = 'song-placeholder';
  ph.style.height = rect.height + 'px';
  libTouchDrag.placeholder = ph;
  item.parentNode.insertBefore(ph, item);

  item.classList.add('touch-dragging');
  item.style.position = 'fixed';
  item.style.left = libTouchDrag.rectLeft + 'px';
  item.style.width = libTouchDrag.width + 'px';
  item.style.top = (e.clientY - libTouchDrag.grabOffsetY) + 'px';
  item.style.zIndex = 10000;

  setTimeout(() => {
    if (libTouchDrag.active && item.parentNode) {
      item.parentNode.removeChild(item);
      document.body.appendChild(item);
    }
  }, 0);

  document.body.style.userSelect = 'none';
  startAutoScroll();

  const move = (ev) => handleTouchMoveLib(ev);
  const up = (ev) => endTouchDragLib(ev);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  window.addEventListener('pointercancel', up, { once: true });
  libTouchDrag._move = move; libTouchDrag._up = up;
}

function handleTouchMoveLib(e) {
  if (!libTouchDrag.active || !libTouchDrag.item) return;
  libDragState.lastY = e.clientY;
  libTouchDrag.item.style.top = (e.clientY - libTouchDrag.grabOffsetY) + 'px';

  const after = getDragAfterElementLib(libraryList, e.clientY);
  if (after) {
    if (after !== libTouchDrag.placeholder) libraryList.insertBefore(libTouchDrag.placeholder, after);
  } else {
    libraryList.appendChild(libTouchDrag.placeholder);
  }
}

function endTouchDragLib(e) {
  if (!libTouchDrag.active) return;
  stopAutoScroll();
  const { item, placeholder } = libTouchDrag;
  if (placeholder && placeholder.parentNode) {
    placeholder.parentNode.insertBefore(item, placeholder);
    placeholder.remove();
  }
  item.classList.remove('touch-dragging');
  item.style.position = '';
  item.style.left = '';
  item.style.top = '';
  item.style.width = '';
  item.style.zIndex = '';
  document.body.style.userSelect = '';
  if (libTouchDrag._move) window.removeEventListener('pointermove', libTouchDrag._move);
  libTouchDrag = { active: false, item: null, placeholder: null, grabOffsetY: 0, rectLeft: 0, width: 0 };

  // Persist new order from DOM
  library = [...libraryList.children].map(row => ({
    name: (row.querySelector('.lib-name')?.value || '').trim(),
    time: formatTime(row.querySelector('.lib-time')?.value || ''),
    tempo: (row.querySelector('.lib-tempo')?.value || '').trim(),
    key: (row.querySelector('.lib-key')?.value || '').trim(),
    lyrics: (row.querySelector('.lib-lyrics')?.value || '').trim(),
    notes: (row.querySelector('.lib-notes')?.value || '').trim(),
    audioUrl: (row.querySelector('.lib-audio-url')?.value || '').trim(),
    scoreUrl: (row.querySelector('.lib-score-url')?.value || '').trim()
  }));
  persist();
  renderLibrary();
}

const addSongPanel   = document.getElementById('addSongPanel');
const addSongConfirm = document.getElementById('addSongConfirm');

// Toggle the add-song panel open/closed
saveToLibrary.onclick = (e) => {
  e.stopPropagation();
  const opening = !addSongPanel.classList.contains('open');
  addSongPanel.classList.toggle('open', opening);
  saveToLibrary.classList.toggle('active', opening);
  if (opening) setTimeout(() => libSongName.focus(), 60);
};

// Close panel when clicking outside
document.addEventListener('click', (e) => {
  if (!addSongPanel.contains(e.target) && e.target !== saveToLibrary) {
    addSongPanel.classList.remove('open');
    saveToLibrary.classList.remove('active');
  }
});

function doAddSong() {
  const n = libSongName.value.trim();
  let t = formatTime(libSongTime.value || '03:00');
  const tempo = libSongTempo ? libSongTempo.value.trim() : '';
  if (!n) { libSongName.focus(); return; }

  const existingIndex = library.findIndex(s => (s.name || '').toLowerCase() === n.toLowerCase());
  if (existingIndex !== -1) {
    if (libSongTime.value.trim()) library[existingIndex].time = t;
    if (tempo) library[existingIndex].tempo = tempo;
    library[existingIndex].name = n;
  } else {
    library.push({ name: n, time: t, tempo });
  }
  libSongName.value = '';
  libSongTime.value = '';
  if (libSongTempo) libSongTempo.value = '';
  persist(); renderLibrary();
  // Close panel and show confirmation
  addSongPanel.classList.remove('open');
  saveToLibrary.classList.remove('active');
  showToast(`"${n}" added to library`);
}

addSongConfirm.onclick = doAddSong;

// Enter key in any field submits
[libSongName, libSongTime, libSongTempo].forEach(inp => {
  if (!inp) return;
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); doAddSong(); }
    if (e.key === 'Escape') { addSongPanel.classList.remove('open'); saveToLibrary.classList.remove('active'); }
  });
});

/* ===== Setlist (read-only + draggable) ===== */
function renderSetlist() {
  // Stop any active play-set session before rebuilding the DOM
  if (playSetState.active) stopPlaySet(true);

  setlist.innerHTML = '';
  songs.forEach((song, i) => {
    const item = songTemplate.content.cloneNode(true).children[0];

    // spans are read-only in the setlist view
    item.querySelector('.song-order').textContent = i + 1;
    item.querySelector('.song-name').textContent  = song.name;
    item.querySelector('.song-time').textContent  = song.time;
    item.querySelector('.song-tempo').textContent = song.tempo || '';
    item.dataset.origIndex = i;

    // delete ONLY from setlist
    item.querySelector('.delete').onclick = () => {
      songs.splice(i, 1);
      persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
    };

    // Per-song play button
    const playBtn  = item.querySelector('.song-play-btn');
    const playerWrap = item.querySelector('.song-player-wrap');
    if (playBtn) {
      if (song.audioUrl) playBtn.classList.add('has-audio');
      playBtn.onclick = (e) => {
        e.stopPropagation();
        if (playSetState.active) stopPlaySet();
        const isOpen = playerWrap.classList.contains('open');
        if (isOpen) {
          playerWrap.innerHTML = ''; playerWrap.classList.remove('open');
          playBtn.textContent = '▶'; playBtn.classList.remove('playing');
          return;
        }
        // Close any other open inline players
        document.querySelectorAll('#setlist .song-player-wrap.open').forEach(w => { w.innerHTML = ''; w.classList.remove('open'); });
        document.querySelectorAll('#setlist .song-play-btn.playing').forEach(b => { b.textContent = '▶'; b.classList.remove('playing'); });
        playerWrap.classList.add('open');
        // Always look up the freshest audioUrl: check library first, fall back to setlist copy
        const libMatch = library.find(l => l.name === song.name);
        const audioUrl = (libMatch && libMatch.audioUrl) || song.audioUrl || '';
        if (audioUrl) {
          // Keep setlist copy in sync
          song.audioUrl = audioUrl;
          playBtn.textContent = '⏸'; playBtn.classList.add('playing');
          const player = buildPlayer(audioUrl, true);
          if (player) {
            playerWrap.appendChild(player);
            if (player.tagName === 'AUDIO') player.play().catch(() => {});
          } else {
            playerWrap.innerHTML = '<p class="song-no-audio">Unable to embed this URL.</p>';
          }
        } else {
          playerWrap.innerHTML = '<p class="song-no-audio">No audio source. Add one in the Library tab.</p>';
        }
      };
    }

    // drag handlers
    item.addEventListener('dragstart', (e) => {
      // Improve cross-browser DnD
      try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'reorder'); } catch {}
      item.classList.add('dragging');
      item.setAttribute('aria-grabbed', 'true');
      // Optional: better drag image
      try {
        const img = document.createElement('canvas');
        img.width = 1; img.height = 1; // transparent pixel
        e.dataTransfer.setDragImage(img, 0, 0);
      } catch {}
      startAutoScroll();
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      item.setAttribute('aria-grabbed', 'false');
      stopAutoScroll();
      // write back new order from DOM, preserving all song fields (including lyrics)
      const prevSongs = songs;
      songs = [...setlist.children].map(li => {
        const origIdx = parseInt(li.dataset.origIndex, 10);
        return (!isNaN(origIdx) && prevSongs[origIdx])
          ? { ...prevSongs[origIdx] }
          : { name: li.querySelector('.song-name').textContent, time: li.querySelector('.song-time').textContent, tempo: li.querySelector('.song-tempo').textContent };
      });
      persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
    });

    item.style.animationDelay = Math.min(i * 0.045, 0.3) + 's';
    item.classList.add('animate-in');
    setlist.appendChild(item);

    // Pointer/touch fallback for reordering on devices without native HTML5 DnD.
    // For touch, only start drag when the user grabs the handle so taps on
    // the delete button (or general scrolling) aren't hijacked by drag logic.
    item.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return; // mouse uses native DnD
      const onHandle = e.target && e.target.closest('.drag-handle');
      if (!onHandle) return;
      startTouchDrag(e, item);
    });
  });
  updateTotal();
}

// Helper to compute the element after which the dragged item should be placed
function getDragAfterElement(container, y) {
  const elements = [...container.querySelectorAll('.song-item:not(.dragging)')];
  let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
  for (const el of elements) {
    const box = el.getBoundingClientRect();
    const offset = y - (box.top + box.height / 2);
    if (offset < 0 && offset > closest.offset) {
      closest = { offset, element: el };
    }
  }
  return closest.element;
}

// Throttled DnD calculations to keep drag smooth
const dragState = { rafId: 0, lastY: 0, autoScrollId: 0 };

function processDragOver() {
  dragState.rafId = 0;
  const dragging = document.querySelector('.dragging');
  if (!dragging) return;

  const y = dragState.lastY;
  // Clear old hints
  [...setlist.children].forEach(li => li.classList.remove('drop-above', 'drop-below'));

  const after = getDragAfterElement(setlist, y);
  if (after) {
    // Skip DOM move if already in right place
    if (dragging === after || dragging.nextElementSibling === after) {
      after.classList.add('drop-above');
      return;
    }
    after.classList.add('drop-above');
    setlist.insertBefore(dragging, after);
  } else {
    // dropping at the end; avoid redundant append
    const last = setlist.lastElementChild;
    if (last) last.classList.add('drop-below');
    if (dragging !== setlist.lastElementChild) setlist.appendChild(dragging);
  }
}

function startAutoScroll() {
  stopAutoScroll();
  dragState.autoScrollId = setInterval(() => {
    const edge = 60;
    const y = dragState.lastY;
    if (!y) return;
    const bottomGap = window.innerHeight - y;
    if (y < edge) {
      window.scrollBy(0, -12);
    } else if (bottomGap < edge) {
      window.scrollBy(0, 12);
    }
  }, 16);
}
function stopAutoScroll() {
  if (dragState.autoScrollId) {
    clearInterval(dragState.autoScrollId);
    dragState.autoScrollId = 0;
  }
}

setlist.addEventListener('dragenter', e => { e.preventDefault(); });
setlist.addEventListener('dragover', e => {
  e.preventDefault();
  dragState.lastY = e.clientY;
  if (!dragState.rafId) dragState.rafId = requestAnimationFrame(processDragOver);
});
setlist.addEventListener('drop', e => { e.preventDefault(); });

setlist.addEventListener('dragleave', () => {
  // Clean up any hints when leaving the container
  [...setlist.children].forEach(li => li.classList.remove('drop-above', 'drop-below'));
});

// Touch/Pointer drag implementation
let touchDrag = { active: false, item: null, placeholder: null, grabOffsetY: 0, rectLeft: 0, width: 0 };

function startTouchDrag(e, item) {
  // Only use this path for touch/pen; allow mouse to use native DnD
  if (e.pointerType === 'mouse') return;
  // Guard: ignore if already dragging via HTML5 DnD
  if (document.querySelector('.dragging')) return;

  e.preventDefault();
  item.setPointerCapture(e.pointerId);

  const rect = item.getBoundingClientRect();
  touchDrag.active = true;
  touchDrag.item = item;
  touchDrag.grabOffsetY = e.clientY - rect.top;
  touchDrag.rectLeft = rect.left;
  touchDrag.width = rect.width;

  // Create placeholder
  const ph = document.createElement('li');
  ph.className = 'song-placeholder';
  ph.style.height = rect.height + 'px';
  touchDrag.placeholder = ph;
  item.parentNode.insertBefore(ph, item);

  // Elevate dragged item
  item.classList.add('touch-dragging');
  item.style.position = 'fixed';
  item.style.left = touchDrag.rectLeft + 'px';
  item.style.width = touchDrag.width + 'px';
  item.style.top = (e.clientY - touchDrag.grabOffsetY) + 'px';
  item.style.zIndex = 10000;

  // Temporarily remove from flow
  setTimeout(() => {
    if (touchDrag.active && item.parentNode) {
      item.parentNode.removeChild(item);
      document.body.appendChild(item);
    }
  }, 0);

  // Disable text selection while dragging
  document.body.style.userSelect = 'none';

  startAutoScroll();
  const move = (ev) => handleTouchMove(ev);
  const up = (ev) => endTouchDrag(ev);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  // In case of cancel
  window.addEventListener('pointercancel', up, { once: true });

  // Store handlers for cleanup
  touchDrag._move = move;
  touchDrag._up = up;
}

function handleTouchMove(e) {
  if (!touchDrag.active || !touchDrag.item) return;
  dragState.lastY = e.clientY; // reuse auto-scroll logic
  touchDrag.item.style.top = (e.clientY - touchDrag.grabOffsetY) + 'px';

  // Position placeholder based on pointer
  const after = getDragAfterElement(setlist, e.clientY);
  if (after) {
    if (after !== touchDrag.placeholder) setlist.insertBefore(touchDrag.placeholder, after);
  } else {
    setlist.appendChild(touchDrag.placeholder);
  }
}

function endTouchDrag(e) {
  if (!touchDrag.active) return;
  stopAutoScroll();

  const { item, placeholder } = touchDrag;
  // Put the item back into the list at placeholder position
  if (placeholder && placeholder.parentNode) {
    placeholder.parentNode.insertBefore(item, placeholder);
    placeholder.remove();
  }
  // Reset styles
  item.classList.remove('touch-dragging');
  item.style.position = '';
  item.style.left = '';
  item.style.top = '';
  item.style.width = '';
  item.style.zIndex = '';

  document.body.style.userSelect = '';

  // Cleanup listeners
  if (touchDrag._move) window.removeEventListener('pointermove', touchDrag._move);

  touchDrag = { active: false, item: null, placeholder: null, grabOffsetY: 0, rectLeft: 0, width: 0 };

  // Persist new order from DOM, preserving all song fields (including lyrics)
  const prevSongs = songs;
  songs = [...setlist.children].map(li => {
    const origIdx = parseInt(li.dataset.origIndex, 10);
    return (!isNaN(origIdx) && prevSongs[origIdx])
      ? { ...prevSongs[origIdx] }
      : { name: li.querySelector('.song-name').textContent, time: li.querySelector('.song-time').textContent, tempo: li.querySelector('.song-tempo').textContent };
  });
  persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
}

// Keyboard reordering for accessibility and precision
setlist.addEventListener('keydown', (e) => {
  const target = e.target;
  if (!target || !target.classList || !target.classList.contains('song-item')) return;
  const index = [...setlist.children].indexOf(target);
  if (index < 0) return;

  const move = (from, to) => {
    if (to < 0 || to >= songs.length) return;
    const [item] = songs.splice(from, 1);
    songs.splice(to, 0, item);
    persist();
    renderSetlist();
    updateTotal();
    updateSetlistTitle();
    // restore focus to the moved item
    const li = setlist.children[to];
    if (li) li.focus();
  };

  if (e.key === 'ArrowUp') { e.preventDefault(); move(index, index - 1); }
  if (e.key === 'ArrowDown') { e.preventDefault(); move(index, index + 1); }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    songs.splice(index, 1);
    persist();
    renderSetlist();
    updateTotal();
    updateSetlistTitle();
    const li = setlist.children[Math.min(index, songs.length - 1)];
    if (li) li.focus();
  }
});

/* ===== Setlist dropdown (load/save/new) ===== */
function renderDropdown() {
  setlistDropdown.innerHTML = '';

  // Existing setlists: name + total time only
  Object.keys(allSetlists).forEach(name => {
    const setSongs = Array.isArray(allSetlists[name]) ? allSetlists[name] : [];
    const totalSecs = setSongs.reduce((acc, s) => acc + parseTime(s.time), 0);
    const mm = Math.floor(totalSecs / 60);
    const ss = String(totalSecs % 60).padStart(2, '0');
    const timeStr = totalSecs > 0 ? `${mm}:${ss}` : '—';

    const row = document.createElement('div');
    row.className = 'dropdown-set-row' + (name === currentSetlist ? ' active-set' : '');
    row.onclick = () => {
      currentSetlist = name;
      songs = Array.isArray(allSetlists[name]) ? [...allSetlists[name]] : [];
      persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
      toggleDropdown(false);
    };

    const nameEl = document.createElement('span');
    nameEl.className = 'dropdown-set-name';
    nameEl.textContent = name;

    const timeEl = document.createElement('span');
    timeEl.className = 'dropdown-set-time';
    timeEl.textContent = timeStr;

    row.appendChild(nameEl);
    row.appendChild(timeEl);
    setlistDropdown.appendChild(row);
  });


  // Divider
  const hr = document.createElement('div');
  hr.style.height = '1px';
  hr.style.background = '#333';
  setlistDropdown.appendChild(hr);


  // Save Current As… (inline input)
  const saveBtn = document.createElement('button');
  saveBtn.textContent = '💾 Save Current As…';
  saveBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Setlist name';
    input.style.marginLeft = '0.5rem';
    saveBtn.after(input);
    input.focus();
    input.onblur = () => {
      const name = input.value.trim();
      if (name) {
        allSetlists[name] = [...songs];
        currentSetlist = name;
        persist();
        renderDropdown();
        toggleDropdown(false);
        updateSetlistTitle();
      }
      input.remove();
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') input.remove();
    });
  };
  setlistDropdown.appendChild(saveBtn);


  // New Empty Setlist (inline input)
  const newBtn = document.createElement('button');
  newBtn.textContent = '＋ New Empty Setlist';
  newBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'New setlist name';
    input.style.marginLeft = '0.5rem';
    newBtn.after(input);
    input.focus();
    input.onblur = () => {
      const name = input.value.trim();
      if (name) {
        allSetlists[name] = [];
        currentSetlist = name;
        songs = [];
        persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
        renderDropdown();
        toggleDropdown(false);
      }
      input.remove();
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') input.remove();
    });
  };
  setlistDropdown.appendChild(newBtn);
}

function toggleDropdown(force) {
  const show = force !== undefined ? force : !setlistDropdown.classList.contains('show');
  setlistDropdown.classList.toggle('show', show);
  updateSetlistTitle();

  // smart positioning (open upward if less space below)
  const rect = setlistDropdownBtn.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
  setlistDropdown.style.top = openUp ? 'auto' : '2.6rem';
  setlistDropdown.style.bottom = openUp ? '2.6rem' : 'auto';
}

setlistDropdownBtn.onclick = e => { e.stopPropagation(); renderDropdown(); toggleDropdown(); };
document.addEventListener('click', e => {
  if (!setlistDropdown.contains(e.target) && e.target !== setlistDropdownBtn) {
    toggleDropdown(false);
  }
});

// Delete the currently loaded setlist
const deleteSetlistBtn = document.getElementById('deleteSetlistBtn');
if (deleteSetlistBtn) {
  deleteSetlistBtn.onclick = () => {
    if (!currentSetlist) return;
    if (deleteSetlistBtn.dataset.confirm === 'yes') {
      const name = currentSetlist;
      delete allSetlists[name];
      const remaining = Object.keys(allSetlists);
      currentSetlist = remaining[0] || '';
      songs = currentSetlist && Array.isArray(allSetlists[currentSetlist])
        ? [...allSetlists[currentSetlist]] : [];
      persist(); renderSetlist(); renderDropdown(); updateTotal(); updateSetlistTitle();
      deleteSetlistBtn.textContent = '🗑️ Delete';
      deleteSetlistBtn.dataset.confirm = '';
      showToast(`"${name}" deleted`);
    } else {
      deleteSetlistBtn.textContent = 'Confirm delete?';
      deleteSetlistBtn.dataset.confirm = 'yes';
      setTimeout(() => {
        deleteSetlistBtn.textContent = '🗑️ Delete';
        deleteSetlistBtn.dataset.confirm = '';
      }, 2500);
    }
  };
}

// Duplicate the currently loaded setlist
const dupSetlistBtn = document.getElementById('dupSetlistBtn');
if (dupSetlistBtn) {
  dupSetlistBtn.onclick = () => {
    if (!currentSetlist) return;
    let copyName = currentSetlist + ' (copy)';
    let n = 2;
    while (allSetlists[copyName]) copyName = currentSetlist + ` (copy ${n++})`;
    allSetlists[copyName] = songs.map(s => ({ ...s }));
    currentSetlist = copyName;
    persist(); renderDropdown(); updateSetlistTitle();
    showToast(`Duplicated as "${copyName}"`);
  };
}

// Respond to external hash changes (e.g., pasted URL)
window.addEventListener('hashchange', () => {
  const name = decodeURIComponent((window.location.hash || '').slice(1));
  if (!name) return;
  if (!allSetlists[name]) allSetlists[name] = [];
  currentSetlist = name;
  songs = Array.isArray(allSetlists[name]) ? [...allSetlists[name]] : [];
  persist();
  renderSetlist();
  renderDropdown();
  updateTotal();
  updateSetlistTitle();
});

/* ===== Buttons ===== */
clearAllBtn.onclick = () => {
  // Inline clear confirmation: double click to clear
  if (clearAllBtn.dataset.confirm === 'yes') {
    songs = [];
    persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
    clearAllBtn.textContent = '🧹 Clear';
    clearAllBtn.dataset.confirm = '';
  } else {
    clearAllBtn.textContent = 'Click again to confirm';
    clearAllBtn.dataset.confirm = 'yes';
    setTimeout(() => {
      clearAllBtn.textContent = '🧹 Clear';
      clearAllBtn.dataset.confirm = '';
    }, 2000);
  }
};


printBtn.onclick = () => {
  const html = songs
    .map((s, i) => {
      const tempoText = s.tempo ? ` <span class="tempo">${s.tempo}</span>` : '';
      return `<div class="line"><strong>${i + 1}.</strong> ${s.name}${tempoText} <span class="t">(${s.time})</span></div>`;
    })
    .join('');
  const win = window.open('', '_blank');
  if (!win) { showToast('⚠️ Popup blocked — allow popups for this site to print.'); return; }
  win.document.write(`<!doctype html><html><head><style>
    @page { size: auto; margin: 18mm; }
    body { font-family: Arial, sans-serif; font-size: 18px; line-height: 1.7; margin: 32px; color: #000; }
    h1 { font-size: 1.3em; margin-bottom: 1.2rem; border-bottom: 2px solid #000; padding-bottom: 0.4rem; }
    .line { break-inside: avoid; padding: .3rem 0; border-bottom: 1px solid #e5e5e5; }
    strong { margin-right: .4rem; }
    .t { opacity: .75; }
    .tempo { opacity: .55; font-size: .85em; margin-left: .5rem; }
  </style></head><body>
    <h1>${currentSetlist || 'Setlist'}</h1>
    <div id="printContent">${html}</div>
  </body></html>`);
  win.document.close();
  // onload fires after document.close() — more reliable than setTimeout on iOS Safari
  win.onload = () => { win.focus(); win.print(); win.onafterprint = () => win.close(); };
  // Fallback for browsers where onload may not fire on document.write content
  setTimeout(() => { if (win && !win.closed) { win.focus(); win.print(); } }, 1200);
};


shareBtn.onclick = async () => {
  // Ensure URL/hash reflects the current set before composing link
  updateSetlistTitle();
  // Build shareable text: Title line with total time, then song names
  const totalSecs = songs.reduce((acc, s) => acc + parseTime(s.time), 0);
  const mm = Math.floor(totalSecs / 60).toString();
  const ss = String(totalSecs % 60).padStart(2, '0');
  const headerLine = `${currentSetlist} — ${mm}:${ss}`;
  const bodyLines = songs.map(s => s.name).join('\n');
  const text = bodyLines ? `${headerLine}\n\n${bodyLines}` : headerLine;
  const link = `${window.location.origin}${window.location.pathname}#${encodeURIComponent(currentSetlist)}`;

  try {
    // Remove any previous menu
    let oldMenu = document.getElementById('shareMenu');
    if (oldMenu) oldMenu.remove();

    // Create share menu
    const menu = document.createElement('div');
    menu.id = 'shareMenu';
    menu.style.position = 'fixed';
    menu.style.bottom = '3.5rem';
    menu.style.left = '50%';
    menu.style.transform = 'translateX(-50%)';
    menu.style.background = '#222';
    menu.style.color = '#fff';
    menu.style.padding = '0.7rem 1.2rem';
    menu.style.borderRadius = '10px';
    menu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    menu.style.zIndex = '9999';
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.gap = '0.5rem';

    // Option 1: Share via Web Share API
    if (navigator.share) {
      const shareBtn = document.createElement('button');
      shareBtn.textContent = 'Share via device...';
      shareBtn.style.background = '#ff2b6a';
      shareBtn.style.color = '#fff';
      shareBtn.style.border = 'none';
      shareBtn.style.borderRadius = '6px';
      shareBtn.style.padding = '0.5rem 1rem';
      shareBtn.style.cursor = 'pointer';
      shareBtn.onclick = async () => {
        try {
          // Include the deep link so recipients open the exact setlist
          await navigator.share({ title: 'Setlist', text, url: link });
          showToast('Setlist shared!');
        } catch {
          showToast('Share canceled or failed.');
        }
        menu.remove();
      };
      menu.appendChild(shareBtn);
    }

    // Option 2: Copy setlist text
    const copyTextBtn = document.createElement('button');
    copyTextBtn.textContent = 'Copy setlist text';
    copyTextBtn.style.background = '#444';
    copyTextBtn.style.color = '#fff';
    copyTextBtn.style.border = 'none';
    copyTextBtn.style.borderRadius = '6px';
    copyTextBtn.style.padding = '0.5rem 1rem';
    copyTextBtn.style.cursor = 'pointer';
    copyTextBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(text);
        showToast('Setlist copied to clipboard!');
      } catch {
        showToast('Clipboard blocked by browser.');
      }
      menu.remove();
    };
    menu.appendChild(copyTextBtn);

    // Option 3: Copy setlist link
    const copyLinkBtn = document.createElement('button');
    copyLinkBtn.textContent = 'Copy setlist link';
    copyLinkBtn.style.background = '#444';
    copyLinkBtn.style.color = '#fff';
    copyLinkBtn.style.border = 'none';
    copyLinkBtn.style.borderRadius = '6px';
    copyLinkBtn.style.padding = '0.5rem 1rem';
    copyLinkBtn.style.cursor = 'pointer';
    copyLinkBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(link);
        showToast('Setlist link copied!');
      } catch {
        showToast('Clipboard blocked by browser.');
      }
      menu.remove();
    };
    menu.appendChild(copyLinkBtn);

    // Option 4: Cancel
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.background = '#333';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '6px';
    cancelBtn.style.padding = '0.5rem 1rem';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.onclick = () => menu.remove();
    menu.appendChild(cancelBtn);

    document.body.appendChild(menu);

  } catch (err) {
    showToast('Share menu failed to open.');
    console.error('Share menu error:', err);
  }
};

/* ===== Init ===== */

// Play Set button
const playSetBtn = document.getElementById('playSetBtn');
if (playSetBtn) {
  playSetBtn.onclick = () => {
    if (playSetState.active) { stopPlaySet(); } else { startPlaySet(); }
  };
}

renderLibrary();
renderSetlist();
renderDropdown();
updateTotal();
updateSetlistTitle();
setupSetlistNameEditing();
updatePlaySetUI();
