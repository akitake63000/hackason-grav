# HairGuard Agent API Specification

## Base URL

```
http://localhost:8000/api/v1
```

## Authentication

All endpoints (except `/health`) require Firebase ID Token:

```
Authorization: Bearer <firebase_id_token>
```

## Common Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "status": 400,
    "details": {},
    "request_id": "uuid"
  }
}
```

### Error Codes
- `AUTH_TOKEN_MISSING` / `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_EXPIRED` (401)
- `PERMISSION_DENIED` / `RESOURCE_ACCESS_DENIED` (403)
- `RESOURCE_NOT_FOUND` / `USER_NOT_FOUND` / `PHOTO_NOT_FOUND` (404)
- `INVALID_INPUT` / `VALIDATION_FAILED` (400/422)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_ERROR` / `DATABASE_ERROR` / `EXTERNAL_API_ERROR` (500)
- `SERVICE_UNAVAILABLE` (503)

---

## Endpoints

### Health Check

#### `GET /api/health`
Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-02-10T10:00:00Z"
}
```

---

### Photos (頭皮写真分析)

#### `POST /api/v1/photos/analyze`
**Rate Limit:** 5 requests/minute

Analyze a user's scalp photo using Gemini Vision API.

**Request:**
```json
{
  "photoId": "photo123"
}
```

**Response:**
```json
{
  "analysisId": "photo123",
  "photoId": "photo123",
  "result": {
    "score": 75.5,
    "notes": "分析結果の説明",
    "hairType": "Normal",
    "pattern": "M字",
    "quality": "Good",
    "scalpCondition": "乾燥",
    "delta": 2.3
  }
}
```

#### `GET /api/v1/photos/analysis-history?limit=50`
**Rate Limit:** 100 requests/minute

Fetch analysis history for authenticated user.

**Query Parameters:**
- `limit` (optional): 1-200 (default: 50)

**Response:**
```json
{
  "items": [
    {
      "photoId": "photo123",
      "score": 75.5,
      "notes": "分析結果",
      "analyzedAt": "2025-02-10T10:00:00Z",
      "capturedAt": "2025-02-10T09:00:00Z",
      "downloadUrl": "https://..."
    }
  ],
  "total": 1
}
```

---

### Reports (週次レポート)

#### `POST /api/v1/reports/generate`
**Rate Limit:** 3 requests/minute

Generate a weekly report using LLM.

**Request:**
```json
{
  "periodDays": 7
}
```

**Response:**
```json
{
  "reportId": "report_abc123",
  "highlights": [
    "スコアが +2.3 ポイント改善しました"
  ],
  "nextActions": [
    "引き続き保湿ケアを継続してください"
  ],
  "rawText": "週次レポート全文..."
}
```

---

### Mental Shield (悩み相談チャット)

#### `POST /api/v1/mental-shield/chat`
**Rate Limit:** 10 requests/minute

Start a new chat session.

**Request:**
```json
{
  "message": "最近髪が薄くなってきて心配です"
}
```

**Response:**
```json
{
  "sessionId": "session123",
  "reply": "お悩みをお聞かせください..."
}
```

#### `POST /api/v1/mental-shield/chat/discuss`
**Rate Limit:** 10 requests/minute

Continue an existing chat session.

**Request:**
```json
{
  "sessionId": "session123",
  "message": "具体的なケア方法を教えてください"
}
```

**Response:**
```json
{
  "sessionId": "session123",
  "reply": "以下のケア方法をお勧めします..."
}
```

---

### Food Sniper (食品推奨)

#### `POST /api/v1/food-sniper/recommend`
**Rate Limit:** 10 requests/minute

Get personalized food recommendations based on hair loss pattern.

**Request:**
```json
{
  "pattern": "M字"
}
```

**Response:**
```json
{
  "patternInfo": {
    "label": "M字型薄毛",
    "description": "前頭部の生え際が左右から後退するタイプ",
    "cause": "DHTが前頭部の毛包を萎縮させる",
    "strategy": "5α-リダクターゼを抑制してDHT生成を減らす"
  },
  "nutrients": [
    {
      "name": "イソフラボン",
      "role": "5α-リダクターゼの働きを抑制",
      "dailyRecommended": "40〜50mg",
      "foods": [
        {
          "name": "納豆",
          "emoji": "🫘",
          "serving": "1パック（50g）",
          "amount": "イソフラボン 約37mg",
          "dailyPercentValue": 74,
          "dailyPercent": "約74%",
          "tip": "朝食に1パック追加するだけで1日分の大半をカバー",
          "why": "納豆はイソフラボンが豊富で..."
        }
      ]
    }
  ],
  "shoppingList": ["納豆", "豆腐", "豆乳", "きな粉"],
  "hairPattern": "M字"
}
```

#### `POST /api/v1/food-sniper/recipe`
**Rate Limit:** 10 requests/minute

Generate recipes based on a specific food ingredient.

**Request:**
```json
{
  "foodName": "納豆",
  "hairPattern": "M字"
}
```

**Response:**
```json
{
  "recipes": [
    {
      "name": "納豆とアボカドの簡単丼",
      "description": "納豆とアボカドを混ぜてご飯にのせるだけ。5分で完成",
      "ingredients": ["納豆 1パック", "アボカド 半分", "ご飯 1杯"],
      "benefit": "イソフラボンとビタミンEで5α-リダクターゼを抑制し、M字対策に効果的です"
    },
    {
      "name": "納豆オムレツ",
      "description": "卵に納豆を混ぜて焼くだけ。タンパク質も豊富",
      "ingredients": ["納豆 1パック", "卵 2個", "ネギ 少々"],
      "benefit": "タンパク質とイソフラボンのダブル効果で髪の健康をサポートします"
    }
  ]
}
```

---

### Lifestyle (生活習慣分析)

#### `POST /api/v1/lifestyle/health`
**Rate Limit:** 300 requests/minute

Record daily health log.

**Request:**
```json
{
  "date": "2025-02-10",
  "睡眠時間": 7,
  "運動時間": 30,
  "ストレスレベル": 3
}
```

#### `POST /api/v1/lifestyle/tip`
**Rate Limit:** 20 requests/minute

Get lifestyle improvement tips.

#### `POST /api/v1/lifestyle/tendency`
**Rate Limit:** 30 requests/minute

Analyze lifestyle trends.

#### `POST /api/v1/lifestyle/recommendation`
**Rate Limit:** 30 requests/minute

Get personalized recommendations.

#### `POST /api/v1/lifestyle/plan/generate`
**Rate Limit:** 10 requests/minute

Generate improvement plan.

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/photos/analyze` | 5/minute |
| `/photos/analysis-history` | 100/minute |
| `/reports/generate` | 3/minute |
| `/mental-shield/chat` | 10/minute |
| `/mental-shield/chat/discuss` | 10/minute |
| `/food-sniper/recommend` | 10/minute |
| `/food-sniper/recipe` | 10/minute |
| `/lifestyle/*` | 10-300/minute (varies) |
| Health endpoints | 300/minute |

When rate limit is exceeded, API returns:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "status": 429,
    "details": {
      "retry_after": 60
    }
  }
}
```

---

## Data Formats

### Date/Time
All timestamps are ISO 8601 format in UTC:
```
2025-02-10T10:00:00Z
```

### Patterns (薄毛パターン)
Allowed values:
- `M字` (M-shaped hairline recession)
- `O字` (Crown thinning)
- `U字` (Frontal and crown thinning)
- `びまん性` (Diffuse thinning)
- `オルセン型` (Frontal thinning - women)
- `ハミルトン型` (Hamilton pattern - women)
- `None` (Not specified)

---

## Environment Variables

See `README.md` for full list of required environment variables.

---

## Additional Resources

- **Interactive API Docs**: `http://localhost:8000/docs`
- **OpenAPI Spec**: `http://localhost:8000/openapi.json`
- **Repository**: Internal
