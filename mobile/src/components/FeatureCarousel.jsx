import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AUTOPLAY_INTERVAL_MS = 5000;
const IMAGE_HEIGHT = 300;

const ACCENT_CHIPS = [
  { image: require('../../assets/illustrations/chip-check.png'), style: { top: -18, right: 28 } },
  { image: require('../../assets/illustrations/chip-clock.png'), style: { bottom: -18, right: 84 } },
];

/**
 * Full-bleed, auto-advancing hero slideshow used on the login screen:
 * background image per slide, overlaid headline/copy, floating accent
 * chips, arrow + dot navigation. Built on native ScrollView paging +
 * Animated (no extra dependency).
 */
export default function FeatureCarousel({ slides, colors }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);
  const indexRef = useRef(0);
  const timerRef = useRef(null);

  const goTo = useCallback(
    (index, widthOverride) => {
      const width = widthOverride || containerWidth;
      if (!width) return;
      const clamped = (index + slides.length) % slides.length;
      indexRef.current = clamped;
      setActiveIndex(clamped);
      scrollRef.current?.scrollTo({ x: clamped * width, animated: true });
    },
    [containerWidth, slides.length]
  );

  const restartAutoplay = useCallback(() => {
    clearInterval(timerRef.current);
    if (!containerWidth) return;
    timerRef.current = setInterval(() => goTo(indexRef.current + 1), AUTOPLAY_INTERVAL_MS);
  }, [containerWidth, goTo]);

  useEffect(() => {
    restartAutoplay();
    return () => clearInterval(timerRef.current);
  }, [restartAutoplay]);

  const onMomentumScrollEnd = (event) => {
    if (!containerWidth) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
    indexRef.current = index;
    setActiveIndex(index);
    restartAutoplay();
  };

  const manualGoTo = (index) => {
    goTo(index);
    restartAutoplay();
  };

  return (
    <View style={styles.wrap} onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
      <View style={styles.cardWrap}>
        <View style={[styles.card, { height: IMAGE_HEIGHT }]}>
          {containerWidth > 0 && (
            <Animated.ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
              scrollEventThrottle={16}
              onMomentumScrollEnd={onMomentumScrollEnd}
            >
              {slides.map((slide) => (
                <View key={slide.title} style={{ width: containerWidth, height: IMAGE_HEIGHT }}>
                  <Image source={slide.image} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={styles.slideContent}>
                    <View style={styles.badge}>
                      <Ionicons name={slide.icon} size={13} color="#fff" />
                      <Text style={styles.badgeText}>{slide.badge}</Text>
                    </View>
                    <Text style={styles.slideTitle}>{slide.title}</Text>
                    <Text style={styles.slideDescription}>{slide.description}</Text>
                  </View>
                </View>
              ))}
            </Animated.ScrollView>
          )}

          {/* Arrows/dots stay clipped to the rounded card, unlike the chips below */}
          <View style={styles.overlay} pointerEvents="box-none">
            <Pressable onPress={() => manualGoTo(activeIndex - 1)} style={[styles.navButton, styles.navLeft]}>
              <Ionicons name="chevron-back" size={20} color="#1F2937" />
            </Pressable>
            <Pressable onPress={() => manualGoTo(activeIndex + 1)} style={[styles.navButton, styles.navRight]}>
              <Ionicons name="chevron-forward" size={20} color="#1F2937" />
            </Pressable>

            <View style={styles.dots}>
              {slides.map((slide, index) => (
                <Pressable key={slide.title} onPress={() => manualGoTo(index)} hitSlop={8}>
                  <View style={[styles.dot, { width: index === activeIndex ? 22 : 8, opacity: index === activeIndex ? 1 : 0.55 }]} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Deliberately outside the clipped card so they visibly pop over its edge */}
        {ACCENT_CHIPS.map((chip, index) => (
          <Image key={index} source={chip.image} style={[styles.chip, chip.style]} />
        ))}
      </View>

      <View style={styles.statRow}>
        {[
          ['time-outline', '5 PM', 'Auto checkout'],
          ['location-outline', 'Live', 'GPS attendance'],
          ['git-network-outline', 'Org', 'Team hierarchy'],
          ['shield-checkmark-outline', 'OTP', 'Secure login'],
        ].map(([icon, stat, label]) => (
          <View key={label} style={styles.statItem}>
            <Ionicons name={icon} size={15} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{stat}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18, marginTop: 24 },
  cardWrap: { position: 'relative' },
  card: { borderRadius: 24, overflow: 'hidden', backgroundColor: '#111' },
  slideContent: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24, gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  slideTitle: { color: '#fff', fontSize: 26, fontWeight: '900', maxWidth: 340 },
  slideDescription: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 19, maxWidth: 320 },
  overlay: { ...StyleSheet.absoluteFillObject },
  chip: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLeft: { left: 14 },
  navRight: { right: 14 },
  dots: { position: 'absolute', bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4, backgroundColor: '#fff' },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' },
  statItem: { flexGrow: 1, minWidth: 130, gap: 3 },
  statValue: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  statLabel: { fontSize: 11 },
});
