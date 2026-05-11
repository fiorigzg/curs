/**
 * AssetSearchSelect — комбобокс актива: поле-триггер + выпадающее меню с поиском.
 *
 *  - Клик по полю раскрывает поповер ровно над полем: сверху инпут поиска
 *    (фокус через onShow), ниже — список результатов.
 *  - Пустой ввод → недавно использованные активы первыми (отдаёт бэкенд).
 *  - Элементы с флагом `importable` — внешние инструменты из API (T-Invest /
 *    CoinGecko), которых ещё нет в каталоге. Компонент НЕ импортирует их сам:
 *    он отдаёт кандидата вторым аргументом onChange, а форма материализует его
 *    через /assets/import уже при сохранении сделки.
 *
 * Поповер рендерится в верхнеуровневом RN-Modal и позиционируется по
 * measureInWindow — чтобы не обрезался скроллом модалки сделки.
 */
import { useEffect, useRef, useState } from "react";
import { Modal as RNModal, Pressable, ScrollView, TextInput, View } from "react-native";

import { useAssets, useAssetSearch } from "@/shared/api/hooks";
import type { Asset, AssetSearchItem } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors, fontSize, radius, shadow } from "@/shared/config/theme";
import { AssetIcon, Pill, Txt } from "@/shared/ui";

interface Props {
  value: string;
  /** candidate передаётся только для внешних (importable) активов — форма импортирует их при сохранении. */
  onChange: (id: string, candidate?: AssetSearchItem) => void;
  placeholder?: string;
}

interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function AssetSearchSelect({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  // Подписи только что выбранных внешних активов (их ещё нет в каталоге useAssets).
  const [labelCache, setLabelCache] = useState<Record<string, string>>({});
  const fieldRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);

  const { data: assets = [] } = useAssets();
  const search = useAssetSearch(debounced);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(h);
  }, [query]);

  const current = assets.find((a: Asset) => a.id === value);
  const triggerLabel = current
    ? `${current.id} · ${current.name}`
    : labelCache[value] || value;

  function openDropdown() {
    setQuery("");
    setDebounced("");
    fieldRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(item: AssetSearchItem) {
    if (item.importable) {
      setLabelCache((m) => ({ ...m, [item.id]: `${item.id} · ${item.name}` }));
    }
    onChange(item.id, item.importable ? item : undefined);
    close();
  }

  const results = search.data ?? [];
  const dropWidth = anchor ? Math.max(anchor.width, 264) : 264;

  return (
    <View ref={fieldRef} collapsable={false}>
      <Pressable
        onPress={openDropdown}
        style={{
          borderWidth: 1,
          borderColor: open ? colors.ink : colors.hairline,
          borderRadius: radius.field,
          backgroundColor: colors.surface,
          height: 38,
          paddingHorizontal: 12,
          justifyContent: "center",
        }}
      >
        <Txt size={fontSize.body} color={triggerLabel ? colors.ink : colors.ink4} numberOfLines={1}>
          {triggerLabel || placeholder || t("Asset…", "Актив…")}
        </Txt>
      </Pressable>

      <RNModal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
        onShow={() => setTimeout(() => inputRef.current?.focus(), 30)}
      >
        <View style={{ flex: 1 }}>
          {/* Бэкдроп отдельным слоем: клик мимо — закрыть. */}
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={close}
          />
          {anchor ? (
            <View
              style={{
                position: "absolute",
                top: anchor.y,
                left: anchor.x,
                width: dropWidth,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.ink,
                borderRadius: radius.field,
                overflow: "hidden",
                ...shadow.planForm,
              }}
            >
              <TextInput
                ref={inputRef}
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder={t("Search by ticker or name…", "Поиск по тикеру или названию…")}
                placeholderTextColor={colors.ink4}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  height: 38,
                  paddingHorizontal: 12,
                  fontSize: fontSize.body,
                  color: colors.ink,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.hairline2,
                }}
              />
              <ScrollView style={{ maxHeight: 260 }} keyboardShouldPersistTaps="handled">
                {results.length === 0 ? (
                  <View style={{ padding: 14, alignItems: "center" }}>
                    <Txt color={colors.ink3} size={fontSize.sub}>
                      {search.isFetching
                        ? t("Searching…", "Поиск…")
                        : t("Nothing found", "Ничего не найдено")}
                    </Txt>
                  </View>
                ) : (
                  results.map((it: AssetSearchItem) => (
                    <Pressable
                      key={`${it.source ?? "local"}:${it.id}`}
                      onPress={() => pick(it)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        backgroundColor: it.id === value ? colors.surface2 : "transparent",
                      }}
                    >
                      <AssetIcon id={it.id} size={26} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Txt size={fontSize.body} weight="600">
                            {it.id}
                          </Txt>
                          {it.importable ? <Pill tone="ghost">{t("from API", "из API")}</Pill> : null}
                        </View>
                        <Txt color={colors.ink3} size={fontSize.mini} numberOfLines={1}>
                          {it.name}
                        </Txt>
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </RNModal>
    </View>
  );
}
