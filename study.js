const sessionStore = {
  _sessions: new Map(),

  get(dlgId) {
    return this._sessions.get(dlgId) || null;
  },

  set(dlgId, session) {
    this._sessions.set(dlgId, session);
  },

  clear(dlgId) {
    this._sessions.delete(dlgId);
  }
};

const studySession = {
  _items: [],
  _index: 0,
  _results: [],
  _showPinyin: false,
  _notes: [],

  init(items, maxCount) {
    const limit = Number.isFinite(maxCount) ? maxCount : HSK.cardCount;
    const finalCount = limit > 0 ? limit : items.length;
    this._items = shuffleArray(items).slice(0, finalCount);
    this._index = 0;
    this._results = [];
    this._showPinyin = false;
    this._notes = [];
  },

  currentStep() {
    const item = this._items[this._index];
    if (!item) return null;

    const others = this._items.filter((_, i) => i !== this._index);
    const shuffled = shuffleArray(others).slice(0, 2);
    const choices = shuffleArray([item].concat(shuffled));

    return {
      item,
      choices,
      total: this._items.length,
      index: this._index
    };
  },

  answer(chosenItem) {
    const correctItem = this._items[this._index];
    const correct = chosenItem === correctItem;
    const prevResult = this._results[this._index];

    if (correct) {
      const incorrectAttempted = Boolean(prevResult && prevResult.incorrectAttempted);
      // If user missed once, keep final grading as incorrect for this card.
      this._results[this._index] = {
        item: correctItem,
        incorrectAttempted,
        correct: !incorrectAttempted
      };
      this._index++;
      return { correct: true, finished: this._index >= this._items.length };
    } else {
      this._results[this._index] = {
        item: correctItem,
        incorrectAttempted: true,
        correct: false
      };
      return { correct: false };
    }
  },

  togglePinyin() {
    this._showPinyin = !this._showPinyin;
    return this._showPinyin;
  },

  get showPinyin() {
    return this._showPinyin;
  },

  setNotes(notes) {
    this._notes = Array.isArray(notes) ? notes.slice() : [];
  },

  get notes() {
    return this._notes.slice();
  },

  result() {
    const correctCount = this._results.filter(r => r && r.correct).length;
    return {
      items: this._items,
      results: this._results,
      correctCount,
      total: this._items.length,
      noteWords: this.notes,
      levels: HSK.selectedLevels.slice()
    };
  }
};

function renderStudyStep(dlg) {
  const step = studySession.currentStep();
  if (!step) return;

  const { item, choices, total, index } = step;

  const charEl = document.getElementById('studyCharacter');
  const pinyinEl = document.getElementById('studyPinyin');
  const defEl = document.getElementById('studyDefinition');
  const cardWrap = document.getElementById('studyCard');
  const choicesWrap = document.getElementById('studyChoices');
  const progressBar = document.getElementById('studyProgressBar');
  const progressText = document.getElementById('studyProgressText');
  const sentenceFrontChineseEl = document.getElementById('studySentenceFrontChinese');
  const sentenceFrontPinyinEl = document.getElementById('studySentenceFrontPinyin');
  const sentenceFrontEnglishEl = document.getElementById('studySentenceFrontEnglish');
  const sentenceBackPinyinEl = document.getElementById('studySentenceBackPinyin');
  const sentenceBackChineseEl = document.getElementById('studySentenceBackChinese');
  const sentenceTranslationEl = document.getElementById('studySentenceTranslation');
  const sentenceFrontWrap = document.getElementById('studySentenceFrontWrap');
  const sentenceBackWrap = document.getElementById('studySentenceBackWrap');

  if (!item || !charEl || !defEl || !choicesWrap) return;

  // reset card
  cardWrap.classList.remove('flipped');
  cardWrap.classList.remove('refresh-flash');
  cardWrap.classList.add('hide-back');
  
  // reset level badge
  const levelBadge = document.getElementById('studyLevelBadge');
  if (levelBadge) {
    levelBadge.textContent = '';
  }

  charEl.textContent = '';
  pinyinEl.textContent = '';
  defEl.textContent = '';
  if (sentenceFrontWrap) sentenceFrontWrap.style.display = 'none';
  if (sentenceBackWrap) sentenceBackWrap.style.display = 'none';

  requestAnimationFrame(() => {
    cardWrap.classList.add('refresh-flash');
  });

  // sync toggle button state
  const toggleBtn = document.getElementById('studyTogglePinyin');
  if (toggleBtn) {
    toggleBtn.textContent = `Pinyin: ${studySession.showPinyin ? 'On' : 'Off'}`;
    toggleBtn.classList.toggle('pinyin-on', studySession.showPinyin);
  }

  const applyCardContent = () => {
    const levelBadge = document.getElementById('studyLevelBadge');
    if (levelBadge) {
      // Always use the item's level if available, otherwise use first selected level
      const levelLabel = item.level != null ? item.level : (selectedLevels.length > 0 ? selectedLevels[0] : 1);
      levelBadge.textContent = `HSK ${levelLabel}`;
    }
    
    charEl.textContent = item[HSK.settings.character] || '';
    pinyinEl.textContent = item.pinyin || '';
    defEl.textContent = item.definition || '';
    pinyinEl.style.opacity = studySession.showPinyin ? '1' : '0';

    if (sentenceFrontChineseEl && sentenceTranslationEl && sentenceFrontWrap && sentenceBackWrap) {
      const sentence = item.sentence || null;
      const sentenceText = sentence[HSK.settings.character] || '';
      const sentencePinyin = sentence.pinyin || '';
      const sentenceTranslation = sentence.english || '';
      sentenceFrontChineseEl.textContent = sentenceText;
      if (sentenceFrontPinyinEl) {
        sentenceFrontPinyinEl.textContent = sentencePinyin;
        sentenceFrontPinyinEl.style.opacity = studySession.showPinyin ? '1' : '0';
      }
      if (sentenceFrontEnglishEl) {
        sentenceFrontEnglishEl.textContent = '';
      }
      if (sentenceBackChineseEl) {
        sentenceBackChineseEl.textContent = sentenceText;
      }
      if (sentenceBackPinyinEl) {
        sentenceBackPinyinEl.textContent = sentencePinyin;
      }
      sentenceTranslationEl.textContent = sentenceTranslation;
      const hasSentence = sentenceText;
      sentenceFrontWrap.style.display = hasSentence ? 'flex' : 'none';
      sentenceBackWrap.style.display = hasSentence ? 'flex' : 'none';
    }

    // populate backside elements
    const pinyinBack = document.getElementById('studyPinyinBack');
    const charBack = document.getElementById('studyCharacterBack');
    if (pinyinBack) pinyinBack.textContent = item.pinyin || '';
    if (charBack) charBack.textContent = item[HSK.settings.character] || '';
  };

  setTimeout(() => {
    applyCardContent();
    if (HSK.settings.autoPlayWord && HSK.settings.tts !== 'none') {
      setTimeout(() => {
        playWordAudio();
      }, 120);
    }
    setTimeout(() => {
      cardWrap.classList.remove('hide-back');
    }, 80);
  }, 80);

  // build choices
  choicesWrap.innerHTML = '';
  choices.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice-btn btn';
    btn.textContent = opt.definition || '?';
    btn.addEventListener('click', function() {
      handleChoiceClick(dlg, opt, btn);
    });
    choicesWrap.appendChild(btn);
  });

  // progress
  const pct = Math.round((index / Math.max(1, total)) * 100);
  progressBar.style.width = `${pct}%`;
  if (progressText) {
    progressText.textContent = `${index + 1}/${total}`;
  }
}

function handleChoiceClick(dlg, chosenItem, btn) {
  if (!dlg) return;

  const result = studySession.answer(chosenItem);
  if (!result) return;

  if (result.correct) {
    btn.classList.add('correct');
    const choicesWrap = document.getElementById('studyChoices');
    if (choicesWrap) {
      choicesWrap.querySelectorAll('button').forEach(choiceBtn => {
        choiceBtn.disabled = true;
      });
    }
  } else {
    btn.classList.add('incorrect');
    btn.disabled = true;
    return;
  }

  // reveal back of card
  const cardWrap = document.getElementById('studyCard');
  cardWrap.classList.add('flipped');

  setTimeout(() => {
    if (result.finished) {
      // finished
      const finalResult = studySession.result();
      closeStudyDialog();
      openResultDialog(finalResult);
      return;
    }
    renderStudyStep(dlg);
  }, 700);
}

function renderResultSummary(dlg) {
  const data = sessionStore.get('resultDialog');
  if (!data) return;

  const list = document.getElementById('resultList');
  const summary = document.getElementById('resultSummary');
  if (!list || !summary) return;

  const total = data.items.length;
  const correctCount = data.results.filter(result => result && result.correct).length;
  summary.textContent = `${correctCount}/${total} correct`;

  list.innerHTML = '';
  data.items.forEach((item, index) => {
    const result = data.results[index];
    const isCorrect = result && result.correct;

    const row = document.createElement('div');
    row.className = `result-item ${isCorrect ? 'correct' : 'incorrect'}`;

    const title = document.createElement('div');
    title.className = 'result-item-title';
    title.textContent = `${item[HSK.settings.character] || ''} ${item.pinyin ? `(${item.pinyin})` : ''}`;

    const status = document.createElement('span');
    status.className = 'result-item-meta';
    status.textContent = isCorrect ? 'Correct' : 'Incorrect';
    title.appendChild(status);

    const correctDef = document.createElement('div');
    correctDef.className = 'result-item-meta';
    correctDef.textContent = `Correct: ${item.definition || ''}`;

    row.appendChild(title);
    row.appendChild(correctDef);
    list.appendChild(row);
  });
}

function setResultDialogMode(mode = 'final') {
  const dlg = document.getElementById('resultDialog');
  if (!dlg) return;
  dlg.dataset.mode = mode;
  dlg.classList.toggle('preview-mode', mode === 'preview');
}

function openStudyResultPreview() {
  const sessionData = buildPartialSessionData() || {
    items: [],
    results: [],
    correctCount: 0,
    total: 0
  };

  openResultDialog({
    ...sessionData,
    mode: 'preview'
  });
}

function getNormalizedStudyNotes() {
  return studySession.notes
    .map(note => String(note || '').trim())
    .filter(Boolean);
}

function createStudyNoteRow(value = '') {
  const row = document.createElement('div');
  row.className = 'study-note-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'study-note-input';
  input.value = value;
  input.placeholder = 'Chinese word';
  input.autocomplete = 'off';
  input.autocapitalize = 'off';
  input.spellcheck = false;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'study-note-remove';
  removeBtn.setAttribute('aria-label', 'Remove note');
  removeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  `;
  removeBtn.addEventListener('click', function() {
    row.remove();
    ensureStudyNoteRows();
  });

  row.appendChild(input);
  row.appendChild(removeBtn);
  return row;
}

function ensureStudyNoteRows() {
  const list = document.getElementById('studyNoteList');
  if (!list) return;
  if (list.children.length === 0) {
    list.appendChild(createStudyNoteRow());
  }
}

function renderStudyNoteRows() {
  const list = document.getElementById('studyNoteList');
  if (!list) return;
  const notes = getNormalizedStudyNotes();
  list.innerHTML = '';
  if (notes.length === 0) {
    list.appendChild(createStudyNoteRow());
  } else {
    notes.forEach(note => list.appendChild(createStudyNoteRow(note)));
  }
}

function collectStudyNoteRows() {
  const list = document.getElementById('studyNoteList');
  if (!list) return [];
  return Array.from(list.querySelectorAll('.study-note-input'))
    .map(input => input.value.trim())
    .filter(Boolean);
}

function saveStudyNotesFromDialog() {
  studySession.setNotes(collectStudyNoteRows());
}

function openStudyNoteDialog() {
  renderStudyNoteRows();
  DIALOG.openById(DIALOG.STUDY_NOTES, {
    callback: () => {
      const firstEmptyInput = Array.from(document.querySelectorAll('#studyNoteList .study-note-input'))
        .find(input => !input.value.trim());
      const firstInput = firstEmptyInput || document.querySelector('#studyNoteList .study-note-input');
      if (firstInput) firstInput.focus();
    }
  });
}

function closeStudyNoteDialog() {
  saveStudyNotesFromDialog();
  DIALOG.closeById(DIALOG.STUDY_NOTES);
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getChoiceIndexFromEvent(event) {
  if (event.code === 'Digit1' || event.code === 'Numpad1') return 0;
  if (event.code === 'Digit2' || event.code === 'Numpad2') return 1;
  if (event.code === 'Digit3' || event.code === 'Numpad3') return 2;
  return -1;
}

// Setup study dialog event handlers
function playWordAudio() {
  const step = studySession.currentStep();
  if (!step) return;
  
  console.log('Playing audio for word:', step.item[HSK.settings.character]);
  TTS.play(step.item[HSK.settings.character]);
}

function playSentenceAudio() {
  const step = studySession.currentStep();
  if (!step) return;
  
  console.log('Playing audio for sentence:', step.item.sentence);
  TTS.play(step.item.sentence[HSK.settings.character]);
}

function setupStudyDialogHandlers() {
  const dlg = document.getElementById('studyDialog');
  if (!dlg) return;

  const quit = document.getElementById('studyQuit');
  const togglePinyin = document.getElementById('studyTogglePinyin');
  const previewResultsBtn = document.getElementById('studyPreviewResultsBtn');
  const notesBtn = document.getElementById('studyNotesBtn');
  const cardWrap = document.getElementById('studyCard');
  const wordAudioBtn = document.getElementById('studyWordAudioBtn');
  const sentenceAudioBtn = document.getElementById('studySentenceAudioBtn');

  if (quit) {
    quit.addEventListener('click', async () => {
      await savePartialStudyProgress();
      closeStudyDialog();
    });
  }
  if (togglePinyin) togglePinyin.addEventListener('click', function() {
    const showPinyin = studySession.togglePinyin();
    const pinyinEl = document.getElementById('studyPinyin');
    if (pinyinEl) pinyinEl.style.opacity = showPinyin ? '1' : '0';
    const sentenceFrontPinyinEl = document.getElementById('studySentenceFrontPinyin');
    if (sentenceFrontPinyinEl) sentenceFrontPinyinEl.style.opacity = showPinyin ? '1' : '0';
    // update button state
    togglePinyin.textContent = `Pinyin: ${showPinyin ? 'On' : 'Off'}`;
    togglePinyin.classList.toggle('pinyin-on', showPinyin);
  });
  if (previewResultsBtn) {
    previewResultsBtn.addEventListener('click', function() {
      openStudyResultPreview();
    });
  }
  if (notesBtn) {
    notesBtn.addEventListener('click', function() {
      openStudyNoteDialog();
    });
  }

  wordAudioBtn.addEventListener('click', playWordAudio);
  sentenceAudioBtn.addEventListener('click', playSentenceAudio);

  cardWrap.addEventListener('click', function() {
    cardWrap.classList.toggle('flipped');
  });
  

  dlg.addEventListener('cancel', async function(e) {
    e.preventDefault();
    await savePartialStudyProgress();
    closeStudyDialog();
  });

  document.addEventListener('keydown', function(event) {
    if (!dlg.open) return;
    if (event.repeat) return;

    const choiceIndex = getChoiceIndexFromEvent(event);
    if (choiceIndex < 0) return;

    const choicesWrap = document.getElementById('studyChoices');
    if (!choicesWrap) return;

    const choiceButtons = choicesWrap.querySelectorAll('button');
    const selectedButton = choiceButtons[choiceIndex];
    if (!selectedButton || selectedButton.disabled) return;

    event.preventDefault();
    selectedButton.click();
  });
}

function buildPartialSessionData() {
  const data = studySession.result();
  const items = [];
  const results = [];

  data.results.forEach((result, index) => {
    if (result) {
      items.push(data.items[index]);
      results.push(result);
    }
  });

  if (items.length === 0) return null;

  const correctCount = results.filter(result => result && result.correct).length;
  return {
    items,
    results,
    correctCount,
    total: items.length,
    noteWords: data.noteWords,
    levels: data.levels
  };
}

async function savePartialStudyProgress() {
  const sessionData = buildPartialSessionData();
  if (!sessionData) return;
  await SRS_REVIEW.saveSessionResults(sessionData);
}

function setupStudyNoteDialogHandlers() {
  const dlg = document.getElementById('studyNoteDialog');
  if (!dlg) return;

  const closeBtn = document.getElementById('studyNoteCloseBtn');
  const addBtn = document.getElementById('studyNoteAddBtn');
  const doneBtn = document.getElementById('studyNoteDoneBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      closeStudyNoteDialog();
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', function() {
      const list = document.getElementById('studyNoteList');
      if (!list) return;
      const row = createStudyNoteRow();
      list.appendChild(row);
      const input = row.querySelector('.study-note-input');
      if (input) input.focus();
    });
  }

  if (doneBtn) {
    doneBtn.addEventListener('click', function() {
      closeStudyNoteDialog();
    });
  }

  dlg.addEventListener('cancel', function(e) {
    e.preventDefault();
    closeStudyNoteDialog();
  });
}

function setupResultDialogHandlers() {
  const dlg = document.getElementById('resultDialog');
  if (!dlg) return;

  const closeBtn = document.getElementById('resultCloseBtn');
  const retryBtn = document.getElementById('resultRetryBtn');

  const isPreviewMode = () => dlg.dataset.mode === 'preview';

  const saveSessionIfNeeded = async () => {
    if (isPreviewMode()) return;
    const sessionData = sessionStore.get('resultDialog');
    if (sessionData && !sessionData.savedToReview) {
      await SRS_REVIEW.saveSessionResults(sessionData);
      sessionData.savedToReview = true;
      sessionStore.set('resultDialog', sessionData);
    }
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', async function() {
      await saveSessionIfNeeded();
      closeResultDialog();
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', async function() {
      if (isPreviewMode()) return;
      const sessionData = sessionStore.get('resultDialog');
      await saveSessionIfNeeded();
      closeResultDialog();
      if (sessionData && Array.isArray(sessionData.items)) {
        openStudyDialog(sessionData.items);
      }
    });
  }

  dlg.addEventListener('cancel', async function(e) {
    e.preventDefault();
    await saveSessionIfNeeded();
    closeResultDialog();
  });

  document.addEventListener('keydown', function(event) {
    if (!dlg.open) return;
    if (event.repeat) return;
    if (event.code !== 'Space') return;
    if (isPreviewMode()) return;

    const retryBtn = document.getElementById('resultRetryBtn');
    if (!retryBtn) return;

    event.preventDefault();
    retryBtn.click();
  });
}

// ============================================
// DIALOG LOGIC
// ============================================
function openStudyDialog(items, options = {}) {
  DIALOG.openById(DIALOG.STUDY, {
    callback: (dlg) => {
      // initialize study session
      studySession.init(items, options.maxCount);

      // Initialize TTS
      TTS.reset();
      items.forEach(item => {
        TTS.generate(item[HSK.settings.character]);
        TTS.generate(item.sentence[HSK.settings.character], true);
      });
      const audioBtns = document.querySelector('.study-audio-actions');
      if (HSK.settings.tts !== 'none') {
        audioBtns.style.display = 'flex';
        } else {
        audioBtns.style.display = 'none';
      }

      renderStudyStep(dlg);
    }
  });
}
function closeStudyDialog() {
  DIALOG.closeById(DIALOG.STUDY, {
    callback: () => { sessionStore.clear('studyDialog'); }
  });
}
function openResultDialog(sessionData) {
  const mode = sessionData && sessionData.mode === 'preview' ? 'preview' : 'final';
  DIALOG.openById(DIALOG.STUDY_RESULT, {
    callback: (dlg) => {
      sessionStore.set('resultDialog', sessionData);
      setResultDialogMode(mode);
      renderResultSummary(dlg);
    }
  });
}
function closeResultDialog() {
  DIALOG.closeById(DIALOG.STUDY_RESULT, {
    callback: () => {
      setResultDialogMode('final');
      sessionStore.clear('resultDialog');
    }
  });
}

// ============================================
// ONLOAD LOGIC
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  setupStudyDialogHandlers();
  setupStudyNoteDialogHandlers();
  setupResultDialogHandlers();
});
