import os
import re
import threading
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import joblib
import numpy as np

from backend.config import config
from backend.models import db, User, Organization, Membership, Scan, ActivityLog, OrganizationAuthConfig
from backend.api.auth import init_oauth
from backend.features_from_url import extract_features_from_url, generate_reasons
from backend.threat_api import check_openphish_sync
from backend.page_inspect import inspect_page_sync

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.dirname(BASE_DIR)
FRONTEND_BUILD_DIR = os.path.join(APP_DIR, "frontend_build")

MODEL_PATH = os.path.join(BASE_DIR, "phishing_rf_model.pkl")
model = joblib.load(MODEL_PATH)

_page_inspect_store = {}
_store_lock = threading.Lock()


def _compute_risk_score(proba_phish: float) -> int:
    p = float(proba_phish)
    if p <= 0.2:
        score = 1 + int(round((p / 0.2) * 2))
    elif p <= 0.5:
        score = 4 + int(round(((p - 0.2) / 0.3) * 2))
    else:
        score = 7 + int(round(((p - 0.5) / 0.5) * 3))
    return max(1, min(10, score))


def _determine_verdict(pred, proba_phish, in_openphish):
    if in_openphish:
        return "Dangerous", "red"
    if pred == 1 and proba_phish >= 0.70:
        return "Dangerous", "red"
    if pred == 1 and proba_phish >= 0.50:
        return "Suspicious", "yellow"
    return "Safe", "green"


def _run_page_inspect(url: str):
    result = inspect_page_sync(url)
    with _store_lock:
        _page_inspect_store[url] = {
            "status": "done",
            "result": result,
            "timestamp": time.time()
        }


def create_app(config_name=None):
    config_name = config_name or os.environ.get('FLASK_ENV', 'development')
    app = Flask(__name__, static_folder=FRONTEND_BUILD_DIR, static_url_path="")
    app.config.from_object(config[config_name])

    CORS(app, resources={
        r"/*": {
            "origins": app.config['CORS_ORIGINS'] + [re.compile(r"^chrome-extension://.*")]
        }
    })

    db.init_app(app)
    Migrate(app, db)

    init_oauth(app)

    from backend.api.auth import auth_bp
    from backend.api.users import users_bp
    from backend.api.organizations import orgs_bp
    from backend.api.scans import scans_bp
    from backend.api.admin import admin_bp
    from backend.api.org_admin import org_admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(orgs_bp)
    app.register_blueprint(scans_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(org_admin_bp)

    @app.get("/api/health")
    def api_health():
        return jsonify({"status": "ok"})

    @app.post("/api/analyze")
    def api_analyze():
        try:
            # Debug: check raw request data
            raw_data = request.get_data(as_text=True)
            with open(r"E:\nvidia\Gatekeeper\backend\debug.log", "a") as f:
                f.write(f"Raw request data: {raw_data}\n")
                f.write(f"Content-Type: {request.content_type}\n")
                f.write(f"Content-Length: {request.content_length}\n")
            
            data = request.get_json(silent=True) or {}
            with open(r"E:\nvidia\Gatekeeper\backend\debug.log", "a") as f:
                f.write(f"Parsed JSON: {data}\n")
            url = (data.get("url") or "").strip()
            if not url:
                return jsonify({"error": "URL is required"}), 400

            t0 = time.time()
            features = extract_features_from_url(url)
            features_arr = np.array(features).reshape(1, -1)

            probas = model.predict_proba(features_arr)[0]
            classes = model.classes_

            if (-1 not in classes) or (1 not in classes):
                return jsonify({"error": "Model classes must contain -1 and 1"}), 500

            idx_safe = int(np.where(classes == -1)[0][0])
            idx_phish = int(np.where(classes == 1)[0][0])
            proba_safe = float(probas[idx_safe])
            proba_phish = float(probas[idx_phish])
            pred = int(model.predict(features_arr)[0])

            risk_score = _compute_risk_score(proba_phish)
            reasons = generate_reasons(url, features)
            lexical_latency_ms = round((time.time() - t0) * 1000)

            lexical_stage = {
                "verdict": "phishing" if pred == 1 else "safe",
                "risk_score": risk_score,
                "phishing_probability": round(proba_phish, 4),
                "reasons": reasons,
                "latency_ms": lexical_latency_ms
            }

            t1 = time.time()
            threat_result = check_openphish_sync(url)
            threat_latency_ms = round((time.time() - t1) * 1000)

            threat_stage = {
                "in_openphish": threat_result.get("in_openphish", False),
                "feed_size": threat_result.get("feed_size", 0),
                "checked": threat_result.get("checked", False),
                "error": threat_result.get("error"),
                "risk_score": 10 if threat_result.get("in_openphish", False) else 1,
                "latency_ms": threat_latency_ms
            }

            verdict, risk_color = _determine_verdict(
                pred, proba_phish, threat_result.get("in_openphish", False)
            )
            if threat_result.get("in_openphish", False):
                risk_score = 10

            with _store_lock:
                cached = _page_inspect_store.get(url)
            if cached is None or (time.time() - cached.get("timestamp", 0) > 3600):
                with _store_lock:
                    _page_inspect_store[url] = {"status": "pending"}
                t = threading.Thread(target=_run_page_inspect, args=(url,), daemon=True)
                t.start()

            return jsonify({
                "url": url,
                "verdict": verdict,
                "risk_score": risk_score,
                "risk_color": risk_color,
                "phishing_probability": round(proba_phish, 4),
                "prediction": pred,
                "reasons": reasons,
                "stages": {
                    "lexical": lexical_stage,
                    "threat_api": threat_stage,
                    "page_inspect": {"status": "running_async"}
                }
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500

    @app.get("/api/page_inspect_result")
    def get_page_inspect_result():
        url = request.args.get("url", "").strip()
        if not url:
            return jsonify({"error": "url parameter required"}), 400
        with _store_lock:
            entry = _page_inspect_store.get(url)
        if entry is None:
            return jsonify({"status": "not_started"})
        return jsonify(entry)

    @app.post("/api/predict")
    def api_predict():
        data = request.get_json(silent=True) or {}
        url = (data.get("url") or "").strip()
        if not url:
            return jsonify({"error": "URL is required"}), 400

        features = extract_features_from_url(url)
        features_arr = np.array(features).reshape(1, -1)
        probas = model.predict_proba(features_arr)[0]
        classes = model.classes_
        idx_safe = int(np.where(classes == -1)[0][0])
        idx_phish = int(np.where(classes == 1)[0][0])
        proba_phish = float(probas[idx_phish])
        pred = int(model.predict(features_arr)[0])
        risk_score = _compute_risk_score(proba_phish)
        verdict, risk_color = _determine_verdict(pred, proba_phish, False)
        reasons = generate_reasons(url, features)

        return jsonify({
            "url": url,
            "prediction": pred,
            "risk_score": risk_score,
            "risk_color": risk_color,
            "verdict": verdict,
            "phishing_probability": round(proba_phish, 4),
            "reasons": reasons
        })

    @app.get("/")
    def serve_index():
        return send_from_directory(FRONTEND_BUILD_DIR, "index.html")

    @app.get("/<path:path>")
    def serve_static_or_index(path):
        full_path = os.path.join(FRONTEND_BUILD_DIR, path)
        if os.path.exists(full_path):
            return send_from_directory(FRONTEND_BUILD_DIR, path)
        return send_from_directory(FRONTEND_BUILD_DIR, "index.html")

    with app.app_context():
        db.create_all()

        try:
            super_admin = User.query.filter_by(role='super_admin').first()
            if not super_admin:
                from backend.auth_utils import hash_password
                super_admin = User(
                    email='admin@gatekeeper.local',
                    password_hash=hash_password('Admin@123'),
                    first_name='ThreatShield',
                    last_name='Admin',
                    role='super_admin',
                    is_verified=True,
                    is_active=True
                )
                db.session.add(super_admin)
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            # Schema not yet migrated (e.g., new columns missing)
            # Skip super admin initialization; it will run on next startup after migration
            app.logger.warning(f'Skipping super admin init: {e}')

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)