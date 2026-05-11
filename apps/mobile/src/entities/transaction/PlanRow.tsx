/**
 * PlanRow — строка плана для виджета «Планы» в портфеле. Визуально как TxRow,
 * но смотрит в будущее: иконка плана, дата-цель, кнопка «Записать» (execute).
 */
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import type { Plan } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors, fontSize } from "@/shared/config/theme";
import { fmtQty } from "@/shared/lib/format";
import { Button, Txt } from "@/shared/ui";

import { planMeta } from "./meta";

function isFiat(asset?: string | null): boolean {
  return asset === "RUB" || asset === "USD" || asset === "EUR";
}

function leg(qty?: number | null, asset?: string | null): string {
  return `${fmtQty(qty ?? 0)}${asset ? ` ${asset}` : ""}`;
}

interface Props {
  plan: Plan;
  onExecute: () => void;
  onEdit: () => void;
  onDelete: () => void;
  executing?: boolean;
}

export function PlanRow({ plan, onExecute, onEdit, onDelete, executing }: Props) {
  const meta = planMeta(plan.type);
  const [hover, setHover] = useState(false);
  let title = "";
  let sub = "";

  if (plan.type === "in" || plan.type === "out") {
    const a = plan.cashAsset ?? plan.assetId;
    title = (plan.type === "in" ? t("Deposit ", "Пополнение ") : t("Withdrawal ", "Вывод ")) + (a ?? "");
    sub = leg(plan.qty, a);
  } else if (plan.type === "div") {
    title = `${t("Dividend", "Дивиденд")} · ${plan.source ?? ""}`;
    sub = leg(plan.qty, plan.cashAsset);
  } else if (plan.type === "buy" || plan.type === "sell") {
    title =
      (plan.type === "buy" ? t("Buy ", "Купить ") : t("Sell ", "Продать ")) +
      leg(plan.qty, plan.assetId);
    sub = plan.price ? `${t("at", "по")} ${fmtQty(plan.price)} ${plan.cashAsset ?? ""}` : "";
  } else if (plan.type === "tx") {
    title = `${t("Trade", "Транзакция")} · ${plan.fromAsset} → ${plan.toAsset}`;
    sub = `${leg(plan.fromQty, plan.fromAsset)} → ${leg(plan.toQty, plan.toAsset)}`;
  }

  return (
    <Pressable
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      onPress={onEdit}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline2,
        backgroundColor: hover ? colors.surface2 : "transparent",
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: meta.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Txt color={meta.color} size={16} weight="700">
          {meta.icon}
        </Txt>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt size={fontSize.body} weight="500" numberOfLines={1}>
          {title}
        </Txt>
        {sub ? (
          <Txt color={colors.ink3} size={fontSize.mini} numberOfLines={1}>
            {sub}
          </Txt>
        ) : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Button label={t("Execute", "Записать")} variant="primary" size="sm" loading={executing} onPress={onExecute} />
        <Button
          size="icon"
          variant="ghost"
          onPress={onDelete}
          icon={<Feather name="x" size={14} color={colors.ink2} />}
        />
      </View>
    </Pressable>
  );
}
