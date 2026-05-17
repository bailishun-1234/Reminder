/* ============================================
   speech.js — 语音识别封装 (Web Speech API)
   零依赖
   ============================================ */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SUPPORTED = !!SpeechRecognition;

let recognition = null;

/**
 * 检查浏览器是否支持语音识别
 */
export function isSupported() {
  return SUPPORTED;
}

/**
 * 开始语音识别
 * @returns {Promise<string>} 识别到的文本
 */
export function startRecognition() {
  return new Promise((resolve, reject) => {
    if (!SUPPORTED) {
      reject(new Error('SPEECH_NOT_SUPPORTED'));
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = 'cmn-Hans-CN';   // 中文普通话
    recognition.continuous = false;      // 单次识别
    recognition.interimResults = true;   // 实时中间结果
    recognition.maxAlternatives = 1;

    let finalText = '';
    let timeoutId = null;

    // 自动结束: 用户停止说话 2 秒后自动结束
    function resetTimeout() {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (recognition) {
          try { recognition.stop(); } catch (e) { /* ignore */ }
        }
      }, 2000);
    }
    resetTimeout();

    recognition.onresult = (event) => {
      resetTimeout();
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalText += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      // Dispatch interim result for UI feedback
      window.dispatchEvent(new CustomEvent('speech-interim', {
        detail: { interim, final: finalText }
      }));
    };

    recognition.onend = () => {
      if (timeoutId) clearTimeout(timeoutId);
      recognition = null;
      if (finalText.trim()) {
        resolve(finalText.trim());
      } else {
        reject(new Error('SPEECH_NO_INPUT'));
      }
    };

    recognition.onerror = (event) => {
      if (timeoutId) clearTimeout(timeoutId);
      recognition = null;
      reject(new Error('SPEECH_ERROR_' + event.error));
    };

    try {
      recognition.start();
    } catch (e) {
      reject(new Error('SPEECH_START_FAILED'));
    }
  });
}

/**
 * 停止当前识别
 */
export function stopRecognition() {
  if (recognition) {
    try { recognition.stop(); } catch (e) { /* ignore */ }
    recognition = null;
  }
}
