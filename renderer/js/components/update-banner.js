import { h, formatDate, toast } from '../ui.js';
import * as actions from '../actions.js';

// 홈 상단에 현재 버전과 업데이트 상태를 보여 준다.
// 새 버전이 있으면 여기서 바로 내려받고 설치할 수 있다.
export function createUpdateBanner({ onOpenSettings = null } = {}) {
  let snapshot = null;
  let version = '';
  let busy = false;
  let signature = '';

  const versionText = h('span', { class: 'update-banner__version' });
  const statusText = h('span', { class: 'update-banner__text' });
  const noteText = h('p', { class: 'update-banner__note muted small', hidden: true });
  const percentText = h('span', { class: 'update-banner__percent small' });
  const fill = h('div', { class: 'progress-bar__fill' });
  const bar = h('div', { class: 'progress-bar update-banner__bar', hidden: true }, fill);

  const primaryBtn = h('button', {
    class: 'btn btn--sm btn--primary',
    type: 'button',
    text: '업데이트',
    hidden: true,
    onClick: () => {
      if (busy) return;
      if (snapshot?.phase === 'ready') void installNow();
      else void downloadNow();
    },
  });

  const checkBtn = h('button', {
    class: 'btn btn--sm btn--subtle',
    type: 'button',
    text: '업데이트 확인',
    onClick: () => void checkNow(),
  });

  const settingsBtn = h('button', {
    class: 'btn btn--sm btn--subtle',
    type: 'button',
    text: '업데이트 설정',
    onClick: () => onOpenSettings?.(),
  });

  const element = h(
    'section',
    { class: 'card update-banner' },
    h(
      'div',
      { class: 'update-banner__row' },
      h(
        'div',
        { class: 'update-banner__info' },
        h('div', { class: 'update-banner__title' }, h('span', { class: 'update-banner__app', text: 'StudyTED' }), versionText),
        h('div', { class: 'update-banner__status' }, statusText, percentText),
      ),
      h('div', { class: 'update-banner__actions' }, primaryBtn, checkBtn, settingsBtn),
    ),
    bar,
    noteText,
  );

  async function downloadNow() {
    busy = true;
    try {
      await actions.downloadUpdate();
      toast('업데이트를 내려받았습니다. "지금 설치" 를 누르면 설치 후 앱이 다시 시작됩니다.', { type: 'success', timeout: 6000 });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 8000 });
    } finally {
      busy = false;
      render();
    }
  }

  async function installNow() {
    busy = true;
    try {
      await actions.installUpdate();
      toast('설치를 시작합니다. 잠시 뒤 앱이 자동으로 다시 열립니다.', { type: 'success', timeout: 6000 });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 8000 });
      busy = false;
      render();
    }
  }

  async function checkNow() {
    if (busy) return;
    busy = true;
    checkBtn.disabled = true;
    try {
      const result = await actions.checkUpdate({ force: true });
      if (result?.phase === 'available') toast(`새 버전 ${result.latest?.version} 을(를) 사용할 수 있습니다.`, { type: 'success', timeout: 6000 });
      else if (result?.phase === 'current') toast('최신 버전을 사용 중입니다.', { type: 'info' });
    } catch (error) {
      toast(error.message, { type: 'error', timeout: 8000 });
    } finally {
      busy = false;
      checkBtn.disabled = false;
      render();
    }
  }

  function render() {
    const phase = snapshot?.phase ?? 'idle';
    const latest = snapshot?.latest ?? null;
    const feedReady = Boolean(snapshot?.feedUrl);
    const key = [version, phase, latest?.version ?? '', snapshot?.percent ?? 0, snapshot?.error ?? '', feedReady, busy].join('|');
    if (key === signature) return;
    signature = key;

    versionText.textContent = version ? ` v${version}` : '';

    let text = '';
    let note = '';
    switch (phase) {
      case 'checking':
        text = '업데이트를 확인하는 중입니다…';
        break;
      case 'current':
        text = '최신 버전을 사용 중입니다.';
        note = snapshot?.checkedAt ? `마지막 확인 ${formatDate(snapshot.checkedAt)}` : '';
        break;
      case 'available':
        text = `새 버전 v${latest?.version ?? ''} 을(를) 사용할 수 있습니다.`;
        note = latest?.notes ?? '';
        break;
      case 'downloading':
        text = `업데이트 v${latest?.version ?? ''} 내려받는 중…`;
        break;
      case 'ready':
        text = `업데이트 v${latest?.version ?? ''} 준비 완료.`;
        note = '설치하면 앱이 종료되었다가 자동으로 다시 열립니다.';
        break;
      case 'installing':
        text = '설치를 시작합니다. 앱이 곧 다시 열립니다.';
        break;
      case 'error':
        text = snapshot?.error || '업데이트를 확인하지 못했습니다.';
        break;
      default:
        if (!snapshot) text = '업데이트 정보를 확인하는 중입니다.';
        else text = feedReady ? '업데이트를 확인할 수 있습니다.' : '업데이트 주소를 설정하면 새 버전이 나올 때 알려 드립니다.';
        break;
    }

    statusText.textContent = text;
    noteText.textContent = note;
    noteText.hidden = !note;

    bar.hidden = phase !== 'downloading';
    if (phase === 'downloading') {
      const percent = Math.max(0, Math.min(100, snapshot?.percent ?? 0));
      fill.style.width = `${percent}%`;
      const total = snapshot?.total ?? 0;
      const received = snapshot?.received ?? 0;
      percentText.hidden = false;
      percentText.textContent = total ? `${percent}% · ${(received / 1048576).toFixed(1)}MB / ${(total / 1048576).toFixed(1)}MB` : `${percent}%`;
    } else {
      percentText.hidden = true;
      percentText.textContent = '';
    }

    primaryBtn.hidden = !['available', 'ready'].includes(phase);
    primaryBtn.textContent = phase === 'ready' ? '지금 설치하고 다시 시작' : '업데이트 내려받기';
    primaryBtn.disabled = busy;
    checkBtn.textContent = phase === 'error' ? '다시 확인' : '업데이트 확인';
    checkBtn.disabled = busy || phase === 'checking' || phase === 'downloading' || phase === 'installing';
    settingsBtn.disabled = !onOpenSettings;
  }

  return {
    element,
    update(s) {
      snapshot = s.update ?? null;
      version = s.info?.version ?? snapshot?.version ?? '';
      render();
    },
  };
}