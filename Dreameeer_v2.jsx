import { useState, useEffect, useRef } from "react";

// ===== DESIGN TOKENS =====
const SPACE = { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, "2xl": 32, "3xl": 40, "4xl": 48, "5xl": 64 };

const COLORS = {
  bg: "#08081a",
  bgCard: "#111125",
  bgInput: "#181836",
  surface: "#14142c",
  text: "#eef0f6",
  textMuted: "#9ba3b8",
  textDim: "#636b82",
  textGhost: "#3e4560",
  accent: "#7c5cfc",
  accentLight: "#a18aff",
  accentGlow: "rgba(124,92,252,0.28)",
  accentBg: "rgba(124,92,252,0.12)",
  gold: "#f5a623",
  goldLight: "#ffc857",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  border: "#1c1c38",
  borderLight: "rgba(255,255,255,0.06)",
};

const TYPE = {
  display:  { fontSize: 32, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.5 },
  title1:   { fontSize: 26, fontWeight: 700, lineHeight: 1.25, letterSpacing: -0.3 },
  title2:   { fontSize: 20, fontWeight: 700, lineHeight: 1.3, letterSpacing: -0.2 },
  title3:   { fontSize: 18, fontWeight: 600, lineHeight: 1.35 },
  body:     { fontSize: 15, fontWeight: 400, lineHeight: 1.6 },
  bodyBold: { fontSize: 15, fontWeight: 600, lineHeight: 1.6 },
  callout:  { fontSize: 14, fontWeight: 400, lineHeight: 1.5 },
  caption:  { fontSize: 12, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0.2 },
  micro:    { fontSize: 10, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0.5 },
  overline: { fontSize: 11, fontWeight: 700, lineHeight: 1.3, letterSpacing: 1, textTransform: "uppercase" },
};

const FONT = "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif";

const stagger = (i, base = 0.3, step = 0.06) => ({
  animation: `fadeInUp ${base}s ease`,
  animationDelay: `${i * step}s`,
  animationFillMode: "both",
});

// ===== KEYFRAMES =====
const keyframes = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-10px, 15px) scale(1.05); }
}
@keyframes breathe {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.02); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

// ===== ICONS (SVG) =====
const Icons = {
  moon: (c = COLORS.text, s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  book: (c = COLORS.text, s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  chart: (c = COLORS.text, s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  user: (c = COLORS.text, s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  mic: (c = COLORS.text, s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="1" width="6" height="11" rx="3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  send: (c = COLORS.text, s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  play: (c = COLORS.text, s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  star: (c = COLORS.gold, s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c} stroke="none">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  chevronRight: (c = COLORS.textDim, s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
  sparkles: (c = COLORS.accent, s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M19 15l.5 2 2 .5-2 .5-.5 2-.5-2-2-.5 2-.5.5-2z"/>
    </svg>
  ),
};

// ===== PRESSABLE COMPONENT =====
const Pressable = ({ children, onPress, style, disabled }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onClick={disabled ? undefined : onPress}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        ...style,
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: "transform 0.1s ease",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
      }}
    >
      {children}
    </div>
  );
};

// ===== STATUS BAR =====
const StatusBar = () => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: `${SPACE.sm}px ${SPACE.lg}px`, height: 44 }}>
    <span style={{ ...TYPE.bodyBold, color: COLORS.text }}>9:41</span>
    <div style={{ width: 120, height: 30, background: "#000", borderRadius: 15 }} />
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <svg width="16" height="12" viewBox="0 0 16 12"><rect x="0" y="6" width="3" height="6" rx="0.5" fill={COLORS.text}/><rect x="4.5" y="4" width="3" height="8" rx="0.5" fill={COLORS.text}/><rect x="9" y="1.5" width="3" height="10.5" rx="0.5" fill={COLORS.text}/><rect x="13.5" y="0" width="3" height="12" rx="0.5" fill={COLORS.text} opacity="0.3"/></svg>
      <svg width="15" height="12" viewBox="0 0 15 12"><path d="M7.5 3.6C9.4 3.6 11.1 4.3 12.4 5.5L13.8 4.1C12.1 2.5 9.9 1.5 7.5 1.5S2.9 2.5 1.2 4.1L2.6 5.5C3.9 4.3 5.6 3.6 7.5 3.6Z" fill={COLORS.text}/><path d="M7.5 7.2C8.6 7.2 9.6 7.6 10.4 8.3L11.8 6.9C10.6 5.8 9.1 5.1 7.5 5.1S4.4 5.8 3.2 6.9L4.6 8.3C5.4 7.6 6.4 7.2 7.5 7.2Z" fill={COLORS.text}/><circle cx="7.5" cy="10.5" r="1.5" fill={COLORS.text}/></svg>
      <svg width="25" height="12" viewBox="0 0 25 12"><rect x="0" y="1" width="21" height="10" rx="2" stroke={COLORS.text} strokeWidth="1" fill="none"/><rect x="22" y="4" width="2" height="4" rx="0.5" fill={COLORS.text} opacity="0.4"/><rect x="1.5" y="2.5" width="14" height="7" rx="1" fill={COLORS.success}/></svg>
    </div>
  </div>
);

// ===== HOME INDICATOR =====
const HomeIndicator = () => (
  <div style={{ display: "flex", justifyContent: "center", paddingBottom: SPACE.sm, paddingTop: SPACE.xs }}>
    <div style={{ width: 134, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.2)" }} />
  </div>
);

// ===== TAB BAR =====
const TabBar = ({ active, onNavigate }) => {
  const tabs = [
    { id: "home", label: "Главная", icon: Icons.moon },
    { id: "diary", label: "Дневник", icon: Icons.book },
    { id: "stats", label: "Статистика", icon: Icons.chart },
    { id: "profile", label: "Профиль", icon: Icons.user },
  ];
  return (
    <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", height: 56, borderTop: `1px solid ${COLORS.border}`, background: COLORS.bg }}>
      {tabs.map(t => (
        <Pressable key={t.id} onPress={() => onNavigate(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: SPACE.xs }}>
          {t.icon(active === t.id ? COLORS.accent : COLORS.textDim)}
          <span style={{ ...TYPE.micro, color: active === t.id ? COLORS.accent : COLORS.textDim }}>{t.label}</span>
        </Pressable>
      ))}
    </div>
  );
};

// ===== SAMPLE DATA =====
const SAMPLE_DREAMS = [
  { id: 1, title: "Полёт над океаном", mood: "мечтательный", date: "7 мар", emoji: "🌊", symbols: ["океан", "полёт", "закат"], lucidity: 7 },
  { id: 2, title: "Стеклянный лабиринт", mood: "загадочный", date: "5 мар", emoji: "🔮", symbols: ["зеркала", "лабиринт", "свет"], lucidity: 5 },
  { id: 3, title: "Танец с тенями", mood: "трансформирующий", date: "3 мар", emoji: "🌑", symbols: ["тени", "танец", "огонь"], lucidity: 8 },
  { id: 4, title: "Сад бесконечности", mood: "вдохновляющий", date: "1 мар", emoji: "🌸", symbols: ["сад", "цветы", "время"], lucidity: 6 },
];

const MOOD_COLORS = {
  "загадочный": "#8b5cf6",
  "мечтательный": "#3b82f6",
  "тревожный": "#ef4444",
  "трансформирующий": "#f59e0b",
  "вдохновляющий": "#10b981",
};

// ===== HOME SCREEN =====
const HomeScreen = ({ onNavigate }) => {
  const [dreamText, setDreamText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = () => {
    if (dreamText.trim().length < 10) return;
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      onNavigate("analysis");
    }, 2000);
  };

  return (
    <div style={{ flex: 1, overflow: "auto", padding: `0 ${SPACE.lg}px` }}>
      {/* Background orbs */}
      <div style={{ position: "absolute", top: 80, left: -40, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${COLORS.accentGlow}, transparent)`, animation: "float 10s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 300, right: -60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.12), transparent)", animation: "float 12s ease-in-out infinite 2s", pointerEvents: "none" }} />

      {/* Greeting */}
      <div style={{ ...stagger(0), paddingTop: SPACE["2xl"] }}>
        <p style={{ ...TYPE.callout, color: COLORS.textMuted, margin: 0 }}>Доброй ночи, Стас</p>
        <h1 style={{ ...TYPE.display, color: COLORS.text, margin: `${SPACE.xs}px 0 0 0`, fontFamily: FONT }}>
          Расскажи свой сон {Icons.sparkles()}
        </h1>
      </div>

      {/* Input area */}
      <div style={{ ...stagger(1), marginTop: SPACE.xl }}>
        <div style={{
          background: COLORS.bgCard,
          borderRadius: 20,
          border: `1px solid ${COLORS.border}`,
          padding: SPACE.base,
        }}>
          <textarea
            value={dreamText}
            onChange={e => setDreamText(e.target.value)}
            placeholder="Опиши свой сон... Чем подробнее, тем глубже анализ ✨"
            style={{
              ...TYPE.body,
              fontFamily: FONT,
              color: COLORS.text,
              background: "transparent",
              border: "none",
              outline: "none",
              width: "100%",
              minHeight: 120,
              resize: "none",
              "::placeholder": { color: COLORS.textGhost },
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: SPACE.md }}>
            <Pressable onPress={() => {}} style={{
              width: 44, height: 44, borderRadius: 22,
              background: COLORS.bgInput,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {Icons.mic(COLORS.textMuted)}
            </Pressable>
            <Pressable
              onPress={handleAnalyze}
              disabled={dreamText.trim().length < 10 || isAnalyzing}
              style={{
                height: 48,
                paddingLeft: SPACE.xl, paddingRight: SPACE.xl,
                borderRadius: 14,
                background: dreamText.trim().length >= 10
                  ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentLight})`
                  : COLORS.bgInput,
                display: "flex", alignItems: "center", gap: SPACE.sm,
                boxShadow: dreamText.trim().length >= 10 ? `0 4px 20px ${COLORS.accentGlow}` : "none",
              }}
            >
              {isAnalyzing ? (
                <div style={{ width: 20, height: 20, border: `2px solid ${COLORS.text}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              ) : Icons.send("#fff")}
              <span style={{ ...TYPE.bodyBold, color: isAnalyzing ? COLORS.textMuted : "#fff" }}>
                {isAnalyzing ? "Анализирую..." : "Разгадать"}
              </span>
            </Pressable>
          </div>
        </div>
      </div>

      {/* Recent dreams */}
      <div style={{ ...stagger(2), marginTop: SPACE["2xl"] }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.base }}>
          <h2 style={{ ...TYPE.title2, color: COLORS.text, margin: 0 }}>Недавние сны</h2>
          <Pressable onPress={() => onNavigate("diary")}>
            <span style={{ ...TYPE.callout, color: COLORS.accent }}>Все →</span>
          </Pressable>
        </div>
        {SAMPLE_DREAMS.slice(0, 3).map((dream, i) => (
          <Pressable key={dream.id} onPress={() => onNavigate("analysis")} style={{
            ...stagger(i + 3),
            background: COLORS.bgCard,
            borderRadius: 16,
            border: `1px solid ${COLORS.borderLight}`,
            padding: SPACE.base,
            marginBottom: SPACE.md,
            display: "flex",
            alignItems: "center",
            gap: SPACE.md,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: COLORS.accentBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>
              {dream.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ ...TYPE.bodyBold, color: COLORS.text, margin: 0 }}>{dream.title}</p>
              <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, marginTop: SPACE.xs }}>
                <span style={{
                  ...TYPE.micro, color: MOOD_COLORS[dream.mood],
                  background: `${MOOD_COLORS[dream.mood]}18`,
                  padding: "2px 8px", borderRadius: 99,
                }}>{dream.mood}</span>
                <span style={{ ...TYPE.caption, color: COLORS.textDim }}>{dream.date}</span>
              </div>
            </div>
            {Icons.chevronRight()}
          </Pressable>
        ))}
      </div>

      <div style={{ height: SPACE.lg }} />
    </div>
  );
};

// ===== ANALYSIS SCREEN =====
const AnalysisScreen = ({ onNavigate }) => {
  const analysis = {
    dreamTitle: "Полёт над фиолетовым океаном",
    mood: "мечтательный",
    symbols: [
      { name: "Океан", emoji: "🌊", meaning: "Бескрайний океан символизирует ваше подсознание — глубокое, мощное, полное неисследованных тайн. Фиолетовый цвет говорит о духовном пробуждении." },
      { name: "Полёт", emoji: "🕊️", meaning: "Полёт — это стремление к свободе и преодолению ограничений. Вы готовы подняться над привычными рамками и увидеть жизнь с новой высоты." },
      { name: "Тающие часы", emoji: "⏳", meaning: "Часы, растворяющиеся в воздухе — классический символ трансценденции времени. Ваше подсознание говорит: отпусти контроль, доверься потоку." },
    ],
    interpretation: "Ваш сон рисует картину внутренней трансформации. Полёт над фиолетовым океаном — это путешествие к глубинам собственной души. Тающие часы говорят о том, что вы готовы отпустить жёсткий контроль и довериться интуиции.",
    recommendation: "Сегодня проведите 10 минут в тишине, наблюдая за своими мыслями без оценки. Ваш сон приглашает вас к осознанности.",
    lucidityScore: 7,
  };

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {/* Video preview */}
      <div style={{
        ...stagger(0),
        height: 220,
        background: `linear-gradient(135deg, #1a0533 0%, #0d1b3e 50%, #0a1628 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 30% 60%, rgba(124,92,252,0.2), transparent 60%)" }} />
        <Pressable onPress={() => {}} style={{
          width: 64, height: 64, borderRadius: 32,
          background: "rgba(255,255,255,0.15)",
          backdropFilter: "blur(10px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {Icons.play("#fff", 28)}
        </Pressable>
        <div style={{ position: "absolute", bottom: SPACE.base, left: SPACE.lg, right: SPACE.lg }}>
          <span style={{ ...TYPE.micro, color: COLORS.accentLight, background: COLORS.accentBg, padding: "3px 10px", borderRadius: 99 }}>
            ВИДЕО ГОТОВО • 5 сек
          </span>
        </div>
      </div>

      <div style={{ padding: `${SPACE.xl}px ${SPACE.lg}px` }}>
        {/* Title + mood */}
        <div style={stagger(1)}>
          <span style={{
            ...TYPE.micro,
            color: MOOD_COLORS[analysis.mood],
            background: `${MOOD_COLORS[analysis.mood]}18`,
            padding: "3px 10px", borderRadius: 99,
          }}>{analysis.mood}</span>
          <h1 style={{ ...TYPE.title1, color: COLORS.text, margin: `${SPACE.sm}px 0 0 0` }}>{analysis.dreamTitle}</h1>
        </div>

        {/* Lucidity */}
        <div style={{ ...stagger(2), display: "flex", alignItems: "center", gap: SPACE.sm, marginTop: SPACE.base }}>
          <span style={{ ...TYPE.caption, color: COLORS.textMuted }}>Осознанность:</span>
          <div style={{ flex: 1, height: 6, background: COLORS.bgInput, borderRadius: 3 }}>
            <div style={{ width: `${analysis.lucidityScore * 10}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentLight})` }} />
          </div>
          <span style={{ ...TYPE.bodyBold, color: COLORS.accent }}>{analysis.lucidityScore}/10</span>
        </div>

        {/* Symbols */}
        <div style={{ ...stagger(3), marginTop: SPACE.xl }}>
          <h2 style={{ ...TYPE.overline, color: COLORS.textDim, margin: `0 0 ${SPACE.md}px 0` }}>Символы сна</h2>
          {analysis.symbols.map((sym, i) => (
            <div key={i} style={{
              ...stagger(i + 4),
              background: COLORS.bgCard,
              borderRadius: 14,
              border: `1px solid ${COLORS.borderLight}`,
              padding: SPACE.base,
              marginBottom: SPACE.md,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.sm }}>
                <span style={{ fontSize: 22 }}>{sym.emoji}</span>
                <span style={{ ...TYPE.title3, color: COLORS.text }}>{sym.name}</span>
              </div>
              <p style={{ ...TYPE.callout, color: COLORS.textMuted, margin: 0 }}>{sym.meaning}</p>
            </div>
          ))}
        </div>

        {/* Interpretation */}
        <div style={{ ...stagger(7), marginTop: SPACE.lg }}>
          <h2 style={{ ...TYPE.overline, color: COLORS.textDim, margin: `0 0 ${SPACE.md}px 0` }}>Толкование</h2>
          <div style={{
            background: COLORS.bgCard,
            borderRadius: 14,
            border: `1px solid ${COLORS.borderLight}`,
            padding: SPACE.base,
            borderLeft: `3px solid ${COLORS.accent}`,
          }}>
            <p style={{ ...TYPE.body, color: COLORS.text, margin: 0 }}>{analysis.interpretation}</p>
          </div>
        </div>

        {/* Recommendation */}
        <div style={{ ...stagger(8), marginTop: SPACE.lg }}>
          <h2 style={{ ...TYPE.overline, color: COLORS.textDim, margin: `0 0 ${SPACE.md}px 0` }}>Рекомендация</h2>
          <div style={{
            background: "rgba(16,185,129,0.08)",
            borderRadius: 14,
            padding: SPACE.base,
            border: `1px solid rgba(16,185,129,0.15)`,
          }}>
            <p style={{ ...TYPE.body, color: COLORS.success, margin: 0 }}>{analysis.recommendation}</p>
          </div>
        </div>

        {/* Back button */}
        <Pressable onPress={() => onNavigate("home")} style={{
          ...stagger(9),
          marginTop: SPACE.xl,
          height: 48, borderRadius: 14,
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ ...TYPE.bodyBold, color: COLORS.textMuted }}>← На главную</span>
        </Pressable>
      </div>

      <div style={{ height: SPACE.xl }} />
    </div>
  );
};

// ===== DIARY SCREEN =====
const DiaryScreen = ({ onNavigate }) => (
  <div style={{ flex: 1, overflow: "auto", padding: `0 ${SPACE.lg}px` }}>
    <div style={{ ...stagger(0), paddingTop: SPACE["2xl"] }}>
      <h1 style={{ ...TYPE.title1, color: COLORS.text, margin: 0 }}>Дневник снов</h1>
      <p style={{ ...TYPE.callout, color: COLORS.textMuted, margin: `${SPACE.xs}px 0 0 0` }}>
        {SAMPLE_DREAMS.length} снов записано
      </p>
    </div>

    {/* Search */}
    <div style={{ ...stagger(1), marginTop: SPACE.lg }}>
      <div style={{
        height: 44, borderRadius: 12,
        background: COLORS.bgInput,
        border: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "center",
        padding: `0 ${SPACE.base}px`,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={COLORS.textDim} strokeWidth="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span style={{ ...TYPE.body, color: COLORS.textGhost, marginLeft: SPACE.sm }}>Поиск по снам...</span>
      </div>
    </div>

    {/* Mood filter */}
    <div style={{ ...stagger(2), display: "flex", gap: SPACE.sm, marginTop: SPACE.base, overflow: "auto" }}>
      {["Все", "загадочный", "мечтательный", "тревожный", "вдохновляющий"].map((mood, i) => (
        <div key={mood} style={{
          ...TYPE.caption,
          color: i === 0 ? "#fff" : COLORS.textMuted,
          background: i === 0 ? COLORS.accent : COLORS.bgCard,
          padding: "6px 14px",
          borderRadius: 99,
          whiteSpace: "nowrap",
          border: `1px solid ${i === 0 ? COLORS.accent : COLORS.border}`,
        }}>{mood}</div>
      ))}
    </div>

    {/* Dream list */}
    <div style={{ marginTop: SPACE.lg }}>
      {SAMPLE_DREAMS.map((dream, i) => (
        <Pressable key={dream.id} onPress={() => onNavigate("analysis")} style={{
          ...stagger(i + 3),
          background: COLORS.bgCard,
          borderRadius: 16,
          border: `1px solid ${COLORS.borderLight}`,
          padding: SPACE.base,
          marginBottom: SPACE.md,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.md }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: COLORS.accentBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26,
            }}>
              {dream.emoji}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ ...TYPE.bodyBold, color: COLORS.text, margin: 0 }}>{dream.title}</p>
              <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm, marginTop: SPACE.xs }}>
                <span style={{
                  ...TYPE.micro,
                  color: MOOD_COLORS[dream.mood],
                  background: `${MOOD_COLORS[dream.mood]}18`,
                  padding: "2px 8px", borderRadius: 99,
                }}>{dream.mood}</span>
                <span style={{ ...TYPE.caption, color: COLORS.textDim }}>{dream.date}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ ...TYPE.title3, color: COLORS.accent }}>{dream.lucidity}</span>
              <span style={{ ...TYPE.micro, color: COLORS.textDim }}>балл</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: SPACE.xs, marginTop: SPACE.md, flexWrap: "wrap" }}>
            {dream.symbols.map(s => (
              <span key={s} style={{
                ...TYPE.micro,
                color: COLORS.textDim,
                background: COLORS.bgInput,
                padding: "3px 8px",
                borderRadius: 6,
              }}>#{s}</span>
            ))}
          </div>
        </Pressable>
      ))}
    </div>
    <div style={{ height: SPACE.lg }} />
  </div>
);

// ===== STATS SCREEN =====
const StatsScreen = () => {
  const stats = [
    { label: "Всего снов", value: "47", icon: "🌙" },
    { label: "Этот месяц", value: "12", icon: "📅" },
    { label: "Ср. осознанность", value: "6.8", icon: "🧠" },
    { label: "Серия дней", value: "5", icon: "🔥" },
  ];

  const moodStats = [
    { mood: "Загадочный", pct: 35, color: MOOD_COLORS["загадочный"] },
    { mood: "Мечтательный", pct: 28, color: MOOD_COLORS["мечтательный"] },
    { mood: "Вдохновляющий", pct: 20, color: MOOD_COLORS["вдохновляющий"] },
    { mood: "Трансформирующий", pct: 12, color: MOOD_COLORS["трансформирующий"] },
    { mood: "Тревожный", pct: 5, color: MOOD_COLORS["тревожный"] },
  ];

  return (
    <div style={{ flex: 1, overflow: "auto", padding: `0 ${SPACE.lg}px` }}>
      <div style={{ ...stagger(0), paddingTop: SPACE["2xl"] }}>
        <h1 style={{ ...TYPE.title1, color: COLORS.text, margin: 0 }}>Статистика</h1>
      </div>

      {/* Stats grid */}
      <div style={{ ...stagger(1), display: "grid", gridTemplateColumns: "1fr 1fr", gap: SPACE.md, marginTop: SPACE.xl }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            ...stagger(i + 2),
            background: COLORS.bgCard,
            borderRadius: 16,
            border: `1px solid ${COLORS.borderLight}`,
            padding: SPACE.base,
            textAlign: "center",
          }}>
            <span style={{ fontSize: 28 }}>{s.icon}</span>
            <p style={{ ...TYPE.title1, color: COLORS.text, margin: `${SPACE.sm}px 0 0 0` }}>{s.value}</p>
            <p style={{ ...TYPE.caption, color: COLORS.textMuted, margin: `${SPACE.xs}px 0 0 0` }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Mood distribution */}
      <div style={{ ...stagger(6), marginTop: SPACE.xl }}>
        <h2 style={{ ...TYPE.overline, color: COLORS.textDim, margin: `0 0 ${SPACE.base}px 0` }}>Настроения снов</h2>
        <div style={{ background: COLORS.bgCard, borderRadius: 16, border: `1px solid ${COLORS.borderLight}`, padding: SPACE.base }}>
          {moodStats.map((m, i) => (
            <div key={i} style={{ marginBottom: i < moodStats.length - 1 ? SPACE.md : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: SPACE.xs }}>
                <span style={{ ...TYPE.callout, color: COLORS.text }}>{m.mood}</span>
                <span style={{ ...TYPE.callout, color: COLORS.textMuted }}>{m.pct}%</span>
              </div>
              <div style={{ height: 6, background: COLORS.bgInput, borderRadius: 3 }}>
                <div style={{
                  width: `${m.pct}%`, height: "100%", borderRadius: 3,
                  background: m.color,
                  transition: "width 0.6s ease",
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly chart (simplified) */}
      <div style={{ ...stagger(7), marginTop: SPACE.xl }}>
        <h2 style={{ ...TYPE.overline, color: COLORS.textDim, margin: `0 0 ${SPACE.base}px 0` }}>Активность за неделю</h2>
        <div style={{ background: COLORS.bgCard, borderRadius: 16, border: `1px solid ${COLORS.borderLight}`, padding: SPACE.base }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: 100 }}>
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day, i) => {
              const heights = [60, 40, 80, 0, 90, 50, 70];
              return (
                <div key={day} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SPACE.xs }}>
                  <div style={{
                    width: 28, height: heights[i] || 4,
                    borderRadius: 6,
                    background: heights[i] ? `linear-gradient(180deg, ${COLORS.accent}, ${COLORS.accentLight})` : COLORS.bgInput,
                    opacity: heights[i] ? 1 : 0.3,
                  }} />
                  <span style={{ ...TYPE.micro, color: COLORS.textDim }}>{day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ height: SPACE.xl }} />
    </div>
  );
};

// ===== PROFILE SCREEN =====
const ProfileScreen = () => {
  const menuItems = [
    { icon: "🔔", label: "Уведомления", sub: "Напоминание записать сон" },
    { icon: "🎨", label: "Тема оформления", sub: "Тёмная" },
    { icon: "☁️", label: "Синхронизация", sub: "iCloud" },
    { icon: "🔒", label: "Приватность", sub: "Защита Face ID" },
    { icon: "⭐", label: "Оценить приложение", sub: "" },
    { icon: "💬", label: "Обратная связь", sub: "" },
  ];

  return (
    <div style={{ flex: 1, overflow: "auto", padding: `0 ${SPACE.lg}px` }}>
      <div style={{ ...stagger(0), paddingTop: SPACE["2xl"], textAlign: "center" }}>
        <div style={{
          width: 80, height: 80, borderRadius: 40,
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentLight})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto",
          fontSize: 36,
        }}>🌙</div>
        <h1 style={{ ...TYPE.title1, color: COLORS.text, margin: `${SPACE.md}px 0 0 0` }}>Стас</h1>
        <p style={{ ...TYPE.callout, color: COLORS.textMuted, margin: `${SPACE.xs}px 0 0 0` }}>
          Мечтатель с марта 2026
        </p>
      </div>

      {/* Subscription */}
      <Pressable onPress={() => {}} style={{
        ...stagger(1),
        marginTop: SPACE.xl,
        background: `linear-gradient(135deg, rgba(124,92,252,0.15), rgba(245,166,35,0.1))`,
        borderRadius: 16,
        border: `1px solid ${COLORS.accentGlow}`,
        padding: SPACE.base,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
            {Icons.star()}
            <span style={{ ...TYPE.bodyBold, color: COLORS.gold }}>Dreameeer PRO</span>
          </div>
          <p style={{ ...TYPE.caption, color: COLORS.textMuted, margin: `${SPACE.xs}px 0 0 0` }}>
            Безлимитные анализы и видео
          </p>
        </div>
        <span style={{
          ...TYPE.bodyBold, color: "#fff",
          background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.gold})`,
          padding: "8px 16px", borderRadius: 10,
        }}>$6.99/мес</span>
      </Pressable>

      {/* Menu */}
      <div style={{ marginTop: SPACE.xl }}>
        {menuItems.map((item, i) => (
          <Pressable key={i} onPress={() => {}} style={{
            ...stagger(i + 2),
            display: "flex", alignItems: "center", gap: SPACE.md,
            padding: `${SPACE.base}px 0`,
            borderBottom: i < menuItems.length - 1 ? `1px solid ${COLORS.borderLight}` : "none",
          }}>
            <span style={{ fontSize: 22 }}>{item.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ ...TYPE.body, color: COLORS.text, margin: 0 }}>{item.label}</p>
              {item.sub && <p style={{ ...TYPE.caption, color: COLORS.textDim, margin: 0 }}>{item.sub}</p>}
            </div>
            {Icons.chevronRight()}
          </Pressable>
        ))}
      </div>

      <div style={{ height: SPACE.xl }} />
    </div>
  );
};

// ===== MAIN APP =====
export default function DreameeerApp() {
  const [screen, setScreen] = useState("home");

  const screens = {
    home: <HomeScreen onNavigate={setScreen} />,
    analysis: <AnalysisScreen onNavigate={setScreen} />,
    diary: <DiaryScreen onNavigate={setScreen} />,
    stats: <StatsScreen />,
    profile: <ProfileScreen />,
  };

  const showTabBar = ["home", "diary", "stats", "profile"].includes(screen);

  return (
    <>
      <style>{keyframes}</style>
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)",
        fontFamily: FONT,
        padding: SPACE.xl,
      }}>
        {/* iPhone frame */}
        <div style={{
          width: 375, height: 812,
          borderRadius: 40,
          background: COLORS.bg,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)",
        }}>
          <StatusBar />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
            {screens[screen]}
          </div>
          {showTabBar && <TabBar active={screen} onNavigate={setScreen} />}
          <HomeIndicator />
        </div>
      </div>
    </>
  );
}
