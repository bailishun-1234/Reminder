/* ============================================
   confirm-dialog.js — 语音识别确认弹窗
   零依赖
   ============================================ */

/**
 * 显示语音识别确认弹窗
 * @param {string} rawText - 识别到的原始文本
 * @param {Object} parsed - time.js 解析结果 { time, text }
 * @returns {Promise<{confirmed: boolean, text: string, time: number|null}>}
 */
export function showConfirmDialog(rawText, parsed) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('confirmDialog');
    const textEl = document.getElementById('confirmText');
    const timeInput = document.getElementById('confirmTime');
    const clearBtn = document.getElementById('clearTimeBtn');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    // 设置文本
    textEl.textContent = parsed.text || rawText;

    // 设置时间
    if (parsed.time) {
      timeInput.value = toDatetimeLocal(parsed.time);
      timeInput.dataset.originalTime = parsed.time;
    } else {
      // 默认建议：1小时后
      const suggested = Date.now() + 3600000;
      timeInput.value = toDatetimeLocal(suggested);
      timeInput.dataset.originalTime = '';
    }

    // 清除时间 → 待排期
    clearBtn.onclick = () => {
      timeInput.value = '';
      timeInput.dataset.originalTime = '';
    };

    overlay.classList.remove('hidden');

    okBtn.onclick = () => {
      let finalTime = null;
      if (timeInput.value) {
        finalTime = new Date(timeInput.value).getTime();
      }
      overlay.classList.add('hidden');
      resolve({
        confirmed: true,
        text: textEl.textContent,
        time: finalTime
      });
    };

    cancelBtn.onclick = () => {
      overlay.classList.add('hidden');
      resolve({ confirmed: false });
    };

    // 点击遮罩层可取消
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
        resolve({ confirmed: false });
      }
    });
  });
}

function toDatetimeLocal(ts) {
  const d = new Date(ts);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}
