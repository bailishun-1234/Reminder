/* ============================================
   mic-button.js — 语音添加按钮
   按住录音，松手识别；单击弹出文本输入
   零依赖
   ============================================ */

import * as speech from '../speech.js';

export function setupMicButton(onResult) {
  const fab = document.getElementById('micFab');
  const fabIcon = fab.querySelector('.fab-icon');
  const textBar = document.getElementById('textInputBar');
  const textInput = document.getElementById('textInput');
  const textSubmit = document.getElementById('textSubmit');
  const textCancel = document.getElementById('textCancel');

  let pressTimer = null;
  let longPressFired = false;
  let speechPromise = null;     // 当前的语音识别 Promise
  let speechAborted = false;   // 标记语音被用户主动中止

  // --- 单击 → 文本输入（仅当不是长按时触发）---
  fab.addEventListener('click', () => {
    if (longPressFired) { longPressFired = false; return; }
    showTextInput();
  });

  // --- 长按 → 语音识别 ---
  function startLongPress() {
    longPressFired = true;
    fab.classList.add('recording');
    fabIcon.textContent = '🔴';
    tryVibrate(50);
    speechAborted = false;
    speechPromise = speech.startRecognition()
      .then(text => {
        speechPromise = null;
        if (text) onResult(text);
        // 语音成功 → 不弹文本输入
      })
      .catch(() => {
        speechPromise = null;
        if (!speechAborted) {
          // 语音失败且不是用户主动中止 → 回退到文本输入
          showTextInput();
        }
      });
  }

  fab.addEventListener('touchstart', () => {
    pressTimer = setTimeout(startLongPress, 200);
  }, { passive: true });

  fab.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
    pressTimer = null;
    // 立即恢复按钮外观
    fab.classList.remove('recording');
    fabIcon.textContent = '🎤';
    if (speechPromise) {
      speechAborted = true;
      speech.stopRecognition();
      speechPromise = null;
    }
  });

  fab.addEventListener('touchcancel', () => {
    clearTimeout(pressTimer);
    pressTimer = null;
    fab.classList.remove('recording');
    fabIcon.textContent = '🎤';
    if (speechPromise) {
      speechAborted = true;
      speech.stopRecognition();
      speechPromise = null;
    }
  });

  // 桌面端：mousedown/mouseup 模拟长按
  fab.addEventListener('mousedown', () => {
    pressTimer = setTimeout(startLongPress, 200);
  });

  fab.addEventListener('mouseup', () => {
    clearTimeout(pressTimer);
    pressTimer = null;
    fab.classList.remove('recording');
    fabIcon.textContent = '🎤';
    if (speechPromise) {
      speechAborted = true;
      speech.stopRecognition();
      speechPromise = null;
    }
  });

  fab.addEventListener('mouseleave', () => {
    clearTimeout(pressTimer);
    pressTimer = null;
    fab.classList.remove('recording');
    fabIcon.textContent = '🎤';
    if (speechPromise) {
      speechAborted = true;
      speech.stopRecognition();
      speechPromise = null;
    }
  });

  // --- 文本输入提交/取消 ---
  textSubmit.addEventListener('click', () => {
    submitText(textInput, textBar, fab, onResult);
  });

  textInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitText(textInput, textBar, fab, onResult);
    }
  });

  textCancel.addEventListener('click', () => {
    closeTextInput(textInput, textBar, fab);
  });

  // --- 辅助函数 ---
  function showTextInput() {
    fab.style.display = 'none';
    textBar.classList.remove('hidden');
    textInput.focus();
  }
}

function submitText(textInput, textBar, fab, onResult) {
  const text = textInput.value.trim();
  if (!text) return;
  onResult(text);
  textInput.value = '';
  closeTextInput(textInput, textBar, fab);
}

function closeTextInput(textInput, textBar, fab) {
  textInput.value = '';
  textBar.classList.add('hidden');
  fab.style.display = '';
}

function tryVibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
}
