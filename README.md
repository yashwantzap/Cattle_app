Below is a **clean, professional `README.md`** version of your content, formatted to standard open-source conventions and ready to drop directly into your repository.

---

# 🐮 AVR – Aroogya Vaidya Ratha

### Cattle Health Management System

**AVR (Aroogya Vaidya Ratha)** is a web-based and machine-learning–powered application designed to assist farmers and veterinary staff in the **early diagnosis of Lumpy Skin Disease (LSD)** and **Foot-and-Mouth Disease (FMD)** using **image classification models**.

The system combines a lightweight frontend, a Flask backend, and TensorFlow Lite models to deliver fast, accessible, and field-ready cattle health diagnostics.

---

## 📌 Table of Contents

* [Project Overview](#-project-overview)
* [System Architecture](#-system-architecture)
* [Core Features](#-core-features)
* [Technology Stack](#-technology-stack)
* [Frontend Implementation](#-frontend-implementation)
* [Backend API](#-backend-api)
* [Machine Learning Pipeline](#-machine-learning-pipeline)
* [Data Persistence](#-data-persistence)
* [Extending the System](#-extending-the-system)
* [Model Management](#-model-management)
* [Production Deployment](#-production-deployment)

---

## 📖 Project Overview

The AVR system provides an **end-to-end workflow** that includes:

* OTP-based user authentication
* Farmer and cattle registration
* Image-based disease prediction
* Image relevance validation
* Prediction history storage
* Local veterinary and Gopalamitra contact lookup

The application is built with a **Single Page Application (SPA)** frontend and a **Flask REST API** backend that performs machine learning inference using **TensorFlow Lite**.

---

## 🏗 System Architecture

### High-Level Architecture

```
Frontend (HTML/CSS/JS)
        |
        | REST API (JSON)
        |
Backend (Flask)
        |
        ├── User & Cattle Data (JSON)
        ├── Local Support Data (CSV)
        └── ML Inference (TFLite Models)
```

---

## 🧩 Core Components

| Component            | Technology                    | Responsibility                                               | Source Files                            |
| -------------------- | ----------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| **Frontend**         | HTML, CSS, Vanilla JavaScript | UI rendering, routing, forms, image preview, mock/live logic | `index.html`, `styles.css`, `script.js` |
| **Backend**          | Python, Flask                 | API routing, authentication, data persistence, ML inference  | `server.py`                             |
| **Machine Learning** | TensorFlow Lite               | Disease prediction & image relevance validation              | `server.py`                             |

---

## ✨ Core Features

* 🔐 **OTP-Based Authentication**
  Secure login and registration using mobile OTP.

* 🧠 **Disease Prediction**
  Soft-voting ensemble models for LSD and FMD diagnosis.

* 🖼 **Image Relevance Pre-Screening**
  Autoencoder-based reconstruction error (MSE) check to filter irrelevant or low-quality images.

* 💾 **Persistent Data Storage**
  Users, cattle records, and prediction history stored in `user_data.json`.

* 📍 **Local Support Lookup**
  Fetches nearby veterinarians and Gopalamitra contacts using CSV-based location data.

* 🧪 **Mock Mode Support**
  Enables frontend-only testing without backend dependency.

---

## 🧰 Technology Stack

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript (SPA pattern)

### Backend

* Python 3
* Flask
* TensorFlow Lite Runtime

### Data

* JSON (user & cattle records)
* CSV (veterinary support data)

---

## 🖥 Frontend Implementation

### Routing (SPA)

* Page navigation is handled by **toggling the `hidden` CSS class**.
* Sections such as:

  * `auth-section`
  * `cattle-section`
  * `predictor-section`
* Sidebar clicks dynamically activate the required view.

---

### Mock vs Real Mode

The frontend behavior is controlled by a single flag in `script.js`:

```javascript
const IS_MOCK_ENABLED = true;
```

#### Mock Mode

* No backend calls
* OTP validated against `MOCK_OTP = "123456"`
* User state populated locally
* Predictions generated randomly after a simulated delay

#### Real Mode

* All actions use live `fetch()` calls to Flask APIs
* Backend handles OTP, data persistence, and ML inference

---

## 🔌 Backend API

### Flask Endpoints (`server.py`)

| Endpoint                | Method | Description                                                                  |
| ----------------------- | ------ | ---------------------------------------------------------------------------- |
| `/api/submit_user_info` | POST   | Generates OTP and initializes user session                                   |
| `/api/verify_otp`       | POST   | Verifies OTP and handles login/registration                                  |
| `/api/submit_cattle`    | POST   | Saves or updates cattle information                                          |
| `/api/predict`          | POST   | Runs image relevance check, ensemble prediction, logging, and support lookup |

All endpoints return **JSON responses** and are production-ready.

---

## 🤖 Machine Learning Pipeline

### 1. Image Relevance Check

* Uses a **TFLite Autoencoder**
* Computes **Reconstruction Error (MSE)**
* Images exceeding the threshold are rejected

### 2. Disease Prediction

* **Soft-Voting Ensemble**
* Multiple TFLite models per disease
* Weighted probability aggregation using `MODEL_WEIGHTS`

### 3. FMD Post-Processing

* Original 4-class output grouped into:

  * **Diseased**
  * **Healthy**
* Final binary prediction generated via ensemble voting

---

## 💾 Data Persistence

* All user, cattle, and prediction records are stored in:

  ```
  user_data.json
  ```
* Location-based veterinary data is read from:

  ```
  support_data.csv
  ```

---

## 🧱 Extending the System

### Adding New Pages (Example: Farmers List)

1. **Backend**

   * Add a new Flask route in `server.py`

   ```python
   /api/get_farmers_list
   ```

2. **Frontend**

   * Create a JS loader function (e.g., `loadFarmersList()`)
   * Fetch data from the API when mock mode is disabled
   * Dynamically render results into the target HTML section

This pattern ensures consistent SPA behavior.

---

## 🧪 Model Management

### Adding or Updating Models

* Update the model dictionaries in `server.py`:

  * `TFLITE_MODELS_LSD`
  * `TFLITE_MODELS_FMD`
* Adjust corresponding weights in:

  * `MODEL_WEIGHTS`

The ensemble logic will automatically include new models.

### Performance Optimization

* Cache TFLite interpreters in memory at app startup
* Avoid reloading models on every `/api/predict` request

---

## 🚀 Production Deployment

### 1. Disable Mock Mode (Critical)

```javascript
const IS_MOCK_ENABLED = false;
```

### 2. Security Best Practices

* Store `SECRET_KEY` and SMS credentials in environment variables
* Enable OTP rate-limiting
* Use HTTPS in production
* Replace JSON storage with a database (recommended)

---

## 📜 License

This project is intended for **research, educational, and public health use**.
Licensing terms can be added as per deployment requirements.

---

If you want, I can also:

* Add **installation & run instructions**
* Create a **project folder structure section**
* Write a **deployment guide (Docker / cloud)**
