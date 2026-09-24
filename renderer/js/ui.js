export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset' && typeof value === 'object') Object.assign(el.dataset, value);
    else if (key === 'on' && typeof value === 'object') {
      for (const [event, handler] of Object.entries(value)) el.addEventListener(event, handler);
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'value') {
      el.value = value;
    } else {
      el.setAttribute(key, value === true ? '' : String(value));
    }
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(el) {
  el.replaceChildren();
  return el;
}

export function shorten(text, max = 60) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function initials(text) {
  const value = String(text ?? '').trim();
  return value ? value.slice(0, 1).toUpperCase() : '?';
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

export function formatDate(value) {
  if (!value) return '';
  const text = String(value).replace(' ', 'T');
  const date = new Date(text.length <= 10 ? `${text}T00:00:00` : text);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function debounce(fn, wait = 250) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function thumb({ title = '', thumbnailUrl = null, durationText = null, badge = null }) {
  const box = h('div', { class: 'thumb' });
  if (thumbnailUrl) {
    const img = h('img', { class: 'thumb__img', src: thumbnailUrl, alt: '', loading: 'lazy' });
    img.addEventListener('error', () => {
      img.replaceWith(h('div', { class: 'thumb__placeholder', text: shorten(title, 46) }));
    });
    box.append(img);
  } else {
    box.append(h('div', { class: 'thumb__placeholder', text: shorten(title, 46) }));
  }
  if (durationText) box.append(h('span', { class: 'badge thumb__time', text: durationText }));
  if (badge) box.append(h('span', { class: 'badge thumb__badge', text: badge }));
  return box;
}

export function emptyState(message, { icon = '📄', action = null } = {}) {
  const box = h('div', { class: 'empty' }, h('div', { class: 'empty__icon', text: icon }), h('p', { text: message }));
  if (action) box.append(action);
  return box;
}

export function loadingState(message = '불러오는 중입니다.') {
  return h('div', { class: 'empty' }, h('div', { class: 'spinner' }), h('p', { text: message }));
}

export function toast(message, { type = 'info', timeout = 3200 } = {}) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const el = h('div', { class: `toast toast--${type}`, text: message });
  stack.append(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    setTimeout(() => el.remove(), 180);
  }, timeout);
  return el;
}

export function openModal({ title, body, foot = null, onClose = null }) {
  const root = document.getElementById('modal-root');
  const close = () => {
    backdrop.remove();
    if (onClose) onClose();
  };
  const modal = h(
    'div',
    { class: 'modal' },
    h('div', { class: 'modal__head' }, h('span', { text: title }), h('button', { class: 'btn btn--subtle btn--sm', type: 'button', text: '✕', onClick: close })),
    h('div', { class: 'modal__body' }, body),
    foot ? h('div', { class: 'modal__foot' }, foot) : null,
  );
  const backdrop = h('div', {
    class: 'modal-backdrop',
    onClick: (event) => {
      if (event.target === backdrop) close();
    },
  }, modal);
  root.append(backdrop);
  return { close, modal };
}

export function confirmDialog({ title = '확인', message, confirmText = '확인', danger = false }) {
  return new Promise((resolve) => {
    // 닫기를 먼저 하면 onClose 가 resolve(false) 를 먼저 호출해 확인을 눌러도 취소로 처리된다.
    // 어떤 경로로 닫히든 처음 확정한 값 하나만 남긴다.
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const confirmBtn = h('button', {
      class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`,
      type: 'button',
      text: confirmText,
      onClick: () => {
        done(true);
        dialog.close();
      },
    });
    const dialog = openModal({
      title,
      body: h('p', { text: message, style: { lineHeight: '1.6' } }),
      foot: [
        h('button', {
          class: 'btn',
          type: 'button',
          text: '취소',
          onClick: () => {
            done(false);
            dialog.close();
          },
        }),
        confirmBtn,
      ],
      onClose: () => done(false),
    });
  });
}
