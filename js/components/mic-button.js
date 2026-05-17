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
  let isRecording = false;
  let longPressFired = false;  // 标记长按已触发，阻止后续 click

  // --- 单击 → 文本输入（仅当不是长按时触发）---
  fab.addEventListener('click', () => {
    if (longPressFired) { longPressFired = false; return; }
    showTextInput();
  });

  // --- 长按 → 语音识别 ---
  fab.addEventListener('touchstart', () => {
    pressTimer = setTimeout(() => {
      longPressFired = true;
      isRecording = true;
      fab.classList.add('recording');
      fabIcon.textContent = '🔴';
      tryVibrate(50);
      doRecord(onResult);
    }, 200);
  }, { passive: true });

  fab.addEventListener('touchend', () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (isRecording) {
      speech.stopRecognition();
    }
  });

  fab.addEventListener('touchcancel', () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (isRecording) {
      speech.stopRecognition();
    }
  });

  // 桌面端：mousedown/mouseup 模拟长按
  fab.addEventListener('mousedown', (e) => {
    pressTimer = setTimeout(() => {
      longPressFired = true;
      isRecording = true;
      fab.classList.add('recording');
      fabIcon.textContent = '🔴';
      tryVibrate(50);
      doRecord(onResult);
    }, 200);
  });

  fab.addEventListener('mouseup', () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (isRecording) {
      speech.stopRecognition();
    }
  });

  fab.addEventListener('mouseleave', () => {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    if (isRecording) {
      speech.stopRecognition();
    }
  });

  // --- 语音识别 ---
  async function doRecord(onResult) {
    try {
      const text = await speech.startRecognition();
      finishRecording();
      if (text) {
        onResult(text);
      } else {
        showTextInput();
      }
    } catch (err) {
      finishRecording();
      showTextInput();
    }
  }

  function finishRecording() {
    isRecording = false;
    longPressFired = false;
    fab.classList.remove('recording');
    fabIcon.textContent = '🎤';
  }

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
