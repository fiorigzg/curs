/**
 * Analytics — `analytics.jsx :: AnalyticsScreen` 1-в-1.
 *
 * Desktop:
 *   .content.wide (max-width none)
 *   .page-head: title "Аналитика" + sub "{pf} · N виджетов";
 *     right: select portfolio (через таб-пиллы) + RangeTabs + "Редактировать"/"Готово" + "+ Виджет".
 *   .widgets-grid (4-col, gap 18): widget × N с data-size xs/sm/md/lg/full.
 *   В edit-режиме: рамки dashed, контролы (← → ×) на hover; sticky .edit-bar внизу.
 *   WidgetGallery — Modal 780, tabs Все/Официальные/Сообщество.
 *
 * Mobile: 1 column, остальное по логике десктопа.
 */
import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  useLayout,
  usePortfolios,
  useSaveLayout,
} from "@/shared/api/hooks";
import type { PortfolioSummary, Range } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors, fontSize, layout, radius } from "@/shared/config/theme";
import { useLayoutMode } from "@/shared/lib/responsive";
import { useApp } from "@/shared/store/app";
import {
  Button,
  Card,
  Modal,
  PageHead,
  RangeTabs,
  Tabs,
  Txt,
} from "@/shared/ui";

import {
  buildWidgets,
  DEFAULT_LAYOUT,
  type WidgetDef,
  type WidgetSize,
} from "@/widgets/analytics/widgets";
import { RecalcButton } from "@/widgets/analytics/RecalcButton";

const COLUMNS = 4;
const SIZE_SPAN: Record<WidgetSize, number> = {
  xs: 1,
  sm: 1,
  md: 2,
  lg: 3,
  full: COLUMNS,
};

export function AnalyticsScreen() {
  const activePortfolio = useApp((s) => s.activePortfolio);
  const setActivePortfolio = useApp((s) => s.setActivePortfolio);
  const mode = useLayoutMode();
  const isDesktop = mode === "desktop";

  const { data: portfolios = [] } = usePortfolios();
  const layoutQ = useLayout();
  const saveLayout = useSaveLayout();

  const [range, setRange] = useState<Range>("1Г");
  const [edit, setEdit] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // Локальный layout (синхронизируем с сервером).
  const [localLayout, setLocalLayout] = useState<string[]>(DEFAULT_LAYOUT);
  useEffect(() => {
    if (layoutQ.data?.widgetIds?.length) setLocalLayout(layoutQ.data.widgetIds);
  }, [layoutQ.data]);

  // Активный портфель — если не выбран в сайдбаре, берём первый.
  const pf: PortfolioSummary | undefined = useMemo(() => {
    if (activePortfolio) return portfolios.find((p: PortfolioSummary) => p.id === activePortfolio) ?? portfolios[0];
    return portfolios[0];
  }, [activePortfolio, portfolios]);

  function commit(newLayout: string[]) {
    setLocalLayout(newLayout);
    saveLayout.mutate(newLayout);
  }
  function add(id: string) {
    if (!localLayout.includes(id)) commit([...localLayout, id]);
  }
  function remove(id: string) {
    commit(localLayout.filter((x) => x !== id));
  }
  function move(id: string, dir: -1 | 1) {
    const i = localLayout.indexOf(id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= localLayout.length) return;
    const next = localLayout.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }
  function reset() {
    commit(DEFAULT_LAYOUT);
  }

  const padH = isDesktop ? layout.contentPadding : 20;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingHorizontal: padH, paddingTop: 28, paddingBottom: 100 }}
    >
      <PageHead
        title={t("Analytics", "Аналитика")}
        sub={
          pf
            ? `${pf.name} · ${localLayout.length} ${pluralWidgets(localLayout.length)}`
            : t("No portfolios", "Нет портфелей")
        }
        right={
          <>
            <RangeTabs value={range} onChange={(v) => setRange(v as Range)} />
            <RecalcButton portfolioId={pf?.id} size="md" />
            <Button
              label={edit ? t("Done", "Готово") : t("Edit", "Редактировать")}
              variant={edit ? "primary" : "default"}
              onPress={() => setEdit((e) => !e)}
            />
            <Button
              label={t("Widget", "Виджет")}
              icon={<Feather name="plus" size={14} color={colors.ink} />}
              onPress={() => setGalleryOpen(true)}
            />
          </>
        }
      />

      {portfolios.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          {portfolios.map((p: PortfolioSummary) => {
            const active = p.id === pf?.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setActivePortfolio(p.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? colors.ink : colors.hairline,
                  backgroundColor: active ? colors.ink : colors.surface,
                }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: p.color }} />
                <Txt color={active ? colors.surface : colors.ink2} size={fontSize.sub} weight="500">
                  {p.name}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {pf ? (
        <WidgetsGrid
          layout={localLayout}
          ctx={{ portfolioId: pf.id, range }}
          edit={edit}
          columns={isDesktop ? COLUMNS : 1}
          onMoveLeft={(id) => move(id, -1)}
          onMoveRight={(id) => move(id, +1)}
          onRemove={remove}
        />
      ) : null}

      {edit ? (
        <View
          style={{
            position: "sticky" as unknown as "absolute",
            bottom: 18,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            marginTop: 22,
            paddingHorizontal: 18,
            paddingVertical: 10,
            backgroundColor: colors.ink,
            borderRadius: 12,
            alignSelf: "flex-start",
          }}
        >
          <Txt color={colors.ink4} size={fontSize.mini}>
            {t(
              "Edit mode. Widgets can be removed and reordered.",
              "Режим редактирования. Виджеты можно удалять и переупорядочивать.",
            )}
          </Txt>
          <Button label={t("Reset", "Сбросить")} size="sm" onPress={reset} />
          <Button label={t("Done", "Готово")} variant="primary" size="sm" onPress={() => setEdit(false)} />
        </View>
      ) : null}

      <WidgetGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        active={localLayout}
        onAdd={add}
        onRemove={remove}
      />
    </ScrollView>
  );
}

function pluralWidgets(n: number) {
  if (n % 10 === 1 && n % 100 !== 11) return t("widget", "виджет");
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return t("widgets", "виджета");
  return t("widgets", "виджетов");
}

function WidgetsGrid({
  layout,
  ctx,
  edit,
  columns,
  onMoveLeft,
  onMoveRight,
  onRemove,
}: {
  layout: string[];
  ctx: { portfolioId: string; range: Range };
  edit: boolean;
  columns: number;
  onMoveLeft: (id: string) => void;
  onMoveRight: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  // Раскладываем по строкам, занимая span'ы. Простой fit без перестановок.
  const WIDGETS = buildWidgets();
  const rows: Array<Array<{ id: string; def: WidgetDef; span: number }>> = [];
  let row: Array<{ id: string; def: WidgetDef; span: number }> = [];
  let used = 0;
  for (const id of layout) {
    const def = WIDGETS[id];
    if (!def) continue;
    const span = Math.min(SIZE_SPAN[def.size], columns);
    if (used + span > columns) {
      rows.push(row);
      row = [];
      used = 0;
    }
    row.push({ id, def, span });
    used += span;
  }
  if (row.length) rows.push(row);

  return (
    <View style={{ gap: 18 }}>
      {rows.map((r, ri) => (
        <View key={ri} style={{ flexDirection: "row", gap: 18, alignItems: "stretch" }}>
          {r.map(({ id, def, span }) => (
            <View
              key={id}
              style={{
                flexGrow: span,
                flexBasis: 0,
                minWidth: 0,
              }}
            >
              <View
                style={{
                  position: "relative",
                  flex: 1,
                  borderWidth: edit ? 1.5 : 0,
                  borderStyle: "dashed",
                  borderColor: colors.hairline,
                  borderRadius: radius.lg,
                }}
              >
                <Card padded>{def.render(ctx)}</Card>
                {edit ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      flexDirection: "row",
                      gap: 4,
                    }}
                  >
                    <WidgetCtrl onPress={() => onMoveLeft(id)} glyph="‹" />
                    <WidgetCtrl onPress={() => onMoveRight(id)} glyph="›" />
                    <WidgetCtrl onPress={() => onRemove(id)} glyph="✕" danger />
                  </View>
                ) : null}
              </View>
            </View>
          ))}
          {/* fill remaining columns with empty space */}
          {(() => {
            const sum = r.reduce((s, x) => s + x.span, 0);
            const rem = Math.max(0, columns - sum);
            return rem > 0 ? <View style={{ flexGrow: rem, flexBasis: 0 }} /> : null;
          })()}
        </View>
      ))}
    </View>
  );
}

function WidgetCtrl({
  onPress,
  glyph,
  danger,
}: {
  onPress: () => void;
  glyph: string;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.hairline,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Txt color={danger ? colors.down : colors.ink2} size={14} weight="600">
        {glyph}
      </Txt>
    </Pressable>
  );
}

function WidgetGallery({
  open,
  onClose,
  active,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  active: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [tab, setTab] = useState<"all" | "official" | "community">("all");
  const all = Object.entries(buildWidgets());
  const visible = all.filter(([, w]) =>
    tab === "all" ? true : tab === "official" ? w.official : !w.official,
  );

  return (
    <Modal
      visible={open}
      onClose={onClose}
      title={t("Widget library", "Библиотека виджетов")}
      sub={t(
        "Build your dashboard from official blocks and community widgets",
        "Дашборд собирается из официальных блоков и виджетов от сообщества",
      )}
      width={780}
      footer={
        <>
          <Txt color={colors.ink3} size={fontSize.mini} style={{ marginRight: "auto" }}>
            {active.length} {t("installed", "установлено")} · {all.length - active.length} {t("available", "доступно")}
          </Txt>
          <Button label={t("Done", "Готово")} variant="primary" onPress={onClose} />
        </>
      }
    >
      <View style={{ alignSelf: "flex-start" }}>
        <Tabs<"all" | "official" | "community">
          value={tab}
          options={[
            { key: "all", label: t("All", "Все") },
            { key: "official", label: t("Official", "Официальные") },
            { key: "community", label: t("Community", "Сообщество") },
          ]}
          onChange={setTab}
        />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
        {visible.map(([id, w]) => {
          const isActive = active.includes(id);
          return (
            <View
              key={id}
              style={{
                flexGrow: 1,
                flexBasis: "48%",
                padding: 14,
                borderWidth: 1,
                borderColor: isActive ? colors.ink4 : colors.hairline,
                backgroundColor: isActive ? colors.surface2 : colors.surface,
                borderRadius: 12,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: w.color,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Txt color={colors.surface} size={18} weight="700">
                  {w.glyph}
                </Txt>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                  <Txt size={fontSize.body} weight="600">
                    {w.title}
                  </Txt>
                  {w.official ? (
                    <Txt color={colors.ink3} size={9} weight="500" mono>
                      {t("OFFICIAL", "ОФИЦ.")}
                    </Txt>
                  ) : (
                    <Txt color={colors.ink3} size={fontSize.mini} mono>
                      {w.author}
                    </Txt>
                  )}
                </View>
                <Txt color={colors.ink3} size={fontSize.mini}>
                  {w.sub}
                </Txt>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <Txt color={colors.ink3} size={fontSize.micro} mono>
                    {w.size.toUpperCase()}
                  </Txt>
                  {w.installs ? (
                    <Txt color={colors.ink3} size={fontSize.micro}>
                      · {w.installs} {t("installs", "установок")}
                    </Txt>
                  ) : null}
                </View>
              </View>
              <Button
                label={isActive ? t("Remove", "Убрать") : t("+ Add", "+ Добавить")}
                size="sm"
                variant={isActive ? "default" : "primary"}
                onPress={() => (isActive ? onRemove(id) : onAdd(id))}
              />
            </View>
          );
        })}
      </View>
    </Modal>
  );
}
