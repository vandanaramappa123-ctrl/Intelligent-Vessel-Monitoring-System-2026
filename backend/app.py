
from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import time
import numpy as np
import tensorflow as tf

app = Flask(__name__)
CORS(app)

# --------------------------------------------------
# 1. LOAD THE TRAINED DEMONSTRATION MODEL
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Expected location:
# Vessel_Management_System/engine_temperature_model.keras
MODEL_PATH = os.path.join(
    os.path.dirname(BASE_DIR),
    "engine_temperature_model.keras"
)

model = None
model_error = None

try:
    if os.path.exists(MODEL_PATH):
        model = tf.keras.models.load_model(MODEL_PATH)
        print("AI model loaded successfully!")
    else:
        model_error = f"Model file not found: {MODEL_PATH}"
        print(model_error)

except Exception as error:
    model_error = str(error)
    print("AI model could not be loaded:", model_error)


# --------------------------------------------------
# 2. HOME ROUTE
# --------------------------------------------------

@app.route("/")
def home():
    return "Vessel Management System Backend is Running!"


# --------------------------------------------------
# 3. HEALTH / CONNECTION CHECK
# --------------------------------------------------

@app.route("/health")
def health():
    return jsonify({
        "backend_status": "running",
        "ai_model_loaded": model is not None,
        "ai_status": (
            "ready" if model is not None else "unavailable"
        )
    })


# --------------------------------------------------
# 4. AI ENGINE TEMPERATURE PREDICTION
# --------------------------------------------------

@app.route("/ai-prediction")
def ai_prediction():
    if model is None:
        return jsonify({
            "error": "AI model is not loaded.",
            "details": model_error or "Unknown model-loading error"
        }), 503

    try:
        engine_load = float(
            request.args.get("engine_load", 75)
        )
    except (TypeError, ValueError):
        return jsonify({
            "error": "Engine load must be a number."
        }), 400

    if not 0 <= engine_load <= 100:
        return jsonify({
            "error": "Engine load must be between 0 and 100."
        }), 400

    try:
        # The model is expected to accept normalized engine load.
        input_data = np.array(
            [[engine_load / 100.0]],
            dtype=np.float32
        )

        prediction = model.predict(input_data, verbose=0)

        # Handle a single scalar model output.
        normalized_temperature = float(
            np.asarray(prediction).reshape(-1)[0]
        )

        # Assumes training targets were temperature / 100.
        predicted_temperature = normalized_temperature * 100.0

        return jsonify({
            "engine_load": engine_load,
            "predicted_engine_temperature": round(
                predicted_temperature, 2
            ),
            "model_type": "Demonstration model using simulated data"
        })

    except Exception as error:
        app.logger.exception("AI prediction failed")

        return jsonify({
            "error": "AI prediction failed.",
            "details": str(error)
        }), 500


# --------------------------------------------------
# 5. AUTOMATIC SIMULATED SENSOR DATA
# --------------------------------------------------

@app.route("/sensor-data")
def sensor_data():
    # Change the simulated condition every 15 seconds.
    # The frontend can poll this route every 5 seconds.
    phase = int(time.time() // 15) % 3

    if phase == 0:
        engine_temperature = 82
        fuel_consumption = 115
        equipment_health = 90
        failure_risk = "Low"

    elif phase == 1:
        engine_temperature = 96
        fuel_consumption = 145
        equipment_health = 68
        failure_risk = "Warning"

    else:
        engine_temperature = 108
        fuel_consumption = 175
        equipment_health = 42
        failure_risk = "High"

    return jsonify({
        "engine_temperature": engine_temperature,
        "fuel_consumption": fuel_consumption,
        "equipment_health": equipment_health,
        "failure_risk": failure_risk,
        "data_type": "Simulated demonstration sensor data",
        "updated_at": int(time.time())
    })


# --------------------------------------------------
# 6. RUN THE FLASK SERVER
# --------------------------------------------------

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )
