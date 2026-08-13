import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, Text } from 'react-native';

const AUTOPLAY_INTERVAL_MS = 4500;

/**
 * Auto-advancing, swipeable feature slideshow used on the login hero.
 * Each slide fades/scales in as it centers (Animated + native ScrollView
 * paging — no extra native dependency needed).
 */
export default function FeatureCarousel({ slides, colors }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!containerWidth) return undefined;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % slides.length;
      // Set state directly instead of waiting on onMomentumScrollEnd: on web,
      // react-native-web doesn't reliably fire that event for a programmatic
      // (as opposed to touch-driven) scrollTo, which left the dots stuck.
      indexRef.current = next;
      setActiveIndex(next);
      scrollRef.current?.scrollTo({ x: next * containerWidth, animated: true });
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [containerWidth, slides.length]);

  const onMomentumScrollEnd = (event) => {
    if (!containerWidth) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / containerWidth);
    indexRef.current = index;
    setActiveIndex(index);
  };

  return (
    <View
      style={styles.wrap}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
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
          {slides.map((slide, index) => {
            const inputRange = [(index - 1) * containerWidth, index * containerWidth, (index + 1) * containerWidth];
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' });
            const scale = scrollX.interpolate({ inputRange, outputRange: [0.88, 1, 0.88], extrapolate: 'clamp' });
            return (
              <Animated.View key={slide.title} style={[styles.slide, { width: containerWidth, opacity, transform: [{ scale }] }]}>
                <Image source={slide.image} style={styles.image} resizeMode="contain" />
                <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
                <Text style={[styles.description, { color: colors.muted }]}>{slide.description}</Text>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      )}

      <View style={styles.dots}>
        {slides.map((slide, index) => (
          <View
            key={slide.title}
            style={[
              styles.dot,
              {
                backgroundColor: index === activeIndex ? slide.tint : colors.border,
                width: index === activeIndex ? 22 : 8,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  slide: { alignItems: 'center', paddingHorizontal: 6, gap: 10 },
  image: { width: 168, height: 126 },
  title: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  description: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 320 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});
