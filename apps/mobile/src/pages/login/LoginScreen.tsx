/**
 * LoginScreen — экран входа (новый, не из эталона; добавлен по decision C self-hosted).
 *   Оформлен теми же токенами styles.css: surface card, ink primary button, accent2 marker.
 */
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";

import { useLogin } from "@/shared/api/hooks";
import { t } from "@/shared/config/i18n";
import { colors, radius } from "@/shared/config/theme";
import { useAuth } from "@/shared/store/auth";
import { Button, Card, Field, Input, Txt } from "@/shared/ui";

export function LoginScreen() {
  const login = useLogin();
  const setSession = useAuth((s) => s.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const res = await login.mutateAsync({ email: email.trim(), password });
      await setSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
      });
    } catch {
      setError(t("Invalid email or password", "Неверный email или пароль"));
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28 }}>
        <View style={{ alignItems: "center", marginBottom: 36 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.lg,
              backgroundColor: colors.ink,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt color={colors.accent2} size={28} weight="700" mono>
              C
            </Txt>
          </View>
          <Txt size={24} weight="600" style={{ marginTop: 14, letterSpacing: -0.5 }}>
            CURS
          </Txt>
          <Txt color={colors.ink3} size={13} style={{ marginTop: 4 }}>
            Portfolio Tracker
          </Txt>
        </View>

        <Card style={{ alignSelf: "center", width: 380, maxWidth: "100%" }}>
          <View style={{ gap: 14 }}>
            <Field label="Email">
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="you@curs.local"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
            <Field label={t("Password", "Пароль")}>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
              />
            </Field>
            {error ? (
              <Txt color={colors.down} size={12} weight="500">
                {error}
              </Txt>
            ) : null}
            <Button
              label={t("Sign in", "Войти")}
              variant="primary"
              fullWidth
              loading={login.isPending}
              disabled={!email || !password}
              onPress={submit}
            />
          </View>
        </Card>

        <Txt
          color={colors.ink4}
          size={12}
          style={{ textAlign: "center", marginTop: 18, lineHeight: 18 }}
        >
          {t(
            "Registration is unavailable — accounts are created by an administrator.",
            "Регистрация недоступна — учётные записи создаёт администратор.",
          )}
        </Txt>
      </View>
    </KeyboardAvoidingView>
  );
}
