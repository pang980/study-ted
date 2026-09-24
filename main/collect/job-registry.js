// 수집 작업(jobId) 단위로 취소 상태를 관리한다.
//
// - cancelled : 수집 루프가 매 반복마다 확인하는 플래그(즉시 반영)
// - controller: yt-dlp 같은 자식 프로세스나 긴 네트워크 대기를 즉시 끊는 AbortSignal
//
// 자막을 2000개 이상 받는 동안에는 한 개를 받는 데 최대 2~3분이 걸릴 수 있어서,
// 플래그만으로는 "정지"가 체감되지 않는다. 그래서 취소 요청과 동시에 AbortSignal 로
// 진행 중인 작업을 끊는다.
const cancelled = new Set();
const controllers = new Map();

function makeError(code, message, detail) {
  const error = new Error(message);
  error.code = code;
  if (detail) error.detail = detail;
  return error;
}

function begin(jobId) {
  if (!jobId) return null;
  let controller = controllers.get(jobId);
  if (!controller) {
    controller = new AbortController();
    controllers.set(jobId, controller);
  }
  // 시작하기 전에 이미 취소가 요청된 작업이면 바로 끊긴 상태로 만든다.
  if (cancelled.has(jobId) && !controller.signal.aborted) controller.abort();
  return controller;
}

function end(jobId) {
  if (!jobId) return;
  controllers.delete(jobId);
  cancelled.delete(jobId);
}

function cancel(jobId) {
  if (!jobId) return false;
  cancelled.add(jobId);
  const controller = controllers.get(jobId);
  if (controller && !controller.signal.aborted) controller.abort();
  return true;
}

function isCancelled(jobId) {
  return Boolean(jobId) && cancelled.has(jobId);
}

function signalOf(jobId) {
  const controller = controllers.get(jobId);
  return controller ? controller.signal : null;
}

function assertNotCancelled(jobId) {
  if (isCancelled(jobId)) throw makeError('CANCELLED', '사용자가 수집을 취소했습니다.');
}

function activeCount() {
  return controllers.size;
}

module.exports = { begin, end, cancel, isCancelled, signalOf, assertNotCancelled, activeCount, makeError };