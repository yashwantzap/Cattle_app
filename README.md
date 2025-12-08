# Cattle Disease Detection System  
A Web + Machine Learning application for identifying cattle diseases (FMD & LSD) using image classification models.

# Overview
This project provides an end-to-end workflow where users can:
- Register using mobile OTP
- Register cattle details
- Upload an image for disease diagnosis
- Validate image relevance using an autoencoder
- Classify disease using a TensorFlow Lite ensemble
- Receive confidence scores and recommended veterinary contacts

The system integrates:
- A responsive front-end (HTML, CSS, JS)
- A Flask backend with API endpoints
- Autoencoder + TFLite classification models
- CSV-based lookup for Vet & Gopalamitra mapping
- Image + metadata logging

# Features
- Mobile-friendly UI  
- OTP-based authentication  
- Cattle registration workflow  
- Image relevance filtering using Autoencoder  
- FMD/LSD prediction with soft-voting ensemble  
- Confidence score calculation  
- Automated Vet & Gopalamitra lookup  
- Image + metadata archival for analysis  

# Architecture
```

Browser (HTML/CSS/JS)
│
▼
Flask Backend (server.py)
│
├── Autoencoder (image relevance check)
│
├── TFLite Ensemble (FMD/LSD classification)
│
├── CSV Lookup (vet, gopalamitra)
│
└── Image + Metadata Storage

```

# Workflow
1. User opens application in browser  
2. Enters mobile → OTP generated  
3. User submits OTP → session created  
4. User registers cattle details  
5. User uploads cattle image → `/api/predict`  
6. Backend:
   - Validates image  
   - Runs autoencoder relevance test  
   - If relevant → runs ensemble models  
   - Calculates confidence  
   - Finds vet & gopalamitra  
   - Saves image + metadata  
7. Backend returns JSON response  
8. UI displays prediction result  

# Tech Stack
## Frontend
- HTML5
- CSS3 (mobile optimized)
- Vanilla JavaScript

## Backend
- Python 3
- Flask
- Flask-Session
- NumPy
- Pandas
- Pillow
- TensorFlow / TFLite Runtime
- Werkzeug

# Folder Structure
```

project/
│
├── server.py
├── templates/
│     └── index.html
├── static/
│     ├── script.js
│     └── styles.css
├── uploaded_images/
├── image_metadata/
├── gopalamitra.csv
├── veterinary_doctors.csv
└── districts.csv

```

# Installation & Setup
## Step 1: Create Virtual Environment
```

python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

```

## Step 2: Install Dependencies
```

pip install -r requirements.txt

```

## Step 3: Run the Server
```

python server.py

```
Now open:
```

[http://localhost:8501](http://localhost:8501)

```

# API Endpoints
## Generate OTP
```

POST /api/generate_otp

```

## Verify OTP
```

POST /api/verify_otp

```

## Submit Cattle Details
```

POST /api/submit_cattle

```

## Predict Disease
```

POST /api/predict   (multipart/form-data)

```

# ML Pipeline
## Autoencoder Relevance Check
- Image → resize → normalize  
- Autoencoder reconstructs image  
- Compute MSE  
- If MSE > threshold → reject image  

## Disease Classification
- Supported: FMD, LSD  
- Multiple TFLite models loaded  
- Each model generates probabilities  
- Soft-voting ensemble computes final output  
- Output includes:
  - predicted_label  
  - confidence  
  - vet_details  
  - gopalamitra_details  

# Frontend Mock Mode
Inside `script.js`:
```

const MOCK = true;

```
Set to `false` to use real API.



# Security Notes
- Never commit SECRET_KEY or tokens  
- Always enable HTTPS in production  
- Validate file types & size limits  
- Implement rate limiting for OTP endpoints  

# Future Enhancements
- Add multilingual UI  
- Deploy models via TensorFlow Serving  
- Replace CSVs with database  
- Add farmer history dashboard  
- Improve autoencoder threshold tuning  




