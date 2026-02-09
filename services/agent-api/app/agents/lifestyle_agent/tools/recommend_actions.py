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
    tips: list[str]  # Detailed advice/next steps
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
        "explanation": "22時〜2時は成長ホルモンが最も分泌される時間帯。毛細細胞の修復や髪の成長に直結します。",
        "tips": [
            "就寝1時間前にはスマホ画面を閉じ、リラックスタイムを設ける。",
            "23時までに完全に消灯し、部屋を静かで涼しい状態に保つ。",
            "休日も大きく時間をずらさないように意識する。"
        ],
        "variants": [
            "23時までに布団に入る",
            "就寝15分前にスマホを手放す",
            "22時から部屋の照明を暗くする"
        ],
        "targets": {"hormone": 0.8, "circadian": 0.6, "stress": 0.3},
    },
    {
        "id": "regular_wake",
        "name": "起床時刻を固定",
        "emoji": "⏰",
        "duration": "毎日",
        "reason": "体内時計をリセット",
        "explanation": "毎日同じ時刻に起きることで、体内時計が整い、毛細幹細胞の活性化サイクルが正常化します。",
        "tips": [
            "土日も平日との差を1時間以内にとどめる。",
            "起きたらすぐにカーテンを開けて太陽の光を浴び、脳を覚醒させる。",
            "昼寝をする場合は15分〜20分以内に抑え、夜の睡眠に影響させない。"
        ],
        "variants": [
            "明日も同じ時間に起きる",
            "目覚ましをセットする",
            "起きたらすぐに水を飲む"
        ],
        "targets": {"circadian": 0.9, "hormone": 0.4},
    },
    {
        "id": "morning_sun",
        "name": "朝日を15分浴びる",
        "emoji": "☀️",
        "duration": "15分/朝",
        "reason": "メラトニン・セロトニン分泌調整",
        "explanation": "朝の光がセロトニン分泌を促し、夜のメラトニン分泌へつながります。スムーズな睡眠で成長ホルモン分泌がアップ。",
        "tips": [
            "ベランダに出るか、窓際で日光を直接感じる（ガラス越しでも可）。",
            "朝食を窓際で摂る習慣をつけると継続しやすい。",
            "曇りや雨の日でも、外の明るさは体内時計リセットに十分効果あり。"
        ],
        "variants": [
            "起きたらカーテンを全開にする",
            "ベランダで深呼吸する",
            "窓際で朝食をとる"
        ],
        "targets": {"circadian": 0.8, "stress": 0.4, "hormone": 0.3},
    },
    {
        "id": "aerobic_exercise",
        "name": "有酸素運動",
        "emoji": "🏃",
        "duration": "30分/日",
        "reason": "全身血行促進とストレス解消",
        "explanation": "ウォーキングやジョギングで血流が改善し、頭皮への栄養供給が向上します。エンドルフィン分泌でストレスも軽減。",
        "tips": [
            "まずは「一駅分歩く」など、生活の中に組み込みやすいことから始める。",
            "週3回、汗をわずかにかく程度の早歩きからで十分効果的。",
            "運動後はぬるめのシャワーで汗を流し、リラックスする。"
        ],
        "variants": [
            "一駅分歩いて帰る",
            "20分の早歩き散歩",
            "階段を使う"
        ],
        "targets": {"blood_flow": 0.9, "stress": 0.7, "hormone": 0.3},
    },
    {
        "id": "neck_stretch",
        "name": "首・肩ストレッチ",
        "emoji": "🧘",
        "duration": "10分/日",
        "reason": "頭部への血流改善",
        "explanation": "首や肩のコリは頭皮への血流を阻害します。こまめなストレッチで血行を維持しましょう。",
        "tips": [
            "デスクワークで1時間経つごとに、肩甲骨を大きく回す。",
            "耳を肩に近づけるように首を左右にゆっくり倒し、15秒ずつキープ。",
            "お風呂上がりなど、筋肉が温まっている時に行うのが最も効果的。"
        ],
        "variants": [
            "肩甲骨を20回まわす",
            "首をゆっくり左右に倒す",
            "仕事の合間に伸びをする"
        ],
        "targets": {"blood_flow": 0.8, "stress": 0.4},
    },
    {
        "id": "bath_soak",
        "name": "湯船入浴（38-40℃）",
        "emoji": "🛁",
        "duration": "15分/日",
        "reason": "深部体温上昇と副交感神経優位",
        "explanation": "ぬるめのお湯で15分浸かると、深部体温が上昇し、入浴後に下がることで入眠しやすくなります。リラックス効果も。",
        "tips": [
            "お湯の温度は40度を超えないように設定し、交感神経を刺激しすぎない。",
            "お気に入りの入浴剤（炭酸ガス系など）を使うと血行促進効果がアップ。",
            "お風呂の中で深呼吸を意識すると、ストレスケアにも非常に効果的。"
        ],
        "variants": [
            "15分しっかり湯船に浸かる",
            "入浴剤を入れてリラックス",
            "お風呂でスマホを見ない"
        ],
        "targets": {"blood_flow": 0.8, "stress": 0.7, "circadian": 0.3},
    },
    {
        "id": "meditation",
        "name": "瞑想・深呼吸",
        "emoji": "🧘‍♂️",
        "duration": "10分/日",
        "reason": "コルチゾール低下",
        "explanation": "深い呼吸と瞑想でコルチゾール（ストレスホルモン）が低下。GAS6タンパク質のブロックを防ぎ、脱毛抑制に。",
        "tips": [
            "4秒で吸って、8秒でゆっくり吐き出すリズムを意識する。",
            "雑念が浮かんでも無視せず、「あ、今考えてるな」と客観視して呼吸に戻る。",
            "寝る前や仕事の合間など、静かな場所で1日5分からでもOK。"
        ],
        "variants": [
            "5分間目を閉じて深呼吸",
            "4秒吸って8秒吐く呼吸法",
            "寝る前に今日を振り返る"
        ],
        "targets": {"stress": 0.9, "hormone": 0.3},
    },
    {
        "id": "quit_smoking",
        "name": "禁煙",
        "emoji": "🚭",
        "duration": "継続",
        "reason": "血管収縮の防止",
        "explanation": "タバコのニコチンは血管を収縮させ、頭皮への血流を著しく低下させます。禁煙は最も効果的な血流改善策です。",
        "tips": [
            "まずは本数を減らすのではなく、完全に断つ日（休煙日）を数日設ける。",
            "口寂しい時は冷たい水やミントガム、深呼吸で代用する。",
            "自力で難しい場合は、禁煙外来やパッチなどのサポートを利用する。"
        ],
        "variants": [
            "今日は一本も吸わない",
            "吸いたくなったら深呼吸",
            "ガムを噛んで紛らわす"
        ],
        "targets": {"blood_flow": 1.0, "hormone": 0.4},
    },
    {
        "id": "limit_alcohol",
        "name": "節酒",
        "emoji": "🍺",
        "duration": "週2日以下",
        "reason": "成長ホルモン分泌への悪影響を軽減",
        "explanation": "アルコールは成長ホルモンの分泌を抑制します。週2日以下に控えることで影響を最小限に。",
        "tips": [
            "休肝日を週に2日以上設定し、肝臓を休ませる機会を作る。",
            "お酒と同量以上の水を一緒に飲む（チェイサー）ことで分解を助ける。",
            "就寝前の3時間は飲酒を控えることで、睡眠の質の低下を防ぐ。"
        ],
        "variants": [
            "今日は休肝日にする",
            "お酒と同量の水を飲む",
            "寝る3時間前にお酒をやめる"
        ],
        "targets": {"hormone": 0.8, "circadian": 0.5, "blood_flow": 0.3},
    },
    {
        "id": "limit_caffeine",
        "name": "カフェイン制限",
        "emoji": "☕",
        "duration": "午後2時以降制限",
        "reason": "睡眠の質改善",
        "explanation": "カフェインは体内に6時間以上残ります。午後早めに最後のカフェインを摂り、夜の睡眠をしっかり確保しましょう。",
        "tips": [
            "午後のリフレッシュには、カフェインレスのハーブティーや炭酸水を使う。",
            "どうしても飲みたい場合は少量にとどめ、就寝への影響を意識する。",
            "朝一番のコーヒーは、起床から90分以上空けると目覚めにより効果的。"
        ],
        "variants": [
            "14時以降はカフェインレス",
            "コーヒーの代わりに水を飲む",
            "夕食後のコーヒーを控える"
        ],
        "targets": {"circadian": 0.7, "hormone": 0.5, "stress": 0.2},
    },
    {
        "id": "hydration",
        "name": "水分摂取（2L/日）",
        "emoji": "💧",
        "duration": "毎日",
        "reason": "血液粘度を下げ血流改善",
        "explanation": "脱水状態では血液がドロドロになり、頭皮への栄養供給が低下します。こまめな水分補給が大切です。",
        "tips": [
            "一気に飲むのではなく、コップ1杯の水をこまめに（1日8回程度）飲む。",
            "常温の水や白湯を飲むことで、胃腸への負担を減らし吸収を良くする。",
            "起床時と入浴前後には必ずコップ1杯の水を摂取する。"
        ],
        "variants": [
            "コップ1杯の水を飲む",
            "ペットボトル1本分飲み切る",
            "起床時に白湯を飲む"
        ],
        "targets": {"blood_flow": 0.8},
    },
    {
        "id": "head_massage",
        "name": "頭皮マッサージ",
        "emoji": "💆",
        "duration": "5分/日",
        "reason": "直接的な血行促進",
        "explanation": "指の腹で頭皮を優しく揉みほぐすことで、毛細血管の血流が改善します。リラックス効果も絶大。",
        "tips": [
            "「こめかみ」から「頭頂部」に向けて、円を描くように動かす。",
            "頭皮を「こする」のではなく、皮下組織を「動かす」イメージで行う。",
            "お風呂の中でトリートメントをしている時など、1日3分程度で十分。"
        ],
        "variants": [
            "シャンプー中にマッサージ",
            "こめかみを30秒ほぐす",
            "耳の周りをマッサージ"
        ],
        "targets": {"blood_flow": 0.7, "stress": 0.3},
    },
]


def _should_recommend(action_id: str, answers: dict[str, str]) -> bool:
    """
    Check if an action is appropriate based on user answers.
    """
    if not answers:
        return True

    substances = answers.get("substances", "none")

    if action_id == "quit_smoking":
        # Recommend only if user smokes
        if substances not in ("smoking", "multiple"):
            return False
    
    if action_id == "limit_alcohol":
        # Recommend only if user drinks
        if substances not in ("alcohol", "multiple"):
            return False

    if action_id == "limit_caffeine":
        # Recommend only if user takes caffeine
        if substances not in ("caffeine", "multiple"):
            return False

    return True


def get_recommended_actions(
    scores: dict[str, int],
    answers: dict[str, str] = None,
    max_actions_per_axis: int = 3,
) -> dict[str, list[RecommendedAction]]:
    """
    低スコアの軸に基づいて、推奨アクションを軸ごとにグルーピングして返す。

    Args:
        scores: 4軸スコア { "hormone": 45, "circadian": 60, ... }
        answers: 問診回答 { "substances": "none", ... }
        max_actions_per_axis: 各軸で返すアクション数の上限

    Returns:
        { "hormone": [Action1, ...], "circadian": [...], ... }
    """
    answers = answers or {}
    grouped_actions: dict[str, list[RecommendedAction]] = {
        "hormone": [],
        "circadian": [],
        "blood_flow": [],
        "stress": [],
    }

    # Iterate over each axis to find relevant actions
    for axis in grouped_actions.keys():
        axis_score = scores.get(axis, 50)
        
        # If score is high (e.g. > 80), maybe we don't need many recommendations?
        # But user might still want to see what is good.
        # We prioritize actions that have high weight for this axis.

        relevant_actions = []
        for action in ACTIONS_CATALOG:
            # 1. Check answer compatibility
            if not _should_recommend(action["id"], answers):
                continue

            # 2. Check if action targets this axis
            if axis in action["targets"]:
                weight = action["targets"][axis]
                
                # Calculate priority for this specific axis
                # Priority = weight * (Need based on score?)
                # For grouping, we just want the most effective actions for this axis.
                priority = weight
                
                relevant_actions.append((action, priority))

        # Sort by priority (descending)
        relevant_actions.sort(key=lambda x: x[1], reverse=True)

        # Convert to RecommendedAction model
        for action_dict, _ in relevant_actions[:max_actions_per_axis]:
            # Determine overall priority label
            # (Just reusing high/medium/low logic or static based on weight)
            p_val = action_dict["targets"][axis]
            priority_label = "high" if p_val >= 0.8 else "medium" if p_val >= 0.5 else "low"

            grouped_actions[axis].append(
                RecommendedAction(
                    id=action_dict["id"],
                    name=action_dict["name"],
                    emoji=action_dict["emoji"],
                    duration=action_dict["duration"],
                    reason=action_dict["reason"],
                    explanation=action_dict["explanation"],
                    tips=action_dict.get("tips", []),
                    targets=list(action_dict["targets"].keys()), # Show all targets
                    priority=priority_label,
                )
            )

    return grouped_actions


# Axis labels for frontend display
AXIS_LABELS = {
    "hormone": {"name": "ホルモン", "emoji": "⚖️", "color": "#ec4899"},
    "circadian": {"name": "体内時計", "emoji": "⏰", "color": "#8b5cf6"},
    "blood_flow": {"name": "血流", "emoji": "🩸", "color": "#3b82f6"},
    "stress": {"name": "ストレス", "emoji": "😰", "color": "#f59e0b"},
}
