"""
Analyze tendency tool: 4-axis scoring logic for lifestyle assessment.

4つのメカニズム軸:
- hormone (⚖️ ホルモン): GH/メラトニン → 毛包活性化
- circadian (⏰ 体内時計): Clock遺伝子、生活リズム → 毛包幹細胞の活性化
- blood_flow (🩸 血流): 頭皮血流、血液粘度 → 栄養・酸素供給
- stress (😰 ストレス): コルチゾール → GAS6タンパク質ブロック
"""

from typing import TypedDict


class TendencyScores(TypedDict):
    hormone: int  # 0-100
    circadian: int  # 0-100
    blood_flow: int  # 0-100
    stress: int  # 0-100


class TendencyResult(TypedDict):
    scores: TendencyScores
    dominant_issues: list[str]  # lowest scoring axes


# Question mappings: question_id -> { answer_value: { axis: points, ... } }
# Points represent POSITIVE impact (higher = healthier)
# Question mappings: question_id -> { answer_value: { axis: points, ... } }
# Points are additive. Each axis has a max possible score of 100 based on the sum of these weights.
#
# Axis Max Point Allocations (Total 100 each, Q1-Q9のみで100点):
# ⚖️ Hormone (100): Sleep(47) + Exercise(27) + Feeling(26)
# ⏰ Circadian (100): Sleep(38) + Wake(31) + Sun(31)  ※Caffeine(0〜-20)はペナルティ専用
# 🩸 Blood Flow (100): Exercise(35) + Stiffness(24) + Bathing(24) + Water(17)
# 😰 Stress (100): Feeling(30) + Relax(30) + Exercise(20) + Bathing(10) + Sun(10)
# Q10 嗜好品: ルーティング専用（0点）→ Q11-Q13の条件分岐のみ
# Q11-Q13: ペナルティ専用（0〜マイナス）

QUESTION_WEIGHTS: dict[str, dict[str, dict[str, int]]] = {
    # 1. 睡眠時間 (Hormone main + Circadian)
    "sleep_time": {
        "score_100": {"hormone": 47, "circadian": 38},
        "score_80": {"hormone": 40, "circadian": 32},
        "score_60": {"hormone": 27, "circadian": 19},
        "score_40": {"hormone": 13, "circadian": 6},
        "score_20": {"hormone": 0, "circadian": 0},
    },
    # 2. 起床固定 (Circadian main)
    "wake_up_regular": {
        "score_100": {"circadian": 31},
        "score_80": {"circadian": 25},
        "score_60": {"circadian": 12},
        "score_40": {"circadian": 6},
        "score_20": {"circadian": 0},
    },
    # 3. 朝日 (Circadian + Serotonin/Stress)
    "morning_sunlight": {
        "score_100": {"circadian": 31, "stress": 10},
        "score_80": {"circadian": 25, "stress": 8},
        "score_60": {"circadian": 12, "stress": 5},
        "score_40": {"circadian": 6, "stress": 2},
        "score_20": {"circadian": 0, "stress": 0},
    },
    # 4. 運動 (Blood Flow + Stress + Hormone)
    "exercise_frequency": {
        "score_100": {"blood_flow": 35, "stress": 20, "hormone": 27},
        "score_80": {"blood_flow": 29, "stress": 15, "hormone": 20},
        "score_60": {"blood_flow": 18, "stress": 10, "hormone": 14},
        "score_40": {"blood_flow": 6, "stress": 5, "hormone": 7},
        "score_20": {"blood_flow": 0, "stress": 0, "hormone": 0},
    },
    # 5. 肩こり (Blood Flow desc)
    "shoulder_stiffness": {
        "score_100": {"blood_flow": 24},
        "score_80": {"blood_flow": 18},
        "score_60": {"blood_flow": 12},
        "score_40": {"blood_flow": 6},
        "score_20": {"blood_flow": 0},
    },
    # 6. 入浴 (Blood Flow + Stress)
    "bathing_style": {
        "score_100": {"blood_flow": 24, "stress": 10},
        "score_80": {"blood_flow": 18, "stress": 8},
        "score_60": {"blood_flow": 12, "stress": 5},
        "score_40": {"blood_flow": 6, "stress": 2},
        "score_20": {"blood_flow": 0, "stress": 0},
    },
    # 7. 目覚めの気分 (Stress + Hormone)
    "wake_feeling": {
        "score_100": {"stress": 30, "hormone": 26},
        "score_80": {"stress": 25, "hormone": 19},
        "score_60": {"stress": 15, "hormone": 13},
        "score_40": {"stress": 5, "hormone": 7},
        "score_20": {"stress": 0, "hormone": 0},
    },
    # 8. リラックス習慣 (Stress)
    "relaxation_habit": {
        "score_100": {"stress": 30},
        "score_80": {"stress": 20},
        "score_60": {"stress": 10},
        "score_40": {"stress": 5},
        "score_20": {"stress": 0},
    },
    # 9. 嗜好品 (ルーティング専用 — 後続Q11-Q13を出し分けるだけ、点数なし)
    "substances": {
        "none": {},
        "caffeine": {},
        "alcohol": {},
        "smoking": {},
        "multiple": {},
    },
    # 10. 水分 (Blood Flow)
    "water_intake": {
        "score_100": {"blood_flow": 17},
        "score_80": {"blood_flow": 14},
        "score_60": {"blood_flow": 9},
        "score_40": {"blood_flow": 4},
        "score_20": {"blood_flow": 0},
    },
    # 詳細: 喫煙本数 (Hormone, Blood Flow ペナルティ — 1本でも吸えば減点)
    "smoking_amount": {
        "score_100": {"hormone": 0, "blood_flow": 0},      # 禁煙中/非喫煙
        "score_80": {"hormone": -5, "blood_flow": -5},      # 1〜5本
        "score_60": {"hormone": -10, "blood_flow": -10},    # 6〜10本
        "score_40": {"hormone": -15, "blood_flow": -15},    # 11〜20本
        "score_20": {"hormone": -20, "blood_flow": -20},    # 21本以上
        "score_0": {"hormone": -30, "blood_flow": -30},
    },
    # 詳細: 飲酒頻度 (Hormone, Blood Flow adjustment)
    "alcohol_frequency": {
        "score_100": {"hormone": 0, "blood_flow": 0},  # 飲まない
        "score_80": {"hormone": 0, "blood_flow": 0},
        "score_60": {"hormone": -5, "blood_flow": -5},
        "score_40": {"hormone": -10, "blood_flow": -10},
        "score_20": {"hormone": -15, "blood_flow": -15},
    },
    # 詳細: カフェインタイミング (Circadian penalty — 遅い時間ほど減点)
    "caffeine_timing": {
        "score_100": {"circadian": 0},    # 午前中のみ → ペナルティなし
        "score_80": {"circadian": -5},
        "score_60": {"circadian": -10},
        "score_40": {"circadian": -15},
        "score_20": {"circadian": -20},   # 夜も飲む → 最大ペナルティ
    },
}

# Max scores for normalization (Must match sum of max additions)
# Hormone: Sleep(30)+Exercise(15)+Feeling(15)+Substances(20)+Bathing(0)+.. approx 100 base
# We will clamp at 100, so rough sum is fine.
MAX_SCORES = {
    "hormone": 100,
    "circadian": 100,
    "blood_flow": 100,
    "stress": 100,
}


def analyze_tendency_scores(
    answers: dict[str, str], hair_analysis: dict = None
) -> TendencyResult:
    """
    問診回答から4軸スコアを算出する。

    Args:
        answers: 問診回答 { question_id: answer_value, ... }
        hair_analysis: 機能1（生え際解析）の結果

    Returns:
        TendencyResult: スコアと低スコア軸のリスト
    """
    raw_scores: dict[str, int] = {
        "hormone": 0,
        "circadian": 0,
        "blood_flow": 0,
        "stress": 0,
    }

    for question_id, answer_value in answers.items():
        if question_id not in QUESTION_WEIGHTS:
            continue
        weight_map = QUESTION_WEIGHTS[question_id]
        if answer_value not in weight_map:
            continue
        points = weight_map[answer_value]
        for axis, score in points.items():
            raw_scores[axis] += score

    # Normalize to 0-100 scale
    normalized: TendencyScores = {
        axis: min(100, max(0, int((raw / MAX_SCORES[axis]) * 100)))  # Ensure 0-100 range
        for axis, raw in raw_scores.items()
    }

    # Integrate hair analysis results (hairlineScore)
    # 髪の状態が悪い（スコアが低い）場合、生活習慣のスコアにかかわらず
    # 関連する軸（血流、ホルモン）にペナルティまたは補正をかける
    if hair_analysis and "hairlineScore" in hair_analysis:
        h_score = hair_analysis["hairlineScore"]
        if h_score < 70:
            # 70点未満なら、不足分に応じて関連軸のスコアを下方修正（最大-15点）
            penalty = int((70 - h_score) / 2)
            normalized["blood_flow"] = max(0, normalized["blood_flow"] - penalty)
            normalized["hormone"] = max(0, normalized["hormone"] - penalty)

    # Find dominant issues (lowest 2 scores, below 50)
    sorted_axes = sorted(normalized.items(), key=lambda x: x[1])
    dominant_issues = [axis for axis, score in sorted_axes[:2] if score < 50]

    return TendencyResult(scores=normalized, dominant_issues=dominant_issues)
