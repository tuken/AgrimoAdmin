/* top page */
(function () {
  const card = document.getElementById('workSummaryCard');
  const dataEl = document.getElementById('workSummaryData');
  const bodyEl = document.getElementById('workSummaryBody');
  const periodLabelEl = document.getElementById('workSummaryPeriodLabel');

  if (!card || !dataEl || !bodyEl || !periodLabelEl) return;

  const periodLabels = {
    today: '今日',
    thisWeek: '今週累計',
    thisMonth: '今月累計',
  };

  const dotClasses = ['', 'alt1', 'alt2'];

  let summaryItems = [];
  try {
    const parsed = JSON.parse(dataEl.textContent || '[]');
    summaryItems = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[top] failed to parse work summary data:', err);
    summaryItems = [];
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSortedItems(periodKey) {
    return summaryItems
      .filter((item) => Number(item?.[periodKey] ?? 0) > 0)
      .sort((a, b) => {
        const diff = Number(b?.[periodKey] ?? 0) - Number(a?.[periodKey] ?? 0);
        if (diff !== 0) return diff;
        return Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0);
      });
  }

  function render(periodKey) {
    const label = periodLabels[periodKey] || periodLabels.today;
    const items = getSortedItems(periodKey);

    periodLabelEl.textContent = label;

    const badges = card.querySelectorAll('.work-summary-badge');
    badges.forEach((badge) => {
      const isActive = badge.dataset.period === periodKey;
      badge.classList.toggle('active', isActive);
      badge.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (!items.length) {
      bodyEl.innerHTML = '<div class="work-summary-empty">表示できる集計データはありません</div>';
      return;
    }

    bodyEl.innerHTML = items.map((item, index) => {
      const dotClass = dotClasses[index % dotClasses.length];
      const count = Number(item?.[periodKey] ?? 0);
      return `
        <div class="work-summary-row data">
          <div class="work-summary-label">
            <span class="work-summary-dot ${dotClass}"></span>
            <span>${escapeHtml(item?.name || '未設定')}</span>
          </div>
          <div class="work-summary-value">${count}<span class="work-summary-unit">件</span></div>
        </div>
      `;
    }).join('');
  }

  card.addEventListener('click', (event) => {
    const badge = event.target.closest('.work-summary-badge');
    if (!badge) return;
    const periodKey = badge.dataset.period || 'today';
    render(periodKey);
  });

  render(card.dataset.defaultPeriod || 'today');
})();


(function () {
  const card = document.getElementById('workRankingCard');
  const dataEl = document.getElementById('workSummaryData');
  const bodyEl = document.getElementById('workRankingBody');

  if (!card || !dataEl || !bodyEl) return;

  const periodLabels = {
    today: '今日',
    thisWeek: '今週累計',
    thisMonth: '今月累計',
  };

  let summaryItems = [];
  try {
    const parsed = JSON.parse(dataEl.textContent || '[]');
    summaryItems = Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[top] failed to parse work ranking data:', err);
    summaryItems = [];
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getSortedItems(periodKey) {
    return summaryItems
      .filter((item) => Number(item?.[periodKey] ?? 0) > 0)
      .sort((a, b) => {
        const diff = Number(b?.[periodKey] ?? 0) - Number(a?.[periodKey] ?? 0);
        if (diff !== 0) return diff;
        return Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0);
      })
      .slice(0, 3);
  }

  function render(periodKey) {
    const items = getSortedItems(periodKey);
    const total = items.reduce((sum, item) => sum + Number(item?.[periodKey] ?? 0), 0);

    const badges = card.querySelectorAll('.ranking-badge');
    badges.forEach((badge) => {
      const isActive = badge.dataset.period === periodKey;
      badge.classList.toggle('active', isActive);
      badge.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    if (!items.length) {
      bodyEl.innerHTML = `<div class="ranking-empty">${periodLabels[periodKey] || '対象期間'}の集計データはありません</div>`;
      return;
    }

    bodyEl.innerHTML = items.map((item, index) => {
      const count = Number(item?.[periodKey] ?? 0);
      const rank = index + 1;
      const share = total > 0 ? Math.round((count / total) * 100) : 0;
      return `
        <div class="ranking-item">
          <div class="ranking-rank rank-${rank}">${rank}位</div>
          <div class="ranking-main">
            <div class="ranking-label">${escapeHtml(item?.name || '未設定')}</div>
            <div class="ranking-meta-row">
              <span class="ranking-chip">全体の ${share}%</span>
            </div>
          </div>
          <div class="ranking-value">${count}件</div>
        </div>
      `;
    }).join('');
  }

  card.addEventListener('click', (event) => {
    const badge = event.target.closest('.ranking-badge');
    if (!badge) return;
    render(badge.dataset.period || 'today');
  });

  render(card.dataset.defaultPeriod || 'today');
})();
