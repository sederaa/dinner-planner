import { Card, CardContent } from "../components/ui/card";

export function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">🔧 Settings</h2>
        <p className="text-gray-600">Configure your preferences and defaults</p>
      </div>

      <Card className="border-gray-100 shadow-lg">
        <CardContent className="p-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-6xl mb-4">⚡</div>
          <p className="text-lg text-gray-500 mb-2">User settings coming soon</p>
          <p className="text-sm text-gray-400">Customize your planning experience</p>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}
