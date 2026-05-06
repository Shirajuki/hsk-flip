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

  init(items, maxCount) {
    const limit = Number.isFinite(maxCount) ? maxCount : HSK.cardCount;
    const finalCount = limit > 0 ? limit : items.length;
    this._items = shuffleArray(items).slice(0, finalCount);
    this._index = 0;
    this._results = [];
    this._showPinyin = false;
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

  result() {
    const correctCount = this._results.filter(r => r && r.correct).length;
    return {
      items: this._items,
      results: this._results,
      correctCount,
      total: this._items.length
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
  const cardWrap = document.getElementById('studyCard');
  const wordAudioBtn = document.getElementById('studyWordAudioBtn');
  const sentenceAudioBtn = document.getElementById('studySentenceAudioBtn');

  if (quit) {
    quit.addEventListener('click', () => {
      savePartialStudyProgress();
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

  wordAudioBtn.addEventListener('click', playWordAudio);
  sentenceAudioBtn.addEventListener('click', playSentenceAudio);

  cardWrap.addEventListener('click', function() {
    cardWrap.classList.toggle('flipped');
  });
  

  dlg.addEventListener('cancel', function(e) {
    e.preventDefault();
    savePartialStudyProgress();
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
    total: items.length
  };
}

function savePartialStudyProgress() {
  const sessionData = buildPartialSessionData();
  if (!sessionData) return;
  SRS_REVIEW.saveSessionResults(sessionData);
}

function setupResultDialogHandlers() {
  const dlg = document.getElementById('resultDialog');
  if (!dlg) return;

  const closeBtn = document.getElementById('resultCloseBtn');
  const retryBtn = document.getElementById('resultRetryBtn');

  const saveSessionIfNeeded = () => {
    const sessionData = sessionStore.get('resultDialog');
    if (sessionData && !sessionData.savedToReview) {
      SRS_REVIEW.saveSessionResults(sessionData);
      sessionData.savedToReview = true;
      sessionStore.set('resultDialog', sessionData);
    }
  };

  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      saveSessionIfNeeded();
      closeResultDialog();
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', function() {
      const sessionData = sessionStore.get('resultDialog');
      saveSessionIfNeeded();
      closeResultDialog();
      if (sessionData && Array.isArray(sessionData.items)) {
        openStudyDialog(sessionData.items);
      }
    });
  }

  dlg.addEventListener('cancel', function(e) {
    e.preventDefault();
    saveSessionIfNeeded();
    closeResultDialog();
  });

  document.addEventListener('keydown', function(event) {
    if (!dlg.open) return;
    if (event.repeat) return;
    if (event.code !== 'Space') return;

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
  DIALOG.openById(DIALOG.STUDY_RESULT, {
    callback: (dlg) => {
      sessionStore.set('resultDialog', sessionData);
      renderResultSummary(dlg);
    }
  });
}
function closeResultDialog() {
  DIALOG.closeById(DIALOG.STUDY_RESULT, {
    callback: () => { sessionStore.clear('resultDialog'); }
  });
}

// ============================================
// ONLOAD LOGIC
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  setupStudyDialogHandlers();
  setupResultDialogHandlers();
});