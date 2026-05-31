import { t, getCurrentLang } from './translations.js';
import { getHistory } from './history.js';

function statCard(icon, value, label, sub) {
  return '<div class="stat-card">'
    + '<div class="stat-icon">'   + icon  + '</div>'
    + '<div class="stat-value">'  + value + '</div>'
    + '<div class="stat-label">'  + label + '</div>'
    + (sub ? '<div class="stat-sub">' + sub + '</div>' : '')
    + '</div>';
}

export function displayStats() {
  const contentEl = document.getElementById('statsContent');
  const history = getHistory();

  if (history.length === 0) {
    contentEl.innerHTML = '<div class="stats-empty">📊<br><br>' + t('noDataForStats') + '</div>';
    return;
  }

  const totals  = history.map(r => Number(r.total)  || 0);
  const males   = history.map(r => Number(r.male)   || 0);
  const females = history.map(r => Number(r.female) || 0);

  const sumTotal  = totals.reduce((a, b)  => a + b, 0);
  const sumMale   = males.reduce((a, b)   => a + b, 0);
  const sumFemale = females.reduce((a, b) => a + b, 0);

  const avgTotal  = Math.round(sumTotal  / history.length);
  const avgMale   = Math.round(sumMale   / history.length);
  const avgFemale = Math.round(sumFemale / history.length);

  const maxTotal  = Math.max(...totals);
  const minTotal  = Math.min(...totals);
  const maxRecord = history[totals.indexOf(maxTotal)];
  const minRecord = history[totals.indexOf(minTotal)];

  const lang = getCurrentLang();
  function fmtDate(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString(lang === 'ml' ? 'ml-IN' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  const recent = history.slice().reverse().slice(-5);
  const maxRecentTotal = Math.max(...recent.map(r => Number(r.total) || 0));

  let trendHtml = '<div class="trend-section"><div class="trend-title">' + t('recentTrend') + '</div><div class="trend-bars">';
  recent.forEach(r => {
    const val    = Number(r.total) || 0;
    const barPx  = maxRecentTotal > 0 ? Math.max(4, Math.round((val / maxRecentTotal) * 60)) : 4;
    const label  = new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    trendHtml += '<div class="trend-bar-wrap">'
      + '<div class="trend-bar-val">' + val + '</div>'
      + '<div class="trend-bar-inner"><div class="trend-bar" style="height:' + barPx + 'px"></div></div>'
      + '<div class="trend-bar-label">' + label + '</div>'
      + '</div>';
  });
  trendHtml += '</div></div>';

  contentEl.innerHTML = '<div class="stats-section-title">' + t('statsTitle') + '</div>'
    + '<div class="stats-grid">'
    + statCard('⛪', history.length, t('totalServices'), '')
    + statCard('👥', avgTotal, t('avgAttendance'), t('male') + ': ' + avgMale + ' · ' + t('female') + ': ' + avgFemale)
    + statCard('📈', maxTotal, t('highestService'), fmtDate(maxRecord.date))
    + statCard('📉', minTotal, t('lowestService'), fmtDate(minRecord.date))
    + '</div>'
    + trendHtml;
}
