const VIEW_DASHBOARD = {
  // TODO: calculate from HSK.reviewed data
  reviewData: [
    { label: 'Mon', value: 18 },
    { label: 'Tue', value: 22 },
    { label: 'Wed', value: 11 },
    { label: 'Thu', value: 26 },
    { label: 'Fri', value: 19 },
    { label: 'Sat', value: 8 },
    { label: 'Sun', value: 14 }
  ],
  _initialized: false,

  // ============================================
  // INIT LOGIC
  // ============================================
  init: function() {
    if (this._initialized) return;
    const closeBtn = document.getElementById('dashboardCloseBtn');
    const cramBtn = document.getElementById('dashboardCramBtn');
    closeBtn.addEventListener('click', () => VIEW_DASHBOARD.closeDialog());
    if (cramBtn) {
      cramBtn.addEventListener('click', async () => {
        if (cramBtn.disabled) return;
        const dueItems = await SRS_REVIEW.getReviewItems(HSK_LEVELS, 0, Number.POSITIVE_INFINITY);
        if (!dueItems.length) return;

        dueItems.forEach(item => {
          if (Array.isArray(item.definitions)) {
            item.definition = item.definitions
              .slice()
              .sort((a, b) => a.length - b.length)
              .slice(0, 5)
              .join(' / ');
          }
        });

        VIEW_DASHBOARD.closeDialog();
        openStudyDialog(dueItems, { maxCount: dueItems.length });
      });
    }
    
    const dlg = document.getElementById('dashboardDialog');
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      VIEW_DASHBOARD.closeDialog();
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) {
        VIEW_DASHBOARD.closeDialog();
      }
    });
    this._initialized = true;
  },

  // ============================================
  // RENDER LOGIC
  // ============================================
  _renderDashboardChart: async function() {
    const chart = document.getElementById('dashboardChart');
    const totalEl = document.getElementById('dashboardTotal');
    const cramBtn = document.getElementById('dashboardCramBtn');

    this.reviewData = SRS_REVIEW.getWeeklyLearnedCounts(HSK_LEVELS);
    const maxValue = Math.max(...this.reviewData.map(item => item.value));
    const total = await SRS_REVIEW.getTotalDue(HSK_LEVELS);
    totalEl.textContent = String(total);
    if (cramBtn) cramBtn.disabled = total === 0;

    chart.innerHTML = '';
    this.reviewData.forEach(item => {
      const bar = document.createElement('div');
      bar.className = 'dashboard-bar';

      const value = document.createElement('div');
      value.className = 'dashboard-bar-value';
      value.textContent = String(item.value);

      const fill = document.createElement('div');
      fill.className = 'dashboard-bar-fill';
      const height = Math.max(8, Math.round((item.value / Math.max(1, maxValue)) * 100));
      fill.style.setProperty('--bar-height', `${height}%`);

      const label = document.createElement('div');
      label.className = 'dashboard-bar-label';
      label.textContent = item.label;

      bar.appendChild(value);
      bar.appendChild(fill);
      bar.appendChild(label);
      chart.appendChild(bar);
    });
  },

  _renderDashboardList: function() {
    const list = document.getElementById('dashboardHskList');
    list.innerHTML = '';

    // Load all HSK levels in parallel and then render the list once data is available
    HSK_DATA_SERVICE.load(HSK_LEVELS, 0).then(() => {
      HSK_LEVELS.forEach(async level => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'dashboard-hsk-btn';
          btn.dataset.level = String(level);

          const title = document.createElement('div');
          title.className = 'dashboard-hsk-title';
          title.textContent = `HSK Level ${level}`;

          const count = document.createElement('div');
          count.className = 'dashboard-hsk-count';
          count.textContent = 'Loading...';

          btn.appendChild(title);
          btn.appendChild(count);
          btn.addEventListener('click', () => VIEW_DASHBOARD_LIST.openDialog(level));
          list.appendChild(btn);

          const wordCount = await HSK_DATA_SERVICE.getWordCount([level]);
          count.textContent = `${wordCount} words`;
      });
    });
  },

  // ============================================
  // DIALOG LOGIC
  // ============================================
  openDialog: function() {
    DIALOG.openById(DIALOG.DASHBOARD, {
      callback: async () => {
        this._renderDashboardChart();
        this._renderDashboardList();
      }
    });
  },
  closeDialog: function() {
    DIALOG.closeById(DIALOG.DASHBOARD);
  },
};


const VIEW_DASHBOARD_LIST = {
  _initialized: false,

  // ============================================
  // INIT LOGIC
  // ============================================
  init: function() {
    if (this._initialized) return;
    const closeBtn = document.getElementById('listCloseBtn');
    closeBtn.addEventListener('click', () => VIEW_DASHBOARD_LIST.closeDialog());
    
    const dlg = document.getElementById('listDialog');
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      VIEW_DASHBOARD_LIST.closeDialog();
    });
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) {
        VIEW_DASHBOARD_LIST.closeDialog();
      }
    });
    this._initialized = true;
  },

  // ============================================
  // DIALOG LOGIC
  // ============================================
  openDialog: function(level) {
    DIALOG.openById(DIALOG.DASHBOARD_LIST, {
      callback: async () => {
        const title = document.getElementById('listTitle');
        const subtitle = document.getElementById('listSubtitle');
        const wordsWrap = document.getElementById('listWords');

        const items = await HSK_DATA_SERVICE.fetch(level);
        const milestoneMap = SRS_REVIEW.getMilestoneMap(level);
        const milestoneOrder = ['memorized', 'strong', 'weak', 'not_reviewed'];
        const milestoneWraps = new Map();
        const milestoneCounts = new Map(milestoneOrder.map(key => [key, 0]));
        const milestoneCountEls = new Map();

        title.textContent = `HSK Level ${level}`;
        subtitle.textContent = `${items.length} words`;

        milestoneOrder.forEach(key => {
          const wrap = wordsWrap.querySelector(`[data-milestone-words="${key}"]`);
          const countEl = wordsWrap.querySelector(`[data-milestone-count="${key}"]`);
          if (wrap) {
            wrap.innerHTML = '';
            milestoneWraps.set(key, wrap);
          }
          if (countEl) {
            countEl.textContent = '0';
            milestoneCountEls.set(key, countEl);
          }
        });

        items.forEach(item => {
          const word = document.createElement('div');
          word.className = 'list-word';
          const idStr = item && item.id != null ? String(item.id) : '';
          const milestone = milestoneMap.get(idStr) || 'not_reviewed';
          word.classList.add(`milestone-${milestone}`);
          word.textContent = item[HSK.settings.character] || '';
          const targetMilestone = milestoneWraps.has(milestone) ? milestone : 'not_reviewed';
          const target = milestoneWraps.get(targetMilestone);
          if (target) {
            target.appendChild(word);
            milestoneCounts.set(targetMilestone, milestoneCounts.get(targetMilestone) + 1);
          }
        });

        milestoneCounts.forEach((count, key) => {
          const countEl = milestoneCountEls.get(key);
          if (countEl) countEl.textContent = String(count);
        });
      }
    });
  },
  closeDialog: function() {
    DIALOG.closeById(DIALOG.DASHBOARD_LIST, { timeout: 0 });
  },
}

document.addEventListener('DOMContentLoaded', function() {
  VIEW_DASHBOARD.init();
  VIEW_DASHBOARD_LIST.init();
});
