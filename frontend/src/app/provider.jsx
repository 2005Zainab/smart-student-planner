function Provider({ children }) {
  // Wrap with global providers here as app grows:
  // ThemeProvider, AuthProvider, etc.
  return children;
}

export { Provider };
