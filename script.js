const debugStatus = document.getElementById('debugStatus');
function setDebugStatus(msg) {
  if (debugStatus) {
    debugStatus.textContent = msg;
    debugStatus.style.display = 'block';
  }
}
// ===== Firebase Auth UI =====
// ===== Firestore Sync =====
const LIBRARY_DOC = 'bandData/library';
const SETLISTS_DOC = 'bandData/setlists';

async function loadDataFromFirestore() {
  try {
    // Realtime listener for library
    if (window.libraryUnsub) window.libraryUnsub();
    window.libraryUnsub = window.firebaseFirestore.onSnapshot
      ? window.firebaseFirestore.onSnapshot(window.doc(window.firebaseFirestore, LIBRARY_DOC), (libSnap) => {
          library = libSnap.exists() ? libSnap.data().songs || [] : [];
          renderLibrary();
        })
      : null;

    // Realtime listener for setlists
    if (window.setlistsUnsub) window.setlistsUnsub();
    window.setlistsUnsub = window.firebaseFirestore.onSnapshot
      ? window.firebaseFirestore.onSnapshot(window.doc(window.firebaseFirestore, SETLISTS_DOC), (setlistsSnap) => {
          allSetlists = setlistsSnap.exists() ? setlistsSnap.data().allSetlists || {} : {};
          currentSetlist = Object.keys(allSetlists)[0] || 'Default';
          songs = Array.isArray(allSetlists[currentSetlist]) ? [...allSetlists[currentSetlist]] : [];
          renderSetlist();
          renderDropdown();
          updateTotal();
        })
      : null;
  } catch (err) {
    authError.textContent = 'Failed to load data: ' + err.message;
  }

async function persistFirestore() {
  try {
    await window.setDoc(window.doc(window.firebaseFirestore, LIBRARY_DOC), { songs: library });
    await window.setDoc(window.doc(window.firebaseFirestore, SETLISTS_DOC), { allSetlists });
  } catch (err) {
    authError.textContent = 'Failed to save data: ' + err.message;
  }
}
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const userInfo = document.getElementById('userInfo');
const userEmail = document.getElementById('userEmail');
const logoutBtn = document.getElementById('logoutBtn');
const authError = document.getElementById('authError');
const authSection = document.getElementById('authSection');

function showAppUI(show) {
  document.querySelector('.tab-header').style.display = show ? '' : 'none';
  document.getElementById('libraryView').style.display = show ? '' : 'none';
  document.getElementById('setlistView').style.display = show ? '' : 'none';
}

window.onAuthStateChanged(window.firebaseAuth, user => {
  setDebugStatus('Auth state changed. User: ' + (user ? user.email : 'none'));
  if (user) {
    loginForm.style.display = 'none';
    userInfo.style.display = '';
    userEmail.textContent = user.email;
    authError.textContent = '';
    showAppUI(true);
    loadDataFromFirestore();
  } else {
    loginForm.style.display = '';
    userInfo.style.display = 'none';
    userEmail.textContent = '';
    showAppUI(false);
  }
});

loginForm.onsubmit = async (e) => {
  e.preventDefault();
  authError.textContent = '';
  try {
    await window.signInWithEmailAndPassword(window.firebaseAuth, loginEmail.value, loginPassword.value);
  } catch (err) {
    authError.textContent = err.message;
  }
};

logoutBtn.onclick = async () => {
  await window.signOut(window.firebaseAuth);
};

// Force Logout button for testing
const forceLogoutBtn = document.getElementById('forceLogoutBtn');
if (forceLogoutBtn) {
  forceLogoutBtn.onclick = async () => {
    await window.signOut(window.firebaseAuth);
    alert('Forced logout. You should now see the login form.');
  };
}
};
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

const setlistDropdownBtn = document.getElementById('setlistDropdownBtn');
const setlistDropdown = document.getElementById('setlistDropdown');

const printBtn = document.getElementById('printBtn');
const shareBtn = document.getElementById('shareBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

/* ===== Storage ===== */
let library = JSON.parse(localStorage.getItem('library') || '[]');
let allSetlists = JSON.parse(localStorage.getItem('allSetlists') || '{}');
let currentSetlist = localStorage.getItem('currentSetlist') || 'Default';
if (!allSetlists[currentSetlist]) allSetlists[currentSetlist] = [];
let songs = Array.isArray(allSetlists[currentSetlist]) ? [...allSetlists[currentSetlist]] : [];

function persist() {
  allSetlists[currentSetlist] = songs;
  persistFirestore();
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
      persist(); renderSetlist(); updateTotal();
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
    li.append(name, time, controls);
    libraryList.appendChild(li);
  });
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
      persist(); renderSetlist(); updateTotal();
    };

    // drag handlers
    item.addEventListener('dragstart', () => item.classList.add('dragging'));
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      // write back new order
      songs = [...setlist.children].map(li => ({
        name: li.querySelector('.song-name').textContent,
        time: li.querySelector('.song-time').textContent
      }));
      persist(); renderSetlist(); updateTotal();
    });

    setlist.appendChild(item);
  });
  updateTotal();
}

setlist.addEventListener('dragover', e => {
  e.preventDefault();
  const dragging = document.querySelector('.dragging');
  if (!dragging) return;
  const after = [...setlist.children].find(li => e.clientY <= li.offsetTop + li.offsetHeight / 2);
  if (after) setlist.insertBefore(dragging, after);
  else setlist.appendChild(dragging);
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
    btn.textContent = name + (name === currentSetlist ? ' ✓' : '');
    btn.style.flex = '1';
    btn.onclick = () => {
      // Load selected setlist
      currentSetlist = name;
      songs = Array.isArray(allSetlists[name]) ? [...allSetlists[name]] : [];
      persist(); renderSetlist(); updateTotal();
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
        persist(); renderSetlist(); updateTotal();
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
  setlistDropdownBtn.textContent = show ? '🎛 Select Setlist ▴' : '🎛 Select Setlist ▾';

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

/* ===== Buttons ===== */
clearAllBtn.onclick = () => {
  // Inline clear confirmation: double click to clear
  if (clearAllBtn.dataset.confirm === 'yes') {
    songs = [];
    persist(); renderSetlist(); updateTotal();
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
  const html = songs.map(s => `<div>${s.name}</div>`).join('<br>');
  const win = window.open('', '', 'width=800,height=1000');
  win.document.write(`
    <!doctype html><html><head><style>
      body{font-family:Arial,sans-serif;font-size:22px;line-height:1.6;margin:2rem;columns:2;column-gap:3rem}
      div{break-inside:avoid;padding:.4rem 0}
    </style></head><body>${html}</body></html>`);
  win.document.close();
  win.onload = () => { win.print(); win.onafterprint = () => win.close(); };
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
