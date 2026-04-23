/**
 * Tabs — `.tabs` / `.tab` из styles.css:
 *   inline-flex, bg surface-3, padding 3, radius 8.
 *   tab: padding 5x10, fz 12/500, radius 6, color ink-3; hover → ink; active → surface bg + ink + shadow.
 *
 * RangeTabs — `.range-tabs` / `.range-tab`: mono, padding 4x9, radius 6.
 *   active → ink bg + accent-2 (citron) text.
 */
import { useState } from "react";
import { Pressable, View } from "react-native";

import { colors, fontSize, radius, shadow } from "@/shared/config/theme";
import { rangeLabel } from "@/shared/lib/format";

import { Txt } from "./Txt";

export interface TabItem<K extends string = string> {
  key: K;
  label: string;
  count?: number;
}

interface TabsProps<K extends string> {
  value: K;
  options: TabItem<K>[];
  onChange: (k: K) => void;
}

export function Tabs<K extends string>({ value, options, onChange }: TabsProps<K>) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignSelf: "flex-start",
        backgroundColor: colors.surface3,
        padding: 3,
        borderRadius: radius.button,
        gap: 0,
      }}
    >
      {options.map((o) => (
        <Tab key={o.key} item={o} active={o.key === value} onPress={() => onChange(o.key)} />
      ))}
    </View>
  );
}

function Tab<K extends string>({
  item,
  active,
  onPress,
}: {
  item: TabItem<K>;
  active: boolean;
  onPress: () => void;
}) {
  const [hover, setHover] = useState(false);
  const color = active ? colors.ink : hover ? colors.ink : colors.ink3;
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: radius.sm,
        backgroundColor: active ? colors.surface : "transparent",
        ...(active ? shadow.tab : {}),
      }}
    >
      <Txt color={color} size={fontSize.tab} weight="500">
        {item.label}
      </Txt>
      {item.count !== undefined ? (
        <Txt color={colors.ink3} size={fontSize.micro}>
          {item.count}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const DEFAULT_RANGES = ["1Н", "1М", "3М", "1Г", "Всё"] as const;
export type RangeKey = (typeof DEFAULT_RANGES)[number];

export function RangeTabs({
  value,
  onChange,
  options = DEFAULT_RANGES as unknown as readonly RangeKey[],
}: {
  value: RangeKey | string;
  onChange: (v: RangeKey) => void;
  options?: readonly RangeKey[];
}) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {options.map((o) => (
        <RangeTab key={o} label={rangeLabel(o)} active={o === value} onPress={() => onChange(o)} />
      ))}
    </View>
  );
}

function RangeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: radius.sm,
        backgroundColor: active ? colors.ink : "transparent",
      }}
    >
      <Txt
        color={active ? colors.accent2 : hover ? colors.ink : colors.ink3}
        size={fontSize.rangeTab}
        weight="500"
        mono
      >
        {label}
      </Txt>
    </Pressable>
  );
}
