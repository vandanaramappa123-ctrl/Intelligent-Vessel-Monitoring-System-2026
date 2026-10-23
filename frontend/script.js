
let previousRisk = null;
let isFirstSensorUpdate = true;
let audioContext = null;
let predictionRequestNumber = 0;
let latestSensorTemperature = null;
let latestAiPrediction = null;

// UPDATE HTML ELEMENTS SAFELY
function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
        return true;
    }

    return false;
}

// UPDATE ALL EXISTING ELEMENTS FROM A LIST OF POSSIBLE IDS
function setFirstAvailableText(ids, value) {
    let updated = false;

    ids.forEach(id => {
        if (setText(id, value)) {
            updated = true;
        }
    });

    return updated;
}

// ALARM SOUNDS
async function playAlarm(frequency, duration, type, volume) {
    try {
        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {
            console.log("Audio is not supported in this browser.");
            return;
        }

        if (!audioContext || audioContext.state === "closed") {
            audioContext = new AudioContextClass();
        }

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency;
        gainNode.gain.value = volume;

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration / 1000);

        oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    } catch (error) {
        console.error("Alarm sound error:", error);
    }
}

function playWarningSound() {
    playAlarm(600, 350, "sine", 0.15);
}

function playHighAlarm() {
    playAlarm(1000, 800, "square", 0.20);
}

function testWarningSound() {
    playWarningSound();
}

function testHighSound() {
    playHighAlarm();
}

// DASHBOARD SENSOR VALUES AND ALERTS
function updateDashboard(data) {
    const risk = String(data.failure_risk || "Low");
    const temperature = Number(data.engine_temperature);

    if (Number.isFinite(temperature)) {
        latestSensorTemperature = temperature;
    }

    setText("temperature", data.engine_temperature + " °C");
    setText("fuel", data.fuel_consumption + " L/hr");
    setText("health", data.equipment_health + "%");
    setText("risk", risk);

    if (risk.toLowerCase() === "high") {
        setText("temperatureStatus", "Critical");
        setText("fuelStatus", "Very High");
        setText("healthStatus", "Poor");
        setText("riskStatus", "Immediate Attention");

        setText(
            "systemStatus",
            "🔴 Critical Condition Detected"
        );

        setText(
            "alertBox",
            "🚨 CRITICAL ALERT: Simulated high-risk condition detected. " +
            "Check cooling-water circulation and coolant level, inspect " +
            "the cooling-water pump, follow approved procedures for " +
            "reducing engine load, and inform the responsible engineer."
        );
    } else if (risk.toLowerCase() === "warning") {
        setText("temperatureStatus", "High");
        setText("fuelStatus", "Unusual");
        setText("healthStatus", "Needs Attention");
        setText("riskStatus", "Warning");

        setText(
            "systemStatus",
            "🟠 Abnormal Conditions Detected"
        );

        setText(
            "alertBox",
            "⚠️ WARNING: Simulated abnormal conditions detected. " +
            "Check coolant level and cooling-system circulation, " +
            "inspect the cooling-water pump, and continue monitoring."
        );
    } else {
        setText("temperatureStatus", "Normal");
        setText("fuelStatus", "Stable");
        setText("healthStatus", "Good");
        setText("riskStatus", "System Safe");

        setText(
            "systemStatus",
            "🟢 All Systems Operating Normally"
        );

        setText(
            "alertBox",
            "✅ No active alerts. Simulated readings are within " +
            "the demonstration's normal range."
        );
    }

    // Sound only when the risk changes after the first reading.
    if (!isFirstSensorUpdate && risk !== previousRisk) {
        if (risk.toLowerCase() === "high") {
            playHighAlarm();
        } else if (risk.toLowerCase() === "warning") {
            playWarningSound();
        }
    }

    previousRisk = risk;
    isFirstSensorUpdate = false;

    updateAiAnalysis();
}

// ENGINE LOAD SLIDER
function getEngineLoadSlider() {
    return document.getElementById("engineLoadSlider") ||
           document.getElementById("engineLoad") ||
           document.getElementById("engine-load") ||
           document.querySelector('input[type="range"]');
}

function getEngineLoad() {
    const slider = getEngineLoadSlider();

    if (!slider) {
        return 75;
    }

    const value = Number(slider.value);

    if (!Number.isFinite(value)) {
        return 75;
    }

    return Math.max(0, Math.min(100, value));
}

function updateEngineLoadLabels(value) {
    const label = value + "%";

    setFirstAvailableText(
        ["aiEngineLoad", "engineLoadSliderValue",
         "engineLoadValue", "engineLoadLabel", "loadValue"],
        label
    );
}

// REQUEST AI TEMPERATURE PREDICTION
async function getAiPrediction() {
    const requestNumber = ++predictionRequestNumber;
    const engineLoad = getEngineLoad();

    updateEngineLoadLabels(engineLoad);

    try {
        const response = await fetch(
            "http://127.0.0.1:5000/ai-prediction?engine_load=" +
            encodeURIComponent(engineLoad),
            { cache: "no-store" }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "AI prediction request failed."
            );
        }

        // Ignore an older response if a newer request has started.
        if (requestNumber !== predictionRequestNumber) {
            return;
        }

        const predicted = Number(data.predicted_engine_temperature);

        if (!Number.isFinite(predicted)) {
            throw new Error(
                "The AI endpoint did not return a valid predicted temperature."
            );
        }

        latestAiPrediction = predicted;
        window.latestAiPrediction = predicted;

        setText("aiTemperature", predicted.toFixed(2) + " °C");
        setText("aiStatus", "AI prediction connected");

        // Support alternative IDs if they exist in your HTML.
        setFirstAvailableText(
            ["predictedTemperature", "aiPrediction",
             "aiPredictedTemperature"],
            predicted.toFixed(2) + " °C"
        );

        updateAiAnalysis();

        console.log("AI prediction result:", data);
    } catch (error) {
        if (requestNumber !== predictionRequestNumber) {
            return;
        }

        console.error("AI prediction error:", error);

        latestAiPrediction = null;
        window.latestAiPrediction = null;

        setText("aiTemperature", "Unavailable");
        setText("aiStatus", "AI connection unavailable");

        setFirstAvailableText(
            ["predictedTemperature", "aiPrediction",
             "aiPredictedTemperature"],
            "Unavailable"
        );

        updateAiAnalysis();
    }
}

// CORRECTED AI ENGINE ANALYSIS
// These IDs match your existing index.html.
function updateAiAnalysis() {
    const current = latestSensorTemperature;
    const predicted = latestAiPrediction;

    if (!Number.isFinite(current) ||
        !Number.isFinite(predicted)) {

        setText("comparisonSensorTemp", "-- °C");
        setText("comparisonAITemp", "-- °C");
        setText("temperatureDifference", "-- °C");

        setText(
            "comparisonMessage",
            "Waiting for sensor and AI data..."
        );

        return;
    }

    const difference = Math.abs(current - predicted);

    setText(
        "comparisonSensorTemp",
        current.toFixed(2) + " °C"
    );

    setText(
        "comparisonAITemp",
        predicted.toFixed(2) + " °C"
    );

    setText(
        "temperatureDifference",
        difference.toFixed(2) + " °C"
    );

    let message;

    if (difference >= 20) {
        message =
            "Large difference detected between the simulated sensor " +
            "reading and AI estimate. Review both readings.";
    } else if (difference >= 10) {
        message =
            "Moderate difference detected. Continue monitoring and " +
            "review the simulated readings.";
    } else {
        message =
            "The simulated sensor reading and AI estimate are " +
            "relatively close.";
    }

    setText("comparisonMessage", message);

    console.log("AI analysis:", {
        currentSensorTemperature: current,
        predictedTemperature: predicted,
        absoluteDifference: difference
    });
}

// FETCH SENSOR DATA FROM FLASK
async function getSensorData() {
    try {
        const response = await fetch(
            "http://127.0.0.1:5000/sensor-data",
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(
                "Sensor API returned HTTP " + response.status
            );
        }

        const data = await response.json();

        console.log("New sensor data:", data);

        updateDashboard(data);

        setFirstAvailableText(
            ["backendStatus", "connectionStatus"],
            "Backend connected"
        );

        // Get a new AI estimate after receiving the sensor reading.
        await getAiPrediction();

    } catch (error) {
        console.error("Sensor connection error:", error);

        setText(
            "alertBox",
            "⚠️ Cannot retrieve sensor data. Check that Flask is running."
        );

        setFirstAvailableText(
            ["backendStatus", "connectionStatus"],
            "Backend connection unavailable"
        );
    }
}

// DEMONSTRATION BUTTON FUNCTIONS
function normalMode() {
    updateDashboard({
        engine_temperature: 82,
        fuel_consumption: 115,
        equipment_health: 90,
        failure_risk: "Low"
    });
}

function warningMode() {
    updateDashboard({
        engine_temperature: 96,
        fuel_consumption: 145,
        equipment_health: 68,
        failure_risk: "Warning"
    });
}

function criticalMode() {
    updateDashboard({
        engine_temperature: 108,
        fuel_consumption: 175,
        equipment_health: 42,
        failure_risk: "High"
    });
}

// INITIALIZE DASHBOARD ONCE
function initializeDashboard() {
    const slider = getEngineLoadSlider();

    if (slider) {
        updateEngineLoadLabels(getEngineLoad());

        slider.addEventListener("input", function () {
            updateEngineLoadLabels(getEngineLoad());
            getAiPrediction();
        });
    } else {
        console.warn(
            "Engine-load slider not found. Check index.html."
        );
    }

    // Load the current sensor values immediately.
    getSensorData();

    // Refresh simulated sensor and AI values every five seconds.
    setInterval(getSensorData, 5000);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeDashboard,
        { once: true }
    );
} else {
    initializeDashboard();
}
