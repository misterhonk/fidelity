/** Whether ⌘K is open — shared, so the start page's search field can open it too (#215). */
export const usePaletteOpen = () => useState('palette-open', () => false)
