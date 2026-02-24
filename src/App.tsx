import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import "./App.css";

const PlannerPage = lazy(() => import("./pages/PlannerPage").then((module) => ({ default: module.PlannerPage })));
const DishesPage = lazy(() => import("./pages/DishesPage").then((module) => ({ default: module.DishesPage })));
const RulesPage = lazy(() => import("./pages/RulesPage").then((module) => ({ default: module.RulesPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 text-sm text-gray-500">Loading page...</div>}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<PlannerPage />} />
            <Route path="dishes" element={<DishesPage />} />
            <Route path="rules" element={<RulesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
