/**
 * GPT-2 Text Generator — script.js
 * Handles all client-side interactions:
 *   • Dark / Light theme toggle (persisted via localStorage)
 *   • Character counter for the prompt textarea
 *   • Advanced-settings sliders with live output labels
 *   • POST request to /generate with loading / result / error states
 *   • Copy-to-clipboard with toast notification
 *   • Regenerate button
 */

/* ── DOM References ──────────────────────────────────────────────────────── */
const html            = document.documentElement;
const themeToggle     = document.getElementById('themeToggle');
const themeIcon       = themeToggle.querySelector('.theme-icon');

const promptInput     = document.getElementById('promptInput');
const charCount       = document.getElementById('charCount');
const charCounter     = document.getElementById('charCounter');

const generateBtn     = document.getElementById('generateBtn');
const clearBtn        = document.getElementById('clearBtn');
const regenerateBtn   = document.getElementById('regenerateBtn');

const outputCard      = document.getElementById('outputCard');
const loadingState    = document.getElementById('loadingState');
const resultState     = document.getElementById('resultState');

const outputText      = document.getElementById('outputText');
const tokensBadge     = document.getElementById('tokensBadge');
const copyBtn         = document.getElementById('copyBtn');
const copyToast       = document.getElementById('copyToast');

const errorBanner     = document.getElementById('errorBanner');
const errorMessage    = document.getElementById('errorMessage');
const dismissError    = document.getElementById('dismissError');

// Advanced sliders
const sliders = [
  { slider: document.getElementById('maxLength'),   output: document.getElementById('maxLengthOutput'),   decimals: 0 },
  { slider: document.getElementById('temperature'), output: document.getElementById('temperatureOutput'), decimals: 1 },
  { slider: document.getElementById('topK'),        output: document.getElementById('topKOutput'),        decimals: 0 },
  { slider: document.getElementById('topP'),        output: document.getElementById('topPOutput'),        decimals: 2 },
];

/* ── Theme Management ────────────────────────────────────────────────────── */
const THEME_KEY = 'gpt2-theme';

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = html.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// Initialise theme: saved preference → system preference → dark
(function initTheme() {
  const saved  = localStorage.getItem(THEME_KEY);
  const system = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  applyTheme(saved || system);
})();

themeToggle.addEventListener('click', toggleTheme);

/* ── Character Counter ───────────────────────────────────────────────────── */
const MAX_CHARS = 500;

function updateCharCounter() {
  const len = promptInput.value.length;
  charCount.textContent = len;

  charCounter.classList.remove('warn', 'limit');
  if (len >= MAX_CHARS)        charCounter.classList.add('limit');
  else if (len >= MAX_CHARS * 0.8) charCounter.classList.add('warn');
}

promptInput.addEventListener('input', updateCharCounter);

/* ── Slider Live Labels ──────────────────────────────────────────────────── */
sliders.forEach(({ slider, output, decimals }) => {
  const update = () => {
    output.value = parseFloat(slider.value).toFixed(decimals);
    slider.setAttribute('aria-valuenow', slider.value);
  };
  slider.addEventListener('input', update);
  update(); // initialise
});

/* ── UI State Helpers ────────────────────────────────────────────────────── */
function showLoading() {
  outputCard.classList.remove('hidden');
  loadingState.classList.remove('hidden');
  resultState.classList.add('hidden');
  hideError();
  generateBtn.disabled = true;
  generateBtn.setAttribute('aria-busy', 'true');
}

function showResult(text, tokensGenerated) {
  loadingState.classList.add('hidden');
  resultState.classList.remove('hidden');

  // Animate text appearance character by character (typewriter effect)
  outputText.textContent = '';
  typewriterEffect(outputText, text, 12);

  tokensBadge.textContent = `${tokensGenerated} token${tokensGenerated !== 1 ? 's' : ''} generated`;
  generateBtn.disabled = false;
  generateBtn.removeAttribute('aria-busy');
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorBanner.classList.remove('hidden');
  loadingState.classList.add('hidden');
  resultState.classList.add('hidden');
  generateBtn.disabled = false;
  generateBtn.removeAttribute('aria-busy');

  // If the output card has nothing to show, hide it
  if (outputText.textContent === '') {
    outputCard.classList.add('hidden');
  }
}

function hideError() {
  errorBanner.classList.add('hidden');
}

/* ── Typewriter Effect ───────────────────────────────────────────────────── */
function typewriterEffect(element, text, speed = 15) {
  let i = 0;
  element.textContent = '';
  const timer = setInterval(() => {
    element.textContent += text.charAt(i);
    i++;
    if (i >= text.length) clearInterval(timer);
  }, speed);
}

/* ── Text Generation ─────────────────────────────────────────────────────── */
async function generateText() {
  const prompt = promptInput.value.trim();

  if (!prompt) {
    showError('Please enter a prompt before generating.');
    return;
  }

  // Collect advanced settings
  const payload = {
    prompt,
    max_length:  parseInt(document.getElementById('maxLength').value, 10),
    temperature: parseFloat(document.getElementById('temperature').value),
    top_k:       parseInt(document.getElementById('topK').value, 10),
    top_p:       parseFloat(document.getElementById('topP').value),
  };

  showLoading();

  try {
    const response = await fetch('/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      // Server returned an error JSON { error: "..." }
      throw new Error(data.error || `Server error: ${response.status}`);
    }

    if (!data.generated_text && data.generated_text !== '') {
      throw new Error('Unexpected response format from server.');
    }

    const generatedText = data.generated_text.trim();
    if (!generatedText) {
      throw new Error('The model returned empty output. Try a different prompt or increase Max New Tokens.');
    }

    showResult(generatedText, data.tokens_generated ?? 0);

  } catch (err) {
    if (err.name === 'TypeError') {
      // Network / fetch failure
      showError('Network error — make sure the Flask server is running on port 5000.');
    } else {
      showError(err.message || 'An unexpected error occurred.');
    }
    console.error('[GPT-2 Generator] Error:', err);
  }
}

/* ── Event Listeners ─────────────────────────────────────────────────────── */
generateBtn.addEventListener('click', generateText);

// Allow Ctrl+Enter to generate from the textarea
promptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    generateText();
  }
});

clearBtn.addEventListener('click', () => {
  promptInput.value = '';
  updateCharCounter();
  hideError();
  outputCard.classList.add('hidden');
  promptInput.focus();
});

regenerateBtn.addEventListener('click', () => {
  generateText();
});

dismissError.addEventListener('click', hideError);

/* ── Copy to Clipboard ───────────────────────────────────────────────────── */
let toastTimeout = null;

copyBtn.addEventListener('click', async () => {
  const text = outputText.textContent;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers without Clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // Show toast
  copyToast.classList.remove('hidden');
  copyBtn.querySelector('.copy-icon').textContent = '✅';
  copyBtn.textContent = '';
  copyBtn.innerHTML   = '<span class="copy-icon">✅</span> Copied!';

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    copyToast.classList.add('hidden');
    copyBtn.innerHTML = '<span class="copy-icon">📋</span> Copy';
  }, 2500);
});

/* ── Accessibility: announce card visibility ─────────────────────────────── */
const observer = new MutationObserver(() => {
  if (!outputCard.classList.contains('hidden')) {
    outputCard.setAttribute('tabindex', '-1');
    outputCard.focus({ preventScroll: false });
  }
});
observer.observe(outputCard, { attributes: true, attributeFilter: ['class'] });
