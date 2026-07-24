"""
Money Watch Pro — Training XGBoost Signal Model
==================================================
Melatih model XGBoost untuk memprediksi probabilitas "sinyal BUY yang bagus"
(harga naik >3% dalam 10 hari ke depan) dari fitur teknikal harian saham IDX,
lalu mengekspornya ke ONNX supaya bisa dijalankan LANGSUNG di browser
(lihat js/11-quant.js, fungsi xgbLoadModel/xgbPredict) — tanpa server Python
yang harus menyala terus-menerus.

Cara pakai:
    python -m venv .mlvenv
    .mlvenv\\Scripts\\activate          (Windows)   atau   source .mlvenv/bin/activate (Mac/Linux)
    pip install -r ml/requirements.txt
    python ml/train_xgb_signal.py

Hasil:
    models/xgb_signal.onnx        — model terlatih, siap dipakai browser
    models/xgb_signal_meta.json   — urutan fitur, threshold sinyal, metrik training

PENTING: fitur di sini (lihat FEATURE_NAMES) harus identik urutan & rumusnya
dengan fungsi xgbComputeFeatures() di js/11-quant.js. Kalau Anda mengubah
salah satu, ubah juga yang satunya.

Jalankan ulang skrip ini secara berkala (mis. tiap bulan) dengan data
terbaru, lalu commit ulang models/xgb_signal.onnx supaya model tetap relevan.
Ini BUKAN rekomendasi investasi — signal murni hasil model statistik.
"""
import json
import sys
import warnings
from datetime import datetime

# Windows console default (cp1252) can't print unicode checkmarks — force UTF-8.
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.metrics import accuracy_score, classification_report, roc_auc_score
from xgboost import XGBClassifier
from onnxmltools.convert import convert_xgboost
from onnxmltools.convert.common.data_types import FloatTensorType

warnings.filterwarnings("ignore")

# ── Konfigurasi ──────────────────────────────────────────────────────────
TICKERS = [
    "BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "TLKM.JK", "ASII.JK",
    "UNVR.JK", "ICBP.JK", "INDF.JK", "KLBF.JK", "ADRO.JK", "ANTM.JK",
    "PGAS.JK", "SMGR.JK", "GOTO.JK", "MDKA.JK", "INCO.JK", "CPIN.JK",
    "EXCL.JK", "JSMR.JK",
]
PERIOD = "5y"            # rentang data historis
FWD_DAYS = 10             # horizon prediksi (hari ke depan)
TARGET_RETURN = 0.03      # ambang "sinyal bagus" = naik >3% dalam FWD_DAYS
TEST_FRACTION = 0.2       # 20% terakhir (per ticker, berurutan waktu) untuk test
BUY_THRESHOLD = 0.60      # probabilitas minimum untuk sinyal BUY di app
SELL_THRESHOLD = 0.35     # probabilitas di bawah ini -> sinyal SELL/exit

FEATURE_NAMES = ["sma_ratio", "rsi14", "mom20", "vol_ratio", "volatility20", "dist_high20"]

MODEL_PATH = "models/xgb_signal.onnx"
META_PATH = "models/xgb_signal_meta.json"


# ── Feature engineering (harus sama persis dengan versi JS) ────────────────
def compute_features(df):
    close = df["Close"]
    high = df["High"]
    volume = df["Volume"]

    sma10 = close.rolling(10).mean()
    sma30 = close.rolling(30).mean()
    sma_ratio = sma10 / sma30 - 1

    delta = close.diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi14 = (100 - 100 / (1 + rs)) / 100

    mom20 = close.pct_change(20)

    vol_sma20 = volume.rolling(20).mean()
    vol_ratio = volume / vol_sma20.replace(0, np.nan)

    daily_ret = close.pct_change()
    volatility20 = daily_ret.rolling(20).std()

    high20 = high.rolling(20).max()
    dist_high20 = (close - high20) / high20

    feats = pd.DataFrame({
        "sma_ratio": sma_ratio,
        "rsi14": rsi14,
        "mom20": mom20,
        "vol_ratio": vol_ratio,
        "volatility20": volatility20,
        "dist_high20": dist_high20,
    })
    return feats


def build_dataset():
    all_X, all_y = [], []
    used_tickers = []
    for tk in TICKERS:
        try:
            df = yf.download(tk, period=PERIOD, progress=False, auto_adjust=True)
        except Exception as e:
            print(f"  ! gagal mengambil {tk}: {e}")
            continue
        if df is None or len(df) < 100:
            print(f"  ! data {tk} terlalu sedikit, dilewati")
            continue
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

        feats = compute_features(df)
        fwd_ret = df["Close"].shift(-FWD_DAYS) / df["Close"] - 1
        label = (fwd_ret > TARGET_RETURN).astype(int)

        data = feats.copy()
        data["label"] = label
        data = data.dropna()
        if len(data) < 50:
            print(f"  ! {tk}: baris valid terlalu sedikit setelah dropna, dilewati")
            continue

        # split waktu per-ticker supaya tidak ada kebocoran antar periode
        split = int(len(data) * (1 - TEST_FRACTION))
        data["is_test"] = False
        data.iloc[split:, data.columns.get_loc("is_test")] = True

        all_X.append(data)
        used_tickers.append(tk)
        print(f"  ✓ {tk}: {len(data)} baris, {label.sum()} label positif ({label.mean()*100:.1f}%)")

    if not all_X:
        raise RuntimeError("Tidak ada data yang berhasil diambil — cek koneksi internet / ticker.")

    full = pd.concat(all_X, ignore_index=True)
    return full, used_tickers


def main():
    print(f"[{datetime.now().isoformat()}] Mengambil data {len(TICKERS)} ticker (periode {PERIOD})...")
    data, used_tickers = build_dataset()

    train = data[~data["is_test"]]
    test = data[data["is_test"]]
    # .to_numpy() supaya XGBoost menyimpan nama fitur default f0/f1/... —
    # dibutuhkan onnxmltools untuk konversi (tidak bisa parse nama kolom pandas).
    X_train, y_train = train[FEATURE_NAMES].to_numpy(dtype=np.float32), train["label"]
    X_test, y_test = test[FEATURE_NAMES].to_numpy(dtype=np.float32), test["label"]

    print(f"\nTrain: {len(X_train)} baris · Test: {len(X_test)} baris")
    print(f"Label positif — train: {y_train.mean()*100:.1f}% · test: {y_test.mean()*100:.1f}%")

    model = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        random_state=42,
    )
    model.fit(X_train, y_train)

    pred = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1]
    acc = accuracy_score(y_test, pred)
    try:
        auc = roc_auc_score(y_test, proba)
    except ValueError:
        auc = float("nan")

    print("\n── Evaluasi (test set, time-based split) ──")
    print(f"Accuracy : {acc:.3f}")
    print(f"ROC AUC  : {auc:.3f}")
    print(classification_report(y_test, pred, digits=3))

    importance = dict(zip(FEATURE_NAMES, model.feature_importances_.tolist()))
    print("Feature importance:", json.dumps(importance, indent=2))

    # ── Ekspor ke ONNX (zipmap=False -> output tensor float polos, gampang dibaca JS) ──
    onnx_model = convert_xgboost(
        model,
        initial_types=[("input", FloatTensorType([None, len(FEATURE_NAMES)]))],
    )
    import os
    os.makedirs("models", exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        f.write(onnx_model.SerializeToString())
    print(f"\n✓ Model ONNX disimpan: {MODEL_PATH}")

    meta = {
        "version": datetime.now().strftime("%Y%m%d"),
        "trained_at": datetime.now().isoformat(),
        "feature_names": FEATURE_NAMES,
        "fwd_days": FWD_DAYS,
        "target_return": TARGET_RETURN,
        "buy_threshold": BUY_THRESHOLD,
        "sell_threshold": SELL_THRESHOLD,
        "tickers_used": used_tickers,
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "test_accuracy": float(acc),
        "test_roc_auc": float(auc) if auc == auc else None,  # NaN check
        "feature_importance": importance,
        "disclaimer": "Model statistik untuk edukasi/backtesting — bukan rekomendasi investasi.",
    }
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"✓ Metadata disimpan: {META_PATH}")
    print("\nSelesai. Commit models/xgb_signal.onnx dan models/xgb_signal_meta.json ke repo,")
    print("lalu reload aplikasi — Backtester akan otomatis memakai model ini untuk strategi XGBoost.")


if __name__ == "__main__":
    main()
