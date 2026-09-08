import { Provider } from "./provider";
import { Router } from "./router";

function App() {
  return (
    <Provider>
      <Router />
    </Provider>
  );
}

export { App };