""" Simulates the Edge AI inference layer that would run ON the health sensor device"""
import json, time, os
import numpy as np
import joblib
from dataclasses import dataclass, asdict
from typing import Optional
# from sklearn.ensemble import RandomForestClassifier
MODEL_PATH = "train_model_edge/random_forest_model_1.0.0.pkl"
METADATA_PATH = "train_model_edge/metadatardforest.json"

@dataclass
class SensorReading:
    """Raw vitals captured from a patient's bedside sensor."""
    patient_id              : str
    device_id               : str
    respiratory_rate        : float
    oxigen_saturation       : float
    o2_scale                : float
    systolic_bp             : float
    heart_rate              : float
    body_temperature        : float
    consciousness           : str
    on_oxygen               : int
    timestamp              : Optional[float] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = time.time()

@dataclass
class AnomalyAlert:
    """ The alert that transmitted over the network to the server."""
    patient_id          : str
    timestamp           : float
    is_anomaly          : bool  # we alert 1 when risk is high
    # confidence          : float
    status              : str
    triggered_vitals    : list
    model_version       : str
    device_id           : str

class EdgeAIInference:
    """
    Lightweight inference engine designed to run on alert sensor.
    Loads the trained model once, then scores each incoming sensor reading in real-time.
    """
    def __init__(self):
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Model not found at '{MODEL_PATH}'.\n"
            )
        self._model = joblib.load(MODEL_PATH)
        with open(METADATA_PATH) as f:
            self._meta = json.load(f)
        self._features = self._meta["feature_columns"]
        self._ranges = self._meta["normal_ranges"]
        self._version = self._meta["model_version"]

    def _engineer_features(self, r: SensorReading) -> np.ndarray:
        """Compute engineered features."""
        conscious_map = {'A': 0, 'V': 1, 'P': 2, 'C': 3, 'U': 4}
        conscious = r.consciousness.map(conscious_map)
        feature_map = {
            'respiratory_rate'  : r.respiratory_rate,
            'oxygen_saturation' : r.oxigen_saturation,
            'o2_scale'          : r.o2_scale,
            'systolic_bp'       : r.systolic_bp,
            'heart_rate'        : r.heart_rate,
            'temperature'       : r.body_temperature,
            'consciousness'     : conscious,
            'on_oxygen'         : r.on_oxygen,
        }
        return np.array([[feature_map[f] for f in self._features]])
    
    def _check_vital_breaches(self, r: SensorReading) -> list:
        """ Return list of vital names that are outside normal range."""
        checks = {
            'respiratory_rate'  : r.respiratory_rate,
            'oxygen_saturation' : r.oxigen_saturation,
            'systolic_bp'       : r.systolic_bp,
            'heart_rate'        : r.heart_rate,
            'temperature'       : r.body_temperature,
        }
        breached=[]
        for vital, value in checks.items():
            rng = self._ranges.get(vital, {})
            lo, hi = rng.get("min", -999), rng.get("max", 9999)
            if value < lo or value > hi:
                direction = "LOW" if value < lo else "HIGH"
                breached.append(f"{vital}={value} ({direction})")
        return breached
    

    # Public API
    def predict(self, reading: SensorReading) -> AnomalyAlert:
        """ Run inference on a single SensorReading."""
        t0 = time.perf_counter()
        X  = self._engineer_features(reading)
        proba = float(self._model.predict_proba(X))
        pred = self._model.predict(X)
        is_anom = (pred == 0)
        if pred==0:
            stat = "HIGH"
        elif pred==1:
            stat = "LOW"
        elif pred==2:
            stat = "MEDIUM"
        elif pred==3:
            stat = "NORMAL"
        elapsed = (time.perf_counter() - t0) * 1000

        breaches = self._check_vital_breaches(reading)

        alert = AnomalyAlert(
            patient_id=reading.patient_id,
            timestamp=reading.timestamp,
            is_anomaly=is_anom,
            # confidence= round(proba,4),
            triggered_vitals= breaches,
            model_version   = self._version,
            device_id= reading.device_id,
            status=stat
        )

        anom = "ANOMALY" if is_anom else "Normal "
        print(f"[EdgeAI] {anom} | patient={reading.patient_id} | {elapsed:.2f}ms")
        return alert
    def to_dict(self, alert: AnomalyAlert) -> dict:
        return asdict(alert)
    
if __name__ == "__main__":
    engine = EdgeAIInference()
    print(f"\nModel loaded. Threshold: {engine._threshold}")

    test_cases = [
        SensorReading(patient_id="P-001", device_id="esp-01",respiratory_rate=18, oxygen_saturation=98,
                      o2_scale=1, systolic_bp=100, heart_rate=90,
                      temperature=37.0, consciousness="A", on_oxygen=0),
        # SensorReading("P-002", 67, "Female",
        #                 blood_pressure_systolic=172, blood_pressure_diastolic=105,
        #                 heart_rate=95, body_temperature=36.8, oxygen_saturation=96),
        # SensorReading("P-003", 55, "Male",
        #                 blood_pressure_systolic=125, blood_pressure_diastolic=82,
        #                 heart_rate=118, body_temperature=38.9, oxygen_saturation=91),
        # SensorReading("P-004", 30, "Female",
        #                 blood_pressure_systolic=108, blood_pressure_diastolic=70,
        #                 heart_rate=88, body_temperature=37.1, oxygen_saturation=99),
    ]

    print("\n── Running test cases ──")
    for r in test_cases:
        alert = engine.predict(r)
        if alert.is_anomaly:
            print(f"  Triggers: {alert.triggered_vitals}\n")