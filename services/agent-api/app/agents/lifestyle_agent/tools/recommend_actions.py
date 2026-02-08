"""
Recommend actions tool: Maps low-scoring axes to improvement actions.

各軸の低スコアに対して、具体的な改善アクションを優先度順に提案する。
"""

from typing import TypedDict


class RecommendedAction(TypedDict):
    id: str
    name: str
    emoji: str
    duration: str
    reason: str
    explanation: str
    targets: list[str]  # axes this action improves
    priority: str  # "high" | "medium" | "low"


# Action definitions with their target axes and priority weights
ACTIONS_CATALOG: list[dict] = [
    {
        "id": "early_sleep",
        "name": "早寝（23時前就寝）",
        "emoji": "🌙",
        "duration": "毎日",
        "reason": "成長ホルモンの分泌を最大化",
        "explanation": "22時〜2時は成長ホルモンが最も分泌される時間帯。毛髪の成長に直結します。",
        "targets": {"hormone": 0.8, "circadian": 0.6, "stress": 0.3},
    },
    {
        "id": "regular_wake",
        "name": "起床時刻を固定",
        "emoji": "⏰",
        "duration": "毎日",
        "reason": "体内時計をリセット",
        "explanation": "毎日同じ時刻に起きることで、体内時計が整い、毛包幹細胞の活性化サイクルが正常化します。",
        "targets": {"circadian": 0.9, "hormone": 0.4},
    },
    {
        "id": "morning_sun",
        "name": "朝日を15分浴びる",
        "emoji": "☀️",
        "duration": "15分/朝",
        "reason": "メラトニン・セロトニン分泌調整",
        "explanation": "朝の光がセロトニン分泌を促し、夜のメラトニン分泌へつながります。スムーズな睡眠で成長ホルモン分泌がアップ。",
        "targets": {"circadian": 0.8, "stress": 0.4, "hormone": 0.3},
    },
    {
        "id": "aerobic_exercise",
        "name": "有酸素運動",
        "emoji": "🏃",
        "duration": "30分/日",
        "reason": "全身血行促進とストレス解消",
        "explanation": "ウォーキングやジョギングで血流が改善し、頭皮への栄養供給が向上します。エンドルフィン分泌でストレスも軽減。",
        "targets": {"blood_flow": 0.9, "stress": 0.7, "hormone": 0.3},
    },
    {
        "id": "neck_stretch",
        "name": "首・肩ストレッチ",
        "emoji": "🧘",
        "duration": "10分/日",
        "reason": "頭部への血流改善",
        "explanation": "首や肩のコリは頭皮への血流を阻害します。こまめなストレッチで血行を維持しましょう。",
        "targets": {"blood_flow": 0.8, "stress": 0.4},
    },
    {
        "id": "bath_soak",
        "name": "湯船入浴（38-40℃）",
        "emoji": "🛁",
        "duration": "15分/日",
        "reason": "深部体温上昇と副交感神経優位",
        "explanation": "ぬるめのお湯で15分浸かると、深部体温が上昇し、入浴後に下がることで入眠しやすくなります。リラックス効果も。",
        "targets": {"blood_flow": 0.8, "stress": 0.7, "circadian": 0.3},
    },
    {
        "id": "meditation",
        "name": "瞑想・深呼吸",
        "emoji": "🧘‍♂️",
        "duration": "10分/日",
        "reason": "コルチゾール低下",
        "explanation": "深い呼吸と瞑想でコルチゾール（ストレスホルモン）が低下。GAS6タンパク質のブロックを防ぎ、脱毛抑制に。",
        "targets": {"stress": 0.9, "hormone": 0.3},
    },
    {
        "id": "quit_smoking",
        "name": "禁煙",
        "emoji": "🚭",
        "duration": "継続",
        "reason": "血管収縮の防止",
        "explanation": "タバコのニコチンは血管を収縮させ、頭皮への血流を著しく低下させます。禁煙は最も効果的な血流改善策です。",
        "targets": {"blood_flow": 1.0, "hormone": 0.4},
    },
    {
        "id": "limit_alcohol",
        "name": "節酒",
        "emoji": "🍺",
        "duration": "週2日以下",
        "reason": "成長ホルモン分泌への悪影響を軽減",
        "explanation": "アルコールは成長ホルモンの分泌を抑制します。週2日以下に控えることで影響を最小限に。",
        "targets": {"hormone": 0.8, "circadian": 0.5, "blood_flow": 0.3},
    },
    {
        "id": "limit_caffeine",
        "name": "カフェイン制限（午後2時以降は避ける）",
        "emoji": "☕",
        "duration": "毎日",
        "reason": "睡眠の質改善",
        "explanation": "カフェインは体内に6時間以上残ります。午後早めに最後のカフェインを摂り、夜の睡眠をしっかり確保しましょう。",
        "targets": {"circadian": 0.7, "hormone": 0.5, "stress": 0.2},
    },
    {
        "id": "hydration",
        "name": "水分摂取（2L/日）",
        "emoji": "💧",
        "duration": "毎日",
        "reason": "血液粘度を下げ血流改善",
        "explanation": "脱水状態では血液がドロドロになり、頭皮への栄養供給が低下します。こまめな水分補給が大切です。",
        "targets": {"blood_flow": 0.8},
    },
    {
        "id": "head_massage",
        "name": "頭皮マッサージ",
        "emoji": "💆",
        "duration": "5分/日",
        "reason": "直接的な血行促進",
        "explanation": "指の腹で頭皮を優しく揉みほぐすことで、毛根への血流が直接改善します。入浴時がおすすめ。",
        "targets": {"blood_flow": 0.7, "stress": 0.3},
    },
]


def get_recommended_actions(
    scores: dict[str, int],
    max_actions: int = 5,
) -> list[RecommendedAction]:
    """
    低スコアの軸に基づいて、推奨アクションを優先度順に返す。

    Args:
        scores: 4軸スコア { "hormone": 45, "circadian": 60, ... }
        max_actions: 返すアクション数の上限

    Returns:
        優先度順の推奨アクションリスト
    """
    # Calculate priority score for each action based on how much it helps low-scoring axes
    action_priorities: list[tuple[dict, float]] = []

    for action in ACTIONS_CATALOG:
        priority_score = 0.0
        target_axes = []

        for axis, weight in action["targets"].items():
            axis_score = scores.get(axis, 50)
            # Lower axis score = higher need for improvement
            # Priority = (100 - axis_score) * weight
            need = (100 - axis_score) / 100.0
            priority_score += need * weight
            if axis_score < 60:  # Include as target if below threshold
                target_axes.append(axis)

        if priority_score > 0.3:  # Threshold to include action
            action_priorities.append((action, priority_score, target_axes))

    # Sort by priority (descending)
    action_priorities.sort(key=lambda x: x[1], reverse=True)

    # Build result list
    result: list[RecommendedAction] = []
    for action, priority, targets in action_priorities[:max_actions]:
        priority_label = "high" if priority > 0.6 else "medium" if priority > 0.4 else "low"
        result.append(
            RecommendedAction(
                id=action["id"],
                name=action["name"],
                emoji=action["emoji"],
                duration=action["duration"],
                reason=action["reason"],
                explanation=action["explanation"],
                targets=targets if targets else list(action["targets"].keys())[:2],
                priority=priority_label,
            )
        )

    return result


# Axis labels for frontend display
AXIS_LABELS = {
    "hormone": {"name": "ホルモン", "emoji": "⚖️", "color": "#ec4899"},
    "circadian": {"name": "体内時計", "emoji": "⏰", "color": "#8b5cf6"},
    "blood_flow": {"name": "血流", "emoji": "🩸", "color": "#3b82f6"},
    "stress": {"name": "ストレス", "emoji": "😰", "color": "#f59e0b"},
}
