'use client';

import { AuthProvider } from "@/context/AuthContext";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Toaster } from "sonner";

export default function ClientProviders({ children }) {
    return (
        <AuthProvider>
            <DndProvider backend={HTML5Backend}>
                {children}
                <Toaster
                    position="bottom-right"
                    richColors
                    toastOptions={{
                        style: {
                            background: "var(--color-surface)",
                            color: "var(--color-ink)",
                            borderColor: "var(--color-line)",
                            borderRadius: "var(--radius-md)",
                            fontFamily: "var(--font-sans)",
                        }
                    }}
                />
            </DndProvider>
        </AuthProvider>
    );
}
