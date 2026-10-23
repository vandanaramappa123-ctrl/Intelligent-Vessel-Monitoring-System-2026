
import tensorflow as tf
import numpy as np

# Make training repeatable
np.random.seed(42)
tf.random.set_seed(42)

print("TensorFlow version:", tf.__version__)

# Simulated vessel sensor training data
engine_load = np.array(
    [20, 30, 40, 50, 60, 70, 80, 90, 100],
    dtype=np.float32
).reshape(-1, 1)

engine_temperature = np.array(
    [45, 50, 55, 60, 65, 70, 76, 82, 90],
    dtype=np.float32
).reshape(-1, 1)

# Scale the data to help the model train
x_train = engine_load / 100.0
y_train = engine_temperature / 100.0

# Neural network
model = tf.keras.Sequential([
    tf.keras.layers.Input(shape=(1,)),
    tf.keras.layers.Dense(8, activation="relu"),
    tf.keras.layers.Dense(1)
])

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.01),
    loss="mean_squared_error"
)

# Train the model
model.fit(
    x_train,
    y_train,
    epochs=1500,
    verbose=0
)

# Test at 75% engine load
test_load = np.array([[75]], dtype=np.float32)
prediction = model.predict(test_load / 100.0, verbose=0)

predicted_temperature = float(prediction[0][0] * 100.0)

print("Engine load:", test_load[0][0], "%")
print(
    "Predicted engine temperature:",
    round(predicted_temperature, 2),
    "degrees Celsius"
)

# Save the trained model for backend integration
model.save("engine_temperature_model.keras")

print("Model saved successfully!")
