/**
 * AddTxModal — `modals.jsx :: AddTxModal`. Центральная модалка для десктопа (480-560px).
 *
 *   1) Тип (seg-list-4): in / out / tx / div
 *   2) Портфель + дата (общая часть, grid-2)
 *   3) Тип-специфичное тело:
 *        in/out  — fiat-select + qty
 *        tx      — отдаём (asset+qty) → swap → получаем (asset+qty), hint с курсом
 *        div     — источник + валюта + сумма
 *   4) Footer: «Отмена» / «Добавить»
 *
 * Сабмитит на POST /transactions через useCreateTransaction.
 */
import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import {
  useAssets,
  useConvert,
  useCreatePlan,
  useCreateTransaction,
  useDeletePlan,
  useDeleteTransaction,
  useImportAsset,
  usePortfolios,
  useUpdatePlan,
  useUpdateTransaction,
} from "@/shared/api/hooks";
import type { Asset, AssetSearchItem, PortfolioSummary, TxType } from "@/shared/api/types";
import { t } from "@/shared/config/i18n";
import { colors, fontSize, radius } from "@/shared/config/theme";
import { baseSym, fmtMoneyCompact, fmtQty, toBase } from "@/shared/lib/format";
import { useApp } from "@/shared/store/app";
import {
  Button,
  Field,
  Input,
  Modal,
  NativeSelect,
  SegList,
  Txt,
  type NativeSelectOption,
  type SegOption,
} from "@/shared/ui";

import { txMeta } from "@/entities/transaction/meta";
import { AssetSearchSelect } from "@/features/asset-search/AssetSearchSelect";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseNum(s: string): number {
  const x = parseFloat(s.replace(",", "."));
  return Number.isFinite(x) ? x : 0;
}

function ccySym(ccy: string): string {
  return ccy === "RUB" ? "₽" : ccy === "USD" ? "$" : ccy === "EUR" ? "€" : ccy;
}

function rateToBase(assets: Asset[], ccy: string): number {
  if (ccy === "RUB") return 1;
  const fiat = assets.find((a) => a.class === "fiat" && a.ccy === ccy);
  return fiat?.price ?? 1;
}

export function AddTxModal() {
  const visible = useApp((s) => s.addTxOpen);
  const mode = useApp((s) => s.addTxMode);
  const preset = useApp((s) => s.addTxPresetPortfolio);
  const editTx = useApp((s) => s.editTx);
  const editPlan = useApp((s) => s.editPlan);
  const close = useApp((s) => s.closeAddTx);
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const removePlan = useDeletePlan();
  const convert = useConvert();
  const importAsset = useImportAsset();
  const { data: portfolios = [] } = usePortfolios();
  const { data: assets = [] } = useAssets();

  const isPlan = mode === "plan";
  const isEdit = isPlan ? !!editPlan : !!editTx;

  // Внешние активы, выбранные в поиске («из API»): материализуем в каталог при сохранении.
  const pendingAssets = useRef<Record<string, AssetSearchItem>>({});
  function rememberCandidate(id: string, c?: AssetSearchItem) {
    if (c) pendingAssets.current[id] = c;
  }
  async function ensureImported(ids: string[]) {
    for (const id of ids) {
      const c = pendingAssets.current[id];
      if (c) {
        await importAsset.mutateAsync({
          id: c.id,
          name: c.name,
          class: c.class,
          subclass: c.subclass ?? null,
          ccy: c.ccy,
          source: c.source ?? null,
        });
      }
    }
  }

  const [type, setType] = useState<TxType>("tx");
  const [portfolioId, setPortfolioId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  // in / out
  const [asset, setAsset] = useState("RUB");
  const [qty, setQty] = useState("");
  // tx
  const [fromAsset, setFromAsset] = useState("RUB");
  const [fromQty, setFromQty] = useState("");
  const [toAsset, setToAsset] = useState("SBER");
  const [toQty, setToQty] = useState("");
  // div
  const [divSource, setDivSource] = useState("SBER");
  const [divCashAsset, setDivCashAsset] = useState("RUB");
  const [divQty, setDivQty] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Reset/prefill ТОЛЬКО в момент открытия модалки. Гейтим по переходу visible
  // false→true через ref: иначе фоновый рефетч usePortfolios (новая ссылка массива)
  // повторно дёргал бы эффект и стирал введённое.
  const wasVisible = useRef(false);
  useEffect(() => {
    const justOpened = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!justOpened) return;
    setErr(null);
    pendingAssets.current = {};
    // Редактирование плана: у плана те же поля, что у сделки (tx/in/out/div).
    if (isPlan && editPlan) {
      const pt = (editPlan.type === "buy" || editPlan.type === "sell" ? "tx" : editPlan.type) as TxType;
      setType(pt);
      setPortfolioId(editPlan.portfolioId);
      setDate(editPlan.d.slice(0, 10));
      if (pt === "in" || pt === "out") {
        setAsset(editPlan.assetId ?? "RUB");
        setQty(String(editPlan.qty ?? ""));
      } else if (pt === "tx") {
        setFromAsset(editPlan.fromAsset ?? "RUB");
        setFromQty(String(editPlan.fromQty ?? ""));
        setToAsset(editPlan.toAsset ?? "SBER");
        setToQty(String(editPlan.toQty ?? ""));
      } else if (pt === "div") {
        setDivSource(editPlan.source ?? "SBER");
        setDivCashAsset(editPlan.cashAsset ?? "RUB");
        setDivQty(String(editPlan.qty ?? ""));
      }
      return;
    }
    if (!isPlan && editTx) {
      setType(editTx.type);
      setPortfolioId(editTx.portfolio);
      setDate(editTx.d.slice(0, 10));
      if (editTx.type === "in" || editTx.type === "out") {
        setAsset(editTx.asset ?? "RUB");
        setQty(String(editTx.qty ?? ""));
      } else if (editTx.type === "tx" && editTx.from && editTx.to) {
        setFromAsset(editTx.from.asset);
        setFromQty(String(editTx.from.qty));
        setToAsset(editTx.to.asset);
        setToQty(String(editTx.to.qty));
      } else if (editTx.type === "div") {
        setDivSource(editTx.source ?? "SBER");
        setDivCashAsset(editTx.cashAsset ?? "RUB");
        setDivQty(String(editTx.qty ?? ""));
      }
      return;
    }
    setType("tx");
    setPortfolioId(preset ?? portfolios[0]?.id ?? "");
    setDate(todayISO());
    setQty("");
    setFromQty("");
    setToQty("");
    setDivQty("");
  }, [visible, preset, editTx, editPlan, isPlan]);

  // Портфели грузятся асинхронно: если к открытию их ещё не было, проставим
  // дефолт, когда подъедут (не трогая остальные поля).
  useEffect(() => {
    if (visible && !portfolioId && !editTx && !editPlan) {
      setPortfolioId(preset ?? portfolios[0]?.id ?? "");
    }
  }, [visible, portfolios, preset, portfolioId, editTx, editPlan]);

  const portfolioOpts: NativeSelectOption[] = portfolios.map((p: PortfolioSummary) => ({
    value: p.id,
    label: p.name,
  }));

  // Live ratio для swap
  const fromA = assets.find((a: Asset) => a.id === fromAsset);
  const toA = assets.find((a: Asset) => a.id === toAsset);
  const valueBase = (id: string, q: number) => {
    const a = assets.find((x: Asset) => x.id === id);
    if (!a || !q) return 0;
    const price = a.class === "fiat" ? rateToBase(assets, a.ccy) : (a.price ?? 0) * rateToBase(assets, a.ccy);
    return q * price;
  };
  const fromVal = valueBase(fromAsset, parseNum(fromQty));
  // Курс сделки — из введённых количеств (а не из рыночных цен):
  //   rate = сколько fromAsset за 1 toAsset; revRate = сколько toAsset за 1 fromAsset.
  const fq = parseNum(fromQty);
  const tq = parseNum(toQty);
  const rate = fq > 0 && tq > 0 ? fq / tq : null;
  const revRate = rate ? 1 / rate : null;

  const canSubmit =
    type === "in"
      ? parseNum(qty) > 0 && !!portfolioId
      : type === "out"
        ? parseNum(qty) > 0 && !!portfolioId
        : type === "tx"
          ? fromAsset !== toAsset && parseNum(fromQty) > 0 && parseNum(toQty) > 0 && !!portfolioId
          : type === "div"
            ? parseNum(divQty) > 0 && !!portfolioId
            : false;

  function txBody(): Record<string, unknown> {
    const isoDate = new Date(date).toISOString();
    if (type === "in" || type === "out") {
      return { type, portfolio: portfolioId, d: isoDate, asset, qty: parseNum(qty) };
    }
    if (type === "tx") {
      return {
        type: "tx",
        portfolio: portfolioId,
        d: isoDate,
        from: { asset: fromAsset, qty: parseNum(fromQty) },
        to: { asset: toAsset, qty: parseNum(toQty) },
      };
    }
    return {
      type: "div",
      portfolio: portfolioId,
      d: isoDate,
      source: divSource,
      cashAsset: divCashAsset,
      qty: parseNum(divQty),
    };
  }

  /** План использует те же поля (camelCase). Дата у плана не задаётся — ставим
   *  сегодняшнюю (бэкенд требует поле), в UI её не показываем. */
  function planBody(): Record<string, unknown> {
    const base = { type, portfolioId, d: editPlan?.d?.slice(0, 10) ?? todayISO() };
    if (type === "in" || type === "out") {
      return { ...base, assetId: asset, qty: parseNum(qty) };
    }
    if (type === "tx") {
      return {
        ...base,
        fromAsset,
        fromQty: parseNum(fromQty),
        toAsset,
        toQty: parseNum(toQty),
      };
    }
    return { ...base, source: divSource, cashAsset: divCashAsset, qty: parseNum(divQty) };
  }

  async function submit() {
    if (!canSubmit) return;
    setErr(null);
    const usedIds =
      type === "in" || type === "out"
        ? [asset]
        : type === "tx"
          ? [fromAsset, toAsset]
          : [divSource, divCashAsset];
    try {
      // Сначала материализуем выбранные внешние активы в каталог, затем запись.
      await ensureImported(usedIds);
      if (isPlan) {
        if (editPlan) await updatePlan.mutateAsync({ id: editPlan.id, body: planBody() });
        else await createPlan.mutateAsync(planBody());
      } else if (editTx) {
        await update.mutateAsync({ id: editTx.id, body: txBody() });
      } else {
        await create.mutateAsync(txBody());
      }
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Save failed", "Ошибка сохранения"));
    }
  }

  async function onDelete() {
    setErr(null);
    try {
      if (isPlan && editPlan) await removePlan.mutateAsync(editPlan.id);
      else if (editTx) await remove.mutateAsync(editTx.id);
      else return;
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("Delete failed", "Не удалось удалить"));
    }
  }

  function swap() {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setFromQty(toQty);
    setToQty(fromQty);
  }

  /** Подставить кол-во `to` по курсу на дату сделки (через рублёвую стоимость ног). */
  async function fillToFromRate() {
    const q = parseNum(fromQty);
    if (!q || fromAsset === toAsset) return;
    setErr(null);
    try {
      const r = await convert.mutateAsync({ from: fromAsset, to: toAsset, qty: q, at: date });
      // до 8 значимых дробных, без хвостовых нулей
      setToQty(String(Number(r.toQty.toFixed(8))));
    } catch {
      setErr(t("No quote for this date — try another", "Нет котировки на эту дату — выберите другую"));
    }
  }

  const TYPE_OPTS: { key: TxType; label: string; sub: string }[] = [
    { key: "tx", label: t("Trade", "Транзакция"), sub: t("Buy/sell one asset for another", "Покупка/продажа одного за другой") },
    { key: "in", label: t("Deposit", "Пополнение"), sub: t("Add cash to the portfolio", "Внести валюту в портфель") },
    { key: "out", label: t("Withdrawal", "Вывод"), sub: t("Withdraw cash from the portfolio", "Снять валюту с портфеля") },
    { key: "div", label: t("Dividend", "Дивиденд"), sub: t("Payout from an asset", "Выплата от актива") },
  ];

  const segOpts: SegOption[] = TYPE_OPTS.map((o) => {
    const m = txMeta(o.key);
    return {
      key: o.key,
      label: o.label,
      sub: o.sub,
      icon: { glyph: m.glyph, bg: m.bg, fg: m.color },
    };
  });

  return (
    <Modal
      visible={visible}
      onClose={close}
      title={
        isPlan
          ? isEdit
            ? t("Edit plan", "Редактировать план")
            : t("New plan", "Новый план")
          : isEdit
            ? t("Edit transaction", "Редактировать сделку")
            : t("New transaction", "Новая сделка")
      }
      width={560}
      footer={
        <>
          {isEdit ? (
            <Button
              label={t("Delete", "Удалить")}
              loading={remove.isPending || removePlan.isPending}
              onPress={onDelete}
              style={{ marginRight: "auto" }}
            />
          ) : null}
          <Button label={t("Cancel", "Отмена")} onPress={close} />
          <Button
            label={isEdit ? t("Save", "Сохранить") : isPlan ? t("Plan it", "В план") : t("Add", "Добавить")}
            variant="primary"
            disabled={!canSubmit}
            loading={create.isPending || update.isPending || createPlan.isPending || updatePlan.isPending}
            onPress={submit}
          />
        </>
      }
    >
      <Field label={t("Type", "Тип")}>
        <SegList options={segOpts} value={type} onChange={(v) => setType(v as TxType)} columns={2} />
      </Field>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label={t("Portfolio", "Портфель")}>
            <NativeSelect
              value={portfolioId}
              onChange={setPortfolioId}
              options={portfolioOpts}
            />
          </Field>
        </View>
        {/* У плана даты нет — поле показываем только для реальной сделки. */}
        {!isPlan ? (
          <View style={{ flex: 1 }}>
            <Field label={t("Date", "Дата")}>
              <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
            </Field>
          </View>
        ) : null}
      </View>

      {isPlan ? (
        <View
          style={{
            padding: 10,
            paddingHorizontal: 12,
            backgroundColor: colors.surface2,
            borderRadius: radius.md,
          }}
        >
          <Txt color={colors.ink3} size={fontSize.mini} style={{ lineHeight: 16 }}>
            {t(
              "A plan is a future transaction. It won't affect the portfolio until you execute it.",
              "План — это будущая сделка. Он не влияет на портфель, пока вы его не проведёте.",
            )}
          </Txt>
        </View>
      ) : null}

      {(type === "in" || type === "out") && (
        <Field label={type === "in" ? t("Deposit", "Вносится") : t("Withdraw", "Снимается")}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ width: 180 }}>
              <AssetSearchSelect
                value={asset}
                onChange={(id, c) => {
                  setAsset(id);
                  rememberCandidate(id, c);
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                value={qty}
                onChangeText={setQty}
                placeholder="0"
                numeric
                suffix={ccySym(asset)}
              />
            </View>
          </View>
        </Field>
      )}

      {type === "tx" && (
        <View style={{ gap: 12 }}>
          <Field label={t("From", "Отдаём")}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ width: 200 }}>
                <AssetSearchSelect
                  value={fromAsset}
                  onChange={(id, c) => {
                    setFromAsset(id);
                    rememberCandidate(id, c);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  value={fromQty}
                  onChangeText={setFromQty}
                  placeholder="0"
                  numeric
                  suffix={fromA?.id ?? ""}
                />
              </View>
            </View>
          </Field>
          <View style={{ alignItems: "center" }}>
            <Button label="↑↓ swap" size="sm" onPress={swap} />
          </View>
          <Field label={t("To", "Получаем")}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ width: 200 }}>
                <AssetSearchSelect
                  value={toAsset}
                  onChange={(id, c) => {
                    setToAsset(id);
                    rememberCandidate(id, c);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  value={toQty}
                  onChangeText={setToQty}
                  placeholder="0"
                  numeric
                  suffix={toA?.id ?? ""}
                />
              </View>
            </View>
          </Field>
          {!isPlan ? (
            <View style={{ alignItems: "flex-end" }}>
              <Button
                label={t("Calc from rate on date", "Рассчитать по курсу на дату")}
                size="sm"
                loading={convert.isPending}
                disabled={!parseNum(fromQty) || fromAsset === toAsset}
                icon={<Feather name="zap" size={13} color={colors.ink2} />}
                onPress={fillToFromRate}
              />
            </View>
          ) : null}
          {rate && revRate && fromA && toA && fromAsset !== toAsset ? (
            <View
              style={{
                padding: 10,
                paddingHorizontal: 12,
                backgroundColor: colors.surface2,
                borderRadius: 8,
                gap: 2,
              }}
            >
              <Txt color={colors.ink3} size={fontSize.sub} style={{ lineHeight: 18 }}>
                {t("Rate", "Курс")}: 1 {toA.id} ={" "}
                <Txt color={colors.ink}>
                  {fmtQty(rate)} {fromA.id}
                </Txt>{" "}
                · ≈ {fmtMoneyCompact(toBase(fromVal))} {baseSym()}
              </Txt>
              <Txt color={colors.ink3} size={fontSize.sub} style={{ lineHeight: 18 }}>
                {t("Reverse", "Обратный")}: 1 {fromA.id} ={" "}
                <Txt color={colors.ink}>
                  {fmtQty(revRate)} {toA.id}
                </Txt>
              </Txt>
            </View>
          ) : null}
        </View>
      )}

      {type === "div" && (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field label={t("Source (asset)", "Источник (актив)")}>
                <AssetSearchSelect
                  value={divSource}
                  onChange={(id, c) => {
                    setDivSource(id);
                    rememberCandidate(id, c);
                  }}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t("Payout currency", "Валюта выплаты")}>
                <AssetSearchSelect
                  value={divCashAsset}
                  onChange={(id, c) => {
                    setDivCashAsset(id);
                    rememberCandidate(id, c);
                  }}
                />
              </Field>
            </View>
          </View>
          <Field label={t("Amount", "Сумма")}>
            <Input
              value={divQty}
              onChangeText={setDivQty}
              placeholder="0"
              numeric
              suffix={ccySym(divCashAsset)}
            />
          </Field>
        </View>
      )}

      {err ? (
        <Txt color={colors.down} size={fontSize.mini}>
          {err}
        </Txt>
      ) : null}
    </Modal>
  );
}
