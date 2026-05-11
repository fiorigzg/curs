/**
 * TxRow — `.tx-row` из styles.css (portfolio.jsx :: TxRow):
 *   padding 14 18, gap 14, borderBottom hairline-2.
 *   icon 32x32 bg meta.bg + glyph meta.color.
 *   title fz 13/500, sub mini ink-3, portfolio pill справа.
 *   value справа: amount mono + дата mini.
 */
import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import type { Transaction } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors, fontSize } from "@/shared/config/theme";
import { fmtCcy, fmtDateShort, fmtQty } from "@/shared/lib/format";
import { Pill, Txt } from "@/shared/ui";

import { txMeta } from "./meta";

function ccyOf(asset?: string | null): string {
  if (!asset) return "RUB";
  if (asset === "USD" || asset === "EUR") return asset;
  return "RUB";
}

/** Фиатная нога рисуется денежным символом, крипто/прочее — как количество + тикер. */
function isFiat(asset?: string | null): boolean {
  return asset === "RUB" || asset === "USD" || asset === "EUR";
}

function fmtLeg(qty: number, asset: string): string {
  if (isFiat(asset)) {
    return fmtCcy(qty, ccyOf(asset), { decimals: ccyOf(asset) === "RUB" ? 0 : 2 });
  }
  return `${fmtQty(qty)} ${asset}`;
}

interface Props {
  tx: Transaction;
  /** Показать pill с именем портфеля (для Dashboard recent-tx). */
  portfolioName?: string;
  portfolioColor?: string;
  /** Если задан — строка кликабельна (редактирование сделки). */
  onPress?: () => void;
}

export function TxRow({ tx, portfolioName, portfolioColor, onPress }: Props) {
  const meta = txMeta(tx.type);
  const [hover, setHover] = useState(false);
  let title = "";
  let sub = "";
  let amount = "";
  let tone: "up" | "down" | "" = "";

  if (tx.type === "in" || tx.type === "out") {
    title = (tx.type === "in" ? t("Deposit ", "Пополнение ") : t("Withdrawal ", "Вывод ")) + tx.asset;
    sub = `${fmtQty(tx.qty ?? 0)} ${tx.asset}`;
    amount =
      (tx.type === "in" ? "+" : "−") +
      fmtCcy(tx.qty ?? 0, ccyOf(tx.asset), { decimals: ccyOf(tx.asset) === "RUB" ? 0 : 2 });
    tone = tx.type === "in" ? "up" : "down";
  } else if (tx.type === "div") {
    title = `${t("Dividend", "Дивиденд")} · ${tx.source}`;
    sub = `${fmtCcy(tx.qty ?? 0, ccyOf(tx.cashAsset), { decimals: ccyOf(tx.cashAsset) === "RUB" ? 0 : 2 })} ${t("to cash", "на счёт")}`;
    amount = "+" + fmtCcy(tx.qty ?? 0, ccyOf(tx.cashAsset), { decimals: ccyOf(tx.cashAsset) === "RUB" ? 0 : 2 });
    tone = "up";
  } else if (tx.type === "tx" && tx.from && tx.to) {
    title = `${t("Trade", "Транзакция")} · ${tx.from.asset} → ${tx.to.asset}`;
    // Курс сделки и обратный курс — из введённых количеств.
    if (tx.from.qty > 0 && tx.to.qty > 0) {
      const rate = tx.from.qty / tx.to.qty; // from за 1 to
      const rev = tx.to.qty / tx.from.qty; // to за 1 from
      sub = `1 ${tx.to.asset} = ${fmtQty(rate)} ${tx.from.asset} · 1 ${tx.from.asset} = ${fmtQty(rev)} ${tx.to.asset}`;
    } else {
      sub = "";
    }
    amount = `−${fmtLeg(tx.from.qty, tx.from.asset)} / +${fmtLeg(tx.to.qty, tx.to.asset)}`;
    tone = "";
  }

  const amtColor = tone === "up" ? colors.up : tone === "down" ? colors.down : colors.ink3;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingHorizontal: 18,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: colors.hairline2,
        backgroundColor: onPress && hover ? colors.surface2 : "transparent",
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
          {meta.glyph}
        </Txt>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Txt size={fontSize.body} weight="500" numberOfLines={1}>
            {title}
          </Txt>
          {portfolioName && portfolioColor ? (
            <Pill tone="ghost" dotColor={portfolioColor}>
              {portfolioName}
            </Pill>
          ) : null}
        </View>
        {sub ? (
          <Txt color={colors.ink3} size={fontSize.mini} numberOfLines={1}>
            {sub}
          </Txt>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Txt color={amtColor} size={fontSize.body} weight="500" mono numberOfLines={1}>
          {amount}
        </Txt>
        <Txt color={colors.ink3} size={fontSize.mini}>
          {fmtDateShort(tx.d)}
        </Txt>
      </View>
      {onPress ? (
        <Feather
          name="edit-2"
          size={14}
          color={hover ? colors.ink2 : colors.ink4}
          style={{ marginLeft: 2 }}
        />
      ) : null}
    </Pressable>
  );
}
