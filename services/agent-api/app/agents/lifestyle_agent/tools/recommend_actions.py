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
    # --- Hormone (Growth Hormone / Melatonin) ---
    {
        "id": "early_sleep",
        "name": "23時までの就寝",
        "emoji": "🌙",
        "duration": "毎日",
        "reason": "成長ホルモン分泌の最大化",
        "explanation": "22時〜2時は成長ホルモン分泌のゴールデンタイム。髪の修復と成長に不可欠です。",
        "tips": ["就寝1時間前はスマホを見ない", "部屋を完全に暗くする", "夕食は就寝3時間前に済ませる"],
        "targets": {"hormone": 1.0, "circadian": 0.7, "stress": 0.5},
    },
    {
        "id": "protein_breakfast",
        "name": "朝食でタンパク質20g",
        "emoji": "🍳",
        "duration": "毎朝",
        "reason": "髪の原料を確保",
        "explanation": "髪の主成分ケラチンの材料となるタンパク質を、朝からしっかり摂取しましょう。",
        "tips": ["ゆで卵2個を追加する", "プロテインドリンクを活用する", "納豆ご飯と味噌汁をセットにする"],
        "targets": {"hormone": 0.9, "blood_flow": 0.3},
    },
    {
        "id": "zinc_intake",
        "name": "亜鉛を含む食材を摂る",
        "emoji": "🦪",
        "duration": "毎日",
        "reason": "細胞分裂の促進",
        "explanation": "亜鉛は毛母細胞の分裂を助けます。牡蠣、レバー、ナッツ類に多く含まれます。",
        "tips": ["おやつにアーモンドを食べる", "夕食に豚レバーを取り入れる", "サプリメントで補う"],
        "targets": {"hormone": 0.8},
    },
    {
        "id": "limit_alcohol",
        "name": "休肝日を作る",
        "emoji": "🍺",
        "duration": "週2日",
        "reason": "成長ホルモンの阻害防止",
        "explanation": "アルコール分解にエネルギーが使われると、髪の修復がおろそかになります。",
        "tips": ["ノンアルコールビールで代用", "炭酸水で満足感を得る", "飲まない日をカレンダーに記録する"],
        "targets": {"hormone": 0.8, "blood_flow": 0.4},
    },
    {
        "id": "resistance_training",
        "name": "スクワット30回",
        "emoji": "🏋️",
        "duration": "1日1回",
        "reason": "成長ホルモン分泌刺激",
        "explanation": "大きな筋肉（太ももなど）を使う筋トレは、成長ホルモンの分泌を強力に促します。",
        "tips": ["歯磨き中にスクワット", "椅子に座る動作をゆっくり行う", "テレビを見ながら実践"],
        "targets": {"hormone": 0.9, "blood_flow": 0.7, "stress": 0.4},
    },
    {
        "id": "hot_milk",
        "name": "寝る前のホットミルク",
        "emoji": "🥛",
        "duration": "就寝30分前",
        "reason": "トリプトファン摂取",
        "explanation": "牛乳に含まれるトリプトファンは、睡眠ホルモン「メラトニン」の材料になります。",
        "tips": ["ハチミツを少し加える", "電子レンジで温めるだけ", "豆乳でもOK"],
        "targets": {"hormone": 0.7, "stress": 0.6},
    },
    {
        "id": "avoid_late_meal",
        "name": "夕食は20時までに",
        "emoji": "🍽️",
        "duration": "毎日",
        "reason": "消化活動と睡眠の分離",
        "explanation": "胃に物が残っていると睡眠の質が下がり、成長ホルモン分泌が妨げられます。",
        "tips": ["残業時は分食する（夕方に軽食、帰宅後は消化の良いもの）", "揚げ物は昼食にする", "食後はすぐ寝ない"],
        "targets": {"hormone": 0.8, "circadian": 0.5},
    },
    {
        "id": "vitamin_b",
        "name": "ビタミンB群の摂取",
        "emoji": "🐖",
        "duration": "毎日",
        "reason": "代謝の活性化",
        "explanation": "ビタミンB2、B6は髪の毛の代謝を助け、皮脂分泌をコントロールします。",
        "tips": ["豚肉料理を選ぶ", "バナナをおやつにする", "カツオやマグロを刺身で食べる"],
        "targets": {"hormone": 0.7, "blood_flow": 0.4},
    },
    {
        "id": "soy_isoflavone",
        "name": "大豆製品を摂る",
        "emoji": "🫘",
        "duration": "毎日 1品",
        "reason": "ホルモンバランス調整",
        "explanation": "イソフラボンは女性ホルモンに似た働きをし、髪のハリコシを保ちます（男性にも有効）。",
        "tips": ["豆腐を一丁食べる", "納豆を常備する", "味噌汁を飲む"],
        "targets": {"hormone": 0.8},
    },
    {
        "id": "start_fasting",
        "name": "12時間断食（夕食〜朝食）",
        "emoji": "⏳",
        "duration": "毎日",
        "reason": "内臓休息と修復",
        "explanation": "空腹時間を確保することでオートファジーが働き、細胞の修復が進みます。",
        "tips": ["夕食を19時に終え、朝食を7時にとる", "水かお茶は飲んでOK", "週末だけ実践してみる"],
        "targets": {"hormone": 0.7, "circadian": 0.6},
    },

    # --- Circadian (Body Clock / Sleep Rhythm) ---
    {
        "id": "morning_sun",
        "name": "起床後すぐの朝日",
        "emoji": "☀️",
        "duration": "15分",
        "reason": "体内時計のリセット",
        "explanation": "朝の強い光を浴びることで体内時計がリセットされ、夜の自然な眠気を誘います。",
        "tips": ["カーテンを開けて窓際に立つ", "ベランダに出て深呼吸", "通勤時は日向を歩く"],
        "targets": {"circadian": 1.0, "stress": 0.4, "hormone": 0.5},
    },
    {
        "id": "fixed_wake_time",
        "name": "起床時刻の固定",
        "emoji": "⏰",
        "duration": "毎日",
        "reason": "リズムの安定化",
        "explanation": "休日も平日と同じ時間に起きることで、ソーシャル・ジェットラグ（社会的時差ボケ）を防ぎます。",
        "tips": ["休日の寝坊は+1時間まで", "目覚ましを遠くに置く", "起きたらすぐに水を飲む"],
        "targets": {"circadian": 0.9, "hormone": 0.4},
    },
    {
        "id": "breakfast_timing",
        "name": "起床1時間以内の朝食",
        "emoji": "🥣",
        "duration": "毎朝",
        "reason": "腹時計のリセット",
        "explanation": "光だけでなく、食事（咀嚼と消化）も体内時計を整える重要なスイッチです。",
        "tips": ["バナナ1本でもOK", "温かいスープを飲む", "プロテインだけでも飲む"],
        "targets": {"circadian": 0.8, "blood_flow": 0.3},
    },
    {
        "id": "limit_blue_light",
        "name": "夜のブルーライトカット",
        "emoji": "📱",
        "duration": "就寝2時間前",
        "reason": "メラトニン抑制の防止",
        "explanation": "スマホやPCの青い光は脳を覚醒させ、睡眠ホルモンの分泌を止めてしまいます。",
        "tips": ["画面の明るさを最低にする", "ナイトモード設定を使う", "読書や音楽に切り替える"],
        "targets": {"circadian": 0.9, "hormone": 0.6, "stress": 0.3},
    },
    {
        "id": "warm_bath_timing",
        "name": "就寝90分前の入浴",
        "emoji": "🛁",
        "duration": "15分",
        "reason": "深部体温の低下誘導",
        "explanation": "入浴で上げた体温が下がるタイミングで布団に入ると、スムーズに入眠できます。",
        "tips": ["お風呂上がりは靴下を履かない", "髪をしっかり乾かして冷えを防ぐ", "湯上がり後のスマホを控える"],
        "targets": {"circadian": 0.8, "blood_flow": 0.7, "stress": 0.6},
    },
    {
        "id": "daytime_nap",
        "name": "パワーナップ（15分昼寝）",
        "emoji": "💤",
        "duration": "15分",
        "reason": "脳の疲労回復",
        "explanation": "午後の眠気を解消し、夜の睡眠圧（眠気）を適切なレベルに保ちます。",
        "tips": ["15時までに済ませる", "寝る前にカフェインを摂る（カフェインナップ）", "横にならず机に伏せる"],
        "targets": {"circadian": 0.6, "stress": 0.5},
    },
    {
        "id": "room_temperature",
        "name": "寝室温度の最適化",
        "emoji": "🌡️",
        "duration": "就寝時",
        "reason": "睡眠深度の維持",
        "explanation": "暑すぎず寒すぎない環境（夏26℃、冬20℃前後）が、中途覚醒を防ぎます。",
        "tips": ["エアコンのタイマーを活用", "通気性の良いパジャマを選ぶ", "掛け布団で微調整"],
        "targets": {"circadian": 0.7, "hormone": 0.4},
    },
    {
        "id": "limit_caffeine_pm",
        "name": "14時以降カフェインレス",
        "emoji": "☕",
        "duration": "毎日",
        "reason": "覚醒作用の排除",
        "explanation": "カフェインの半減期は長く、夕方のコーヒーが夜の睡眠を浅くします。",
        "tips": ["午後は麦茶かルイボスティー", "デカフェコーヒーを選ぶ", "水筒を持参する"],
        "targets": {"circadian": 0.8, "stress": 0.3},
    },
    {
        "id": "dinner_light",
        "name": "夕食時は間接照明",
        "emoji": "💡",
        "duration": "夕方以降",
        "reason": "副交感神経への切り替え",
        "explanation": "コンビニのような白い光は避け、暖色系の明かりで脳をリラックスモードへ。",
        "tips": ["天井の照明を消してスタンドライトにする", "キャンドルを炊く", "調光機能を使う"],
        "targets": {"circadian": 0.7, "stress": 0.6},
    },
    {
        "id": "dark_room_sleep",
        "name": "完全遮光で寝る",
        "emoji": "🌃",
        "duration": "就寝中",
        "reason": "メラトニン維持",
        "explanation": "豆電球の明かりでもメラトニン分泌は抑制されます。真っ暗が理想です。",
        "tips": ["遮光カーテンを使う", "アイマスクを着用する", "家電の待機ランプを隠す"],
        "targets": {"circadian": 0.8, "hormone": 0.5},
    },

    # --- Blood Flow (Scalp Circulation / Vascular Health) ---
    {
        "id": "scalp_massage_basic",
        "name": "頭皮もみほぐし",
        "emoji": "💆",
        "duration": "3分/日",
        "reason": "物理的な血流促進",
        "explanation": "指の腹で頭皮を動かすようにマッサージし、毛細血管の血流を促します。",
        "tips": ["シャンプー時に行う", "生え際から頭頂部へ持ち上げる", "強くこすらない"],
        "targets": {"blood_flow": 1.0, "stress": 0.4},
    },
    {
        "id": "neck_stretch",
        "name": "首の後ろストレッチ",
        "emoji": "🦒",
        "duration": "1分",
        "reason": "頭部への血流路確保",
        "explanation": "首の後ろが硬いと、心臓から頭への血流が滞ります。しっかり伸ばしましょう。",
        "tips": ["両手で頭を抱えて前に倒す", "息を吐きながら行う", "デスクワークの合間に"],
        "targets": {"blood_flow": 0.9, "stress": 0.5},
    },
    {
        "id": "hydration_2l",
        "name": "水2リットル摂取",
        "emoji": "💧",
        "duration": "1日通して",
        "reason": "血液サラサラ化",
        "explanation": "水分不足は血液をドロドロにし、微細な頭皮血管への流れを悪くします。",
        "tips": ["トイレに行ったらコップ1杯飲む", "起床時に白湯を飲む", "水筒を持ち歩く"],
        "targets": {"blood_flow": 0.8, "hormone": 0.2},
    },
    {
        "id": "shoulder_rotation",
        "name": "肩甲骨回し",
        "emoji": "🔄",
        "duration": "20回",
        "reason": "上半身の循環改善",
        "explanation": "肩甲骨周りの褐色脂肪細胞を刺激し、体温を上げて血流を良くします。",
        "tips": ["肘を肩より高く上げる", "前回しと後ろ回しを交互に", "ゴリゴリ鳴るまで大きく"],
        "targets": {"blood_flow": 0.8, "stress": 0.4},
    },
    {
        "id": "quit_smoking",
        "name": "禁煙チャレンジ",
        "emoji": "🚭",
        "duration": "継続",
        "reason": "血管収縮の解除",
        "explanation": "タバコは毛細血管を収縮させ、髪への酸素供給をダイレクトに阻害します。",
        "tips": ["吸いたくなったら深呼吸", "ガムを噛む", "禁煙外来を検討する"],
        "targets": {"blood_flow": 1.0, "hormone": 0.5},
    },
    {
        "id": "walking_commute",
        "name": "一駅分ウォーキング",
        "emoji": "🚶",
        "duration": "20分",
        "reason": "ポンプ機能の活性化",
        "explanation": "ふくらはぎを使うことで全身の血流ポンプが働き、頭皮まで血が巡ります。",
        "tips": ["早歩きを意識する", "階段を使う", "スニーカー通勤を検討"],
        "targets": {"blood_flow": 0.9, "stress": 0.6, "circadian": 0.3},
    },
    {
        "id": "alternate_bath",
        "name": "温冷交代浴（手足）",
        "emoji": "🛀",
        "duration": "5分",
        "reason": "血管の拡張収縮トレーニング",
        "explanation": "お湯と冷水を交互に手足にかけることで、自律神経と血管の反応を良くします。",
        "tips": ["40度のお湯3分→20度の水1分", "最後は水で終わる", "シャワーだけでOK"],
        "targets": {"blood_flow": 0.8, "stress": 0.5, "circadian": 0.4},
    },
    {
        "id": "reduce_salt",
        "name": "減塩・カリウム摂取",
        "emoji": "🧂",
        "duration": "食事毎",
        "reason": "高血圧予防・血管ケア",
        "explanation": "塩分の摂りすぎは血管を傷つけます。カリウム（野菜・果物）で排出を促しましょう。",
        "tips": ["麺類のスープは残す", "醤油はかけるよりつける", "バナナやアボカドを食べる"],
        "targets": {"blood_flow": 0.6, "hormone": 0.3},
    },
    {
        "id": "omega3",
        "name": "青魚・オメガ3摂取",
        "emoji": "🐟",
        "duration": "週3回",
        "reason": "血液柔軟化",
        "explanation": "DHA/EPAや亜麻仁油は、赤血球を柔らかくし、細い血管を通りやすくします。",
        "tips": ["サバ缶を活用する", "サラダに亜麻仁油をかける", "週3回は魚料理にする"],
        "targets": {"blood_flow": 0.7, "hormone": 0.4},
    },
    {
        "id": "ear_massage",
        "name": "耳たぶ回し・マッサージ",
        "emoji": "👂",
        "duration": "1分",
        "reason": "側頭部の血行促進",
        "explanation": "耳の周りには太い血管があります。温かくなるまで揉むと顔や頭の血色が良くなります。",
        "tips": ["耳を横に引っ張る", "くるくる回す", "耳を折りたたむ"],
        "targets": {"blood_flow": 0.7, "stress": 0.3},
    },

    # --- Stress (Autonomic Nervous System / Cortisol) ---
    {
        "id": "deep_breathing_478",
        "name": "4-7-8呼吸法",
        "emoji": "🌬️",
        "duration": "3分",
        "reason": "副交感神経優位への切り替え",
        "explanation": "4秒吸って、7秒止め、8秒かけて吐く。強制的にリラックスモードに入れます。",
        "tips": ["寝る前に行うと効果的", "お腹を膨らませる腹式呼吸で", "3セット繰り返す"],
        "targets": {"stress": 1.0, "circadian": 0.5},
    },
    {
        "id": "nature_walk",
        "name": "緑の中を散歩",
        "emoji": "🌲",
        "duration": "週末",
        "reason": "コルチゾール低下",
        "explanation": "自然に触れることでストレスホルモンが減少し、免疫力が上がります。",
        "tips": ["近くの公園でOK", "スマホを見ずに歩く", "木々の音に耳を澄ます"],
        "targets": {"stress": 0.9, "circadian": 0.6, "blood_flow": 0.5},
    },
    {
        "id": "digital_detox",
        "name": "1日1時間のスマホ断ち",
        "emoji": "📵",
        "duration": "毎日",
        "reason": "脳疲労の回復",
        "explanation": "絶え間ない情報の流入を止めることで、脳を休ませストレスを軽減します。",
        "tips": ["食事中はスマホを別室に", "トイレに持ち込まない", "機内モードにする"],
        "targets": {"stress": 0.8, "circadian": 0.5},
    },
    {
        "id": "aroma_therapy",
        "name": "好きな香りでリラックス",
        "emoji": "🌺",
        "duration": "夜",
        "reason": "大脳辺縁系への直接作用",
        "explanation": "ラベンダーやヒノキなどの香りは、理屈抜きで脳を鎮静化させます。",
        "tips": ["枕元にアロマオイルを1滴", "入浴剤の香りにこだわる", "ハンドクリームの香りを嗅ぐ"],
        "targets": {"stress": 0.8, "hormone": 0.3},
    },
    {
        "id": "mindfulness",
        "name": "マインドフルネス瞑想",
        "emoji": "🧘‍♂️",
        "duration": "5分",
        "reason": "「今ここ」への集中",
        "explanation": "過去の後悔や未来の不安から離れ、今の呼吸に意識を向ける練習です。",
        "tips": ["あぐらをかいて目を閉じる", "呼吸の出入りだけを感じる", "雑念が湧いても自分を責めない"],
        "targets": {"stress": 1.0, "hormone": 0.2},
    },
    {
        "id": "laugh_out_loud",
        "name": "お笑いを見て笑う",
        "emoji": "😆",
        "duration": "10分",
        "reason": "NK細胞活性化",
        "explanation": "笑うことで免疫力が上がり、ストレスが発散されます。作り笑いでも効果あり。",
        "tips": ["好きなお笑い動画を見る", "鏡の前で口角を上げる", "コメディ映画を観る"],
        "targets": {"stress": 0.8, "blood_flow": 0.3},
    },
    {
        "id": "journaling",
        "name": "感情の書き出し（ジャーナリング）",
        "emoji": "📓",
        "duration": "5分",
        "reason": "ストレスの客観視",
        "explanation": "モヤモヤしていることを紙に書き出すだけで、脳の処理容量が解放されます。",
        "tips": ["誰にも見せないつもりで書く", "寝る前に頭を空っぽにする", "感謝できることを3つ書く"],
        "targets": {"stress": 0.9},
    },
    {
        "id": "chew_gum",
        "name": "ガムを噛む",
        "emoji": "🍬",
        "duration": "作業中",
        "reason": "リズム運動によるセロトニン分泌",
        "explanation": "一定のリズムで噛む動作はセロトニンを増やし、精神を安定させます。",
        "tips": ["仕事の合間に", "運転中のイライラ防止に", "シュガーレスを選ぶ"],
        "targets": {"stress": 0.7, "blood_flow": 0.2},
    },
    {
        "id": "hugging",
        "name": "ハグ・スキンシップ",
        "emoji": "🫂",
        "duration": "30秒",
        "reason": "オキシトシン分泌",
        "explanation": "パートナーやペットとの触れ合いは、幸せホルモン「オキシトシン」を分泌させます。",
        "tips": ["抱き枕でも効果あり", "ペットを撫でる", "マッサージを受ける"],
        "targets": {"stress": 0.9, "hormone": 0.3},
    },
    {
        "id": "clean_desk",
        "name": "机の上を片付ける",
        "emoji": "🧹",
        "duration": "5分",
        "reason": "視覚的ノイズの低減",
        "explanation": "視界に入る情報量を減らすことで、無意識のストレスを減らせます。",
        "tips": ["1日1箇所だけ片付ける", "ゴミを捨てる", "スマホのホーム画面を整理する"],
        "targets": {"stress": 0.6, "circadian": 0.2},
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
