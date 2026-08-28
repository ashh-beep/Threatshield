(() => {
  const params = new URLSearchParams(window.location.search);
  const targetUrl = params.get('url') || '';
  const verdict = params.get('verdict') || 'Phishing';
  const score = parseInt(params.get('score') || '88', 10);
  const reasonsRaw = params.get('reasons') || '';
  
  let reasons = [];
  try {
    reasons = JSON.parse(reasonsRaw);
  } catch {
    reasons = reasonsRaw ? [reasonsRaw] : [];
  }
  if (!reasons || reasons.length === 0) {
    reasons = ["Potential phishing pattern or security policy risk detected."];
  }

  const isPhishing = verdict.toLowerCase() === 'phishing' || verdict.toLowerCase() === 'dangerous';
  
  const card = document.getElementById('card');
  const icon = document.getElementById('icon');
  const title = document.getElementById('title');
  const badgeVerdict = document.getElementById('badge-verdict');
  const badgeScore = document.getElementById('badge-score');
  const urlBox = document.getElementById('url-box');
  const reasonsList = document.getElementById('reasons-list');
  const btnGoBack = document.getElementById('btn-goback');
  const btnProceed = document.getElementById('btn-proceed');

  urlBox.textContent = `URL: ${targetUrl}`;
  badgeScore.textContent = `Risk Score: ${score}%`;
  badgeVerdict.textContent = `Verdict: ${verdict}`;

  if (isPhishing) {
    card.className = 'card-danger';
    icon.textContent = '🚨';
    title.textContent = 'High-Risk Threat Blocked';
    title.className = 'title-danger';
    badgeVerdict.className = 'metric-badge badge-danger';
    btnGoBack.className = 'btn btn-goback-danger';
  } else {
    card.className = 'card-warning';
    icon.textContent = '⚠️';
    title.textContent = 'Suspicious Website Warning';
    title.className = 'title-warning';
    badgeVerdict.className = 'metric-badge badge-warning';
    btnGoBack.className = 'btn btn-goback-warning';
  }

  reasonsList.innerHTML = reasons
    .map(r => `<div class="reason-item"><span>•</span><span>${r}</span></div>`)
    .join('');

  btnGoBack.addEventListener('click', () => {
    if (window.history.length > 2) {
      window.history.back();
    } else {
      window.location.href = 'about:blank';
    }
  });

  btnProceed.addEventListener('click', () => {
    if (targetUrl) {
      window.location.href = targetUrl;
    }
  });
})();
