import { api, hasBridge, errorMessage } from './api.js';
import { state, set, subscribe } from './state.js';
import { h, clear, toast, loadingState } from './ui.js';
import * as actions from './actions.js';
import { createHomeView } from './views/home.js';
import { createChannelsView } from './views/channels.js';
import { createLearnView } from './views/learn.js';
import { createNotesView } from './views/notes.js';
import { createMaterialsView } from './views/materials.js';
import { createShareView } from './views/share.js';
import { createSettingsView } from './views/settings.js';

const VIEWS = [
  { id: 'home', label: '홈', icon: '⌂', shortcut: '1', create: createHomeView },
  { id: 'channels', label: '채널 관리', icon: '▤', shortcut: '2', create: createChannelsView },
  { id: 'learn', label: '학습하기', icon: '▶', shortcut: '3', create: createLearnView },
  { id: 'notes', label: '문장 노트', icon: '✎', shortcut: '4', create: createNotesView },
  { id: 'materials', label: '학습 자료', icon: '▦', shortcut: '5', create: createMaterialsView },
  { id: 'share', label: '공유하기', icon: '⇪', shortcut: '6', create: createShareView },
  { id: 'settings', label: '설정', icon: '⚙', shortcut: '7', create: createSettingsView },
];

const WINDOW_METHOD = { minimize: 'minimize', maximize: 'toggleMaximize', close: 'close' };

const navButtons = new Map();
let activeView = null;
let activeViewId = null;
let rendering = false;
let persistedView = null;

function el(id) {
  return document.getElementById(id);
}

function isKnownView(viewId) {
  return VIEWS.some((item) => item.id === viewId);
}

function createNoticeView(title, message) {
  const element = h(
    'div',
    { class: 'view' },
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'card__head' }, h('div', { class: 'card__title', text: title })),
      h('div', { class: 'card__body stack' }, h('p', { class: 'small', text: message })),
    ),
  );
  return { element, update() {} };
}

function createErrorView(error) {
  const element = h(
    'div',
    { class: 'view' },
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'card__head' }, h('div', { class: 'card__title', text: '화면을 여는 중 문제가 발생했습니다.' })),
      h(
        'div',
        { class: 'card__body stack' },
        h('p', { class: 'small', text: errorMessage(error) }),
        h('button', {
          class: 'btn btn--primary',
          type: 'button',
          text: '다시 시도',
          onClick: () => {
            activeViewId = null;
            render(state.view);
          },
        }),
      ),
    ),
  );
  return { element, update() {} };
}

function renderNav() {
  const nav = el('nav');
  if (!nav) return;
  clear(nav);
  navButtons.clear();
  for (const item of VIEWS) {
    const button = h(
      'button',
      {
        class: 'nav__item',
        type: 'button',
        title: `${item.label} (Ctrl+${item.shortcut})`,
        dataset: { view: item.id },
        onClick: () => navigate(item.id),
      },
      h('span', { class: 'nav__icon', text: item.icon }),
      h('span', { class: 'nav__label', text: item.label }),
    );
    navButtons.set(item.id, button);
    nav.append(button);
  }
}

function setActiveNav(viewId) {
  for (const [id, button] of navButtons) button.classList.toggle('is-active', id === viewId);
}

function navigate(viewId) {
  const next = isKnownView(viewId) ? viewId : 'home';
  if (next === state.view) {
    render(next);
    return;
  }
  set({ view: next });
  void persistView(next);
}

async function persistView(viewId) {
  if (persistedView === viewId) return;
  persistedView = viewId;
  try {
    await api.settings.update({ lastView: viewId });
  } catch {
    // 마지막 화면 기억은 편의 기능이므로 실패해도 화면 동작을 막지 않는다.
  }
}

function render(viewId) {
  if (rendering) return;
  rendering = true;
  try {
    if (viewId !== activeViewId) {
      const previous = activeView;
      const definition = VIEWS.find((item) => item.id === viewId) ?? VIEWS[0];
      activeView = null;
      activeViewId = viewId;
      if (previous) {
        try {
          previous.destroy?.();
        } catch (error) {
          console.error('view destroy failed', error);
        }
      }
      let created;
      try {
        created = definition.create({ onNavigate: navigate });
      } catch (error) {
        console.error('view create failed', error);
        created = createErrorView(error);
      }
      activeView = created;
      const content = el('content');
      clear(content);
      if (created?.element) content.append(created.element);
      content.scrollTop = 0;
    }
    activeView?.update?.(state);
  } finally {
    rendering = false;
  }
}

function onStateChange(s) {
  setActiveNav(s.view);
  render(s.view);
}

function wireTitlebar() {
  const bar = el('titlebar');
  if (!bar) return;
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-window]');
    if (!button) return;
    const method = WINDOW_METHOD[button.dataset.window];
    const call = method ? api.window[method] : null;
    if (typeof call === 'function') call().catch(() => {});
  });
  bar.addEventListener('dblclick', (event) => {
    if (event.target.closest('.titlebar__controls')) return;
    api.window.toggleMaximize().catch(() => {});
  });
}

function wireShortcuts() {
  window.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    const item = VIEWS[Number(event.key) - 1];
    if (!item) return;
    event.preventDefault();
    navigate(item.id);
  });
}

function wireErrors() {
  window.addEventListener('error', (event) => {
    const message = event?.error?.message ?? event?.message ?? '알 수 없는 오류가 발생했습니다.';
    toast(`오류: ${message}`, { type: 'error', timeout: 7000 });
  });
  window.addEventListener('unhandledrejection', (event) => {
    toast(errorMessage(event.reason), { type: 'error', timeout: 7000 });
  });
}

async function boot() {
  renderNav();
  setActiveNav(state.view);
  wireTitlebar();
  wireShortcuts();
  wireErrors();

  const content = el('content');
  if (!content) return;

  if (!hasBridge) {
    activeViewId = 'no-bridge';
    activeView = createNoticeView('Electron 환경이 아닙니다', '이 화면은 데스크톱 앱에서만 동작합니다. 터미널에서 npm start 로 실행해 주세요.');
    clear(content);
    content.append(activeView.element);
    setActiveNav('');
    return;
  }

  clear(content);
  content.append(loadingState('앱을 준비하는 중입니다…'));

  try {
    await actions.loadInfo();
  } catch (error) {
    toast(errorMessage(error), { type: 'error', timeout: 8000 });
  }

  actions.wireUpdateEvents();
  try {
    await actions.loadUpdateState();
  } catch {
    // 업데이트 정보를 못 읽어도 앱 사용에는 문제가 없다.
  }

  const params = new URLSearchParams(window.location.search);
  const demoFlag = params.get('demo') === '1';
  if (demoFlag) set({ demo: true });

  const savedView = state.settings?.lastView;
  if (isKnownView(savedView)) set({ view: savedView });

  subscribe(onStateChange);
  clear(content);
  activeViewId = null;
  render(state.view);
  setActiveNav(state.view);
  persistedView = state.view;

  try {
    await Promise.all([actions.loadChannels(), actions.loadSentences()]);
  } catch (error) {
    toast(errorMessage(error), { type: 'error', timeout: 7000 });
  }

  if (demoFlag && !(state.info?.counts?.channels ?? 0)) {
    try {
      await actions.seedDemo(false);
    } catch (error) {
      toast(errorMessage(error), { type: 'error', timeout: 7000 });
    }
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
