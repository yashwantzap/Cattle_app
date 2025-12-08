# server.py
import os
import time
import base64
import re
import numpy as np
from io import BytesIO
from datetime import datetime
from flask import Flask, request, jsonify, session, send_from_directory, render_template, redirect, url_for
from flask_session import Session
from werkzeug.utils import secure_filename
from PIL import Image
import tensorflow as tf
import pandas as pd
import requests

# --- configuration ---
UPLOAD_FOLDER = os.path.abspath("uploaded_images")
TEXT_FOLDER = os.path.abspath("image_metadata")
ALLOWED_EXT = {"png", "jpg", "jpeg"}
MAX_CONTENT_LENGTH = 200 * 1024 * 1024  # 200MB
SECRET_KEY = os.environ.get("APP_SECRET_KEY", "replace_this_with_a_real_secret")

# Authentication placeholders copied from your app.py
AUTH_KEY = "cELBFvFWvdBvI2nmvL8y"
AUTH_TOKEN = "T1CfsWQocREEKnmiI6UOFWXWjkVQcCp0lzJAHkxs"

# Model/paths: keep your original paths or update them
# NOTE: adjust these paths if models live elsewhere
AUTOENCODER_PATH = r"D:\CHMI Version 1\cow_autoencoder_flex.tflite"
TFLITE_MODELS_FMD = {
    "v2b0": r"D:/CHMI Version 1/FMD New Models/EfficientNetV2B0_model.tflite",
    "v2s":  r"D:/CHMI Version 1/FMD New Models/EfficientNetV2S_model.tflite",
    "vgg16":r"D:/CHMI Version 1/FMD New Models/VGG16_model.tflite",
    "resnet50": r"D:/CHMI Version 1/FMD New Models/ResNet50_model.tflite",
    "b0": r"D:/CHMI Version 1/FMD New Models/EfficientNetB0_model.tflite"
}
TFLITE_MODELS_LSD = {
    "v2b0": r"D:/CHMI Version 1/LSDEfficientNetV2B0.tflite",
    "v2s": r"D:/CHMI Version 1/LSDEfficientNetV2S.tflite",
    "vgg16": r"D:/CHMI Version 1/LSDVGG16.tflite",
    "resnet50": r"D:/CHMI Version 1/LSDResNet50.tflite",
    "b0": r"D:/CHMI Version 1/LSDEfficientNetB0.tflite"
}
MODEL_WEIGHTS = {
    "v2b0": 0.2,
    "v2s": 0.5,
    "vgg16": 1.5,
    "resnet50": 0.5,
    "b0": 0.3
}
CLASS_NAMES = ["Diseased", "Healthy"]
CATEGORIES = ["FMD-Knuckles", "FMD-Mouth","Healthy-Foot","Healthy-Muzzle"]

IMAGE_SIZE = (224, 224)
STRICT_THRESHOLD = 0.005
SMOOTH_THRESHOLD = 0.0075
THRESHOLD = STRICT_THRESHOLD

# ensure folders exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TEXT_FOLDER, exist_ok=True)

# load lookup CSVs (same as your streamlit app)
df_villages = pd.read_csv(r"veternary_doctors.csv")
df_mandals  = pd.read_csv(r"gopalamitra.csv")
df_districts= pd.read_csv(r"districts.csv")

# --- helpers copied / adapted from your app.py ---
def send_otp_sms(phone, otp):
    message = f"User Admin login OTP is {otp} - SMSCOU"
    credentials = f"{AUTH_KEY}:{AUTH_TOKEN}"
    encoded_credentials = base64.b64encode(credentials.encode()).decode()
    url = f"https://restapi.smscountry.com/v0.1/Accounts/{AUTH_KEY}/SMSes/"
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": f"Basic {encoded_credentials}"
    }
    payload = {
        "Text": message,
        "Number": phone,
        "SenderId": "SMSCOU",
        "DRNotifyUrl": "https://www.domainname.com/notifyurl",
        "Tool": "API"
    }
    try:
        response = requests.post(url, data=payload, headers=headers, timeout=10)
        if response.status_code == 202:
            return True, "OTP sent successfully!"
        else:
            return False, f"Failed to send OTP. Response: {response.text}"
    except Exception as e:
        return False, f"Error sending OTP: {e}"

def generate_otp():
    return str(np.random.randint(100000, 999999))

def is_valid_mobile(mobile):
    pattern = re.compile(r"^\d{10}$")
    return pattern.match(mobile)

def normalize_probs(probs):
    return probs / np.sum(probs)

def load_tflite_interpreters(model_paths):
    interpreters = {}
    for name, path in model_paths.items():
        if not os.path.exists(path):
            # skip missing; log
            print(f"Model path not found: {path}")
            continue
        interpreter = tf.lite.Interpreter(model_path=path)
        interpreter.allocate_tensors()
        interpreters[name] = interpreter
    return interpreters

def run_tflite_inference(interpreter, input_details, output_details, input_data):
    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    return interpreter.get_tensor(output_details[0]['index'])

def reconstruction_error_tflite(img_array, reconstructed_array):
    return np.mean((img_array - reconstructed_array) ** 2)

def analyze_single_image_tflite_for_relevance(uploaded_file_stream, autoencoder_interpreter, threshold=THRESHOLD):
    # Similar to your analyze_single_image: returns dict with 'error' & 'accepted'
    image = Image.open(uploaded_file_stream).convert("RGB").resize(IMAGE_SIZE)
    img_array = np.array(image).astype("float32") / 255.0
    input_data = np.expand_dims(img_array, axis=0)
    output = run_tflite_inference(autoencoder_interpreter, autoencoder_interpreter.get_input_details(), autoencoder_interpreter.get_output_details(), input_data)
    error = reconstruction_error_tflite(input_data, output)
    return {"error": float(error), "accepted": error < threshold}

def soft_voting_ensemble(interpreters, image_array, weights, class_names):
    total_weighted_probs = np.zeros(len(class_names))
    for name, interpreter in interpreters.items():
        input_data = np.expand_dims(image_array, axis=0).astype(np.float32)
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()
        probs = interpreter.get_tensor(output_details[0]['index'])[0]
        normalized = normalize_probs(probs)
        weighted = weights.get(name, 0) * normalized
        total_weighted_probs += weighted
    final_probs = total_weighted_probs / max(sum(weights.values()), 1e-6)
    if len(class_names) == 4:
        group1 = float(final_probs[0] + final_probs[1])
        group2 = float(final_probs[2] + final_probs[3])
        if group1 >= group2:
            return group1, "Diseased"
        else:
            return group2, "Healthy"
    pred_index = int(np.argmax(final_probs))
    return float(final_probs[pred_index]), class_names[pred_index]

# --- load autoencoder interpreter (for relevance check) ---
autoencoder_interpreter = None
if os.path.exists(AUTOENCODER_PATH):
    try:
        autoencoder_interpreter = tf.lite.Interpreter(model_path=AUTOENCODER_PATH)
        autoencoder_interpreter.allocate_tensors()
    except Exception as e:
        print("Failed to load autoencoder:", e)
else:
    print("Autoencoder path not found:", AUTOENCODER_PATH)

# --- Flask app ---
app = Flask(__name__, static_folder="static", template_folder="templates")
app.config["SECRET_KEY"] = SECRET_KEY
app.config["SESSION_TYPE"] = "filesystem"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
Session(app)

# === Routes ===

@app.route("/")
def index():
    # serve main page
    return render_template("index.html")

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)

@app.route("/api/submit_user_info", methods=["POST"])
def submit_user_info():
    data = request.json or {}
    name = data.get("name", "").strip()
    mobile = data.get("mobile", "").strip()
    village = data.get("village", "").strip()
    mandal = data.get("mandal", "").strip()
    district = data.get("district", "").strip()

    errors = []
    if not name:
        errors.append("Name is required.")
    if not is_valid_mobile(mobile):
        errors.append("Valid 10-digit Mobile Number is required.")
    if village in ("", "Select"):
        errors.append("Village is required.")
    if mandal in ("", "Select"):
        errors.append("Mandal is required.")
    if district in ("", "Select"):
        errors.append("District is required.")
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    session["user_details"] = {
        "name": name, "mobile": mobile, "village": village, "mandal": mandal, "district": district
    }

    now = time.time()
    # rate limit resend
    if session.get("otp_sent_at") and (now - session["otp_sent_at"]) < 15:
        wait = int(15 - (now - session["otp_sent_at"]))
        return jsonify({"ok": False, "errors": [f"Please wait {wait}s before requesting another OTP."]}), 429

    otp = generate_otp()
    success, msg = send_otp_sms(mobile, otp)
    if success:
        session["otp_code"] = otp
        session["otp_sent_at"] = now
        session["disable_otp_request_until"] = now + 15
        session["otp_verified"] = False
        return jsonify({"ok": True, "message": "OTP sent successfully."})
    else:
        return jsonify({"ok": False, "errors": [msg]}), 500

@app.route("/api/verify_otp", methods=["POST"])
def verify_otp():
    payload = request.json or {}
    otp_input = (payload.get("otp") or "").strip()
    if otp_input == "":
        return jsonify({"ok": False, "error": "Please enter the OTP."}), 400
    if otp_input == session.get("otp_code"):
        session["otp_verified"] = True
        return jsonify({"ok": True, "message": "OTP verified."})
    return jsonify({"ok": False, "error": "Invalid OTP."}), 400

@app.route("/api/resend_otp", methods=["POST"])
def resend_otp():
    user = session.get("user_details")
    if not user:
        return jsonify({"ok": False, "error": "User info missing."}), 400
    now = time.time()
    if session.get("disable_otp_request_until", 0) - now > 0:
        remaining = int(session["disable_otp_request_until"] - now)
        return jsonify({"ok": False, "error": f"Please wait {remaining}s before resending OTP."}), 429
    otp = generate_otp()
    success, msg = send_otp_sms(user["mobile"], otp)
    if success:
        session["otp_code"] = otp
        session["otp_sent_at"] = now
        session["disable_otp_request_until"] = now + 15
        return jsonify({"ok": True, "message": msg})
    return jsonify({"ok": False, "error": msg}), 500

@app.route("/api/submit_cattle", methods=["POST"])
def submit_cattle():
    """Saves cattle details to the user session."""
    payload = request.json or {}
    cattle_id = payload.get("cattle_id", "").strip()
    gender = payload.get("gender", "").strip()
    
    # Improved age handling and validation
    try:
        age = float(payload.get("age"))
    except (ValueError, TypeError):
        return jsonify({"ok": False, "error": "Please provide a valid numeric age."}), 400

    if not cattle_id or not gender or age is None:
        return jsonify({"ok": False, "error": "Please provide all cattle details."}), 400
        
    session["cattle_details"] = {"cattle_id": cattle_id, "gender": gender, "age": age}
    return jsonify({"ok": True, "message": "Cattle details saved successfully to your profile."})

@app.route("/api/predict", methods=["POST"])
def predict():
    # Expects form-data: disease_type, file
    disease_type = request.form.get("disease_type", "")
    user = session.get("user_details", {})
    cattle = session.get("cattle_details", {})
    if not user or not cattle:
        return jsonify({"ok": False, "error": "Missing user or cattle details."}), 400

    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No file uploaded."}), 400
    file = request.files["file"]
    filename = secure_filename(file.filename)
    if filename == "":
        return jsonify({"ok": False, "error": "Invalid filename."}), 400
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXT:
        return jsonify({"ok": False, "error": "Unsupported file type."}), 400

    # Check relevance with autoencoder (if available)
    if autoencoder_interpreter:
        # Need to copy stream because we will consume it
        file_stream_for_check = BytesIO(file.read())
        file_stream_for_check.seek(0)
        try:
            relevance = analyze_single_image_tflite_for_relevance(file_stream_for_check, autoencoder_interpreter)
        except Exception as e:
            return jsonify({"ok": False, "error": f"Relevance check failed: {e}"}), 500
        if not relevance.get("accepted", False):
            return jsonify({"ok": False, "warning": "Irrelevant or low-quality image detected. Try a clearer image.", "error_details": relevance}), 400
        # reset original file pointer for saving / inference
        file_stream_for_check.seek(0)
        file_bytes = file_stream_for_check.read()
        image_to_open = BytesIO(file_bytes)
    else:
        # no autoencoder: just read bytes
        file_bytes = file.read()
        image_to_open = BytesIO(file_bytes)

    # Prepare for model ensemble
    if "LSD" in disease_type:
        model_dict = TFLITE_MODELS_LSD
        disease_code = "LSD"
        class_list = CLASS_NAMES
    else:
        model_dict = TFLITE_MODELS_FMD
        disease_code = "FMD"
        class_list = CATEGORIES

    interpreters = load_tflite_interpreters(model_dict)
    if not interpreters:
        return jsonify({"ok": False, "error": "No models available for inference. Check model paths."}), 500

    # Preprocess image
    image = Image.open(image_to_open).convert("RGB").resize(IMAGE_SIZE)
    image_array = np.array(image).astype("float32")

    # run ensemble
    try:
        probs, predicted_label = soft_voting_ensemble(interpreters, image_array, MODEL_WEIGHTS, class_list)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Inference error: {e}"}), 500

    confidence = float(probs) * 100.0

    # save image + metadata if high confidence
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    ext = filename.rsplit(".", 1)[-1]
    image_filename = f"{timestamp}.{ext}"
    image_path = os.path.join(app.config["UPLOAD_FOLDER"], image_filename)
    image = Image.open(BytesIO(file_bytes))
    image.save(image_path)

    text_filename = f"{timestamp}.txt"
    text_path = os.path.join(TEXT_FOLDER, text_filename)
    with open(text_path, "w", encoding="utf-8") as txt_file:
        txt_file.write("=== User Details ===\n")
        txt_file.write(f"Name     : {user.get('name','N/A')}\n")
        txt_file.write(f"Mobile   : {user.get('mobile','N/A')}\n")
        txt_file.write(f"Village  : {user.get('village','N/A')}\n")
        txt_file.write(f"Mandal   : {user.get('mandal','N/A')}\n")
        txt_file.write(f"District : {user.get('district','N/A')}\n\n")
        txt_file.write("=== Cattle Details ===\n")
        txt_file.write(f"Cattle ID : {cattle.get('cattle_id')}\n")
        txt_file.write(f"Gender    : {cattle.get('gender')}\n")
        txt_file.write(f"Age       : {cattle.get('age')} years\n\n")
        txt_file.write("=== Prediction Result ===\n")
        disease_status = f"{disease_code} Infected" if predicted_label == "Diseased" else "Healthy"
        txt_file.write(f"Status: {disease_status}\n\n")
        txt_file.write(f"Confidence: {confidence:.2f}%\n\n")
        txt_file.write(f"Image File: {image_filename}\n")

    # Prepare recommended vets/gopalamitra (mimic your earlier logic)
    vet_support = df_villages[df_villages["Place of working"].str.strip().str.lower() == user.get("village","").lower()]
    gopa_support = df_mandals[df_mandals["mandal"].str.strip().str.lower() == user.get("mandal","").lower()]
    vet_first = vet_support.iloc[0].to_dict() if not vet_support.empty else df_villages.iloc[0].to_dict()
    gopa_first = gopa_support.iloc[0].to_dict() if not gopa_support.empty else df_mandals.iloc[0].to_dict()

    response = {
        "ok": True,
        "predicted_label": predicted_label,
        "confidence": round(confidence, 2),
        "image_file": image_filename,
        "vet": {"name": vet_first.get("Name"), "place": vet_first.get("Place of working"), "mobile": vet_first.get("Mobile no.", vet_first.get("Mobile no"))},
        "gopa": {"name": gopa_first.get("Name"), "mandal": gopa_first.get("mandal"), "mobile": gopa_first.get("mobile no.", gopa_first.get("mobile no"))}
    }
    return jsonify(response)

if __name__ == "__main__":
    # development server
    app.run(host="0.0.0.0", port=8501, debug=True)