const setlist = document.getElementById('setlist');
const addSongBtn = document.getElementById('addSongBtn');
const printBtn = document.getElementById('printBtn');
const shareBtn = document.getElementById('shareBtn');
const totalTimeEl = document.getElementById('totalTime');
const songTemplate = document.getElementById('songTemplate');
const savedSongsSelect = document.getElementById('savedSongs');
const clearAllBtn = document.getElementById('clearAllBtn');
const libraryToggle = document.getElementById('libraryToggle');
const libraryMenu = document.getElementById('libraryMenu');
const libSongName = document.getElementById('libSongName');
const libSongTime = document.getElementById('libSongTime');
const saveToLibrary = document.getElementById('saveToLibrary');
const libraryList = document.getElementById('libraryList');

let songs = JSON.parse(localStorage.getItem('songs') || '[]');
let library = JSON.parse(localStorage.getItem('library') || '[]');

// === TIME FORMATTING ===
function formatTimeInput(input) {
  input = input.replace(/[^0-9]/g, '');
  if (input.length === 0) return '00:00';
  if (input.length <= 2) return `00:${input.padStart(2, '0')}`;
  if (input.length === 3) return `0${input[0]}:${input.slice(1)}`;
  return `${input.slice(0, -2).padStart(2, '0')}:${input.slice(-2)}`;
}

// === LIBRARY RENDERING ===
function renderSavedSongs() {
  savedSongsSelect.innerHTML = '<option value="">Saved Songs ▼</option>';
  library.forEach((s, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${s.name} (${s.time})`;
    savedSongsSelect.appendChild(opt);
  });
  renderLibraryList();
}

function renderLibraryList() {
  libraryList.innerHTML = '';
  library.forEach((song, i) => {
    const li = document.createElement('li');
    li.dataset.index = i;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = `${song.name} (${song.time})`;

    const controls = document.createElement('div');

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.onclick = () => startInlineEdit(i, li);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑';
    deleteBtn.onclick = () => deleteLibrarySong(i);

    controls.appendChild(editBtn);
    controls.appendChild(deleteBtn);
    li.appendChild(nameSpan);
    li.appendChild(controls);
    libraryList.appendChild(li);
  });
}

function startInlineEdit(index, li) {
  const song = library[index];
  li.innerHTML = '';

  const nameInput = document.createElement('input');
  nameInput.value = song.name;
  nameInput.classList.add('edit-input');

  const timeInput = document.createElement('input');
  timeInput.value = song.time;
  timeInput.classList.add('edit-input', 'time-input');

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '💾';
  saveBtn.onclick = () => {
    song.name = nameInput.value.trim() || song.name;
    song.time = formatTimeInput(timeInput.value.trim() || song.time);
    library[index] = song;
    localStorage.setItem('library', JSON.stringify(library));
    renderSavedSongs();
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '❌';
  cancelBtn.onclick = () => renderSavedSongs();

  li.appendChild(nameInput);
  li.appendChild(timeInput);
  li.appendChild(saveBtn);
  li.appendChild(cancelBtn);
}

function deleteLibrarySong(index) {
  if (confirm(`Delete '${library[index].name}' from library?`)) {
    library.splice(index, 1);
    localStorage.setItem('library', JSON.stringify(library));
    renderSavedSongs();
  }
}

// === SETLIST RENDERING ===
function renderSongs() {
  setlist.innerHTML = '';
  songs.forEach((song, i) => {
    const item = songTemplate.content.cloneNode(true).children[0];
    const order = item.querySelector('.song-order');
    const name  = item.querySelector('.song-name');
    const time  = item.querySelector('.song-time');

    order.value = i + 1;
    name.value  = song.name;
    time.value  = song.time;

    // make read-only
    name.readOnly = true;
    time.readOnly = true;

    item.querySelector('.delete').onclick = () => {
      songs.splice(i, 1);
      saveAndRender();
    };

    // enable drag-and-drop
    item.addEventListener('dragstart', () => {
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      reorderSongs();
    });

    setlist.appendChild(item);
  });
  updateTotalTime();
}

function reorderSongs() {
  const newOrder = [...setlist.children].map(li => ({
    name: li.querySelector('.song-name').value,
    time: li.querySelector('.song-time').value,
  }));
  songs = newOrder;
  saveAndRender();
}

setlist.addEventListener('dragover', e => {
  e.preventDefault();
  const dragging = document.querySelector('.dragging');
  const siblings = [...setlist.children].filter(c => c !== dragging);
  const nextSibling = siblings.find(s => e.clientY <= s.offsetTop + s.offsetHeight / 2);
  if (nextSibling) setlist.insertBefore(dragging, nextSibling);
  else setlist.appendChild(dragging);
});

function parseTime(str) {
  const [m, s] = str.split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
}

function updateTotalTime() {
  const totalSeconds = songs.reduce((acc, s) => acc + parseTime(s.time), 0);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  totalTimeEl.textContent = `Total Time: ${m} min ${s} s`;
}

function saveAndRender() {
  localStorage.setItem('songs', JSON.stringify(songs));
  renderSongs();
}

// === BUTTONS ===
addSongBtn.onclick = () => {
  if (library.length === 0) {
    alert('Add songs to your library first!');
    return;
  }
  const name = prompt('Enter song name from library:');
  const match = library.find(s => s.name.toLowerCase() === name?.toLowerCase());
  if (!match) return alert('Song not found in library.');
  songs.push(match);
  saveAndRender();
};

savedSongsSelect.onchange = e => {
  const selected = library[e.target.value];
  if (selected) {
    songs.push(selected);
    saveAndRender();
  }
  savedSongsSelect.value = '';
};

clearAllBtn.onclick = () => {
  if (confirm('Clear current setlist? Saved songs will remain.')) {
    songs = [];
    localStorage.setItem('songs', JSON.stringify([]));
    renderSongs();
    updateTotalTime();
  }
};

// === DROPDOWN ===
libraryToggle.onclick = (e) => {
  e.stopPropagation();
  libraryMenu.classList.toggle('show');
  libraryToggle.textContent = libraryMenu.classList.contains('show')
    ? '🎵 Library ▾'
    : '🎵 Library ▸';
};

// Close dropdown only when clicking completely outside
document.addEventListener('click', (e) => {
  if (!libraryMenu.contains(e.target) && !libraryToggle.contains(e.target)) {
    libraryMenu.classList.remove('show');
    libraryToggle.textContent = '🎵 Library ▸';
  }
});

// Prevent clicks inside library menu (inputs, buttons) from closing it
libraryMenu.addEventListener('click', (e) => {
  e.stopPropagation();
});


saveToLibrary.onclick = () => {
  const name = libSongName.value.trim();
  let time = libSongTime.value.trim() || '03:00';
  if (!name) return alert('Please enter a song name.');
  time = formatTimeInput(time);

  if (!library.find(s => s.name.toLowerCase() === name.toLowerCase())) {
    library.push({ name, time });
    localStorage.setItem('library', JSON.stringify(library));
    renderSavedSongs();
  } else {
    alert('That song is already in the library.');
  }
  libSongName.value = '';
  libSongTime.value = '';
};

// === PRINT AND SHARE ===
printBtn.onclick = () => {
  const width = 800;
  const height = 1000;
  const left = (window.screen.width / 2) - (width / 2);
  const top = (window.screen.height / 2) - (height / 2);
  const win = window.open('', '', 'width=' + width + ',height=' + height + ',top=' + top + ',left=' + left);
  const listHTML = songs.map(s => '<div>' + s.name + '</div>').join('<br>');
  const html =
    '<!DOCTYPE html><html><head><style>' +
    'body { font-family: Arial, sans-serif; background: white; color: black; font-size: 22px; line-height: 1.6; columns: 2; column-gap: 3rem; margin: 2rem; }' +
    'div { break-inside: avoid; padding: 0.4rem 0; }' +
    '</style></head><body>' + listHTML + '</body></html>';
  win.document.write(html);
  win.document.close();
  win.onload = function() {
    win.print();
    win.onafterprint = function() { win.close(); };
  };
};

shareBtn.onclick = () => {
  const data = songs.map(s => s.name).join('\n');
  navigator.clipboard.writeText(data);
  alert('Setlist copied to clipboard!');
};

// === INIT ===
renderSavedSongs();
renderSongs();
