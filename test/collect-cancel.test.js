const test = require('node:test');
const assert = require('node:assert/strict');

const net = require('../main/collect/net');
const jobs = require('../main/collect/job-registry');
const manager = require('../main/collect/ytdlp-manager');

function abortError() {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

test('job-registry 가 취소 신호를 만들고 즉시 중단한다', () => {
  const jobId = 'job-test-1';
  const controller = jobs.begin(jobId);
  assert.equal(controller.signal.aborted, false);
  assert.equal(jobs.isCancelled(jobId), false);
  jobs.assertNotCancelled(jobId);

  assert.equal(jobs.cancel(jobId), true);
  assert.equal(controller.signal.aborted, true);
  assert.equal(jobs.isCancelled(jobId), true);
  assert.throws(() => jobs.assertNotCancelled(jobId), (error) => error.code === 'CANCELLED');

  jobs.end(jobId);
  assert.equal(jobs.isCancelled(jobId), false);
  assert.equal(jobs.activeCount(), 0);
});

test('취소가 먼저 요청된 job 은 시작하자마자 끊긴다', () => {
  const jobId = 'job-test-2';
  jobs.cancel(jobId);
  const controller = jobs.begin(jobId);
  assert.equal(controller.signal.aborted, true);
  jobs.end(jobId);
  assert.equal(jobs.activeCount(), 0);
});

test('net.fetchText 가 취소 신호를 즉시 반영한다', async () => {
  const original = global.fetch;
  let called = 0;
  try {
    const pre = new AbortController();
    pre.abort();
    global.fetch = () => {
      called += 1;
      return Promise.reject(new Error('취소된 요청은 전송되면 안 됩니다.'));
    };
    await assert.rejects(
      () => net.fetchText('https://example.com', { signal: pre.signal }),
      (error) => error.code === 'CANCELLED',
    );
    assert.equal(called, 0);

    const controller = new AbortController();
    global.fetch = (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(abortError()), { once: true });
    });
    const pending = net.fetchText('https://example.com', { signal: controller.signal, retries: 3 });
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(() => pending, (error) => error.code === 'CANCELLED');
  } finally {
    global.fetch = original;
  }
});

test('net.fetchText 는 취소가 아니면 기존처럼 재시도한다', async () => {
  const original = global.fetch;
  let called = 0;
  global.fetch = () => {
    called += 1;
    return Promise.reject(new Error('boom'));
  };
  try {
    await assert.rejects(
      () => net.fetchText('https://example.com', { retries: 1 }),
      /네트워크 요청 실패/,
    );
    assert.equal(called, 2);
  } finally {
    global.fetch = original;
  }
});

test('ytdlp-manager.run 이 취소되면 자식 프로세스를 즉시 종료한다', async () => {
  const controller = new AbortController();
  const started = Date.now();
  const pending = manager.run(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
    timeoutMs: 60000,
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 150);
  await assert.rejects(() => pending, (error) => error.code === 'CANCELLED');
  assert.ok(Date.now() - started < 20000, '취소는 시간 초과를 기다리지 않고 즉시 끝나야 합니다.');
});

test('ytdlp-manager.run 이 이미 취소된 신호면 실행하지 않는다', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => manager.run(process.execPath, ['-e', 'console.log(1)'], { signal: controller.signal }),
    (error) => error.code === 'CANCELLED',
  );
});