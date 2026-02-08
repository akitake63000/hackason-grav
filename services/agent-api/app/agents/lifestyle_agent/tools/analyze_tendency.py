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
QUESTION_WEIGHTS: dict[str, dict[str, dict[str, int]]] = {
    # 1. 就寝時刻 (睡眠) → ホルモン, 体内時計
    "sleep_time": {
        "before_10pm": {"hormone": 30, "circadian": 30},
        "before_11pm": {"hormone": 25, "circadian": 25},
        "before_12am": {"hormone": 15, "circadian": 15},
        "after_12am": {"hormone": 5, "circadian": 5},
        "after_1am": {"hormone": 0, "circadian": 0},
    },
    # 2. 起床固定 (睡眠) → 体内時計
    "wake_up_regular": {
        "always": {"circadian": 25},
        "often": {"circadian": 15},
        "sometimes": {"circadian": 8},
        "rarely": {"circadian": 0},
    },
    # 3. 朝日を浴びる (睡眠) → 体内時計
    "morning_sunlight": {
        "always": {"circadian": 25, "stress": 10},
        "often": {"circadian": 15, "stress": 5},
        "sometimes": {"circadian": 8, "stress": 2},
        "rarely": {"circadian": 0, "stress": 0},
    },
    # 4. 有酸素運動頻度 (運動) → 血流, ストレス
    "exercise_frequency": {
        "daily": {"blood_flow": 30, "stress": 25, "hormone": 10},
        "3_to_5_weekly": {"blood_flow": 25, "stress": 20, "hormone": 8},
        "1_to_2_weekly": {"blood_flow": 15, "stress": 12, "hormone": 5},
        "rarely": {"blood_flow": 5, "stress": 5, "hormone": 0},
        "never": {"blood_flow": 0, "stress": 0, "hormone": 0},
    },
    # 5. 肩こり/首こり (血流) → 血流
    "shoulder_stiffness": {
        "never": {"blood_flow": 25},
        "rarely": {"blood_flow": 18},
        "sometimes": {"blood_flow": 10},
        "often": {"blood_flow": 5},
        "always": {"blood_flow": 0},
    },
    # 6. 入浴スタイル (血流) → 血流, ストレス
    "bathing_style": {
        "long_bath": {"blood_flow": 25, "stress": 20},
        "short_bath": {"blood_flow": 15, "stress": 12},
        "shower_only": {"blood_flow": 5, "stress": 5},
        "rarely": {"blood_flow": 0, "stress": 0},
    },
    # 7. 目覚めの感覚 (ストレス) → ストレス
    "wake_feeling": {
        "refreshed": {"stress": 25, "hormone": 10},
        "normal": {"stress": 15, "hormone": 5},
        "tired": {"stress": 5, "hormone": 0},
        "exhausted": {"stress": 0, "hormone": 0},
    },
    # 8. リラックス習慣 (ストレス) → ストレス
    "relaxation_habit": {
        "daily": {"stress": 25},
        "often": {"stress": 18},
        "sometimes": {"stress": 10},
        "rarely": {"stress": 0},
    },
    # 9. 嗜好品チェック (複合) - マイナス要因として扱う
    "substances": {
        "none": {"hormone": 20, "blood_flow": 20, "circadian": 10, "stress": 10},
        "caffeine_only": {"hormone": 12, "blood_flow": 15, "circadian": 5, "stress": 8},
        "alcohol_only": {"hormone": 8, "blood_flow": 10, "circadian": 5, "stress": 5},
        "smoking_only": {"hormone": 5, "blood_flow": 0, "circadian": 5, "stress": 5},
        "multiple": {"hormone": 0, "blood_flow": 0, "circadian": 0, "stress": 0},
    },
    # 10. 水分摂取量 (血流) → 血流
    "water_intake": {
        "over_2L": {"blood_flow": 20},
        "1_to_2L": {"blood_flow": 15},
        "under_1L": {"blood_flow": 5},
        "very_little": {"blood_flow": 0},
    },
    # 条件分岐: 喫煙詳細
    "smoking_amount": {
        "none": {"blood_flow": 10, "hormone": 5},
        "less_than_5": {"blood_flow": 5, "hormone": 2},
        "5_to_10": {"blood_flow": 2, "hormone": 0},
        "over_10": {"blood_flow": 0, "hormone": 0},
    },
    # 条件分岐: 飲酒詳細
    "alcohol_frequency": {
        "rarely": {"hormone": 10, "circadian": 5, "blood_flow": 5},
        "1_to_2_weekly": {"hormone": 5, "circadian": 3, "blood_flow": 3},
        "3_to_5_weekly": {"hormone": 2, "circadian": 0, "blood_flow": 2},
        "daily": {"hormone": 0, "circadian": 0, "blood_flow": 0},
    },
    # 条件分岐: カフェイン詳細
    "caffeine_timing": {
        "morning_only": {"circadian": 10, "hormone": 5},
        "until_afternoon": {"circadian": 5, "hormone": 3},
        "evening_too": {"circadian": 0, "hormone": 0},
    },
}

# Maximum possible scores for normalization
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
        axis: min(100, int((raw / MAX_SCORES[axis]) * 100))
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
