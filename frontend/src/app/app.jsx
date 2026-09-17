import { Provider } from "./provider";
import { Router } from "./router";
import { GlobalReminders } from "./GlobalReminders";

function App() {
  return (
      <Provider>
      <Router />
      <GlobalReminders />
    </Provider>
  );
}

export { App };