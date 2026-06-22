import os
import logging

from flask import Flask, render_template, request, jsonify
from transformers import AutoTokenizer, AutoModelForCausalLM  # type: ignore[import-untyped]
import torch  # type: ignore[import-untyped]

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────
app = Flask(__name__)

# ── Model ──────────────────────────────────────────────────────────────────────
MODEL_NAME   = "gpt2"
MAX_CTX      = 1024          # GPT-2 hard context-window limit

_tokenizer   = None
_model       = None


def get_model():
    """
    Lazy-load the model and tokenizer on first use.
    This is safe whether the app is started with 'python app.py'
    or served through a WSGI runner (gunicorn, waitress, etc.).
    """
    global _tokenizer, _model
    if _tokenizer is None or _model is None:
        logger.info("Loading GPT-2 model and tokenizer (first request)…")
        # AutoTokenizer / AutoModelForCausalLM are the recommended modern API
        _tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        _model     = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
        _model.eval()
        logger.info("Model ready.")
    return _tokenizer, _model


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    """Serve the main HTML page."""
    return render_template("index.html")


@app.route("/generate", methods=["POST"])
def generate():
    """
    POST /generate — generate text with GPT-2.

    Request JSON:
        {
            "prompt":      "Your text here",   # required
            "max_length":  100,                 # optional  (new tokens, 10–300)
            "temperature": 1.0,                 # optional  (0.1–2.0)
            "top_k":       50,                  # optional  (1–100)
            "top_p":       0.95                 # optional  (0.1–1.0)
        }

    Response JSON (200):
        { "generated_text": "…", "prompt": "…", "tokens_generated": 87 }

    Error JSON (400 / 500):
        { "error": "…" }
    """
    # ── 1. Parse request ───────────────────────────────────────────────────────
    try:
        data = request.get_json(force=True, silent=True)
    except Exception:
        data = None

    if not data or not isinstance(data, dict):
        return jsonify({"error": "Request body must be valid JSON."}), 400

    if "prompt" not in data:
        return jsonify({"error": "Missing required field: 'prompt'."}), 400

    prompt = str(data["prompt"]).strip()
    if not prompt:
        return jsonify({"error": "Prompt cannot be empty."}), 400

    # ── 2. Validate & clamp parameters ────────────────────────────────────────
    try:
        max_new_tokens = int(data.get("max_length", 100))
        temperature    = float(data.get("temperature", 1.0))
        top_k          = int(data.get("top_k", 50))
        top_p          = float(data.get("top_p", 0.95))
    except (TypeError, ValueError) as exc:
        return jsonify({"error": f"Invalid parameter type: {exc}"}), 400

    # Clamp to safe ranges
    max_new_tokens = max(10, min(max_new_tokens, 300))
    temperature    = max(0.1, min(temperature, 2.0))   # must be > 0 for PyTorch
    top_k          = max(1,   min(top_k, 100))
    top_p          = max(0.1, min(top_p, 1.0))

    # ── 3. Load model (lazy, thread-safe for single-worker Flask) ─────────────
    try:
        tokenizer, model = get_model()
    except Exception as exc:
        logger.error("Model loading failed: %s", exc, exc_info=True)
        return jsonify({"error": "Model could not be loaded. Check server logs."}), 500

    # ── 4. Tokenise & guard context window ────────────────────────────────────
    try:
        inputs       = tokenizer.encode(prompt, return_tensors="pt")
        input_length = inputs.shape[1]

        # Ensure prompt + new tokens don't exceed the model's context window
        if input_length >= MAX_CTX:
            return jsonify({
                "error": (
                    f"Prompt is too long ({input_length} tokens). "
                    f"Please shorten it to under {MAX_CTX} tokens."
                )
            }), 400

        # Cap so total never exceeds MAX_CTX
        safe_max = min(input_length + max_new_tokens, MAX_CTX)

        logger.info(
            "Generating: prompt=%d tokens, max_new=%d, temp=%.2f, k=%d, p=%.2f",
            input_length, max_new_tokens, temperature, top_k, top_p,
        )

    except Exception as exc:
        logger.error("Tokenisation error: %s", exc, exc_info=True)
        return jsonify({"error": "Failed to tokenise the prompt."}), 500

    # ── 5. Generate ────────────────────────────────────────────────────────────
    try:
        with torch.no_grad():
            output_ids = model.generate(
                inputs,
                max_length          = safe_max,
                num_return_sequences= 1,
                do_sample           = True,        # required for temp / top-k / top-p
                temperature         = temperature,
                top_k               = top_k,
                top_p               = top_p,
                pad_token_id        = tokenizer.eos_token_id,
                repetition_penalty  = 1.2,
            )
    except Exception as exc:
        logger.error("Generation error: %s", exc, exc_info=True)
        return jsonify({"error": "Text generation failed. Check server logs."}), 500

    # ── 6. Decode — return only newly generated tokens ────────────────────────
    generated_ids  = output_ids[0][input_length:]
    generated_text = tokenizer.decode(generated_ids, skip_special_tokens=True).strip()
    tokens_generated = len(generated_ids)

    logger.info("Done — %d new tokens generated.", tokens_generated)

    return jsonify({
        "generated_text":  generated_text,
        "prompt":          prompt,
        "tokens_generated": tokens_generated,
    })


# ── Entry Point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Eagerly load the model when running directly so the first request is fast
    get_model()
    port = int(os.environ.get("PORT", 5000))
    logger.info("Starting Flask on port %d …", port)
    app.run(host="0.0.0.0", port=port, debug=False)
