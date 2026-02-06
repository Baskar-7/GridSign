"use client";
import { configureStore } from "@reduxjs/toolkit";
import mainContentReducer from "./slices/mainContentSlice";

export const store = configureStore({
    reducer: {
        mainContent: mainContentReducer,
    },
});

// Types for hooks
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
