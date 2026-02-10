/**
 * 生活習慣アンケート質問定義
 *
 * Backend analyze_tendency.py の QUESTION_WEIGHTS に合わせた質問ID・選択肢値を使用
 */

export const QUESTIONS = [
  {
    id: 'sleep_time',
    text: '平均の睡眠時間は？',
    options: [
      { value: 'score_100', label: '7時間以上' },
      { value: 'score_80', label: '6〜7時間' },
      { value: 'score_60', label: '5〜6時間' },
      { value: 'score_40', label: '4〜5時間' },
      { value: 'score_20', label: '4時間未満' },
    ],
  },
  {
    id: 'wake_up_regular',
    text: '起床時間は規則的ですか？',
    options: [
      { value: 'score_100', label: '毎日ほぼ同じ時間' },
      { value: 'score_80', label: 'だいたい同じ時間' },
      { value: 'score_60', label: 'やや不規則' },
      { value: 'score_40', label: 'かなり不規則' },
      { value: 'score_20', label: '全く不規則' },
    ],
  },
  {
    id: 'morning_sunlight',
    text: '朝に日光を浴びますか？',
    options: [
      { value: 'score_100', label: '毎日15分以上' },
      { value: 'score_80', label: '週5日程度' },
      { value: 'score_60', label: '週2〜3日' },
      { value: 'score_40', label: 'たまに' },
      { value: 'score_20', label: 'ほとんど浴びない' },
    ],
  },
  {
    id: 'exercise_frequency',
    text: '運動習慣はありますか？',
    options: [
      { value: 'score_100', label: '週5日以上' },
      { value: 'score_80', label: '週3〜4日' },
      { value: 'score_60', label: '週1〜2日' },
      { value: 'score_40', label: '月1〜2回' },
      { value: 'score_20', label: 'ほとんどしない' },
    ],
  },
  {
    id: 'shoulder_stiffness',
    text: '肩こりや首こりはありますか？',
    options: [
      { value: 'score_100', label: '全くない' },
      { value: 'score_80', label: 'たまにある' },
      { value: 'score_60', label: 'ときどきある' },
      { value: 'score_40', label: 'よくある' },
      { value: 'score_20', label: 'ほぼ毎日ある' },
    ],
  },
  {
    id: 'bathing_style',
    text: '入浴習慣は？',
    options: [
      { value: 'score_100', label: '湯船に毎日つかる（15分以上）' },
      { value: 'score_80', label: '湯船に週4〜5日' },
      { value: 'score_60', label: '湯船に週2〜3日' },
      { value: 'score_40', label: 'たまに湯船' },
      { value: 'score_20', label: 'ほぼシャワーのみ' },
    ],
  },
  {
    id: 'wake_feeling',
    text: '朝の目覚めはどうですか？',
    options: [
      { value: 'score_100', label: 'すっきり目覚める' },
      { value: 'score_80', label: 'だいたい良好' },
      { value: 'score_60', label: 'まあまあ' },
      { value: 'score_40', label: 'あまり良くない' },
      { value: 'score_20', label: '非常に悪い' },
    ],
  },
  {
    id: 'relaxation_habit',
    text: 'リラックスする時間はありますか？',
    options: [
      { value: 'score_100', label: '毎日十分にある' },
      { value: 'score_80', label: 'だいたいある' },
      { value: 'score_60', label: 'たまにある' },
      { value: 'score_40', label: 'あまりない' },
      { value: 'score_20', label: 'ほとんどない' },
    ],
  },
  {
    id: 'substances',
    text: '嗜好品の摂取状況は？',
    options: [
      { value: 'none', label: '特になし' },
      { value: 'caffeine', label: 'カフェイン（コーヒー等）' },
      { value: 'alcohol', label: 'アルコール' },
      { value: 'smoking', label: '喫煙' },
      { value: 'multiple', label: '複数該当' },
    ],
  },
  {
    id: 'water_intake',
    text: '1日の水分摂取量は？',
    options: [
      { value: 'score_100', label: '2L以上' },
      { value: 'score_80', label: '1.5〜2L' },
      { value: 'score_60', label: '1〜1.5L' },
      { value: 'score_40', label: '0.5〜1L' },
      { value: 'score_20', label: '0.5L未満' },
    ],
  },
]

export const CONDITIONAL_QUESTIONS = {
  smoking_amount: {
    id: 'smoking_amount',
    text: '1日の喫煙本数は？',
    options: [
      { value: 'score_100', label: '禁煙中' },
      { value: 'score_80', label: '1〜5本' },
      { value: 'score_60', label: '6〜10本' },
      { value: 'score_40', label: '11〜20本' },
      { value: 'score_20', label: '21本以上' },
    ],
  },
  alcohol_frequency: {
    id: 'alcohol_frequency',
    text: '週の飲酒回数は？',
    options: [
      { value: 'score_100', label: '飲まない' },
      { value: 'score_80', label: '週1回以下' },
      { value: 'score_60', label: '週2〜3回' },
      { value: 'score_40', label: '週4〜5回' },
      { value: 'score_20', label: 'ほぼ毎日' },
    ],
  },
  caffeine_timing: {
    id: 'caffeine_timing',
    text: 'カフェイン摂取の時間帯は？',
    options: [
      { value: 'score_100', label: '午前中のみ' },
      { value: 'score_80', label: '昼食後まで' },
      { value: 'score_60', label: '午後3時頃まで' },
      { value: 'score_40', label: '夕方まで' },
      { value: 'score_20', label: '夜も飲む' },
    ],
  },
}
