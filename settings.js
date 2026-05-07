const VIEW_SETTINGS = {
  _initialized: false,

  // ============================================
  // INIT LOGIC
  // ============================================
  init: function() {
    if (this._initialized) return;
    // Load and sync settings data from localStorage
    const storedSettings = JSON.parse(localStorage.getItem('hsk-flip-settings')) || {};
    HSK.settings = {
      character: storedSettings.character || 'simplified',
      tts: storedSettings.tts || 'none',
      ttsVoice: storedSettings.ttsVoice || '',
      autoPlayWord: Boolean(storedSettings.autoPlayWord)
    };
    localStorage.setItem('hsk-flip-settings', JSON.stringify(HSK.settings));

    // Load settings dialog elements and attach event listeners for closing the dialog
    const closeBtn = document.getElementById('settingsCloseBtn');
    closeBtn.addEventListener('click', () => VIEW_SETTINGS.closeDialog());

    const updateBtn = document.getElementById('checkUpdateBtn');
    updateBtn.addEventListener('click', () => VIEW_SETTINGS.checkForUpdates());

    const exportBtn = document.getElementById('exportDataBtn');
    exportBtn.addEventListener('click', () => VIEW_SETTINGS.exportData());

    const importBtn = document.getElementById('importDataBtn');
    importBtn.addEventListener('click', () => VIEW_SETTINGS.openImportDialog());

    const confirmImportBtn = document.getElementById('confirmImportBtn');
    confirmImportBtn.addEventListener('click', () => VIEW_SETTINGS.importData());

    const cancelImportBtn = document.getElementById('cancelImportBtn');
    cancelImportBtn.addEventListener('click', () => DIALOG.closeById('importDialog'));
    
    const dlg = document.getElementById('settingsDialog');
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      VIEW_SETTINGS.closeDialog();
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) {
        VIEW_SETTINGS.closeDialog();
      }
    });
    this._initialized = true;
  },

  refreshVoiceOptions: function() {
    const ttsVoice = document.getElementById('ttsVoice');
    const hasVoices = TTS.voices.length > 0;
    ttsVoice.innerHTML = hasVoices
      ? TTS.voices.map((voice) => {
          const label = `${voice.name} (${voice.lang})`;
          const value = voice.voiceURI || voice.name;
          return `<option value="${value}">${label}</option>`;
        }).join('')
      : '<option value="">No offline voices available</option>';
    ttsVoice.disabled = !hasVoices || HSK.settings.tts !== 'offline';
    

    ttsVoice.addEventListener('change', (e) => {
      HSK.settings.ttsVoice = e.target.value;
      localStorage.setItem('hsk-flip-settings', JSON.stringify(HSK.settings));
    });
  },

  // ============================================
  // RENDER LOGIC
  // ============================================
  _renderSettings: function() {
    const characterType = document.getElementById('characterType');
      characterType.innerHTML = `
        <option value="traditional">Traditional</option>
        <option value="simplified">Simplified</option>
      `;
    characterType.value = HSK.settings.character;
    characterType.addEventListener('change', (e) => {
      HSK.settings.character = e.target.value;
      localStorage.setItem('hsk-flip-settings', JSON.stringify(HSK.settings));
    });

    const ttsType = document.getElementById('ttsType');
    ttsType.innerHTML = `
      <option value="none">None</option>
      ${TTS.types.includes('offline') ? '<option value="offline">Offline TTS</option>' : ''}
      <option value="online">Online TTS</option>
    `;
    ttsType.value = HSK.settings.tts;
    ttsType.addEventListener('change', (e) => {
      if (e.target.value === 'offline') {
        TTS.init(); // Re-initialize TTS to populate available voices and update settings if needed
        document.getElementById('ttsVoice').disabled = false;
      } else {
        document.getElementById('ttsVoice').disabled = true;
      }
      HSK.settings.tts = e.target.value;
      localStorage.setItem('hsk-flip-settings', JSON.stringify(HSK.settings));
    });

    this.refreshVoiceOptions();

    const autoPlayWord = document.getElementById('autoPlayWord');
    if (autoPlayWord) {
      autoPlayWord.checked = Boolean(HSK.settings.autoPlayWord);
      autoPlayWord.addEventListener('change', (e) => {
        HSK.settings.autoPlayWord = e.target.checked;
        localStorage.setItem('hsk-flip-settings', JSON.stringify(HSK.settings));
      });
    }
  },
  
  _fetchNewCards: async function() {
    try {
      HSK.selectedCards = await HSK_DATA_SERVICE.load(HSK.selectedLevels, HSK.cardCount);
      const cards = document.querySelectorAll('#cardsGrid .flip-card');
      renderCardsContent(cards, HSK.selectedCards);
      VIEW_HOME_CARD_FOLDER.updateFolderVisibilityAndContent();
    } catch (error) {
      console.error('Error fetching new cards after settings change:', error);
    }
  },

  // ============================================
  // DIALOG LOGIC
  // ============================================
  openDialog: function() {
    DIALOG.openById(DIALOG.SETTINGS, {
      callback: () => {
        this._renderSettings();
      }
    });
  },
  checkForUpdates: function() {
    if (!('serviceWorker' in navigator)) {
      alert('Service Worker not supported');
      return;
    }
    navigator.serviceWorker.getRegistrations().then(regs => {
      if (regs.length === 0) {
        alert('No service worker registered');
        return;
      }
      regs.forEach(reg => reg.update());
      alert('Checking for updates...');
      // Reload once new SW activates
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
    });
  },

  closeDialog: function() {
    this._fetchNewCards();
    DIALOG.closeById(DIALOG.SETTINGS);
  },

  exportData: function() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('hsk-flip-rev')) {
        data[key] = localStorage.getItem(key);
      }
    }
    const jsonStr = JSON.stringify(data);
    navigator.clipboard.writeText(jsonStr).then(() => {
      alert('Data copied to clipboard');
    }).catch(err => {
      console.error('Copy failed:', err);
      alert('Copy failed. Data logged to console.');
      console.log('Export data:', jsonStr);
    });
  },

  openImportDialog: function() {
    document.getElementById('importTextarea').value = '';
    DIALOG.openById('importDialog');
  },

  importData: function() {
    const textarea = document.getElementById('importTextarea');
    const raw = textarea.value.trim();
    if (!raw) {
      alert('No data pasted');
      return;
    }
    try {
      const data = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) {
        throw new Error('Invalid data format');
      }
      Object.keys(data).forEach(key => {
        if (key.startsWith('hsk-flip-rev')) {
          localStorage.setItem(key, data[key]);
        }
      });
      SRS_REVIEW._cachedReviewItems = [];
      alert('Data imported successfully');
      DIALOG.closeById('importDialog');
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed: invalid JSON or data format');
    }
  },
};

document.addEventListener('DOMContentLoaded', function() {
  VIEW_SETTINGS.init();
});