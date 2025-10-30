const debugStatus = document.getElementById('debugStatus');
function setDebugStatus(msg) {
  if (debugStatus) {
    debugStatus.textContent = msg;
    debugStatus.style.display = 'block';
  }
}

// ===== Firebase Auth UI + Firestore Sync (CDN compat) =====
const auth = firebase.auth();
const db = firebase.firestore();
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
  document.getElementById('libraryView').style.display = show ? '' : 'none';
  document.getElementById('setlistView').style.display = show ? '' : 'none';
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
      db.doc(SETLISTS_DOC).set({ allSetlists: { Default: [] } });
      allSetlists = { Default: [] };
    } else {
      allSetlists = snapshot.data().allSetlists || {};
      if (!Object.keys(allSetlists).length) {
        allSetlists = { Default: [] };
      }
    }
    if (!Object.keys(allSetlists).length) {
      allSetlists = { Default: [] };
    }
    // Honor URL hash if present (create empty set if it doesn't exist yet)
    const hashName = decodeURIComponent((window.location.hash || '').slice(1));
    let createdFromHash = false;
    if (hashName) {
      if (!allSetlists[hashName]) { allSetlists[hashName] = []; createdFromHash = true; }
      currentSetlist = hashName;
    } else if (!allSetlists[currentSetlist]) {
      currentSetlist = Object.keys(allSetlists)[0];
    }
    songs = Array.isArray(allSetlists[currentSetlist]) ? [...allSetlists[currentSetlist]] : [];
    updateSetlistTitle();
    renderSetlist();
    renderDropdown();
    updateTotal();
    if (createdFromHash) persist();
  });
}

function persistFirestore() {
  if (!auth.currentUser) return;
  db.doc(LIBRARY_DOC).set({ songs: library }, { merge: true });
  db.doc(SETLISTS_DOC).set({ allSetlists }, { merge: true });
}

auth.onAuthStateChanged(user => {
  setDebugStatus('Auth state changed. User: ' + (user ? user.email : 'none'));

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

    loginForm.style.display = 'block';
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
let currentSetlist = 'Default';
let songs = [];

function persist() {
  allSetlists[currentSetlist] = songs;
  persistFirestore();
}

function updateSetlistTitle() {
  // Update header label
  if (currentSetlistNameEl) {
    currentSetlistNameEl.textContent = currentSetlist || '';
  }
  // Compute meta (count + total time)
  if (currentSetlistMetaEl) {
    const count = songs.length;
    const totalSecs = songs.reduce((acc, s) => acc + parseTime(s.time), 0);
    const mm = Math.floor(totalSecs / 60).toString();
    const ss = String(totalSecs % 60).padStart(2, '0');
    const plural = count === 1 ? 'song' : 'songs';
    currentSetlistMetaEl.textContent = count ? `— ${count} ${plural} • ${mm}:${ss}` : '';
  }
  // Update dropdown button label to show active setlist
  if (setlistDropdownBtn) {
    const isOpen = setlistDropdown.classList.contains('show');
    setlistDropdownBtn.textContent = `🎛 Setlist: ${currentSetlist || ''} ${isOpen ? '▴' : '▾'}`;
  }
  // Reflect current set in the URL hash for easy sharing/navigation
  const desiredHash = '#' + encodeURIComponent(currentSetlist || '');
  if (window.location.hash !== desiredHash) {
    try { window.history.replaceState(null, '', desiredHash); } catch { window.location.hash = desiredHash; }
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
        alert('A setlist with that name already exists.');
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
function renderLibrary() {
  libraryList.innerHTML = '';
  library.forEach((song, i) => {
    const li = document.createElement('li');
    li.className = 'lib-item';
    li.setAttribute('draggable', 'true');

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.title = 'Drag to reorder';
    handle.textContent = '≡';

    const name = document.createElement('input');
    name.value = song.name;
    name.placeholder = 'Song name';
    name.onblur = () => { library[i].name = name.value.trim(); persist(); };
    name.addEventListener('keydown', e => { if (e.key === 'Enter') name.blur(); });

    const time = document.createElement('input');
    time.value = song.time;
    time.placeholder = '03:00';
    time.onblur = () => { library[i].time = formatTime(time.value); time.value = library[i].time; persist(); };
    time.addEventListener('keydown', e => { if (e.key === 'Enter') time.blur(); });

    const controls = document.createElement('div');

    // ➕ add to current setlist (push a COPY to avoid shared references)
    const addBtn = document.createElement('button');
    addBtn.textContent = '➕';
    addBtn.title = 'Add to current setlist';
    addBtn.onclick = () => {
      const copy = { name: library[i].name, time: library[i].time };
      songs.push(copy);
      persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
    };

    const del = document.createElement('button');
    del.textContent = '🗑';
    del.title = 'Delete from library';
    del.onclick = () => {
      library.splice(i, 1);
      persist(); renderLibrary();
      // Do NOT touch songs; setlist remains intact
    };

    controls.append(addBtn, del);
    li.append(handle, name, time, controls);
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
        name: (row.querySelector('input:nth-of-type(1)')?.value || '').trim(),
        time: formatTime(row.querySelector('input:nth-of-type(2)')?.value || '')
      }));
      persist();
      renderLibrary();
    });

    // Touch/pen drag start only from handle
    li.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (!e.target || !e.target.closest('.drag-handle')) return;
      startTouchDragLib(e, li);
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
  e.preventDefault();
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
    name: (row.querySelector('input:nth-of-type(1)')?.value || '').trim(),
    time: formatTime(row.querySelector('input:nth-of-type(2)')?.value || '')
  }));
  persist();
  renderLibrary();
}

saveToLibrary.onclick = () => {
  const n = libSongName.value.trim();
  let t = formatTime(libSongTime.value || '03:00');
  if (!n) return;
  library.push({ name: n, time: t });
  libSongName.value = ''; libSongTime.value = '';
  persist(); renderLibrary();
};

/* ===== Setlist (read-only + draggable) ===== */
function renderSetlist() {
  setlist.innerHTML = '';
  songs.forEach((song, i) => {
    const item = songTemplate.content.cloneNode(true).children[0];

    // spans = read-only display
    item.querySelector('.song-order').textContent = i + 1;
    item.querySelector('.song-name').textContent  = song.name;
    item.querySelector('.song-time').textContent  = song.time;

    // delete ONLY from setlist
    item.querySelector('.delete').onclick = () => {
      songs.splice(i, 1);
      persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
    };

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
      // write back new order from DOM
      songs = [...setlist.children].map(li => ({
        name: li.querySelector('.song-name').textContent,
        time: li.querySelector('.song-time').textContent
      }));
      persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
    });

    setlist.appendChild(item);

    // Pointer/touch fallback for reordering on devices without native HTML5 DnD
    item.addEventListener('pointerdown', (e) => startTouchDrag(e, item));
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

  // Persist new order from DOM
  songs = [...setlist.children].map(li => ({
    name: li.querySelector('.song-name').textContent,
    time: li.querySelector('.song-time').textContent
  }));
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

  // Existing setlists with delete icon
  Object.keys(allSetlists).forEach(name => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '0 0.5rem';

  const btn = document.createElement('button');
  // Dropdown items show the setlist name; include a ✓ for the active one
  btn.textContent = name + (name === currentSetlist ? ' ✓' : '');
    btn.style.flex = '1';
    btn.onclick = () => {
      // Load selected setlist
      currentSetlist = name;
      songs = Array.isArray(allSetlists[name]) ? [...allSetlists[name]] : [];
      persist(); renderSetlist(); updateTotal(); updateSetlistTitle();
      toggleDropdown(false);
    };

    const delBtn = document.createElement('button');
    delBtn.innerHTML = '🗑';
    delBtn.title = 'Delete setlist';
    delBtn.style.background = 'none';
    delBtn.style.border = 'none';
    delBtn.style.color = '#ff2b6a';
    delBtn.style.fontSize = '1.1rem';
    delBtn.style.cursor = 'pointer';
    delBtn.style.marginLeft = '0.5rem';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (Object.keys(allSetlists).length <= 1) {
        delBtn.innerHTML = '🚫';
        setTimeout(() => { delBtn.innerHTML = '🗑'; }, 1500);
        return;
      }
      delete allSetlists[name];
      // Switch to another setlist if current was deleted
      if (currentSetlist === name) {
        const names = Object.keys(allSetlists);
        currentSetlist = names[0];
        songs = Array.isArray(allSetlists[currentSetlist]) ? [...allSetlists[currentSetlist]] : [];
      }
      persist();
      renderSetlist();
      renderDropdown();
      updateTotal();
      updateSetlistTitle();
    };

    row.appendChild(btn);
    row.appendChild(delBtn);
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
    .map((s, i) => `<div class="line"><strong>${i + 1}.</strong> ${s.name} <span class="t">(${s.time})</span></div>`)
    .join('');
  const win = window.open('', '', 'width=800,height=1000');
  win.document.write(`
    <!doctype html><html><head><style>
      @page { size: auto; margin: 18mm; }
      html, body { height: 100%; }
      body{font-family:Arial,sans-serif;font-size:22px;line-height:1.6;margin:48px;color:#000}
      .line{break-inside:avoid;padding:.35rem 0;border-bottom:1px solid #e5e5e5}
      strong{margin-right:.4rem}
      .t{opacity:.8}
    </style></head><body><div id="printContent">${html}</div>
    <script>
      (function(){
        const MIN=12, MAX=36, BASE=22; // px
        const body=document.body, cont=document.getElementById('printContent');
        function available(){ return window.innerHeight - 96; } // body margin 48px top+bottom
        function fitOnce(){
          const avail=available();
          const h=cont.scrollHeight;
          if (!h || !avail) return;
          const scale=avail / h;
          let size=Math.max(MIN, Math.min(MAX, Math.floor(BASE*scale)));
          body.style.fontSize=size+'px';
        }
        function refine(){
          let guard=0;
          while(guard++<8){
            const avail=available();
            const h=cont.scrollHeight;
            if (h>avail){
              const cur=parseFloat(getComputedStyle(body).fontSize)||BASE;
              const next=Math.max(MIN, cur-1);
              if (next===cur) break;
              body.style.fontSize=next+'px';
            } else {
              // try grow to better fill the page
              const cur=parseFloat(getComputedStyle(body).fontSize)||BASE;
              const next=Math.min(MAX, cur+1);
              body.style.fontSize=next+'px';
              // if we overflow after growing, step back and stop
              if (cont.scrollHeight>available()) { body.style.fontSize=cur+'px'; break; }
            }
          }
        }
        // initial fit then refine, then print
        fitOnce();
        setTimeout(() => { refine(); setTimeout(() => { window.print(); window.onafterprint = () => window.close(); }, 50); }, 50);
      })();
    </script>
    </body></html>`);
  win.document.close();
  // onload is handled inside the injected script for sizing and printing
};


shareBtn.onclick = async () => {
  console.log('Share button clicked');
  const text = songs.map(s => s.name).join('\n');
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
          await navigator.share({ title: 'Setlist', text });
          showShareMessage('Setlist shared!');
        } catch {
          showShareMessage('Share canceled or failed.');
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
        showShareMessage('Setlist copied to clipboard!');
      } catch {
        showShareMessage('Clipboard blocked by browser.');
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
        showShareMessage('Setlist link copied!');
      } catch {
        showShareMessage('Clipboard blocked by browser.');
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

    function showShareMessage(msg) {
      let messageEl = document.getElementById('shareMessage');
      if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'shareMessage';
        messageEl.style.position = 'fixed';
        messageEl.style.bottom = '2rem';
        messageEl.style.left = '50%';
        messageEl.style.transform = 'translateX(-50%)';
        messageEl.style.background = '#222';
        messageEl.style.color = '#fff';
        messageEl.style.padding = '0.7rem 1.2rem';
        messageEl.style.borderRadius = '10px';
        messageEl.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        messageEl.style.zIndex = '9999';
        document.body.appendChild(messageEl);
      }
      messageEl.textContent = msg;
      setTimeout(() => { messageEl.textContent = ''; }, 2000);
    }
  } catch (err) {
    alert('Share menu failed to open.');
    console.error('Share menu error:', err);
  }
};

/* ===== Init ===== */

renderLibrary();
renderSetlist();
renderDropdown();
updateTotal();
updateSetlistTitle();
setupSetlistNameEditing();
