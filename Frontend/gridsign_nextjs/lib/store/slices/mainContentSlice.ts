import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface MainContentState {
    activeComponent: string;
}

// Deterministic initial state (no window access during SSR to avoid hydration mismatch)
const initialState: MainContentState = {
    activeComponent: 'Homepage',
};

const mainContentSlice = createSlice({
    name: "mainContent",
    initialState,
    reducers: {
        setActiveComponent(state, action: PayloadAction<string>) {
            state.activeComponent = action.payload;
            // Persist only on client after hydration
            if (typeof window !== 'undefined') {
                try { localStorage.setItem('activeComponent', action.payload); } catch {}
            }
        },
    },
});

export const { setActiveComponent } = mainContentSlice.actions;
export default mainContentSlice.reducer;
