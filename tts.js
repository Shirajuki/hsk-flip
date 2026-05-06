const TTS = {
  _cache: new Map(),
  types: ['none', 'offline', 'online'],
  voices: [],

  init: function() {
    const voices = window.speechSynthesis.getVoices();
    this.voices = voices.filter((voice) => {
      const lang = (voice.lang || '').toLowerCase();
      return lang === 'zh-cn' || lang.startsWith('zh');
    });

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => this.init();
    }

    const storedVoice = HSK.settings.ttsVoice || '';
    this._selectedVoice = this.voices.find((voice) => (voice.voiceURI || voice.name) === storedVoice) || this.voices[0];

    console.log(this._selectedVoice);
    if (!this._selectedVoice) {
      this.types = ['none', 'online'];
      HSK.settings.tts = 'online';
      HSK.settings.ttsVoice = '';
      localStorage.setItem('hsk-flip-settings', JSON.stringify(HSK.settings));
    } else {
      this.types = ['none', 'offline', 'online'];
    }

    // Initialize TTS by playing and immediately stopping a dummy utterance to prompt the browser to load necessary resources and avoid delay on first real playback
    const dummyUtterance = new SpeechSynthesisUtterance('');
    speechSynthesis.speak(dummyUtterance);
    speechSynthesis.cancel();
  },

  // Youdao TTS setup
  _onlineSentence: eval(atob("Y29uc3QgWU9VREFPX1BST05PVU5DRV9TRUNSRVRfS0VZPSJVM3VBQ05SV1NEV2Rjc0ttIjtmdW5jdGlvbiBtYWtlWW91ZGFvUHJvbm91bmNlU2lnbihlLG8pe3ZhciBuLGk7Y29uc3QgdD1udWxsIT09KGk9bnVsbD09PShuPWUucG9pbnRQYXJhbSl8fHZvaWQgMD09PW4/dm9pZCAwOm4uc3BsaXQoIiwiKSkmJnZvaWQgMCE9PWk/aTpbXSxjPXt9O2Zvcihjb25zdCBvIG9mIHQpbyBpbiBlJiYia2V5IiE9PW8mJihjW29dPWVbb10pO2NvbnN0IHI9W107Zm9yKGNvbnN0IGUgb2YgdClpZihlIGluIGMmJiJrZXkiIT09ZSl7Y29uc3Qgbz1jW2VdO3IucHVzaChgJHtlfT0ke299YCl9Y29uc3QgZD1gJHtyLmpvaW4oIiYiKX0ma2V5PSR7b31gO3JldHVybiBuZXcgTUQ1KChuZXcgVGV4dEVuY29kZXIpLmVuY29kZShkKSkuaGV4ZGlnZXN0KCl9ZnVuY3Rpb24gbWFrZVlvdWRhb1Byb25vdW5jZVVybChlLHt0eXBlOm89IjIiLG15c3RpY1RpbWU6bj1udWxsLHNlY3JldEtlWTppPSJVM3VBQ05SV1NEV2Rjc0ttIn09e30pe251bGw9PW4/bj1EYXRlLm5vdygpLnRvU3RyaW5nKCk6Im51bWJlciI9PXR5cGVvZiBuJiYobj1uLnRvU3RyaW5nKCkpO2NvbnN0IHQ9e3Byb2R1Y3Q6IndlYmRpY3QiLGFwcFZlcnNpb246IjEiLGNsaWVudDoid2ViIixtaWQ6IjEiLHZlbmRvcjoid2ViIixzY3JlZW46IjEiLG1vZGVsOiIxIixpbWVpOiIxIixuZXR3b3JrOiJ3aWZpIixrZXlmcm9tOiJkaWNrIixrZXlpZDoidm9pY2VEaWN0V2ViIixteXN0aWNUaW1lOm4seWR1dWlkOiJhYmNkZWZnIixsZToiemgiLHBob25ldGljOiIiLHJhdGU6IjQiLHdvcmQ6ZSx0eXBlOm8saWQ6IiIscG9pbnRQYXJhbToiYXBwVmVyc2lvbixjbGllbnQsaW1laSxrZXlmcm9tLGtlWWlkLG1pZCxtb2RlbCxteXN0aWNUaW1lLG5ldHdvcmsscHJvZHVjdCxyYXRlLHNjcmVlbix0eXBlLHZlbmRvcix3b3JkLHlkdXVpZCxrZXkifSxjPW1ha2VZb3VkYW9Qcm9ub3VuY2VTaWduKHQsaSk7cmV0dXJuYGh0dHBzOi8vZGljdC55b3VkYW8uY29tL3Byb25vdW5jZS9iYXNlPyR7bmV3IFVSTFNlYXJjaFBhcmFtcyh7Li4udCxzaWduOmN9KX1gfW1ha2VZb3VkYW9Qcm9ub3VuY2VVcmw=")),
  _onlineWord: function(word) {
    const baseUrl = "https://dict.youdao.com/dictvoice?le=cn&audio=";
    return `${baseUrl}${encodeURIComponent(word)}`;
  },

  reset: function() {
    this._cache.clear();
  },

  generate: function(word, isSentence = false) {
    if (HSK.settings.tts === 'offline') {
      const u = new SpeechSynthesisUtterance(word);
      u.lang = 'zh-CN';
      u.voice = this._selectedVoice || this.voices[0];
      this._cache.set(word, u);
      return u;
    } else if (HSK.settings.tts === 'online') {
      const url = isSentence ? this._onlineSentence(word) : this._onlineWord(word);
      const audio = new Audio(url);
      this._cache.set(word, audio);
      // Check if audio loaded successfully, if not fallback to sentence TTS which is more likely to succeed
      audio.onerror = () => {
        this._cache.delete(word);
        const url = this._onlineSentence(word);
        const fallbackAudio = new Audio(url);
        this._cache.set(word, fallbackAudio); 
      }
      return audio;
    }
  },

  play: function(word) {
    if (HSK.settings.tts === 'offline') {
      let u = this._cache.get(word);
      // TODO: Ignore cached utterance for now since it is a bit buggy, need to investigate further
      if (!u || true) {
        u = new SpeechSynthesisUtterance(word);
        u.lang = this._selectedVoice?.lang || 'zh-CN';
        u.voice = this._selectedVoice || this._voices[0] || null;
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } else if (HSK.settings.tts === 'online') {
      const audio = this._cache.get(word);
      if (!audio) return;
      // Reload all audio to ensure things plays from the start
      for (const a of this._cache.values()) {
        if (!(a instanceof Audio)) continue;
        a.pause()
        a.currentTime = 0;
      }
      audio.play();
    }
  }
};

document.addEventListener('DOMContentLoaded', function() {
  TTS.init();
});