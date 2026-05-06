const HSK = {
  cardCount: 9,
  selectedLevels: [1],
  selectedCards: [],
  reviewed: new Map(),
  settings: {
    character: 'simplified',
    tts: 'none',
    ttsVoice: '',
    autoPlayWord: false,
  },
};
const HSK_LEVELS = [1, 2, 3, 4, 5, 6];
const FLIP_DURATION_MS = 600;
const STAGGER_MS = 40;

// ============================================
// Write New Content into Existing Slots
// ============================================
function renderCardsContent(cards, data) {
  cards.forEach((card, index) => {
    const item = data[index] || null;
    card.setAttribute('data-id', item && item.id ? String(item.id) : '');
    
    // Update badge text
    let inner = card.querySelector('.flip-card-inner');
    const front = inner.querySelector('.flip-card-front');
    let badge = front ? front.querySelector('.card-level-badge') : null;
    if (front && !badge) {
      badge = document.createElement('div');
      badge.className = 'card-level-badge';
      front.appendChild(badge);
    }
    if (badge) {
      const levelLabel = item.level;
      badge.textContent = `HSK ${levelLabel}`;
    }

    // Update front and back content
    const frontCharacter = inner.querySelector('.card-character');
    const frontPinyin = inner.querySelector('.card-pinyin');
    frontPinyin.textContent = item.pinyin || '';
    frontCharacter.textContent = item[HSK.settings.character] || '';

    const definitionsContainer = inner.querySelector('.card-definitions');
    if (definitionsContainer) {
      const definitions = Array.isArray(item.definitions) ? item.definitions : [];
      const definitionsText = definitions.length > 0 ? definitions.slice(0, 5).join(' / ') : '';
      definitionsContainer.textContent = definitionsText;
    }

    // Bind flip event if not already bound
    if (card.dataset.bound !== 'true') {
      card.addEventListener('click', function() {
        if (this.dataset.animating === 'true') return;
        this.classList.toggle('flipped');
      });
      card.addEventListener('keydown', function(event) {
        if (event.code === 'Space') {
          event.preventDefault();
          if (this.dataset.animating === 'true') return;
          this.classList.toggle('flipped');
        }
      });
      card.dataset.bound = 'true';
    };
  });
  VIEW_HOME_CARD_FOLDER.updateFolderVisibilityAndContent();
}

// ============================================
// Animate Flip and Update Mid-Flip
// ============================================
function animateCardsAndUpdate(data) {
  const cards = document.querySelectorAll('#cardsGrid .flip-card')
  cards.forEach((card) => {
    card.dataset.animating = 'true';
    card.classList.remove('flipped');
    card.classList.add('hide-back');
    card.classList.remove('refresh-flash');
  });

  cards.forEach((card) => {
    card.classList.add('flipped');
    card.classList.add('refresh-flash');
  });

  const halfway = Math.floor(FLIP_DURATION_MS / 2);
  setTimeout(() => {
    renderCardsContent(cards, data);

    cards.forEach((card) => {
      card.classList.remove('flipped');
    });

    setTimeout(() => {
      cards.forEach((card) => {
        card.dataset.animating = 'false';
        card.classList.remove('refresh-flash');
        card.classList.remove('hide-back');
      });
    }, FLIP_DURATION_MS / 2);
  }, halfway);
}


const VIEW_HOME = {
  _initialized: false,

  // ============================================
  // INIT LOGIC
  // ============================================
  init: async function() {
    if (this._initialized) return;

    // Init cards from selected levels
    try {
      const cards = document.querySelectorAll('#cardsGrid .flip-card');
      HSK.selectedCards = await HSK_DATA_SERVICE.load(HSK.selectedLevels, HSK.cardCount);

      renderCardsContent(cards, HSK.selectedCards);

      console.log(`Successfully loaded ${HSK.selectedCards.length} HSK-${HSK.selectedLevels.join('-')} cards`);
    } catch (error) {
      console.error('Error initializing app:', error);
    }

    const studyBtn = document.getElementById('studyBtn');
    studyBtn.addEventListener('click', function() {
      if (HSK.selectedCards.length === 0) return;

      // Fix definitions for display in study dialog
      for (let i = 0; i < HSK.selectedCards.length; i++) {
        const item = HSK.selectedCards[i];
        if (Array.isArray(item.definitions)) {
          item.definition = item.definitions
            .slice()
            .sort((a, b) => a.length - b.length)
            .slice(0, 5)
            .join(" / ");
        }
      }
      openStudyDialog(HSK.selectedCards);
    });
    
    const refreshBtn = document.getElementById('refreshBtn');
    let refreshCooldown = false;
    refreshBtn.addEventListener('animationend', (e) => {
      if (e.animationName === 'refreshLoading') {
        refreshBtn.classList.remove('loading');
      }
      if (e.animationName === 'iconRotate') {
        const icon = refreshBtn.querySelector('.refresh-icon');
        if (icon) icon.classList.remove('rotating');
      }
    });
    refreshBtn.addEventListener('click', async () => {
      if (refreshCooldown) return;
      refreshCooldown = true;
      refreshBtn.disabled = true;
      refreshBtn.classList.remove('loading');
      void refreshBtn.offsetWidth;
      refreshBtn.classList.add('loading');
      try {
        HSK.selectedCards = await HSK_DATA_SERVICE.load(HSK.selectedLevels, HSK.cardCount);
        animateCardsAndUpdate(HSK.selectedCards.slice(0, 9));

        const icon = refreshBtn.querySelector('.refresh-icon');
        if (icon) {
          icon.classList.remove('rotating');
          void icon.offsetWidth;
          icon.classList.add('rotating');
        }
      } finally {
        setTimeout(() => {
          refreshCooldown = false;
          refreshBtn.disabled = false;
        }, 1000);
      }
    });

    // Footer navigations
    const dashboardBtn = document.getElementById('dashboardBtn');
    dashboardBtn.addEventListener('click', () => VIEW_DASHBOARD.openDialog());

    // Settings button
    const settingsBtn = document.getElementById('settingsBtn');
    settingsBtn.addEventListener('click', () => VIEW_SETTINGS.openDialog());

    this._initialized = true;
  },
}


const VIEW_HOME_LEVEL_SELECTION = {
  _initialized: false,

  // ============================================
  // INIT LOGIC
  // ============================================
  init: async function() {
    if (this._initialized) return;

    const dlg = document.getElementById('levelDialog');
    const levelBtn = document.getElementById('levelBtn');
    levelBtn.addEventListener('click', () => {
      VIEW_HOME_LEVEL_SELECTION.openDialog();
    });
    
    await this.updateWordCountDisplay(HSK.selectedLevels);
    this.updateLevelLabel(HSK.selectedLevels);
    
    // Setup checkboxes onchange listener to lazy load and fetch data
    const checkboxes = document.querySelectorAll('.hsk-level-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const level = checkbox.value;
        const selectedLevels = Array.from(checkboxes)
          .filter(cb => cb.checked)
          .map(cb => cb.value);

        const checkedCount = selectedLevels.length;
        if (checkedCount === 0) {
          checkbox.checked = true;
          selectedLevels.push(level);
        }
        console.log(checkedCount, selectedLevels);
      
        await this.updateWordCountDisplay(selectedLevels);
      });
    });
    
    const confirmBtn = document.getElementById('confirmLevelsBtn');
    confirmBtn.addEventListener('click', async () => {
      const selectedLevels = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
      console.log('Selected HSK levels:', selectedLevels);

      const levelsToLoad = selectedLevels.length > 0 ? selectedLevels : ['1'];
      const currentLevelLabel = this.formatSelectedLevels(levelsToLoad);
      const prevLevelLabel = document.getElementById('levelLabel').textContent;

      if (currentLevelLabel !== prevLevelLabel) {
        HSK.selectedCards = await HSK_DATA_SERVICE.load(levelsToLoad, HSK.cardCount);
        if (HSK.selectedCards.length > 0) {
          HSK.selectedLevels = levelsToLoad;
          this.updateLevelLabel(levelsToLoad);
          animateCardsAndUpdate(HSK.selectedCards.slice(0, 9));
        }
      }
      
      VIEW_HOME_LEVEL_SELECTION.closeDialog();
    });
    
    const closeBtn = document.getElementById('closeLevelsBtn');
    closeBtn.addEventListener('click', () => {
      const prevLevels = document.getElementById('levelLabel').textContent.split("-");
      checkboxes.forEach(cb => {
        const level = cb.value;
        cb.checked = prevLevels.includes(level);
      });
      this.updateWordCountDisplay(HSK.selectedLevels);
      VIEW_HOME_LEVEL_SELECTION.closeDialog();
    });

    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      VIEW_HOME_LEVEL_SELECTION.closeDialog();
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) {
        VIEW_HOME_LEVEL_SELECTION.closeDialog();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dlg.open) {
        e.preventDefault();
        VIEW_HOME_LEVEL_SELECTION.closeDialog();
      }
    });

    // Card count toggle buttons
    const countBtns = document.querySelectorAll('.count-btn');
    let countCooldown = false;
    countBtns.forEach(btn => {
      btn.addEventListener('click', async function() {
        if (countCooldown) return;
        const count = parseInt(this.dataset.count, 10);
        if (count && count !== HSK.cardCount) {
          countCooldown = true;
          countBtns.forEach(b => b.disabled = true);
          countBtns.forEach(b => b.classList.remove('active'));
          this.classList.add('active');
          HSK.cardCount = count;

          // Reshuffle and update display from selected levels
          HSK.selectedCards = await HSK_DATA_SERVICE.load(HSK.selectedLevels, HSK.cardCount);
          animateCardsAndUpdate(HSK.selectedCards.slice(0, 9));
          VIEW_HOME_CARD_FOLDER.updateFolderVisibilityAndContent();

          setTimeout(() => {
            countCooldown = false;
            countBtns.forEach(b => b.disabled = false);
          }, 1000);
        }
      });
    });

    this._initialized = true;
  },

  // ============================================
  // RENDER LOGIC
  // ============================================
  updateWordCountDisplay: async function(levels) {
    const displayEl = document.getElementById('wordCountDisplay');
    const totalWords = await HSK_DATA_SERVICE.getWordCount(levels);
    displayEl.textContent = `${totalWords} word${totalWords !== 1 ? 's' : ''}`;
  },

  formatSelectedLevels: function(levels) {
    return levels.length > 0 ? levels.join('-') : '1';
  },

  updateLevelLabel: function(levels) {
    const levelLabel = document.getElementById('levelLabel');
    levelLabel.textContent = levels.length > 3 ? this.formatSelectedLevels(levels) : "HSK " + this.formatSelectedLevels(levels);
  },

  // ============================================
  // DIALOG LOGIC
  // ============================================
  openDialog: function() {
    document.getElementById(DIALOG.HOME_LEVEL_SELECTION).showModal();
  },
  closeDialog: function() {
    DIALOG.closeById(DIALOG.HOME_LEVEL_SELECTION);
  },
}


const VIEW_HOME_CARD_FOLDER = {
  _initialized: false,

  // ============================================
  // INIT LOGIC
  // ============================================
  init: function() {
    if (this._initialized) return;
    const folder = document.getElementById('cardFolder');
    folder.addEventListener('click', () => this.openDialog());

    const closeBtn = document.getElementById('folderDialogCloseBtn');
    closeBtn.addEventListener('click', () => VIEW_HOME_CARD_FOLDER.closeDialog());

    const dlg = document.getElementById('folderDialog');
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      VIEW_HOME_CARD_FOLDER.closeDialog();
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) {
        VIEW_HOME_CARD_FOLDER.closeDialog();
      }
    });

    this.updateFolderVisibilityAndContent();
    this._initialized = true;
  },

  // ============================================
  // RENDER LOGIC
  // ============================================
  updateFolderVisibilityAndContent: function() {
    const folder = document.getElementById('cardFolder');
    if (HSK.cardCount <= 9) {
      folder.classList.remove('visible');
      return;
    }
    folder.classList.add('visible');

    const folderCount = document.getElementById('folderCount');
    if (!folderCount) return;

    const extraCount = Math.max(0, HSK.cardCount - 9);
    folderCount.textContent = `${extraCount} more cards`;
  },

  // ============================================
  // DIALOG LOGIC
  // ============================================
  openDialog: function() {
    DIALOG.openById(DIALOG.HOME_CARD_FOLDER, {
      callback: (dlg) => {
        const grid = document.getElementById('folderDialogGrid');
        if (!grid) return;

        const extraCards = HSK.selectedCards.slice(9, HSK.cardCount);
        grid.innerHTML = '';

        extraCards.forEach(item => {
          if (!item) return;
          const card = document.createElement('div');
          card.className = 'folder-dialog-card';
          
          const char = document.createElement('div');
          char.className = 'folder-dialog-card-character';
          char.textContent = item[HSK.settings.character] || '';
          
          const pinyin = document.createElement('div');
          pinyin.className = 'folder-dialog-card-pinyin';
          pinyin.textContent = item.pinyin || '';
          
          card.appendChild(char);
          card.appendChild(pinyin);
          grid.appendChild(card);
        });
      }
    });
  },
  closeDialog: function() {
    DIALOG.closeById(DIALOG.HOME_CARD_FOLDER);
  },
};

document.addEventListener('DOMContentLoaded', function() {
  VIEW_HOME.init();
  VIEW_HOME_LEVEL_SELECTION.init();
  VIEW_HOME_CARD_FOLDER.init();
  console.log('HSK Flip Card App initialized successfully');
});