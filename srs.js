const SRS_REVIEW = {
  storagePrefix: 'hsk-flip-rev',
  defaultDifficulty: 0.3,
  defaultDaysBetweenReviews: 1,
  performanceCutoff: 0.6,
  recentReviewHours: 8,
  floatScale: 1000,
  _cachedReviewItems: [],

  _encodeFloat(value) {
    return Math.round(value * this.floatScale);
  },

  _decodeFloat(value, fallback) {
    if (value == null) return fallback;
    return value / this.floatScale;
  },

  _storageKey(level) {
    return `${this.storagePrefix}${level}`;
  },

  _loadLevel(level) {
    const raw = localStorage.getItem(this._storageKey(level));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('SRS review data parse failed:', err);
      return [];
    }
  },

  _saveLevel(level, entries) {
    localStorage.setItem(this._storageKey(level), JSON.stringify(entries));
    this._cachedReviewItems = [];
  },

  _parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  },

  _getWeekdayIndex(date) {
    return (date.getDay() + 6) % 7;
  },

  _getStartOfWeek(now) {
    const start = new Date(now);
    const dayIndex = this._getWeekdayIndex(start);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - dayIndex);
    return start;
  },

  _hoursSince(date, now) {
    return (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  },

  _daysBetween(a, b) {
    const ms = b.getTime() - a.getTime();
    return ms / (1000 * 60 * 60 * 24);
  },

  _getDaysSince(entry, now) {
    const lastReviewed = this._parseDate(entry.lr);
    if (!lastReviewed) {
      return this._decodeFloat(entry.da, this.defaultDaysBetweenReviews);
    }
    return Math.max(0, this._daysBetween(lastReviewed, now));
  },

  _getPercentOverdue(entry, now, correct) {
    const daysBetweenReviews = Math.max(
      0.0001,
      this._decodeFloat(entry.da, this.defaultDaysBetweenReviews)
    );
    const daysSince = this._getDaysSince(entry, now);
    if (!correct) return 1;
    return Math.min(2, daysSince / daysBetweenReviews);
  },

  _clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  },

  _updateEntry(entry, performanceRating, now) {
    const correct = performanceRating >= this.performanceCutoff;
    const percentOverdue = this._getPercentOverdue(entry, now, correct);
    const baseDifficulty = this._decodeFloat(entry.di, this.defaultDifficulty);
    const difficulty = this._clamp(
      baseDifficulty + (percentOverdue * (1 / 17) * (8 - 9 * performanceRating)),
      0,
      1
    );
    const difficultyWeight = 3 - 1.7 * difficulty;

    let nextDaysBetween = this._decodeFloat(entry.da, this.defaultDaysBetweenReviews);
    if (correct) {
      const jitter = 0.95 + Math.random() * 0.1;
      nextDaysBetween *= 1 + (difficultyWeight - 1) * percentOverdue * jitter;
    } else {
      nextDaysBetween *= 1 / (1 + 3 * difficulty);
      if (nextDaysBetween > 1) nextDaysBetween = 1;
    }

    entry.di = this._encodeFloat(difficulty);
    entry.da = this._encodeFloat(Math.max(0.1, nextDaysBetween));
    entry.lr = now.toISOString();
  },

  saveSessionResults(sessionData) {
    if (!sessionData || !Array.isArray(sessionData.items)) return;
    const now = new Date();
    const byLevel = new Map();

    sessionData.items.forEach((item, index) => {
      if (!item || item.id == null) return;
      const level = item.level != null ? item.level : (HSK.selectedLevels.length > 0 ? HSK.selectedLevels[0] : 1);
      const levelKey = String(level);
      const results = byLevel.get(levelKey) || [];
      results.push({ item, result: sessionData.results[index] });
      byLevel.set(levelKey, results);
    });

    byLevel.forEach((rows, levelKey) => {
      const entries = this._loadLevel(levelKey);
      const entryMap = new Map(entries.map(entry => [String(entry.id), entry]));

      rows.forEach(({ item, result }) => {
        const idStr = String(item.id);
        let entry = entryMap.get(idStr);
        if (!entry) {
          entry = {
            id: item.id,
            di: this._encodeFloat(this.defaultDifficulty),
            da: this._encodeFloat(this.defaultDaysBetweenReviews),
            lr: null
          };
        }

        const performanceRating = result && result.correct ? 1.0 : 0.2;
        this._updateEntry(entry, performanceRating, now);
        entryMap.set(idStr, entry);
      });

      this._saveLevel(levelKey, Array.from(entryMap.values()));
    });
  },

  async getReviewItems(levels, minCount = 10, maxCount = 20) {
    const now = new Date();
    const levelKeys = (Array.isArray(levels) ? levels : []).map(level => String(level));
    if (levelKeys.length === 0) return [];

    await Promise.all(levelKeys.map(level => HSK_DATA_SERVICE.fetch(level)));

    const candidates = [];
    levelKeys.forEach(levelKey => {
      const entries = this._loadLevel(levelKey);
      entries.forEach(entry => {
        const lastReviewed = this._parseDate(entry.lr);
        if (lastReviewed) {
          const hoursSince = (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60);
          if (hoursSince < this.recentReviewHours) return;
        }
        const percentOverdue = this._getPercentOverdue(entry, now, true);
        candidates.push({ levelKey, entry, percentOverdue });
      });
    });

    candidates.sort((a, b) => b.percentOverdue - a.percentOverdue);
    const targetCount = Math.min(maxCount, Math.max(minCount, candidates.length));
    const picked = candidates.slice(0, targetCount);
    const items = [];

    picked.forEach(({ levelKey, entry }) => {
      const cached = HSK_DATA_SERVICE._cache.get(levelKey) || [];
      const found = cached.find(item => String(item.id) === String(entry.id));
      if (found) items.push(found);
    });

    this._cachedReviewItems = items;
    return items;
  },

  async getTotalDue(levels) {
    if (this._cachedReviewItems.length === 0) {
      await SRS_REVIEW.getReviewItems(HSK_LEVELS, 0, Number.POSITIVE_INFINITY)
    } 
    return this._cachedReviewItems.length;
  },

  getWeeklyLearnedCounts(levels) {
    const now = new Date();
    const levelKeys = (Array.isArray(levels) ? levels : []).map(level => String(level));
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const values = labels.map(() => 0);
    if (levelKeys.length === 0) return labels.map((label, index) => ({ label, value: values[index] }));

    const startOfWeek = this._getStartOfWeek(now);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    levelKeys.forEach(levelKey => {
      const entries = this._loadLevel(levelKey);
      entries.forEach(entry => {
        const lastReviewed = this._parseDate(entry.lr);
        if (!lastReviewed) return;
        if (lastReviewed < startOfWeek || lastReviewed >= endOfWeek) return;
        const dayIndex = this._getWeekdayIndex(lastReviewed);
        values[dayIndex] += 1;
      });
    });

    return labels.map((label, index) => ({ label, value: values[index] }));
  },

  getLearnedIdSet(level) {
    const levelKey = String(level);
    const entries = this._loadLevel(levelKey);
    const learned = new Set();

    entries.forEach(entry => {
      if (entry && entry.id != null && entry.lr) {
        learned.add(String(entry.id));
      }
    });

    return learned;
  },

  getCardMilestone(entry) {
    const daysBetweenReviews = this._decodeFloat(entry.da, 0);
    const difficulty = this._decodeFloat(entry.di, this.defaultDifficulty);
    const dateLastReviewed = entry.lr;

    if (!dateLastReviewed || daysBetweenReviews === 0) {
      return 'not_reviewed';
    }

    if (daysBetweenReviews < 3 || difficulty > 0.7) {
      return 'weak';
    }

    if (daysBetweenReviews <= 21 && difficulty <= 0.7) {
      return 'strong';
    }

    if (daysBetweenReviews > 21 && difficulty < 0.4) {
      return 'memorized';
    }

    return 'strong';
  },

  getMilestoneMap(level) {
    const levelKey = String(level);
    const entries = this._loadLevel(levelKey);
    const milestones = new Map();

    entries.forEach(entry => {
      if (!entry || entry.id == null) return;
      milestones.set(String(entry.id), this.getCardMilestone(entry));
    });

    return milestones;
  }
};
