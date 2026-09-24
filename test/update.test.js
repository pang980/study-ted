const test = require('node:test');
const assert = require('node:assert/strict');
const updater = require('../main/update');

test('parseVersion 이 v 접두사와 자리 수 부족을 처리한다', () => {
  assert.deepEqual(updater.parseVersion('1.2.3'), [1, 2, 3]);
  assert.deepEqual(updater.parseVersion('v1.2.3'), [1, 2, 3]);
  assert.deepEqual(updater.parseVersion('1.2'), [1, 2, 0]);
  assert.deepEqual(updater.parseVersion('2'), [2, 0, 0]);
  assert.deepEqual(updater.parseVersion('1.2.3-beta.1'), [1, 2, 3]);
  assert.equal(updater.parseVersion(''), null);
  assert.equal(updater.parseVersion('latest'), null);
});

test('isNewer 가 버전을 숫자로 비교한다', () => {
  assert.equal(updater.isNewer('1.0.1', '1.0.0'), true);
  assert.equal(updater.isNewer('1.1.0', '1.0.9'), true);
  assert.equal(updater.isNewer('2.0.0', '1.9.9'), true);
  assert.equal(updater.isNewer('1.0.0', '1.0.0'), false);
  assert.equal(updater.isNewer('0.9.9', '1.0.0'), false);
  assert.equal(updater.isNewer('1.0.0', '1.0.1'), false);
  assert.equal(updater.isNewer('1.10.0', '1.9.0'), true);
});

test('isNewer 가 잘못된 값이면 false 를 돌려준다', () => {
  assert.equal(updater.isNewer('', '1.0.0'), false);
  assert.equal(updater.isNewer('next', '1.0.0'), false);
  assert.equal(updater.isNewer('1.0.1', 'dev'), false);
});