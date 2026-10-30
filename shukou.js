// 趣向カード（全20項目）の項目名と選択肢。
// 選択肢の意味とAIへの注意は、Worker（worker.js の MEANINGS・PROMPT_NOTES）にある。直すときは、そちらを直す。

export const CATEGORIES = [
  '物販', 'サービス（店舗型）', 'サービス（非店舗型）', 'コンサル', '教育・スクール', 'IT・SaaS',
  '当てはまるものがない',
];

// 主人公が「人」の選択肢（14〜16を聞くもの）
export const HUMAN = ['学生', '会社員', 'お年寄り', 'お店の人'];

export const ITEMS = [
  { no: 1, group: '話', name: '話の味つけ', type: 'multi',
    options: ['普通と異常の混在', '絵と文のずれ', 'あるある', '意外なオチ', '不思議', '笑える', 'しみじみ', '大げさ', '逆の立場', 'もしも'] },

  { no: 2, group: '話', name: 'オチの強さ', type: 'one',
    options: ['オチなし', 'クスっと来る', 'ずっこける'] },
  { no: 3, group: '話', name: '4コマの組み立て', type: 'one',
    options: ['起承転結', '3コマ目で落として4コマ目で商品の一言', '毎コマに小ネタ', '最後だけ急に真面目'] },
  { no: 4, group: '文', name: '文の調子', type: 'one',
    options: ['真面目', 'やわらかい', '元気', '淡々', '日記'] },
  { no: 5, group: '文', name: '攻め具合', type: 'one',
    options: ['苦情の来ない', '少しとがる', '強めにとがる'],
    screenNote: { '強めにとがる': 'SNSが表示を減らすことがあります' } },
  { no: 6, group: '文', name: '語尾', type: 'one',
    options: ['です・ます', 'だ・である', '話し言葉', '名詞で終える', 'おまかせ'] },
  { no: 7, group: '文', name: '絵の中の文字の量', type: 'one',
    options: ['なし', '1コマ1行', '1コマ2〜3行', '吹き出しで会話'] },
  { no: 8, group: '絵', name: '絵柄', type: 'one',
    options: ['バリバリの少女漫画', '時代劇', '劇画', '新聞の4コマ', '絵本', '昭和のポスター', 'ドット絵'] },
  { no: 9, group: '絵', name: '色', type: 'one',
    options: ['絵柄に任せる', '白黒', '白黒＋1色', '淡い色', 'はっきりした色', '商品やお店の色に合わせる'] },
  { no: 10, group: '絵', name: '文字の形', type: 'one',
    options: ['手書き風', '明朝体', 'ゴシック体', '筆文字', '吹き出しの字'] },
  { no: 11, group: '絵', name: '好きなお約束の場面', type: 'multi',
    options: ['食パンで曲がり角', '取調室とカツ丼', 'お白洲', '夕日の河原', '雨の中で立ち尽くす', '屋上で叫ぶ', 'おまかせ'] },
  { no: 12, group: 'キャラ', name: '主人公を前回と同じにするか', type: 'one',
    options: ['前回と同じ', '新しい主人公'],
    hint: '前回と同じ：前回の主人公を文字で伝えます。似た姿になりますが、まったく同じにはなりません。' },
  { no: 13, group: 'キャラ', name: '主人公', type: 'one',
options: ['猫', '犬', '学生', '会社員', 'お年寄り', 'お店の人', '商品に顔や手足', 'おまかせ'] },
  { no: 14, group: 'キャラ', name: '主人公の年齢層', type: 'one',
    options: ['10代', '20代', '30代', '40代', '50代以上', '見てほしい人に合わせる'] },
  { no: 15, group: 'キャラ', name: '主人公の性別', type: 'one',
    options: ['女性', '男性', '決めない', '見てほしい人に合わせる'] },
  { no: 16, group: 'キャラ', name: '主人公の立場', type: 'one',
    options: ['学生', '会社員', 'お店の人', '家事をする人', 'フリーランス', '見てほしい人に合わせる'] },
  { no: 17, group: 'キャラ', name: '表情', type: 'one',
    options: ['無表情', '大げさ', '困り顔', '笑顔', 'おまかせ'] },
  { no: 18, group: '届け先', name: '見てほしい人の今の気持ち', type: 'one',
    options: ['迷っている', '焦っている', '疲れている', 'わくわくしている', 'ふだん通り', 'おまかせ'] },
  { no: 19, group: '決まり', name: '使わない言葉・表現', type: 'text',
    placeholder: 'なければ「特になし」' },
  { no: 20, group: '商品', name: '商品の出し方', type: 'one',
    options: ['最後だけ', '4コマ目に絵で出す', '話の中に出す', 'おまかせ'] },
];

// 項目の決まり：この項目を聞くかどうか
export function isAsked(no, card, hasSavedCharacter) {
  if (no === 12) return hasSavedCharacter;
  const newChara = !hasSavedCharacter || card[12] === '新しい主人公';
  if (no === 13) return newChara;
  if (no >= 14 && no <= 16) return newChara && HUMAN.includes(card[13]);
  return true;
}
