/**
 * Modal — `.modal` / `.modal-backdrop` / `.modal-header` / `.modal-body` / `.modal-footer`.
 *   Центральная модалка для десктопа. На mobile-режиме оборачивающий код может вместо неё рендерить Sheet.
 *
 * .modal-backdrop  fixed inset, bg rgba(15,14,10,.32), grid-center, padding 24, fadeIn .15s.
 * .modal           bg surface, radius 18, shadow 0 30 80 rgba(0,0,0,.25), maxH 100vh-48, w 480.
 * .modal-header    padding 22 24 12, fz title 18/600 ls -0.015em.
 * .modal-body      padding 12 24, gap 16.
 * .modal-footer    padding 16 24 22, justifyContent flex-end, gap 10, borderTop hairline-2.
 */
import { useEffect, type ReactNode } from "react";
import { Modal as RNModal, Pressable, ScrollView, View } from "react-native";

import { colors, fontSize, radius, shadow } from "@/shared/config/theme";

import { Button } from "./Button";
import { Txt } from "./Txt";

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ visible, onClose, title, sub, children, footer, width = 480 }: Props) {
  // Esc на web
  useEffect(() => {
    if (!visible || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.modalBackdrop,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            width,
            maxWidth: "100%",
            maxHeight: "100%",
            backgroundColor: colors.surface,
            borderRadius: radius.modal,
            ...shadow.modal,
            overflow: "hidden",
          }}
        >
          {title ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingTop: 22,
                paddingHorizontal: 24,
                paddingBottom: 12,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Txt size={fontSize.modalTitle} weight="600" style={{ letterSpacing: -0.27 }}>
                  {title}
                </Txt>
                {sub ? (
                  <Txt color={colors.ink3} size={fontSize.mini}>
                    {sub as string}
                  </Txt>
                ) : null}
              </View>
              <Button variant="ghost" size="icon" onPress={onClose} label="✕" />
            </View>
          ) : null}
          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12, gap: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer ? (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 10,
                padding: 16,
                paddingHorizontal: 24,
                paddingBottom: 22,
                borderTopWidth: 1,
                borderTopColor: colors.hairline2,
              }}
            >
              {footer}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}
