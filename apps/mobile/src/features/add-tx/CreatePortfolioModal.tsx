/**
 * Portfolio modal — create / edit / delete.
 *   Создание: «⊕» в Sidebar → POST /portfolios.
 *   Редактирование: карандаш в шапке портфеля → PUT /portfolios/{id}, либо удаление.
 * Название + цветной маркер (палитра 8 цветов).
 */
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import {
  useCreatePortfolio,
  useDeletePortfolio,
  useUpdatePortfolio,
} from "@/shared/api/hooks";
import { t } from "@/shared/config/i18n";
import { colors, fontSize, radius } from "@/shared/config/theme";
import { useApp } from "@/shared/store/app";
import { Button, Field, Input, Modal, Txt } from "@/shared/ui";

const PORTFOLIO_COLORS = [
  "#15140F",
  "#4F6BED",
  "#EE7544",
  "#1F8F6F",
  "#B58300",
  "#8C5BD7",
  "#C0392B",
  "#2F4858",
];

export function CreatePortfolioModal() {
  const visible = useApp((s) => s.addPortfolioOpen);
  const editing = useApp((s) => s.editPortfolio);
  const close = useApp((s) => s.closeAddPortfolio);
  const setActivePortfolio = useApp((s) => s.setActivePortfolio);
  const setRoute = useApp((s) => s.setRoute);
  const create = useCreatePortfolio();
  const update = useUpdatePortfolio();
  const remove = useDeletePortfolio();

  const isEdit = !!editing;

  const [name, setName] = useState("");
  const [color, setColor] = useState(PORTFOLIO_COLORS[0]);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? "");
    setColor(editing?.color ?? PORTFOLIO_COLORS[0]);
    setConfirmDel(false);
    setErr(null);
  }, [visible, editing]);

  const canSubmit = name.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setErr(null);
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body: { name: name.trim(), color } });
      } else {
        await create.mutateAsync({ name: name.trim(), color });
      }
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Save failed", "Ошибка сохранения"));
    }
  }

  async function onDelete() {
    if (!editing) return;
    if (!confirmDel) {
      setConfirmDel(true);
      return;
    }
    setErr(null);
    try {
      await remove.mutateAsync(editing.id);
      setActivePortfolio(null);
      setRoute("dashboard");
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Delete failed", "Не удалось удалить"));
    }
  }

  return (
    <Modal
      visible={visible}
      onClose={close}
      title={isEdit ? t("Edit portfolio", "Редактировать портфель") : t("New portfolio", "Новый портфель")}
      sub={
        isEdit
          ? t("Rename, recolor or delete", "Переименуйте, смените цвет или удалите")
          : t("Give it a name and pick a color", "Дайте имя и выберите цвет")
      }
      width={460}
      footer={
        <>
          {isEdit ? (
            <Button
              label={confirmDel ? t("Confirm delete", "Точно удалить?") : t("Delete", "Удалить")}
              loading={remove.isPending}
              onPress={onDelete}
              style={{ marginRight: "auto" }}
            />
          ) : null}
          <Button label={t("Cancel", "Отмена")} onPress={close} />
          <Button
            label={isEdit ? t("Save", "Сохранить") : t("Create", "Создать")}
            variant="primary"
            disabled={!canSubmit}
            loading={create.isPending || update.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <Field label={t("Name", "Название")}>
        <Input value={name} onChangeText={setName} placeholder={t("e.g. Long-term", "Например, «Долгосрок»")} />
      </Field>
      <Field label={t("Color", "Цвет")}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {PORTFOLIO_COLORS.map((c) => {
            const active = c === color;
            return (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.md,
                  backgroundColor: c,
                  borderWidth: active ? 2 : 0,
                  borderColor: colors.ink,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {active ? (
                  <Txt color={colors.white} size={14} weight="700">
                    ✓
                  </Txt>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Field>
      {isEdit && confirmDel ? (
        <Txt color={colors.ink3} size={fontSize.mini}>
          {t(
            "Deleting removes the portfolio and all its transactions. Press delete again to confirm.",
            "Удаление сотрёт портфель и все его сделки. Нажмите «Удалить» ещё раз для подтверждения.",
          )}
        </Txt>
      ) : null}
      {err ? (
        <Txt color={colors.down} size={fontSize.mini}>
          {err}
        </Txt>
      ) : null}
    </Modal>
  );
}
