const HSK_DATA_SERVICE = {
  _cache: new Map(),
  _word_count_cache: new Map(),

  async load(levels, count) {
    // Load all requested levels in parallel, before accessing the cached data for performance reasons
    await Promise.all(levels.map(level => this.fetch(level)));
    if (count <= 0) return [];

    const seen = new Set();
    const selectedCards = [];
    while (selectedCards.length < count) {
      const level = String(levels[Math.floor(Math.random() * levels.length)]);
      const cardIdx = Math.floor(Math.random() * this._word_count_cache.get(level));
      const id = `${level}-${cardIdx}`;

      if (!seen.has(id)) {
        seen.add(id);
        const card = this._cache.get(level)[cardIdx];
        selectedCards.push(card);
      }
    }
    return selectedCards;
  },

  async fetch(levelKey) {
    const key = String(levelKey);
    if (this._cache.has(key)) return Promise.resolve(this._cache.get(key));

    return fetch(`list/hsk${key}.json`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP error - ${r.status}`);
        return r.json();
      })
      .then(data => {
        // Mutate data to add level info if not already present, so we can use it later without needing to reference the key
        for (let i = 0; i < data.length; i++) {
          data[i].level = parseInt(key, 10);
        }
        // Cache the loaded data and its count for later use
        this._cache.set(key, data);
        this._word_count_cache.set(key, data.length);
        return data;
      })
      .catch(err => {
        console.error('Error loading HSK data:', err);
      });
  },

  async getWordCount(levels) {
    // Ensure all levels are fetched before calculating word count
    await Promise.all(levels.map(level => this.fetch(level)));
    return levels.reduce((total, level) => total + this._word_count_cache.get(String(level)), 0);
  },
};