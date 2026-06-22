# GPT-2 Text Generator 🚀

A production-ready AI-powered text generation web application built with **Flask** and **GPT-2** via Hugging Face Transformers. Enter a prompt and watch the model creatively continue your text — all running locally on your machine.

---

## ✨ Features

| Feature | Details |
|---|---|
| **AI Model** | GPT-2 (124M parameters) via Hugging Face |
| **Backend** | Python · Flask REST API |
| **Frontend** | HTML5 · Vanilla CSS · Vanilla JavaScript |
| **Dark / Light Mode** | Toggle + persisted in localStorage |
| **Advanced Controls** | Temperature, Top-K, Top-P, Max Tokens (sliders) |
| **UX** | Typewriter effect, loading spinner, copy-to-clipboard, character counter |
| **Responsive** | Mobile-first, works on all screen sizes |

---

## 📁 Project Structure

```
GPT2-WebApp/
│
├── app.py                  # Flask backend — model loading & /generate endpoint
├── requirements.txt        # Python dependencies
│
├── templates/
│   └── index.html          # Jinja2 HTML template (served by Flask)
│
└── static/
    ├── style.css           # All styles (dark mode, glassmorphism, animations)
    └── script.js           # Client-side logic (fetch, UI state, theme, copy)
```

---

## ⚙️ Prerequisites

- **Python 3.9+** (3.10 or 3.11 recommended)
- **pip** package manager
- Internet access on first run (to download the GPT-2 model weights ~500 MB)

---

## 🛠️ Installation & Setup

### 1. Navigate to the project folder

```powershell
cd GPT2-WebApp
```

### 2. (Recommended) Create a virtual environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1      # Windows PowerShell
# source venv/bin/activate       # macOS / Linux
```

### 3. Install dependencies

```powershell
pip install -r requirements.txt
```

> **Note:** PyTorch will be installed as a CPU-only build by default.  
> For GPU (CUDA) acceleration, visit [pytorch.org/get-started](https://pytorch.org/get-started/locally/) and install the appropriate CUDA build first.

---

## ▶️ Running the Application

```powershell
python app.py
```

You will see output similar to:

```
INFO:__main__:Loading GPT-2 model and tokenizer...
INFO:__main__:Model loaded successfully.
 * Running on http://0.0.0.0:5000
```

> The **first run** downloads the GPT-2 model (~500 MB). Subsequent runs use the cached model and start in seconds.

---

## 🌐 Accessing the App

Open your browser and navigate to:

```
http://localhost:5000
```

---

## 🔌 API Reference

### `GET /`
Serves the main HTML interface.

---

### `POST /generate`

Generates text continuation for a given prompt.

**Request body (JSON):**

```json
{
  "prompt":      "Once upon a time",   // required
  "max_length":  100,                   // optional (default: 100, range: 20–300)
  "temperature": 1.0,                   // optional (default: 1.0, range: 0.1–2.0)
  "top_k":       50,                    // optional (default: 50,  range: 1–100)
  "top_p":       0.95                   // optional (default: 0.95, range: 0.1–1.0)
}
```

**Success response (200):**

```json
{
  "generated_text":  "… the forest was quiet …",
  "prompt":          "Once upon a time",
  "tokens_generated": 87
}
```

**Error response (400 / 500):**

```json
{
  "error": "Missing 'prompt' in request body."
}
```

**cURL example:**

```bash
curl -X POST http://localhost:5000/generate \
     -H "Content-Type: application/json" \
     -d '{"prompt": "The future of AI is"}'
```

---

## 🎛️ Generation Parameters Explained

| Parameter | Effect |
|---|---|
| **Max New Tokens** | Controls how many new tokens the model generates |
| **Temperature** | `< 1.0` = more focused/repetitive; `> 1.0` = more creative/random |
| **Top-K** | Sample only from the top-K most likely next tokens |
| **Top-P** | Nucleus sampling — use smallest set of tokens whose probability sums to P |

---

## 🐛 Troubleshooting

| Symptom | Fix |
|---|---|
| `ModuleNotFoundError: transformers` | Run `pip install -r requirements.txt` inside the venv |
| App starts but generation is very slow | Normal on CPU; first request may take 10–30 s |
| `Address already in use` | Change port: `set PORT=5001` then re-run `python app.py` |
| Model download fails | Check internet connection; model caches to `~/.cache/huggingface/` |
| PowerShell script execution error | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |

---

## 📄 License

This project is released under the **MIT License**.  
GPT-2 is provided by OpenAI and available on Hugging Face under the [Modified MIT License](https://huggingface.co/openai-community/gpt2).
