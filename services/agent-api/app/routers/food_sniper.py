import logging
import uuid
import json
from typing import List, Optional

from fastapi import APIRouter, Depends
from firebase_admin import firestore as admin_firestore
from firebase_admin.exceptions import FirebaseError
from google.cloud.exceptions import GoogleCloudError
from pydantic import BaseModel, Field, validator

from ..auth import get_current_uid
from ..firebase import get_firestore_client
from ..services.gemini_chat import gemini_enabled, generate_text, safe_json_load
from ..config import GEMINI_MODEL

router = APIRouter(prefix="/api/v1/food-sniper", tags=["food-sniper"])


# ---------------------------------------------------------------------------
# Pydantic モデル
# ---------------------------------------------------------------------------


class FoodSniperRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000, description="User message for food recommendation")
    hairPattern: Optional[str] = Field(None, pattern="^(M字|O字|U字|びまん性|オルセン型|ハミルトン型)$", description="Hair loss pattern")

    @validator('message')
    def validate_message(cls, v):
        if not v.strip():
            raise ValueError('Message cannot be empty or whitespace only')
        return v.strip()


class FoodDetail(BaseModel):
    name: str
    emoji: str
    serving: str
    amount: str
    dailyPercentValue: Optional[int] = None
    dailyPercent: str
    tip: str
    why: str


class NutrientInfo(BaseModel):
    name: str
    role: str
    dailyRecommended: Optional[str] = None
    foods: List[FoodDetail]


class PatternInfo(BaseModel):
    label: str
    description: str
    cause: str
    strategy: str


class FoodSniperResponse(BaseModel):
    patternInfo: Optional[PatternInfo] = None
    nutrients: List[NutrientInfo]
    shoppingList: List[str]
    hairPattern: Optional[str] = None


class RecipeRequest(BaseModel):
    foodName: str = Field(..., min_length=1, max_length=100, description="Food name for recipe generation")
    hairPattern: Optional[str] = Field(None, pattern="^(M字|O字|U字|びまん性|オルセン型|ハミルトン型)$", description="Hair loss pattern")

    @validator('foodName')
    def validate_food_name(cls, v):
        if not v.strip():
            raise ValueError('Food name cannot be empty or whitespace only')
        return v.strip()


class RecipeItem(BaseModel):
    name: str
    description: str
    ingredients: List[str]
    benefit: str


class RecipeResponse(BaseModel):
    recipes: List[RecipeItem]


# ---------------------------------------------------------------------------
# パターン別ナレッジベース v2（レビュー反映済み）
# データソース: 日本食品標準成分表（八訂）/ 日本人の食事摂取基準（2020年版）
# 男性: ハミルトン・ノーウッド分類 → M字 / O字 / U字
# 女性: ルードヴィッヒ分類 → びまん性 / オルセン型 / ハミルトン型
# ---------------------------------------------------------------------------

PATTERN_FOOD_MAP = {
    "M字": {
        "label": "M字型薄毛",
        "description": "前頭部の生え際が左右から後退するタイプ",
        "cause": "DHT（ジヒドロテストステロン）が前頭部の毛包を萎縮させる",
        "strategy": "5α-リダクターゼを抑制してDHT生成を減らす",
        "nutrients": [
            {
                "name": "イソフラボン",
                "role": "5α-リダクターゼの働きを穏やかに抑制し、DHTの生成を減らす",
                "dailyRecommended": "40〜50mg（食品安全委員会の上限目安量）",
                "foods": [
                    {
                        "name": "納豆",
                        "emoji": "🫘",
                        "serving": "1パック（50g）",
                        "amount": "イソフラボン 約37mg",
                        "dailyPercentValue": 74,
                        "dailyPercent": "約74%",
                        "tip": "朝食に1パック追加するだけで1日分の大半をカバー",
                        "why": "納豆はイソフラボンが豊富で、5α-リダクターゼの働きを穏やかに抑制しDHT生成を減らす作用が期待できます",
                    },
                    {
                        "name": "豆腐",
                        "emoji": "🧈",
                        "serving": "半丁（150g）",
                        "amount": "イソフラボン 約33mg",
                        "dailyPercentValue": 66,
                        "dailyPercent": "約66%",
                        "tip": "味噌汁や冷奴で手軽に摂取できる",
                        "why": "豆腐はイソフラボンを含み、日常的に取り入れやすい大豆食品です",
                    },
                ],
            },
            {
                "name": "亜鉛",
                "role": "DHT生成に関わる酵素活性を調整し、毛髪のケラチン合成にも必要",
                "dailyRecommended": "11mg（成人男性）/ 8mg（成人女性）",
                "foods": [
                    {
                        "name": "牡蠣",
                        "emoji": "🦪",
                        "serving": "2個（約40g）",
                        "amount": "亜鉛 5.6mg",
                        "dailyPercentValue": 51,
                        "dailyPercent": "約51%（男性基準）",
                        "tip": "亜鉛含有量は食品中トップクラス",
                        "why": "牡蠣は亜鉛の含有量が食品中で最も多く、DHT抑制とケラチン合成の両方をサポートします",
                    },
                    {
                        "name": "かぼちゃの種",
                        "emoji": "🎃",
                        "serving": "30g",
                        "amount": "亜鉛 2.3mg",
                        "dailyPercentValue": 21,
                        "dailyPercent": "約21%（男性基準）",
                        "tip": "間食やサラダのトッピングに",
                        "why": "かぼちゃの種は亜鉛とフィトステロールを含み、DHT抑制と栄養補給を両立できます",
                    },
                ],
            },
            {
                "name": "EGCG（カテキン）",
                "role": "DHT生成の抑制に関連する抗酸化カテキン",
                "dailyRecommended": "明確な基準なし（緑茶3杯程度が目安）",
                "foods": [
                    {
                        "name": "緑茶",
                        "emoji": "🍵",
                        "serving": "3杯（450ml）",
                        "amount": "EGCG 約200mg",
                        "dailyPercentValue": None,
                        "dailyPercent": "—",
                        "tip": "食後に飲む習慣をつけるだけで無理なく続けられる",
                        "why": "緑茶に含まれるEGCGにはDHT抑制作用の研究報告があり、抗酸化作用も期待できます",
                    },
                    {
                        "name": "トマト",
                        "emoji": "🍅",
                        "serving": "中1個（150g）",
                        "amount": "リコピン 約5mg",
                        "dailyPercentValue": 30,
                        "dailyPercent": "約30%（目安15mg基準）",
                        "tip": "加熱するとリコピンの吸収率が2〜3倍に上がる",
                        "why": "トマトのリコピンには5α-リダクターゼ活性を低下させる抗酸化作用が報告されています",
                    },
                ],
            },
        ],
    },
    "O字": {
        "label": "O字型薄毛",
        "description": "頭頂部（つむじ周辺）から薄くなるタイプ",
        "cause": "頭頂部の血流低下により毛包への栄養・酸素供給が不足する",
        "strategy": "血行を促進し、毛包への栄養供給を改善する",
        "nutrients": [
            {
                "name": "オメガ3脂肪酸",
                "role": "血液の流動性を高め、頭皮の血行を促進する",
                "dailyRecommended": "n-3系脂肪酸 2.0g以上（ALA含む目安量）",
                "foods": [
                    {
                        "name": "青魚（まさば）",
                        "emoji": "🐟",
                        "serving": "1切れ（80g）",
                        "amount": "EPA+DHA 約1.3g",
                        "dailyPercentValue": 65,
                        "dailyPercent": "約65%（n-3系目安量基準）",
                        "tip": "サバ缶でもOK。保存がきき栄養価も変わらない",
                        "why": "サバはEPA+DHAが非常に豊富で、血液の流れを改善し頭頂部への栄養供給を促します",
                    },
                    {
                        "name": "銀鮭",
                        "emoji": "🍣",
                        "serving": "1切れ（80g）",
                        "amount": "EPA+DHA 約1.0g",
                        "dailyPercentValue": 50,
                        "dailyPercent": "約50%（n-3系目安量基準）",
                        "tip": "アスタキサンチンの抗酸化作用も頭皮環境の改善に役立つ",
                        "why": "鮭はEPA+DHAに加え、強力な抗酸化物質アスタキサンチンも含む優れた食材です",
                    },
                ],
            },
            {
                "name": "ビタミンE",
                "role": "末梢血管を拡張し、頭頂部の毛細血管の血流を改善する",
                "dailyRecommended": "6.0mg（成人男性）/ 5.0mg（成人女性）",
                "foods": [
                    {
                        "name": "アーモンド",
                        "emoji": "🥜",
                        "serving": "25粒（約25g）",
                        "amount": "ビタミンE 7.4mg",
                        "dailyPercentValue": 123,
                        "dailyPercent": "約123%（男性基準）",
                        "tip": "間食をアーモンドに置き換えるだけで十分量を摂取可能",
                        "why": "アーモンドはビタミンEが非常に豊富で、末梢血管を拡張して頭頂部の血流改善に役立ちます",
                    },
                    {
                        "name": "アボカド",
                        "emoji": "🥑",
                        "serving": "半個（70g）",
                        "amount": "ビタミンE 2.3mg",
                        "dailyPercentValue": 38,
                        "dailyPercent": "約38%（男性基準）",
                        "tip": "オレイン酸も含み、血行促進の相乗効果が期待できる",
                        "why": "アボカドはビタミンEとオレイン酸の組み合わせで血行促進をサポートします",
                    },
                ],
            },
            {
                "name": "鉄分",
                "role": "赤血球の酸素運搬能力を高め、毛包への酸素供給を改善する",
                "dailyRecommended": "7.0〜7.5mg（成人男性）/ 10.5mg（月経あり女性）",
                "foods": [
                    {
                        "name": "ほうれん草",
                        "emoji": "🥬",
                        "serving": "1/2束（100g）",
                        "amount": "鉄 2.0mg（非ヘム鉄）",
                        "dailyPercentValue": 27,
                        "dailyPercent": "約27%（男性7.5mg基準）",
                        "tip": "ビタミンCと一緒に摂ると鉄の吸収率が2〜3倍に",
                        "why": "ほうれん草の鉄分が赤血球の酸素運搬力を高め、毛包への酸素供給を改善します",
                    },
                    {
                        "name": "柑橘類（オレンジ）",
                        "emoji": "🍊",
                        "serving": "1個（可食部150g）",
                        "amount": "ビタミンC 60mg",
                        "dailyPercentValue": 60,
                        "dailyPercent": "ビタミンC 60%",
                        "tip": "鉄分の吸収を助けるビタミンCが豊富。食後のデザートに",
                        "why": "オレンジのビタミンCは鉄分の吸収を高め、コラーゲン生成も促進します",
                    },
                ],
            },
        ],
    },
    "U字": {
        "label": "U字型薄毛",
        "description": "前頭部と頭頂部が同時に進行し、側頭部だけ残るタイプ",
        "cause": "DHTの影響と血行不良が広範囲に同時進行する",
        "strategy": "DHT抑制と抗酸化・血行促進を総合的に行う",
        "nutrients": [
            {
                "name": "亜鉛 + フィトステロール",
                "role": "亜鉛がDHT抑制に、フィトステロールが5α-リダクターゼをブロック",
                "dailyRecommended": "亜鉛 11mg",
                "foods": [
                    {
                        "name": "かぼちゃの種",
                        "emoji": "🎃",
                        "serving": "30g",
                        "amount": "亜鉛 2.3mg + フィトステロール",
                        "dailyPercentValue": 21,
                        "dailyPercent": "亜鉛 約21%",
                        "tip": "DHT抑制と栄養補給を1つの食材で両立できる",
                        "why": "かぼちゃの種は亜鉛とフィトステロールを同時に摂取でき、DHT抑制に効果的です",
                    },
                    {
                        "name": "牡蠣",
                        "emoji": "🦪",
                        "serving": "2個（約40g）",
                        "amount": "亜鉛 5.6mg",
                        "dailyPercentValue": 51,
                        "dailyPercent": "亜鉛 約51%",
                        "tip": "レモン（ビタミンC）と合わせると亜鉛の吸収率アップ",
                        "why": "牡蠣は亜鉛を最も効率よく摂取できる食材で、DHT抑制の要となります",
                    },
                ],
            },
            {
                "name": "オメガ3 + 抗酸化物質",
                "role": "抗炎症・抗酸化で頭皮環境を改善し、血行も促進する",
                "dailyRecommended": "n-3系脂肪酸 2.0g以上",
                "foods": [
                    {
                        "name": "銀鮭",
                        "emoji": "🍣",
                        "serving": "1切れ（80g）",
                        "amount": "EPA+DHA 約1.0g + アスタキサンチン",
                        "dailyPercentValue": 50,
                        "dailyPercent": "約50%",
                        "tip": "抗酸化物質アスタキサンチンも同時に摂れる万能食材",
                        "why": "鮭のオメガ3とアスタキサンチンが頭皮の炎症を抑え、血行を促進します",
                    },
                    {
                        "name": "くるみ",
                        "emoji": "🥜",
                        "serving": "7粒（約28g）",
                        "amount": "ALA（植物性オメガ3）2.5g + 亜鉛 0.8mg",
                        "dailyPercentValue": None,
                        "dailyPercent": "—",
                        "tip": "植物性オメガ3の含有量はナッツ類で最多",
                        "why": "くるみは植物性オメガ3が最も豊富なナッツで、抗炎症作用により頭皮環境を改善します",
                    },
                ],
            },
            {
                "name": "スルフォラファン",
                "role": "DHT抑制と解毒酵素の活性化で毛包を保護する",
                "dailyRecommended": "明確な公的基準なし（研究ベースで30〜60mg目安）",
                "foods": [
                    {
                        "name": "ブロッコリー",
                        "emoji": "🥦",
                        "serving": "1/2株（100g）",
                        "amount": "スルフォラファン 約12mg",
                        "dailyPercentValue": 30,
                        "dailyPercent": "約30%（研究目安40mg基準）",
                        "tip": "軽く蒸すと消化吸収が良くなる。スプラウトなら約8倍の含有量",
                        "why": "ブロッコリーのスルフォラファンにはDHT抑制と毛包保護の二重効果が研究で報告されています",
                    },
                ],
            },
        ],
    },
    "びまん性": {
        "label": "びまん性薄毛",
        "description": "頭髪全体が均一に薄くなるタイプ（女性に多い）",
        "cause": "鉄欠乏・タンパク質不足により毛髪の成長サイクルが乱れる",
        "strategy": "鉄分（特にヘム鉄）とタンパク質を最優先で補う",
        "nutrients": [
            {
                "name": "ヘム鉄",
                "role": "植物性の非ヘム鉄より吸収率が5〜6倍高く、フェリチン回復に効果的",
                "dailyRecommended": "10.5mg（月経あり女性）/ 7.0〜7.5mg（男性）",
                "foods": [
                    {
                        "name": "レバー（豚）",
                        "emoji": "🥩",
                        "serving": "50g",
                        "amount": "鉄 6.5mg（ヘム鉄）",
                        "dailyPercentValue": 62,
                        "dailyPercent": "約62%（女性10.5mg基準）",
                        "tip": "週2回で鉄不足を効率的に改善。レバニラ炒めが定番",
                        "why": "豚レバーはヘム鉄が非常に豊富で、吸収率も高く鉄欠乏の改善に最も効果的な食材です",
                    },
                    {
                        "name": "赤身肉（牛もも）",
                        "emoji": "🥩",
                        "serving": "100g",
                        "amount": "鉄 2.7mg（ヘム鉄）",
                        "dailyPercentValue": 26,
                        "dailyPercent": "約26%（女性10.5mg基準）",
                        "tip": "タンパク質も同時に摂取でき、髪の材料補給になる",
                        "why": "赤身肉はヘム鉄とタンパク質を効率よく摂取でき、毛髪の成長に必要な栄養を総合的に補えます",
                    },
                ],
            },
            {
                "name": "ビタミンC",
                "role": "非ヘム鉄の吸収率を2〜3倍に高め、コラーゲン生成を促進する",
                "dailyRecommended": "100mg",
                "foods": [
                    {
                        "name": "ほうれん草",
                        "emoji": "🥬",
                        "serving": "1/2束（100g）",
                        "amount": "鉄 2.0mg（非ヘム鉄）",
                        "dailyPercentValue": 19,
                        "dailyPercent": "鉄 約19%（女性基準）",
                        "tip": "柑橘類と一緒に食べると鉄の吸収率が大幅アップ",
                        "why": "ほうれん草の鉄分をビタミンCと組み合わせることで吸収率が2〜3倍に向上します",
                    },
                    {
                        "name": "柑橘類（オレンジ）",
                        "emoji": "🍊",
                        "serving": "1個（可食部150g）",
                        "amount": "ビタミンC 60mg",
                        "dailyPercentValue": 60,
                        "dailyPercent": "ビタミンC 60%",
                        "tip": "食後のデザートにすると鉄の吸収を最大化できる",
                        "why": "オレンジのビタミンCは鉄の吸収率を高め、コラーゲン生成で頭皮環境も改善します",
                    },
                ],
            },
            {
                "name": "タンパク質 + ビオチン",
                "role": "髪の主成分ケラチンの材料。ビオチンはケラチン生成を促進する",
                "dailyRecommended": "タンパク質 50g（女性）/ 65g（男性）、ビオチン 50μg",
                "foods": [
                    {
                        "name": "卵",
                        "emoji": "🥚",
                        "serving": "2個（100g）",
                        "amount": "タンパク質 12.2g、ビオチン 25μg",
                        "dailyPercentValue": 24,
                        "dailyPercent": "タンパク質 約24%",
                        "tip": "完全栄養食。ゆで卵なら作り置きもしやすい",
                        "why": "卵はタンパク質とビオチンを同時に摂れる完全栄養食で、ケラチン生成を効率的にサポートします",
                    },
                    {
                        "name": "銀鮭",
                        "emoji": "🍣",
                        "serving": "1切れ（80g）",
                        "amount": "タンパク質 17.8g、ビタミンD 25.6μg",
                        "dailyPercentValue": 36,
                        "dailyPercent": "タンパク質 約36%",
                        "tip": "タンパク質とビタミンDを同時に効率よく摂取できる",
                        "why": "鮭はタンパク質が豊富でビタミンDも含み、髪の成長サイクルの正常化をサポートします",
                    },
                ],
            },
        ],
    },
    "オルセン型": {
        "label": "オルセン型薄毛",
        "description": "頭頂部の分け目を中心に広がるタイプ（女性に多い）",
        "cause": "毛包の慢性的な微小炎症と鉄・ビタミンD不足が重なる",
        "strategy": "鉄分補給 + 抗炎症 + ビタミンD補充で毛包環境を改善する",
        "nutrients": [
            {
                "name": "鉄分（ヘム鉄）",
                "role": "頭頂部の毛包への酸素・栄養供給を改善する",
                "dailyRecommended": "10.5mg（月経あり女性）",
                "foods": [
                    {
                        "name": "レバー（鶏）",
                        "emoji": "🥩",
                        "serving": "50g",
                        "amount": "鉄 4.5mg（ヘム鉄）",
                        "dailyPercentValue": 43,
                        "dailyPercent": "約43%（女性基準）",
                        "tip": "豚レバーより食べやすい。レバニラ炒めがおすすめ",
                        "why": "鶏レバーはヘム鉄が豊富で、頭頂部の毛包への酸素供給を効率的に改善します",
                    },
                ],
            },
            {
                "name": "ビタミンD",
                "role": "毛周期の正常化に関与し、毛包の炎症を抑制する",
                "dailyRecommended": "8.5μg",
                "foods": [
                    {
                        "name": "銀鮭",
                        "emoji": "🍣",
                        "serving": "1切れ（80g）",
                        "amount": "ビタミンD 25.6μg",
                        "dailyPercentValue": 301,
                        "dailyPercent": "約301%",
                        "tip": "ビタミンD含有量は食品中トップクラス。焼くだけで手軽",
                        "why": "鮭はビタミンD含有量が食品中トップクラスで、毛周期の正常化と炎症抑制に役立ちます",
                    },
                    {
                        "name": "きのこ類（まいたけ）",
                        "emoji": "🍄",
                        "serving": "1パック（100g）",
                        "amount": "ビタミンD 4.9μg",
                        "dailyPercentValue": 58,
                        "dailyPercent": "約58%",
                        "tip": "日光に30分当てるとビタミンD量が約2倍に増加する",
                        "why": "まいたけはビタミンDが豊富で、毛周期の正常化に貢献します",
                    },
                ],
            },
            {
                "name": "抗炎症（オメガ3 + ポリフェノール）",
                "role": "毛包の慢性的な微小炎症を抑え、頭皮環境を改善する",
                "dailyRecommended": "n-3系脂肪酸 2.0g以上",
                "foods": [
                    {
                        "name": "ベリー類（ブルーベリー）",
                        "emoji": "🫐",
                        "serving": "1/2カップ（75g）",
                        "amount": "アントシアニン 約120mg",
                        "dailyPercentValue": None,
                        "dailyPercent": "—",
                        "tip": "冷凍ブルーベリーでも栄養価はほぼ変わらない",
                        "why": "ブルーベリーのアントシアニンは強力な抗炎症作用があり、毛包の微小炎症を抑えます",
                    },
                    {
                        "name": "くるみ",
                        "emoji": "🥜",
                        "serving": "7粒（約28g）",
                        "amount": "ALA（植物性オメガ3）2.5g",
                        "dailyPercentValue": None,
                        "dailyPercent": "—",
                        "tip": "ヨーグルトにブルーベリーとくるみを加えると最強の組み合わせ",
                        "why": "くるみのオメガ3は抗炎症作用で頭皮環境を改善し、毛包を保護します",
                    },
                ],
            },
        ],
    },
    "ハミルトン型": {
        "label": "ハミルトン型薄毛",
        "description": "男性型に近い薄毛パターン（女性のホルモン変動が関与）",
        "cause": "ホルモンバランスの乱れとインスリン抵抗性がDHT感受性を高める",
        "strategy": "ホルモンバランスの調整 + 血糖値管理（低GI食）で内側から改善する",
        "nutrients": [
            {
                "name": "亜鉛",
                "role": "ホルモン合成の補酵素として働き、バランスの調整に重要",
                "dailyRecommended": "8mg（成人女性）/ 11mg（成人男性）",
                "foods": [
                    {
                        "name": "牡蠣",
                        "emoji": "🦪",
                        "serving": "2個（約40g）",
                        "amount": "亜鉛 5.6mg",
                        "dailyPercentValue": 70,
                        "dailyPercent": "約70%（女性8mg基準）",
                        "tip": "亜鉛はホルモン調整の鍵。月に数回でも効果的",
                        "why": "牡蠣の亜鉛はホルモン合成の補酵素として働き、バランスの調整に重要な役割を果たします",
                    },
                ],
            },
            {
                "name": "低GI食品",
                "role": "血糖値の急上昇を防ぎ、インスリン抵抗性の改善をサポートする",
                "dailyRecommended": "GI値55以下の食品を主食に",
                "foods": [
                    {
                        "name": "オートミール",
                        "emoji": "🥣",
                        "serving": "1食分（40g）",
                        "amount": "GI値 55、食物繊維 3.0g",
                        "dailyPercentValue": 15,
                        "dailyPercent": "食物繊維 約15%",
                        "tip": "白米（GI値88）からの置き換えで血糖値管理が楽になる",
                        "why": "オートミールは低GIで血糖値の急上昇を防ぎ、インスリン抵抗性を改善してDHT感受性を抑えます",
                    },
                    {
                        "name": "レンズ豆",
                        "emoji": "🫘",
                        "serving": "乾燥50g（茹で後約120g）",
                        "amount": "GI値 29、鉄 4.5mg、亜鉛 2.4mg",
                        "dailyPercentValue": 43,
                        "dailyPercent": "鉄 約43%（女性基準）",
                        "tip": "低GIかつ鉄・亜鉛も豊富。スープやカレーに加えやすい",
                        "why": "レンズ豆は低GIで鉄・亜鉛も含む万能食材で、ホルモンバランスの改善をトータルにサポートします",
                    },
                ],
            },
            {
                "name": "オメガ3 + ビタミンE",
                "role": "ホルモン合成の材料となり、抗炎症作用で頭皮を保護する",
                "dailyRecommended": "n-3系脂肪酸 2.0g / ビタミンE 5.0mg（女性）",
                "foods": [
                    {
                        "name": "青魚（まさば）",
                        "emoji": "🐟",
                        "serving": "1切れ（80g）",
                        "amount": "EPA+DHA 約1.3g",
                        "dailyPercentValue": 65,
                        "dailyPercent": "約65%",
                        "tip": "サバ缶は保存がきき、調理も不要で続けやすい",
                        "why": "サバのEPA+DHAはホルモン合成の材料となり、抗炎症作用で頭皮を保護します",
                    },
                    {
                        "name": "ナッツ類（アーモンド）",
                        "emoji": "🥜",
                        "serving": "25粒（約25g）",
                        "amount": "ビタミンE 7.4mg、亜鉛 1.0mg",
                        "dailyPercentValue": 148,
                        "dailyPercent": "ビタミンE 約148%（女性基準）",
                        "tip": "素焼きを選び、間食として1日25粒が理想的",
                        "why": "アーモンドはビタミンEとミネラルが豊富で、ホルモンバランスの維持に役立ちます",
                    },
                ],
            },
        ],
    },
}

# パターン未特定時の汎用フォールバック
GENERIC_FALLBACK_NUTRIENTS = [
    {
        "name": "タンパク質",
        "role": "髪の主成分ケラチンの材料",
        "foods": [
            {"name": "卵", "emoji": "🥚", "serving": "2個（100g）", "amount": "タンパク質 12.2g", "dailyPercentValue": 24, "dailyPercent": "約24%", "tip": "完全栄養食。手軽にタンパク質補給", "why": "卵はタンパク質とビオチンを含む完全栄養食で、髪のケラチン生成をサポートします"},
            {"name": "銀鮭", "emoji": "🍣", "serving": "1切れ（80g）", "amount": "タンパク質 17.8g", "dailyPercentValue": 36, "dailyPercent": "約36%", "tip": "オメガ3も同時に摂れる", "why": "鮭はタンパク質とオメガ3を同時に摂取できる優れた食材です"},
        ],
    },
    {
        "name": "亜鉛",
        "role": "ケラチン合成とホルモンバランスの調整",
        "foods": [
            {"name": "牡蠣", "emoji": "🦪", "serving": "2個（40g）", "amount": "亜鉛 5.6mg", "dailyPercentValue": 51, "dailyPercent": "約51%", "tip": "亜鉛含有量トップ", "why": "牡蠣は亜鉛含有量が食品中で最も多く、ケラチン合成に必要不可欠です"},
            {"name": "ナッツ類", "emoji": "🥜", "serving": "25g", "amount": "亜鉛 1.0mg", "dailyPercentValue": 9, "dailyPercent": "約9%", "tip": "間食に最適", "why": "ナッツ類は亜鉛とビタミンEを含み、間食に最適な髪の栄養補給源です"},
        ],
    },
    {
        "name": "鉄分",
        "role": "毛包への酸素供給に不可欠",
        "foods": [
            {"name": "レバー", "emoji": "🥩", "serving": "50g", "amount": "鉄 6.5mg", "dailyPercentValue": 62, "dailyPercent": "約62%", "tip": "吸収率の高いヘム鉄", "why": "レバーはヘム鉄が豊富で吸収率も高く、毛包への酸素供給を効率的に改善します"},
            {"name": "納豆", "emoji": "🫘", "serving": "1パック（50g）", "amount": "鉄 1.7mg", "dailyPercentValue": 16, "dailyPercent": "約16%", "tip": "毎朝の習慣に", "why": "納豆は鉄分に加えイソフラボンも含み、毎日の習慣にしやすい髪の味方です"},
        ],
    },
]


# ---------------------------------------------------------------------------
# Gemini プロンプト（ハイブリッド方式: キュレーション済みリストから選択）
# ---------------------------------------------------------------------------

FOOD_RECOMMEND_PROMPT = """\
あなたは管理栄養士です。薄毛パターンに基づき、以下のキュレーション済み食材リストから
ユーザーに最も優先度の高い食材を5つ選んでください。

ユーザーの薄毛パターン: {pattern}（{cause}）
対策方針: {strategy}
ユーザーの食事から不足している栄養素: {deficiencies}

【キュレーション済み食材リスト】
{food_list}

以下のJSON形式で出力してください（JSON以外は出力しないでください）:
{{
  "items": [
    {{"name": "食材名（リストの名前と完全一致させること）", "nutrient": "対応する栄養素名", "reason": "この食材を選んだ理由（1文）"}}
  ]
}}

条件:
- 上記リストに載っている食材のみ選ぶこと（リスト外の食材は選ばないでください）
- ユーザーの不足栄養素を優先的にカバーする食材を選ぶこと
- 食材名はリストと完全一致させること
"""

FOOD_RECOMMEND_PROMPT_GENERIC = """\
あなたは管理栄養士です。髪の健康を意識した食材を推薦してください。

ユーザーの不足栄養素: {deficiencies}

以下のキュレーション済み食材リストから5つ選んでください。

【キュレーション済み食材リスト】
{food_list}

以下のJSON形式で出力してください（JSON以外は出力しないでください）:
{{
  "items": [
    {{"name": "食材名（リストの名前と完全一致させること）", "nutrient": "対応する栄養素名", "reason": "この食材を選んだ理由（1文）"}}
  ]
}}

条件:
- 上記リストに載っている食材のみ選ぶこと
- 食材名はリストと完全一致させること
"""

RECIPE_PROMPT = """\
以下の食材を使った、髪の健康に良い簡単レシピを2つ提案してください。

食材: {food_name}
{pattern_context}

以下のJSON形式で出力してください（JSON以外は出力しないでください）:
{{
  "recipes": [
    {{
      "name": "レシピ名",
      "description": "簡単な作り方（3ステップ以内）",
      "ingredients": ["材料1", "材料2", "材料3"],
      "benefit": "このレシピが髪の健康に良い理由（1文）"
    }}
  ]
}}

条件:
- 調理時間15分以内の簡単なレシピにすること
- スーパーで手に入る一般的な食材のみ使用すること
"""


# ---------------------------------------------------------------------------
# ヘルパー関数
# ---------------------------------------------------------------------------


def _get_user_hair_pattern(uid: str) -> Optional[str]:
    """Firestore から最新の解析結果の薄毛パターンを取得する。"""
    try:
        db = get_firestore_client()
        results = (
            db.collection("analysisResults")
            .document(uid)
            .collection("items")
            .order_by("createdAt", direction=admin_firestore.Query.DESCENDING)
            .limit(1)
            .get()
        )
        for doc in results:
            data = doc.to_dict()
            pattern = data.get("pattern") or data.get("hairPattern")
            if pattern:
                return pattern
    except (FirebaseError, GoogleCloudError) as e:
        logging.error(f"Firestore error fetching user hair pattern: {e}")
    except Exception as e:
        logging.error(f"Unexpected error fetching user hair pattern: {e}", exc_info=True)
    return None


def _get_all_foods_for_pattern(pattern: Optional[str]) -> list[dict]:
    """パターンに紐づく全食材をフラットなリストで返す。"""
    if pattern and pattern in PATTERN_FOOD_MAP:
        nutrients = PATTERN_FOOD_MAP[pattern]["nutrients"]
    else:
        nutrients = GENERIC_FALLBACK_NUTRIENTS
    foods = []
    for nutrient in nutrients:
        for food in nutrient["foods"]:
            foods.append({**food, "nutrient": nutrient["name"]})
    return foods


def _build_food_list_text(foods: list[dict]) -> str:
    """Gemini プロンプト用の食材リスト文字列を生成。"""
    lines = []
    for f in foods:
        lines.append(f"- {f['name']}（{f['nutrient']}）: {f['amount']}")
    return "\n".join(lines)


def _build_nutrients_response(
    pattern: Optional[str],
    selected_names: Optional[list[str]] = None,
) -> List[NutrientInfo]:
    """パターンに基づく栄養素・食材情報をレスポンス用に構築。"""
    if pattern and pattern in PATTERN_FOOD_MAP:
        nutrients_data = PATTERN_FOOD_MAP[pattern]["nutrients"]
    else:
        nutrients_data = GENERIC_FALLBACK_NUTRIENTS

    result = []
    for nutrient in nutrients_data:
        foods = []
        for food in nutrient["foods"]:
            if selected_names and food["name"] not in selected_names:
                continue
            foods.append(FoodDetail(
                name=food["name"],
                emoji=food["emoji"],
                serving=food["serving"],
                amount=food["amount"],
                dailyPercentValue=food.get("dailyPercentValue"),
                dailyPercent=food["dailyPercent"],
                tip=food["tip"],
                why=food["why"],
            ))
        if foods:
            result.append(NutrientInfo(
                name=nutrient["name"],
                role=nutrient["role"],
                dailyRecommended=nutrient.get("dailyRecommended"),
                foods=foods,
            ))
    return result


def _extract_food_recommendations(
    message: str, pattern: Optional[str] = None
) -> tuple[List[NutrientInfo], list[str]]:
    """Gemini で食材を優先度順に選定。失敗時はフォールバック。"""
    all_foods = _get_all_foods_for_pattern(pattern)
    all_names = [f["name"] for f in all_foods]

    if gemini_enabled():
        try:
            food_list_text = _build_food_list_text(all_foods)

            if pattern and pattern in PATTERN_FOOD_MAP:
                info = PATTERN_FOOD_MAP[pattern]
                prompt = FOOD_RECOMMEND_PROMPT.format(
                    pattern=pattern,
                    cause=info["cause"],
                    strategy=info["strategy"],
                    deficiencies=message or "特になし",
                    food_list=food_list_text,
                )
            else:
                prompt = FOOD_RECOMMEND_PROMPT_GENERIC.format(
                    deficiencies=message or "一般的な髪の健康",
                    food_list=food_list_text,
                )

            raw_text = generate_text(prompt, model=GEMINI_MODEL)
            data = safe_json_load(raw_text)
            selected = [
                item["name"]
                for item in data.get("items", [])
                if item.get("name") in all_names
            ]
            if selected:
                nutrients = _build_nutrients_response(pattern, selected)
                shopping = selected
                return nutrients, shopping
        except (ValueError, json.JSONDecodeError, RuntimeError) as e:
            logging.warning(f"Gemini food recommendation failed: {e}")
        except Exception as e:
            logging.error(f"Unexpected error in food recommendation: {e}", exc_info=True)

    # フォールバック: 全食材をそのまま返す
    nutrients = _build_nutrients_response(pattern)
    shopping = all_names
    return nutrients, shopping


# ---------------------------------------------------------------------------
# API エンドポイント
# ---------------------------------------------------------------------------


@router.post("/recommend", response_model=FoodSniperResponse)
def recommend_food_sniper(
    payload: FoodSniperRequest, uid: str = Depends(get_current_uid)
) -> FoodSniperResponse:
    # パターン取得: リクエスト > Firestore の順で探す
    pattern = payload.hairPattern
    if not pattern:
        pattern = _get_user_hair_pattern(uid)

    nutrients, shopping_list = _extract_food_recommendations(
        payload.message, pattern
    )

    # パターン情報を構築
    pattern_info = None
    if pattern and pattern in PATTERN_FOOD_MAP:
        info = PATTERN_FOOD_MAP[pattern]
        pattern_info = PatternInfo(
            label=info["label"],
            description=info["description"],
            cause=info["cause"],
            strategy=info["strategy"],
        )

    # Firestore に記録
    db = get_firestore_client()
    request_id = f"food_{uuid.uuid4().hex}"
    db.collection("foodRequests").document(uid).collection("items").document(
        request_id
    ).set(
        {
            "createdAt": admin_firestore.SERVER_TIMESTAMP,
            "query": payload.message,
            "hairPattern": pattern,
            "nutrients": [n.model_dump() for n in nutrients],
            "shoppingList": shopping_list,
        }
    )

    return FoodSniperResponse(
        patternInfo=pattern_info,
        nutrients=nutrients,
        shoppingList=shopping_list,
        hairPattern=pattern,
    )


@router.post("/recipe", response_model=RecipeResponse)
def generate_recipe(
    payload: RecipeRequest, uid: str = Depends(get_current_uid)
) -> RecipeResponse:
    """食材名からGeminiでレシピを生成。失敗時はフォールバック。"""
    pattern_context = ""
    if payload.hairPattern and payload.hairPattern in PATTERN_FOOD_MAP:
        info = PATTERN_FOOD_MAP[payload.hairPattern]
        pattern_context = (
            f"薄毛パターン: {payload.hairPattern}（{info['cause']}）\n"
            f"対策方針: {info['strategy']}"
        )

    if gemini_enabled():
        try:
            prompt = RECIPE_PROMPT.format(
                food_name=payload.foodName,
                pattern_context=pattern_context or "パターン情報なし",
            )
            raw_text = generate_text(prompt, model=GEMINI_MODEL)
            data = safe_json_load(raw_text)
            recipes = [
                RecipeItem(
                    name=r["name"],
                    description=r["description"],
                    ingredients=r.get("ingredients", []),
                    benefit=r.get("benefit", ""),
                )
                for r in data.get("recipes", [])
            ]
            if recipes:
                return RecipeResponse(recipes=recipes)
        except (ValueError, json.JSONDecodeError, RuntimeError) as e:
            logging.warning(f"Gemini recipe generation failed: {e}")
        except Exception as e:
            logging.error(f"Unexpected error in recipe generation: {e}", exc_info=True)

    # フォールバック
    return RecipeResponse(recipes=[
        RecipeItem(
            name=f"{payload.foodName}のシンプル料理",
            description=f"{payload.foodName}を使った簡単な一品です。お好みの味付けでお召し上がりください。",
            ingredients=[payload.foodName, "お好みの調味料"],
            benefit=f"{payload.foodName}の栄養素を手軽に摂取できます",
        ),
    ])
