import { AlertCircle } from "lucide-react";

export default function ErrorBox({ children }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-600 text-sm mb-8">
      <AlertCircle size={15} className="flex-shrink-0" />
      {children}
    </div>
  );
}
