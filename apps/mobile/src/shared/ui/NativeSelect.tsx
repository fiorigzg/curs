/**
 * NativeSelect — обёртка над html `<select>` на web и над модальным picker на native.
 *
 * На вебе это самый удобный способ дать длинный список (десятки активов с optgroup),
 * включая клавиатурную навигацию. На native — простой Modal-список Pressable.
 */
import { useState } from "react";
import { Platform, Pressable, View } from "react-native";

import { t } from "@/shared/config/i18n";
import { colors, fontSize, radius } from "@/shared/config/theme";

import { Modal } from "./Modal";
import { Txt } from "./Txt";

export interface NativeSelectOption {
  value: string;
  label: string;
  /** Опциональная группировка — все опции с одинаковым `group` объединяются в optgroup. */
  group?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: NativeSelectOption[];
  placeholder?: string;
  /** Полная ширина (по умолчанию true). */
  fullWidth?: boolean;
}

export function NativeSelect({ value, onChange, options, placeholder, fullWidth = true }: Props) {
  if (Platform.OS === "web") {
    return <WebSelect {...{ value, onChange, options, placeholder, fullWidth }} />;
  }
  return <NativePicker {...{ value, onChange, options, placeholder, fullWidth }} />;
}

function WebSelect({ value, onChange, options, placeholder, fullWidth }: Props) {
  // Группировка
  const groups = new Map<string | undefined, NativeSelectOption[]>();
  for (const o of options) {
    const k = o.group;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(o);
  }

  // Используем «native» элемент `select` через React (react-native-web прокинет его).
  // Прячем дефолтные стили браузера и подгоняем под .inp.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Select: any = "select";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Option: any = "option";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Optgroup: any = "optgroup";

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.hairline,
        borderRadius: radius.field,
        backgroundColor: colors.surface,
        height: 38,
        justifyContent: "center",
        width: fullWidth ? "100%" : undefined,
      }}
    >
      <Select
        value={value}
        onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          backgroundColor: "transparent",
          border: "none",
          outline: "none",
          height: 36,
          paddingLeft: 12,
          paddingRight: 28,
          fontSize: fontSize.body,
          color: colors.ink,
          fontFamily: "inherit",
          cursor: "pointer",
          width: "100%",
        }}
      >
        {placeholder ? <Option value="">{placeholder}</Option> : null}
        {[...groups.entries()].map(([g, opts]) =>
          g ? (
            <Optgroup key={g} label={g}>
              {opts.map((o) => (
                <Option key={o.value} value={o.value}>
                  {o.label}
                </Option>
              ))}
            </Optgroup>
          ) : (
            opts.map((o) => (
              <Option key={o.value} value={o.value}>
                {o.label}
              </Option>
            ))
          ),
        )}
      </Select>
    </View>
  );
}

function NativePicker({ value, onChange, options, placeholder, fullWidth }: Props) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: radius.field,
          backgroundColor: colors.surface,
          height: 38,
          paddingHorizontal: 12,
          justifyContent: "center",
          width: fullWidth ? "100%" : undefined,
        }}
      >
        <Txt
          size={fontSize.body}
          color={current ? colors.ink : colors.ink4}
          numberOfLines={1}
        >
          {current?.label ?? placeholder ?? t("Select…", "Выбрать…")}
        </Txt>
      </Pressable>
      <Modal visible={open} onClose={() => setOpen(false)} title={t("Select", "Выберите")} width={420}>
        <View style={{ gap: 2 }}>
          {options.map((o) => (
            <Pressable
              key={o.value}
              onPress={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: radius.button,
                backgroundColor: o.value === value ? colors.surface2 : "transparent",
              }}
            >
              <Txt size={fontSize.body} color={colors.ink}>
                {o.label}
              </Txt>
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}
