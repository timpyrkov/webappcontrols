/**
 * palettes.js — Compact palette seed data.
 *
 * Each palette has:
 *   - Four themed display names (gems, natural, flower, beverage)
 *   - A `main` hex colour whose hue/chroma tint backgrounds & neutrals
 *   - An `accents` array of 2, 3, or 5+ hex colours:
 *       2 → interpolated to 5 stops via OKLCh
 *       3 → interpolated via midpoint to 5 stops
 *     5+ → used as-is for --primary-accent-1..N
 *   - A `special` field for non-standard generation rules (null = standard)
 */

export const PALETTES = {

  // ── 1. Ruby ───────────────────────────────────────────────────────
  // Noble reds on muted indigo-slate. Classic luxury pairing.
  ruby: {
    gems: "Ruby", natural: "Sunset", flower: "Rose", beverage: "Wine",
    main:    "#3a4160",
    accents: ["#9b2335", "#e04858"],
    special: null,
  },

  // ── 2. Gold ───────────────────────────────────────────────────────
  // Warm burnished orange-to-gold on muted navy. Regal and warm.
  gold: {
    gems: "Gold", natural: "Desert", flower: "Sunflower", beverage: "Bourbon",
    main:    "#38405a",
    accents: ["#c07828", "#f0c038"],
    special: null,
  },

  // ── 3. Anthracite ─────────────────────────────────────────────────
  // Orange-gold accents on dark olive-sage. Earthy and organic.
  anthracite: {
    gems: "Anthracite", natural: "Spring", flower: "Daisy", beverage: "Brandy",
    main:    "#4a5240",
    accents: ["#b87830", "#e8c450"],
    special: null,
  },

  // ── 4. Amber ──────────────────────────────────────────────────────
  // Amber-orange-to-gold on warm umber. The default/reference palette.
  amber: {
    gems: "Amber", natural: "Autumn", flower: "Marigold", beverage: "Whisky",
    main:    "#6a5238",
    accents: ["#d08028", "#f0c030"],
    special: null,
  },

  // ── 5. Onyx ───────────────────────────────────────────────────────
  // Olive-green accents on coffee-brown. Earthy and grounded.
  onyx: {
    gems: "Onyx", natural: "Mountain", flower: "Olive", beverage: "Coffee",
    main:    "#5a4a38",
    accents: ["#688030", "#a8c048"],
    special: null,
  },

  // ── 6. Malachite ──────────────────────────────────────────────────
  // Cyan → green → orange on neutral teal-grey. Jungle-botanical feel.
  malachite: {
    gems: "Malachite", natural: "Forest", flower: "Ginkgo", beverage: "Mojito",
    main:    "#485858",
    accents: ["#20a8a0", "#288858", "#d09838"],
    special: null,
  },

  // ── 7. Emerald ────────────────────────────────────────────────────
  // Violet-blue-to-teal on clinical blue-grey. Clinic/medical style.
  emerald: {
    gems: "Emerald", natural: "Monsoon", flower: "Eucalyptus", beverage: "Absinthe",
    main:    "#3d4d68",
    accents: ["#2870a8", "#38c0a8"],
    special: null,
  },

  // ── 8. Topaz ──────────────────────────────────────────────────────
  // Tron Legacy–inspired: bright cyan glow on dark steel-blue.
  topaz: {
    gems: "Topaz", natural: "Lagoon", flower: "Iris", beverage: "Tonic",
    main:    "#283848",
    accents: ["#0890c0", "#40e0f0"],
    special: null,
  },

  // ── 9. Sapphire ───────────────────────────────────────────────────
  // Blue-to-cyan on noble muted purple. Deep-sea elegance.
  sapphire: {
    gems: "Sapphire", natural: "Midnight", flower: "Lavender", beverage: "Curaçao",
    main:    "#403060",
    accents: ["#2858b0", "#48b8e0"],
    special: null,
  },

  // ── 10. Amethyst ──────────────────────────────────────────────────
  // Dark-pink-to-gold on deep purple. Rich and dramatic.
  amethyst: {
    gems: "Amethyst", natural: "Twilight", flower: "Orchid", beverage: "Cognac",
    main:    "#483060",
    accents: ["#a03068", "#d8a840"],
    special: null,
  },

  // ── 11. Opal ──────────────────────────────────────────────────────
  // Dark-pink-to-peach on muted slate-blue. Warm dusk glow.
  opal: {
    gems: "Opal", natural: "Dusk", flower: "Camellia", beverage: "Liquor",
    main:    "#384560",
    accents: ["#b03858", "#f0b090"],
    special: null,
  },

  // ── 12. Pearl ─────────────────────────────────────────────────────
  // Pastel rainbow on pink-violet grey. Soft, luminous, feminine.
  pearl: {
    gems: "Pearl", natural: "Morning", flower: "Sakura", beverage: "Latte",
    main:    "#584858",
    accents: ["#fff9b8", "#ffc88a", "#a8d8ff"],
    special: null,
  },

  // ── 13. Marble ────────────────────────────────────────────────────
  // Rose-to-teal on blue-grey. Hospital/healthcare style.
  marble: {
    gems: "Marble", natural: "Mist", flower: "Maple", beverage: "Cider",
    main:    "#485060",
    accents: ["#c04870", "#40c0a8"],
    special: null,
  },

  // ── 14. Quartz ────────────────────────────────────────────────────
  // Monokai / Gruvbox–inspired: 7 explicit accent colours on warm olive-dark.
  quartz: {
    gems: "Quartz", natural: "Typhoon", flower: "Oak", beverage: "Gin",
    main:    "#32302f",
    accents: ["#fb4934", "#fe8019", "#fabd2f", "#b8bb26", "#8ec07c", "#83a598", "#d3869b"],
    special: null,
  },

  // ── 15. Diamond ───────────────────────────────────────────────────
  // Monochrome: all neutrals with minimal chroma. Subtle cool-steel tint.
  diamond: {
    gems: "Diamond", natural: "Arctic", flower: "Edelweiss", beverage: "Schnapps",
    main:    "#686870",
    accents: ["#404048", "#b8b8c0"],
    special: { primaryFromLightness: true },
  },
};

/**
 * Localized palette display names — all four categories.
 * Structure: { gems: { en, es, ... }, natural: { ... }, flower: { ... }, beverage: { ... } }
 */
export const PALETTE_I18N = {
  ruby: {
    gems:     { en: "Ruby",       es: "Rubí",        it: "Rubino",      fr: "Rubis",       de: "Rubin",       ru: "Рубин",      ko: "루비",     ja: "ルビー",     zh: "红宝石" },
    natural:  { en: "Sunset",     es: "Atardecer",   it: "Tramonto",    fr: "Coucher",     de: "Sonnenuntergang", ru: "Закат",   ko: "석양",     ja: "夕焼け",    zh: "日落" },
    flower:   { en: "Rose",       es: "Rosa",        it: "Rosa",        fr: "Rose",        de: "Rose",        ru: "Роза",       ko: "장미",     ja: "バラ",      zh: "玫瑰" },
    beverage: { en: "Wine",       es: "Vino",        it: "Vino",        fr: "Vin",         de: "Wein",        ru: "Вино",       ko: "와인",     ja: "ワイン",    zh: "红酒" },
  },
  gold: {
    gems:     { en: "Gold",       es: "Oro",         it: "Oro",         fr: "Or",          de: "Gold",        ru: "Золото",     ko: "골드",     ja: "ゴールド",   zh: "黄金" },
    natural:  { en: "Desert",     es: "Desierto",    it: "Deserto",     fr: "Désert",      de: "Wüste",       ru: "Пустыня",    ko: "사막",     ja: "砂漠",      zh: "沙漠" },
    flower:   { en: "Sunflower",  es: "Girasol",     it: "Girasole",    fr: "Tournesol",   de: "Sonnenblume", ru: "Подсолнух",  ko: "해바라기",   ja: "ひまわり",   zh: "向日葵" },
    beverage: { en: "Bourbon",    es: "Bourbon",     it: "Bourbon",     fr: "Bourbon",     de: "Bourbon",     ru: "Бурбон",     ko: "버번",     ja: "バーボン",   zh: "波旁" },
  },
  anthracite: {
    gems:     { en: "Anthracite", es: "Antracita",   it: "Antracite",   fr: "Anthracite",  de: "Anthrazit",   ru: "Антрацит",   ko: "무연탄",    ja: "無煙炭",    zh: "无烟煤" },
    natural:  { en: "Spring",     es: "Primavera",   it: "Primavera",   fr: "Printemps",   de: "Frühling",    ru: "Весна",      ko: "봄",       ja: "春",        zh: "春天" },
    flower:   { en: "Daisy",      es: "Margarita",   it: "Margherita",  fr: "Marguerite",  de: "Gänseblümchen", ru: "Ромашка",  ko: "데이지",    ja: "デイジー",   zh: "雏菊" },
    beverage: { en: "Brandy",     es: "Brandy",      it: "Brandy",      fr: "Brandy",      de: "Weinbrand",   ru: "Бренди",     ko: "브랜디",    ja: "ブランデー",  zh: "白兰地" },
  },
  amber: {
    gems:     { en: "Amber",      es: "Ámbar",       it: "Ambra",       fr: "Ambre",       de: "Bernstein",   ru: "Янтарь",     ko: "호박",     ja: "琥珀",      zh: "琥珀" },
    natural:  { en: "Autumn",     es: "Otoño",       it: "Autunno",     fr: "Automne",     de: "Herbst",      ru: "Осень",      ko: "가을",     ja: "秋",        zh: "秋天" },
    flower:   { en: "Marigold",   es: "Caléndula",   it: "Calendula",   fr: "Souci",       de: "Ringelblume", ru: "Бархатцы",   ko: "금잔화",    ja: "マリーゴールド", zh: "万寿菊" },
    beverage: { en: "Whisky",     es: "Whisky",      it: "Whisky",      fr: "Whisky",      de: "Whisky",      ru: "Виски",      ko: "위스키",    ja: "ウイスキー",  zh: "威士忌" },
  },
  onyx: {
    gems:     { en: "Onyx",       es: "Ónix",        it: "Onice",       fr: "Onyx",        de: "Onyx",        ru: "Оникс",      ko: "오닉스",    ja: "オニキス",   zh: "玛瑙" },
    natural:  { en: "Mountain",   es: "Montaña",     it: "Montagna",    fr: "Montagne",    de: "Berg",        ru: "Горы",       ko: "산",       ja: "山",        zh: "山脉" },
    flower:   { en: "Olive",      es: "Olivo",       it: "Olivo",       fr: "Olivier",     de: "Olive",       ru: "Олива",      ko: "올리브",    ja: "オリーブ",   zh: "橄榄" },
    beverage: { en: "Coffee",     es: "Café",        it: "Caffè",       fr: "Café",        de: "Kaffee",      ru: "Кофе",       ko: "커피",     ja: "コーヒー",   zh: "咖啡" },
  },
  malachite: {
    gems:     { en: "Malachite",  es: "Malaquita",   it: "Malachite",   fr: "Malachite",   de: "Malachit",    ru: "Малахит",    ko: "공작석",    ja: "マラカイト",  zh: "孔雀石" },
    natural:  { en: "Forest",     es: "Bosque",      it: "Foresta",     fr: "Forêt",       de: "Wald",        ru: "Лес",        ko: "숲",       ja: "森",        zh: "森林" },
    flower:   { en: "Ginkgo",     es: "Ginkgo",      it: "Ginkgo",      fr: "Ginkgo",      de: "Ginkgo",      ru: "Гинкго",     ko: "은행나무",   ja: "イチョウ",   zh: "银杏" },
    beverage: { en: "Mojito",     es: "Mojito",      it: "Mojito",      fr: "Mojito",      de: "Mojito",      ru: "Мохито",     ko: "모히토",    ja: "モヒート",   zh: "莫吉托" },
  },
  emerald: {
    gems:     { en: "Emerald",    es: "Esmeralda",   it: "Smeraldo",    fr: "Émeraude",    de: "Smaragd",     ru: "Изумруд",    ko: "에메랄드",   ja: "エメラルド",  zh: "祖母绿" },
    natural:  { en: "Monsoon",    es: "Monzón",      it: "Monsone",     fr: "Mousson",     de: "Monsun",      ru: "Муссон",     ko: "몬순",     ja: "モンスーン",  zh: "季风" },
    flower:   { en: "Eucalyptus", es: "Eucalipto",   it: "Eucalipto",   fr: "Eucalyptus",  de: "Eukalyptus",  ru: "Эвкалипт",   ko: "유칼립투스",  ja: "ユーカリ",   zh: "桉树" },
    beverage: { en: "Absinthe",   es: "Absenta",     it: "Assenzio",    fr: "Absinthe",    de: "Absinth",     ru: "Абсент",     ko: "압생트",    ja: "アブサン",   zh: "苦艾酒" },
  },
  topaz: {
    gems:     { en: "Topaz",      es: "Topacio",     it: "Topazio",     fr: "Topaze",      de: "Topas",       ru: "Топаз",      ko: "토파즈",    ja: "トパーズ",   zh: "黄玉" },
    natural:  { en: "Lagoon",     es: "Laguna",      it: "Laguna",      fr: "Lagon",       de: "Lagune",      ru: "Лагуна",     ko: "석호",     ja: "ラグーン",   zh: "泻湖" },
    flower:   { en: "Iris",       es: "Iris",        it: "Iris",        fr: "Iris",        de: "Iris",        ru: "Ирис",       ko: "아이리스",   ja: "アイリス",   zh: "鸢尾" },
    beverage: { en: "Tonic",      es: "Tónica",      it: "Tonica",      fr: "Tonic",       de: "Tonic",       ru: "Тоник",      ko: "토닉",     ja: "トニック",   zh: "汤力水" },
  },
  sapphire: {
    gems:     { en: "Sapphire",   es: "Zafiro",      it: "Zaffiro",     fr: "Saphir",      de: "Saphir",      ru: "Сапфир",     ko: "사파이어",   ja: "サファイア",  zh: "蓝宝石" },
    natural:  { en: "Midnight",   es: "Medianoche",  it: "Mezzanotte",  fr: "Minuit",      de: "Mitternacht", ru: "Полночь",    ko: "자정",     ja: "真夜中",    zh: "午夜" },
    flower:   { en: "Lavender",   es: "Lavanda",     it: "Lavanda",     fr: "Lavande",     de: "Lavendel",    ru: "Лаванда",    ko: "라벤더",    ja: "ラベンダー",  zh: "薰衣草" },
    beverage: { en: "Curaçao",    es: "Curaçao",     it: "Curaçao",     fr: "Curaçao",     de: "Curaçao",     ru: "Кюрасао",    ko: "큐라소",    ja: "キュラソー",  zh: "库拉索" },
  },
  amethyst: {
    gems:     { en: "Amethyst",   es: "Amatista",    it: "Ametista",    fr: "Améthyste",   de: "Amethyst",    ru: "Аметист",    ko: "자수정",    ja: "アメジスト",  zh: "紫水晶" },
    natural:  { en: "Twilight",   es: "Crepúsculo",  it: "Crepuscolo",  fr: "Crépuscule",  de: "Dämmerung",   ru: "Сумерки",    ko: "황혼",     ja: "黄昏",      zh: "黄昏" },
    flower:   { en: "Orchid",     es: "Orquídea",    it: "Orchidea",    fr: "Orchidée",    de: "Orchidee",    ru: "Орхидея",    ko: "난초",     ja: "ラン",      zh: "兰花" },
    beverage: { en: "Cognac",     es: "Coñac",       it: "Cognac",      fr: "Cognac",      de: "Cognac",      ru: "Коньяк",     ko: "코냑",     ja: "コニャック",  zh: "干邑" },
  },
  opal: {
    gems:     { en: "Opal",       es: "Ópalo",       it: "Opale",       fr: "Opale",       de: "Opal",        ru: "Опал",       ko: "오팔",     ja: "オパール",   zh: "蛋白石" },
    natural:  { en: "Dusk",       es: "Ocaso",       it: "Crepuscolo",  fr: "Crépuscule",  de: "Abenddämmerung", ru: "Сумерки",  ko: "황혼",     ja: "夕暮れ",    zh: "黄昏" },
    flower:   { en: "Camellia",   es: "Camelia",     it: "Camelia",     fr: "Camélia",     de: "Kamelie",     ru: "Камелия",    ko: "동백",     ja: "ツバキ",    zh: "山茶" },
    beverage: { en: "Liquor",     es: "Licor",       it: "Liquore",     fr: "Liqueur",     de: "Likör",       ru: "Ликёр",      ko: "리큐르",    ja: "リキュール",  zh: "利口酒" },
  },
  pearl: {
    gems:     { en: "Pearl",      es: "Perla",       it: "Perla",       fr: "Perle",       de: "Perle",       ru: "Жемчуг",     ko: "진주",     ja: "パール",    zh: "珍珠" },
    natural:  { en: "Morning",    es: "Mañana",      it: "Mattina",     fr: "Matin",       de: "Morgen",      ru: "Утро",       ko: "아침",     ja: "朝",        zh: "清晨" },
    flower:   { en: "Sakura",     es: "Sakura",      it: "Sakura",      fr: "Sakura",      de: "Sakura",      ru: "Сакура",     ko: "벚꽃",     ja: "桜",        zh: "樱花" },
    beverage: { en: "Latte",      es: "Latte",       it: "Latte",       fr: "Latte",       de: "Latte",       ru: "Латте",      ko: "라떼",     ja: "ラテ",      zh: "拿铁" },
  },
  marble: {
    gems:     { en: "Marble",     es: "Mármol",      it: "Marmo",       fr: "Marbre",      de: "Marmor",      ru: "Мрамор",     ko: "대리석",    ja: "マーブル",   zh: "大理石" },
    natural:  { en: "Mist",       es: "Niebla",      it: "Nebbia",      fr: "Brume",       de: "Nebel",       ru: "Туман",      ko: "안개",     ja: "霧",        zh: "薄雾" },
    flower:   { en: "Maple",      es: "Arce",        it: "Acero",       fr: "Érable",      de: "Ahorn",       ru: "Клён",       ko: "단풍",     ja: "カエデ",    zh: "枫树" },
    beverage: { en: "Cider",      es: "Sidra",       it: "Sidro",       fr: "Cidre",       de: "Apfelwein",   ru: "Сидр",       ko: "사이다",    ja: "サイダー",   zh: "苹果酒" },
  },
  quartz: {
    gems:     { en: "Quartz",     es: "Cuarzo",      it: "Quarzo",      fr: "Quartz",      de: "Quarz",       ru: "Кварц",      ko: "석영",     ja: "クォーツ",   zh: "石英" },
    natural:  { en: "Typhoon",    es: "Tifón",       it: "Tifone",      fr: "Typhon",      de: "Taifun",      ru: "Тайфун",     ko: "태풍",     ja: "台風",      zh: "台风" },
    flower:   { en: "Oak",        es: "Roble",       it: "Quercia",     fr: "Chêne",       de: "Eiche",       ru: "Дуб",        ko: "참나무",    ja: "オーク",    zh: "橡树" },
    beverage: { en: "Gin",        es: "Ginebra",     it: "Gin",         fr: "Gin",         de: "Gin",         ru: "Джин",       ko: "진",       ja: "ジン",      zh: "杜松子酒" },
  },
  diamond: {
    gems:     { en: "Diamond",    es: "Diamante",    it: "Diamante",    fr: "Diamant",     de: "Diamant",     ru: "Алмаз",      ko: "다이아몬드",  ja: "ダイヤモンド", zh: "钻石" },
    natural:  { en: "Arctic",     es: "Ártico",      it: "Artico",      fr: "Arctique",    de: "Arktis",      ru: "Арктика",    ko: "북극",     ja: "北極",      zh: "北极" },
    flower:   { en: "Edelweiss",  es: "Edelweiss",   it: "Edelweiss",   fr: "Edelweiss",   de: "Edelweiß",    ru: "Эдельвейс",  ko: "에델바이스",  ja: "エーデルワイス", zh: "雪绒花" },
    beverage: { en: "Schnapps",   es: "Schnapps",    it: "Schnapps",    fr: "Schnapps",    de: "Schnaps",     ru: "Шнапс",      ko: "슈냅스",    ja: "シュナップス", zh: "杜松烧酒" },
  },
};

/** Ordered palette keys — matches the 5×3 grid layout (warm → cool → neutral). */
export const PALETTE_ORDER = [
  "ruby",      "gold",     "anthracite", "amber",    "onyx",
  "malachite", "emerald",  "topaz",      "sapphire", "amethyst",
  "opal",      "pearl",    "marble",     "quartz",   "diamond",
];

/** Default palette key. */
export const DEFAULT_PALETTE = "amber";
