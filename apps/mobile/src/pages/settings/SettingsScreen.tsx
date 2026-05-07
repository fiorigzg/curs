/**
 * Settings — `settings.jsx :: SettingsScreen`. Десктоп layout:
 *   .content max-width 880.
 *   PageHead "Настройки".
 *   AppearanceCard — язык (Русский/English) + тема (тёмная/светлая).
 *   SecurityCard — смена пароля (current/new/confirm).
 *   SourcesCard — provider-карточки: T-Invest + CoinGecko.
 */
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import {
  useChangePassword,
  useMe,
  useProviders,
  useSaveProvider,
  useTestProvider,
} from "@/shared/api/hooks";
import type { Provider } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors, fontSize, radius } from "@/shared/config/theme";
import { useAuth } from "@/shared/store/auth";
import { useSettings } from "@/shared/store/settings";
import { Button, Card, Field, Input, PageHead, Txt } from "@/shared/ui";

interface ProviderMeta {
  id: "tinkoff" | "coingecko";
  name: string;
  short: string;
  bg: string;
  fg: string;
  sub: string;
  docs: string;
  hint: string;
  fields: Array<{ key: string; label: string; placeholder?: string; readonly?: boolean; type?: "select"; options?: string[] }>;
}

function useProvidersMeta(): ProviderMeta[] {
  return [
    {
      id: "tinkoff",
      name: t("T-Invest", "Т-Инвестиции"),
      short: "Т",
      bg: "#FFDD2D",
      fg: "#15140F",
      sub: t("Stocks, bonds, ETFs, funds (RU + global)", "Акции, облигации, ETF, фонды (РФ + зарубежка)"),
      docs: "developer.tbank.ru/invest/intro/intro",
      hint: t(
        "OAuth token from T-Invest settings. Stored encrypted (Fernet) on the server.",
        "OAuth-токен из настроек Т-Инвестиции. Хранится зашифрованным (Fernet) на сервере.",
      ),
      fields: [{ key: "token", label: t("OAuth token", "OAuth-токен"), placeholder: "t.AAAA..." }],
    },
    {
      id: "coingecko",
      name: "CoinGecko",
      short: "C",
      bg: "#8DC647",
      fg: "#15140F",
      sub: t("Crypto: BTC, ETH and 10,000+ tokens", "Крипта: BTC, ETH и 10 000+ токенов"),
      docs: "docs.coingecko.com",
      hint: t("No key needed for the Demo plan: 30 requests/min.", "Без ключа доступен Demo-план: 30 запросов/мин."),
      fields: [
        { key: "apiKey", label: t("API key", "API ключ"), placeholder: t("CG-xxxxxx (for Pro plan)", "CG-xxxxxx (для Pro плана)") },
        {
          key: "plan",
          label: t("Plan", "План"),
          type: "select",
          options: [t("Demo (free)", "Demo (бесплатно)"), "Analyst", "Pro", "Enterprise"],
        },
      ],
    },
  ];
}

export function SettingsScreen() {
  const me = useMe(true);
  const user = useAuth((s) => s.user) ?? me.data;
  const logout = useAuth((s) => s.logout);
  const { data: providers = [] } = useProviders();
  const PROVIDERS = useProvidersMeta();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 28, paddingBottom: 64 }}
    >
      <View style={{ width: "100%", maxWidth: 880, alignSelf: "center" }}>
        <PageHead title={t("Settings", "Настройки")} sub={t("Appearance, security and market-data sources", "Оформление, безопасность и источники рыночных данных")} />

        <AppearanceCard />

        <View style={{ height: 22 }} />

        <SecurityCard />

        <View style={{ height: 22 }} />

        <Card>
          <View style={{ marginBottom: 18 }}>
            <Txt size={fontSize.sectionTitleLg} weight="600">
              {t("Market-data sources", "Источники рыночных данных")}
            </Txt>
            <Txt color={colors.ink3} size={fontSize.mini} style={{ marginTop: 4 }}>
              {t("APIs for fetching live quotes", "API для подгрузки актуальных котировок")}
            </Txt>
          </View>

          <View style={{ gap: 14 }}>
            {PROVIDERS.map((meta) => (
              <ProviderRow
                key={meta.id}
                meta={meta}
                provider={providers.find((p: Provider) => p.id === meta.id)}
              />
            ))}
          </View>

          <View
            style={{
              marginTop: 14,
              padding: 12,
              backgroundColor: colors.surface2,
              borderRadius: radius.button,
            }}
          >
            <Txt color={colors.ink3} size={fontSize.sub} style={{ lineHeight: 18 }}>
              {t(
                "Currency rates are fetched automatically from the CBR — no separate source needed.",
                "Для валют курс ЦБ РФ подгружается автоматически — отдельного источника не требуется.",
              )}
            </Txt>
          </View>
        </Card>

        {user ? (
          <View style={{ marginTop: 22 }}>
            <Button label={t("Log out", "Выйти")} onPress={logout} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** Appearance — язык + тема. */
function AppearanceCard() {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const lang = useSettings((s) => s.lang);
  const setLang = useSettings((s) => s.setLang);
  const baseCurrency = useSettings((s) => s.baseCurrency);
  const setBaseCurrency = useSettings((s) => s.setBaseCurrency);

  return (
    <Card>
      <View style={{ marginBottom: 18 }}>
        <Txt size={fontSize.sectionTitleLg} weight="600">
          {t("Appearance", "Оформление")}
        </Txt>
        <Txt color={colors.ink3} size={fontSize.mini} style={{ marginTop: 4 }}>
          {t("Interface language and color theme", "Язык интерфейса и цветовая тема")}
        </Txt>
      </View>

      <View style={{ gap: 16 }}>
        <Field label={t("Language", "Язык")}>
          <Seg
            options={[
              { key: "en", label: "English" },
              { key: "ru", label: "Русский" },
            ]}
            value={lang}
            onChange={(v) => setLang(v as "en" | "ru")}
          />
        </Field>

        <Field label={t("Theme", "Тема")}>
          <Seg
            options={[
              { key: "dark", label: t("Dark", "Тёмная") },
              { key: "light", label: t("Light", "Светлая") },
            ]}
            value={theme}
            onChange={(v) => setTheme(v as "dark" | "light")}
          />
        </Field>

        <Field label={t("Base currency", "Валюта расчётов")}>
          <Seg
            options={[
              { key: "RUB", label: t("Ruble (₽)", "Рубль (₽)") },
              { key: "USD", label: t("Dollar ($)", "Доллар ($)") },
            ]}
            value={baseCurrency}
            onChange={(v) => setBaseCurrency(v as "RUB" | "USD")}
          />
        </Field>
      </View>
    </Card>
  );
}

function Seg({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface2,
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.button,
        padding: 3,
        gap: 3,
        alignSelf: "flex-start",
      }}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 18,
              borderRadius: radius.sm,
              backgroundColor: active ? colors.ink : "transparent",
            }}
          >
            <Txt color={active ? colors.surface : colors.ink2} size={fontSize.button} weight="500">
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

function SecurityCard() {
  const change = useChangePassword();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);

  const match = pw && pw2 && pw === pw2;
  const canSave = cur.length >= 6 && pw.length >= 8 && !!match;

  async function submit() {
    try {
      await change.mutateAsync({ current: cur, new: pw });
      setDone(true);
      setCur("");
      setPw("");
      setPw2("");
      setTimeout(() => setDone(false), 2400);
    } catch {
      /* handled by isError */
    }
  }

  return (
    <Card>
      <View style={{ marginBottom: 18 }}>
        <Txt size={fontSize.sectionTitleLg} weight="600">
          {t("Change password", "Смена пароля")}
        </Txt>
        <Txt color={colors.ink3} size={fontSize.mini} style={{ marginTop: 4 }}>
          {t("At least 8 characters · letters and digits", "Минимум 8 символов · буквы и цифры")}
        </Txt>
      </View>

      <View style={{ flexDirection: "row", gap: 14, marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Field label={t("Current password", "Текущий пароль")}>
            <Input value={cur} onChangeText={setCur} secureTextEntry />
          </Field>
        </View>
        <View style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 14, marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Field label={t("New password", "Новый пароль")}>
            <Input value={pw} onChangeText={setPw} secureTextEntry />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t("Confirm", "Подтвердите")}>
            <Input value={pw2} onChangeText={setPw2} secureTextEntry />
            {pw2 ? (
              <Txt color={match ? colors.up : colors.down} size={fontSize.mini} weight="500">
                {match ? t("✓ matches", "✓ совпадает") : t("⨯ passwords don't match", "⨯ пароли не совпадают")}
              </Txt>
            ) : null}
          </Field>
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 18,
        }}
      >
        <Txt color={done ? colors.up : colors.ink3} size={fontSize.mini}>
          {done ? t("✓ Password updated", "✓ Пароль обновлён") : t("Self-service password", "Самообслуживаемый пароль")}
        </Txt>
        <Button label={t("Save password", "Сохранить пароль")} variant="primary" disabled={!canSave} loading={change.isPending} onPress={submit} />
      </View>
    </Card>
  );
}

function ProviderRow({
  meta,
  provider,
}: {
  meta: ProviderMeta;
  provider?: Provider;
}) {
  const save = useSaveProvider();
  const test = useTestProvider();
  const [expanded, setExpanded] = useState(false);
  const [secret, setSecret] = useState("");
  const connected = provider?.connected ?? false;

  async function toggle() {
    const fields: Record<string, string> = {};
    if (secret) fields[meta.fields[0].key] = secret;
    await save.mutateAsync({ id: meta.id, connected: !connected, fields });
    setSecret("");
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: connected ? colors.ink4 : colors.hairline,
        backgroundColor: connected ? colors.surface2 : colors.surface,
        borderRadius: 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingVertical: 14,
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            backgroundColor: meta.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Txt color={meta.fg} size={13} weight="700" mono>
            {meta.short}
          </Txt>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt size={fontSize.body} weight="600">
            {meta.name}
          </Txt>
          <Txt color={colors.ink3} size={fontSize.mini} mono numberOfLines={1}>
            {meta.docs}
          </Txt>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: connected ? colors.up : colors.ink4,
            }}
          />
          <Txt color={connected ? colors.upInk : colors.ink3} size={fontSize.mini} mono>
            {connected ? t("connected", "подключено") : t("not connected", "не подключено")}
          </Txt>
        </View>
        <Button label={expanded ? t("Hide", "Скрыть") : t("Configure", "Настроить")} size="sm" onPress={() => setExpanded((x) => !x)} />
      </View>

      {expanded ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.hairline2,
            padding: 16,
            gap: 12,
          }}
        >
          <Field label={meta.fields[0].label}>
            <Input
              value={secret}
              onChangeText={setSecret}
              placeholder={provider?.fields?.[meta.fields[0].key] ?? meta.fields[0].placeholder ?? ""}
              autoCapitalize="none"
            />
          </Field>
          <View
            style={{
              padding: 10,
              paddingHorizontal: 12,
              backgroundColor: colors.surface2,
              borderRadius: radius.button,
            }}
          >
            <Txt color={colors.ink3} size={fontSize.sub} style={{ lineHeight: 18 }}>
              {meta.hint}
            </Txt>
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Button
              label={test.isPending ? t("Testing…", "Проверяю…") : t("Test connection", "Проверить соединение")}
              size="sm"
              onPress={async () => {
                if (secret) {
                  await save.mutateAsync({
                    id: meta.id,
                    connected,
                    fields: { [meta.fields[0].key]: secret },
                  });
                }
                test.mutate(meta.id);
              }}
            />
            {test.data ? (
              <Txt
                color={test.data.ok ? colors.up : colors.down}
                size={fontSize.mini}
                weight="500"
              >
                {test.data.ok
                  ? t(`✓ Connected · ${test.data.latencyMs} ms`, `✓ Соединение установлено · ${test.data.latencyMs} мс`)
                  : `⨯ ${test.data.error ?? t("error", "ошибка")}`}
              </Txt>
            ) : null}
            <Button
              label={connected ? t("Disconnect", "Отключить") : t("Connect", "Подключить")}
              size="sm"
              variant={connected ? "default" : "primary"}
              loading={save.isPending}
              onPress={toggle}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
