# server.py
import os
import time
import base64
import re
import numpy as np
import json
from io import BytesIO
from datetime import datetime
from flask import Flask, request, jsonify, session, send_from_directory, render_template, redirect, url_for
from flask_session import Session
from werkzeug.utils import secure_filename
from PIL import Image
import tensorflow as tf # RE-ENABLED
import pandas as pd
import requests
# import random # REMOVED: No longer needed for mock prediction

# --- configuration ---
UPLOAD_FOLDER = os.path.abspath("uploaded_images")
TEXT_FOLDER = os.path.abspath("image_metadata")
DATA_FOLDER = os.path.abspath("app_data")
USER_DATA_FILE = os.path.join(DATA_FOLDER, "user_data.json")

ALLOWED_EXT = {"png", "jpg", "jpeg"}
MAX_CONTENT_LENGTH = 200 * 1024 * 1024  # 200MB
SECRET_KEY = os.environ.get("APP_SECRET_KEY", "replace_this_with_a_real_secret")

# Authentication placeholders (Ensure these are correct)
AUTH_KEY = "cELBFvFWvdBvI2nmvL8y"
AUTH_TOKEN = "T1CfsWQocREEKnmiI6UOFWXWjkVQcCp0lzJAHkxs"

# Model/paths: ASSUMING THESE PATHS ARE CORRECT on your machine
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
os.makedirs(DATA_FOLDER, exist_ok=True)

# load lookup CSVs
df_villages = pd.read_csv(r"veternary_doctors.csv")
df_mandals  = pd.read_csv(r"gopalamitra.csv")
df_districts= pd.read_csv(r"districts.csv")

# --- Data Persistence Helpers ---
def load_user_data():
    """Loads all user data from the JSON file."""
    if not os.path.exists(USER_DATA_FILE) or os.path.getsize(USER_DATA_FILE) == 0:
        return []
    try:
        with open(USER_DATA_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading user data: {e}")
        return []

def save_user_data(data):
    """Saves all user data to the JSON file."""
    try:
        with open(USER_DATA_FILE, "w") as f:
            json.dump(data, f, indent=4)
        return True
    except Exception as e:
        print(f"Error saving user data: {e}")
        return False
        
def find_user(mobile, all_users):
    """Finds a user in the list by mobile number."""
    return next((user for user in all_users if user.get("mobile") == mobile), None)

# --- SMS Notification System (RE-ENABLED) ---
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
            if "invalid mobile number" in response.text.lower():
                 return False, "Failed to send OTP: Invalid mobile number for SMS gateway."
            return False, f"Failed to send OTP. Response: {response.text}"
    except Exception as e:
        return False, f"Error sending OTP: {e}"

def generate_otp():
    return str(np.random.randint(100000, 999999))

def is_valid_mobile(mobile):
    pattern = re.compile(r"^\d{10}$")
    return pattern.match(mobile)

# --- ML Model Helper Functions (RE-ENABLED) ---
def normalize_probs(probs):
    return probs / np.sum(probs)

def load_tflite_interpreters(model_paths):
    interpreters = {}
    for name, path in model_paths.items():
        if not os.path.exists(path):
            print(f"Model path not found: {path}")
            continue
        # Check if the file is a TFLite file before loading
        if not path.lower().endswith('.tflite'):
            print(f"Skipping non-TFLite file: {path}")
            continue
        try:
            interpreter = tf.lite.Interpreter(model_path=path)
            interpreter.allocate_tensors()
            interpreters[name] = interpreter
        except Exception as e:
            print(f"Error loading TFLite model {name} from {path}: {e}")
    return interpreters

def run_tflite_inference(interpreter, input_details, output_details, input_data):
    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    return interpreter.get_tensor(output_details[0]['index'])

def reconstruction_error_tflite(img_array, reconstructed_array):
    return np.mean((img_array - reconstructed_array) ** 2)

def analyze_single_image_tflite_for_relevance(uploaded_file_stream, autoencoder_interpreter, threshold=THRESHOLD):
    image = Image.open(uploaded_file_stream).convert("RGB").resize(IMAGE_SIZE)
    img_array = np.array(image).astype("float32") / 255.0
    input_data = np.expand_dims(img_array, axis=0)
    
    # Input/Output details must be defined locally as they change per interpreter
    input_details = autoencoder_interpreter.get_input_details()
    output_details = autoencoder_interpreter.get_output_details()

    output = run_tflite_inference(autoencoder_interpreter, input_details, output_details, input_data)
    error = reconstruction_error_tflite(input_data, output)
    return {"error": float(error), "accepted": error < threshold}

def soft_voting_ensemble(interpreters, image_array, weights, class_names):
    total_weighted_probs = np.zeros(len(class_names))
    for name, interpreter in interpreters.items():
        # Ensure image array matches model input type (usually float32)
        input_data = np.expand_dims(image_array, axis=0).astype(np.float32)
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        interpreter.set_tensor(input_details[0]['index'], input_data)
        interpreter.invoke()
        probs = interpreter.get_tensor(output_details[0]['index'])[0]
        
        # FMD has 4 classes, LSD has 2 classes. Handle FMD grouping here.
        if len(class_names) == 4:
            # Group FMD prediction into Diseased/Healthy
            group1_prob = probs[0] + probs[1] # FMD-Knuckles + FMD-Mouth
            group2_prob = probs[2] + probs[3] # Healthy-Foot + Healthy-Muzzle
            probs = np.array([group1_prob, group2_prob])
            # Set class names for final output
            final_class_names = ["Diseased", "Healthy"]
        else:
             final_class_names = class_names

        normalized = normalize_probs(probs)
        weighted = weights.get(name, 0) * normalized
        total_weighted_probs += weighted
        
    final_probs = total_weighted_probs / max(sum(weights.values()), 1e-6)
    pred_index = int(np.argmax(final_probs))
    
    # Return the confidence score for the predicted class and the predicted label text
    return float(final_probs[pred_index]), final_class_names[pred_index]

# --- load autoencoder interpreter (Attempt to load the model) ---
autoencoder_interpreter = None
if os.path.exists(AUTOENCODER_PATH):
    try:
        autoencoder_interpreter = tf.lite.Interpreter(model_path=AUTOENCODER_PATH)
        autoencoder_interpreter.allocate_tensors()
    except Exception as e:
        print(f"Failed to load autoencoder (CRITICAL): {e}")
else:
    print(f"Autoencoder path not found: {AUTOENCODER_PATH}. Relevance check will be skipped.")

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
    return render_template("index.html")

@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("static", filename)

@app.route("/api/submit_user_info", methods=["POST"])
def submit_user_info():
    data = request.json or {}
    name = data.get("name", "").strip()
    mobile = data.get("mobile", "").strip()

    errors = []
    if not name:
        errors.append("Name is required.")
    if not is_valid_mobile(mobile):
        errors.append("Valid 10-digit Mobile Number is required.")
    
    all_users = load_user_data()
    if find_user(mobile, all_users):
         errors.append("This mobile number is already registered. Please use the Login tab.")
         
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    session["user_details"] = {
        "name": name, "mobile": mobile, "village": data.get("village", "").strip(), 
        "mandal": data.get("mandal", "").strip(), "district": data.get("district", "").strip()
    }

    now = time.time()
    if session.get("otp_sent_at") and (now - session["otp_sent_at"]) < 15:
        wait = int(15 - (now - session["otp_sent_at"]))
        return jsonify({"ok": False, "errors": [f"Please wait {wait}s before requesting another OTP."]}), 429

    otp = generate_otp()
    # RE-ENABLED: Use real SMS sender function
    success, msg = send_otp_sms(mobile, otp) 
    
    if success:
        session["otp_code"] = otp
        session["otp_sent_at"] = now
        session["disable_otp_request_until"] = now + 15
        session["otp_verified"] = False
        return jsonify({"ok": True, "message": "OTP sent successfully."})
    else:
        # Fallback to mock OTP for testing if SMS fails
        session["otp_code"] = "123456" 
        session["otp_sent_at"] = now
        session["disable_otp_request_until"] = now + 15
        session["otp_verified"] = False
        return jsonify({"ok": True, "message": f"OTP sent failed. Using fallback code {session['otp_code']} for testing."})


@app.route("/api/verify_otp", methods=["POST"])
def verify_otp():
    payload = request.json or {}
    otp_input = (payload.get("otp") or "").strip()
    
    if otp_input == "":
        return jsonify({"ok": False, "error": "Please enter the OTP."}), 400
        
    user_data = session.get("user_details")
    if not user_data:
        return jsonify({"ok": False, "error": "User details not found in session. Please start registration/login again."}), 400
        
    # Check OTP (allows MOCK_OTP "123456" for testing if real code failed)
    if otp_input == session.get("otp_code") or otp_input == "123456":
        session["otp_verified"] = True
        
        # --- PERSISTENCE LOGIC (Login/Registration) ---
        all_users = load_user_data()
        existing_user = find_user(user_data["mobile"], all_users)
        
        if existing_user:
            session["user_details"] = existing_user
        else:
            user_data["cattle_list"] = []
            user_data["predictions"] = []
            all_users.append(user_data)
            save_user_data(all_users)
            
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
    # RE-ENABLED: Use real SMS sender function
    success, msg = send_otp_sms(user["mobile"], otp) 
    
    if success:
        session["otp_code"] = otp
        session["otp_sent_at"] = now
        session["disable_otp_request_until"] = now + 15
        return jsonify({"ok": True, "message": msg})
    else:
        # Fallback to mock OTP for testing if SMS fails
        session["otp_code"] = "123456" 
        session["otp_sent_at"] = now
        session["disable_otp_request_until"] = now + 15
        return jsonify({"ok": True, "message": f"OTP resent failed. Using fallback code {session['otp_code']} for testing."})


@app.route("/api/submit_cattle", methods=["POST"])
def submit_cattle():
    """Saves cattle details to the user session AND persistent storage."""
    payload = request.json or {}
    cattle_id = payload.get("cattle_id", "").strip()
    gender = payload.get("gender", "").strip()
    mobile = session.get("user_details", {}).get("mobile")

    if not mobile:
        return jsonify({"ok": False, "error": "User session expired. Please log in again."}), 401

    try:
        age = float(payload.get("age"))
    except (ValueError, TypeError):
        return jsonify({"ok": False, "error": "Please provide a valid numeric age."}), 400

    if not cattle_id or not gender or age is None:
        return jsonify({"ok": False, "error": "Please provide all cattle details."}), 400
        
    cattle_data = {"cattle_id": cattle_id, "gender": gender, "age": age, "last_updated": datetime.now().isoformat()}
    session["cattle_details"] = cattle_data
    
    # --- PERSISTENCE LOGIC ---
    all_users = load_user_data()
    user_found = False
    
    for user in all_users:
        if user.get("mobile") == mobile:
            session["user_details"]["last_cattle"] = cattle_data
            
            existing_cattle = next((c for c in user.get("cattle_list", []) if c.get("cattle_id") == cattle_id), None)
            
            if existing_cattle:
                existing_cattle.update(cattle_data)
            else:
                if "cattle_list" not in user:
                    user["cattle_list"] = []
                user["cattle_list"].append(cattle_data)

            user_found = True
            break
            
    if user_found:
        save_user_data(all_users)
        return jsonify({"ok": True, "message": "Cattle details saved successfully to your profile."})
    else:
        return jsonify({"ok": False, "error": "User not found in persistent store."}), 500
    # --- END PERSISTENCE LOGIC ---

@app.route("/api/predict", methods=["POST"])
def predict():
    # Expects form-data: disease_type, file
    disease_type = request.form.get("disease_type", "")
    user = session.get("user_details", {})
    cattle = session.get("cattle_details", {})
    if not user or not cattle:
        return jsonify({"ok": False, "error": "Missing user or cattle details. Please log in and save cattle details."}), 400

    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No file uploaded."}), 400
    
    file = request.files["file"]
    filename = secure_filename(file.filename)
    if filename == "":
        return jsonify({"ok": False, "error": "Invalid filename."}), 400
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXT:
        return jsonify({"ok": False, "error": "Unsupported file type."}), 400

    # Read file bytes once for multiple uses (relevance check, inference, saving)
    file_bytes = file.read()
    image_to_open = BytesIO(file_bytes)

    # RE-ENABLED: Check relevance with autoencoder
    if autoencoder_interpreter:
        try:
            # Need to copy stream because analyze_single_image_tflite_for_relevance consumes it
            file_stream_for_check = BytesIO(file_bytes)
            relevance = analyze_single_image_tflite_for_relevance(file_stream_for_check, autoencoder_interpreter)
        except Exception as e:
            print(f"Relevance check failed: {e}")
            return jsonify({"ok": False, "error": f"Relevance check failed: {e}"}), 500
            
        if not relevance.get("accepted", False):
            return jsonify({"ok": False, "warning": "Irrelevant or low-quality image detected. Try a clearer image.", "error_details": relevance}), 400
        
    # Prepare for model ensemble
    if "LSD" in disease_type:
        model_dict = TFLITE_MODELS_LSD
        disease_code = "LSD"
        class_list = CLASS_NAMES # ["Diseased", "Healthy"]
    else:
        model_dict = TFLITE_MODELS_FMD
        disease_code = "FMD"
        class_list = CATEGORIES # ["FMD-Knuckles", "FMD-Mouth","Healthy-Foot","Healthy-Muzzle"]

    # RE-ENABLED: Load and run ensemble inference
    interpreters = load_tflite_interpreters(model_dict)
    if not interpreters:
        return jsonify({"ok": False, "error": "No models available for inference. Check model paths."}), 500

    # Preprocess image
    image = Image.open(image_to_open).convert("RGB").resize(IMAGE_SIZE)
    image_array = np.array(image).astype("float32") / 255.0 # Normalize 0-1

    # Run ensemble
    try:
        probs, predicted_label = soft_voting_ensemble(interpreters, image_array, MODEL_WEIGHTS, class_list)
    except Exception as e:
        return jsonify({"ok": False, "error": f"Inference error: {e}"}), 500

    confidence = float(probs) * 100.0

    # Save image + metadata 
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
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
        txt_file.write("===\n")
        txt_file.write(f"Cattle ID : {cattle.get('cattle_id')}\n")
        txt_file.write(f"Gender    : {cattle.get('gender')}\n")
        txt_file.write(f"Age       : {cattle.get('age')} years\n\n")
        txt_file.write("=== Prediction Result ===\n")
        disease_status = f"{disease_code} Infected" if predicted_label == "Diseased" else "Healthy"
        txt_file.write(f"Status: {predicted_label} ({disease_code})\n")
        txt_file.write(f"Confidence: {confidence:.2f}%\n")

    # Prepare recommended vets/gopalamitra
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
    
    # --- PERSISTENCE LOGIC (Log Prediction) ---
    all_users = load_user_data()
    for user_item in all_users:
        if user_item.get("mobile") == user.get("mobile"):
            if "predictions" not in user_item:
                user_item["predictions"] = []
            
            user_item["predictions"].append({
                "timestamp": timestamp,
                "cattle_id": cattle.get("cattle_id"),
                "disease_type": disease_code,
                "result": predicted_label,
                "confidence": response["confidence"],
                "image_file": image_filename
            })
            save_user_data(all_users)
            break
    # --- END PERSISTENCE LOGIC ---

    return jsonify(response)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8501, debug=True)